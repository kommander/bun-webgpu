/// <reference types="@webgpu/types" />
/// <reference types="../index.d.ts" />
import { type Pointer } from "bun:ffi";
import { loadLibrary, type FFISymbols } from "./ffi";
import { GPUImpl } from "./GPU";

export * from "./mocks/GPUCanvasContext";
export * from "./common";

function createInstance(lib: FFISymbols): Pointer | null {
    try { 
      return lib.wgpuCreateInstance(null); 
    } catch(e) { 
      console.error("FFI Error: createInstance", e); return null; 
    }
}

export function createGPUInstance(libPath?: string): GPUImpl {
    const lib = loadLibrary(libPath);
    const instancePtr = createInstance(lib);
    if (!instancePtr) {
        throw new Error("Failed to create GPU instance");
    }
    return new GPUImpl(instancePtr, lib);
}

export async function globals({ libPath }: { libPath?: string } = {}) {
  if (!navigator.gpu) {
    const gpuInstance = createGPUInstance(libPath);
    global.navigator = {
      ...(global.navigator ?? {}),
      gpu: gpuInstance,
    };
  }
}

export async function createWebGPUDevice() {
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter?.requestDevice();
  if (!device) {
    throw new Error('Failed to create WebGPU device');
  }
  return device;
}
