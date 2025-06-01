
import { type Pointer, ptr } from "bun:ffi";
import {
    BufferUsageFlags,
} from ".";
import { WGPUSupportedFeaturesStruct, WGPUFragmentStateStruct, WGPUBindGroupLayoutDescriptorStruct, WGPUShaderModuleDescriptorStruct, WGPUSType, WGPUShaderSourceWGSLStruct, WGPUPipelineLayoutDescriptorStruct, WGPUBindGroupDescriptorStruct, WGPURenderPipelineDescriptorStruct, WGPUVertexStateStruct, WGPUComputeStateStruct, UINT64_MAX, WGPUCommandEncoderDescriptorStruct, WGPUQuerySetDescriptorStruct } from "./structs_def";
import { WGPUComputePipelineDescriptorStruct } from "./structs_def";
import { allocStruct } from "./structs_ffi";
import { type FFISymbols } from "./ffi";
import { GPUQueueImpl } from "./GPUQueue";
import { GPUCommandEncoderImpl } from "./GPUCommandEncoder";
import { GPUTextureImpl } from "./GPUTexture";
import { GPUBufferImpl } from "./GPUBuffer";
import { GPUSamplerImpl } from "./GPUSampler";
import { GPUBindGroupImpl } from "./GPUBindGroup";
import { GPUBindGroupLayoutImpl } from "./GPUBindGroupLayout";
import { GPUQuerySetImpl } from "./GPUQuerySet";
import { GPUShaderModuleImpl } from "./GPUShaderModule";
import { GPUPipelineLayoutImpl } from "./GPUPipelineLayout";
import { GPUComputePipelineImpl } from "./GPUComputePipeline";
import { GPURenderPipelineImpl } from "./GPURenderPipeline";
import { fatalError } from "./utils/error";
import { WGPULimitsStruct } from "./structs_def";
import { WGPUBufferDescriptorStruct, WGPUTextureDescriptorStruct, WGPUSamplerDescriptorStruct } from "./structs_def";
import type { InstanceTicker } from "./GPU";

export const TextureDimension: Record<GPUTextureDimension, number> = {
    "1d": 0, // '1d' -> tdim_1d = 0
    "2d": 1, // '2d' -> tdim_2d = 1
    "3d": 2, // '3d' -> tdim_3d = 2
  } as const;

type EventListenerOptions = any;
export type DeviceErrorCallback = (this: GPUDevice, ev: GPUUncapturedErrorEvent) => any;

export class DeviceTicker {
    private _waiting: number = 0;
    private _ticking = false;

    constructor(public readonly devicePtr: Pointer, private lib: FFISymbols) {}

    register() {
        this._waiting++;
        this.scheduleTick();
    }

    unregister() {
        this._waiting--;
    }

    hasWaiting() {
        return this._waiting > 0;
    }

    private scheduleTick() {
        if (this._ticking) return;
        this._ticking = true;
        queueMicrotask(() => {
            this.lib.wgpuDeviceTick(this.devicePtr);
            this._ticking = false;
            if (this.hasWaiting()) {
                this.scheduleTick();
            }
        });
    }
}

