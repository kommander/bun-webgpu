import { type Pointer } from "bun:ffi";
import { FFI_SYMBOLS } from "./ffi";

export class GPUShaderModuleImpl implements GPUShaderModule {
    __brand: "GPUShaderModule" = "GPUShaderModule";
    
    constructor(public readonly ptr: Pointer, private lib: typeof FFI_SYMBOLS, public readonly label: string) {
        this.label = label || '';
    }

    getCompilationInfo(): Promise<GPUCompilationInfo> {
        throw new Error("Not implemented");
    }
    
    destroy(): undefined {
        try {
            this.lib.wgpuShaderModuleRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: shaderModuleRelease", e);
        }
    }
}