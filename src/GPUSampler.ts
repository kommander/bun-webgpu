import { type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPUSamplerImpl implements GPUSampler {
    __brand: "GPUSampler" = "GPUSampler";
    label: string = '';
    ptr: Pointer;

    constructor(
        public readonly samplerPtr: Pointer, 
        private lib: FFISymbols,
        label?: string
    ) {
        this.ptr = samplerPtr;
        if (label) this.label = label;
    }

    destroy(): undefined {
        try { 
            this.lib.wgpuSamplerRelease(this.samplerPtr); 
        } catch(e) { 
            console.error("FFI Error: samplerRelease", e); 
        }
        return undefined;
    }
} 