import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPUCommandBufferImpl implements GPUCommandBuffer {
    __brand: "GPUCommandBuffer" = "GPUCommandBuffer";
    label: string = 'Unnamed Command Buffer';
    readonly ptr: Pointer;
    
    constructor(public readonly bufferPtr: Pointer, private lib: FFISymbols, label?: string) {
        this.ptr = bufferPtr;
        this.label = label || 'Unnamed Command Buffer';
    }

    /**
     * Note: Command buffers are destroyed by the queue when submitted.
     */
    _destroy(): undefined {
      try { 
        this.lib.wgpuCommandBufferRelease(this.bufferPtr); 
      } catch(e) { 
        console.error("FFI Error: commandBufferRelease", e); 
      }
    }
}