import type { Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";

export class GPUPipelineLayoutImpl implements GPUPipelineLayout {
    __brand: "GPUPipelineLayout" = "GPUPipelineLayout";
    label: string;
    readonly ptr: Pointer;

    constructor(ptr: Pointer, private lib: typeof FFI_SYMBOLS, label?: string) {
        this.ptr = ptr;
        this.label = label || '';
    }

    destroy(): undefined {
        try {
            this.lib.wgpuPipelineLayoutRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: pipelineLayoutRelease", e);
        }
        return undefined;
    }
}