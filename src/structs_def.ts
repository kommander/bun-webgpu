import { toArrayBuffer, type Pointer } from "bun:ffi";
import { fatalError, OperationError } from "./utils/error";
import { defineEnum, defineStruct, objectPtr } from "./structs_ffi";
import { DEFAULT_SUPPORTED_LIMITS, WGPUErrorType } from "./shared";

export const WGPUBool = 'bool_u32';
export const UINT64_MAX = 0xFFFFFFFFFFFFFFFFn;
export const WGPU_WHOLE_SIZE = 0xFFFFFFFFFFFFFFFFn;
export const WGPU_STRLEN = UINT64_MAX;

export const WGPUCallbackMode = {
    WaitAnyOnly: 0x00000001,
    AllowProcessEvents: 0x00000002,
    AllowSpontaneous: 0x00000003,
    Force32: 0x7FFFFFFF
};
export const WGPUCallbackModeDef = defineEnum(WGPUCallbackMode);
export const WGPUErrorTypeDef = defineEnum(WGPUErrorType);

export const WGPUDeviceLostReason = {
    unknown: 0x00000001,
    destroyed: 0x00000002,
    "callback-cancelled": 0x00000003,
    "failed-creation": 0x00000004,
    "force-32": 0x7FFFFFFF
} as const;
export const WGPUDeviceLostReasonDef = defineEnum(WGPUDeviceLostReason);

export const WGPUSType = {
    ShaderSourceSPIRV: 0x00000001,
    ShaderSourceWGSL: 0x00000002,
    RenderPassMaxDrawCount: 0x00000003,
    SurfaceSourceMetalLayer: 0x00000004,
    SurfaceSourceWindowsHWND: 0x00000005,
    SurfaceSourceXlibWindow: 0x00000006,
    SurfaceSourceWaylandSurface: 0x00000007,
    SurfaceSourceAndroidNativeWindow: 0x00000008,
    SurfaceSourceXCBWindow: 0x00000009,
    SurfaceColorManagement: 0x0000000A,
    RequestAdapterWebXROptions: 0x0000000B,
    AdapterPropertiesSubgroups: 0x0000000C,
    TextureBindingViewDimensionDescriptor: 0x00020000,
    EmscriptenSurfaceSourceCanvasHTMLSelector: 0x00040000,
    SurfaceDescriptorFromWindowsCoreWindow: 0x00050000,
    ExternalTextureBindingEntry: 0x00050001,
    ExternalTextureBindingLayout: 0x00050002,
    SurfaceDescriptorFromWindowsUWPSwapChainPanel: 0x00050003,
    DawnTextureInternalUsageDescriptor: 0x00050004,
    DawnEncoderInternalUsageDescriptor: 0x00050005,
    DawnInstanceDescriptor: 0x00050006,
    DawnCacheDeviceDescriptor: 0x00050007,
    DawnAdapterPropertiesPowerPreference: 0x00050008,
    DawnBufferDescriptorErrorInfoFromWireClient: 0x00050009,
    DawnTogglesDescriptor: 0x0005000A,
    DawnShaderModuleSPIRVOptionsDescriptor: 0x0005000B,
    RequestAdapterOptionsLUID: 0x0005000C,
    RequestAdapterOptionsGetGLProc: 0x0005000D,
    RequestAdapterOptionsD3D11Device: 0x0005000E,
    DawnRenderPassColorAttachmentRenderToSingleSampled: 0x0005000F,
    RenderPassPixelLocalStorage: 0x00050010,
    PipelineLayoutPixelLocalStorage: 0x00050011,
    BufferHostMappedPointer: 0x00050012,
    AdapterPropertiesMemoryHeaps: 0x00050013,
    AdapterPropertiesD3D: 0x00050014,
    AdapterPropertiesVk: 0x00050015,
    DawnWireWGSLControl: 0x00050016,
    DawnWGSLBlocklist: 0x00050017,
    DawnDrmFormatCapabilities: 0x00050018,
    ShaderModuleCompilationOptions: 0x00050019,
    ColorTargetStateExpandResolveTextureDawn: 0x0005001A,
    RenderPassDescriptorExpandResolveRect: 0x0005001B,
    SharedTextureMemoryVkDedicatedAllocationDescriptor: 0x0005001C,
    SharedTextureMemoryAHardwareBufferDescriptor: 0x0005001D,
    SharedTextureMemoryDmaBufDescriptor: 0x0005001E,
    SharedTextureMemoryOpaqueFDDescriptor: 0x0005001F,
    SharedTextureMemoryZirconHandleDescriptor: 0x00050020,
    SharedTextureMemoryDXGISharedHandleDescriptor: 0x00050021,
    SharedTextureMemoryD3D11Texture2DDescriptor: 0x00050022,
    SharedTextureMemoryIOSurfaceDescriptor: 0x00050023,
    SharedTextureMemoryEGLImageDescriptor: 0x00050024,
    SharedTextureMemoryInitializedBeginState: 0x00050025,
    SharedTextureMemoryInitializedEndState: 0x00050026,
    SharedTextureMemoryVkImageLayoutBeginState: 0x00050027,
    SharedTextureMemoryVkImageLayoutEndState: 0x00050028,
    SharedTextureMemoryD3DSwapchainBeginState: 0x00050029,
    SharedFenceVkSemaphoreOpaqueFDDescriptor: 0x0005002A,
    SharedFenceVkSemaphoreOpaqueFDExportInfo: 0x0005002B,
    SharedFenceSyncFDDescriptor: 0x0005002C,
    SharedFenceSyncFDExportInfo: 0x0005002D,
    SharedFenceVkSemaphoreZirconHandleDescriptor: 0x0005002E,
    SharedFenceVkSemaphoreZirconHandleExportInfo: 0x0005002F,
    SharedFenceDXGISharedHandleDescriptor: 0x00050030,
    SharedFenceDXGISharedHandleExportInfo: 0x00050031,
    SharedFenceMTLSharedEventDescriptor: 0x00050032,
    SharedFenceMTLSharedEventExportInfo: 0x00050033,
    SharedBufferMemoryD3D12ResourceDescriptor: 0x00050034,
    StaticSamplerBindingLayout: 0x00050035,
    YCbCrVkDescriptor: 0x00050036,
    SharedTextureMemoryAHardwareBufferProperties: 0x00050037,
    AHardwareBufferProperties: 0x00050038,
    DawnExperimentalImmediateDataLimits: 0x00050039,
    DawnTexelCopyBufferRowAlignmentLimits: 0x0005003A,
    AdapterPropertiesSubgroupMatrixConfigs: 0x0005003B,
    SharedFenceEGLSyncDescriptor: 0x0005003C,
    SharedFenceEGLSyncExportInfo: 0x0005003D,
    DawnInjectedInvalidSType: 0x0005003E,
    DawnCompilationMessageUtf16: 0x0005003F,
    DawnFakeBufferOOMForTesting: 0x00050040,
    SurfaceDescriptorFromWindowsWinUISwapChainPanel: 0x00050041,
    DawnDeviceAllocatorControl: 0x00050042,
    Force32: 0x7FFFFFFF
} as const;

