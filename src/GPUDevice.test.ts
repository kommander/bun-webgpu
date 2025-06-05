import { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { 
    createGPUInstance, 
} from "./index";
import type { GPUImpl } from "./GPU";
import { globals } from "./index";

globals();

// Global variables for the test suite
let gpu: GPUImpl | null = null;
let adapter: GPUAdapter | null = null;
let device: GPUDevice | null = null;


describe("GPUDevice", () => {

    // --- Setup and Teardown --- 
    beforeAll(() => {
        // Identical setup to index.test.ts
        try {
            gpu = createGPUInstance();
        } catch (e) {
            console.error("Error during GPUDevice Test Setup:", e);
            gpu?.destroy();
            throw e;
        }
    });

    afterAll(() => {
        // Identical teardown to index.test.ts
        device?.destroy(); // Releases adapter implicitly
        device = null;
        adapter = null; 
        if (gpu) {
            gpu.destroy(); // Assuming GPUImpl has destroy
            gpu = null;
        }
    });

    // Create fresh adapter and device for each test
    beforeEach(async () => {
        if (!gpu) throw new Error("GPU instance not created in beforeAll");
        try {
             adapter = await gpu.requestAdapter();
             if (!adapter) throw new Error(`beforeEach Failed: Could not request adapter.`);
             device = await adapter.requestDevice({ label: `Device for test` });
             if (!device) throw new Error(`beforeEach Failed: Could not request device.`);
        } catch (e) {
             console.error("Error during beforeEach setup:", e);
             device?.destroy(); // Cleanup partial success
             device = null;
             adapter = null;
             throw e; // Re-throw to fail the test
        }
    });

    // Destroy device after each test
    afterEach(() => {
         device?.destroy();
         device = null;
         adapter = null; // Adapter is implicitly released by device destroy
    });

    // --- Tests --- 
    describe("createBindGroupLayout", () => {
        it("should create a layout with texture and sampler entries without errors", async () => {
            let layout: GPUBindGroupLayout | null = null;
            let errorOccurred = false;
            let receivedError: GPUError | null = null;
            const originalOnError = device!.onuncapturederror; // Store original handler

            // Temporarily override error handler for this test
            device!.onuncapturederror = (ev) => {
                console.error("*** Test-specific uncaptured error caught! ***", ev.error.message);
                errorOccurred = true;
                receivedError = ev.error;
            };

            const entries: GPUBindGroupLayoutEntry[] = [
                { // Texture entry (like MeshBasicMaterial map)
                    binding: 2,
                    visibility: GPUShaderStage.FRAGMENT,
                    texture: { 
                        // Defaults: sampleType: 'float', viewDimension: '2d'
                    } 
                },
                { // Sampler entry (for the texture map)
                    binding: 1,
                    visibility: GPUShaderStage.FRAGMENT,
                    sampler: { 
                        // Defaults: type: 'filtering'
                    } 
                }
            ];

            const descriptor: GPUBindGroupLayoutDescriptor = {
                label: "Test Basic Texture+Sampler BGL",
                entries: entries
            };

            // Expect this specific call NOT to throw the validation error
            expect(() => {
                  layout = device!.createBindGroupLayout(descriptor);
            }).not.toThrow();

            // Check if a valid layout object was returned
            expect(layout).not.toBeNull();
            expect(layout!.ptr).toBeTruthy(); // Check if the native pointer exists

            device!.tick();

            // Assert that the uncaptured error handler was NOT called
            expect(errorOccurred).toBe(false);
            if (errorOccurred && receivedError) { 
                  // Cast to any to bypass strict type checking for .message
                  console.error("Received error message:", (receivedError as any).message);
            } else if (errorOccurred) {
                  console.error("An uncaptured error occurred, but receivedError object was null or undefined");
            }

            // Restore original error handler
            if (device) {
                device.onuncapturederror = originalOnError;
            }
            // Ensure cleanup even if expectations fail
            if (layout && 'destroy' in layout) {
                (layout as any).destroy(); // Use destroy if available (assuming GPUBindGroupLayoutImpl has it)
            } else if (layout && 'release' in layout) {
                  (layout as any).release(); // Or use release if that's the method
            }
        });
    });

    describe("createRenderPipeline", () => {
        it("should fail validation for attribute larger than stride (stride 8)", async () => { 
            let vsModule: GPUShaderModule | null = null;
            let fsModule: GPUShaderModule | null = null;
            let pipelineLayout: GPUPipelineLayout | null = null;
            let pipeline: GPURenderPipeline | null = null;
            let errorOccurred = false;
            let errorMessage = "";
            const originalOnError = device!.onuncapturederror;

            device!.onuncapturederror = (ev) => {
                console.log("*** Test-specific uncaptured error caught (createRenderPipeline stride test)! ***", ev.error.message);
                errorOccurred = true;
                errorMessage = (ev.error as any).message || "Unknown error";
            };

            try {
                // 1. Minimal Shaders
                const wgslVS = /* wgsl */ `
                    @vertex fn main(@location(0) p1: vec4f, @location(1) p2: vec3f) -> @builtin(position) vec4f {
                        return p1;
                    }
                `;
                const wgslFS = /* wgsl */ `
                    @fragment fn main() -> @location(0) vec4f {
                        return vec4f(1.0, 0.0, 1.0, 1.0);
                    }
                `;
                vsModule = device!.createShaderModule({ code: wgslVS });
                fsModule = device!.createShaderModule({ code: wgslFS });

                console.log('got shader modules');
                // 2. Empty Pipeline Layout
                pipelineLayout = device!.createPipelineLayout({ bindGroupLayouts: [] });
                console.log('pipelineLayout', pipelineLayout.ptr);
                // 3. Faulty Vertex State
                const vertexState: GPUVertexState = {
                    module: vsModule,
                    entryPoint: "main",
                    buffers: [
                        { // Buffer layout 0
                            arrayStride: 8, // <<<< Keep problematic stride
                            attributes: [
                                { shaderLocation: 0, offset: 0, format: "float32" },   // OK (4 bytes)
                                { shaderLocation: 1, offset: 4, format: "float32x3" } // ERROR (12 bytes > stride 8)
                            ]
                        }
                    ]
                };

                // 4. Minimal Fragment State
                const fragmentState: GPUFragmentState = {
                    module: fsModule,
                    entryPoint: "main",
                    targets: [{ format: "bgra8unorm" }] // Example format
                };

                // 5. Pipeline Descriptor
                const descriptor: GPURenderPipelineDescriptor = {
                    label: "Test Stride Error Pipeline",
                    layout: pipelineLayout,
                    vertex: vertexState,
                    fragment: fragmentState,
                    primitive: { topology: "triangle-list" } // Need a topology
                };

                // 6. Create Pipeline (expect internal error)
                console.log('Create render pipeline')
                pipeline = device!.createRenderPipeline(descriptor);
                console.log('Got render pipeline', pipeline.ptr)
                
                // 7. Process potentially async errors
                device!.tick(); 
                // await Bun.sleep(10); // Sleep likely not needed if tick processes sync errors

                // 8. Assert that the specific error occurred
                expect(errorOccurred).toBe(true); // <<<< REVERTED: Expect error
                if (errorOccurred) { 
                    expect(errorMessage).toContain("must be <= the vertex buffer stride (8)");
                    expect(errorMessage).toContain("VertexFormat::Float32x3");
                } else {
                    // Fail test explicitly if error didn't occur when expected
                    expect("Validation error did not occur").toBe("Error expected"); 
                }
                // Pipeline might be null or invalid if error occurred, so don't assert on it here.

            } catch(e) {
                 console.error("createRenderPipeline threw unexpected synchronous error:", e);
                 expect(e).toBeNull(); 
            } finally {
                // Restore error handler
                if (device) {
                    device.onuncapturederror = originalOnError;
                }
                // Cleanup
                if (pipeline && 'release' in pipeline) (pipeline as any).release();
                if (pipelineLayout && 'release' in pipelineLayout) (pipelineLayout as any).release();
                if (vsModule && 'release' in vsModule) (vsModule as any).release();
                if (fsModule && 'release' in fsModule) (fsModule as any).release();
            }
        });
    });

    // --- Tests for Features --- NEW
    describe("features", () => {
        it("should return a non-empty set of features", async () => {
            expect(device).not.toBeNull();
            const features = device!.features;
            expect(features).toBeInstanceOf(Set);
            // A device should always have some features enabled
            expect(features.size).toBeGreaterThan(0);
            console.log("Device Features Found:", Array.from(features).join(', '));
        });

        it("should return the same cached set on subsequent calls", () => {
            expect(device).not.toBeNull();
            const features1 = device!.features;
            const features2 = device!.features;
            expect(features1).toBe(features2); // Strict equality check for cache
        });

        it("should return an empty set after device is destroyed", () => {
            expect(device).not.toBeNull();
            const featuresBeforeDestroy = device!.features; // Populate cache
            expect(featuresBeforeDestroy).not.toBeNull();
            expect(featuresBeforeDestroy!.size).toBeGreaterThan(0);

            // Access internal cache for verification (relies on GPUDeviceImpl structure)
            expect((device as any)['_features']).not.toBeNull();

            // Destroy the device
            device!.destroy();

            // Verify internal cache is cleared
            expect((device as any)['_features']).toBeNull();

            // Verify public getter now returns an empty set
            const featuresAfterDestroy = device!.features;
            expect(featuresAfterDestroy).toBeInstanceOf(Set);
            expect(featuresAfterDestroy.size).toBe(0);
        });
    });

    // --- Tests for Limits --- NEW
    describe("limits", () => {
        it("should return an object with expected limit properties", () => {
            expect(device).not.toBeNull();
            const limits = device!.limits;
            
            expect(limits).toBeInstanceOf(Object);

            // Spot check some key limits - exact values depend on hardware/driver
            expect(limits.maxTextureDimension2D).toBeGreaterThanOrEqual(1024); // Common minimum
            expect(limits.maxBindGroups).toBeGreaterThanOrEqual(4); // WebGPU minimum
            expect(limits.minUniformBufferOffsetAlignment).toBeGreaterThanOrEqual(16); // Common alignment
            expect(limits.maxUniformBufferBindingSize).toBeGreaterThanOrEqual(16 * 1024); // WebGPU minimum
            expect(limits.maxComputeWorkgroupSizeX).toBeGreaterThanOrEqual(64); // Common minimum
        });

        it("should return the same cached object on subsequent calls", () => {
            expect(device).not.toBeNull();
            const limits1 = device!.limits;
            const limits2 = device!.limits;
            expect(limits1).toBe(limits2); // Strict equality check for cache
        });

        it("should return default limits object after device is destroyed", () => {
            expect(device).not.toBeNull();
            const limitsBeforeDestroy = device!.limits; // Populate cache
            expect(limitsBeforeDestroy).not.toBeNull();
            // Basic check that some limit was likely non-zero before destroy
            expect(limitsBeforeDestroy!.maxTextureDimension2D).toBeGreaterThan(0);

            // Verify internal cache exists before destroy
            expect((device as any)['_limits']).not.toBeNull();

            // Destroy the device
            device!.destroy();

            // Verify public getter now returns the default limits object
            const limitsAfterDestroy = device!.limits;
            expect(limitsAfterDestroy.maxTextureDimension2D).toBe(8192);
        });
    });

}); 