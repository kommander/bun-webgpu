import { type Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";

export class GPUTextureViewImpl implements GPUTextureView {
    __brand: "GPUTextureView" = "GPUTextureView";
    label: string = '';
    ptr: Pointer;

    constructor(
        public readonly viewPtr: Pointer, 
        private lib: typeof FFI_SYMBOLS,
        label?: string
    ) {
        this.ptr = viewPtr;
        if (label) this.label = label;
    }

    destroy(): undefined {
        try { 
            this.lib.wgpuTextureViewRelease(this.viewPtr); 
        } catch(e) { 
            console.error("FFI Error: textureViewRelease", e); 
        }
        return undefined;
    }
} 