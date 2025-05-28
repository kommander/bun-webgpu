import { Pointer } from "bun:ffi";

declare global {
    interface GPUAdapter {
        adapterPtr: Pointer;
        destroy(): undefined;
    }

    interface GPUDevice {
        readonly ptr: Pointer;
        readonly queuePtr: Pointer;
        tick(): undefined;
    }

    interface GPUBuffer {
        readonly ptr: Pointer;
        getMappedRangePtr(offset?: GPUSize64, size?: GPUSize64): Pointer;
        release(): undefined;
    }

    interface GPUCommandBuffer {
        readonly ptr: Pointer;
        _destroy(): undefined;
    }

    interface GPUCommandEncoder {
        readonly ptr: Pointer;
        _destroy(): undefined;
    }

    interface GPUSampler {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUTexture {
        readonly ptr: Pointer;
    }

    interface GPUTextureView {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUQuerySet {
        readonly ptr: Pointer;
    }

    interface GPUShaderModule {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUComputePipeline {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUBindGroup {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUBindGroupLayout {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUPipelineLayout {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPURenderPipeline {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUComputePassEncoder {
        readonly ptr: Pointer;
    }

    interface GPURenderPassEncoder {
        readonly ptr: Pointer;
        destroy(): undefined;
    }

    interface GPUTexelCopyBufferInfo {
        bytesPerRow: number;
        rowsPerImage: number;
    }    

    interface GPUDeviceDescriptor {
        requiredLimits: Record<keyof GPUSupportedLimits, GPUSize64 | undefined>;
    }
}

