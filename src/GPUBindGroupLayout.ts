import { type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPUBindGroupLayoutImpl implements GPUBindGroupLayout {
    __brand: "GPUBindGroupLayout" = "GPUBindGroupLayout";
    label: string;
    readonly ptr: Pointer;
    private lib: FFISymbols;

    constructor(ptr: Pointer, lib: FFISymbols, label?: string) {
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