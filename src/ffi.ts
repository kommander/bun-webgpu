import { dlopen, suffix, FFIType } from "bun:ffi"
import { existsSync } from "fs"

const module = await import(`bun-webgpu-${process.platform}-${process.arch}/index.ts`)
let targetLibPath = module.default

if (/\$bunfs/.test(targetLibPath)) {
  targetLibPath = targetLibPath.replace("../", "")
}

if (!existsSync(targetLibPath)) {
  throw new Error(`bun-webgpu is not supported on the current platform: ${process.platform}-${process.arch}`)
}

function findLibrary(): string {
  return targetLibPath
}

function _loadLibrary(libPath?: string) {
  const resolvedPath = libPath || findLibrary()

  // Define the FFI interface based on webgpu.h functions
  const { symbols } = dlopen(resolvedPath, {
    // --- Core API Functions ---
    zwgpuCreateInstance: {
      args: [FFIType.pointer], // descriptor: *const WGPUInstanceDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUInstance
    },

    // --- Instance Functions ---
    zwgpuInstanceCreateSurface: {
      args: [FFIType.pointer, FFIType.pointer], // instance: WGPUInstance, descriptor: *const WGPUSurfaceDescriptor
      returns: FFIType.pointer, // -> WGPUSurface
    },
    zwgpuInstanceProcessEvents: {
      args: [FFIType.pointer], // instance: WGPUInstance
      returns: FFIType.void,
    },
    zwgpuInstanceRequestAdapter: {
      args: [
        FFIType.pointer, // instance: WGPUInstance
        FFIType.pointer, // options: *const WGPURequestAdapterOptions (nullable)
        FFIType.pointer, // callbackInfo: WGPURequestAdapterCallbackInfo
      ],
      returns: FFIType.u64, // -> WGPUFuture (id)
    },
    zwgpuInstanceWaitAny: {
      args: [
        FFIType.pointer, // instance: WGPUInstance
        FFIType.u64, // futureCount: size_t (using u64)
        FFIType.pointer, // futures: *WGPUFutureWaitInfo
        FFIType.u64, // timeoutNS: uint64_t
      ],
      returns: FFIType.u32, // -> WGPUWaitStatus (enum)
    },
    zwgpuInstanceGetWGSLLanguageFeatures: {
      args: [FFIType.pointer, FFIType.pointer], // instance: WGPUInstance, features: *mut WGPUSupportedWGSLLanguageFeatures
      returns: FFIType.u32, // -> WGPUStatus
    },
    zwgpuInstanceRelease: {
      args: [FFIType.pointer], // instance: WGPUInstance
      returns: FFIType.void,
    },
    zwgpuInstanceAddRef: {
      // Typically not needed from JS due to GC, but included for completeness
      args: [FFIType.pointer], // instance: WGPUInstance
      returns: FFIType.void,
    },

    // --- Adapter Functions ---
    zwgpuAdapterCreateDevice: {
      args: [
        FFIType.pointer, // adapter: WGPUAdapter
        FFIType.pointer, // descriptor: *const WGPUDeviceDescriptor (nullable)
      ],
      returns: FFIType.pointer, // -> WGPUDevice
    },
    zwgpuAdapterGetInfo: {
      args: [FFIType.pointer, FFIType.pointer], // adapter: WGPUAdapter, info: *mut WGPUAdapterInfo
      returns: FFIType.u32, // WGPUStatus
    },
    zwgpuAdapterRequestDevice: {
      args: [
        FFIType.pointer, // adapter: WGPUAdapter
        FFIType.pointer, // options: *const WGPUDeviceDescriptor (nullable)
        FFIType.pointer, // callbackInfo: WGPURequestDeviceCallbackInfo
      ],
      returns: FFIType.u64, // -> WGPUFuture (id)
    },
    zwgpuAdapterRelease: {
      args: [FFIType.pointer], // adapter: WGPUAdapter
      returns: FFIType.void,
    },
    zwgpuAdapterGetFeatures: {
      // Added for getting adapter features
      args: [FFIType.pointer, FFIType.pointer], // adapter: WGPUAdapter, features: *WGPUSupportedFeatures
      returns: FFIType.void,
    },
    zwgpuAdapterGetLimits: {
      args: [FFIType.pointer, FFIType.pointer], // adapter: WGPUAdapter, limits: *mut WGPULimits
      returns: FFIType.u32, // WGPUStatus
    },
    // Add other adapter functions like GetFeatures, GetLimits, HasFeature etc.

    // --- Device Functions ---
    zwgpuDeviceGetAdapterInfo: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, info: *mut WGPUAdapterInfo
      returns: FFIType.u32, // WGPUStatus
    },
    zwgpuDeviceCreateBuffer: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBufferDescriptor
      returns: FFIType.pointer, // -> WGPUBuffer
    },
    zwgpuDeviceCreateTexture: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUTextureDescriptor
      returns: FFIType.pointer, // -> WGPUTexture
    },
    zwgpuDeviceCreateSampler: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUSamplerDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUSampler
    },
    zwgpuDeviceCreateShaderModule: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUShaderModuleDescriptor
      returns: FFIType.pointer, // -> WGPUShaderModule
    },
    zwgpuDeviceCreateBindGroupLayout: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBindGroupLayoutDescriptor
      returns: FFIType.pointer, // -> WGPUBindGroupLayout
    },
    zwgpuDeviceCreateBindGroup: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBindGroupDescriptor
      returns: FFIType.pointer, // -> WGPUBindGroup
    },
    zwgpuDeviceCreatePipelineLayout: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUPipelineLayoutDescriptor
      returns: FFIType.pointer, // -> WGPUPipelineLayout
    },
    zwgpuDeviceCreateRenderPipeline: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPURenderPipelineDescriptor
      returns: FFIType.pointer, // -> WGPURenderPipeline
    },
    zwgpuDeviceCreateComputePipeline: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUComputePipelineDescriptor
      returns: FFIType.pointer, // -> WGPUComputePipeline
    },
    zwgpuDeviceCreateRenderBundleEncoder: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPURenderBundleEncoderDescriptor
      returns: FFIType.pointer, // -> WGPURenderBundleEncoder
    },
    zwgpuDeviceCreateCommandEncoder: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUCommandEncoderDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUCommandEncoder
    },
    zwgpuDeviceCreateQuerySet: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUQuerySetDescriptor
      returns: FFIType.pointer, // -> WGPUQuerySet
    },
    zwgpuDeviceGetQueue: {
      args: [FFIType.pointer], // device: WGPUDevice
      returns: FFIType.pointer, // -> WGPUQueue
    },
    zwgpuDeviceGetLimits: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, limits: *mut WGPULimits
      returns: FFIType.u32, // WGPUStatus
    },
    zwgpuDeviceHasFeature: {
      args: [FFIType.pointer, FFIType.u32], // device: WGPUDevice, feature: WGPUFeatureName (enum)
      returns: FFIType.bool, // WGPUBool (use bool for direct mapping)
    },
    zwgpuDeviceGetFeatures: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, features: *mut WGPUSupportedFeatures
      returns: FFIType.void,
    },
    zwgpuDevicePushErrorScope: {
      args: [FFIType.pointer, FFIType.u32], // device: WGPUDevice, filter: WGPUErrorFilter (enum)
      returns: FFIType.void,
    },
    zwgpuDevicePopErrorScope: {
      args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, callbackInfo: WGPUPopErrorScopeCallbackInfo
      returns: FFIType.u64, // WGPUFuture (id)
    },
    zwgpuDeviceTick: {
      args: [FFIType.pointer], // device: WGPUDevice
      returns: FFIType.void,
    },
    zwgpuDeviceInjectError: {
      args: [FFIType.pointer, FFIType.u32, FFIType.pointer], // device: WGPUDevice, type: WGPUErrorType, message: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuDeviceCreateComputePipelineAsync: {
      args: [
        FFIType.pointer, // device: WGPUDevice
        FFIType.pointer, // descriptor: *const WGPUComputePipelineDescriptor
        FFIType.pointer, // callbackInfo: *const WGPUCreateComputePipelineAsyncCallbackInfo
      ],
      returns: FFIType.u64, // -> WGPUFuture (id)
    },
    zwgpuDeviceCreateRenderPipelineAsync: {
      args: [
        FFIType.pointer, // device: WGPUDevice
        FFIType.pointer, // descriptor: *const WGPURenderPipelineDescriptor
        FFIType.pointer, // callbackInfo: *const WGPUCreateRenderPipelineAsyncCallbackInfo
      ],
      returns: FFIType.u64, // -> WGPUFuture (id)
    },
    zwgpuDeviceDestroy: {
      args: [FFIType.pointer], // device: WGPUDevice
      returns: FFIType.void,
    },
    zwgpuDeviceRelease: {
      args: [FFIType.pointer], // device: WGPUDevice
      returns: FFIType.void,
    },
    // Add other device functions...

    // --- Buffer Functions ---
    zwgpuBufferGetMappedRange: {
      args: [FFIType.pointer, FFIType.u64, FFIType.u64], // buffer: WGPUBuffer, offset: size_t, size: size_t
      returns: FFIType.ptr, // void*
    },
    zwgpuBufferGetConstMappedRange: {
      args: [FFIType.pointer, FFIType.u64, FFIType.u64], // buffer: WGPUBuffer, offset: size_t, size: size_t
      returns: FFIType.ptr, // const void*
    },
    zwgpuBufferUnmap: {
      args: [FFIType.pointer], // buffer: WGPUBuffer
      returns: FFIType.void,
    },
    zwgpuBufferMapAsync: {
      args: [
        FFIType.pointer, // buffer: WGPUBuffer
        FFIType.u64, // mode: WGPUMapMode (flags)
        FFIType.u64, // offset: size_t
        FFIType.u64, // size: size_t
        FFIType.pointer, // callbackInfo: WGPUBufferMapCallbackInfo
      ],
      returns: FFIType.u64, // WGPUFuture (id)
    },
    zwgpuBufferDestroy: {
      args: [FFIType.pointer], // buffer: WGPUBuffer
      returns: FFIType.void,
    },
    zwgpuBufferRelease: {
      args: [FFIType.pointer], // buffer: WGPUBuffer
      returns: FFIType.void,
    },
    // Add other buffer functions...

    // --- Texture Functions ---
    zwgpuTextureCreateView: {
      args: [FFIType.pointer, FFIType.pointer], // texture: WGPUTexture, descriptor: *const WGPUTextureViewDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUTextureView
    },
    zwgpuTextureDestroy: {
      args: [FFIType.pointer], // texture: WGPUTexture
      returns: FFIType.void,
    },
    zwgpuTextureRelease: {
      args: [FFIType.pointer], // texture: WGPUTexture
      returns: FFIType.void,
    },
    // Add other texture functions...

    // --- TextureView Functions ---
    zwgpuTextureViewRelease: {
      args: [FFIType.pointer], // textureView: WGPUTextureView
      returns: FFIType.void,
    },
    // Add other texture view functions...

    // --- Sampler Functions ---
    zwgpuSamplerRelease: {
      args: [FFIType.pointer], // sampler: WGPUSampler
      returns: FFIType.void,
    },
    // Add other sampler functions...

    // --- ShaderModule Functions ---
    zwgpuShaderModuleGetCompilationInfo: {
      args: [FFIType.pointer, FFIType.pointer], // shaderModule: WGPUShaderModule, callbackInfo: WGPUCompilationInfoCallbackInfo
      returns: FFIType.u64, // WGPUFuture (id)
    },
    zwgpuShaderModuleRelease: {
      args: [FFIType.pointer], // shaderModule: WGPUShaderModule
      returns: FFIType.void,
    },
    // Add other shader module functions...

    // --- BindGroupLayout Functions ---
    zwgpuBindGroupLayoutRelease: {
      args: [FFIType.pointer], // bindGroupLayout: WGPUBindGroupLayout
      returns: FFIType.void,
    },

    // --- BindGroup Functions ---
    zwgpuBindGroupRelease: {
      args: [FFIType.pointer], // bindGroup: WGPUBindGroup
      returns: FFIType.void,
    },

    // --- PipelineLayout Functions ---
    zwgpuPipelineLayoutRelease: {
      args: [FFIType.pointer], // pipelineLayout: WGPUPipelineLayout
      returns: FFIType.void,
    },

    // --- QuerySet Functions ---
    zwgpuQuerySetDestroy: {
      args: [FFIType.pointer], // querySet: WGPUQuerySet
      returns: FFIType.void,
    },
    zwgpuQuerySetRelease: {
      args: [FFIType.pointer], // querySet: WGPUQuerySet
      returns: FFIType.void,
    },

    // --- RenderPipeline Functions ---
    zwgpuRenderPipelineRelease: {
      args: [FFIType.pointer], // renderPipeline: WGPURenderPipeline
      returns: FFIType.void,
    },
    zwgpuRenderPipelineGetBindGroupLayout: {
      args: [FFIType.pointer, FFIType.u32], // renderPipeline: WGPURenderPipeline, groupIndex: uint32_t
      returns: FFIType.pointer, // -> WGPUBindGroupLayout
    },

    // --- ComputePipeline Functions ---
    zwgpuComputePipelineRelease: {
      args: [FFIType.pointer], // computePipeline: WGPUComputePipeline
      returns: FFIType.void,
    },
    zwgpuComputePipelineGetBindGroupLayout: {
      args: [FFIType.pointer, FFIType.u32], // computePipeline: WGPUComputePipeline, groupIndex: uint32_t
      returns: FFIType.pointer, // -> WGPUBindGroupLayout
    },

    // --- CommandEncoder Functions ---
    zwgpuCommandEncoderBeginRenderPass: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPURenderPassDescriptor
      returns: FFIType.pointer, // -> WGPURenderPassEncoder
    },
    zwgpuCommandEncoderBeginComputePass: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPUComputePassDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUComputePassEncoder
    },
    zwgpuCommandEncoderClearBuffer: {
      args: [
        FFIType.pointer, // commandEncoder: WGPUCommandEncoder
        FFIType.pointer, // buffer: WGPUBuffer
        FFIType.u64, // offset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderCopyBufferToBuffer: {
      args: [
        FFIType.pointer, // commandEncoder: WGPUCommandEncoder
        FFIType.pointer, // source: WGPUBuffer
        FFIType.u64, // sourceOffset: uint64_t
        FFIType.pointer, // destination: WGPUBuffer
        FFIType.u64, // destinationOffset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderCopyBufferToTexture: {
      args: [
        FFIType.pointer, // commandEncoder
        FFIType.pointer, // source: *const WGPUTexelCopyBufferInfo
        FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
        FFIType.pointer, // copySize: *const WGPUExtent3D
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderCopyTextureToBuffer: {
      args: [
        FFIType.pointer, // commandEncoder
        FFIType.pointer, // source: *const WGPUTexelCopyTextureInfo
        FFIType.pointer, // destination: *const WGPUTexelCopyBufferInfo
        FFIType.pointer, // copySize: *const WGPUExtent3D
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderCopyTextureToTexture: {
      args: [
        FFIType.pointer, // commandEncoder
        FFIType.pointer, // source: *const WGPUTexelCopyTextureInfo
        FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
        FFIType.pointer, // copySize: *const WGPUExtent3D
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderResolveQuerySet: {
      args: [
        FFIType.pointer, // commandEncoder
        FFIType.pointer, // querySet
        FFIType.u32, // firstQuery
        FFIType.u32, // queryCount
        FFIType.pointer, // destination
        FFIType.u64, // destinationOffset
      ],
      returns: FFIType.void,
    },
    zwgpuCommandEncoderFinish: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPUCommandBufferDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPUCommandBuffer
    },
    zwgpuCommandEncoderRelease: {
      args: [FFIType.pointer], // commandEncoder: WGPUCommandEncoder
      returns: FFIType.void,
    },
    zwgpuCommandEncoderPushDebugGroup: {
      args: [FFIType.pointer, FFIType.pointer], // commandEncoder: WGPUCommandEncoder, groupLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuCommandEncoderPopDebugGroup: {
      args: [FFIType.pointer], // commandEncoder: WGPUCommandEncoder
      returns: FFIType.void,
    },
    zwgpuCommandEncoderInsertDebugMarker: {
      args: [FFIType.pointer, FFIType.pointer], // commandEncoder: WGPUCommandEncoder, markerLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetScissorRect: {
      args: [
        FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
        FFIType.u32, // x: uint32_t
        FFIType.u32, // y: uint32_t
        FFIType.u32, // width: uint32_t
        FFIType.u32, // height: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetViewport: {
      args: [
        FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
        FFIType.f32, // x: float
        FFIType.f32, // y: float
        FFIType.f32, // width: float
        FFIType.f32, // height: float
        FFIType.f32, // minDepth: float
        FFIType.f32, // maxDepth: float
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetBlendConstant: {
      args: [
        FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
        FFIType.pointer, // color: *const WGPUColor
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetStencilReference: {
      args: [
        FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
        FFIType.u32, // reference: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetPipeline: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderPassEncoder, pipeline: WGPURenderPipeline
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetBindGroup: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.u32, // groupIndex: uint32_t
        FFIType.pointer, // group: WGPUBindGroup (nullable)
        FFIType.u64, // dynamicOffsetCount: size_t
        FFIType.pointer, // dynamicOffsets: *const uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetVertexBuffer: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.u32, // slot: uint32_t
        FFIType.pointer, // buffer: WGPUBuffer (nullable)
        FFIType.u64, // offset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderSetIndexBuffer: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.pointer, // buffer: WGPUBuffer
        FFIType.u32, // format: WGPUIndexFormat (enum)
        FFIType.u64, // offset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderDraw: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.u32, // vertexCount: uint32_t
        FFIType.u32, // instanceCount: uint32_t
        FFIType.u32, // firstVertex: uint32_t
        FFIType.u32, // firstInstance: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderDrawIndexed: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.u32, // indexCount: uint32_t
        FFIType.u32, // instanceCount: uint32_t
        FFIType.u32, // firstIndex: uint32_t
        FFIType.i32, // baseVertex: int32_t
        FFIType.u32, // firstInstance: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderDrawIndirect: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.pointer, // indirectBuffer: WGPUBuffer
        FFIType.u64, // indirectOffset: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderDrawIndexedIndirect: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.pointer, // indirectBuffer: WGPUBuffer
        FFIType.u64, // indirectOffset: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderExecuteBundles: {
      args: [
        FFIType.pointer, // encoder: WGPURenderPassEncoder
        FFIType.u64, // bundleCount: size_t
        FFIType.pointer, // bundles: *const WGPURenderBundle
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderEnd: {
      args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderRelease: {
      args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderPushDebugGroup: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderPassEncoder, groupLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderPopDebugGroup: {
      args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderInsertDebugMarker: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderPassEncoder, markerLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderBeginOcclusionQuery: {
      args: [
        FFIType.pointer, // renderPassEncoder
        FFIType.u32, // queryIndex
      ],
      returns: FFIType.void,
    },
    zwgpuRenderPassEncoderEndOcclusionQuery: {
      args: [
        FFIType.pointer, // renderPassEncoder
      ],
      returns: FFIType.void,
    },

    // --- ComputePassEncoder Functions ---
    zwgpuComputePassEncoderSetPipeline: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUComputePassEncoder, pipeline: WGPUComputePipeline
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderSetBindGroup: {
      args: [
        FFIType.pointer, // encoder: WGPUComputePassEncoder
        FFIType.u32, // groupIndex: uint32_t
        FFIType.pointer, // group: WGPUBindGroup (nullable)
        FFIType.u64, // dynamicOffsetCount: size_t
        FFIType.pointer, // dynamicOffsets: *const uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderDispatchWorkgroups: {
      args: [
        FFIType.pointer, // encoder: WGPUComputePassEncoder
        FFIType.u32, // workgroupCountX: uint32_t
        FFIType.u32, // workgroupCountY: uint32_t
        FFIType.u32, // workgroupCountZ: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderDispatchWorkgroupsIndirect: {
      args: [
        FFIType.pointer, // encoder: WGPUComputePassEncoder
        FFIType.pointer, // indirectBuffer: WGPUBuffer
        FFIType.u64, // indirectOffset: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderEnd: {
      args: [FFIType.pointer], // encoder: WGPUComputePassEncoder
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderRelease: {
      args: [FFIType.pointer], // encoder: WGPUComputePassEncoder
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderPushDebugGroup: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUComputePassEncoder, groupLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderPopDebugGroup: {
      args: [FFIType.pointer], // encoder: WGPUComputePassEncoder
      returns: FFIType.void,
    },
    zwgpuComputePassEncoderInsertDebugMarker: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUComputePassEncoder, markerLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    // Add other compute pass functions...

    // --- CommandBuffer Functions ---
    zwgpuCommandBufferRelease: {
      args: [FFIType.pointer], // commandBuffer: WGPUCommandBuffer
      returns: FFIType.void,
    },

    // --- Queue Functions ---
    zwgpuQueueSubmit: {
      args: [
        FFIType.pointer, // queue: WGPUQueue
        FFIType.u64, // commandCount: size_t
        FFIType.pointer, // commands: *const WGPUCommandBuffer
      ],
      returns: FFIType.void,
    },
    zwgpuQueueWriteBuffer: {
      args: [
        FFIType.pointer, // queue: WGPUQueue
        FFIType.pointer, // buffer: WGPUBuffer
        FFIType.u64, // bufferOffset: uint64_t
        FFIType.ptr, // data: *const void
        FFIType.u64, // size: size_t
      ],
      returns: FFIType.void,
    },
    zwgpuQueueWriteTexture: {
      args: [
        FFIType.pointer, // queue: WGPUQueue
        FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
        FFIType.ptr, // data: *const void
        FFIType.u64, // dataSize: size_t
        FFIType.pointer, // dataLayout: *const WGPUTexelCopyBufferLayout
        FFIType.pointer, // writeSize: *const WGPUExtent3D
      ],
      returns: FFIType.void,
    },
    zwgpuQueueOnSubmittedWorkDone: {
      args: [
        FFIType.pointer, // queue: WGPUQueue
        FFIType.pointer, // callbackInfo: WGPUQueueWorkDoneCallbackInfo
      ],
      returns: FFIType.u64, // WGPUFuture (id)
    },
    zwgpuQueueRelease: {
      args: [FFIType.pointer], // queue: WGPUQueue
      returns: FFIType.void,
    },
    // Add other queue functions...

    // --- Surface Functions ---
    zwgpuSurfaceConfigure: {
      args: [FFIType.pointer, FFIType.pointer], // surface: WGPUSurface, config: *const WGPUSurfaceConfiguration
      returns: FFIType.void,
    },
    zwgpuSurfaceUnconfigure: {
      args: [FFIType.pointer], // surface: WGPUSurface
      returns: FFIType.void,
    },
    zwgpuSurfaceGetCurrentTexture: {
      args: [FFIType.pointer, FFIType.pointer], // surface: WGPUSurface, surfaceTexture: *mut WGPUSurfaceTexture
      returns: FFIType.void,
    },
    zwgpuSurfacePresent: {
      args: [FFIType.pointer], // surface: WGPUSurface
      returns: FFIType.void,
    },
    zwgpuSurfaceRelease: {
      args: [FFIType.pointer], // surface: WGPUSurface
      returns: FFIType.void,
    },
    // Add other surface functions...

    // --- Freeing Functions (Important for structs returned by pointer) ---
    zwgpuAdapterInfoFreeMembers: {
      args: [FFIType.pointer], // value: WGPUAdapterInfo (passed by pointer but represents struct value)
      returns: FFIType.void,
    },
    zwgpuSurfaceCapabilitiesFreeMembers: {
      args: [FFIType.pointer], // value: WGPUSurfaceCapabilities (passed by pointer)
      returns: FFIType.void,
    },
    zwgpuSupportedFeaturesFreeMembers: {
      // Added for freeing features array
      args: [FFIType.pointer], // value: WGPUSupportedFeatures (passed by pointer)
      returns: FFIType.void,
    },
    zwgpuSharedBufferMemoryEndAccessStateFreeMembers: {
      args: [FFIType.pointer], // value: WGPUSharedBufferMemoryEndAccessState
      returns: FFIType.void,
    },
    zwgpuSharedTextureMemoryEndAccessStateFreeMembers: {
      args: [FFIType.pointer], // value: WGPUSharedTextureMemoryEndAccessState
      returns: FFIType.void,
    },
    zwgpuSupportedWGSLLanguageFeaturesFreeMembers: {
      args: [FFIType.pointer], // value: WGPUSupportedWGSLLanguageFeatures (passed by pointer)
      returns: FFIType.void,
    },
    // Add other FreeMembers functions as needed...

    // NOTE: This is not exhaustive. Many more functions exist in webgpu.h
    // Add more bindings here as needed, following the patterns above.

    // --- RenderBundle Functions ---
    zwgpuRenderBundleRelease: {
      args: [FFIType.pointer], // bundle: WGPURenderBundle
      returns: FFIType.void,
    },

    // --- RenderBundleEncoder Functions ---
    zwgpuRenderBundleEncoderDraw: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.u32, // vertexCount: uint32_t
        FFIType.u32, // instanceCount: uint32_t
        FFIType.u32, // firstVertex: uint32_t
        FFIType.u32, // firstInstance: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderDrawIndexed: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.u32, // indexCount: uint32_t
        FFIType.u32, // instanceCount: uint32_t
        FFIType.u32, // firstIndex: uint32_t
        FFIType.i32, // baseVertex: int32_t
        FFIType.u32, // firstInstance: uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderDrawIndirect: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.pointer, // indirectBuffer: WGPUBuffer
        FFIType.u64, // indirectOffset: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderDrawIndexedIndirect: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.pointer, // indirectBuffer: WGPUBuffer
        FFIType.u64, // indirectOffset: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderFinish: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderBundleEncoder, descriptor: *const WGPURenderBundleDescriptor (nullable)
      returns: FFIType.pointer, // -> WGPURenderBundle
    },
    zwgpuRenderBundleEncoderSetBindGroup: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.u32, // groupIndex: uint32_t
        FFIType.pointer, // group: WGPUBindGroup (nullable)
        FFIType.u64, // dynamicOffsetCount: size_t
        FFIType.pointer, // dynamicOffsets: *const uint32_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderSetIndexBuffer: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.pointer, // buffer: WGPUBuffer
        FFIType.u32, // format: WGPUIndexFormat (enum)
        FFIType.u64, // offset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderSetPipeline: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderBundleEncoder, pipeline: WGPURenderPipeline
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderSetVertexBuffer: {
      args: [
        FFIType.pointer, // encoder: WGPURenderBundleEncoder
        FFIType.u32, // slot: uint32_t
        FFIType.pointer, // buffer: WGPUBuffer (nullable)
        FFIType.u64, // offset: uint64_t
        FFIType.u64, // size: uint64_t
      ],
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderRelease: {
      args: [FFIType.pointer], // encoder: WGPURenderBundleEncoder
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderPushDebugGroup: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderBundleEncoder, groupLabel: *const WGPUStringView
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderPopDebugGroup: {
      args: [FFIType.pointer], // encoder: WGPURenderBundleEncoder
      returns: FFIType.void,
    },
    zwgpuRenderBundleEncoderInsertDebugMarker: {
      args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderBundleEncoder, markerLabel: *const WGPUStringView
      returns: FFIType.void,
    },
  })
  return symbols
}

type StripZWPrefix<KeyType extends string> = KeyType extends `zw${infer Rest}` ? `w${Rest}` : KeyType

type TransformedSymbolKeys<T extends object> = {
  [K in keyof T as StripZWPrefix<K & string>]: T[K]
}

// The type of the final normalizedSymbols object
type NormalizedSymbolsType = TransformedSymbolKeys<ReturnType<typeof _loadLibrary>>

export function loadLibrary(libPath?: string) {
  const rawSymbols = _loadLibrary(libPath)
  const normalizedSymbols = Object.keys(rawSymbols).reduce(
    (acc, key) => {
      const newKey = key.replace(/^zw/, "w") as keyof NormalizedSymbolsType // Assert the new key type
      ;(acc as any)[newKey] = (rawSymbols as Record<string, any>)[key]
      return acc
    },
    {} as NormalizedSymbolsType, // Crucially, type the initial accumulator
  )
  const FFI_SYMBOLS =
    process.env.WGPU_DEBUG_FFI === "true" || process.env.TRACE_WEBGPU === "true"
      ? convertToDebugSymbols(normalizedSymbols)
      : normalizedSymbols
  return FFI_SYMBOLS
}

export type FFISymbols = ReturnType<typeof loadLibrary>

let ffiLogWriter: ReturnType<ReturnType<typeof Bun.file>["writer"]> | null = null

function convertToDebugSymbols<T extends Record<string, any>>(symbols: T): T {
  const debugSymbols: Record<string, any> = {}

  if (process.env.WGPU_DEBUG_FFI === "true") {
    const now = new Date()
    const timestamp = now.toISOString().replace(/[:.]/g, "-").replace(/T/, "_").split("Z")[0]
    const logFilePath = `ffi_wgpu_debug_${timestamp}.log`
    ffiLogWriter = Bun.file(logFilePath).writer()

    const writer = ffiLogWriter
    const writeSync = (msg: string) => {
      const buffer = new TextEncoder().encode(msg + "\n")
      writer.write(buffer)
      writer.flush()
    }

    Object.entries(symbols).forEach(([key, value]) => {
      if (typeof value === "function") {
        debugSymbols[key] = (...args: any[]) => {
          writeSync(`${key}(${args.map((arg) => String(arg)).join(", ")})`)
          const result = value(...args)
          writeSync(`${key} returned: ${String(result)}`)
          return result
        }
      } else {
        debugSymbols[key] = value // Copy non-function properties as is
      }
    })
  }

  if (process.env.TRACE_WEBGPU === "true") {
    const traceSymbols: Record<string, any> = {}
    Object.entries(symbols).forEach(([key, value]) => {
      if (typeof value === "function") {
        traceSymbols[key] = []
        debugSymbols[key] = (...args: any[]) => {
          const start = performance.now()
          const result = value(...args)
          const end = performance.now()
          traceSymbols[key].push(end - start)
          return result
        }
      } else {
        debugSymbols[key] = value // Copy non-function properties as is
      }
    })
    process.on("exit", () => {
      const allStats: Array<{
        name: string
        count: number
        total: number
        average: number
        min: number
        max: number
        median: number
        p90: number
        p99: number
      }> = []

      for (const [key, timings] of Object.entries(traceSymbols)) {
        if (!Array.isArray(timings) || timings.length === 0) {
          continue
        }

        const sortedTimings = [...timings].sort((a, b) => a - b)
        const count = sortedTimings.length

        const total = sortedTimings.reduce((acc, t) => acc + t, 0)
        const average = total / count
        const min = sortedTimings[0]
        const max = sortedTimings[count - 1]

        const medianIndex = Math.floor(count / 2)
        const p90Index = Math.floor(count * 0.9)
        const p99Index = Math.floor(count * 0.99)

        const median = sortedTimings[medianIndex]
        const p90 = sortedTimings[Math.min(p90Index, count - 1)]
        const p99 = sortedTimings[Math.min(p99Index, count - 1)]

        allStats.push({
          name: key,
          count,
          total,
          average,
          min,
          max,
          median,
          p90,
          p99,
        })
      }

      allStats.sort((a, b) => b.total - a.total)

      console.log("\n--- WebGPU FFI Call Performance ---")
      console.log("Sorted by total time spent (descending)")
      console.log(
        "-------------------------------------------------------------------------------------------------------------------------",
      )

      if (allStats.length === 0) {
        console.log("No trace data collected or all symbols had zero calls.")
      } else {
        const nameHeader = "Symbol"
        const callsHeader = "Calls"
        const totalHeader = "Total (ms)"
        const avgHeader = "Avg (ms)"
        const minHeader = "Min (ms)"
        const maxHeader = "Max (ms)"
        const medHeader = "Med (ms)"
        const p90Header = "P90 (ms)"
        const p99Header = "P99 (ms)"

        const nameWidth = Math.max(nameHeader.length, ...allStats.map((s) => s.name.length))
        const countWidth = Math.max(callsHeader.length, ...allStats.map((s) => String(s.count).length))
        const totalWidth = Math.max(totalHeader.length, ...allStats.map((s) => s.total.toFixed(2).length))
        const avgWidth = Math.max(avgHeader.length, ...allStats.map((s) => s.average.toFixed(2).length))
        const minWidth = Math.max(minHeader.length, ...allStats.map((s) => s.min.toFixed(2).length))
        const maxWidth = Math.max(maxHeader.length, ...allStats.map((s) => s.max.toFixed(2).length))
        const medianWidth = Math.max(medHeader.length, ...allStats.map((s) => s.median.toFixed(2).length))
        const p90Width = Math.max(p90Header.length, ...allStats.map((s) => s.p90.toFixed(2).length))
        const p99Width = Math.max(p99Header.length, ...allStats.map((s) => s.p99.toFixed(2).length))

        // Header
        console.log(
          `${nameHeader.padEnd(nameWidth)} | ` +
            `${callsHeader.padStart(countWidth)} | ` +
            `${totalHeader.padStart(totalWidth)} | ` +
            `${avgHeader.padStart(avgWidth)} | ` +
            `${minHeader.padStart(minWidth)} | ` +
            `${maxHeader.padStart(maxWidth)} | ` +
            `${medHeader.padStart(medianWidth)} | ` +
            `${p90Header.padStart(p90Width)} | ` +
            `${p99Header.padStart(p99Width)}`,
        )
        // Separator
        console.log(
          `${"-".repeat(nameWidth)}-+-${"-".repeat(countWidth)}-+-${"-".repeat(totalWidth)}-+-${"-".repeat(avgWidth)}-+-${"-".repeat(minWidth)}-+-${"-".repeat(maxWidth)}-+-${"-".repeat(medianWidth)}-+-${"-".repeat(p90Width)}-+-${"-".repeat(p99Width)}`,
        )

        allStats.forEach((stat) => {
          console.log(
            `${stat.name.padEnd(nameWidth)} | ` +
              `${String(stat.count).padStart(countWidth)} | ` +
              `${stat.total.toFixed(2).padStart(totalWidth)} | ` +
              `${stat.average.toFixed(2).padStart(avgWidth)} | ` +
              `${stat.min.toFixed(2).padStart(minWidth)} | ` +
              `${stat.max.toFixed(2).padStart(maxWidth)} | ` +
              `${stat.median.toFixed(2).padStart(medianWidth)} | ` +
              `${stat.p90.toFixed(2).padStart(p90Width)} | ` +
              `${stat.p99.toFixed(2).padStart(p99Width)}`,
          )
        })
      }
      console.log(
        "-------------------------------------------------------------------------------------------------------------------------",
      )
    })
  }

  return debugSymbols as T
}
