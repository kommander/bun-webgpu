import type { Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";

export class GPUCommandBufferImpl implements GPUCommandBuffer {
    __brand: "GPUCommandBuffer" = "GPUCommandBuffer";
    label: string = 'Unnamed Command Buffer';
    readonly ptr: Pointer;
    
    constructor(public readonly bufferPtr: Pointer, private lib: typeof FFI_SYMBOLS, label?: string) {
        this.ptr = bufferPtr;
        this.label = label || 'Unnamed Command Buffer';
    }

    destroy(): undefined {
      try { 
        this.lib.wgpuCommandBufferRelease(this.bufferPtr); 
      } catch(e) { 
        console.error("FFI Error: commandBufferRelease", e); 
      }
    }
}