import { type Pointer, ptr } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPURenderBundleImpl } from "./GPURenderBundle";
import { WGPURenderBundleDescriptorStruct, WGPUIndexFormat } from "./structs_def";
import { fatalError } from "./utils/error";
import { GPUBufferImpl } from "./GPUBuffer";
import { GPURenderPipelineImpl } from "./GPURenderPipeline";
import { GPUBindGroupImpl } from "./GPUBindGroup";

export class GPURenderBundleEncoderImpl implements GPURenderBundleEncoder {
    __brand: "GPURenderBundleEncoder" = "GPURenderBundleEncoder";
    private _lib: FFISymbols;
    private _destroyed: boolean = false;
    label: string;
    public ptr: Pointer;

    constructor(ptr: Pointer, lib: FFISymbols, descriptor: GPURenderBundleEncoderDescriptor) {
        this.ptr = ptr;
        this._lib = lib;
        this.label = descriptor.label ?? '';
    }

    setBindGroup(groupIndex: number, bindGroup: GPUBindGroup | null, dynamicOffsets?: Uint32Array | number[]): undefined {
        if (!bindGroup) return;
        
        let offsetsBuffer: Uint32Array | undefined;
        let offsetCount = 0;
        let offsetPtr: Pointer | null = null;
        
        if (dynamicOffsets) {
            if (dynamicOffsets instanceof Uint32Array) {
                offsetsBuffer = dynamicOffsets;
            } else {
                offsetsBuffer = new Uint32Array(dynamicOffsets);
            }
            offsetCount = offsetsBuffer.length;
            if (offsetCount > 0) {
                offsetPtr = ptr(offsetsBuffer);
            }
        }
        
        this._lib.wgpuRenderBundleEncoderSetBindGroup(this.ptr, groupIndex, (bindGroup as GPUBindGroupImpl).ptr, BigInt(offsetCount), offsetPtr);
        return undefined;
    }

    setPipeline(pipeline: GPURenderPipeline): undefined {
        this._lib.wgpuRenderBundleEncoderSetPipeline(this.ptr, (pipeline as GPURenderPipelineImpl).ptr);
        return undefined;
    }

    setIndexBuffer(buffer: GPUBuffer, indexFormat: GPUIndexFormat, offset?: number, size?: number): undefined {
        this._lib.wgpuRenderBundleEncoderSetIndexBuffer(this.ptr, (buffer as GPUBufferImpl).ptr, WGPUIndexFormat.to(indexFormat), BigInt(offset ?? 0), BigInt(size ?? buffer.size));
        return undefined;
    }

    setVertexBuffer(slot: number, buffer: GPUBuffer | null, offset?: number, size?: number): undefined {
        if (!buffer) return;
        this._lib.wgpuRenderBundleEncoderSetVertexBuffer(this.ptr, slot, (buffer as GPUBufferImpl).ptr, BigInt(offset ?? 0), BigInt(size ?? buffer.size));
        return undefined;
    }

    draw(vertexCount: number, instanceCount?: number, firstVertex?: number, firstInstance?: number): undefined {
        if (this._destroyed) {
            fatalError("Cannot call draw on a destroyed GPURenderBundleEncoder");
        }
        this._lib.wgpuRenderBundleEncoderDraw(this.ptr, vertexCount, instanceCount ?? 1, firstVertex ?? 0, firstInstance ?? 0);
        return undefined;
    }

    drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number, baseVertex?: number, firstInstance?: number): undefined {
        if (this._destroyed) {
            fatalError("Cannot call drawIndexed on a destroyed GPURenderBundleEncoder");
        }
        this._lib.wgpuRenderBundleEncoderDrawIndexed(this.ptr, indexCount, instanceCount ?? 1, firstIndex ?? 0, baseVertex ?? 0, firstInstance ?? 0);
        return undefined;
    }

    drawIndirect(indirectBuffer: GPUBuffer, indirectOffset: number): undefined {
        if (this._destroyed) {
            fatalError("Cannot call drawIndirect on a destroyed GPURenderBundleEncoder");
        }
        this._lib.wgpuRenderBundleEncoderDrawIndirect(this.ptr, (indirectBuffer as GPUBufferImpl).ptr, BigInt(indirectOffset));
        return undefined;
    }

    drawIndexedIndirect(indirectBuffer: GPUBuffer, indirectOffset: number): undefined {
        if (this._destroyed) {
            fatalError("Cannot call drawIndexedIndirect on a destroyed GPURenderBundleEncoder");
        }
        this._lib.wgpuRenderBundleEncoderDrawIndexedIndirect(this.ptr, (indirectBuffer as GPUBufferImpl).ptr, BigInt(indirectOffset));
        return undefined;
    }
    
    finish(descriptor?: GPURenderBundleDescriptor): GPURenderBundle {
        if (this._destroyed) {
            fatalError("Cannot call finish on a destroyed GPURenderBundleEncoder");
        }
        const packedDescriptor = WGPURenderBundleDescriptorStruct.pack(descriptor ?? {});
        const bundlePtr = this._lib.wgpuRenderBundleEncoderFinish(this.ptr, ptr(packedDescriptor));
        if (!bundlePtr) {
            fatalError("wgpuRenderBundleEncoderFinish returned a null pointer");
        }
        this._destroy();
        return new GPURenderBundleImpl(bundlePtr, this._lib, descriptor?.label);
    }
    
    _destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._lib.wgpuRenderBundleEncoderRelease(this.ptr);
    }

    pushDebugGroup(groupLabel: string): undefined {
        console.warn("pushDebugGroup not implemented", groupLabel);
    }

    popDebugGroup(): undefined {
        console.warn("popDebugGroup not implemented");
    }

    insertDebugMarker(markerLabel: string): undefined {
        console.warn("insertDebugMarker not implemented", markerLabel);
    }
} 