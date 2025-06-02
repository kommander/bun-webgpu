import { expect, describe, it, beforeAll, afterAll } from "bun:test";
import { 
    createGPUInstance, 
} from "./index";
import type { GPUImpl } from "./GPU";
import { TextureUsageFlags } from "./common";

// Global variables for the test suite
let gpu: GPUImpl | null = null;
let adapter: GPUAdapter | null = null;
let device: GPUDevice | null = null;
let queue: GPUQueue | null = null;

describe("GPUQueue", () => {

    // --- Setup and Teardown --- 
    beforeAll(async () => {
        try {
            gpu = createGPUInstance();
            adapter = await gpu.requestAdapter();
            if (!adapter) throw new Error(`Test Setup Failed: Could not request adapter.`);
            device = await adapter.requestDevice({ label: "GPUQueue Test Device" });
            if (!device) throw new Error(`Test Setup Failed: Could not request device.`);
            queue = device.queue;
            if (!queue) throw new Error(`Test Setup Failed: Could not get queue.`);

            device.onuncapturederror = (ev) => {
                console.error(`>>> GPUQueue Test Uncaptured Error <<< Type: ${ev.error.message}`);
                // Allow tests to handle expected errors, don't throw here generally
            };
        } catch (e) {
            console.error("Error during GPUQueue Test Setup:", e);
            device?.destroy();
            gpu?.destroy(); 
            throw e;
        }
    });

    afterAll(() => {
        device?.destroy(); 
        device = null;
        adapter = null; 
        queue = null;
        if (gpu) {
            gpu.destroy(); 
            gpu = null;
        }
    });

    // --- Tests --- 
    describe("writeTexture", () => {
        it("should succeed writing a 2D texture even if dataLayout omits rowsPerImage", async () => {
            let texture: GPUTexture | null = null;
            let errorOccurred = false;
            const originalOnError = device!.onuncapturederror;

            const textureSize = { width: 4, height: 4 };
            const textureFormat = "rgba8unorm";
            const bytesPerPixel = 4;
            const bytesPerRow = textureSize.width * bytesPerPixel; 
            const textureData = new Uint8Array(textureSize.width * textureSize.height * bytesPerPixel);
            textureData.fill(128); // Fill with gray

            device!.onuncapturederror = (ev) => {
                console.error("*** Test writeTexture uncaptured error caught! ***", ev.error.message);
                errorOccurred = true;
            };

            try {
                texture = device!.createTexture({
                    label: "Test WriteTexture No RowsPerImage",
                    size: [textureSize.width, textureSize.height],
                    format: textureFormat,
                    usage: TextureUsageFlags.COPY_DST | TextureUsageFlags.COPY_SRC, // Need COPY_SRC for potential verification
                });
                expect(texture).not.toBeNull();

                const destination: GPUTexelCopyTextureInfo = {
                    texture: texture!,
                };
                // CRITICAL: Layout MISSING rowsPerImage
                const dataLayout: GPUTexelCopyBufferLayout = {
                    offset: 0,
                    bytesPerRow: bytesPerRow, 
                    // rowsPerImage: textureSize.height // Omitted!
                };
                const writeSize: GPUExtent3DStrict = {
                    width: textureSize.width,
                    height: textureSize.height,
                    depthOrArrayLayers: 1,
                };

                // Expect this call NOT to throw an error
                expect(() => {
                    queue!.writeTexture(destination, textureData.buffer, dataLayout, writeSize);
                }).not.toThrow();

                // Wait for queue completion to catch potential async validation errors
                await queue!.onSubmittedWorkDone(); 

                // Assert no uncaptured error occurred
                expect(errorOccurred).toBe(false);

                // Optional: Add verification step (copyTextureToBuffer, map, check pixel) if needed
                // For now, just ensuring no error is thrown is the main goal.

            } catch (e) {
                console.error("Unexpected error during writeTexture test:", e);
                expect(e).toBeNull(); // Force failure if synchronous error occurs
            } finally {
                 if (device) device!.onuncapturederror = originalOnError;
                 if (texture) texture.destroy();
            }
        });
    });
}); 