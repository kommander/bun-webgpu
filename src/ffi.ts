import { dlopen, suffix, FFIType } from "bun:ffi";
import { join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import os from "os";

// Get the directory of the current module
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Map platform and architecture to the target name format used in our build
function getPlatformTarget(): string {
  const platform = os.platform();
  const arch = os.arch();

  // Convert Bun/Node.js platform names to Zig platform names
  const platformMap: Record<string, string> = {
    'darwin': 'macos',
    'win32': 'windows',
    'linux': 'linux',
  };

  const archMap: Record<string, string> = {
    'x64': 'x86_64',
    'arm64': 'aarch64',
  };

  const zigPlatform = platformMap[platform] || platform;
  const zigArch = archMap[arch] || arch;

  return `${zigArch}-${zigPlatform}`;
}

function findLibrary(): string {
  const target = getPlatformTarget();
  const libDir = join(__dirname, "../dawn/");

  // First try target-specific directory
  const [arch, osName] = target.split('-');
  const isWindows = osName === 'windows';
  const libraryName = isWindows ? 'webgpu_dawn' : 'libwebgpu_dawn';
  const targetLibPath = join(libDir, target, `${libraryName}.${suffix}`);

  if (existsSync(targetLibPath)) {
    return targetLibPath;
  }

  // Fall back to generic location if target-specific not found
  const genericLibPath = join(libDir, `${libraryName}.${suffix}`);

  if (existsSync(genericLibPath)) {
    return genericLibPath;
  }

  throw new Error(`Could not find dawn library for platform: ${target} at ${targetLibPath} or ${genericLibPath}`);
}

function _loadLibrary() {
    const libPath = findLibrary();
    console.log("ffi2 - Loading library:", libPath);

    // Define the FFI interface based on webgpu.h functions
    // Naming convention: wgpuFunctionName
    const { symbols } = dlopen(libPath, {
      // --- Core API Functions ---
      wgpuGetProcAddress: {
        args: [FFIType.cstring], // procName: WGPUStringView (treat as cstring for simplicity)
        returns: FFIType.pointer, // WGPUProc
      },
      wgpuCreateInstance: {
        args: [FFIType.pointer], // descriptor: *const WGPUInstanceDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUInstance
      },

      // --- Instance Functions ---
      wgpuInstanceCreateSurface: {
        args: [FFIType.pointer, FFIType.pointer], // instance: WGPUInstance, descriptor: *const WGPUSurfaceDescriptor
        returns: FFIType.pointer, // -> WGPUSurface
      },
      wgpuInstanceProcessEvents: {
        args: [FFIType.pointer], // instance: WGPUInstance
        returns: FFIType.void,
      },
      wgpuInstanceRequestAdapter: {
        args: [
          FFIType.pointer, // instance: WGPUInstance
          FFIType.pointer, // options: *const WGPURequestAdapterOptions (nullable)
          FFIType.pointer, // callbackInfo: WGPURequestAdapterCallbackInfo
        ],
        returns: FFIType.u64, // -> WGPUFuture (id)
      },
      wgpuInstanceWaitAny: {
          args: [
              FFIType.pointer, // instance: WGPUInstance
              FFIType.u64,     // futureCount: size_t (using u64)
              FFIType.pointer, // futures: *WGPUFutureWaitInfo
              FFIType.u64,     // timeoutNS: uint64_t
          ],
          returns: FFIType.u32, // -> WGPUWaitStatus (enum)
      },
      wgpuInstanceRelease: {
        args: [FFIType.pointer], // instance: WGPUInstance
        returns: FFIType.void,
      },
      wgpuInstanceAddRef: { // Typically not needed from JS due to GC, but included for completeness
        args: [FFIType.pointer], // instance: WGPUInstance
        returns: FFIType.void,
      },

      // --- Adapter Functions ---
      wgpuAdapterCreateDevice: {
        args: [
          FFIType.pointer, // adapter: WGPUAdapter
          FFIType.pointer, // descriptor: *const WGPUDeviceDescriptor (nullable)
        ],
        returns: FFIType.pointer, // -> WGPUDevice
      },
      wgpuAdapterGetInfo: {
          args: [FFIType.pointer, FFIType.pointer], // adapter: WGPUAdapter, info: *mut WGPUAdapterInfo
          returns: FFIType.u32, // WGPUStatus
      },
      wgpuAdapterRequestDevice: {
        args: [
          FFIType.pointer, // adapter: WGPUAdapter
          FFIType.pointer, // options: *const WGPUDeviceDescriptor (nullable)
          FFIType.pointer, // callbackInfo: WGPURequestDeviceCallbackInfo
        ],
        returns: FFIType.u64, // -> WGPUFuture (id)
      },
      wgpuAdapterRelease: {
        args: [FFIType.pointer], // adapter: WGPUAdapter
        returns: FFIType.void,
      },
      // Add other adapter functions like GetFeatures, GetLimits, HasFeature etc.

      // --- Device Functions ---
      wgpuDeviceCreateBuffer: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBufferDescriptor
        returns: FFIType.pointer, // -> WGPUBuffer
      },
      wgpuDeviceCreateTexture: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUTextureDescriptor
        returns: FFIType.pointer, // -> WGPUTexture
      },
      wgpuDeviceCreateSampler: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUSamplerDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUSampler
      },
      wgpuDeviceCreateShaderModule: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUShaderModuleDescriptor
        returns: FFIType.pointer, // -> WGPUShaderModule
      },
      wgpuDeviceCreateBindGroupLayout: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBindGroupLayoutDescriptor
        returns: FFIType.pointer, // -> WGPUBindGroupLayout
      },
       wgpuDeviceCreateBindGroup: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUBindGroupDescriptor
        returns: FFIType.pointer, // -> WGPUBindGroup
      },
      wgpuDeviceCreatePipelineLayout: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUPipelineLayoutDescriptor
        returns: FFIType.pointer, // -> WGPUPipelineLayout
      },
      wgpuDeviceCreateRenderPipeline: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPURenderPipelineDescriptor
        returns: FFIType.pointer, // -> WGPURenderPipeline
      },
      wgpuDeviceCreateComputePipeline: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUComputePipelineDescriptor
        returns: FFIType.pointer, // -> WGPUComputePipeline
      },
      wgpuDeviceCreateCommandEncoder: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUCommandEncoderDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUCommandEncoder
      },
      wgpuDeviceCreateQuerySet: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, descriptor: *const WGPUQuerySetDescriptor
        returns: FFIType.pointer, // -> WGPUQuerySet
      },
      wgpuDeviceGetQueue: {
          args: [FFIType.pointer], // device: WGPUDevice
          returns: FFIType.pointer, // -> WGPUQueue
      },
      wgpuDeviceGetLimits: {
          args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, limits: *mut WGPULimits
          returns: FFIType.u32, // WGPUStatus
      },
      wgpuDeviceHasFeature: {
        args: [FFIType.pointer, FFIType.u32], // device: WGPUDevice, feature: WGPUFeatureName (enum)
        returns: FFIType.bool, // WGPUBool (use bool for direct mapping)
      },
      wgpuDeviceGetFeatures: {
        args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, features: *mut WGPUSupportedFeatures
        returns: FFIType.void,
      },
      wgpuDevicePushErrorScope: {
          args: [FFIType.pointer, FFIType.u32], // device: WGPUDevice, filter: WGPUErrorFilter (enum)
          returns: FFIType.void,
      },
      wgpuDevicePopErrorScope: {
          args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, callbackInfo: WGPUPopErrorScopeCallbackInfo
          returns: FFIType.u64, // WGPUFuture (id)
      },
      // wgpuDeviceSetUncapturedErrorCallback: {
      //     args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, callbackInfo: WGPUUncapturedErrorCallbackInfo
      //     returns: FFIType.void,
      // },
      wgpuDeviceTick: {
          args: [FFIType.pointer], // device: WGPUDevice
          returns: FFIType.void,
      },
      wgpuDeviceDestroy: {
          args: [FFIType.pointer], // device: WGPUDevice
          returns: FFIType.void,
      },
      wgpuDeviceRelease: {
        args: [FFIType.pointer], // device: WGPUDevice
        returns: FFIType.void,
      },
      // Add other device functions...

      // --- Buffer Functions ---
      wgpuBufferGetMappedRange: {
        args: [FFIType.pointer, FFIType.u64, FFIType.u64], // buffer: WGPUBuffer, offset: size_t, size: size_t
        returns: FFIType.ptr, // void*
      },
      wgpuBufferGetConstMappedRange: {
        args: [FFIType.pointer, FFIType.u64, FFIType.u64], // buffer: WGPUBuffer, offset: size_t, size: size_t
        returns: FFIType.ptr, // const void*
      },
      wgpuBufferUnmap: {
        args: [FFIType.pointer], // buffer: WGPUBuffer
        returns: FFIType.void,
      },
      wgpuBufferMapAsync: {
        args: [
          FFIType.pointer, // buffer: WGPUBuffer
          FFIType.u64,     // mode: WGPUMapMode (flags)
          FFIType.u64,     // offset: size_t
          FFIType.u64,     // size: size_t
          FFIType.pointer, // callbackInfo: WGPUBufferMapCallbackInfo
        ],
        returns: FFIType.u64, // WGPUFuture (id)
      },
      wgpuBufferDestroy: {
          args: [FFIType.pointer], // buffer: WGPUBuffer
          returns: FFIType.void,
      },
      wgpuBufferRelease: {
        args: [FFIType.pointer], // buffer: WGPUBuffer
        returns: FFIType.void,
      },
      // Add other buffer functions...

      // --- Texture Functions ---
       wgpuTextureCreateView: {
        args: [FFIType.pointer, FFIType.pointer], // texture: WGPUTexture, descriptor: *const WGPUTextureViewDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUTextureView
      },
      wgpuTextureDestroy: {
          args: [FFIType.pointer], // texture: WGPUTexture
          returns: FFIType.void,
      },
      wgpuTextureRelease: {
        args: [FFIType.pointer], // texture: WGPUTexture
        returns: FFIType.void,
      },
      // Add other texture functions...

      // --- TextureView Functions ---
      wgpuTextureViewRelease: {
        args: [FFIType.pointer], // textureView: WGPUTextureView
        returns: FFIType.void,
      },
      // Add other texture view functions...

      // --- Sampler Functions ---
       wgpuSamplerRelease: {
        args: [FFIType.pointer], // sampler: WGPUSampler
        returns: FFIType.void,
      },
      // Add other sampler functions...

      // --- ShaderModule Functions ---
      wgpuShaderModuleGetCompilationInfo: {
          args: [FFIType.pointer, FFIType.pointer], // shaderModule: WGPUShaderModule, callbackInfo: WGPUCompilationInfoCallbackInfo
          returns: FFIType.u64, // WGPUFuture (id)
      },
      wgpuShaderModuleRelease: {
        args: [FFIType.pointer], // shaderModule: WGPUShaderModule
        returns: FFIType.void,
      },
      // Add other shader module functions...

      // --- BindGroupLayout Functions ---
      wgpuBindGroupLayoutRelease: {
        args: [FFIType.pointer], // bindGroupLayout: WGPUBindGroupLayout
        returns: FFIType.void,
      },

      // --- BindGroup Functions ---
      wgpuBindGroupRelease: {
        args: [FFIType.pointer], // bindGroup: WGPUBindGroup
        returns: FFIType.void,
      },

      // --- PipelineLayout Functions ---
      wgpuPipelineLayoutRelease: {
        args: [FFIType.pointer], // pipelineLayout: WGPUPipelineLayout
        returns: FFIType.void,
      },

      // --- QuerySet Functions ---
      wgpuQuerySetDestroy: {
        args: [FFIType.pointer], // querySet: WGPUQuerySet
        returns: FFIType.void,
      },
      wgpuQuerySetRelease: {
        args: [FFIType.pointer], // querySet: WGPUQuerySet
        returns: FFIType.void,
      },

      // --- RenderPipeline Functions ---
      wgpuRenderPipelineRelease: {
        args: [FFIType.pointer], // renderPipeline: WGPURenderPipeline
        returns: FFIType.void,
      },

      // --- ComputePipeline Functions ---
      wgpuComputePipelineRelease: {
        args: [FFIType.pointer], // computePipeline: WGPUComputePipeline
        returns: FFIType.void,
      },

      // --- CommandEncoder Functions ---
      wgpuCommandEncoderBeginRenderPass: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPURenderPassDescriptor
        returns: FFIType.pointer, // -> WGPURenderPassEncoder
      },
      wgpuCommandEncoderBeginComputePass: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPUComputePassDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUComputePassEncoder
      },
      wgpuCommandEncoderClearBuffer: {
        args: [
          FFIType.pointer, // commandEncoder: WGPUCommandEncoder
          FFIType.pointer, // buffer: WGPUBuffer
          FFIType.u64,     // offset: uint64_t
          FFIType.u64,     // size: uint64_t
        ],
        returns: FFIType.void,
      },
      wgpuCommandEncoderCopyBufferToBuffer: {
        args: [
            FFIType.pointer, // commandEncoder: WGPUCommandEncoder
            FFIType.pointer, // source: WGPUBuffer
            FFIType.u64,     // sourceOffset: uint64_t
            FFIType.pointer, // destination: WGPUBuffer
            FFIType.u64,     // destinationOffset: uint64_t
            FFIType.u64,     // size: uint64_t
        ],
        returns: FFIType.void,
      },
      wgpuCommandEncoderCopyBufferToTexture: {
        args: [
            FFIType.pointer, // commandEncoder
            FFIType.pointer, // source: *const WGPUTexelCopyBufferInfo
            FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
            FFIType.pointer, // copySize: *const WGPUExtent3D
        ],
        returns: FFIType.void,
      },
      wgpuCommandEncoderCopyTextureToBuffer: {
          args: [
              FFIType.pointer, // commandEncoder
              FFIType.pointer, // source: *const WGPUTexelCopyTextureInfo
              FFIType.pointer, // destination: *const WGPUTexelCopyBufferInfo
              FFIType.pointer, // copySize: *const WGPUExtent3D
          ],
          returns: FFIType.void,
      },
      wgpuCommandEncoderCopyTextureToTexture: {
          args: [
              FFIType.pointer, // commandEncoder
              FFIType.pointer, // source: *const WGPUTexelCopyTextureInfo
              FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
              FFIType.pointer, // copySize: *const WGPUExtent3D
          ],
          returns: FFIType.void,
      },
      wgpuCommandEncoderFinish: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPUCommandBufferDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUCommandBuffer
      },
      wgpuCommandEncoderRelease: {
        args: [FFIType.pointer], // commandEncoder: WGPUCommandEncoder
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderSetScissorRect: {
        args: [
          FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
          FFIType.u32,     // x: uint32_t
          FFIType.u32,     // y: uint32_t
          FFIType.u32,     // width: uint32_t
          FFIType.u32,     // height: uint32_t
        ],
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderSetViewport: {
        args: [
          FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
          FFIType.f32,     // x: float
          FFIType.f32,     // y: float
          FFIType.f32,     // width: float
          FFIType.f32,     // height: float
          FFIType.f32,     // minDepth: float
          FFIType.f32,     // maxDepth: float
        ],
        returns: FFIType.void,
      },
      // Add other command encoder functions...

      // --- RenderPassEncoder Functions ---
      wgpuRenderPassEncoderSetPipeline: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderPassEncoder, pipeline: WGPURenderPipeline
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderSetBindGroup: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // groupIndex: uint32_t
            FFIType.pointer, // group: WGPUBindGroup (nullable)
            FFIType.u64,     // dynamicOffsetCount: size_t
            FFIType.pointer, // dynamicOffsets: *const uint32_t
        ],
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderSetVertexBuffer: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // slot: uint32_t
            FFIType.pointer, // buffer: WGPUBuffer (nullable)
            FFIType.u64,     // offset: uint64_t
            FFIType.u64,     // size: uint64_t
        ],
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderSetIndexBuffer: {
          args: [
              FFIType.pointer, // encoder: WGPURenderPassEncoder
              FFIType.pointer, // buffer: WGPUBuffer
              FFIType.u32,     // format: WGPUIndexFormat (enum)
              FFIType.u64,     // offset: uint64_t
              FFIType.u64,     // size: uint64_t
          ],
          returns: FFIType.void,
      },
      wgpuRenderPassEncoderDraw: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // vertexCount: uint32_t
            FFIType.u32,     // instanceCount: uint32_t
            FFIType.u32,     // firstVertex: uint32_t
            FFIType.u32,     // firstInstance: uint32_t
        ],
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderDrawIndexed: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // indexCount: uint32_t
            FFIType.u32,     // instanceCount: uint32_t
            FFIType.u32,     // firstIndex: uint32_t
            FFIType.i32,     // baseVertex: int32_t
            FFIType.u32,     // firstInstance: uint32_t
        ],
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderEnd: {
        args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
        returns: FFIType.void,
      },
      wgpuRenderPassEncoderRelease: {
        args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
        returns: FFIType.void,
      },
      // Add other render pass functions...

      // --- ComputePassEncoder Functions ---
      wgpuComputePassEncoderSetPipeline: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUComputePassEncoder, pipeline: WGPUComputePipeline
        returns: FFIType.void,
      },
      wgpuComputePassEncoderSetBindGroup: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.u32,     // groupIndex: uint32_t
              FFIType.pointer, // group: WGPUBindGroup (nullable)
              FFIType.u64,     // dynamicOffsetCount: size_t
              FFIType.pointer, // dynamicOffsets: *const uint32_t
          ],
          returns: FFIType.void,
      },
      wgpuComputePassEncoderDispatchWorkgroups: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.u32,     // workgroupCountX: uint32_t
              FFIType.u32,     // workgroupCountY: uint32_t
              FFIType.u32,     // workgroupCountZ: uint32_t
          ],
          returns: FFIType.void,
      },
      wgpuComputePassEncoderDispatchWorkgroupsIndirect: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.pointer, // indirectBuffer: WGPUBuffer
              FFIType.u64,     // indirectOffset: uint64_t
          ],
          returns: FFIType.void,
      },
      wgpuComputePassEncoderEnd: {
        args: [FFIType.pointer], // encoder: WGPUComputePassEncoder
        returns: FFIType.void,
      },
      wgpuComputePassEncoderRelease: {
        args: [FFIType.pointer], // encoder: WGPUComputePassEncoder
        returns: FFIType.void,
      },
      // Add other compute pass functions...

      // --- CommandBuffer Functions ---
      wgpuCommandBufferRelease: {
        args: [FFIType.pointer], // commandBuffer: WGPUCommandBuffer
        returns: FFIType.void,
      },

      // --- Queue Functions ---
      wgpuQueueSubmit: {
        args: [
            FFIType.pointer, // queue: WGPUQueue
            FFIType.u64,     // commandCount: size_t
            FFIType.pointer, // commands: *const WGPUCommandBuffer
        ],
        returns: FFIType.void,
      },
      wgpuQueueWriteBuffer: {
          args: [
              FFIType.pointer, // queue: WGPUQueue
              FFIType.pointer, // buffer: WGPUBuffer
              FFIType.u64,     // bufferOffset: uint64_t
              FFIType.ptr,     // data: *const void
              FFIType.u64,     // size: size_t
          ],
          returns: FFIType.void,
      },
      wgpuQueueWriteTexture: {
          args: [
              FFIType.pointer, // queue: WGPUQueue
              FFIType.pointer, // destination: *const WGPUTexelCopyTextureInfo
              FFIType.ptr,     // data: *const void
              FFIType.u64,     // dataSize: size_t
              FFIType.pointer, // dataLayout: *const WGPUTexelCopyBufferLayout
              FFIType.pointer, // writeSize: *const WGPUExtent3D
          ],
          returns: FFIType.void,
      },
      wgpuQueueOnSubmittedWorkDone: {
          args: [
              FFIType.pointer, // queue: WGPUQueue
              FFIType.pointer, // callbackInfo: WGPUQueueWorkDoneCallbackInfo
          ],
          returns: FFIType.u64, // WGPUFuture (id)
      },
      wgpuQueueRelease: {
        args: [FFIType.pointer], // queue: WGPUQueue
        returns: FFIType.void,
      },
       // Add other queue functions...

      // --- Surface Functions ---
       wgpuSurfaceConfigure: {
        args: [FFIType.pointer, FFIType.pointer], // surface: WGPUSurface, config: *const WGPUSurfaceConfiguration
        returns: FFIType.void,
      },
      wgpuSurfaceUnconfigure: {
        args: [FFIType.pointer], // surface: WGPUSurface
        returns: FFIType.void,
      },
      wgpuSurfaceGetCurrentTexture: {
        args: [FFIType.pointer, FFIType.pointer], // surface: WGPUSurface, surfaceTexture: *mut WGPUSurfaceTexture
        returns: FFIType.void,
      },
      wgpuSurfacePresent: {
        args: [FFIType.pointer], // surface: WGPUSurface
        returns: FFIType.void,
      },
      wgpuSurfaceRelease: {
        args: [FFIType.pointer], // surface: WGPUSurface
        returns: FFIType.void,
      },
      // Add other surface functions...

      // --- Freeing Functions (Important for structs returned by pointer) ---
      wgpuAdapterInfoFreeMembers: {
          args: [FFIType.pointer], // value: WGPUAdapterInfo (passed by pointer but represents struct value)
          returns: FFIType.void,
      },
      wgpuSurfaceCapabilitiesFreeMembers: {
        args: [FFIType.pointer], // value: WGPUSurfaceCapabilities (passed by pointer)
        returns: FFIType.void,
      },
      wgpuSupportedFeaturesFreeMembers: { // Added for freeing features array
        args: [FFIType.pointer], // value: WGPUSupportedFeatures (passed by pointer)
        returns: FFIType.void,
      },
      wgpuSharedBufferMemoryEndAccessStateFreeMembers: {
        args: [FFIType.pointer], // value: WGPUSharedBufferMemoryEndAccessState
        returns: FFIType.void,
      },
      wgpuSharedTextureMemoryEndAccessStateFreeMembers: {
        args: [FFIType.pointer], // value: WGPUSharedTextureMemoryEndAccessState
        returns: FFIType.void,
      },
      // Add other FreeMembers functions as needed...


      // NOTE: This is not exhaustive. Many more functions exist in webgpu.h
      // Add more bindings here as needed, following the patterns above.
      // Pay attention to pointer types (*const vs *mut), nullable pointers,
      // struct layouts, enums, and flags.

    });
    return symbols;
}

export const FFI_SYMBOLS = process.env.DEBUG === 'true' ? convertToDebugSymbols(_loadLibrary()) : _loadLibrary(); 

function convertToDebugSymbols<T extends Record<string, any>>(symbols: T): T {
    const debugSymbols: Record<string, any> = {};
    Object.entries(symbols).forEach(([key, value]) => {
        if (typeof value === 'function') {
            debugSymbols[key] = (...args: any[]) => {
                console.log(`${key}(${args.map(arg => String(arg)).join(', ')})`);
                const result = value(...args);
                console.log(`${key} returned:`, String(result));
                return result;
            };
        } else {
             debugSymbols[key] = value; // Copy non-function properties as is
        }
    });
    return debugSymbols as T;
}
