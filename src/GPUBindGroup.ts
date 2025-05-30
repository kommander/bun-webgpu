import { type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPUBindGroupImpl implements GPUBindGroup {
    __brand: "GPUBindGroup" = "GPUBindGroup";
    label: string;
    // Store the FFI library and pointer
    readonly ptr: Pointer;
    private lib: FFISymbols; // Keep if needed for future methods

    constructor(ptr: Pointer, lib: FFISymbols, label?: string) {
        this.ptr = ptr;
        this.lib = lib;
        this.label = label || '';
    }

    // Add destroy method (using bindGroupRelease from index.ts)
    destroy(): undefined {
         try {
            this.lib.wgpuBindGroupRelease(this.ptr);
            // TODO: Consider nullifying the ptr after release?
         } catch(e) {
             console.error("FFI Error: bindGroupRelease", e);
         }
    }
} 