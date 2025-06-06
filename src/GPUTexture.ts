import { ptr, type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPUTextureViewImpl } from "./GPUTextureView";
import { fatalError } from "./utils/error";
import { WGPUTextureViewDescriptorStruct } from "./structs_def";

export class GPUTextureImpl implements GPUTexture {
    __brand: "GPUTexture" = "GPUTexture";
    label: string = '';
    ptr: Pointer;

    constructor(
        public readonly texturePtr: Pointer, 
        private lib: FFISymbols,
        private _width: number,
        private _height: number,
        private _depthOrArrayLayers: number,
        private _format: GPUTextureFormat,
        private _dimension: GPUTextureDimension,
        private _mipLevelCount: number,
        private _sampleCount: number,
        private _usage: GPUTextureUsageFlags
    ) {
        this.ptr = texturePtr;
    }

    get width(): number {
        return this._width;
    }

    get height(): number {
        return this._height;
    }

    get depthOrArrayLayers(): number {
        return this._depthOrArrayLayers;
    }

    get format(): GPUTextureFormat {
        return this._format;
    }

    get dimension(): GPUTextureDimension {
        return this._dimension;
    }

    get mipLevelCount(): number {
        return this._mipLevelCount;
    }

    get sampleCount(): number {
        return this._sampleCount;
    }

    get usage(): GPUFlagsConstant {
        return this._usage;
    }
    
    createView(descriptor?: GPUTextureViewDescriptor): GPUTextureView {
        const label = descriptor?.label || `View of ${this.label || 'Texture_'+this.texturePtr}`;
        
        const mergedDescriptor = {
            ...descriptor,
            label
        };
        
        // 3D textures always have arrayLayerCount = 1 since they use depth, not array layers.
        // For 1D/2D textures, let native implementation handle defaults and validate view compatibility.
        // https://github.com/gpuweb/cts/blob/main/src/webgpu/api/validation/createBindGroup.spec.ts#L1244
        if (descriptor?.arrayLayerCount !== undefined) {
            mergedDescriptor.arrayLayerCount = descriptor.arrayLayerCount;
        } else if (this.dimension === '3d') {
            mergedDescriptor.arrayLayerCount = 1;
        }
        
        const packedDescriptorBuffer = WGPUTextureViewDescriptorStruct.pack(mergedDescriptor);
        const viewPtr = this.lib.wgpuTextureCreateView(this.texturePtr, ptr(packedDescriptorBuffer)); 
        
        if (!viewPtr) {
            fatalError("Failed to create texture view");
        }
        
        return new GPUTextureViewImpl(viewPtr, this.lib, label);
    }

    destroy(): undefined {
        try { 
            this.lib.wgpuTextureDestroy(this.texturePtr); 
        } catch(e) { 
            console.error("FFI Error: textureRelease", e); 
        }
        return undefined;
    }
} 