import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPUBindGroupLayoutImpl } from "./GPUBindGroupLayout";

export class GPUComputePipelineImpl implements GPUComputePipeline {
    __brand: "GPUComputePipeline" = "GPUComputePipeline";
    label: string;
    readonly ptr: Pointer;

    constructor(ptr: Pointer, private lib: FFISymbols, label?: string) {
        this.ptr = ptr;
        this.label = label || '';
    }

    getBindGroupLayout(index: number): GPUBindGroupLayout {
        const bindGroupLayoutPtr = this.lib.wgpuComputePipelineGetBindGroupLayout(this.ptr, index);
        if (!bindGroupLayoutPtr) {
            throw new Error(`Failed to get bind group layout for index ${index}. Pointer is null.`);
        }
        return new GPUBindGroupLayoutImpl(bindGroupLayoutPtr, this.lib);
    }

    destroy(): undefined {
        try {
            this.lib.wgpuComputePipelineRelease(this.ptr);
        } catch (e) {
            console.error("FFI Error: computePipelineRelease", e);
        }
        return undefined;
    }
}