import { type Pointer } from "bun:ffi";
import { type FFISymbols } from "./ffi";
import { fatalError } from "./utils/error";

export class GPUShaderModuleImpl implements GPUShaderModule {
    __brand: "GPUShaderModule" = "GPUShaderModule";
    
    constructor(public readonly ptr: Pointer, private lib: FFISymbols, public readonly label: string) {
        this.label = label || '';
    }

    getCompilationInfo(): Promise<GPUCompilationInfo> {
        return fatalError('getCompilationInfo not implemented');
    }
    
    destroy(): undefined {
        try {
            this.lib.wgpuShaderModuleRelease(this.ptr);
        } catch(e) {
            console.error("FFI Error: shaderModuleRelease", e);
        }
    }
}