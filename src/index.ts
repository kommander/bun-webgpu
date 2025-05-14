/// <reference types="@webgpu/types" />
/// <reference types="../index.d.ts" />
import { type Pointer } from "bun:ffi";
import { FFI_SYMBOLS } from "./ffi";
import { GPUImpl } from "./GPU";

export * from "./mocks/GPUCanvasContext";

export const CustomZigError = {
  INSTANCE_NULL: 999,
  ALLOC_FAILED: 997,
  ADAPTER_NULL: 996,
  BUFFER_NULL: 992, // Added for bufferMapAsyncFFI
  // CALLBACK_NULL_DEV: 995, // Removed as it wasn't used
} as const;

export const TextureUsageFlags = {
  COPY_SRC: 1 << 0,
  COPY_DST: 1 << 1,
  TEXTURE_BINDING: 1 << 2,
  STORAGE_BINDING: 1 << 3,
  RENDER_ATTACHMENT: 1 << 4,
  TRANSIENT_ATTACHMENT: 1 << 5, 
} as const;
global.GPUTextureUsage = TextureUsageFlags;

export const BufferUsageFlags = {
  MAP_READ: 1 << 0,
  MAP_WRITE: 1 << 1,
  COPY_SRC: 1 << 2,
  COPY_DST: 1 << 3,
  INDEX: 1 << 4,
  VERTEX: 1 << 5,
  UNIFORM: 1 << 6,
  STORAGE: 1 << 7,
  INDIRECT: 1 << 8,
  QUERY_RESOLVE: 1 << 9,
} as const;
global.GPUBufferUsage = BufferUsageFlags;

export const ShaderStage = {
  NONE: 0,
  VERTEX: 1 << 0,
  FRAGMENT: 1 << 1,
  COMPUTE: 1 << 2,
} as const;

export const MapModeFlags = {
    READ: 1 << 0,
    WRITE: 1 << 1,
} as const;

function createInstance(): Pointer | null {
    try { 
      return FFI_SYMBOLS.wgpuCreateInstance(null); 
    } catch(e) { 
      console.error("FFI Error: createInstance", e); return null; 
    }
}

export function createGPUInstance(): GPUImpl {
    const instancePtr = createInstance();
    if (!instancePtr) {
        throw new Error("Failed to create GPU instance");
    }
    return new GPUImpl(instancePtr, FFI_SYMBOLS);
}