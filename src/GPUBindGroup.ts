import { type Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";

export class GPUBindGroupImpl implements GPUBindGroup {
    __brand: "GPUBindGroup" = "GPUBindGroup";
    label: string;
    // Store the FFI library and pointer
    readonly ptr: Pointer;
    private lib: typeof FFI_SYMBOLS; // Keep if needed for future methods

    constructor(ptr: Pointer, lib: typeof FFI_SYMBOLS, label?: string) {
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