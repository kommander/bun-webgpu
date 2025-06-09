import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPUBindGroupLayoutImpl } from "./GPUBindGroupLayout";
import { fatalError } from "./utils/error";

export class GPURenderPipelineImpl implements GPURenderPipeline {
    __brand: "GPURenderPipeline" = "GPURenderPipeline";
    label: string;
    readonly ptr: Pointer;

    constructor(ptr: Pointer, private lib: FFISymbols, label?: string) {
        this.ptr = ptr;
        this.label = label || '';
    }

    getBindGroupLayout(index: number): GPUBindGroupLayout {
        const layoutPtr = this.lib.wgpuRenderPipelineGetBindGroupLayout(this.ptr, index);
        if (!layoutPtr) {
            fatalError('wgpuRenderPipelineGetBindGroupLayout returned null');
        }
        // The returned layout is owned by the pipeline and is valid as long as the pipeline is.
        return new GPUBindGroupLayoutImpl(layoutPtr, this.lib);
    }

    destroy(): undefined {
        try {
            this.lib.wgpuRenderPipelineRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: renderPipelineRelease", e);
        }
    }
}