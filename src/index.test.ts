import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { type Pointer } from "bun:ffi";
import {
    createGPUInstance,
    globals,
} from "./index";
import type { GPUImpl } from "./GPU";

globals();

// Global variables for the test suite
let gpu: GPUImpl | null = null;
let adapter: GPUAdapter | null = null;
let device: GPUDevice | null = null;
let queue: GPUQueue | null = null;
let queuePtr: Pointer | null = null;

describe("bun-webgpu FFI Wrapper", () => {

    beforeAll(async () => {
        console.log("Setting up WGPU for tests...");
        try {
            // 1. Create Instance (Use wrapper)
            gpu = createGPUInstance();
            
            // 2. Request Adapter (Use wrapper)
            console.log("Requesting adapter...");
            // Note: requestAdapter wrapper handles JSCallback internally
            adapter = await gpu.requestAdapter({powerPreference: 'high-performance'});
            if (!adapter) {
                throw new Error(`Test Setup Failed: Could not request adapter.`);
            }
             console.log(`Got adapter: ${adapter.adapterPtr}`);


            // 3. Request Device (Use wrapper)
            console.log("Requesting device...");
            // Note: requestDevice wrapper handles JSCallback internally
            device = await adapter.requestDevice({label: "Test Device"});
            if (!device) {
                throw new Error(`Test Setup Failed: Could not request device.`);
            }
            console.log(`Device requested: ${device}`);
            
            // 4. Get Queue (Use wrapper)
            queue = device.queue;
            if (!queue) {
                throw new Error("Test Setup Failed: Could not get device queue.");
            }
            queuePtr = queue.ptr;
            if (!queuePtr) {
                throw new Error("Test Setup Failed: Could not get device queue.");
            }
             console.log("Queue obtained:", queuePtr);

            // 5. Set Error Callback (Uses wrapper already)
            device.onuncapturederror = (ev) => {
                // Log loudly in tests
                console.error(`>>> TEST Uncaptured Device Error <<< Type: ${ev.error.message}`);
                // Fail tests immediately on unexpected error - REMOVE for now to allow specific tests to catch expected errors
                // throw new Error(`Uncaptured device error: Type ${type}, Message: ${message}`);
            };
             console.log("Uncaptured error callback registered.");

        } catch (e) {
             console.error("Error during WGPU Test Setup:", e);
             // Ensure cleanup happens even if setup fails partially (Use wrappers)
             if (device) device.destroy();
             if (adapter) adapter.destroy();
             if (gpu) gpu.destroy();
             throw e; // Re-throw to fail the suite setup
        }
         console.log("WGPU Setup Complete.");
    });

    afterAll(() => {
        console.log("Cleaning up WGPU for tests...");
         // Release resources obtained during setup (Use wrappers)
         if (device) {
            device.onuncapturederror = null; // Use wrapper
            console.log("Releasing device...");
            device.destroy();
            device = null; 
        }
        if (adapter) {
             console.log("Releasing adapter...");
            adapter.destroy();
            adapter = null; 
        }
        if (gpu) {
            console.log("Calling cleanupInstance...");
            gpu.destroy(); 
            gpu = null;
        }
        console.log("WGPU Cleanup Complete.");
    });

    // --- Basic Tests ---
    it("should have initialized WGPU pointers", () => {
        expect(gpu).not.toBeNull();
        expect(adapter).not.toBeNull();
        expect(device).not.toBeNull();
        expect(queuePtr).not.toBeNull();
    });

    // --- Buffer Tests ---
    describe("Buffers", () => {
        it("should create a basic buffer", () => {
            let buffer: GPUBuffer | null = null;
            try {
                buffer = device!.createBuffer({
                    label: "Test Basic Buffer",
                    size: 16,
                    usage: GPUBufferUsage.COPY_DST, // Simple usage
                });
                expect(buffer).not.toBeNull();
            } finally {
                if (buffer) buffer.destroy();
            }
        });

        // Test Buffer Creation Validation
         it("should FAIL to create buffer with MAP_WRITE and invalid extra usage", () => {
             expect(() => {
                 device!.createBuffer({
                     label: "Invalid MapWrite",
                     size: 16,
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_DST, // Invalid
                 });
             }).toThrow("Invalid BufferUsage: MAP_WRITE can only be combined with COPY_SRC.");
         });

         it("should FAIL to create buffer with MAP_READ and invalid extra usage", () => {
             expect(() => {
                 device!.createBuffer({
                     label: "Invalid MapRead",
                     size: 16,
                     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_SRC, // Invalid
                 });
             }).toThrow("Invalid BufferUsage: MAP_READ can only be combined with COPY_DST.");
         });

         it("should SUCCEED creating buffer with MAP_WRITE | COPY_SRC", () => {
              let buffer: GPUBuffer | null = null;
             try {
                 buffer = device!.createBuffer({
                     label: "Valid MapWrite",
                     size: 16,
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                 });
                 expect(buffer).not.toBeNull();
             } finally {
                 if (buffer) buffer.destroy();
             }
         });

         it("should SUCCEED creating buffer with MAP_READ | COPY_DST", () => {
              let buffer: GPUBuffer | null = null;
             try {
                 buffer = device!.createBuffer({
                     label: "Valid MapRead",
                     size: 16,
                     usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                 });
                 expect(buffer).not.toBeNull();
             } finally {
                 if (buffer) buffer.destroy();
             }
         });

        // Test Buffer Mapping (WRITE)
        it("should map a buffer for WRITE, write data, and unmap", async () => {
            const bufferSize = 256; // Smaller size for testing
            let mappableBuffer: GPUBuffer | null = null;
            let dummyDstBuffer: GPUBuffer | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create the buffer to be mapped (MAP_WRITE | COPY_SRC)
                mappableBuffer = device!.createBuffer({
                    label: "Test MapWrite Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                    mappedAtCreation: false,
                });
                expect(mappableBuffer).not.toBeNull();

                // 2. Create a dummy destination buffer for the required queue op
                dummyDstBuffer = device!.createBuffer({
                    label: "Test MapWrite Dummy Dest",
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST,
                });
                expect(dummyDstBuffer).not.toBeNull();

                // 3. Perform queue operation (Use wrappers)
                commandEncoder = device?.createCommandEncoder({label: "Test MapWrite Command Encoder"});
                expect(commandEncoder).not.toBeUndefined();

                commandEncoder!.copyBufferToBuffer(
                    mappableBuffer!, 0,
                    dummyDstBuffer!, 0,
                    bufferSize
                );

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined; 

                queue?.submit([commandBuffer!]);
                console.log("MapWrite Test: Submitted copy op.");

                // 4. Wait for queue to finish (with manual ticking)
                await queue!.onSubmittedWorkDone();
                console.log("MapWrite Test: Queue finished.");

                // 5. Map the buffer for WRITE (with manual ticking)
                await mappableBuffer!.mapAsync(GPUMapMode.WRITE);
                console.log("MapWrite Test: Buffer mapped.");

                // 6. Get mapped range and write data
                const mappedRange = mappableBuffer!.getMappedRange();
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const dataView = new Uint8Array(mappedRange);
                    for(let i = 0; i < dataView.length; i++) {
                        dataView[i] = i % 256;
                    }
                    console.log(`MapWrite Test: Wrote data. First byte: ${dataView[0]}, Last byte: ${dataView[bufferSize - 1]}`);
                }

                // 7. Unmap
                mappableBuffer!.unmap();
                console.log("MapWrite Test: Buffer unmapped.");

                // TODO: Verification - How to read back? Needs MapRead test setup.
                // For now, success is reaching this point without errors.

            } finally {
                 console.log("MapWrite Test: Cleaning up...");
                 // Release resources in reverse order-ish
                 if (dummyDstBuffer) dummyDstBuffer.destroy();
                 if (mappableBuffer) mappableBuffer.destroy();
            }
        });

        // Test Buffer Mapping (READ)
        it("should map a buffer for READ, read data, and unmap", async () => {
            const bufferSize = 256;
            let readableBuffer: GPUBuffer | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                 // 1. Create the buffer to be mapped (MAP_READ | COPY_DST)
                 readableBuffer = device!.createBuffer({
                    label: "Test MapRead Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                    mappedAtCreation: false,
                });
                expect(readableBuffer).not.toBeNull();

                 // 2. Perform queue operation (Use wrappers)
                 commandEncoder = device?.createCommandEncoder({label: "Test MapRead Command Encoder"});
                expect(commandEncoder).not.toBeNull();

                commandEncoder!.clearBuffer(readableBuffer!, 0, bufferSize);
                console.log("MapRead Test: Encoded clearBuffer.");

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                queue?.submit([commandBuffer!]);
                console.log("MapRead Test: Submitted clear op.");

                 // 3. Wait for queue to finish (with manual ticking)
                 await queue!.onSubmittedWorkDone();
                 console.log("MapRead Test: Queue finished.");

                 // 4. Map the buffer for READ (with manual ticking)
                 await readableBuffer!.mapAsync(GPUMapMode.READ);
                 console.log("MapRead Test: Buffer mapped.");

                 // 5. Get mapped range and read data
                 const mappedRange = readableBuffer!.getMappedRange(0, bufferSize);
                 expect(mappedRange).not.toBeNull();
                 if (mappedRange) {
                     const dataView = new Uint8Array(mappedRange);
                     // Expect buffer to be cleared to zeros
                     expect(dataView[0]).toBe(0);
                     expect(dataView[bufferSize - 1]).toBe(0);
                     let allZero = true;
                     for(let i = 0; i < dataView.length; i++) {
                         if (dataView[i] !== 0) {
                             allZero = false;
                             break;
                         }
                     }
                     expect(allZero).toBe(true);
                     console.log(`MapRead Test: Verified buffer cleared. First byte: ${dataView[0]}`);
                 }

                 // 6. Unmap
                 readableBuffer!.unmap();
                 console.log("MapRead Test: Buffer unmapped.");

            } finally {
                 console.log("MapRead Test: Cleaning up...");
                 if (readableBuffer) readableBuffer.destroy();
            }
        });

        // Test MapAsync Edge Cases
        it("should FAIL to mapAsync a buffer that is already mapped (mappedAtCreation)", async () => {
            let buffer: GPUBuffer | null = null;
            let mapPromiseRejected = false;
            let mapPromiseResolved = false; // Should stay false
            const bufferSize = 16;
            try {
                 buffer = device!.createBuffer({
                     label: "Test AlreadyMapped Buffer",
                     size: bufferSize,
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC, 
                     mappedAtCreation: true,
                 });
                 expect(buffer).not.toBeNull();

                 // Initiate the mapAsync call that should fail
                 const mapPromise = buffer!.mapAsync(GPUMapMode.WRITE)
                    .then(() => { 
                        mapPromiseResolved = true; 
                        console.error("AlreadyMapped Test: Promise resolved unexpectedly!"); 
                    })
                    .catch((err) => { 
                        mapPromiseRejected = true; 
                        console.log("AlreadyMapped Test: Caught expected rejection:", err);
                        expect(err).toBeInstanceOf(Error);
                        // Check for the generic validation error message pattern instead
                        expect((err as Error).message).toMatch(/WGPU Buffer Map Error/i);
                    });

                 // Tick the device while waiting for the promise to settle
                 console.log("AlreadyMapped Test: Ticking after invalid mapAsync call...");
                 await mapPromise.finally(() => { }); // Mark settled regardless of outcome

                 console.log("AlreadyMapped Test: Promise settled.");

                 // Assertions after ticking
                 expect(mapPromiseResolved).toBe(false); // Should not have resolved
                 expect(mapPromiseRejected).toBe(true);  // Should have rejected

                 // Check we can still unmap it
                 buffer!.unmap();

            } finally {
                 console.log("AlreadyMapped Test: Cleaning up...");
                 if (buffer) buffer.destroy();
            }
        });

        it.skip("should FAIL to mapAsync a buffer that has a pending map operation", async () => {
             let buffer: GPUBuffer | null = null;
             let firstMapSucceeded = false;
             let secondMapFailed = false;
             const bufferSize = 256;
             try {
                 buffer = device!.createBuffer({
                     label: "Test PendingMap Buffer",
                     size: bufferSize,
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                 });
                 expect(buffer).not.toBeNull();

                 // Initiate the first map (don't await yet)
                 const firstMapPromise = buffer!.mapAsync(GPUMapMode.WRITE)
                    .then(() => { firstMapSucceeded = true; console.log("PendingMap Test: First map succeeded.") })
                    .catch((err) => { throw new Error("PendingMap Test: First map unexpectedly failed!", err); });

                 // Immediately try to initiate the second map
                 const secondMapPromise = buffer!.mapAsync(GPUMapMode.WRITE);

                 // Tick and wait for the SECOND map to fail
                 console.log("PendingMap Test: Ticking, expecting second map to fail...");
                 try {
                     // Wait for the second promise to settle, ticking manually
                    while (true) {
                        const result = await Promise.race([
                            secondMapPromise,
                            new Promise(resolve => setTimeout(() => resolve("timeout"), 10))
                        ]);
                        // If secondMapPromise resolves, it's an error for the test logic
                        if (result !== "timeout") {
                            // expect(true).toBe(false); // Should not resolve successfully
                            throw new Error("Second mapAsync promise unexpectedly resolved successfully.");
                            // break;
                        }
                     }

                 } catch (error) {
                     console.log("PendingMap Test: Caught expected error for second map:", error);
                     secondMapFailed = true;
                     expect(error).toBeInstanceOf(Error);
                     expect((error as Error).message).toMatch(/MappingAlreadyPending|pending map/i);
                 }
                 expect(secondMapFailed).toBe(true);

                 await firstMapPromise;
                 
                 expect(firstMapSucceeded as boolean).toBe(true); // First map should have succeeded

                 // Unmap the buffer from the first successful map
                 if (firstMapSucceeded) {
                     buffer!.unmap();
                     console.log("PendingMap Test: Unmapped buffer from first successful map.");
                 }

             } finally {
                  console.log("PendingMap Test: Cleaning up...");
                 if (buffer) buffer.destroy();
             }
        });

        // Test Command Encoding
        it("should clear a buffer using commandEncoderClearBuffer", async () => {
            const bufferSize = 256;
            let testBuffer: GPUBuffer | null = null;     // Buffer to clear (COPY_DST)
            let readbackBuffer: GPUBuffer | null = null; // Buffer to read result (MAP_READ | COPY_DST)
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create buffer to be cleared (needs COPY_DST for clear)
                testBuffer = device!.createBuffer({
                    label: "Test ClearBuffer Target",
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, // Add COPY_SRC to read it back
                    mappedAtCreation: false,
                });
                expect(testBuffer).not.toBeNull();

                // 2. Create buffer for reading back the result
                readbackBuffer = device!.createBuffer({
                    label: "Test ClearBuffer Readback",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 3. Encode clear command (Use wrappers)
                commandEncoder = device!.createCommandEncoder({label: "Test ClearBuffer Command Encoder"});
                expect(commandEncoder).not.toBeNull();

                commandEncoder!.clearBuffer(testBuffer!, 0, bufferSize);
                console.log("Clear Test: Encoded clearBuffer.");

                // 4. Encode copy to readback buffer (Use wrappers)
                commandEncoder!.copyBufferToBuffer(
                    testBuffer!, 0,
                    readbackBuffer!, 0,
                    bufferSize
                );
                 console.log("Clear Test: Encoded copyBufferToBuffer for readback.");

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined; 

                // 5. Submit and Wait
                queue?.submit([commandBuffer!]);
                console.log("Clear Test: Submitted commands.");

                await  queue!.onSubmittedWorkDone();

                // 6. Map readback buffer and verify clear
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, bufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const dataView = new Uint8Array(mappedRange);
                    let allZero = true;
                    for(let i = 0; i < dataView.length; i++) {
                        if (dataView[i] !== 0) { allZero = false; break; }
                    }
                    expect(allZero).toBe(true);
                    console.log("Clear Test: Verified buffer was cleared.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("Clear Test: Cleaning up...");
                if (readbackBuffer) readbackBuffer.destroy();
                if (testBuffer) testBuffer.destroy();
            }
        });

        it("should reject mapAsync promise with Aborted when unmapped before resolve", async () => {
            let buffer: GPUBuffer | null = null;
            let rejected = false;
            const bufferSize = 16;
            try {
                buffer = device!.createBuffer({
                    label: "Test UnmapBeforeResolve Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                });
                expect(buffer).not.toBeNull();

                const mapPromise = buffer!.mapAsync(GPUMapMode.WRITE)
                    .catch((err) => {
                        console.log("UnmapBeforeResolve Test: Caught expected rejection", err);
                        expect(err).toBeInstanceOf(Error);
                        expect((err as Error).message).toMatch(/Aborted|unmapped/i);
                        rejected = true;
                        // Don't re-throw, let finally handle cleanup
                    });
                
                // Immediately unmap
                buffer!.unmap();
                console.log("UnmapBeforeResolve Test: Unmapped immediately.");

                // Tick the device while waiting for the promise to settle (reject)
                await mapPromise;
                
                console.log("UnmapBeforeResolve Test: Promise settled.");

                expect(rejected).toBe(true);

            } finally {
                console.log("UnmapBeforeResolve Test: Cleaning up...");
                // Buffer should already be unmapped
                if (buffer) buffer.destroy();
            }
        });

        it("should reject mapAsync promise with Aborted when destroyed before resolve", async () => {
            let buffer: GPUBuffer | null = null;
            let rejected = false;
            const bufferSize = 16;
            try {
                buffer = device!.createBuffer({
                    label: "Test DestroyBeforeResolve Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                });
                expect(buffer).not.toBeNull();

                const mapPromise = buffer!.mapAsync(GPUMapMode.WRITE, 0, bufferSize)
                    .catch((err) => {
                        console.log("DestroyBeforeResolve Test: Caught expected rejection", err);
                        expect(err).toBeInstanceOf(Error);
                        expect((err as Error).message).toMatch(/Aborted|destroyed/i);
                        rejected = true;
                    });
                
                // Immediately destroy
                buffer!.destroy();
                console.log("DestroyBeforeResolve Test: Destroyed immediately.");
                buffer = null; // Prevent finally block from releasing again

                await mapPromise;
                
                console.log("DestroyBeforeResolve Test: Promise settled.");

                expect(rejected).toBe(true);

            } finally {
                console.log("DestroyBeforeResolve Test: Cleaning up...");
                // Buffer should already be released or null
                if (buffer) buffer.destroy(); 
            }
        });

        // Test commandEncoderCopyBufferToBuffer
        it("should copy data between buffers using commandEncoderCopyBufferToBuffer", async () => {
            const bufferSize = 256;
            const testData = new Uint8Array(bufferSize);
            for (let i = 0; i < bufferSize; i++) testData[i] = i;

            let srcBuffer: GPUBuffer | null = null;
            let dstBuffer: GPUBuffer | null = null;
            let readbackBuffer: GPUBuffer | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create source buffer and write initial data via mappedAtCreation
                srcBuffer = device!.createBuffer({
                    label: "Test CopyB2B Source",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                    mappedAtCreation: true,
                });
                expect(srcBuffer).not.toBeNull();
                const srcMapped = srcBuffer!.getMappedRange();
                expect(srcMapped).not.toBeNull();
                new Uint8Array(srcMapped!).set(testData);
                srcBuffer!.unmap();
                console.log("CopyB2B Test: Source buffer initialized and unmapped.");

                // 2. Create destination buffer (needs COPY_DST for copy, COPY_SRC to read back)
                dstBuffer = device!.createBuffer({
                    label: "Test CopyB2B Dest",
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC, 
                });
                expect(dstBuffer).not.toBeNull();

                // 3. Create readback buffer
                readbackBuffer = device!.createBuffer({
                    label: "Test CopyB2B Readback",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 4. Encode copy Source -> Dest, then Dest -> Readback
                commandEncoder = device!.createCommandEncoder({label: "Test CopyB2B Command Encoder"});
                expect(commandEncoder).not.toBeNull();

                // Src -> Dest
                commandEncoder!.copyBufferToBuffer(srcBuffer!, 0, dstBuffer!, 0, bufferSize);
                // Dest -> Readback
                commandEncoder!.copyBufferToBuffer(dstBuffer!, 0, readbackBuffer!, 0, bufferSize);
                console.log("CopyB2B Test: Encoded copy commands.");

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                // 5. Submit and Wait
                queue?.submit([commandBuffer!]);
                console.log("CopyB2B Test: Submitted commands.");

                await queue!.onSubmittedWorkDone();

                // 6. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ, 0, bufferSize);

                const mappedRange = readbackBuffer!.getMappedRange(0, bufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Uint8Array(mappedRange);
                    expect(readbackData).toEqual(testData); // Verify content matches original
                    console.log("CopyB2B Test: Verified buffer contents.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("CopyB2B Test: Cleaning up...");
                if (readbackBuffer) readbackBuffer.destroy();
                if (dstBuffer) dstBuffer.destroy();
                if (srcBuffer) srcBuffer.destroy();
            }
        });

    });

    describe("uncaptured errors", () => {
        it("should catch uncaptured errors", () => {
            const originalOnError = device!.onuncapturederror;
            let errorOccurred = false;
            device!.onuncapturederror = (ev) => {
                console.log("Uncaptured error:", ev.error.message);
                errorOccurred = true;
            };

            device!.createTexture({
                label: "Test Texture",
                size: [16, 16],
                // @ts-expect-error - invalid format to test uncaptured error with validation error
                format: "undefined", 
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });

            expect(errorOccurred).toBe(true);
            device!.onuncapturederror = originalOnError;
        });
    });

    // --- Texture Tests ---
    describe("Textures", () => {
        it("should create a basic texture", () => {
            let texture: GPUTexture | null = null;
            texture = device!.createTexture({
                label: "Test Texture",
                size: [16, 16],
                format: "rgba8unorm", // A common, well-supported format
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
            });
            expect(texture).not.toBeNull();
            if (texture) texture.destroy();
        });

        it("should create a basic texture with formats", () => {
            let texture: GPUTexture | null = null;
            texture = device!.createTexture({
                label: "Test Texture",
                size: [16, 16],
                format: "rgba8unorm", // A common, well-supported format
                usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
                viewFormats: ["rgba8unorm", "bgra8unorm"],
            });
            expect(texture).not.toBeNull();
            if (texture) texture.destroy();
        });
    });

    // --- Texture View Tests ---
    describe("Texture Views", () => {
        it("should create a basic texture view", () => {
            let texture: GPUTexture | null = null;
            let textureView: GPUTextureView | null = null;
            try {
                // 1. Create a texture first
                 texture = device!.createTexture({
                     label: "Test Texture for View",
                     size: [16, 16],
                     format: "rgba8unorm",
                     usage: GPUTextureUsage.TEXTURE_BINDING,
                 });
                 expect(texture).not.toBeNull();

                 // 2. Create a default view
                 textureView = texture!.createView({ label: "Test Texture View" });
                 expect(textureView).not.toBeNull();
            } finally {
                 // Release view then texture
                 // Need textureViewRelease wrapper
                 if (textureView) textureView.destroy(); // Use wrapper
                 if (texture) texture.destroy();
            }
        });
    });

    // --- Sampler Tests ---
    describe("Samplers", () => {
        it("should create a basic sampler", () => {
            let sampler: GPUSampler | null = null;
            try {
                 sampler = device!.createSampler({ label: "Test Sampler" });
                 expect(sampler).not.toBeNull();
            } finally {
                 if (sampler) sampler.destroy(); // Use wrapper
            }
        });
    });

    // --- Shader Module Tests ---
    describe("Shader Modules", () => {
        it("should create a basic shader module", () => {
            let shaderModule: GPUShaderModule | null = null; // Use interface type
            const wgslCode = /* wgsl */`@vertex fn vs() -> @builtin(position) vec4f { return vec4f(0.0); }`;
            try {
                 // Need device.createShaderModule
                 shaderModule = device!.createShaderModule({ 
                     label: "Test Shader Module",
                     code: wgslCode,
                 });
                 expect(shaderModule).not.toBeNull();
            } finally {
                 if (shaderModule && 'destroy' in shaderModule) (shaderModule as any).destroy(); // Check if destroy exists
                 // else if (shaderModule) shaderModuleRelease(shaderModule.ptr); // Fallback? No destroy method on GPUShaderModule
            }
        });
    });

    // --- Bind Group Layout Tests ---
    describe("Bind Group Layouts", () => {
        it("should create a basic bind group layout", () => {
            let bgl: GPUBindGroupLayout | null = null; // Use interface type
            try {
                 bgl = device!.createBindGroupLayout({ // Use device method
                     label: "Test BGL",
                     entries: [
                         { // Minimal buffer entry (standard descriptor)
                             binding: 0,
                             visibility: GPUShaderStage.VERTEX,
                             buffer: { type: "uniform" } 
                         }
                     ]
                 });
                 expect(bgl).not.toBeNull();
            } finally {
                 if (bgl && 'destroy' in bgl) (bgl as any).destroy(); // Use destroy method
            }
        });
    });

     // --- Pipeline Layout Tests ---
    describe("Pipeline Layouts", () => {
        it("should create a basic pipeline layout", () => {
            let bgl: GPUBindGroupLayout | null = null; // Use interface type
            let pll: GPUPipelineLayout | null = null; // Use interface type
            try {
                 // 1. Create a BGL first
                 bgl = device!.createBindGroupLayout({ // Use device method
                     label: "Test BGL for PLL",
                     entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }]
                 });
                 expect(bgl).not.toBeNull();

                 // 2. Create Pipeline Layout using the BGL
                 pll = device!.createPipelineLayout({ // Use device method
                     label: "Test PLL",
                     bindGroupLayouts: [bgl!], // Pass the created BGL object
                 });
                 expect(pll).not.toBeNull();

            } finally {
                 // Release in reverse order
                 // GPUPipelineLayout doesn't have destroy()
                 if (bgl && 'destroy' in bgl) (bgl as any).destroy();
            }
        });
    });

     // --- Bind Group Tests --- 
    describe("Bind Groups", () => {
        it("should create a basic bind group", () => {
            // Use interface types, let the create methods return the impl
            let bgl: GPUBindGroupLayout | null = null; 
            let buffer: GPUBuffer | null = null;
            let bindGroup: GPUBindGroup | null = null; 
            try {
                // 1. Create a BGL (using device method - assumes implementation exists)
                 bgl = device!.createBindGroupLayout({ 
                     label: "Test BGL for BG",
                     entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: { type: "uniform" } }] // Standard buffer entry
                 });
                 expect(bgl).not.toBeNull();

                // 2. Create a Buffer to bind
                 buffer = device!.createBuffer({
                    label: "Test Buffer for BG",
                    size: 16,
                    usage: GPUBufferUsage.UNIFORM, // Match expected usage in BGL
                 });
                 expect(buffer).not.toBeNull();

                 // 3. Create Bind Group (using device method)
                 bindGroup = device!.createBindGroup({ 
                     label: "Test BG",
                     layout: bgl!, // Pass the BGL object 
                     entries: [
                         // Use GPUBufferBinding structure for buffers
                         { binding: 0, resource: { buffer: buffer!, offset: 0, size: 16 } }
                     ]
                 });
                 expect(bindGroup).not.toBeNull();

            } finally {
                 // Release BG, then Buffer, then BGL
                 if (bindGroup && 'destroy' in bindGroup) (bindGroup as any).destroy(); 
                 if (buffer) buffer.destroy();
                 if (bgl && 'destroy' in bgl) (bgl as any).destroy(); 
            }
        });
    });

     // --- More tests to come ---

    // --- Pipeline Tests (NEW) ---
    describe("Pipelines", () => {
        it("should create a basic render pipeline", () => {
           let vsModule: GPUShaderModule | null = null;
           let fsModule: GPUShaderModule | null = null;
           let bgl: GPUBindGroupLayout | null = null;
           let pll: GPUPipelineLayout | null = null;
           let pipeline: GPURenderPipeline | null = null;

           const wgslVS = /* wgsl */`
               @vertex fn main(@builtin(vertex_index) idx : u32) -> @builtin(position) vec4f {
                   var pos = array(vec2f(0,1), vec2f(-1,-1), vec2f(1,-1));
                   return vec4f(pos[idx], 0, 1);
               }
           `;
           const wgslFS = /* wgsl */`
               @fragment fn main() -> @location(0) vec4f {
                   return vec4f(1, 0, 0, 1); // Red
               }
           `;

            try {
                // 1. Create Shaders
                vsModule = device!.createShaderModule({ code: wgslVS, label: "TestVS" });
                expect(vsModule).not.toBeNull();
                fsModule = device!.createShaderModule({ code: wgslFS, label: "TestFS" });
                expect(fsModule).not.toBeNull();

                // 2. Create BGL and Pipeline Layout (empty for this simple case)
                bgl = device!.createBindGroupLayout({ label: "Test Pipeline BGL", entries: [] });
                expect(bgl).not.toBeNull();
                pll = device!.createPipelineLayout({ label: "Test Pipeline PLL", bindGroupLayouts: [bgl!] });
                expect(pll).not.toBeNull();

                // 3. Create Render Pipeline
                pipeline = device!.createRenderPipeline({
                    label: "Test Render Pipeline",
                    layout: pll, 
                    vertex: {
                        module: vsModule,
                        entryPoint: "main",
                        // no buffers needed for this shader
                    },
                    fragment: {
                        module: fsModule,
                        entryPoint: "main",
                        targets: [{ format: "rgba8unorm" }], // Example target format
                    },
                    primitive: {
                        topology: "triangle-list",
                    },
                    multisample: {
                        count: 1,
                    },
                    // No depth/stencil for this test
                });
                expect(pipeline).not.toBeNull();

                // TODO: Add test using this pipeline in a render pass

            } finally {
                console.log("Pipeline Test: Cleaning up...");
                // Release pipeline first
                // if (pipeline) pipeline.destroy();
                // // Then layout
                // if (pll) pll.destroy();
                // if (bgl) bgl.destroy();
                // // Then shader modules
                // if (fsModule) fsModule.destroy();
                // if (vsModule) vsModule.destroy();
            }
        });

       // TODO: Add test for compute pipeline
    });

    // --- Render Pass Tests (NEW) ---
    describe("Render Passes", () => {
        it("should begin and end a simple render pass", () => {
            let texture: GPUTexture | null = null;
            let view: GPUTextureView | null = null;
            let encoder: GPUCommandEncoder | undefined = undefined;
            let passEncoder: GPURenderPassEncoder | null = null;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create attachment texture and view
                texture = device!.createTexture({
                    label: "Test RenderPass Texture",
                    size: [16, 16],
                    format: "rgba8unorm",
                    usage: GPUTextureUsage.RENDER_ATTACHMENT,
                });
                expect(texture).not.toBeNull();
                view = texture!.createView({ label: "Test RenderPass View" });
                expect(view).not.toBeNull();

                // 2. Create Command Encoder
                encoder = device!.createCommandEncoder({label: "Test RenderPass Command Encoder"});
                expect(encoder).not.toBeNull();

                // 3. Begin Render Pass
                passEncoder = encoder!.beginRenderPass({
                    label: "Test Render Pass",
                    colorAttachments: [{
                        view: view!,
                        loadOp: "clear",
                        storeOp: "store",
                        clearValue: { r: 0, g: 0, b: 1, a: 1 }, // Clear blue
                    }]
                });
                expect(passEncoder).not.toBeNull();
                expect(passEncoder?.ptr).not.toBeNull();

                // 4. End Render Pass (Currently logs warning)
                passEncoder?.end();

                // 5. Finish Command Buffer
                commandBuffer = encoder!.finish();
                expect(commandBuffer).not.toBeNull();
                encoder = undefined; // Consumed

                // 6. Submit (Fire and forget for this test)
                queue?.submit([commandBuffer!]);
                console.log("RenderPass Test: Submitted begin/end pass.");

            } finally {
                // Release resources
                if (passEncoder) passEncoder.destroy();
                if (view) view.destroy();
                if (texture) texture.destroy();
            }
        });

        it("should execute drawing commands within a render pass", async () => {
            // Resources needed for drawing
            let vsModule: GPUShaderModule | null = null;
            let fsModule: GPUShaderModule | null = null;
            let bgl: GPUBindGroupLayout | null = null;
            let pll: GPUPipelineLayout | null = null;
            let pipeline: GPURenderPipeline | null = null;
            let stagingVertexBuffer: GPUBuffer | null = null;
            let vertexBuffer: GPUBuffer | null = null;
            let stagingIndexBuffer: GPUBuffer | null = null;
            let indexBuffer: GPUBuffer | null = null;
            let renderTargetTexture: GPUTexture | null = null;
            let renderTargetView: GPUTextureView | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let passEncoder: GPURenderPassEncoder | null = null;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;
            let emptyBindGroup: GPUBindGroup | null = null;

            // Simple triangle vertices (pos) and indices
            const vertexData = new Float32Array([
                 0.0,  0.5, 0.0, // Top vertex
                -0.5, -0.5, 0.0, // Bottom left
                 0.5, -0.5, 0.0, // Bottom right
            ]);
            const indexData = new Uint16Array([0, 1, 2, 3]);
            const vertexBufferStride = 3 * Float32Array.BYTES_PER_ELEMENT;

            // Shader code (using vertex buffer)
            const wgslVS = /* wgsl */`
                @vertex fn main(@location(0) pos : vec3f) -> @builtin(position) vec4f {
                    return vec4f(pos, 1.0);
                }
            `;
            const wgslFS = /* wgsl */`
                @fragment fn main() -> @location(0) vec4f {
                    return vec4f(0.0, 1.0, 0.0, 1.0); // Green
                }
            `;

            try {
                 // 1. Create Shaders
                 vsModule = device!.createShaderModule({ code: wgslVS, label: "DrawVS" });
                 fsModule = device!.createShaderModule({ code: wgslFS, label: "DrawFS" });
                 expect(vsModule).not.toBeNull();
                 expect(fsModule).not.toBeNull();

                 // 2. Create Staging Buffers and Write Data
                 stagingVertexBuffer = device!.createBuffer({
                     label: "Test Staging Vertex Buffer",
                     size: vertexData.byteLength,
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                     mappedAtCreation: true,
                 });
                 expect(stagingVertexBuffer).not.toBeNull();
                 new Float32Array(stagingVertexBuffer!.getMappedRange()!).set(vertexData);
                 stagingVertexBuffer!.unmap();

                 // Pad size to multiple of 4 for mappedAtCreation
                 const indexBufferSize = Math.ceil(indexData.byteLength / 4) * 4; // 6 -> 8
                 stagingIndexBuffer = device!.createBuffer({
                     label: "Test Staging Index Buffer",
                     // size: indexData.byteLength, // Original size (6)
                     size: indexBufferSize, // Padded size (8)
                     usage: GPUBufferUsage.MAP_WRITE | GPUBufferUsage.COPY_SRC,
                     mappedAtCreation: true,
                 });
                 expect(stagingIndexBuffer).not.toBeNull();
                 // Get mapped range for the *padded* size, but only *set* the original data length
                 const indexMappedRange = stagingIndexBuffer!.getMappedRange();
                 expect(indexMappedRange).not.toBeNull();
                 if (indexMappedRange) { // Check needed in case expect doesn't halt on null
                    new Uint16Array(indexMappedRange, 0, indexData.length).set(indexData);
                 }
                 stagingIndexBuffer!.unmap();

                 // 3. Create Final GPU Buffers (VERTEX/INDEX + COPY_DST)
                 vertexBuffer = device!.createBuffer({
                     label: "Test Vertex Buffer",
                     size: vertexData.byteLength,
                     usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
                 });
                 expect(vertexBuffer).not.toBeNull();

                 indexBuffer = device!.createBuffer({
                     label: "Test Index Buffer",
                     size: indexData.byteLength,
                     usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
                 });
                 expect(indexBuffer).not.toBeNull();

                 // 4. Create Layouts (BGL is empty, PLL uses it)
                 bgl = device!.createBindGroupLayout({ label: "Draw BGL", entries: [] });
                 pll = device!.createPipelineLayout({ label: "Draw PLL", bindGroupLayouts: [bgl!] });
                 expect(bgl).not.toBeNull();
                 expect(pll).not.toBeNull();

                // 4.5 Create Empty Bind Group for the empty BGL (NEW)
                 emptyBindGroup = device!.createBindGroup({
                     label: "Draw Empty BG",
                     layout: bgl!,
                     entries: [], // Empty entries array
                 });
                 expect(emptyBindGroup).not.toBeNull();

                // 5. Define Vertex Buffer Layout for Pipeline
                 const vertexBuffersLayout: GPUVertexBufferLayout[] = [{
                     arrayStride: vertexBufferStride,
                     attributes: [
                         { format: "float32x3", offset: 0, shaderLocation: 0 }, // pos at location 0
                     ]
                 }];

                 // 6. Create Render Pipeline
                 pipeline = device!.createRenderPipeline({
                     label: "Draw Pipeline",
                     layout: pll,
                     vertex: {
                         module: vsModule,
                         entryPoint: "main",
                         buffers: vertexBuffersLayout, // Add buffer layout
                     },
                     fragment: {
                         module: fsModule,
                         entryPoint: "main",
                         targets: [{ format: "rgba8unorm" }],
                     },
                     primitive: {
                         topology: "triangle-list",
                     },
                     multisample: { count: 1 },
                 });
                 expect(pipeline).not.toBeNull();

                 // 7. Create Render Target
                 const targetSize = { width: 16, height: 16 };
                 renderTargetTexture = device!.createTexture({
                     label: "Draw Target Texture",
                     size: [targetSize.width, targetSize.height],
                     format: "rgba8unorm",
                     usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC, // Need COPY_SRC for verification later
                 });
                 expect(renderTargetTexture).not.toBeNull();
                 renderTargetView = renderTargetTexture!.createView({ label: "Draw Target View" });
                 expect(renderTargetView).not.toBeNull();

                 // --- Encode and Submit --- 
                 commandEncoder = device!.createCommandEncoder({label: "Test RenderPass Command Encoder"});
                 expect(commandEncoder).not.toBeNull();

                 // 8. Encode Copies from Staging to Final Buffers (NEW)
                 commandEncoder!.copyBufferToBuffer(stagingVertexBuffer!, 0, vertexBuffer!, 0, vertexData.byteLength);
                 commandEncoder!.copyBufferToBuffer(stagingIndexBuffer!, 0, indexBuffer!, 0, indexBufferSize);
                 console.log("Draw Test: Encoded staging buffer copies.");

                 // 9. Begin Render Pass (same)
                 passEncoder = commandEncoder!.beginRenderPass({
                     label: "Draw Test Render Pass",
                     colorAttachments: [{
                         view: renderTargetView!,
                         loadOp: "clear",
                         storeOp: "store",
                         clearValue: { r: 0, g: 0, b: 0, a: 1 }, 
                     }]
                 });
                 expect(passEncoder).not.toBeNull();

                 // 10. Set state and draw! (Use final buffers)
                 passEncoder!.setPipeline(pipeline);
                 passEncoder!.setViewport(0, 0, targetSize.width, targetSize.height, 0, 1);
                 passEncoder!.setScissorRect(0, 0, targetSize.width, targetSize.height);
                 passEncoder!.setVertexBuffer(0, vertexBuffer!); // Use final vertex buffer
                 passEncoder!.setIndexBuffer(indexBuffer!, "uint16"); // Use final index buffer
                 passEncoder!.setBindGroup(0, emptyBindGroup!);
                 passEncoder!.drawIndexed(3); 

                 passEncoder!.end();
                 passEncoder = null; // Consumed

                 // 11. Finish and Submit (same)
                 commandBuffer = commandEncoder!.finish();
                 expect(commandBuffer).not.toBeNull();
                 commandEncoder = undefined; // Consumed

                 queue?.submit([commandBuffer!]);
                 console.log("Draw Test: Submitted draw commands.");

                 // 12. Wait for completion (with manual ticking)
                 await queue!.onSubmittedWorkDone();

                 // Verification would involve copyTextureToBuffer and readback
                 // For now, success is reaching this point without device errors.

             } finally {
                 console.log("Draw Test: Cleaning up...");
                 // Release in reverse order of typical use
                 if (passEncoder) passEncoder.destroy();
                 if (renderTargetView) renderTargetView.destroy();
                 if (renderTargetTexture) renderTargetTexture.destroy();
                 if (pipeline) pipeline.destroy();
                 if (emptyBindGroup) emptyBindGroup.destroy();
                 if (indexBuffer) indexBuffer.destroy();
                 if (vertexBuffer) vertexBuffer.destroy();
                 if (stagingIndexBuffer) stagingIndexBuffer.destroy();
                 if (stagingVertexBuffer) stagingVertexBuffer.destroy();
                 if (pll) pll.destroy();
                 if (bgl) bgl.destroy();
                 if (fsModule) fsModule.destroy();
                 if (vsModule) vsModule.destroy();
             }
         });
    });

    // --- Queue Write Tests (NEW Phase 4) ---
    describe("Queue Writes", () => {
        it("should write data to a buffer using queueWriteBuffer", async () => {
            const bufferSize = 256;
            const testData = new Uint8Array(bufferSize);
            for (let i = 0; i < bufferSize; i++) testData[i] = (i + 5) % 256; // Different pattern

            let targetBuffer: GPUBuffer | null = null; // Buffer to write to (COPY_DST | COPY_SRC)
            let readbackBuffer: GPUBuffer | null = null; // Buffer to read result (MAP_READ | COPY_DST)
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create target buffer (needs COPY_DST for write, COPY_SRC to read back)
                targetBuffer = device!.createBuffer({
                    label: "Test WriteBuffer Target",
                    size: bufferSize,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
                });
                expect(targetBuffer).not.toBeNull();

                // 2. Create readback buffer
                readbackBuffer = device!.createBuffer({
                    label: "Test WriteBuffer Readback",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 3. Perform queue write
                queue!.writeBuffer(targetBuffer!, 0, testData.buffer);
                console.log("WriteBuffer Test: queueWriteBuffer called.");

                // 4. Encode copy to readback buffer
                commandEncoder = device!.createCommandEncoder({label: "Test WriteBuffer Command Encoder"});
                expect(commandEncoder).not.toBeNull();
                commandEncoder!.copyBufferToBuffer(targetBuffer!, 0, readbackBuffer!, 0, bufferSize);
                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                // 5. Submit copy and Wait
                queue?.submit([commandBuffer!]);
                console.log("WriteBuffer Test: Submitted copy command.");

                await queue!.onSubmittedWorkDone();

                // 6. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, bufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Uint8Array(mappedRange);
                    expect(readbackData).toEqual(testData);
                    console.log("WriteBuffer Test: Verified buffer contents.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("WriteBuffer Test: Cleaning up...");
                if (readbackBuffer) readbackBuffer.destroy();
                if (targetBuffer) targetBuffer.destroy();
            }
        });

        it("should write data to a texture using queueWriteTexture", async () => {
            const textureSize = { width: 4, height: 4 };
            const textureFormat = "rgba8unorm";
            const bytesPerPixel = 4; // RGBA8
            const actualBytesPerRow = textureSize.width * bytesPerPixel; // 16
            const textureData = new Uint8Array(textureSize.width * textureSize.height * bytesPerPixel);
            for (let i = 0; i < textureData.length; i++) textureData[i] = (i * 7) % 256; // Arbitrary pattern

            // NEW: Calculate aligned bytesPerRow for buffer copies
            const requiredBytesPerRowAlignment = 256;
            const alignedBytesPerRow = Math.ceil(actualBytesPerRow / requiredBytesPerRowAlignment) * requiredBytesPerRowAlignment;
            const readbackBufferSize = alignedBytesPerRow * textureSize.height;

            let targetTexture: GPUTexture | null = null;
            let readbackBuffer: GPUBuffer | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            try {
                // 1. Create target texture (COPY_DST for write, COPY_SRC to read back)
                targetTexture = device!.createTexture({
                    label: "Test WriteTexture Target",
                    size: [textureSize.width, textureSize.height],
                    format: textureFormat,
                    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC,
                });
                expect(targetTexture).not.toBeNull();

                // 2. Create readback buffer (using aligned size)
                readbackBuffer = device!.createBuffer({
                    label: "Test WriteTexture Readback",
                    // size: textureData.byteLength, // Old size
                    size: readbackBufferSize, // Use aligned size
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 3. Perform queue write
                const writeDestination: GPUTexelCopyTextureInfo = {
                    texture: targetTexture!,
                    mipLevel: 0,
                    origin: { x: 0, y: 0, z: 0 },
                };
                const writeLayout: GPUTexelCopyBufferLayout = {
                    offset: 0,
                    bytesPerRow: actualBytesPerRow, // Write uses actual bytes per row
                    rowsPerImage: textureSize.height,
                };
                const writeSize: GPUExtent3DStrict = {
                    width: textureSize.width,
                    height: textureSize.height,
                    depthOrArrayLayers: 1,
                };
                queue!.writeTexture(writeDestination, textureData, writeLayout, writeSize);
                console.log("WriteTexture Test: queueWriteTexture called.");

                // 4. Encode copy texture -> readback buffer
                commandEncoder = device!.createCommandEncoder({label: "Test WriteTexture Command Encoder"});
                expect(commandEncoder).not.toBeNull();

                const copySource: GPUTexelCopyTextureInfo = { texture: targetTexture! }; // Simple default copy source
                const copyDestLayout: GPUTexelCopyBufferLayout = {
                    offset: 0,
                    bytesPerRow: alignedBytesPerRow, // Use ALIGNED bytes per row for COPY
                    rowsPerImage: textureSize.height,
                };
                const copyDestination: GPUTexelCopyBufferInfo = {
                    buffer: readbackBuffer!,
                    bytesPerRow: alignedBytesPerRow,
                    rowsPerImage: textureSize.height,
                };
                // Call commandEncoderCopyTextureToBuffer - we need to import its definition
                commandEncoder!.copyTextureToBuffer(
                    copySource,
                    copyDestination,
                    writeSize // Copy the whole texture size
                );
                console.log("WriteTexture Test: Encoded copyTextureToBuffer.");

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                // 5. Submit copy and Wait
                queue?.submit([commandBuffer!]);
                console.log("WriteTexture Test: Submitted copy command.");

                await queue!.onSubmittedWorkDone();

                // 6. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, readbackBufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Uint8Array(mappedRange);
                    // Verify row by row, skipping padding
                    let match = true;
                    for (let y = 0; y < textureSize.height; y++) {
                        const readbackRowStart = y * alignedBytesPerRow;
                        const originalRowStart = y * actualBytesPerRow;
                        const readbackRow = readbackData.slice(readbackRowStart, readbackRowStart + actualBytesPerRow);
                        const originalRow = textureData.slice(originalRowStart, originalRowStart + actualBytesPerRow);
                        if (!readbackRow.every((val, i) => val === originalRow[i])) {
                            console.error(`Mismatch on row ${y}:`);
                            console.error(`  Readback: ${readbackRow}`);
                            console.error(`  Original: ${originalRow}`);
                            match = false;
                            break;
                        }
                    }
                    expect(match).toBe(true);
                    console.log("WriteTexture Test: Verified texture contents (row by row).");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("WriteTexture Test: Cleaning up...");
                if (readbackBuffer) readbackBuffer.destroy();
                if (targetTexture) targetTexture.destroy();
            }
        });
    });

    // --- Texture Copy Tests (NEW Phase 1 Completion) ---
    describe("Texture Copies", () => {
        it("should copy data between textures using commandEncoderCopyTextureToTexture", async () => {
            const textureSize = { width: 8, height: 8 };
            const textureFormat = "rgba8unorm";
            const bytesPerPixel = 4;
            const textureByteSize = textureSize.width * textureSize.height * bytesPerPixel;
            const testData = new Uint8Array(textureByteSize);
            for (let i = 0; i < testData.length; i++) testData[i] = (i * 13) % 256; // Yet another pattern

            let srcTexture: GPUTexture | null = null;
            let dstTexture: GPUTexture | null = null;
            let readbackBuffer: GPUBuffer | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            // Calculate aligned size for readback buffer
            const actualBytesPerRow = textureSize.width * bytesPerPixel;
            const requiredBytesPerRowAlignment = 256;
            const alignedBytesPerRow = Math.ceil(actualBytesPerRow / requiredBytesPerRowAlignment) * requiredBytesPerRowAlignment;
            const readbackBufferSize = alignedBytesPerRow * textureSize.height;

            try {
                // 1. Create source texture (COPY_SRC) and initialize with queueWriteTexture
                srcTexture = device!.createTexture({
                    label: "Test CopyT2T Source",
                    size: [textureSize.width, textureSize.height],
                    format: textureFormat,
                    usage: GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST, // Needs COPY_DST for queueWriteTexture
                });
                expect(srcTexture).not.toBeNull();
                
                const srcWriteDestination: GPUTexelCopyTextureInfo = { texture: srcTexture! }; // Simplified
                const srcWriteLayout: GPUTexelCopyBufferLayout = { bytesPerRow: actualBytesPerRow, rowsPerImage: textureSize.height };
                const srcWriteSize: GPUExtent3DStrict = { width: textureSize.width, height: textureSize.height, depthOrArrayLayers: 1 };
                queue!.writeTexture(srcWriteDestination, testData, srcWriteLayout, srcWriteSize);

                console.log("CopyT2T Test: Source texture initialized.");

                // 2. Create destination texture (COPY_DST)
                dstTexture = device!.createTexture({
                    label: "Test CopyT2T Destination",
                    size: [textureSize.width, textureSize.height],
                    format: textureFormat,
                    usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC, // Needs COPY_SRC for verification
                });
                expect(dstTexture).not.toBeNull();

                // 3. Create readback buffer (aligned size)
                readbackBuffer = device!.createBuffer({
                    label: "Test CopyT2T Readback",
                    size: readbackBufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 4. Encode copy T2T, then copy Dst -> Readback
                commandEncoder = device!.createCommandEncoder({label: "Test CopyT2T Command Encoder"});
                expect(commandEncoder).not.toBeNull();

                // Copy Source -> Destination
                commandEncoder!.copyTextureToTexture(
                    { texture: srcTexture! }, // Pass GPUTexture object directly
                    { texture: dstTexture! }, // Pass GPUTexture object directly
                    textureSize
                );

                // Copy Destination -> Readback Buffer
                commandEncoder!.copyTextureToBuffer(
                    { texture: dstTexture! }, // Source is now dstTexture
                    { buffer: readbackBuffer!, bytesPerRow: alignedBytesPerRow, rowsPerImage: textureSize.height },
                    textureSize
                );
                console.log("CopyT2T Test: Encoded copy commands.");

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                // 5. Submit and Wait
                queue?.submit([commandBuffer!]);
                console.log("CopyT2T Test: Submitted copy commands.");

                await queue!.onSubmittedWorkDone();

                // 6. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, readbackBufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Uint8Array(mappedRange);
                    // Verify row by row, skipping padding
                    let match = true;
                    for (let y = 0; y < textureSize.height; y++) {
                        const readbackRowStart = y * alignedBytesPerRow;
                        const originalRowStart = y * actualBytesPerRow;
                        const readbackRow = readbackData.slice(readbackRowStart, readbackRowStart + actualBytesPerRow);
                        const originalRow = testData.slice(originalRowStart, originalRowStart + actualBytesPerRow);
                        if (!readbackRow.every((val, i) => val === originalRow[i])) {
                            console.error(`Mismatch on row ${y}: Readback vs Original`);
                            match = false;
                            break;
                        }
                    }
                    expect(match).toBe(true);
                    console.log("CopyT2T Test: Verified texture contents match.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("CopyT2T Test: Cleaning up...");
                if (readbackBuffer) readbackBuffer.destroy();
                if (dstTexture) dstTexture.destroy();
                if (srcTexture) srcTexture.destroy();
            }
        });
    });

    // --- Compute Pipeline Tests (NEW) ---
    describe("Compute Pipelines", () => {
        it("should create and dispatch a basic compute pipeline", async () => { // Make test async
            let csModule: GPUShaderModule | null = null;
            let bgl: GPUBindGroupLayout | null = null;
            let pll: GPUPipelineLayout | null = null;
            let pipeline: GPUComputePipeline | null = null;
            let outputBuffer: GPUBuffer | null = null;
            let readbackBuffer: GPUBuffer | null = null;
            let bindGroup: GPUBindGroup | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let passEncoder: GPUComputePassEncoder | null = null;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            const bufferSize = 16; // 4 floats

            // Compute shader writes values to a storage buffer
            const wgslCS = /* wgsl */`
                struct OutputBuffer { data: array<f32> };
                @group(0) @binding(0) var<storage, read_write> output: OutputBuffer;
                
                @compute @workgroup_size(1)
                fn main(@builtin(global_invocation_id) id: vec3u) {
                    output.data[0] = 1.0;
                    output.data[1] = 2.0;
                    output.data[2] = 3.0;
                    output.data[3] = 4.0;
                }
            `;

            try {
                // 1. Create Shader Module
                csModule = device!.createShaderModule({ code: wgslCS, label: "TestComputeCS" });
                expect(csModule).not.toBeNull();

                // 2. Create Output Buffer (Storage + CopySrc) and Readback Buffer
                outputBuffer = device!.createBuffer({
                    label: "Compute Output Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                });
                expect(outputBuffer).not.toBeNull();
                readbackBuffer = device!.createBuffer({
                    label: "Compute Readback Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();

                // 3. Create Layouts (BGL needs storage buffer entry)
                bgl = device!.createBindGroupLayout({
                    label: "Compute BGL",
                    entries: [{
                        binding: 0,
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: "storage" }
                        // Add buffer-specific details for storage
                        // bufferDynamicOffset: false,
                        // bufferMinBindingSize: bufferSize,
                    }]
                });
                expect(bgl).not.toBeNull();
                pll = device!.createPipelineLayout({ label: "Compute PLL", bindGroupLayouts: [bgl!] });
                expect(pll).not.toBeNull();

                // 4. Create Bind Group
                bindGroup = device!.createBindGroup({
                    label: "Compute BG",
                    layout: bgl!,
                    entries: [
                        { binding: 0, resource: { buffer: outputBuffer! } }
                    ]
                });
                expect(bindGroup).not.toBeNull();

                // 5. Create Compute Pipeline
                pipeline = device!.createComputePipeline({
                    label: "Test Compute Pipeline",
                    layout: pll!,
                    compute: {
                        module: csModule!,
                        entryPoint: "main",
                    }
                });
                expect(pipeline).not.toBeNull();

                // 6. Encode Commands
                commandEncoder = device!.createCommandEncoder({label: "Test Compute Command Encoder"});
                expect(commandEncoder).not.toBeNull();
                
                passEncoder = commandEncoder!.beginComputePass({label: "Test Compute Pass"});
                expect(passEncoder).not.toBeNull();
                expect(passEncoder?.ptr).not.toBeNull();

                passEncoder!.setPipeline(pipeline);
                passEncoder!.setBindGroup(0, bindGroup);
                passEncoder!.dispatchWorkgroups(1); // Dispatch 1 workgroup
                passEncoder!.end();
                passEncoder = null; // Encoder consumed

                // Copy output to readback buffer
                commandEncoder.copyBufferToBuffer(outputBuffer!, 0, readbackBuffer!, 0, bufferSize);

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined; // Encoder consumed

                // 7. Submit and Wait
                queue?.submit([commandBuffer!]);
                console.log("Compute Test: Submitted commands.");

                await queue!.onSubmittedWorkDone();

                // 8. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, bufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Float32Array(mappedRange);
                    const expectedData = new Float32Array([1.0, 2.0, 3.0, 4.0]);
                    expect(readbackData).toEqual(expectedData);
                    console.log("Compute Test: Verified buffer contents match.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("Compute Test: Cleaning up...");
                // Release in reverse order
                if (bindGroup) bindGroup.destroy();
                if (pipeline) pipeline.destroy();
                if (pll) pll.destroy();
                if (bgl) bgl.destroy();
                if (readbackBuffer) readbackBuffer.destroy();
                if (outputBuffer) outputBuffer.destroy();
                if (csModule) csModule.destroy();
            }
        });

        it("should dispatch compute pipeline indirectly", async () => {
            let csModule: GPUShaderModule | null = null;
            let bgl: GPUBindGroupLayout | null = null;
            let pll: GPUPipelineLayout | null = null;
            let pipeline: GPUComputePipeline | null = null;
            let outputBuffer: GPUBuffer | null = null;
            let indirectBuffer: GPUBuffer | null = null; // NEW
            let readbackBuffer: GPUBuffer | null = null;
            let bindGroup: GPUBindGroup | null = null;
            let commandEncoder: GPUCommandEncoder | undefined = undefined;
            let passEncoder: GPUComputePassEncoder | null = null;
            let commandBuffer: GPUCommandBuffer | undefined = undefined;

            const bufferSize = 16; // 4 floats
            const indirectBufferSize = 3 * 4; // 3 * u32
            const dispatchCounts = new Uint32Array([2, 1, 1]); // Dispatch 2 workgroups (x=2, y=1, z=1)

            // Compute shader increments elements based on global_invocation_id.x
            const wgslCS = /* wgsl */`
                struct OutputBuffer { data: array<f32> };
                @group(0) @binding(0) var<storage, read_write> output: OutputBuffer;
                
                @compute @workgroup_size(1)
                fn main(@builtin(global_invocation_id) id: vec3u) {
                    let idx = id.x * 2u; // Write to two elements per invocation
                    if (idx >= 4u) { return; } // Basic bounds check
                    output.data[idx] = f32(id.x) + 10.0;
                    output.data[idx+1u] = f32(id.x) + 20.0;
                }
            `;

            try {
                // 1. Shader
                csModule = device!.createShaderModule({ code: wgslCS, label: "TestIndirectCS" });
                expect(csModule).not.toBeNull();

                // 2. Buffers
                outputBuffer = device!.createBuffer({
                    label: "Indirect Output Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
                });
                expect(outputBuffer).not.toBeNull();
                readbackBuffer = device!.createBuffer({
                    label: "Indirect Readback Buffer",
                    size: bufferSize,
                    usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
                });
                expect(readbackBuffer).not.toBeNull();
                // Create and initialize indirect buffer
                indirectBuffer = device!.createBuffer({
                    label: "Indirect Dispatch Buffer",
                    size: indirectBufferSize,
                    usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.COPY_DST,
                });
                expect(indirectBuffer).not.toBeNull();
                queue!.writeBuffer(indirectBuffer!, 0, dispatchCounts.buffer);
                console.log("Indirect Test: Indirect buffer initialized.");

                // 3. Layouts
                bgl = device!.createBindGroupLayout({
                    label: "Indirect BGL",
                    entries: [{
                        binding: 0, 
                        visibility: GPUShaderStage.COMPUTE,
                        buffer: { type: "storage" }
                    }]
                });
                expect(bgl).not.toBeNull();
                pll = device!.createPipelineLayout({ label: "Indirect PLL", bindGroupLayouts: [bgl!] });
                expect(pll).not.toBeNull();

                // 4. Bind Group
                bindGroup = device!.createBindGroup({
                    label: "Indirect BG", layout: bgl!, entries: [
                        { binding: 0, resource: { buffer: outputBuffer! } }
                    ]
                });
                expect(bindGroup).not.toBeNull();

                // 5. Pipeline
                pipeline = device!.createComputePipeline({
                    label: "Indirect Compute Pipeline", layout: pll!, compute: { module: csModule!, entryPoint: "main" }
                });
                expect(pipeline).not.toBeNull();

                // 6. Encode Commands
                commandEncoder = device!.createCommandEncoder({label: "Test Indirect Command Encoder"});
                expect(commandEncoder).not.toBeNull();
                
                passEncoder = commandEncoder!.beginComputePass({ label: "Test Indirect Compute Pass"});
                expect(passEncoder).not.toBeNull();

                passEncoder!.setPipeline(pipeline);
                passEncoder!.setBindGroup(0, bindGroup);
                passEncoder!.dispatchWorkgroupsIndirect(indirectBuffer!, 0); // Indirect dispatch
                passEncoder!.end();
                passEncoder = null;

                // Copy output to readback buffer
                commandEncoder.copyBufferToBuffer(outputBuffer!, 0, readbackBuffer!, 0, bufferSize);

                commandBuffer = commandEncoder!.finish();
                expect(commandBuffer).not.toBeNull();
                commandEncoder = undefined;

                // 7. Submit and Wait
                queue?.submit([commandBuffer!]);
                console.log("Indirect Test: Submitted commands.");
                
                // Wait for queue completion with manual ticking (like mapAsync tests)
                await queue!.onSubmittedWorkDone();

                // 8. Map readback buffer and verify data
                await readbackBuffer!.mapAsync(GPUMapMode.READ);

                const mappedRange = readbackBuffer!.getMappedRange(0, bufferSize);
                expect(mappedRange).not.toBeNull();
                if (mappedRange) {
                    const readbackData = new Float32Array(mappedRange);
                    // Expected: Invocation 0 writes 10, 20. Invocation 1 writes 11, 21.
                    const expectedData = new Float32Array([10.0, 20.0, 11.0, 21.0]);
                    expect(readbackData).toEqual(expectedData);
                    console.log("Indirect Test: Verified buffer contents match.");
                }
                readbackBuffer!.unmap();

            } finally {
                console.log("Indirect Test: Cleaning up...");
                // Release in reverse order
                if (bindGroup) bindGroup.destroy();
                if (pipeline) pipeline.destroy();
                if (pll) pll.destroy();
                if (bgl) bgl.destroy();
                if (indirectBuffer) indirectBuffer.destroy();
                if (readbackBuffer) readbackBuffer.destroy();
                if (outputBuffer) outputBuffer.destroy();
                if (csModule) csModule.destroy();
            }
        });

    });

     // --- More tests to come ---

    // --- Query Set Tests (NEW) ---
    describe("Query Sets", () => {
        it("should create and destroy various query sets", () => {
            let occlusionSet: GPUQuerySet | null = null;
            // TODO: Allow setting features and toggles in deviceCreate then this can be tested
            // let timestampSet: GPUQuerySet | null = null; // Skip until feature enabled
           
            try {
                // Occlusion (should work without special features)
                occlusionSet = device!.createQuerySet({
                    label: "Test Occlusion QuerySet",
                    type: "occlusion",
                    count: 8,
                });
                expect(occlusionSet).not.toBeNull();

                // Timestamp
                // timestampSet = device!.createQuerySet({
                //     label: "Test Timestamp QuerySet",
                //     type: "timestamp",
                //     count: 2,
                // });
                // expect(timestampSet).not.toBeNull();

                // TODO: Add tests for resolving query sets

            } finally {
                console.log("QuerySet Create Test: Cleaning up...");
                // if (timestampSet) timestampSet.destroy();
                if (occlusionSet) occlusionSet.destroy();
            }
        });
    });

     // --- More tests to come ---
});