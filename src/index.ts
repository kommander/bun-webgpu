/// <reference types="@webgpu/types" />
/// <reference types="../index.d.ts" />
import { type Pointer } from "bun:ffi"
import { loadLibrary, type FFISymbols } from "./ffi"
import { GPUImpl } from "./GPU"
import { GPUDeviceImpl } from "./GPUDevice"
import { GPUAdapterInfoImpl, GPUSupportedLimitsImpl } from "./shared"
import { BufferUsageFlags, MapModeFlags, ShaderStageFlags, TextureUsageFlags } from "./common"
import {
  GPUOutOfMemoryError,
  GPUErrorImpl,
  GPUInternalError,
  GPUValidationError,
  AbortError,
  GPUPipelineErrorImpl,
} from "./utils/error"

export * from "./mocks/GPUCanvasContext"

function createInstance(lib: FFISymbols): Pointer | null {
  try {
    return lib.wgpuCreateInstance(null)
  } catch (e) {
    console.error("FFI Error: createInstance", e)
    return null
  }
}

export function createGPUInstance(libPath?: string): GPUImpl {
  const lib = loadLibrary(libPath)
  const instancePtr = createInstance(lib)
  if (!instancePtr) {
    throw new Error("Failed to create GPU instance")
  }
  return new GPUImpl(instancePtr, lib)
}

export const globalConstructors = {
  GPUPipelineError: GPUPipelineErrorImpl as any,
  AbortError: AbortError as any,
  GPUError: GPUErrorImpl as any,
  GPUOutOfMemoryError: GPUOutOfMemoryError as any,
  GPUInternalError: GPUInternalError as any,
  GPUValidationError: GPUValidationError as any,
  GPUTextureUsage: TextureUsageFlags,
  GPUBufferUsage: BufferUsageFlags,
  GPUShaderStage: ShaderStageFlags,
  GPUMapMode: MapModeFlags,

  GPUDevice: GPUDeviceImpl as any,
  GPUAdapterInfo: GPUAdapterInfoImpl as any,
  GPUSupportedLimits: GPUSupportedLimitsImpl as any,
}

export async function setupGlobals({ libPath }: { libPath?: string } = {}) {
  if (!navigator.gpu) {
    const gpuInstance = createGPUInstance(libPath)
    global.navigator = {
      ...(global.navigator ?? {}),
      gpu: gpuInstance,
    }
  }
  Object.assign(globalThis, globalConstructors)
}

export function globals() {
  Object.assign(globalThis, globalConstructors)
}

export async function createWebGPUDevice() {
  const adapter = await navigator.gpu.requestAdapter()
  const device = await adapter?.requestDevice()
  if (!device) {
    throw new Error("Failed to create WebGPU device")
  }
  return device
}
