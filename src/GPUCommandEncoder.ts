import { type Pointer, ptr } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";
import { GPUComputePassEncoderImpl } from "./GPUComputePassEncoder";
import { GPURenderPassEncoderImpl } from "./GPURenderPassEncoder";
import { GPUCommandBufferImpl } from "./GPUCommandBuffer";
import { fatalError } from "./utils/error";
import {
    WGPURenderPassDescriptorStruct,
    WGPUComputePassDescriptorStruct,
    WGPUCommandBufferDescriptorStruct,
    WGPUTexelCopyBufferInfoStruct,
    WGPUTexelCopyTextureInfoStruct,
    WGPUExtent3DStruct,
    UINT64_MAX, // For WHOLE_SIZE equivalent
    normalizeGPUExtent3DStrict
} from "./structs_def";
import { GPUBufferImpl } from "./GPUBuffer";

export class GPUCommandEncoderImpl implements GPUCommandEncoder {
    __brand: "GPUCommandEncoder" = "GPUCommandEncoder";
    label: string = 'Main Command Encoder';
    readonly ptr: Pointer;
    private _destroyed = false; // Track destruction

    constructor(public readonly encoderPtr: Pointer, private lib: typeof FFI_SYMBOLS) {
        this.ptr = encoderPtr;
    }

    beginRenderPass(descriptor: GPURenderPassDescriptor): GPURenderPassEncoder {
        if (this._destroyed) {
            fatalError("Cannot call beginRenderPass on destroyed command encoder");
        }
        const colorAttachments = Array.from(descriptor.colorAttachments ?? []).filter(ca => !!ca);
        const packedDescriptorBuffer = WGPURenderPassDescriptorStruct.pack({
            ...descriptor,
            colorAttachments
        });

        const passEncoderPtr = this.lib.wgpuCommandEncoderBeginRenderPass(
            this.encoderPtr,
            ptr(packedDescriptorBuffer)
        );
        if (!passEncoderPtr) {
            fatalError("wgpuCommandEncoderBeginRenderPass returned null.");
        }
        return new GPURenderPassEncoderImpl(passEncoderPtr, this.lib);
    }

    beginComputePass(descriptor: GPUComputePassDescriptor = {}): GPUComputePassEncoder {
        if (this._destroyed) {
            fatalError("Cannot call beginComputePass on destroyed command encoder");
        }
        const packedDescriptorBuffer = WGPUComputePassDescriptorStruct.pack(descriptor);

        const passEncoderPtr = this.lib.wgpuCommandEncoderBeginComputePass(
            this.encoderPtr,
            ptr(packedDescriptorBuffer)
        );
        if (!passEncoderPtr) {
            fatalError("wgpuCommandEncoderBeginComputePass returned null.");
        }
        return new GPUComputePassEncoderImpl(passEncoderPtr, this.lib);
    }

    copyBufferToBuffer(source: GPUBuffer, destination: GPUBuffer, size?: number): undefined;
    copyBufferToBuffer(source: GPUBuffer, sourceOffset: number, destination: GPUBuffer, destinationOffset: number, size: number): undefined;
    copyBufferToBuffer(
        source: GPUBuffer,
        arg2: number | GPUBuffer, // sourceOffset or destination
        arg3?: GPUBuffer | number, // destination or size
        arg4?: number, // destinationOffset
        arg5?: number // size
    ): undefined {
        if (this._destroyed) {
            fatalError("Cannot call copyBufferToBuffer on destroyed command encoder");
        }
        let sourceOffset = 0;
        let destination: GPUBuffer;
        let destinationOffset = 0;
        let size: bigint;

        if (typeof arg2 === 'number') {
            sourceOffset = arg2;
            destination = arg3 as GPUBuffer;
            destinationOffset = arg4 ?? 0;
            size = BigInt(arg5 ?? UINT64_MAX);
        } else {
            if (!(arg2 instanceof GPUBufferImpl)) {
                fatalError("Invalid arguments for copyBufferToBuffer (expected destination buffer)");
            }
            destination = arg2 as GPUBuffer;
            if (typeof arg3 !== 'number') {
                fatalError("Invalid arguments for copyBufferToBuffer (expected size)");
            }
            size = BigInt(arg3);
        }

        try {
            this.lib.wgpuCommandEncoderCopyBufferToBuffer(
                this.encoderPtr,
                source.ptr,
                BigInt(sourceOffset),
                destination.ptr,
                BigInt(destinationOffset),
                BigInt(size)
            );
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderCopyBufferToBuffer", e);
        }
        return undefined;
    }

