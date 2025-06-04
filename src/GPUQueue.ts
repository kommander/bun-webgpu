import { FFIType, JSCallback, type Pointer, ptr } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { fatalError } from "./utils/error";
import { packObjectArray } from "./structs_ffi";
import { 
    normalizeGPUExtent3DStrict, 
    WGPUCallbackInfoStruct, 
    WGPUExtent3DStruct, 
    WGPUTexelCopyBufferLayoutStruct, 
    WGPUTexelCopyTextureInfoStruct
} from "./structs_def";
import { InstanceTicker } from "./GPU";

// Type alias for buffer sources compatible with bun:ffi ptr()
export type PtrSource = ArrayBuffer | ArrayBufferView;

export const QueueWorkDoneStatus = {
    Success: 1,
    CallbackCancelled: 2,
    Error: 3,
    Force32: 0x7FFFFFFF,
} as const;

export class GPUQueueImpl implements GPUQueue {
    __brand: "GPUQueue" = "GPUQueue";
    label: string = 'Main Device Queue';
    private _onSubmittedWorkDoneCallback: JSCallback;
    private _onSubmittedWorkDoneResolves: ((value: undefined) => void)[] = [];
    private _onSubmittedWorkDoneRejects: ((reason?: any) => void)[] = [];
    
    constructor(public readonly ptr: Pointer, private lib: FFISymbols, private instanceTicker: InstanceTicker) {
        this._onSubmittedWorkDoneCallback = new JSCallback(
            (status: number, _userdata1: Pointer | null, _userdata2: Pointer | null) => {
                this.instanceTicker.unregister();
                if (status === QueueWorkDoneStatus.Success) {
                    this._onSubmittedWorkDoneResolves.forEach(r => r(undefined));
                } else {
                    const statusName = Object.keys(QueueWorkDoneStatus).find(key => QueueWorkDoneStatus[key as keyof typeof QueueWorkDoneStatus] === status) || 'Unknown Status';
                    const error = new Error(`Queue work done failed with status: ${statusName}(${status})`);
                    this._onSubmittedWorkDoneRejects.forEach(r => r(error));
                }
                this._onSubmittedWorkDoneResolves = [];
                this._onSubmittedWorkDoneRejects = [];
            },
            {
                args: [FFIType.u32, FFIType.pointer, FFIType.pointer],
                returns: FFIType.void,
            }
        )
    }

    submit(commandBuffers: Iterable<GPUCommandBuffer>): undefined {
        const commandBuffersArray = Array.from(commandBuffers);
        if (!commandBuffersArray || commandBuffersArray.length === 0) { console.warn("queueSubmit: no command buffers provided"); return; }
        const handleView = packObjectArray(commandBuffersArray)
        try { 
            this.lib.wgpuQueueSubmit(this.ptr, commandBuffersArray.length, ptr(handleView.buffer));
            for (const commandBuffer of commandBuffersArray) {
                commandBuffer._destroy();
            }
        } catch(e) { 
            console.error("FFI Error: queueSubmit", e); 
        }
    }

