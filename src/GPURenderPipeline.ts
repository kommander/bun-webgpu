import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
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
        fatalError('getBindGroupLayout not implemented');
    }

    destroy(): undefined {
        try {
            this.lib.wgpuRenderPipelineRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: renderPipelineRelease", e);
        }
    }
}