import sharp from 'sharp'; 
import { type Pointer } from "bun:ffi";
import { 
  createGPUInstance, 
  setupGlobals,
} from '..';
import type { GPUImpl } from "../GPU";

setupGlobals();

export async function runTriangleToPngExample(filename: string = "triangle.png") {
  console.log("\n--- Running Triangle to PNG Example ---");
  let gpu: GPUImpl | null = null;
  let adapter: GPUAdapter | null = null;
  let device: GPUDevice | null = null;
  let queue: GPUQueue | null = null;
  let queuePtr: Pointer | null = null;

  // Resources
  let vsModule: GPUShaderModule | null = null;
  let fsModule: GPUShaderModule | null = null;
  let bgl: GPUBindGroupLayout | null = null;
  let pll: GPUPipelineLayout | null = null;
  let pipeline: GPURenderPipeline | null = null;
  let vertexBuffer: GPUBuffer | null = null;
  let indexBuffer: GPUBuffer | null = null;
  let renderTargetTexture: GPUTexture | null = null;
  let renderTargetView: GPUTextureView | null = null;
  let readbackBuffer: GPUBuffer | null = null;
  let commandEncoder: GPUCommandEncoder | null = null;
  let commandBuffer: GPUCommandBuffer | null = null;
  let emptyBindGroup: GPUBindGroup | null = null; // NEW

  const width = 128;
  const height = 128;
  const textureFormat = "rgba8unorm"; // Format needs to be easy for sharp

  try {
      // 1. Setup Context
      gpu = createGPUInstance();
      adapter = await gpu.requestAdapter();
      if (!adapter) {
        throw new Error("Example setup failed: Could not get WGPU context.");
      }
      device = await adapter.requestDevice();
      if (!device) {
        throw new Error("Example setup failed: Could not get WGPU context.");
      }
      // @ts-ignore testing
      const devicePtr = device.devicePtr;
      if (!devicePtr) {
        throw new Error("Example setup failed: Could not get WGPU context.");
      }
      queue = device.queue;
      if (!gpu || !adapter || !device || !queue) {
           throw new Error("Example setup failed: Could not get WGPU context.");
      }
      queuePtr = queue.ptr;
      if (!queuePtr) {
        throw new Error("Example setup failed: Could not get WGPU context.");
      }
      // Setup error handler for debugging
      device.onuncapturederror = (ev) => {
          console.error("[Example] Uncaptured Error: Type={}, Message={}", ev.error.message);
      };

      // 2. Resources (Shaders, Buffers, Layouts, Pipeline)
      const vertexData = new Float32Array([-0.5, -0.5, 0.0, 0.5, -0.5, 0.0, 0.0, 0.5, 0.0]);
      const indexData = new Uint16Array([0, 1, 2, 3]);
      const vertexBufferStride = 3 * Float32Array.BYTES_PER_ELEMENT;
      const wgslVS = /* wgsl */ `@vertex fn main(@location(0) pos: vec3f) -> @builtin(position) vec4f { return vec4f(pos, 1.0); }`;
      const wgslFS = /* wgsl */ `@fragment fn main() -> @location(0) vec4f { return vec4f(0.0, 1.0, 0.0, 1.0); }`; // Green triangle

      vsModule = device!.createShaderModule({ code: wgslVS });
      fsModule = device!.createShaderModule({ code: wgslFS });

      // Final buffers (Ensure COPY_DST usage)
      vertexBuffer = device!.createBuffer({ size: vertexData.byteLength, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
      indexBuffer = device!.createBuffer({ size: indexData.byteLength, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });

      // Use queueWriteBuffer to upload data directly
      console.log("Uploading vertex/index data using queueWriteBuffer...");
      queue!.writeBuffer(vertexBuffer!, 0, vertexData.buffer);
      queue!.writeBuffer(indexBuffer!, 0, indexData.buffer);
      // We might need to wait for these writes if subsequent commands depend on them immediately,
      // but the render pass doesn't start until after command encoding, so it should be fine.

      // Layouts & Pipeline
      bgl = device!.createBindGroupLayout({ entries: [] });
      pll = device!.createPipelineLayout({ bindGroupLayouts: [bgl!] });
      // Create the empty bind group (NEW)
      emptyBindGroup = device!.createBindGroup({
          label: "Example Empty BG",
          layout: bgl!,
          entries: [],
      });

      const vertexBuffersLayout: GPUVertexBufferLayout[] = [{
          arrayStride: vertexBufferStride,
          attributes: [{ format: "float32x3", offset: 0, shaderLocation: 0 }]
      }];
      pipeline = device!.createRenderPipeline({
          layout: pll,
          vertex: { module: vsModule, buffers: vertexBuffersLayout },
          fragment: { module: fsModule, targets: [{ format: textureFormat }] },
          primitive: { topology: "triangle-list" }
      });

      // Render Target
      renderTargetTexture = device!.createTexture({
          size: [width, height],
          format: textureFormat,
          usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
      });
      renderTargetView = renderTargetTexture!.createView({ label: "Triangle Render Target View" });

       // Readback Buffer
       const bytesPerRow = width * 4; // RGBA8
       const readbackBufferSize = bytesPerRow * height;
       readbackBuffer = device!.createBuffer({
           label: "Triangle Readback Buffer",
           size: readbackBufferSize,
           usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
       });

      if (!vsModule || !fsModule || !vertexBuffer || !indexBuffer || !bgl || !pll || !pipeline || !renderTargetTexture || !renderTargetView || !readbackBuffer) {
          throw new Error("Example setup failed: Resource creation failed.");
      }

      // 3. Command Encoding
      commandEncoder = device.createCommandEncoder({ label: "Triangle Command Encoder" });

      // Render Pass
      const passEncoder = commandEncoder!.beginRenderPass({
          colorAttachments: [{
              view: renderTargetView!,
              loadOp: "clear",
              storeOp: "store",
              clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 }, // Dark background
          }]
      });
      passEncoder!.setPipeline(pipeline);
      passEncoder!.setViewport(0, 0, width, height, 0, 1);
      passEncoder!.setScissorRect(0, 0, width, height);
      passEncoder!.setVertexBuffer(0, vertexBuffer!);
      passEncoder!.setIndexBuffer(indexBuffer!, "uint16");
      passEncoder!.setBindGroup(0, emptyBindGroup!);
      passEncoder!.drawIndexed(3);
      passEncoder!.end();

      // Copy Texture to Readback Buffer
      commandEncoder!.copyTextureToBuffer(
          { texture: renderTargetTexture! }, // source
          { buffer: readbackBuffer!, bytesPerRow, rowsPerImage: height }, // destination
          { width, height } // copySize
      );

      commandBuffer = commandEncoder!.finish();

      // 4. Submit and Wait
      queue.submit([commandBuffer!]);
      await queue!.onSubmittedWorkDone();

      // 5. Map Readback Buffer
      await readbackBuffer!.mapAsync(GPUMapMode.READ, 0, readbackBufferSize);
      const mappedData = readbackBuffer!.getMappedRange(0, readbackBufferSize);

      if (!mappedData) {
          throw new Error("Failed to map readback buffer.");
      }

      // 6. Save to PNG using Sharp
      console.log(`Attempting to save ${width}x${height} texture to ${filename}...`);
      try {
          await sharp(Buffer.from(mappedData), {
              raw: {
                  width: width,
                  height: height,
                  channels: 4, // RGBA
              },
          })
          .png()
          .toFile(filename);
          console.log(`Successfully saved image to ${filename}`);
      } catch(sharpError) {
           console.error("Failed to save PNG with sharp:", sharpError);
           console.error("Please ensure sharp is installed ('bun add sharp') and native dependencies are met.");
      }

      readbackBuffer!.unmap(); // Unmap after sharp has copied the data

      // --- SECOND COPY TEST --- 
      console.log("Starting second copy test...");
      const readbackBuffer2 = device!.createBuffer({
        label: "Triangle Readback Buffer 2",
        size: readbackBufferSize, // Reuse size
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      
      const commandEncoder2 = device.createCommandEncoder({ label: "Triangle Command Encoder 2" });
      commandEncoder2!.copyTextureToBuffer(
          { texture: renderTargetTexture! }, // source (original texture)
          { buffer: readbackBuffer2!, bytesPerRow, rowsPerImage: height }, // destination (new buffer)
          { width, height } // copySize
      );
      const commandBuffer2 = commandEncoder2!.finish();

      console.log("Submitting second copy command...");
      queue.submit([commandBuffer2!]);
      await queue!.onSubmittedWorkDone();
      console.log("Second copy finished.");

      console.log("Mapping second readback buffer...");
      await readbackBuffer2!.mapAsync(GPUMapMode.READ, 0, readbackBufferSize);
      const mappedData2 = readbackBuffer2!.getMappedRange(0, readbackBufferSize);
      if (!mappedData2) {
        console.error("Failed to map second readback buffer.");
      } else {
        // Optional: Verify a pixel or just confirm mapping worked
        console.log("Second readback buffer mapped successfully."); 
        // Example: Check first pixel's green value (should be ~255)
        const pixelView = new Uint8Array(mappedData2);
        if (pixelView.length >= 4) {
           console.log(`Second copy, pixel (0,0) G value: ${pixelView[1]}`);
        } else {
            console.warn("Second mapped data too small to check pixel.");
        }
      }
      readbackBuffer2!.unmap();
      readbackBuffer2.destroy(); // Clean up second buffer immediately
      // --- END SECOND COPY TEST ---

  } catch (e) {
      console.error("Error in Triangle to PNG Example:", e);
  } finally {
      console.log("Example Cleanup...");
      if (readbackBuffer) readbackBuffer.destroy();
      if (renderTargetView) renderTargetView.destroy();
      if (renderTargetTexture) renderTargetTexture.destroy();
      if (pipeline) pipeline.destroy();
      if (indexBuffer) indexBuffer.destroy();
      if (vertexBuffer) vertexBuffer.destroy();
      if (pll) pll.destroy();
      if (bgl) bgl.destroy();
      if (emptyBindGroup) emptyBindGroup.destroy(); // NEW Cleanup
      if (fsModule) fsModule.destroy();
      if (vsModule) vsModule.destroy();
      if (device) device.destroy();
      if (gpu) gpu.destroy();
      console.log("--- Example Finished ---");
  }
}

runTriangleToPngExample();