export const WGPUCompareFunction = defineEnum({
    undefined: 0,
    never: 1,
    less: 2,
    equal: 3,
    "less-equal": 4,
    greater: 5,
    "not-equal": 6,
    "greater-equal": 7,
    always: 8,
    "force-32": 0x7FFFFFFF
});

export const WGPUErrorFilter = defineEnum({
    validation: 0x00000001,
    "out-of-memory": 0x00000002,
    internal: 0x00000003,
    "force-32": 0x7FFFFFFF
});

export const WGPUStringView = defineStruct([
    ['data', 'char*', { optional: true }],
    ['length', 'u64'],
], {
    mapValue: (v: string | null | undefined) => {
        if (!v) {
            return {
                data: null,
                length: WGPU_STRLEN,
            };
        }
        return {
            data: v,
            length: Buffer.byteLength(v),
        };
    },
    reduceValue: (v: { data: Pointer | null; length: bigint }) => {
        if (v.data === null || v.length === 0n) {
            return '';
        }
        const buffer = toArrayBuffer(v.data, 0, Number(v.length) || 0);
        return new TextDecoder().decode(buffer);
    },
});

export function pointerValue(ptr: Pointer | null): bigint {
    const value = ptr ? BigInt(ptr.valueOf()) : 0n;
    if (value === 0n) {
        fatalError("Pointer is null before FFI call!");
    }
    return value;
}

export const PowerPreference = defineEnum({
    undefined: 0,
    'low-power': 1,
    'high-performance': 2,
});

export const WGPUBackendType = defineEnum({
    Undefined: 0x00000000,
    Null: 0x00000001,
    WebGPU: 0x00000002,
    D3D11: 0x00000003,
    D3D12: 0x00000004,
    Metal: 0x00000005,
    Vulkan: 0x00000006,
    OpenGL: 0x00000007,
    OpenGLES: 0x00000008,
    Force32: 0x7FFFFFFF
});

export const WGPUFeatureLevel = defineEnum({
    undefined: 0x00000000,
    compatibility: 0x00000001,
    core: 0x00000002,
    force32: 0x7FFFFFFF
});

export const WGPURequestAdapterOptionsStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['featureLevel', WGPUFeatureLevel, { optional: true }],
    ['powerPreference', PowerPreference, { optional: true }],
    ['forceFallbackAdapter', WGPUBool, { optional: true }],
    ['backendType', WGPUBackendType, { optional: true }],
    ['compatibleSurface', 'pointer', { optional: true }],
]);

export const WGPUCallbackInfoStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['mode', WGPUCallbackModeDef],
    ['callback', 'pointer'],
    ['userdata1', 'pointer', { optional: true }],
    ['userdata2', 'pointer', { optional: true }],
]);

export const WGPUChainedStructStruct = defineStruct([
    ['next', 'pointer', { optional: true }],
    ['sType', 'u32']
]);

// TODO: Align with https://gpuweb.github.io/gpuweb/#enumdef-gpufeaturename
export const WGPUFeatureNameDef = defineEnum({
    'depth-clip-control': 0x00000001,
    'depth32float-stencil8': 0x00000002,
    'timestamp-query': 0x00000003,
    'texture-compression-bc': 0x00000004,
    'texture-compression-bc-sliced-3d': 0x00000005,
    'texture-compression-etc2': 0x00000006,
    'texture-compression-astc': 0x00000007,
    'texture-compression-astc-sliced-3d': 0x00000008,
    'indirect-first-instance': 0x00000009,
    'shader-f16': 0x0000000A,
    'rg11b10ufloat-renderable': 0x0000000B,
    'bgra8unorm-storage': 0x0000000C,
    'float32-filterable': 0x0000000D,
    'float32-blendable': 0x0000000E,
    'clip-distances': 0x0000000F,
    'dual-source-blending': 0x00000010,
    'subgroups': 0x00000011,
    'core-features-and-limits': 0x00000012,
    'dawn-internal-usages': 0x00050000,
    'dawn-multi-planar-formats': 0x00050001,
    'dawn-native': 0x00050002,
    'chromium-experimental-timestamp-query-inside-passes': 0x00050003,
    'implicit-device-synchronization': 0x00050004,
    'chromium-experimental-immediate-data': 0x00050005,
    'transient-attachments': 0x00050006,
    'msaa-render-to-single-sampled': 0x00050007,
    'subgroups-f16': 0x00050008,
    'd3d11-multithread-protected': 0x00050009,
    'angle-texture-sharing': 0x0005000A,
    'pixel-local-storage-coherent': 0x0005000B,
    'pixel-local-storage-non-coherent': 0x0005000C,
    'unorm16-texture-formats': 0x0005000D,
    'snorm16-texture-formats': 0x0005000E,
    'multi-planar-format-extended-usages': 0x0005000F,
    'multi-planar-format-p010': 0x00050010,
    'host-mapped-pointer': 0x00050011,
    'multi-planar-render-targets': 0x00050012,
    'multi-planar-format-nv12a': 0x00050013,
    'framebuffer-fetch': 0x00050014,
    'buffer-map-extended-usages': 0x00050015,
    'adapter-properties-memory-heaps': 0x00050016,
    'adapter-properties-d3d': 0x00050017,
    'adapter-properties-vk': 0x00050018,
    'r8-unorm-storage': 0x00050019,
    'dawn-format-capabilities': 0x0005001A,
    'dawn-drm-format-capabilities': 0x0005001B,
    'norm16-texture-formats': 0x0005001C,
    'multi-planar-format-nv16': 0x0005001D,
    'multi-planar-format-nv24': 0x0005001E,
    'multi-planar-format-p210': 0x0005001F,
    'multi-planar-format-p410': 0x00050020,
    'shared-texture-memory-vk-dedicated-allocation': 0x00050021,
    'shared-texture-memory-a-hardware-buffer': 0x00050022,
    'shared-texture-memory-dma-buf': 0x00050023,
    'shared-texture-memory-opaque-fd': 0x00050024,
    'shared-texture-memory-zircon-handle': 0x00050025,
    'shared-texture-memory-dxgi-shared-handle': 0x00050026,
    'shared-texture-memory-d3d11-texture2d': 0x00050027,
    'shared-texture-memory-iosurface': 0x00050028,
    'shared-texture-memory-egl-image': 0x00050029,
    'shared-fence-vk-semaphore-opaque-fd': 0x0005002A,
    'shared-fence-sync-fd': 0x0005002B,
    'shared-fence-vk-semaphore-zircon-handle': 0x0005002C,
    'shared-fence-dxgi-shared-handle': 0x0005002D,
    'shared-fence-mtl-shared-event': 0x0005002E,
    'shared-buffer-memory-d3d12-resource': 0x0005002F,
    'static-samplers': 0x00050030,
    'ycbcr-vulkan-samplers': 0x00050031,
    'shader-module-compilation-options': 0x00050032,
    'dawn-load-resolve-texture': 0x00050033,
    'dawn-partial-load-resolve-texture': 0x00050034,
    'multi-draw-indirect': 0x00050035,
    'dawn-texel-copy-buffer-row-alignment': 0x00050036,
    'flexible-texture-views': 0x00050037,
    'chromium-experimental-subgroup-matrix': 0x00050038,
    'shared-fence-egl-sync': 0x00050039,
    'dawn-device-allocator-control': 0x0005003A,
    'force-32': 0x7FFFFFFF
}, 'u32');