    onSubmittedWorkDone(): Promise<undefined> {
        return new Promise((resolve, reject) => {
            if (!this._onSubmittedWorkDoneCallback.ptr) {
                fatalError('Could not create queue done callback')
            }

            this._onSubmittedWorkDoneResolves.push(resolve);
            this._onSubmittedWorkDoneRejects.push(reject);

            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: this._onSubmittedWorkDoneCallback.ptr,
            });
    
            try {
                this.lib.wgpuQueueOnSubmittedWorkDone(
                    this.ptr,
                    ptr(callbackInfo),
                );
                this.instanceTicker.register();
            } catch (e) {
                reject(e);
            }
        });
    }
    
    writeBuffer(
        buffer: GPUBuffer, 
        bufferOffset: number, 
        data: PtrSource, 
        dataOffset?: number, 
        size?: number
    ): undefined {
        let arrayBuffer: ArrayBuffer;
        let byteOffsetInData: number;
        let byteLengthInData: number;
        let bytesPerElement: number = 1;

        if (data instanceof ArrayBuffer) {
            arrayBuffer = data;
            byteOffsetInData = 0;
            byteLengthInData = data.byteLength;
            bytesPerElement = 1;
        } else if (ArrayBuffer.isView(data)) {
            if (!(data.buffer instanceof ArrayBuffer)) {
                fatalError("queueWriteBuffer: Data view's underlying buffer is not an ArrayBuffer.");
            }
            arrayBuffer = data.buffer;
            byteOffsetInData = data.byteOffset;
            byteLengthInData = data.byteLength;
            
            if ('BYTES_PER_ELEMENT' in data && typeof data.BYTES_PER_ELEMENT === 'number') {
                bytesPerElement = data.BYTES_PER_ELEMENT;
            }
        } else {
            fatalError("queueWriteBuffer: Invalid data type. Must be ArrayBuffer or ArrayBufferView.");
        }

        const dataOffsetElements = dataOffset ?? 0;
        if (dataOffsetElements > Math.floor(byteLengthInData / bytesPerElement)) {
            fatalError("queueWriteBuffer: dataOffset is larger than data's element count.");
        }

        const dataOffsetBytes = dataOffsetElements * bytesPerElement;
        const finalDataOffset = byteOffsetInData + dataOffsetBytes;
        const remainingDataSize = byteLengthInData - dataOffsetBytes;

        let finalSize: number;
        if (size !== undefined) {
            if (size > Number.MAX_SAFE_INTEGER / bytesPerElement) {
                fatalError("queueWriteBuffer: size overflows.");
            }
            finalSize = size * bytesPerElement;
        } else {
            finalSize = remainingDataSize;
        }

        if (finalSize > remainingDataSize) {
            fatalError("queueWriteBuffer: size + dataOffset is larger than data's size.");
        }

        if (finalSize <= 0) {
            console.warn("queueWriteBuffer: Calculated dataSize is 0 or negative, nothing to write.");
            return;
        }

        if (finalSize % 4 !== 0) {
            fatalError("queueWriteBuffer: size is not a multiple of 4 bytes.");
        }

        const dataPtr = ptr(arrayBuffer, finalDataOffset);

        try {
            this.lib.wgpuQueueWriteBuffer(
                this.ptr,
                buffer.ptr,
                BigInt(bufferOffset),
                dataPtr,
                BigInt(finalSize)
            );
        } catch (e) {
            console.error("FFI Error: queueWriteBuffer", e);
        }
    }

    writeTexture(
        destination: GPUTexelCopyTextureInfo,
        data: PtrSource,
        dataLayout: GPUTexelCopyBufferLayout,
        writeSize: GPUExtent3DStrict
    ): undefined {
        if (!this.ptr) {
            fatalError("queueWriteTexture: Invalid queue pointer");
        }

        let arrayBuffer: ArrayBuffer;
        let byteOffsetInData: number;
        let byteLengthInData: number;

        if (data instanceof ArrayBuffer) {
            arrayBuffer = data;
            byteOffsetInData = 0;
            byteLengthInData = data.byteLength;
        } else if (ArrayBuffer.isView(data)) {
            if (!(data.buffer instanceof ArrayBuffer)) {
                fatalError("queueWriteTexture: Data view's underlying buffer is not an ArrayBuffer.");
            }
            arrayBuffer = data.buffer;
            byteOffsetInData = data.byteOffset;
            byteLengthInData = data.byteLength;
        } else {
            fatalError("queueWriteTexture: Invalid data type. Must be ArrayBuffer or ArrayBufferView.");
        }

        if (byteLengthInData <= 0) {
            console.warn("queueWriteTexture: data size is 0 or negative, nothing to write.");
            return;
        }

        const dataPtr = ptr(arrayBuffer, byteOffsetInData);
        const packedDestination = WGPUTexelCopyTextureInfoStruct.pack(destination);
        const normalizedWriteSize = normalizeGPUExtent3DStrict(writeSize);
        
        // Ensure rowsPerImage is set, defaulting to copy height
        const layoutForPacking: GPUTexelCopyBufferLayout = {
             offset: dataLayout.offset ?? 0,
             bytesPerRow: dataLayout.bytesPerRow,
             rowsPerImage: dataLayout.rowsPerImage ?? normalizedWriteSize.height, 
        };
        if (!layoutForPacking.bytesPerRow) {
            fatalError("queueWriteTexture: dataLayout.bytesPerRow is required.");
        }
        const packedLayout = WGPUTexelCopyBufferLayoutStruct.pack(layoutForPacking);
        const packedWriteSize = WGPUExtent3DStruct.pack(normalizedWriteSize);

        try {
            this.lib.wgpuQueueWriteTexture(
                this.ptr,
                ptr(packedDestination),
                dataPtr,
                BigInt(byteLengthInData),
                ptr(packedLayout),
                ptr(packedWriteSize)
            );
        } catch (e) {
            console.error("FFI Error: queueWriteTexture", e);
        }        
    }

    copyBufferToBuffer(source: GPUTexelCopyBufferInfo, destination: GPUTexelCopyBufferInfo, size: number): undefined {
        fatalError('copyBufferToBuffer not implemented', this.ptr, source, destination, size);
    }

    copyBufferToTexture(source: GPUTexelCopyBufferInfo, destination: GPUTexelCopyTextureInfo, size: GPUExtent3D): undefined {
        fatalError('copyBufferToTexture not implemented', this.ptr, source, destination, size);
    }

    copyExternalImageToTexture(source: GPUCopyExternalImageSourceInfo, destination: GPUCopyExternalImageDestInfo, copySize: GPUExtent3DStrict): undefined {
        fatalError('copyExternalImageToTexture not implemented', this.ptr, source, destination, copySize);
    }

    destroy(): undefined {
        this._onSubmittedWorkDoneCallback.close();
        this.lib.wgpuQueueRelease(this.ptr);
    }
}
