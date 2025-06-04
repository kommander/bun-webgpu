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

export const GPUShaderStage: GPUShaderStage = {
  VERTEX: 1 << 0,
  FRAGMENT: 1 << 1,
  COMPUTE: 1 << 2,
} as const;

global.GPUMapMode = {
  READ: 1 << 0,
  WRITE: 1 << 1,
} as const;

export const DEFAULT_SUPPORTED_LIMITS: GPUSupportedLimits = Object.freeze({
  __brand: "GPUSupportedLimits",
  maxTextureDimension1D: 0,
  maxTextureDimension2D: 0,
  maxTextureDimension3D: 0,
  maxTextureArrayLayers: 0,
  maxBindGroups: 0,
  maxBindGroupsPlusVertexBuffers: 0,
  maxBindingsPerBindGroup: 0,
  maxDynamicUniformBuffersPerPipelineLayout: 0,
  maxDynamicStorageBuffersPerPipelineLayout: 0,
  maxSampledTexturesPerShaderStage: 0,
  maxSamplersPerShaderStage: 0,
  maxStorageBuffersPerShaderStage: 0,
  maxStorageTexturesPerShaderStage: 0,
  maxUniformBuffersPerShaderStage: 0,
  maxUniformBufferBindingSize: 0,
  maxStorageBufferBindingSize: 0,
  minUniformBufferOffsetAlignment: 0,
  minStorageBufferOffsetAlignment: 0,
  maxVertexBuffers: 0,
  maxBufferSize: 0,
  maxVertexAttributes: 0,
  maxVertexBufferArrayStride: 0,
  maxInterStageShaderComponents: 0,
  maxInterStageShaderVariables: 0,
  maxColorAttachments: 0,
  maxColorAttachmentBytesPerSample: 0,
  maxComputeWorkgroupStorageSize: 0,
  maxComputeInvocationsPerWorkgroup: 0,
  maxComputeWorkgroupSizeX: 0,
  maxComputeWorkgroupSizeY: 0,
  maxComputeWorkgroupSizeZ: 0,
  maxComputeWorkgroupsPerDimension: 0,
});