export const WGPUTextureFormat = defineEnum({
  // Basic formats
  // Used for testing, causes uncaptured validation errors
  undefined: 0x00000000,
  
  r8unorm: 0x00000001,
  r8snorm: 0x00000002,
  r8uint: 0x00000003,
  r8sint: 0x00000004,
  r16uint: 0x00000005,
  r16sint: 0x00000006,
  r16float: 0x00000007,
  rg8unorm: 0x00000008,
  rg8snorm: 0x00000009,
  rg8uint: 0x0000000A,
  rg8sint: 0x0000000B,
  r32float: 0x0000000C,
  r32uint: 0x0000000D,
  r32sint: 0x0000000E,
  rg16uint: 0x0000000F,
  rg16sint: 0x00000010,
  rg16float: 0x00000011,

  // RGBA formats
  rgba8unorm: 0x00000012,
  "rgba8unorm-srgb": 0x00000013,
  rgba8snorm: 0x00000014,
  rgba8uint: 0x00000015,
  rgba8sint: 0x00000016,
  bgra8unorm: 0x00000017,
  "bgra8unorm-srgb": 0x00000018,
  rgb10a2uint: 0x00000019,
  rgb10a2unorm: 0x0000001A,
  rg11b10ufloat: 0x0000001B,
  rgb9e5ufloat: 0x0000001C,

  // High precision formats
  rg32float: 0x0000001D,
  rg32uint: 0x0000001E,
  rg32sint: 0x0000001F,
  rgba16uint: 0x00000020,
  rgba16sint: 0x00000021,
  rgba16float: 0x00000022,
  rgba32float: 0x00000023,
  rgba32uint: 0x00000024,
  rgba32sint: 0x00000025,

  // Depth/stencil formats
  stencil8: 0x00000026,
  depth16unorm: 0x00000027,
  depth24plus: 0x00000028,
  "depth24plus-stencil8": 0x00000029,
  depth32float: 0x0000002A,
  "depth32float-stencil8": 0x0000002B,

  // BC compressed formats
  "bc1-rgba-unorm": 0x0000002C,
  "bc1-rgba-unorm-srgb": 0x0000002D,
  "bc2-rgba-unorm": 0x0000002E,
  "bc2-rgba-unorm-srgb": 0x0000002F,
  "bc3-rgba-unorm": 0x00000030,
  "bc3-rgba-unorm-srgb": 0x00000031,
  "bc4-r-unorm": 0x00000032,
  "bc4-r-snorm": 0x00000033,
  "bc5-rg-unorm": 0x00000034,
  "bc5-rg-snorm": 0x00000035,
  "bc6h-rgb-ufloat": 0x00000036,
  "bc6h-rgb-float": 0x00000037,
  "bc7-rgba-unorm": 0x00000038,
  "bc7-rgba-unorm-srgb": 0x00000039,

  // ETC2/EAC compressed formats
  "etc2-rgb8unorm": 0x0000003A,
  "etc2-rgb8unorm-srgb": 0x0000003B,
  "etc2-rgb8a1unorm": 0x0000003C,
  "etc2-rgb8a1unorm-srgb": 0x0000003D,
  "etc2-rgba8unorm": 0x0000003E,
  "etc2-rgba8unorm-srgb": 0x0000003F,
  "eac-r11unorm": 0x00000040,
  "eac-r11snorm": 0x00000041,
  "eac-rg11unorm": 0x00000042,
  "eac-rg11snorm": 0x00000043,

  // ASTC compressed formats
  "astc-4x4-unorm": 0x00000044,
  "astc-4x4-unorm-srgb": 0x00000045,
  "astc-5x4-unorm": 0x00000046,
  "astc-5x4-unorm-srgb": 0x00000047,
  "astc-5x5-unorm": 0x00000048,
  "astc-5x5-unorm-srgb": 0x00000049,
  "astc-6x5-unorm": 0x0000004A,
  "astc-6x5-unorm-srgb": 0x0000004B,
  "astc-6x6-unorm": 0x0000004C,
  "astc-6x6-unorm-srgb": 0x0000004D,
  "astc-8x5-unorm": 0x0000004E,
  "astc-8x5-unorm-srgb": 0x0000004F,
  "astc-8x6-unorm": 0x00000050,
  "astc-8x6-unorm-srgb": 0x00000051,
  "astc-8x8-unorm": 0x00000052,
  "astc-8x8-unorm-srgb": 0x00000053,
  "astc-10x5-unorm": 0x00000054,
  "astc-10x5-unorm-srgb": 0x00000055,
  "astc-10x6-unorm": 0x00000056,
  "astc-10x6-unorm-srgb": 0x00000057,
  "astc-10x8-unorm": 0x00000058,
  "astc-10x8-unorm-srgb": 0x00000059,
  "astc-10x10-unorm": 0x0000005A,
  "astc-10x10-unorm-srgb": 0x0000005B,
  "astc-12x10-unorm": 0x0000005C,
  "astc-12x10-unorm-srgb": 0x0000005D,
  "astc-12x12-unorm": 0x0000005E,
  "astc-12x12-unorm-srgb": 0x0000005F,

  // Dawn-specific formats (0x00050000 range)
  r16unorm: 0x00050000,
  rg16unorm: 0x00050001,
  rgba16unorm: 0x00050002,
  r16snorm: 0x00050003,
  rg16snorm: 0x00050004,
  rgba16snorm: 0x00050005,
  "r8bg8-biplanar-420unorm": 0x00050006,
  "r10x6bg10x6-biplanar-420unorm": 0x00050007,
  "r8bg8a8-triplanar-420unorm": 0x00050008,
  "r8bg8-biplanar-422unorm": 0x00050009,
  "r8bg8-biplanar-444unorm": 0x0005000A,
  "r10x6bg10x6-biplanar-422unorm": 0x0005000B,
  "r10x6bg10x6-biplanar-444unorm": 0x0005000C,
  external: 0x0005000D,
} as const, 'u32');

export const WGPUWGSLLanguageFeatureNameDef = defineEnum({
    readonly_and_readwrite_storage_textures: 0x00000001,
    packed_4x8_integer_dot_product: 0x00000002,
    unrestricted_pointer_parameters: 0x00000003,
    pointer_composite_access: 0x00000004,
    sized_binding_array: 0x00000005,
    chromium_testing_unimplemented: 0x00050000,
    chromium_testing_unsafe_experimental: 0x00050001,
    chromium_testing_experimental: 0x00050002,
    chromium_testing_shipped_with_killswitch: 0x00050003,
    chromium_testing_shipped: 0x00050004,
    force_32: 0x7FFFFFFF
}, 'u32');

