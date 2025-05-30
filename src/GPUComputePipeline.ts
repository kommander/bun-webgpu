import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPUComputePipelineImpl implements GPUComputePipeline {
    __brand: "GPUComputePipeline" = "GPUComputePipeline";
    label: string;
    readonly ptr: Pointer;

    constructor(ptr: Pointer, private lib: FFISymbols, label?: string) {
        this.ptr = ptr;
        this.label = label || '';
    }

    getBindGroupLayout(index: number): GPUBindGroupLayout {
        console.error('getBindGroupLayout', this.ptr, index);
        throw new Error("Not implemented");
    }

    destroy(): undefined {
        try {
            this.lib.wgpuComputePipelineRelease(this.ptr);
        } catch (e) {
            console.error("FFI Error: computePipelineRelease", e);
        }
    }
}