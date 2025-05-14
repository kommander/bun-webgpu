import { dlopen, suffix, FFIType } from "bun:ffi";
import { join } from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import os from "os";

// Get the directory of the current module
const __dirname = fileURLToPath(new URL(".", import.meta.url));

// const DEFAULT_PATH = join(__dirname, "../dawn/");
const DEFAULT_PATH = join(__dirname, "zig/lib/");
// const LIB_NAME = "webgpu_dawn";
const LIB_NAME = "webgpu_wrapper";


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
  const libDir = DEFAULT_PATH;

  // First try target-specific directory
  const [arch, osName] = target.split('-');
  const isWindows = osName === 'windows';
  const libraryName = isWindows ? LIB_NAME : `lib${LIB_NAME}`;
  const targetLibPath = join(libDir, target, `${libraryName}.${suffix}`);

  if (existsSync(targetLibPath)) {
    return targetLibPath;
  }

  throw new Error(`Could not find dawn library for platform: ${target} at ${targetLibPath}`);
}

function _loadLibrary() {
    const libPath = findLibrary();
    
    // Define the FFI interface based on webgpu.h functions
    const { symbols } = dlopen(libPath, {
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
              FFIType.u64,     // futureCount: size_t (using u64)
              FFIType.pointer, // futures: *WGPUFutureWaitInfo
              FFIType.u64,     // timeoutNS: uint64_t
          ],
          returns: FFIType.u32, // -> WGPUWaitStatus (enum)
      },
      zwgpuInstanceRelease: {
        args: [FFIType.pointer], // instance: WGPUInstance
        returns: FFIType.void,
      },
      zwgpuInstanceAddRef: { // Typically not needed from JS due to GC, but included for completeness
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
      zwgpuAdapterGetFeatures: { // Added for getting adapter features
        args: [FFIType.pointer], // adapter: WGPUAdapter
        returns: FFIType.u64,    // returns WGPUFeatureFlags (uint64_t)
      },
      zwgpuAdapterGetLimits: {
        args: [FFIType.pointer, FFIType.pointer], // adapter: WGPUAdapter, limits: *mut WGPULimits
        returns: FFIType.u32, // WGPUStatus
      },
      // Add other adapter functions like GetFeatures, GetLimits, HasFeature etc.

      // --- Device Functions ---
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
      // wgpuDeviceSetUncapturedErrorCallback: {
      //     args: [FFIType.pointer, FFIType.pointer], // device: WGPUDevice, callbackInfo: WGPUUncapturedErrorCallbackInfo
      //     returns: FFIType.void,
      // },
      zwgpuDeviceTick: {
          args: [FFIType.pointer], // device: WGPUDevice
          returns: FFIType.void,
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
          FFIType.u64,     // mode: WGPUMapMode (flags)
          FFIType.u64,     // offset: size_t
          FFIType.u64,     // size: size_t
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

      // --- ComputePipeline Functions ---
      zwgpuComputePipelineRelease: {
        args: [FFIType.pointer], // computePipeline: WGPUComputePipeline
        returns: FFIType.void,
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
          FFIType.u64,     // offset: uint64_t
          FFIType.u64,     // size: uint64_t
        ],
        returns: FFIType.void,
      },
      zwgpuCommandEncoderCopyBufferToBuffer: {
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
      zwgpuCommandEncoderFinish: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUCommandEncoder, descriptor: *const WGPUCommandBufferDescriptor (nullable)
        returns: FFIType.pointer, // -> WGPUCommandBuffer
      },
      zwgpuCommandEncoderRelease: {
        args: [FFIType.pointer], // commandEncoder: WGPUCommandEncoder
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderSetScissorRect: {
        args: [
          FFIType.pointer, // renderPassEncoder: WGPURenderPassEncoder
          FFIType.u32,     // x: uint32_t
          FFIType.u32,     // y: uint32_t
          FFIType.u32,     // width: uint32_t
          FFIType.u32,     // height: uint32_t
        ],
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderSetViewport: {
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
      zwgpuRenderPassEncoderSetPipeline: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPURenderPassEncoder, pipeline: WGPURenderPipeline
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderSetBindGroup: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // groupIndex: uint32_t
            FFIType.pointer, // group: WGPUBindGroup (nullable)
            FFIType.u64,     // dynamicOffsetCount: size_t
            FFIType.pointer, // dynamicOffsets: *const uint32_t
        ],
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderSetVertexBuffer: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // slot: uint32_t
            FFIType.pointer, // buffer: WGPUBuffer (nullable)
            FFIType.u64,     // offset: uint64_t
            FFIType.u64,     // size: uint64_t
        ],
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderSetIndexBuffer: {
          args: [
              FFIType.pointer, // encoder: WGPURenderPassEncoder
              FFIType.pointer, // buffer: WGPUBuffer
              FFIType.u32,     // format: WGPUIndexFormat (enum)
              FFIType.u64,     // offset: uint64_t
              FFIType.u64,     // size: uint64_t
          ],
          returns: FFIType.void,
      },
      zwgpuRenderPassEncoderDraw: {
        args: [
            FFIType.pointer, // encoder: WGPURenderPassEncoder
            FFIType.u32,     // vertexCount: uint32_t
            FFIType.u32,     // instanceCount: uint32_t
            FFIType.u32,     // firstVertex: uint32_t
            FFIType.u32,     // firstInstance: uint32_t
        ],
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderDrawIndexed: {
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
      zwgpuRenderPassEncoderEnd: {
        args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
        returns: FFIType.void,
      },
      zwgpuRenderPassEncoderRelease: {
        args: [FFIType.pointer], // encoder: WGPURenderPassEncoder
        returns: FFIType.void,
      },
      // Add other render pass functions...

      // --- ComputePassEncoder Functions ---
      zwgpuComputePassEncoderSetPipeline: {
        args: [FFIType.pointer, FFIType.pointer], // encoder: WGPUComputePassEncoder, pipeline: WGPUComputePipeline
        returns: FFIType.void,
      },
      zwgpuComputePassEncoderSetBindGroup: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.u32,     // groupIndex: uint32_t
              FFIType.pointer, // group: WGPUBindGroup (nullable)
              FFIType.u64,     // dynamicOffsetCount: size_t
              FFIType.pointer, // dynamicOffsets: *const uint32_t
          ],
          returns: FFIType.void,
      },
      zwgpuComputePassEncoderDispatchWorkgroups: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.u32,     // workgroupCountX: uint32_t
              FFIType.u32,     // workgroupCountY: uint32_t
              FFIType.u32,     // workgroupCountZ: uint32_t
          ],
          returns: FFIType.void,
      },
      zwgpuComputePassEncoderDispatchWorkgroupsIndirect: {
          args: [
              FFIType.pointer, // encoder: WGPUComputePassEncoder
              FFIType.pointer, // indirectBuffer: WGPUBuffer
              FFIType.u64,     // indirectOffset: uint64_t
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
            FFIType.u64,     // commandCount: size_t
            FFIType.pointer, // commands: *const WGPUCommandBuffer
        ],
        returns: FFIType.void,
      },
      zwgpuQueueWriteBuffer: {
          args: [
              FFIType.pointer, // queue: WGPUQueue
              FFIType.pointer, // buffer: WGPUBuffer
              FFIType.u64,     // bufferOffset: uint64_t
              FFIType.ptr,     // data: *const void
              FFIType.u64,     // size: size_t
          ],
          returns: FFIType.void,
      },
      zwgpuQueueWriteTexture: {
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
      zwgpuSupportedFeaturesFreeMembers: { // Added for freeing features array
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
      // Add other FreeMembers functions as needed...

      // NOTE: This is not exhaustive. Many more functions exist in webgpu.h
      // Add more bindings here as needed, following the patterns above.
    });
    return symbols;
}

const rawSymbols = _loadLibrary();

type StripZWPrefix<KeyType extends string> =
  KeyType extends `zw${infer Rest}` ? `w${Rest}` : KeyType;

type TransformedSymbolKeys<T extends object> = {
  [K in keyof T as StripZWPrefix<K & string>]: T[K];
};

// The type of the final normalizedSymbols object
type NormalizedSymbolsType = TransformedSymbolKeys<typeof rawSymbols>;

const normalizedSymbols = Object.keys(rawSymbols).reduce(
  (acc, key) => {
    const newKey = key.replace(/^zw/, 'w') as keyof NormalizedSymbolsType; // Assert the new key type
    (acc as any)[newKey] = (rawSymbols as Record<string, any>)[key];
    return acc;
  },
  {} as NormalizedSymbolsType // Crucially, type the initial accumulator
);

export const FFI_SYMBOLS = process.env.DEBUG === 'true' ? convertToDebugSymbols(normalizedSymbols) : normalizedSymbols; 

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