export const WGPUSupportedFeaturesStruct = defineStruct([
    ['featureCount', 'u64', { unpackTransform: (val: bigint) => Number(val), lengthOf: 'features' }],
    ['features', [WGPUFeatureNameDef]],
]);

export const WGPUSupportedWGSLLanguageFeaturesStruct = defineStruct([
    ['featureCount', 'u64', { unpackTransform: (val: bigint) => Number(val), lengthOf: 'features' }],
    ['features', [WGPUWGSLLanguageFeatureNameDef]],
]);

function validateMutipleOf(val: number, multipleOf: number) {
    const mod = val % multipleOf;
    if (mod !== 0) {
        throw new OperationError(`Value must be a multiple of ${multipleOf}, got ${val}`);
    }
}

function validateRange(val: number, min: number, max: number) {
    if (val < 0 || val > Number.MAX_SAFE_INTEGER) {
        throw new TypeError(`Value must be between 0 and ${Number.MAX_SAFE_INTEGER}, got ${val}`);
    }
    if (val < min || val > max) {
        throw new OperationError(`Value must be between ${min} and ${max}, got ${val}`);
    }
}

function minValidator(val: number, fieldName: string, { hints }: { hints?: { limits: GPUSupportedLimits, features: GPUSupportedFeatures } } = {}) {
    if (val < 0 || val > Number.MAX_SAFE_INTEGER) {
        throw new TypeError(`Value must be between 0 and ${Number.MAX_SAFE_INTEGER}, got ${val}`);
    }
    if (hints && fieldName in hints.limits) {
        const minValue = hints.limits[fieldName as keyof GPUSupportedLimits] as number;
        if (val < minValue) {
            throw new OperationError(`Value must be >= ${minValue}, got ${val}`);
        }
    }
}

function validateLimitField(val: number, fieldName: string, { hints }: { hints?: { limits: GPUSupportedLimits, features: GPUSupportedFeatures } } = {}) {
    if (hints && fieldName in hints.limits) {
        const maxValue = hints.limits[fieldName as keyof GPUSupportedLimits] as number;
        validateRange(val, 0, maxValue);
    }
}

// WGPULimits struct mirroring C layout
export const WGPULimitsStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['maxTextureDimension1D', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxTextureDimension1D, validate: validateLimitField }],
    ['maxTextureDimension2D', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxTextureDimension2D, validate: validateLimitField }],
    ['maxTextureDimension3D', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxTextureDimension3D, validate: validateLimitField }],
    ['maxTextureArrayLayers', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxTextureArrayLayers, validate: validateLimitField }],
    ['maxBindGroups', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxBindGroups, validate: validateLimitField }],
    ['maxBindGroupsPlusVertexBuffers', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxBindGroupsPlusVertexBuffers, validate: validateLimitField }],
    ['maxBindingsPerBindGroup', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxBindingsPerBindGroup, validate: validateLimitField }],
    ['maxDynamicUniformBuffersPerPipelineLayout', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxDynamicUniformBuffersPerPipelineLayout, validate: validateLimitField }],
    ['maxDynamicStorageBuffersPerPipelineLayout', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxDynamicStorageBuffersPerPipelineLayout, validate: validateLimitField }],
    ['maxSampledTexturesPerShaderStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxSampledTexturesPerShaderStage, validate: validateLimitField }],
    ['maxSamplersPerShaderStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxSamplersPerShaderStage, validate: validateLimitField }],
    ['maxStorageBuffersPerShaderStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageBuffersPerShaderStage, validate: validateLimitField }],
    ['maxStorageTexturesPerShaderStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageTexturesPerShaderStage, validate: validateLimitField }],
    ['maxUniformBuffersPerShaderStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxUniformBuffersPerShaderStage, validate: validateLimitField }],
    ['maxUniformBufferBindingSize', 'u64', { default: DEFAULT_SUPPORTED_LIMITS.maxUniformBufferBindingSize, validate: validateLimitField }],
    ['maxStorageBufferBindingSize', 'u64', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageBufferBindingSize, validate: validateLimitField }],
    ['minUniformBufferOffsetAlignment', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.minUniformBufferOffsetAlignment, validate: [minValidator, (val: number) => validateMutipleOf(val, 2)] }],
    ['minStorageBufferOffsetAlignment', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.minStorageBufferOffsetAlignment, validate: [minValidator, (val: number) => validateMutipleOf(val, 2)] }],
    ['maxVertexBuffers', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxVertexBuffers, validate: validateLimitField }],
    ['maxBufferSize', 'u64', { default: DEFAULT_SUPPORTED_LIMITS.maxBufferSize, validate: validateLimitField }],
    ['maxVertexAttributes', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxVertexAttributes, validate: validateLimitField }],
    ['maxVertexBufferArrayStride', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxVertexBufferArrayStride, validate: validateLimitField }],
    ['maxInterStageShaderVariables', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxInterStageShaderVariables, validate: validateLimitField }],
    ['maxColorAttachments', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxColorAttachments, validate: validateLimitField }],
    ['maxColorAttachmentBytesPerSample', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxColorAttachmentBytesPerSample, validate: validateLimitField }],
    ['maxComputeWorkgroupStorageSize', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeWorkgroupStorageSize, validate: validateLimitField }],
    ['maxComputeInvocationsPerWorkgroup', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeInvocationsPerWorkgroup, validate: validateLimitField }],
    ['maxComputeWorkgroupSizeX', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeWorkgroupSizeX, validate: validateLimitField }],
    ['maxComputeWorkgroupSizeY', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeWorkgroupSizeY, validate: validateLimitField }],
    ['maxComputeWorkgroupSizeZ', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeWorkgroupSizeZ, validate: validateLimitField }],
    ['maxComputeWorkgroupsPerDimension', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxComputeWorkgroupsPerDimension, validate: validateLimitField }],
    ['maxImmediateSize', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxImmediateSize, validate: validateLimitField }],
    ['maxStorageBuffersInVertexStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageBuffersInVertexStage, validate: validateLimitField }],
    ['maxStorageTexturesInVertexStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageTexturesInVertexStage, validate: validateLimitField }],
    ['maxStorageBuffersInFragmentStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageBuffersInFragmentStage, validate: validateLimitField }],
    ['maxStorageTexturesInFragmentStage', 'u32', { default: DEFAULT_SUPPORTED_LIMITS.maxStorageTexturesInFragmentStage, validate: validateLimitField }],
], {
    default: {
        ...DEFAULT_SUPPORTED_LIMITS,
    }
});

// Corresponding TypeScript type for convenience
export type WGPULimits = GPUSupportedLimits & {
    nextInChain?: Pointer | null;
};

// WGPUQueueDescriptor struct mirroring C layout
export type WGPUQueueDescriptor = {
    nextInChain?: Pointer | null;
    label?: string;
};
export const WGPUQueueDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
]);

