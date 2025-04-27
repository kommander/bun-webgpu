import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { createGPUInstance } from "./index";
import type { GPUImpl } from "./GPU";
import type { GPUAdapterImpl } from "./GPUAdapter"; // Import implementation for testing cache

// Global variables for the test suite
let gpu: GPUImpl | null = null;
let adapter: GPUAdapter | null = null;


describe("GPUAdapter", () => {

    // --- Setup and Teardown --- 
    beforeAll(async () => {
        try {
            gpu = createGPUInstance();
            if (!gpu) throw new Error("Test Setup Failed: Could not create GPU instance.");
            adapter = await gpu.requestAdapter();
            if (!adapter) throw new Error(`Test Setup Failed: Could not request adapter.`);
        } catch (e) {
            console.error("Error during GPUAdapter Test Setup:", e);
            // Cleanup if setup fails partially
            if (adapter && 'destroy' in adapter) (adapter as any).destroy(); // Assuming destroy exists
            gpu?.destroy();
            throw e; 
        }
    });

    afterAll(() => {
        if (adapter && 'destroy' in adapter) {
             (adapter as any).destroy();
        }
        adapter = null;
        gpu?.destroy();
        gpu = null;
    });

    // --- Tests --- 

    describe("features", () => {
        it("should return a non-empty set of features", () => {
            expect(adapter).not.toBeNull();
            const features = adapter!.features;

            expect(features).toBeInstanceOf(Set);
            // Most adapters should have at least one feature.
            // If running on a very minimal system (like CI with software rendering),
            // this might need adjustment, but generally it's a good sanity check.
            expect(features.size).toBeGreaterThan(0); 

            console.log("Adapter Features Found:", Array.from(features).join(', '));
        });

        it("should return the same cached set on subsequent calls", () => {
            expect(adapter).not.toBeNull();
            const features1 = adapter!.features;
            const features2 = adapter!.features;

            expect(features1).toBe(features2); // Should be strictly equal due to caching
        });

        it("should return an empty set after adapter is destroyed", () => {
             expect(adapter).not.toBeNull();
             const featuresBeforeDestroy = adapter!.features; // Populate cache
             expect(featuresBeforeDestroy.size).toBeGreaterThan(0);
 
             // Access internal cache for verification (less ideal, but direct)
             // This relies on the internal property name '_features'
             expect((adapter as GPUAdapterImpl)['_features']).not.toBeNull();
 
             // Destroy the adapter
             (adapter as GPUAdapterImpl).destroy();
 
             // Verify internal cache is cleared
             expect((adapter as GPUAdapterImpl)['_features']).toBeNull();
 
             // Verify public getter now returns an empty set as per implementation
             const featuresAfterDestroy = adapter!.features;
             expect(featuresAfterDestroy).toBeInstanceOf(Set);
             expect(featuresAfterDestroy.size).toBe(0); 
        });
    });

    // TODO: Add tests for limits, info, isFallbackAdapter

}); 