    copyBufferToTexture(source: GPUTexelCopyBufferInfo, destination: GPUTexelCopyTextureInfo, copySize: GPUExtent3DStrict): undefined {
        if (this._destroyed) {
            fatalError("Cannot call copyBufferToTexture on destroyed command encoder");
        }
        const packedSourceBuffer = WGPUTexelCopyBufferInfoStruct.pack(source);
        const packedDestinationBuffer = WGPUTexelCopyTextureInfoStruct.pack(destination);
        const normalizedCopySize = normalizeGPUExtent3DStrict(copySize);
        const packedCopySizeBuffer = WGPUExtent3DStruct.pack(normalizedCopySize);

        try {
            this.lib.wgpuCommandEncoderCopyBufferToTexture(
                this.encoderPtr,
                ptr(packedSourceBuffer),
                ptr(packedDestinationBuffer),
                ptr(packedCopySizeBuffer)
            );
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderCopyBufferToTexture", e);
        }
    }

    copyTextureToBuffer(source: GPUTexelCopyTextureInfo, destination: GPUTexelCopyBufferInfo, copySize: GPUExtent3DStrict): undefined {
        if (this._destroyed) {
            fatalError("Cannot call copyTextureToBuffer on destroyed command encoder");
        }
        const packedSourceBuffer = WGPUTexelCopyTextureInfoStruct.pack(source);
        const packedDestinationBuffer = WGPUTexelCopyBufferInfoStruct.pack(destination);
        const normalizedCopySize = normalizeGPUExtent3DStrict(copySize);
        const packedCopySizeBuffer = WGPUExtent3DStruct.pack(normalizedCopySize);

        try {
            this.lib.wgpuCommandEncoderCopyTextureToBuffer(
                this.encoderPtr,
                ptr(packedSourceBuffer),
                ptr(packedDestinationBuffer),
                ptr(packedCopySizeBuffer)
            );
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderCopyTextureToBuffer", e);
        }
    }

    copyTextureToTexture(source: GPUTexelCopyTextureInfo, destination: GPUTexelCopyTextureInfo, copySize: GPUExtent3DStrict): undefined {
        if (this._destroyed) {
            fatalError("Cannot call copyTextureToTexture on destroyed command encoder");
        }
        const packedSourceBuffer = WGPUTexelCopyTextureInfoStruct.pack(source);
        const packedDestinationBuffer = WGPUTexelCopyTextureInfoStruct.pack(destination);
        const normalizedCopySize = normalizeGPUExtent3DStrict(copySize);
        const packedCopySizeBuffer = WGPUExtent3DStruct.pack(normalizedCopySize);

        try {
            this.lib.wgpuCommandEncoderCopyTextureToTexture(
                this.encoderPtr,
                ptr(packedSourceBuffer),
                ptr(packedDestinationBuffer),
                ptr(packedCopySizeBuffer)
            );
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderCopyTextureToTexture", e);
        }
    }

    clearBuffer(buffer: GPUBuffer, offset?: GPUSize64, size?: GPUSize64): undefined {
        if (this._destroyed) {
            fatalError("Cannot call clearBuffer on destroyed command encoder");
        }
        const offsetBigInt = offset !== undefined ? BigInt(offset) : 0n;
        const sizeBigInt = size !== undefined ? BigInt(size) : UINT64_MAX;
        try {
            this.lib.wgpuCommandEncoderClearBuffer(this.encoderPtr, buffer.ptr, offsetBigInt, sizeBigInt);
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderClearBuffer", e);
        }
    }

    resolveQuerySet(querySet: GPUQuerySet, firstQuery: GPUSize32, queryCount: GPUSize32, destination: GPUBuffer, destinationOffset: GPUSize64): undefined {
        if (this._destroyed) {
            fatalError("Cannot call resolveQuerySet on destroyed command encoder");
        }
        fatalError('resolveQuerySet not implemented', this.encoderPtr, querySet, firstQuery, queryCount, destination, destinationOffset);
    }

    finish(descriptor?: GPUCommandBufferDescriptor): GPUCommandBuffer {
        if (this._destroyed) {
            fatalError("Cannot call finish on destroyed command encoder");
        }
        const packedDescriptorBuffer = WGPUCommandBufferDescriptorStruct.pack(descriptor ?? {});

        const commandBufferPtr = this.lib.wgpuCommandEncoderFinish(this.encoderPtr, ptr(packedDescriptorBuffer));
        if (!commandBufferPtr) {
            fatalError("wgpuCommandEncoderFinish returned null.");
        }
        this._destroyed = true; // Mark encoder as consumed
        return new GPUCommandBufferImpl(commandBufferPtr, this.lib, descriptor?.label);
    }

    pushDebugGroup(message: string): undefined {
        if (this._destroyed) return;
        console.warn('pushDebugGroup not implemented', this.encoderPtr, message);
    }

    popDebugGroup(): undefined {
        if (this._destroyed) return;
        console.warn('popDebugGroup not implemented', this.encoderPtr);
    }

    insertDebugMarker(markerLabel: string): undefined {
        if (this._destroyed) return;
        console.warn('insertDebugMarker not implemented', this.encoderPtr, markerLabel);
    }

    destroy(): undefined {
        if (this._destroyed) return;
        this._destroyed = true;
        try {
            this.lib.wgpuCommandEncoderRelease(this.encoderPtr);
        } catch (e) {
            console.error("FFI Error: wgpuCommandEncoderRelease", e);
        }
    }
} 