import { type Pointer, ptr } from "bun:ffi";
import { type FFISymbols } from "./ffi";
import { WGPUStringView } from "./structs_def";

export class GPUComputePassEncoderImpl implements GPUComputePassEncoder {
  __brand: "GPUComputePassEncoder" = "GPUComputePassEncoder";
  private lib: FFISymbols;
  label: string = '';

  constructor(public ptr: Pointer, lib: FFISymbols) {
    this.lib = lib;
  }

  setPipeline(pipeline: GPUComputePipeline): undefined { 
      if (!pipeline || !pipeline.ptr) {
           console.warn("ComputePassEncoder.setPipeline: null pipeline pointer.");
           return;
      }
      this.lib.wgpuComputePassEncoderSetPipeline(this.ptr, pipeline.ptr);
  }

  setBindGroup(groupIndex: number, bindGroup: GPUBindGroup | null, dynamicOffsets?: Uint32Array | number[]): undefined {
      if (!bindGroup || !bindGroup.ptr) {
           console.warn("ComputePassEncoder.setBindGroup: null bindGroup pointer.");
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
          // Pass BigUint64Array equivalent (Uint32Array pointer, u64 count)
          this.lib.wgpuComputePassEncoderSetBindGroup(this.ptr, groupIndex, bindGroup.ptr, BigInt(offsetCount), offsetPtr);
      } catch (e) { console.error("FFI Error: computePassEncoderSetBindGroup", e); }
  }

  dispatchWorkgroups(workgroupCountX: number, workgroupCountY: number = 1, workgroupCountZ: number = 1): undefined {
      if (!this.ptr) {
           console.warn("ComputePassEncoder.dispatchWorkgroups: null encoder pointer.");
           return;
      }
      try {
          this.lib.wgpuComputePassEncoderDispatchWorkgroups(this.ptr, workgroupCountX, workgroupCountY, workgroupCountZ);
      } catch (e) { console.error("FFI Error: computePassEncoderDispatchWorkgroups", e); }
  }

  dispatchWorkgroupsIndirect(indirectBuffer: GPUBuffer, indirectOffset: number | bigint): undefined {
      if (!indirectBuffer || !indirectBuffer.ptr) {
           console.warn("ComputePassEncoder.dispatchWorkgroupsIndirect: null buffer pointer.");
           return;
      }
      try {
          this.lib.wgpuComputePassEncoderDispatchWorkgroupsIndirect(this.ptr, indirectBuffer.ptr, BigInt(indirectOffset));
      } catch (e) { console.error("FFI Error: computePassEncoderDispatchWorkgroupsIndirect", e); }
  }

  end(): undefined {
      this.lib.wgpuComputePassEncoderEnd(this.ptr);
      // TODO: Encoder is consumed after end, prevent reuse.
  }

  pushDebugGroup(message: string): undefined {
    const packedMessage = WGPUStringView.pack(message);
    this.lib.wgpuComputePassEncoderPushDebugGroup(this.ptr, ptr(packedMessage));
  }

  popDebugGroup(): undefined {
    this.lib.wgpuComputePassEncoderPopDebugGroup(this.ptr);
  }

  insertDebugMarker(markerLabel: string): undefined {
    const packedMarker = WGPUStringView.pack(markerLabel);
    this.lib.wgpuComputePassEncoderInsertDebugMarker(this.ptr, ptr(packedMarker));
  }

  destroy(): undefined {
    console.error('destroy', this.ptr);
    throw new Error("Not implemented");
  }
}