import { FFIType, JSCallback, ptr, toArrayBuffer, type Pointer } from "bun:ffi";
import { type FFISymbols } from "./ffi.js";
import type { InstanceTicker } from "./GPU.js";
import { packUserDataId, unpackUserDataId } from "./shared.js";
import {
    WGPUCallbackInfoStruct,
    WGPUChainedStructStruct,
    WGPUCompilationInfoStruct,
    WGPUCompilationMessageStruct,
    WGPUDawnCompilationMessageUtf16Struct,
    WGPUSType,
} from "./structs_def.js";
import { OperationError } from "./utils/error.js";

const CompilationInfoRequestStatus = {
    Success: 1,
    CallbackCancelled: 2,
} as const;

export class GPUCompilationMessageImpl implements GPUCompilationMessage {
    readonly __brand: "GPUCompilationMessage" = "GPUCompilationMessage";

    constructor(
        readonly message: string,
        readonly type: GPUCompilationMessageType,
        readonly lineNum: number,
        readonly linePos: number,
        readonly offset: number,
        readonly length: number,
    ) {}
}

export class GPUCompilationInfoImpl implements GPUCompilationInfo {
    readonly __brand: "GPUCompilationInfo" = "GPUCompilationInfo";

    constructor(readonly messages: ReadonlyArray<GPUCompilationMessage>) {}
}

function readUtf16Positions(chainPtr: number | bigint | null | undefined) {
    let current = Number(chainPtr ?? 0);
    while (current !== 0) {
        const chain = WGPUChainedStructStruct.unpack(toArrayBuffer(current as Pointer, 0, WGPUChainedStructStruct.size));
        if (chain.sType === WGPUSType.DawnCompilationMessageUtf16) {
            return WGPUDawnCompilationMessageUtf16Struct.unpack(
                toArrayBuffer(current as Pointer, 0, WGPUDawnCompilationMessageUtf16Struct.size),
            );
        }
        current = Number(chain.next ?? 0);
    }
    return null;
}

function unpackCompilationMessage(buffer: ArrayBuffer): GPUCompilationMessageImpl {
    const raw = WGPUCompilationMessageStruct.unpack(buffer);
    const positions = readUtf16Positions(raw.nextInChain) ?? raw;
    return new GPUCompilationMessageImpl(
        raw.message,
        raw.type,
        Number(raw.lineNum),
        Number(positions.linePos),
        Number(positions.offset),
        Number(positions.length),
    );
}

function unpackCompilationInfo(infoPtr: Pointer): GPUCompilationInfoImpl {
    const info = WGPUCompilationInfoStruct.unpack(toArrayBuffer(infoPtr, 0, WGPUCompilationInfoStruct.size));
    const messageCount = Number(info.messageCount);
    if (messageCount === 0 || info.messages === 0) {
        return new GPUCompilationInfoImpl([]);
    }

    const messageSize = WGPUCompilationMessageStruct.size;
    const messagesBuffer = toArrayBuffer(info.messages as Pointer, 0, messageCount * messageSize);
    const messages: GPUCompilationMessageImpl[] = [];
    for (let i = 0; i < messageCount; i++) {
        messages.push(unpackCompilationMessage(messagesBuffer.slice(i * messageSize, (i + 1) * messageSize)));
    }
    return new GPUCompilationInfoImpl(messages);
}

let compilationInfoRequestId = 0;
const pendingCompilationInfoRequests = new Map<
    number,
    {
        resolve: (value: GPUCompilationInfo) => void;
        reject: (reason?: any) => void;
        ticker: InstanceTicker;
    }
>();

const compilationInfoCallback = new JSCallback(
    (status: number, infoPtr: Pointer | null, userdata1: Pointer, userdata2: Pointer | null) => {
        const requestId = unpackUserDataId(userdata1);
        const request = pendingCompilationInfoRequests.get(requestId);
        pendingCompilationInfoRequests.delete(requestId);

        if (!request) {
            console.error("[COMPILATION INFO CALLBACK] promise not found for ID:", requestId);
            return;
        }

        request.ticker.unregister();

        if (status !== CompilationInfoRequestStatus.Success || !infoPtr) {
            request.reject(new OperationError(`getCompilationInfo failed with status ${status}`));
            return;
        }

        request.resolve(unpackCompilationInfo(infoPtr));
    },
    {
        args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.pointer],
    },
);

export class GPUShaderModuleImpl implements GPUShaderModule {
    __brand: "GPUShaderModule" = "GPUShaderModule";

    constructor(
        public readonly ptr: Pointer,
        private lib: FFISymbols,
        private instanceTicker: InstanceTicker,
        public readonly label: string,
    ) {
        this.label = label || '';
    }

    getCompilationInfo(): Promise<GPUCompilationInfo> {
        return new Promise((resolve, reject) => {
            const requestId = compilationInfoRequestId++;
            pendingCompilationInfoRequests.set(requestId, { resolve, reject, ticker: this.instanceTicker });

            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: "AllowProcessEvents",
                callback: compilationInfoCallback.ptr!,
                userdata1: ptr(packUserDataId(requestId)),
            });
            this.lib.wgpuShaderModuleGetCompilationInfo(this.ptr, ptr(callbackInfo));
            this.instanceTicker.register();
        });
    }

    destroy(): undefined {
        try {
            this.lib.wgpuShaderModuleRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: shaderModuleRelease", e);
        }
    }
}
