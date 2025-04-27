import { ptr, type Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";
import { GPUTextureViewImpl } from "./GPUTextureView";
import { fatalError } from "./utils/error";
import { WGPUTextureViewDescriptorStruct } from "./structs_def";

export class GPUTextureImpl implements GPUTexture {
    __brand: "GPUTexture" = "GPUTexture";
    label: string = '';
    ptr: Pointer;

    constructor(
        public readonly texturePtr: Pointer, 
        private lib: typeof FFI_SYMBOLS,
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
        const packedDescriptorBuffer = WGPUTextureViewDescriptorStruct.pack({
            ...descriptor,
            format: descriptor?.format ?? this.format,
            dimension: descriptor?.dimension || this.dimension,
            baseMipLevel: descriptor?.baseMipLevel || 0,
            mipLevelCount: descriptor?.mipLevelCount || this.mipLevelCount,
            baseArrayLayer: descriptor?.baseArrayLayer || 0,
            arrayLayerCount: descriptor?.arrayLayerCount || this.depthOrArrayLayers,
            usage: descriptor?.usage || this.usage,
            label
        });
        
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