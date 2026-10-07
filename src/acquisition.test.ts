import { expect, describe, it } from "bun:test"
import { createGPUInstance } from "./index.js"

// A packed descriptor is a graph of ArrayBuffers addressed only by raw pointers. If GC reclaims part
// of it before the native call reads it, the device comes back with features or limits that differ
// from the request.
// Standard WebGPU names only: Dawn's internal shared-fence features are mutually exclusive.
const STANDARD = new Set([
  "core-features-and-limits",
  "depth-clip-control",
  "depth32float-stencil8",
  "texture-compression-bc",
  "texture-compression-bc-sliced-3d",
  "texture-compression-etc2",
  "texture-compression-astc",
  "texture-compression-astc-sliced-3d",
  "timestamp-query",
  "indirect-first-instance",
  "shader-f16",
  "rg11b10ufloat-renderable",
  "bgra8unorm-storage",
  "float32-filterable",
  "float32-blendable",
  "clip-distances",
  "dual-source-blending",
  "subgroups",
  "texture-formats-tier1",
  "texture-formats-tier2",
  "primitive-index",
])

describe("acquisition ownership", () => {
  it("keeps twenty forced-GC device descriptors intact", async () => {
    const gpu = createGPUInstance()
    try {
      for (let i = 0; i < 20; i++) {
        const adapter = (await gpu.requestAdapter())!
        expect(adapter).not.toBeNull()
        const lib = (adapter as any).lib
        const native = lib.wgpuAdapterRequestDevice
        lib.wgpuAdapterRequestDevice = (...args: unknown[]) => {
          Bun.gc(true)
          for (let j = 0; j < 64; j++) new Uint8Array(4096).fill(0xff)
          return native(...args)
        }
        const requiredFeatures = [...adapter.features].filter((name) => STANDARD.has(name)) as GPUFeatureName[]
        // Every field, so no default can exceed an adapter limit.
        const requiredLimits: Record<string, number> = {}
        for (const name in adapter.limits) {
          const value = adapter.limits[name as keyof GPUSupportedLimits]
          if (typeof value === "number") requiredLimits[name] = value
        }
        let device: GPUDevice
        try {
          device = await adapter.requestDevice({ label: `drift-${i}`, requiredFeatures, requiredLimits })
        } finally {
          lib.wgpuAdapterRequestDevice = native
        }
        try {
          expect([...device.features].sort()).toEqual([...requiredFeatures].sort())
          for (const [name, value] of Object.entries(requiredLimits)) {
            expect(device.limits[name as keyof GPUSupportedLimits]).toBe(value)
          }
        } finally {
          device.destroy()
          adapter.destroy()
        }
      }
    } finally {
      gpu.destroy()
    }
  }, 60000)
})
