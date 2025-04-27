import { type Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";

export class GPUBindGroupLayoutImpl implements GPUBindGroupLayout {
    __brand: "GPUBindGroupLayout" = "GPUBindGroupLayout";
    label: string;
    readonly ptr: Pointer;
    private lib: typeof FFI_SYMBOLS;

    constructor(ptr: Pointer, lib: typeof FFI_SYMBOLS, label?: string) {
        this.ptr = ptr;
        this.lib = lib;
        this.label = label || '';
    }

    // Add destroy method if needed (using bindGroupLayoutRelease from index.ts)
    destroy(): undefined {
         try {
            this.lib.wgpuBindGroupLayoutRelease(this.ptr);
            // TODO: Consider nullifying the ptr after release?
         } catch(e) {
             console.error("FFI Error: bindGroupLayoutRelease", e);
         }
    }
} 