// WGPUUncapturedErrorCallbackInfo + Callback FFI type
export type WGPUUncapturedErrorCallbackInfo = {
    nextInChain?: Pointer | null;
    callback: Pointer;
    userdata1?: Pointer | null;
    userdata2?: Pointer | null;
};
export const WGPUUncapturedErrorCallbackInfoStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['callback', 'pointer'],
    ['userdata1', 'pointer', { optional: true }],
    ['userdata2', 'pointer', { optional: true }],
]);

export const WGPUAdapterInfoStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['vendor', WGPUStringView],
    ['architecture', WGPUStringView],
    ['device', WGPUStringView],
    ['description', WGPUStringView],
    ['backendType', 'u32'],
    ['adapterType', 'u32'],
    ['vendorID', 'u32'],
    ['deviceID', 'u32'],
    ['subgroupMinSize', 'u32'],
    ['subgroupMaxSize', 'u32'],
]);

export const WGPUDeviceDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['requiredFeatureCount', 'u64', { lengthOf: 'requiredFeatures' }], // Assuming 64-bit size_t
    ['requiredFeatures', [WGPUFeatureNameDef], { optional: true, validate: (val: string[] | undefined, fieldName: string, { hints }: { hints?: { limits: GPUSupportedLimits, features: GPUSupportedFeatures } } = {}) => {
        if (!val) {
            return;
        }
        for (const feature of val) {
            if (!hints?.features.has(feature)) {
                throw new TypeError(`Invalid feature required: ${feature}`);
            }
        }
    } }],
    ['requiredLimits', WGPULimitsStruct, { optional: true, asPointer: true, validate: (val: WGPULimits | undefined, fieldName: string, { hints }: { hints?: { limits: GPUSupportedLimits, features: GPUSupportedFeatures } } = {}) => {
        if (!val) {
            return;
        }
        for (const key in val) {
            if (hints?.limits && !(key in hints?.limits) && val[key as keyof WGPULimits] !== undefined) {
                throw new OperationError(`Invalid limit required: ${key} ${val[key as keyof WGPULimits]}`);
            }
        }
    } }],
    ['defaultQueue', WGPUQueueDescriptorStruct],
    ['deviceLostCallbackInfo', WGPUCallbackInfoStruct, { optional: true }],
    ['uncapturedErrorCallbackInfo', WGPUUncapturedErrorCallbackInfoStruct],
]);

export const WGPUBufferDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['usage', 'u64'],
    ['size', 'u64'],
    ['mappedAtCreation', WGPUBool, { default: false }],
]);

export function normalizeGPUExtent3DStrict(size: GPUExtent3DStrict): { width: number; height?: number; depthOrArrayLayers?: number } {
    if (Symbol.iterator in size) {
        const arr = Array.from(size);
        return {
            width: arr[0] ?? 1,
            height: arr[1] ?? 1,
            depthOrArrayLayers: arr[2] ?? 1
        };
    }
    return size;
}

export const WGPUExtent3DStruct = defineStruct([
    ['width', 'u32'],
    ['height', 'u32', { default: 1 }],
    ['depthOrArrayLayers', 'u32', { default: 1 }],
], {
    mapValue: (v: GPUExtent3DStrict) => {
        return normalizeGPUExtent3DStrict(v);
    }
});

export const WGPUTextureDimension = defineEnum({
    undefined: 0,
    "1d": 1,
    "2d": 2,
    "3d": 3,
    "force-32": 0x7FFFFFFF
});
export const WGPUTextureDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['usage', 'u64'],
    ['dimension', WGPUTextureDimension, { default: '2d' }],
    ['size', WGPUExtent3DStruct],
    ['format', WGPUTextureFormat, { default: 'rgba8unorm' }],
    ['mipLevelCount', 'u32', { default: 1 }],
    ['sampleCount', 'u32', { default: 1 }],
    ['viewFormatCount', 'u64', { lengthOf: 'viewFormats' }],
    ['viewFormats', [WGPUTextureFormat], { optional: true }],
]);

export const WGPUFilterMode = defineEnum({
    undefined: 0,
    nearest: 1,
    linear: 2,
    "force-32": 0x7FFFFFFF
});

export const WGPUMipmapFilterMode = defineEnum({
    undefined: 0,
    nearest: 1,
    linear: 2,
    "force-32": 0x7FFFFFFF
});

export const WGPUAddressMode = defineEnum({
    undefined: 0,
    'clamp-to-edge': 1,
    repeat: 2,
    'mirror-repeat': 3,
    "force-32": 0x7FFFFFFF
});

export const WGPUSamplerDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['addressModeU', WGPUAddressMode, { default: 'undefined' }],
    ['addressModeV', WGPUAddressMode, { default: 'undefined' }],
    ['addressModeW', WGPUAddressMode, { default: 'undefined' }],
    ['magFilter', WGPUFilterMode, { default: 'undefined' }],
    ['minFilter', WGPUFilterMode, { default: 'undefined' }],
    ['mipmapFilter', WGPUMipmapFilterMode, { default: 'undefined' }],
    ['lodMinClamp', 'f32', { default: 0.0 }],
    ['lodMaxClamp', 'f32', { default: 32.0 }],
    ['compare', WGPUCompareFunction, { default: 'undefined' }],
    ['maxAnisotropy', 'u16', { default: 1, packTransform: (val: number) => val < 0 ? 0 : val  }],
]);

export const WGPUBufferBindingType = defineEnum({
    "binding-not-used": 0,
    undefined: 1,
    uniform: 2,
    storage: 3,
    "read-only-storage": 4,
});

export const WGPUSamplerBindingType = defineEnum({
    "binding-not-used": 0,
    undefined: 1,
    filtering: 2,
    "non-filtering": 3,
    comparison: 4,
});

export const WGPUTextureSampleType = defineEnum({
    "binding-not-used": 0,
    undefined: 1,
    float: 2,
    "unfilterable-float": 3,
    depth: 4,
    sint: 5,
    uint: 6,
});

export const WGPUTextureViewDimension = defineEnum({
    "undefined": 0,
    "1d": 1,
    "2d": 2,
    "2d-array": 3,
    cube: 4,
    "cube-array": 5,
    "3d": 6,
});

export const WGPUStorageTextureAccess = defineEnum({
    "binding-not-used": 0,
    undefined: 1,
    "write-only": 2,
    "read-only": 3,
    "read-write": 4,
});

export const WGPUBufferBindingLayoutStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['type', WGPUBufferBindingType, { default: 'uniform' }],
    ['hasDynamicOffset', WGPUBool, { default: false }],
    ['minBindingSize', 'u64', { default: 0 }],
]);

export const WGPUSamplerBindingLayoutStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['type', WGPUSamplerBindingType, { default: 'filtering' }],
]);

export const WGPUTextureBindingLayoutStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['sampleType', WGPUTextureSampleType, { default: 'float' }],
    ['viewDimension', WGPUTextureViewDimension, { default: '2d' }],
    ['multisampled', WGPUBool, { default: false }],
]);

export const WGPUStorageTextureBindingLayoutStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['access', WGPUStorageTextureAccess, { default: 'write-only' }],
    ['format', WGPUTextureFormat, { default: 'rgba8unorm' }],
    ['viewDimension', WGPUTextureViewDimension, { default: '2d' }],
]);

export const WGPUTextureAspect = defineEnum({
    undefined: 0,
    all: 1,
    "stencil-only": 2,
    "depth-only": 3,
    "plane-0-only": 0x00050000, // Dawn specific?
    "plane-1-only": 0x00050001, // Dawn specific?
    "plane-2-only": 0x00050002, // Dawn specific?
    "force-32": 0x7FFFFFFF // Ensure correct name 'force-32' if needed
}, 'u32');

export const WGPUTextureViewDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['format', WGPUTextureFormat, { default: 'undefined' }],
    ['dimension', WGPUTextureViewDimension, { default: 'undefined' }],
    ['baseMipLevel', 'u32', { default: 0 }],
    ['mipLevelCount', 'u32', { default: 0xFFFFFFFF }], // WGPU_MIP_LEVEL_COUNT_UNDEFINED
    ['baseArrayLayer', 'u32', { default: 0 }],
    ['arrayLayerCount', 'u32', { default: 0xFFFFFFFF }], // WGPU_ARRAY_LAYER_COUNT_UNDEFINED
    ['aspect', WGPUTextureAspect, { default: 'all' }], // Default 'all' is more useful than 'undefined'
    ['usage', 'u64', { default: 0n }], // WGPUTextureUsage_None - C definition uses flags (u64)
]);

export const WGPUExternalTextureBindingLayoutStruct = defineStruct([
    ['chain', WGPUChainedStructStruct],
]);

export const WGPUBindGroupLayoutEntryStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['binding', 'u32'],
    ['visibility', 'u64'],
    // Weird
    // Using the CI build this manual alignment is not necessary,
    // but for a local build it is. Need to check the gcc/g++ versions and what causes the mismatch.
    // ['_alignment0', 'u64', { default: 0, condition: () => process.platform === 'linux' }],
    ['buffer', WGPUBufferBindingLayoutStruct, { optional: true }],
    ['sampler', WGPUSamplerBindingLayoutStruct, { optional: true }],
    ['texture', WGPUTextureBindingLayoutStruct, { optional: true }],
    ['storageTexture', WGPUStorageTextureBindingLayoutStruct, { optional: true }],
]);

export const WGPUBindGroupLayoutDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['entryCount', 'u64', { lengthOf: 'entries' }],
    ['entries', [WGPUBindGroupLayoutEntryStruct]],
]);

export const WGPUBindGroupEntryStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['binding', 'u32'],
    ['buffer', objectPtr<GPUBuffer>(), { optional: true }],
    ['offset', 'u64', { optional: true }], // Optional because only relevant for buffers
    ['size', 'u64', { optional: true }],   // Optional because only relevant for buffers
    ['sampler', objectPtr<GPUSampler>(), { optional: true }],
    ['textureView', objectPtr<GPUTextureView>(), { optional: true }],
]);

export const WGPUBindGroupDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['layout', objectPtr<GPUBindGroupLayout>()],
    ['entryCount', 'u64', { lengthOf: 'entries' }],
    ['entries', [WGPUBindGroupEntryStruct]],
]);

export const WGPUPipelineLayoutDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['bindGroupLayoutCount', 'u64', { lengthOf: 'bindGroupLayouts' }],
    ['bindGroupLayouts', ['pointer']],
    ['immediateSize', 'u32', { default: 0 }]
]);

// Pack shader module descriptor
export const WGPUShaderModuleDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }]
]);

// For WGSL shader source
export const WGPUShaderSourceWGSLStruct = defineStruct([
    ['chain', WGPUChainedStructStruct],
    ['code', WGPUStringView]
]);

// --- Render Pipeline Structs ---

export const WGPUVertexStepMode = defineEnum({
    undefined: 0,
    vertex: 1,
    instance: 2,
});

export const WGPUPrimitiveTopology = defineEnum({
    undefined: 0,
    "point-list": 1,
    "line-list": 2,
    "line-strip": 3,
    "triangle-list": 4,
    "triangle-strip": 5,
});

export const WGPUIndexFormat = defineEnum({
    undefined: 0,
    uint16: 1,
    uint32: 2,
});

export const WGPUFrontFace = defineEnum({
    undefined: 0,
    ccw: 1,
    cw: 2,
});

export const WGPUCullMode = defineEnum({
    undefined: 0,
    none: 1,
    front: 2,
    back: 3,
});

export const WGPUStencilOperation = defineEnum({
    undefined: 0,
    keep: 1,
    zero: 2,
    replace: 3,
    invert: 4,
    "increment-clamp": 5,
    "decrement-clamp": 6,
    "increment-wrap": 7,
    "decrement-wrap": 8,
});

export const WGPUBlendOperation = defineEnum({
    undefined: 0,
    add: 1,
    subtract: 2,
    "reverse-subtract": 3,
    min: 4,
    max: 5,
});

export const WGPUBlendFactor = defineEnum({
    undefined: 0,
    zero: 1,
    one: 2,
    src: 3,
    "one-minus-src": 4,
    "src-alpha": 5,
    "one-minus-src-alpha": 6,
    dst: 7,
    "one-minus-dst": 8,
    "dst-alpha": 9,
    "one-minus-dst-alpha": 10,
    "src-alpha-saturated": 11,
    constant: 12,
    "one-minus-constant": 13,
    src1: 14, // Requires DualSourceBlending feature
    "one-minus-src1": 15, // Requires DualSourceBlending feature
    "src1-alpha": 16, // Requires DualSourceBlending feature
    "one-minus-src1-alpha": 17, // Requires DualSourceBlending feature
});

// WGPUColorWriteMask flags (using u64 for flags)
export const WGPUColorWriteMask = {
    None: 0x0000000000000000n,
    Red: 0x0000000000000001n,
    Green: 0x0000000000000002n,
    Blue: 0x0000000000000004n,
    Alpha: 0x0000000000000008n,
    All: 0x000000000000000Fn,
} as const;

// Note: This enum is not used in the C struct definition, but is part of the JS API
export const WGPUOptionalBool = defineEnum({
    False: 0,
    True: 1,
    Undefined: 2, // This might need mapping depending on how bools are handled (0/1 vs specific enum)
});

