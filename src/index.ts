/// <reference types="@webgpu/types" />
/// <reference types="../index.d.ts" />
import { type Pointer } from "bun:ffi"
import { loadLibrary, type FFISymbols } from "./ffi.js"
import { GPUImpl } from "./GPU.js"
import { GPUAdapterImpl, GPUUncapturedErrorEventImpl } from "./GPUAdapter.js"
import { GPUBindGroupImpl } from "./GPUBindGroup.js"
import { GPUBindGroupLayoutImpl } from "./GPUBindGroupLayout.js"
import { GPUBufferImpl } from "./GPUBuffer.js"
import { GPUCommandBufferImpl } from "./GPUCommandBuffer.js"
import { GPUCommandEncoderImpl } from "./GPUCommandEncoder.js"
import { GPUComputePassEncoderImpl } from "./GPUComputePassEncoder.js"
import { GPUComputePipelineImpl } from "./GPUComputePipeline.js"
import { GPUDeviceImpl } from "./GPUDevice.js"
import { GPUPipelineLayoutImpl } from "./GPUPipelineLayout.js"
import { GPUQuerySetImpl } from "./GPUQuerySet.js"
import { GPUQueueImpl } from "./GPUQueue.js"
import { GPURenderBundleImpl } from "./GPURenderBundle.js"
import { GPURenderBundleEncoderImpl } from "./GPURenderBundleEncoder.js"
import { GPURenderPassEncoderImpl } from "./GPURenderPassEncoder.js"
import { GPURenderPipelineImpl } from "./GPURenderPipeline.js"
import { GPUSamplerImpl } from "./GPUSampler.js"
import { GPUCompilationInfoImpl, GPUCompilationMessageImpl, GPUShaderModuleImpl } from "./GPUShaderModule.js"
import { GPUTextureImpl } from "./GPUTexture.js"
import { GPUTextureViewImpl } from "./GPUTextureView.js"
import { GPUAdapterInfoImpl, GPUSupportedLimitsImpl } from "./shared.js"
import { BufferUsageFlags, MapModeFlags, ShaderStageFlags, TextureUsageFlags } from "./common.js"
import {
  GPUOutOfMemoryError,
  GPUErrorImpl,
  GPUInternalError,
  GPUValidationError,
  AbortError,
  GPUPipelineErrorImpl,
} from "./utils/error.js"

export * from "./mocks/GPUCanvasContext.js"

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

  GPU: GPUImpl as any,
  GPUAdapter: GPUAdapterImpl as any,
  GPUAdapterInfo: GPUAdapterInfoImpl as any,
  GPUSupportedLimits: GPUSupportedLimitsImpl as any,
  GPUDevice: GPUDeviceImpl as any,
  GPUQueue: GPUQueueImpl as any,
  GPUBuffer: GPUBufferImpl as any,
  GPUTexture: GPUTextureImpl as any,
  GPUTextureView: GPUTextureViewImpl as any,
  GPUSampler: GPUSamplerImpl as any,
  GPUShaderModule: GPUShaderModuleImpl as any,
  GPUCompilationInfo: GPUCompilationInfoImpl as any,
  GPUCompilationMessage: GPUCompilationMessageImpl as any,
  GPUBindGroup: GPUBindGroupImpl as any,
  GPUBindGroupLayout: GPUBindGroupLayoutImpl as any,
  GPUPipelineLayout: GPUPipelineLayoutImpl as any,
  GPURenderPipeline: GPURenderPipelineImpl as any,
  GPUComputePipeline: GPUComputePipelineImpl as any,
  GPUCommandEncoder: GPUCommandEncoderImpl as any,
  GPUCommandBuffer: GPUCommandBufferImpl as any,
  GPURenderPassEncoder: GPURenderPassEncoderImpl as any,
  GPUComputePassEncoder: GPUComputePassEncoderImpl as any,
  GPURenderBundleEncoder: GPURenderBundleEncoderImpl as any,
  GPURenderBundle: GPURenderBundleImpl as any,
  GPUQuerySet: GPUQuerySetImpl as any,
  GPUUncapturedErrorEvent: GPUUncapturedErrorEventImpl as any,
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