const DEFAULT_SUPPORTED_LIMITS: GPUSupportedLimits = Object.freeze({
    __brand: "GPUSupportedLimits",
    maxTextureDimension1D: 0,
    maxTextureDimension2D: 0,
    maxTextureDimension3D: 0,
    maxTextureArrayLayers: 0,
    maxBindGroups: 0,
    maxBindGroupsPlusVertexBuffers: 0,
    maxBindingsPerBindGroup: 0,
    maxDynamicUniformBuffersPerPipelineLayout: 0,
    maxDynamicStorageBuffersPerPipelineLayout: 0,
    maxSampledTexturesPerShaderStage: 0,
    maxSamplersPerShaderStage: 0,
    maxStorageBuffersPerShaderStage: 0,
    maxStorageTexturesPerShaderStage: 0,
    maxUniformBuffersPerShaderStage: 0,
    maxUniformBufferBindingSize: 0,
    maxStorageBufferBindingSize: 0,
    minUniformBufferOffsetAlignment: 0,
    minStorageBufferOffsetAlignment: 0,
    maxVertexBuffers: 0,
    maxBufferSize: 0,
    maxVertexAttributes: 0,
    maxVertexBufferArrayStride: 0,
    maxInterStageShaderComponents: 0,
    maxInterStageShaderVariables: 0, // Match TS type, even if C struct differs slightly
    maxColorAttachments: 0,
    maxColorAttachmentBytesPerSample: 0,
    maxComputeWorkgroupStorageSize: 0,
    maxComputeInvocationsPerWorkgroup: 0,
    maxComputeWorkgroupSizeX: 0,
    maxComputeWorkgroupSizeY: 0,
    maxComputeWorkgroupSizeZ: 0,
    maxComputeWorkgroupsPerDimension: 0,
});

export class GPUDeviceImpl implements GPUDevice {
    readonly ptr: Pointer;
    readonly queuePtr: Pointer;
    private _queue: GPUQueue | null = null;
    private _userUncapturedErrorCallback: DeviceErrorCallback | null = null;
    private _ticker: DeviceTicker;
    private _lost: Promise<GPUDeviceLostInfo>;
    private _features: GPUSupportedFeatures | null = null; // Cache for features
    private _limits: GPUSupportedLimits | null = null; // Cache for limits
    private _destroyed = false;

    __brand: "GPUDevice" = "GPUDevice";
    label: string = '';

    constructor(public readonly devicePtr: Pointer, private lib: FFISymbols, private instanceTicker: InstanceTicker) {
      this.ptr = devicePtr;
      const queuePtr = this.lib.wgpuDeviceGetQueue(this.devicePtr);
      if (!queuePtr) {
        fatalError("Failed to get device queue");
      }
      this.queuePtr = queuePtr;

      // TODO: When are device ticks still needed?
      this._ticker = new DeviceTicker(this.devicePtr, this.lib);
      this._queue = new GPUQueueImpl(this.queuePtr, this.lib, this.instanceTicker);
      this._lost = new Promise((resolve, reject) => {
        // TODO: Implement lost event
      });
    }

    tick(): undefined {
        this.lib.wgpuDeviceTick(this.devicePtr);
        return undefined;
    }

    addEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        fatalError('addEventListener not implemented', type, listener, options);
    }

    removeEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | EventListenerOptions): void {
        fatalError('removeEventListener not implemented', type, listener, options);
    }

    handleUncapturedError(event: GPUUncapturedErrorEvent) {
        if (this._userUncapturedErrorCallback) {
            this._userUncapturedErrorCallback.call(this, event);
        } else {
            console.error(`>>> JS Device Error Callback <<< Type: ${event.error.message}`);
        }
    }

    dispatchEvent(event: Event): boolean {
        console.warn('dispatchEvent not implemented');
        return true;
    }

    pushErrorScope(filter: GPUErrorFilter): undefined {
        fatalError('pushErrorScope not implemented', filter);
    }

    popErrorScope(): Promise<GPUError | null> {
        fatalError('popErrorScope not implemented');
    }

    set onuncapturederror(listener: DeviceErrorCallback | null) {
        this._userUncapturedErrorCallback = listener;
    }

    get lost(): Promise<GPUDeviceLostInfo> {
        return this._lost;
    }

    get features(): GPUSupportedFeatures {
        if (this._destroyed) {
            console.warn("Accessing features on destroyed GPUDevice");
            return Object.freeze(new Set<string>());
        }
        if (this._features === null) {
            let supportedFeaturesStructPtr: Pointer | null = null;
            try {
                const featuresStructBuffer = new ArrayBuffer(16);
                const featuresBuffer = new ArrayBuffer(256);
                const featuresView = new DataView(featuresStructBuffer);
                const featuresPtr = ptr(featuresBuffer);
                
                featuresView.setBigUint64(8, BigInt(featuresPtr), true);
                this.lib.wgpuDeviceGetFeatures(this.devicePtr, ptr(featuresStructBuffer));
                
                const supportedFeaturesData = WGPUSupportedFeaturesStruct.unpack(featuresStructBuffer);
                const features = supportedFeaturesData.features;
                const supportedFeatures = new Set<string>(features);

                this._features = Object.freeze(supportedFeatures);
            } catch (e) {
                console.error("Error getting device features via wgpuDeviceGetFeatures:", e);
                this._features = Object.freeze(new Set<string>()); // Set empty on error
            } finally {
                 if (supportedFeaturesStructPtr) {
                    try {
                        this.lib.wgpuSupportedFeaturesFreeMembers(supportedFeaturesStructPtr);
                    } catch(freeError) {
                        console.error("Error calling wgpuSupportedFeaturesFreeMembers:", freeError);
                    }
                 }
            }
        }
        return this._features;
    }

    get limits(): GPUSupportedLimits {
        if (this._destroyed) {
            console.warn("Accessing limits on destroyed GPUDevice");
            return DEFAULT_SUPPORTED_LIMITS;
        }
        if (this._limits === null) {
            let limitsStructPtr: Pointer | null = null;
             try {
                const { buffer: structBuffer } = allocStruct(WGPULimitsStruct);
                limitsStructPtr = ptr(structBuffer);

                const status = this.lib.wgpuDeviceGetLimits(this.devicePtr, limitsStructPtr);

                if (status !== 1) { // WGPUStatus_Success = 1 (assuming, needs verification or enum import)
                     console.error(`wgpuDeviceGetLimits failed with status: ${status}`);
                     return DEFAULT_SUPPORTED_LIMITS;
                }

                const jsLimits = WGPULimitsStruct.unpack(structBuffer);

                this._limits = Object.freeze(jsLimits as unknown as GPUSupportedLimits);

            } catch (e) {
                console.error("Error calling wgpuDeviceGetLimits or unpacking struct:", e);
                limitsStructPtr = null;
                return DEFAULT_SUPPORTED_LIMITS;
            }
        }
        return this._limits;
    }

    get adapterInfo(): GPUAdapterInfo {
        return fatalError('adapterInfo not implemented');
    }

    get queue(): GPUQueue {
        if (!this._queue) {
            fatalError("Queue not initialized");
        }
        return this._queue;
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        // Invalidate caches
        this._features = null;
        this._limits = null;
        this._queue?.destroy();
        this._queue = null;

        try { this.lib.wgpuDeviceRelease(this.devicePtr); } catch(e) { console.error("FFI Error: deviceRelease", e); }
        return undefined;
    }

    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
        // Perform basic usage validation
        const usage = descriptor.usage;
        const hasMapWrite = (usage & BufferUsageFlags.MAP_WRITE) !== 0;
        const hasMapRead = (usage & BufferUsageFlags.MAP_READ) !== 0;
        const otherFlags = usage & ~(BufferUsageFlags.MAP_WRITE | BufferUsageFlags.MAP_READ);

        if (hasMapWrite && otherFlags !== 0 && otherFlags !== BufferUsageFlags.COPY_SRC) {
            fatalError("Invalid BufferUsage: MAP_WRITE can only be combined with COPY_SRC.");
        }
        if (hasMapRead && otherFlags !== 0 && otherFlags !== BufferUsageFlags.COPY_DST) {
            fatalError("Invalid BufferUsage: MAP_READ can only be combined with COPY_DST.");
        }

        if (descriptor.size <= 0) {
            fatalError("Buffer size must be greater than 0");
        }

        const packedDescriptor = WGPUBufferDescriptorStruct.pack(descriptor);

        try {
            const bufferPtr = this.lib.wgpuDeviceCreateBuffer(
                this.devicePtr,
                ptr(packedDescriptor)
            );

            if (!bufferPtr) {
                fatalError("Failed to create buffer");
            }

            return new GPUBufferImpl(bufferPtr, this.lib, descriptor, this.instanceTicker);
        } catch (e) {
            fatalError("Error creating buffer:", e);
        }
    }

    createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
        let size = descriptor.size;
        if (Symbol.iterator in size) {
            const sizeArray = Array.from(size);
            size = { width: sizeArray[0] || 1, height: sizeArray[1] || 1 }
        } else {
            size = { width: size.width || 1, height: size.height || 1, depthOrArrayLayers: size.depthOrArrayLayers || 1 }
        }

        const packedDescriptor = WGPUTextureDescriptorStruct.pack({
            ...descriptor,
            size,
        });

        try {
            const texturePtr = this.lib.wgpuDeviceCreateTexture(
                this.devicePtr,
                ptr(packedDescriptor)
            );

            if (!texturePtr) {
                fatalError("Failed to create texture");
            }

            let width, height, depthOrArrayLayers;
            if (Symbol.iterator in descriptor.size) {
                // It's an Iterable<number>
                const sizeArray = Array.from(descriptor.size);
                width = sizeArray[0] || 1;
                height = sizeArray[1] || 1;
                depthOrArrayLayers = sizeArray[2] || 1;
            } else {
                // It's a GPUExtent3DDict
                const sizeDict = descriptor.size as GPUExtent3DDict;
                width = sizeDict.width;
                height = sizeDict.height || 1;
                depthOrArrayLayers = sizeDict.depthOrArrayLayers || 1;
            }

            const dimension = descriptor.dimension || '2d';
            const mipLevelCount = descriptor.mipLevelCount || 1;
            const sampleCount = descriptor.sampleCount || 1;

            return new GPUTextureImpl(
                texturePtr,
                this.lib,
                width,
                height,
                depthOrArrayLayers,
                descriptor.format,
                dimension,
                mipLevelCount,
                sampleCount,
                descriptor.usage
            );
        } catch (e) {
            fatalError("Error creating texture:", e);
        }
    }

    createSampler(descriptor?: GPUSamplerDescriptor): GPUSampler {
        const samplerDescriptor = descriptor || {};
        const packedDescriptor = WGPUSamplerDescriptorStruct.pack(samplerDescriptor);

        try {
            const samplerPtr = this.lib.wgpuDeviceCreateSampler(
                this.devicePtr,
                ptr(packedDescriptor)
            );

            if (!samplerPtr) {
                fatalError("Failed to create sampler");
            }

            return new GPUSamplerImpl(
                samplerPtr,
                this.lib,
                descriptor?.label
            );
        } catch (e) {
            fatalError("Error creating sampler:", e);
        }
    }

    importExternalTexture(descriptor: GPUExternalTextureDescriptor): GPUExternalTexture {
        fatalError('importExternalTexture not implemented', descriptor);
    }

    createBindGroupLayout(descriptor: GPUBindGroupLayoutDescriptor): GPUBindGroupLayout {
        if (!descriptor.entries) { // || Array.from(descriptor.entries).length === 0) {
            fatalError('createBindGroupLayout: descriptor.entries is missing');
        }

        const packedDescriptorBuffer = WGPUBindGroupLayoutDescriptorStruct.pack(descriptor);
        const packedDescriptorPtr = ptr(packedDescriptorBuffer);

        const layoutPtr = this.lib.wgpuDeviceCreateBindGroupLayout(
            this.devicePtr,
            packedDescriptorPtr
        );

        if (!layoutPtr) {
            fatalError("Failed to create bind group layout (FFI returned null)");
        }
        return new GPUBindGroupLayoutImpl(layoutPtr, this.lib, descriptor.label);
    }

    createPipelineLayout(descriptor: GPUPipelineLayoutDescriptor): GPUPipelineLayout {
        const bgls = Array.from(descriptor.bindGroupLayouts).map((bgl) => bgl?.ptr).filter((bgl) => bgl !== undefined);
        const descriptorBuffer = WGPUPipelineLayoutDescriptorStruct.pack({
            label: descriptor.label,
            bindGroupLayouts: bgls
        });

        const layoutPtr = this.lib.wgpuDeviceCreatePipelineLayout(
            this.devicePtr,
            ptr(descriptorBuffer)
        );

        if (!layoutPtr) {
            fatalError("Failed to create pipeline layout (FFI returned null)");
        }
        return new GPUPipelineLayoutImpl(layoutPtr, this.lib, descriptor.label);
    }

    createShaderModule(descriptor: GPUShaderModuleDescriptor): GPUShaderModule {
        if (!descriptor.code) {
            fatalError("descriptor.code is missing");
        }

        const codeStruct = WGPUShaderSourceWGSLStruct.pack({
            chain: {
                next: null,
                sType: WGPUSType.ShaderSourceWGSL
            },
            code: descriptor.code
        });

        const packedDescriptor = WGPUShaderModuleDescriptorStruct.pack({
            nextInChain: ptr(codeStruct),
            label: descriptor.label
        });

        const modulePtr = this.lib.wgpuDeviceCreateShaderModule(
            this.devicePtr,
            ptr(packedDescriptor)
        );

        if (!modulePtr) {
            fatalError("Failed to create shader module (FFI returned null)");
        }

        return new GPUShaderModuleImpl(modulePtr, this.lib, descriptor.label || 'no-label');
    }

    createBindGroup(descriptor: GPUBindGroupDescriptor): GPUBindGroup {
        if (!this.devicePtr) {
            fatalError("createBindGroup: Device pointer is null");
        }

        const entries = Array.from(descriptor.entries).map((e) => {
            if (isBufferBinding(e.resource)) {
                return {
                    ...e,
                    buffer: e.resource.buffer,
                    offset: e.resource.offset ?? 0n,
                    size: e.resource.size ?? UINT64_MAX
                }
            } else if (isSampler(e.resource)) {
                return {
                    ...e,
                    sampler: e.resource
                }
            } else if (isTextureView(e.resource)) {
                return {
                    ...e,
                    textureView: e.resource
                }
            }
            return e;
        });
        const descriptorBuffer = WGPUBindGroupDescriptorStruct.pack({ ...descriptor, entries });

        try {
            const groupPtr = this.lib.wgpuDeviceCreateBindGroup(
                this.devicePtr,
                ptr(descriptorBuffer)
            );
            if (!groupPtr) {
                fatalError("Failed to create bind group (FFI returned null)");
            }
            return new GPUBindGroupImpl(groupPtr, this.lib, descriptor.label);
        } catch (e) {
            fatalError("Error calling deviceCreateBindGroupFromBuffer FFI function:", e);
        }
    }

    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
        let compute: ReturnType<typeof WGPUComputeStateStruct.unpack> | undefined = undefined;
        if (descriptor.compute) {
            const constants = descriptor.compute.constants ? Object.entries(descriptor.compute.constants).map(([key, value]) => ({ key, value })) : [];
            compute = {
                ...descriptor.compute,
                constants
            }
        } else {
            fatalError("GPUComputePipelineDescriptor.compute is required.");
        }

        const layoutForPacking = (descriptor.layout && descriptor.layout !== "auto")
            ? descriptor.layout
            : null;

        const packedPipelineDescriptor = WGPUComputePipelineDescriptorStruct.pack({
            ...descriptor,
            compute,
            layout: layoutForPacking
        });

        let pipelinePtr: Pointer | null = null;
        try {
            pipelinePtr = this.lib.wgpuDeviceCreateComputePipeline(
                this.devicePtr,
                ptr(packedPipelineDescriptor)
            );
        } catch(e) {
             fatalError("Error calling wgpuDeviceCreateComputePipeline FFI function:", e);
        }

        if (!pipelinePtr) {
            fatalError("Failed to create compute pipeline (FFI returned null)");
        }
        return new GPUComputePipelineImpl(pipelinePtr, this.lib, descriptor.label);
    }

    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline {
        let fragment: ReturnType<typeof WGPUFragmentStateStruct.unpack> | undefined = undefined;
        if (descriptor.fragment) {
            const constants = descriptor.fragment.constants ? Object.entries(descriptor.fragment.constants).map(([key, value]) => ({ key, value })) : [];
            fragment = {
                ...descriptor.fragment,
                constants,
                targets: Array.from(descriptor.fragment.targets ?? []).filter((t) => t !== null && t !== undefined)
            }
        }

        let vertex: ReturnType<typeof WGPUVertexStateStruct.unpack> | undefined = undefined;
        if (descriptor.vertex) {
            const constants = descriptor.vertex.constants ? Object.entries(descriptor.vertex.constants).map(([key, value]) => ({ key, value })) : [];
            vertex = {
                ...descriptor.vertex,
                constants,
                buffers: Array.from(descriptor.vertex.buffers ?? []).filter((t) => t !== null && t !== undefined)
            }
        } else {
            fatalError("GPURenderPipelineDescriptor.vertex is required.");
        }

        const layoutForPacking = (descriptor.layout && descriptor.layout !== "auto")
            ? descriptor.layout
            : null;

        const packedPipelineDescriptor = WGPURenderPipelineDescriptorStruct.pack({
            ...descriptor,
            fragment,
            vertex,
            layout: layoutForPacking
        });

        let pipelinePtr: Pointer | null = null;
        pipelinePtr = this.lib.wgpuDeviceCreateRenderPipeline(
            this.devicePtr,
            ptr(packedPipelineDescriptor)
        );
        if (!pipelinePtr) {
            fatalError("Failed to create render pipeline (FFI returned null)");
        }

        return new GPURenderPipelineImpl(pipelinePtr, this.lib, descriptor.label);
    }

    createCommandEncoder(descriptor?: GPUCommandEncoderDescriptor): GPUCommandEncoder {
      const packedDescriptor = WGPUCommandEncoderDescriptorStruct.pack(descriptor ?? {});
      const encoderPtr = this.lib.wgpuDeviceCreateCommandEncoder(this.devicePtr, ptr(packedDescriptor));
      if (!encoderPtr) {
        fatalError("Failed to create command encoder");
      }
      return new GPUCommandEncoderImpl(encoderPtr, this.lib);
    }

    createComputePipelineAsync(descriptor: GPUComputePipelineDescriptor): Promise<GPUComputePipeline> {
        fatalError('createComputePipelineAsync not implemented', descriptor);
    }

    createRenderPipelineAsync(descriptor: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> {
        fatalError('createRenderPipelineAsync not implemented', descriptor);
    }

    createRenderBundleEncoder(descriptor: GPURenderBundleEncoderDescriptor): GPURenderBundleEncoder {
        fatalError('createRenderBundleEncoder not implemented', descriptor);
    }

    createQuerySet(descriptor: GPUQuerySetDescriptor): GPUQuerySet {
        const packedDescriptor = WGPUQuerySetDescriptorStruct.pack(descriptor);

        let querySetPtr: Pointer | null = null;

        querySetPtr = this.lib.wgpuDeviceCreateQuerySet(
            this.devicePtr,
            ptr(packedDescriptor)
        );
        if (!querySetPtr) {
            fatalError("Failed to create query set (FFI returned null)");
        }

        return new GPUQuerySetImpl(querySetPtr, this.lib, descriptor.type, descriptor.count, descriptor.label);
    }
}

function isBufferBinding(resource: GPUBindingResource): resource is GPUBufferBinding {
    return 'buffer' in resource;
}

function isSampler(resource: GPUBindingResource): resource is GPUSampler {
    // @ts-ignore
    return resource.__brand === 'GPUSampler';
}

function isTextureView(resource: GPUBindingResource): resource is GPUTextureView {
    // @ts-ignore
    return resource.__brand === 'GPUTextureView';
}