// @ts-ignore TODO: Add missing formats from webgpu.h
export const WGPUVertexFormat = defineEnum({
    "uint8": 0x00000001,
    "uint8x2": 0x00000002,
    "uint8x4": 0x00000003,
    "sint8": 0x00000004,
    "sint8x2": 0x00000005,
    "sint8x4": 0x00000006,
    "unorm8": 0x00000007,
    "unorm8x2": 0x00000008,
    "unorm8x4": 0x00000009,
    "snorm8": 0x0000000A,
    "snorm8x2": 0x0000000B,
    "snorm8x4": 0x0000000C,
    "uint16": 0x0000000D,
    "uint16x2": 0x0000000E,
    "uint16x4": 0x0000000F,
    "sint16": 0x00000010,
    "sint16x2": 0x00000011,
    "sint16x4": 0x00000012,
    "unorm16": 0x00000013,
    "unorm16x2": 0x00000014,
    "unorm16x4": 0x00000015,
    "snorm16": 0x00000016,
    "snorm16x2": 0x00000017,
    "snorm16x4": 0x00000018,
    "float16": 0x00000019,
    "float16x2": 0x0000001A,
    "float16x4": 0x0000001B,
    "float32": 0x0000001C,
    "float32x2": 0x0000001D,
    "float32x3": 0x0000001E,
    "float32x4": 0x0000001F,
    "uint32": 0x00000020,
    "uint32x2": 0x00000021,
    "uint32x3": 0x00000022,
    "uint32x4": 0x00000023,
    "sint32": 0x00000024,
    "sint32x2": 0x00000025,
    "sint32x3": 0x00000026,
    "sint32x4": 0x00000027,
    "unorm10-10-10-2": 0x00000028,
    "unorm8x4-bgra": 0x00000029,
    "force32": 0x7FFFFFFF
}, 'u32');


// -- Nested Structs needed for Render Pipeline --

export const WGPUConstantEntryStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['key', WGPUStringView],
    ['value', 'f64', { validate: (val: number) => {
        if (!Number.isFinite(val)) {
            throw new TypeError(`Pipeline constant value must be finite, got ${val}`);
        }
    } }]
]);

export const WGPUVertexAttributeStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['format', WGPUVertexFormat],
    ['offset', 'u64'],
    ['shaderLocation', 'u32']
]);

export const WGPUVertexBufferLayoutStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['stepMode', WGPUVertexStepMode, { default: 'vertex' }],
    ['arrayStride', 'u64'],
    ['attributeCount', 'u64', { lengthOf: 'attributes' }],
    ['attributes', [WGPUVertexAttributeStruct]] // Pointer to array
]);

export const WGPUVertexStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['module', objectPtr<GPUShaderModule>()],
    ['entryPoint', WGPUStringView, { optional: true, mapOptionalInline: true }],
    ['constantCount', 'u64', { lengthOf: 'constants' }],
    ['constants', [WGPUConstantEntryStruct], { optional: true }],
    ['bufferCount', 'u64', { lengthOf: 'buffers' }],
    ['buffers', [WGPUVertexBufferLayoutStruct], { optional: true }]
]);

export const WGPUPrimitiveStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['topology', WGPUPrimitiveTopology, { default: 'triangle-list' }],
    ['stripIndexFormat', WGPUIndexFormat, { default: 'undefined' }], // Defaults to Undefined (0)
    ['frontFace', WGPUFrontFace, { default: 'ccw' }],
    ['cullMode', WGPUCullMode, { default: 'none' }],
    ['unclippedDepth', WGPUBool, { optional: true }]
]);

export const WGPUStencilFaceStateStruct = defineStruct([
    ['compare', WGPUCompareFunction, { default: 'always' }],
    ['failOp', WGPUStencilOperation, { default: 'keep' }],
    ['depthFailOp', WGPUStencilOperation, { default: 'keep' }],
    ['passOp', WGPUStencilOperation, { default: 'keep' }]
]);

export const WGPUDepthStencilStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['format', WGPUTextureFormat],
    ['depthWriteEnabled', WGPUBool, { default: false }],
    ['depthCompare', WGPUCompareFunction, { default: 'always' }],
    ['stencilFront', WGPUStencilFaceStateStruct, { default: {} }], // Inline struct
    ['stencilBack', WGPUStencilFaceStateStruct, { default: {} }], // Inline struct
    ['stencilReadMask', 'u32', { default: 0xFFFFFFFF }],
    ['stencilWriteMask', 'u32', { default: 0xFFFFFFFF }],
    ['depthBias', 'i32', { default: 0 }], // Use i32
    ['depthBiasSlopeScale', 'f32', { default: 0.0 }],
    ['depthBiasClamp', 'f32', { default: 0.0 }]
]);

export const WGPUMultisampleStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['count', 'u32', { default: 1 }],
    ['mask', 'u32', { default: 0xFFFFFFFF }],
    ['alphaToCoverageEnabled', WGPUBool, { default: false }] // Use u8 for WGPUBool
]);

export const WGPUBlendComponentStruct = defineStruct([
    ['operation', WGPUBlendOperation, { default: 'add' }],
    ['srcFactor', WGPUBlendFactor, { default: 'one' }],
    ['dstFactor', WGPUBlendFactor, { default: 'zero' }]
]);

export const WGPUBlendStateStruct = defineStruct([
    ['color', WGPUBlendComponentStruct], // Inline struct
    ['alpha', WGPUBlendComponentStruct] // Inline struct
]);

export const WGPUColorTargetStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['format', WGPUTextureFormat],
    ['blend', WGPUBlendStateStruct, { optional: true, asPointer: true }],
    ['writeMask', 'u64', { default: WGPUColorWriteMask.All }] // Use u64 for flags
]);

export const WGPUFragmentStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['module', objectPtr<GPUShaderModule>()],
    ['entryPoint', WGPUStringView, { optional: true, mapOptionalInline: true }],
    ['constantCount', 'u64', { lengthOf: 'constants' }],
    ['constants', [WGPUConstantEntryStruct], { optional: true }],
    ['targetCount', 'u64', { lengthOf: 'targets' }],
    ['targets', [WGPUColorTargetStateStruct]]
]);

// -- Finally, the Render Pipeline Descriptor --

export const WGPURenderPipelineDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['layout', objectPtr<GPUPipelineLayout>(), { optional: true }],
    ['vertex', WGPUVertexStateStruct], // Inline struct
    ['primitive', WGPUPrimitiveStateStruct, { default: {} }], // Inline struct
    ['depthStencil', WGPUDepthStencilStateStruct, { optional: true, asPointer: true }],
    ['multisample', WGPUMultisampleStateStruct, { default: {} }], // Inline struct
    ['fragment', WGPUFragmentStateStruct, { optional: true, asPointer: true }]
]);

// --- Compute Pipeline Structs ---

export const WGPUComputeStateStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['module', objectPtr<GPUShaderModule>()],
    ['entryPoint', WGPUStringView, { optional: true, mapOptionalInline: true }],
    ['constantCount', 'u64', { lengthOf: 'constants' }],
    ['constants', [WGPUConstantEntryStruct], { optional: true }],
]);

export const WGPUComputePipelineDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['layout', objectPtr<GPUPipelineLayout>(), { optional: true }],
    ['compute', WGPUComputeStateStruct],
]);

// Structs for Command Encoder
export const WGPUCommandEncoderDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }]
]);

