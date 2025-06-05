export const TextureUsageFlags = {
  COPY_SRC: 1 << 0,
  COPY_DST: 1 << 1,
  TEXTURE_BINDING: 1 << 2,
  STORAGE_BINDING: 1 << 3,
  RENDER_ATTACHMENT: 1 << 4,
  TRANSIENT_ATTACHMENT: 1 << 5, 
} as const;

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

export const ShaderStageFlags = {
  VERTEX: 1 << 0,
  FRAGMENT: 1 << 1,
  COMPUTE: 1 << 2,
} as const;

export const MapModeFlags = {
  READ: 1 << 0,
  WRITE: 1 << 1,
} as const;
