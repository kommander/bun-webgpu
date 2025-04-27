import { FFIType, JSCallback, type Pointer, ptr } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";
import { fatalError } from "./utils/error";
import { packObjectArray } from "./structs_ffi";
import { normalizeGPUExtent3DStrict, WGPUCallbackInfoStruct, WGPUExtent3DStruct, WGPUTexelCopyBufferLayoutStruct, WGPUTexelCopyTextureInfoStruct } from "./structs_def";
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

    constructor(public readonly queuePtr: Pointer, private lib: typeof FFI_SYMBOLS, private instanceTicker: InstanceTicker) {}

    submit(commandBuffers: Iterable<GPUCommandBuffer>): undefined {
        const commandBuffersArray = Array.from(commandBuffers);
        if (!commandBuffersArray || commandBuffersArray.length === 0) { console.warn("queueSubmit: no command buffers provided"); return; }
        const handleView = packObjectArray(commandBuffersArray)
        try { 
            this.lib.wgpuQueueSubmit(this.queuePtr, commandBuffersArray.length, ptr(handleView.buffer)); 
        } catch(e) { 
            console.error("FFI Error: queueSubmit", e); 
        }
    }

    onSubmittedWorkDone(): Promise<undefined> {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.error("Queue onSubmittedWorkDone timed out");
            }, 500);
            const callback = new JSCallback(
                (status: number, _userdata1: Pointer | null, _userdata2: Pointer | null) => {
                    clearTimeout(timeout);
                    this.instanceTicker.unregister();
                    if (status === QueueWorkDoneStatus.Success) {
                        resolve(undefined);
                    } else {
                        const statusName = Object.keys(QueueWorkDoneStatus).find(key => QueueWorkDoneStatus[key as keyof typeof QueueWorkDoneStatus] === status) || 'Unknown Status';
                        reject(new Error(`Queue work done failed with status: ${statusName}(${status})`));
                    }
                    callback.close(); 
                },
                {
                    args: [FFIType.u32, FFIType.pointer, FFIType.pointer],
                    returns: FFIType.void,
                }
            );

            if (!callback || !callback.ptr) {
                fatalError('Could not create queue done callback')
            }

            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: callback.ptr,
            });
    
            try {
                this.lib.wgpuQueueOnSubmittedWorkDone(
                    this.queuePtr,
                    ptr(callbackInfo),
                );
                this.instanceTicker.register();
            } catch (e) {
                reject(e);
            }
        });
    }
    
    writeBuffer(buffer: GPUBuffer, bufferOffset: number, data: ArrayBuffer): undefined {
        let arrayBuffer: ArrayBuffer;
        let byteOffsetInData: number;
        let byteLengthInData: number;
    
        arrayBuffer = data;
        byteOffsetInData = 0;
        byteLengthInData = data.byteLength;
            
        // Calculate the final offset within the underlying ArrayBuffer
        const finalByteOffset = byteOffsetInData + bufferOffset;
        // Calculate the final size to write
        const finalSize = byteLengthInData;
    
        if (finalSize <= 0) {
            console.warn("queueWriteBuffer: Calculated dataSize is 0 or negative, nothing to write.");
            return;
        }
        if (finalByteOffset + finalSize > arrayBuffer.byteLength) {
            fatalError("queueWriteBuffer: dataOffset + dataSize exceeds underlying ArrayBuffer bounds.");
        }
    
        // Get a pointer to the relevant part of the ArrayBuffer
        const dataPtr = ptr(arrayBuffer, finalByteOffset);
    
        try {
            this.lib.wgpuQueueWriteBuffer(
                this.queuePtr,
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
        if (!this.queuePtr) {
            console.warn("queueWriteTexture: null queue pointer");
            return;
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

        // Get pointer to the start of the data in the underlying buffer
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
            fatalError("queueWriteTexture: dataLayout.bytesPerRow is not set.");
        }
        const packedLayout = WGPUTexelCopyBufferLayoutStruct.pack(layoutForPacking);
        const packedWriteSize = WGPUExtent3DStruct.pack(normalizedWriteSize);

        try {
            this.lib.wgpuQueueWriteTexture(
                this.queuePtr,
                ptr(packedDestination),
                dataPtr,
                BigInt(byteLengthInData), // Pass the actual size of the data view/buffer
                ptr(packedLayout),
                ptr(packedWriteSize) // Pass pointer to packed writeSize
            );
        } catch (e) {
            console.error("FFI Error: queueWriteTexture", e);
        }        
        // Let keepAlive go out of scope naturally after FFI call completes
    }

    copyBufferToBuffer(source: GPUTexelCopyBufferInfo, destination: GPUTexelCopyBufferInfo, size: number): undefined {
        fatalError('copyBufferToBuffer not implemented', this.queuePtr, source, destination, size);
    }

    copyBufferToTexture(source: GPUTexelCopyBufferInfo, destination: GPUTexelCopyTextureInfo, size: GPUExtent3D): undefined {
        fatalError('copyBufferToTexture not implemented', this.queuePtr, source, destination, size);
    }

    copyExternalImageToTexture(source: GPUCopyExternalImageSourceInfo, destination: GPUCopyExternalImageDestInfo, copySize: GPUExtent3DStrict): undefined {
        fatalError('copyExternalImageToTexture not implemented', this.queuePtr, source, destination, copySize);
    }
}