export const WGPULoadOp = defineEnum({
    undefined: 0,
    load: 1,
    clear: 2,
    "expand-resolve-texture": 0x00050003 // Dawn specific?
}, 'u32');

export const WGPUStoreOp = defineEnum({
    undefined: 0,
    store: 1,
    discard: 2,
}, 'u32');

export const WGPUColorStruct = defineStruct([
    ['r', 'f64'],
    ['g', 'f64'],
    ['b', 'f64'],
    ['a', 'f64'],
], {
    default: { r: 0, g: 0, b: 0, a: 0 },
    mapValue: (v?: GPUColor) => {
        if (!v) return null; // Handle null case explicitly
        const clearValue = v ?? { r: 0, g: 0, b: 0, a: 0 };
        let mappedClearValue = { r: 0, g: 0, b: 0, a: 0 };
        if (typeof clearValue === 'object' && 'r' in clearValue) {
            mappedClearValue = clearValue as {r: number, g: number, b: number, a: number};
        } else if (Array.isArray(clearValue)) {
            mappedClearValue = { r: clearValue[0]!, g: clearValue[1]!, b: clearValue[2]!, a: clearValue[3]! };
        }
        return mappedClearValue;
    }
});

export const WGPUOrigin3DStruct = defineStruct([
    ['x', 'u32', { default: 0 }],
    ['y', 'u32', { default: 0 }],
    ['z', 'u32', { default: 0 }],
], {
    mapValue: (v: GPUOrigin3D) => {
        if (Symbol.iterator in v) {
            const arr = Array.from(v);
            return {
                x: arr[0] ?? 0,
                y: arr[1] ?? 0,
                z: arr[2] ?? 0
            };
        }
        return v;
    }
});

export const WGPURenderPassColorAttachmentStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['view', objectPtr<GPUTextureView>()], // Can be null in JS API, but C expects a valid pointer or error
    ['depthSlice', 'u32', { default: 0xFFFFFFFF }], // WGPU_DEPTH_SLICE_UNDEFINED
    ['resolveTarget', objectPtr<GPUTextureView>(), { optional: true }],
    ['loadOp', WGPULoadOp],
    ['storeOp', WGPUStoreOp],
    ['clearValue', WGPUColorStruct, { default: { r: 0, g: 0, b: 0, a: 0 } }],
]);


export const WGPURenderPassDepthStencilAttachmentStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['view', objectPtr<GPUTextureView>()],
    ['depthLoadOp', WGPULoadOp, { optional: true }], // Optional because only needed if format has depth
    ['depthStoreOp', WGPUStoreOp, { optional: true }], // Optional
    ['depthClearValue', 'f32', { default: NaN }], // WGPU_DEPTH_CLEAR_VALUE_UNDEFINED -> use NaN
    ['depthReadOnly', WGPUBool, { default: false }],
    ['stencilLoadOp', WGPULoadOp, { optional: true }], // Optional because only needed if format has stencil
    ['stencilStoreOp', WGPUStoreOp, { optional: true }], // Optional
    ['stencilClearValue', 'u32', { default: 0 }],
    ['stencilReadOnly', WGPUBool, { default: false }],
]);

export const WGPUPassTimestampWritesStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['querySet', objectPtr<GPUQuerySet>()],
    ['beginningOfPassWriteIndex', 'u32', { default: 0xFFFFFFFF }], // WGPU_QUERY_SET_INDEX_UNDEFINED
    ['endOfPassWriteIndex', 'u32', { default: 0xFFFFFFFF }], // WGPU_QUERY_SET_INDEX_UNDEFINED
]);

export const WGPURenderPassDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['colorAttachmentCount', 'u64', { lengthOf: 'colorAttachments' }],
    ['colorAttachments', [WGPURenderPassColorAttachmentStruct], { optional: true }],
    ['depthStencilAttachment', WGPURenderPassDepthStencilAttachmentStruct, { optional: true, asPointer: true }],
    ['occlusionQuerySet', objectPtr<GPUQuerySet>(), { optional: true }],
    ['timestampWrites', WGPUPassTimestampWritesStruct, { optional: true, asPointer: true }],
]);

export const WGPUComputePassDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['timestampWrites', WGPUPassTimestampWritesStruct, { optional: true, asPointer: true }],
]);

export const WGPUTexelCopyBufferLayoutStruct = defineStruct([
    ['offset', 'u64', { default: 0 }],
    ['bytesPerRow', 'u32', { default: 0xFFFFFFFF }], // WGPU_COPY_STRIDE_UNDEFINED
    ['rowsPerImage', 'u32', { default: 0xFFFFFFFF }], // WGPU_COPY_STRIDE_UNDEFINED
]);

export const WGPUTexelCopyBufferInfoStruct = defineStruct([
    ['layout', WGPUTexelCopyBufferLayoutStruct], // Nested struct
    ['buffer', objectPtr<GPUBuffer>()],
], {
    // Map the JS GPUTexelCopyBufferInfo to the nested structure
    mapValue: (v: GPUTexelCopyBufferInfo) => ({
        layout: {
            offset: v.offset ?? 0,
            bytesPerRow: v.bytesPerRow,
            rowsPerImage: v.rowsPerImage
        },
        buffer: v.buffer
    })
});

export const WGPUTexelCopyTextureInfoStruct = defineStruct([
    ['texture', objectPtr<GPUTexture>()],
    ['mipLevel', 'u32', { default: 0 }],
    ['origin', WGPUOrigin3DStruct, { default: { x:0, y:0, z:0 } }],
    ['aspect', WGPUTextureAspect, { default: 'all' }],
]);

export const WGPUCommandBufferDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
]);

export const WGPUQueryType = defineEnum({
    occlusion: 1,
    timestamp: 2,
}, 'u32');

export const WGPUQuerySetDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['type', WGPUQueryType],
    ['count', 'u32'],
]);

// --- Workaround Structs ---

export const ZWGPUWorkaroundCopyTextureAndMapStruct = defineStruct([
    ['device', 'pointer'],
    ['queue', 'pointer'],
    ['instance', 'pointer'],
    ['render_texture', 'pointer'],
    ['readback_buffer', 'pointer'],
    ['bytes_per_row', 'u32'],
    ['width', 'u32'],
    ['height', 'u32'],
    ['output_buffer', 'pointer'],
    ['buffer_size', 'u64'],
]);

export const WGPURenderBundleDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
]);

export const WGPURenderBundleEncoderDescriptorStruct = defineStruct([
    ['nextInChain', 'pointer', { optional: true }],
    ['label', WGPUStringView, { optional: true }],
    ['colorFormatCount', 'u64', { lengthOf: 'colorFormats' }],
    ['colorFormats', [WGPUTextureFormat]],
    ['depthStencilFormat', WGPUTextureFormat, { default: 'undefined' }],
    ['sampleCount', 'u32', { default: 1 }],
    ['depthReadOnly', WGPUBool, { default: false }],
    ['stencilReadOnly', WGPUBool, { default: false }],
]);
