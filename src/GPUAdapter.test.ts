import { expect, describe, it, beforeAll, afterAll } from "bun:test"
import { createGPUInstance } from "./index"
import type { GPUImpl } from "./GPU"
import type { GPUAdapterImpl } from "./GPUAdapter" // Import implementation for testing cache

// Global variables for the test suite
let gpu: GPUImpl | null = null
let adapter: GPUAdapter | null = null

describe("GPUAdapter", () => {
  // --- Setup and Teardown ---
  beforeAll(async () => {
    try {
      gpu = createGPUInstance()
      if (!gpu) throw new Error("Test Setup Failed: Could not create GPU instance.")
      adapter = await gpu.requestAdapter()
      if (!adapter) throw new Error(`Test Setup Failed: Could not request adapter.`)
    } catch (e) {
      console.error("Error during GPUAdapter Test Setup:", e)
      // Cleanup if setup fails partially
      if (adapter && "destroy" in adapter) (adapter as any).destroy() // Assuming destroy exists
      gpu?.destroy()
      throw e
    }
  })

  afterAll(() => {
    if (adapter && "destroy" in adapter) {
      ;(adapter as any).destroy()
    }
    adapter = null
    gpu?.destroy()
    gpu = null
  })

  // --- Tests ---

  describe("features", () => {
    it("should return a non-empty set of features", () => {
      expect(adapter).not.toBeNull()
      const features = adapter!.features

      expect(features).toBeInstanceOf(Set)
      // Most adapters should have at least one feature.
      // If running on a very minimal system (like CI with software rendering),
      // this might need adjustment, but generally it's a good sanity check.
      expect(features.size).toBeGreaterThan(0)

      console.log("Adapter Features Found:", Array.from(features).join(", "))
    })

    it("should return the same cached set on subsequent calls", () => {
      expect(adapter).not.toBeNull()
      const features1 = adapter!.features
      const features2 = adapter!.features

      expect(features1).toBe(features2) // Should be strictly equal due to caching
    })

    it("should return an empty set after adapter is destroyed and features were previously accessed", async () => {
      expect(gpu).not.toBeNull()
      const tempAdapter = await gpu!.requestAdapter()
      expect(tempAdapter).not.toBeNull()
      tempAdapter!.features // Populate cache
      ;(tempAdapter as GPUAdapterImpl).destroy()
      const featuresAfterDestroy = tempAdapter!.features
      expect(featuresAfterDestroy).toBeInstanceOf(Set)
      expect(featuresAfterDestroy.size).toBe(0)
    })
  })

  describe("limits", () => {
    it("should return a valid GPUSupportedLimits object", () => {
      expect(adapter).not.toBeNull()
      const limits = adapter!.limits

      expect(limits).not.toBeNull()
      expect(limits.__brand).toBe("GPUSupportedLimits")
      // Check a few key properties to ensure it's populated
      expect(typeof limits.maxTextureDimension2D).toBe("number")
      expect(limits.maxTextureDimension2D).toBeGreaterThanOrEqual(0)
      expect(typeof limits.maxUniformBufferBindingSize).toBe("number")
      expect(limits.maxUniformBufferBindingSize).toBeGreaterThanOrEqual(0)

      // console.log("Adapter Limits Found:", limits);
    })

    it("should return the same cached object on subsequent calls", () => {
      expect(adapter).not.toBeNull()
      const limits1 = adapter!.limits
      const limits2 = adapter!.limits

      expect(limits1).toBe(limits2) // Should be strictly equal due to caching
    })

    it("should preserve fetched limits after adapter is destroyed if already cached", async () => {
      expect(gpu).not.toBeNull()
      const tempAdapter = await gpu!.requestAdapter()
      expect(tempAdapter).not.toBeNull()
      const limitsBeforeDestroy = tempAdapter!.limits // Populate cache before destroying

      // Temporarily store the adapter to destroy and then re-fetch to test destruction path
      const adapterToDestroy = tempAdapter as GPUAdapterImpl
      adapterToDestroy.destroy()

      const limitsAfterDestroy = adapterToDestroy.limits
      expect(limitsAfterDestroy).not.toBeNull()
      expect(limitsAfterDestroy.__brand).toBe("GPUSupportedLimits")
      expect(limitsAfterDestroy.maxTextureDimension2D).toBe(limitsBeforeDestroy.maxTextureDimension2D)
    })

    it("should return default limits after adapter is destroyed and limits were NOT previously accessed", async () => {
      expect(gpu).not.toBeNull()
      const tempAdapter = await gpu!.requestAdapter()
      expect(tempAdapter).not.toBeNull()
      // Do not access adapter!.limits before destroy() here

      const adapterToDestroy = tempAdapter as GPUAdapterImpl
      adapterToDestroy.destroy()

      const limitsAfterDestroy = adapterToDestroy.limits
      expect(limitsAfterDestroy).not.toBeNull()
      expect(limitsAfterDestroy.__brand).toBe("GPUSupportedLimits")
      expect(limitsAfterDestroy.maxTextureDimension2D).toBeGreaterThan(0)
    })
  })

  // TODO: Add tests for info, isFallbackAdapter
})
