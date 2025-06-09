import { type Pointer, ptr } from "bun:ffi";
import { type FFISymbols } from "./ffi";
import { fatalError } from "./utils/error";
import { WGPU_WHOLE_SIZE, WGPUIndexFormat } from "./structs_def";

export class GPURenderPassEncoderImpl implements GPURenderPassEncoder {
  __brand: "GPURenderPassEncoder" = "GPURenderPassEncoder";
  label: string = '';
  private lib: FFISymbols;

  constructor(public ptr: Pointer, lib: FFISymbols) {
    this.lib = lib;
  }

  setBlendConstant(color: GPUColor): undefined {
    fatalError('setBlendConstant not implemented');
  }

  setStencilReference(reference: GPUStencilValue): undefined {
    fatalError('setStencilReference not implemented');
  }

  beginOcclusionQuery(queryIndex: GPUSize32): undefined {
    fatalError('beginOcclusionQuery not implemented');
  }

  endOcclusionQuery(): undefined {
    fatalError('endOcclusionQuery not implemented');
  }

  executeBundles(bundles: Iterable<GPURenderBundle>): undefined {
    const bundleArray = Array.from(bundles);
    const bundlePtrs = bundleArray.map(b => b.ptr);
    const bundlesBuffer = new BigUint64Array(bundlePtrs.map(p => BigInt(p)));
    
    this.lib.wgpuRenderPassEncoderExecuteBundles(this.ptr, BigInt(bundleArray.length), ptr(bundlesBuffer));
    return undefined;
  }

  setPipeline(pipeline: GPURenderPipeline): undefined {
      this.lib.wgpuRenderPassEncoderSetPipeline(this.ptr, pipeline.ptr);
  }

  setBindGroup(index: GPUIndex32, bindGroup: GPUBindGroup | null | undefined, dynamicOffsets?: Uint32Array | number[]): undefined {
       if (!bindGroup) {
           console.warn("RenderPassEncoder.setBindGroup: null bindGroup pointer.");
           return;
      }
      
      let offsetsBuffer: Uint32Array | undefined;
      let offsetCount = 0;
      let offsetPtr: Pointer | null = null;

      if (dynamicOffsets) {
          if (dynamicOffsets instanceof Uint32Array) {
              offsetsBuffer = dynamicOffsets;
          } else {
              offsetsBuffer = new Uint32Array(dynamicOffsets);
          }
          offsetCount = offsetsBuffer.length;
          if (offsetCount > 0) {
              offsetPtr = ptr(offsetsBuffer.buffer, offsetsBuffer.byteOffset);
          }
      }

      try {
          this.lib.wgpuRenderPassEncoderSetBindGroup(this.ptr, index, bindGroup.ptr, BigInt(offsetCount), offsetPtr);
      } catch (e) { console.error("FFI Error: renderPassEncoderSetBindGroup", e); }
  }

  setVertexBuffer(slot: number, buffer: GPUBuffer | null | undefined, offset: number | bigint = 0, size?: number | bigint): undefined {
      if (!buffer) {
           console.warn("RenderPassEncoder.setVertexBuffer: null buffer pointer.");
           return;
      }
      // Use WGPU_WHOLE_SIZE equivalent if size is not provided
      const bufferSize = size ?? WGPU_WHOLE_SIZE; 
      this.lib.wgpuRenderPassEncoderSetVertexBuffer(this.ptr, slot, buffer.ptr, BigInt(offset), BigInt(bufferSize)); 
  }

  setIndexBuffer(buffer: GPUBuffer | null | undefined, format: GPUIndexFormat, offset: number | bigint = 0, size?: number | bigint): undefined {
       if (!buffer) {
           console.warn("RenderPassEncoder.setIndexBuffer: null buffer pointer.");
           return;
      }
      const formatValue = WGPUIndexFormat.to(format);
      // Use WGPU_WHOLE_SIZE equivalent if size is not provided
      const bufferSize = size ?? WGPU_WHOLE_SIZE; 
      this.lib.wgpuRenderPassEncoderSetIndexBuffer(this.ptr, buffer.ptr, formatValue, BigInt(offset), BigInt(bufferSize)); 
  }

  setViewport(x: number, y: number, width: number, height: number, minDepth: number, maxDepth: number): undefined {
      this.lib.wgpuRenderPassEncoderSetViewport(this.ptr, x, y, width, height, minDepth, maxDepth); 
  }

  setScissorRect(x: number, y: number, width: number, height: number): undefined {
       const ux = Math.max(0, Math.floor(x));
       const uy = Math.max(0, Math.floor(y));
       const uwidth = Math.max(0, Math.floor(width));
       const uheight = Math.max(0, Math.floor(height));
      this.lib.wgpuRenderPassEncoderSetScissorRect(this.ptr, ux, uy, uwidth, uheight); 
  }

  draw(vertexCount: number, instanceCount: number = 1, firstVertex: number = 0, firstInstance: number = 0): undefined {
       if (!this.ptr) { console.warn("RenderPassEncoder.draw: null encoder pointer."); return; }
       this.lib.wgpuRenderPassEncoderDraw(this.ptr, vertexCount, instanceCount, firstVertex, firstInstance); 
  }

  drawIndexed(indexCount: number, instanceCount: number = 1, firstIndex: number = 0, baseVertex: number = 0, firstInstance: number = 0): undefined {
       if (!this.ptr) { console.warn("RenderPassEncoder.drawIndexed: null encoder pointer."); return; }
       this.lib.wgpuRenderPassEncoderDrawIndexed(this.ptr, indexCount, instanceCount, firstIndex, baseVertex, firstInstance); 
  }

  drawIndirect(indirectBuffer: GPUBuffer, indirectOffset: number | bigint): undefined {
    this.lib.wgpuRenderPassEncoderDrawIndirect(this.ptr, indirectBuffer.ptr, BigInt(indirectOffset));
  }

  drawIndexedIndirect(indirectBuffer: GPUBuffer, indirectOffset: number): undefined {
    this.lib.wgpuRenderPassEncoderDrawIndexedIndirect(this.ptr, indirectBuffer.ptr, BigInt(indirectOffset));
    return undefined;
  }

  end(): undefined {
     this.lib.wgpuRenderPassEncoderEnd(this.ptr);
     // TODO: Encoder is consumed after end, prevent reuse.
  }

  pushDebugGroup(message: string): undefined {
    fatalError('renderPassEncoder pushDebugGroup not implemented');
  }

  popDebugGroup(): undefined {
    fatalError('renderPassEncoder popDebugGroup not implemented');
  }

  insertDebugMarker(markerLabel: string): undefined {
    fatalError('renderPassEncoder insertDebugMarker not implemented');
  }

  destroy(): undefined {
    try { 
      this.lib.wgpuRenderPassEncoderRelease(this.ptr); 
    } catch(e) { 
      console.error("FFI Error: renderPassEncoderRelease", e); 
    }
  }
}