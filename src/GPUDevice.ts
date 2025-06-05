
import { FFIType, JSCallback, type Pointer, ptr, toArrayBuffer } from "bun:ffi";
import { BufferUsageFlags } from "./common";
import { WGPUSupportedFeaturesStruct, WGPUFragmentStateStruct, WGPUBindGroupLayoutDescriptorStruct, WGPUShaderModuleDescriptorStruct, WGPUSType, WGPUShaderSourceWGSLStruct, WGPUPipelineLayoutDescriptorStruct, WGPUBindGroupDescriptorStruct, WGPURenderPipelineDescriptorStruct, WGPUVertexStateStruct, WGPUComputeStateStruct, UINT64_MAX, WGPUCommandEncoderDescriptorStruct, WGPUQuerySetDescriptorStruct, WGPUAdapterInfoStruct, WGPUErrorFilter, WGPUCallbackInfoStruct } from "./structs_def";
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
import { normalizeIdentifier, DEFAULT_SUPPORTED_LIMITS, GPUSupportedLimitsImpl, decodeCallbackMessage, GPUErrorImpl } from "./shared";
import { GPUAdapterInfoImpl } from "./shared";

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

const EMPTY_ADAPTER_INFO: Readonly<GPUAdapterInfo> = Object.create(GPUAdapterInfoImpl.prototype);
const DEFAULT_LIMITS = Object.assign(Object.create(GPUSupportedLimitsImpl.prototype), DEFAULT_SUPPORTED_LIMITS);

let erroScopePopId = 0;

export class GPUDeviceImpl implements GPUDevice {
    readonly ptr: Pointer;
    readonly queuePtr: Pointer;
    private _queue: GPUQueue | null = null;
    private _userUncapturedErrorCallback: DeviceErrorCallback | null = null;
    private _ticker: DeviceTicker;
    private _lost: Promise<GPUDeviceLostInfo>;
    private _lostPromiseResolve: ((value: GPUDeviceLostInfo) => void) | null = null;
    private _features: GPUSupportedFeatures | null = null;
    private _limits: GPUSupportedLimits = DEFAULT_LIMITS;
    private _info: GPUAdapterInfo = EMPTY_ADAPTER_INFO;
    private _destroyed = false;
    private _popErrorScopeCallback: JSCallback;
    private _popErrorScopePromises: Map<number, {
        resolve: (value: GPUError | null) => void,
        reject: (reason?: any) => void,
    }> = new Map();

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
      this._lost = new Promise((resolve) => {
        this._lostPromiseResolve = resolve;
      });

      this._popErrorScopeCallback = new JSCallback(
        (status: number, errorType: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) => {
            this.instanceTicker.unregister();
            
            const message = decodeCallbackMessage(messagePtr, messageSize);
            const error = Object.assign(Object.create(GPUErrorImpl.prototype), {
                message,
            });
            
            if (!userdata1) {
                console.error('[POP ERROR SCOPE CALLBACK] userdata1 is null');
                return;
            }
            
            const userdata1Buffer = toArrayBuffer(userdata1, 0, 4);
            const userDataView = new DataView(userdata1Buffer);
            const popId = userDataView.getUint32(0, true);
            const promise = this._popErrorScopePromises.get(popId);
            
            if (promise) {
                promise.resolve(error);
                this._popErrorScopePromises.delete(popId);
            } else {
                console.error('[POP ERROR SCOPE CALLBACK] promise not found');
            }
        },
        {
            args: [FFIType.u32, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
        }
      );
    }

    tick(): undefined {
        this.lib.wgpuDeviceTick(this.devicePtr);
        return undefined;
    }

    addEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        // fatalError('addEventListener not implemented', type, listener, options);
        console.warn('addEventListener not implemented', type, listener, options);
    }

    removeEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | EventListenerOptions): void {
        // fatalError('removeEventListener not implemented', type, listener, options);
        console.warn('removeEventListener not implemented', type, listener, options);
    }

    handleUncapturedError(event: GPUUncapturedErrorEvent) {
        if (this._userUncapturedErrorCallback) {
            this._userUncapturedErrorCallback.call(this, event);
        } else {
            console.error(`>>> JS Device Error Callback <<< Type: ${event.error.message}`);
        }
    }

    handleDeviceLost(reason: GPUDeviceLostReason, message: string) {
        if (this._lostPromiseResolve) {
            this._lostPromiseResolve({ 
                reason, 
                message, 
                __brand: "GPUDeviceLostInfo" as const,
            });
        }
    }

    dispatchEvent(event: Event): boolean {
        console.warn('dispatchEvent not implemented');
        return true;
    }

    pushErrorScope(filter: GPUErrorFilter): undefined {
        if (this._destroyed) {
            fatalError('pushErrorScope on destroyed GPUDevice');
        }
        this.lib.wgpuDevicePushErrorScope(this.devicePtr, WGPUErrorFilter.to(filter));
        return undefined;
    }

    popErrorScope(): Promise<GPUError | null> {
        if (this._destroyed) {
            fatalError('popErrorScope on destroyed GPUDevice');
        }

        return new Promise((resolve, reject) => {
            const id = erroScopePopId++;
            this._popErrorScopePromises.set(id, { resolve, reject });
            const userDataBuffer = new Uint32Array(1);
            userDataBuffer[0] = id;
            const userDataPtr = ptr(userDataBuffer.buffer);

            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: this._popErrorScopeCallback.ptr!,
                userdata1: userDataPtr,
            });
            this.lib.wgpuDevicePopErrorScope(this.devicePtr, ptr(callbackInfo));
            this.instanceTicker.register();
        });
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
            return this._limits;
        }

        if (this._limits === null) {
            let limitsStructPtr: Pointer | null = null;
             try {
                const { buffer: structBuffer } = allocStruct(WGPULimitsStruct);
                limitsStructPtr = ptr(structBuffer);

                const status = this.lib.wgpuDeviceGetLimits(this.devicePtr, limitsStructPtr);

                if (status !== 1) { // WGPUStatus_Success = 1 (assuming, needs verification or enum import)
                     console.error(`wgpuDeviceGetLimits failed with status: ${status}`);
                     return this._limits;
                }

                const jsLimits = WGPULimitsStruct.unpack(structBuffer);
                this._limits = Object.freeze(Object.assign(Object.create(GPUSupportedLimitsImpl.prototype), {
                    __brand: "GPUSupportedLimits" as const,
                    ...jsLimits,
                    maxUniformBufferBindingSize: Number(jsLimits.maxUniformBufferBindingSize),
                    maxStorageBufferBindingSize: Number(jsLimits.maxStorageBufferBindingSize),
                    maxBufferSize: Number(jsLimits.maxBufferSize),
                }));

            } catch (e) {
                console.error("Error calling wgpuDeviceGetLimits or unpacking struct:", e);
                limitsStructPtr = null;
                return this._limits;
            }
        }
        return this._limits;
    }

    get adapterInfo(): GPUAdapterInfo {
        if (this._destroyed) {
            return EMPTY_ADAPTER_INFO;
        }

        if (this._info === EMPTY_ADAPTER_INFO) {
            let infoStructPtr: Pointer | null = null;
            try {
                const { buffer: structBuffer } = allocStruct(WGPUAdapterInfoStruct);
                infoStructPtr = ptr(structBuffer);
                const status = this.lib.wgpuDeviceGetAdapterInfo(this.devicePtr, infoStructPtr);

                if (status !== 1) { // WGPUStatus_Success = 1
                    console.error(`wgpuAdapterGetInfo failed with status: ${status}`);
                    this._info = EMPTY_ADAPTER_INFO;
                    return this._info;
                }

                const rawInfo = WGPUAdapterInfoStruct.unpack(structBuffer);
                this._info = Object.assign(Object.create(GPUAdapterInfoImpl.prototype), rawInfo, {
                    vendor: rawInfo.vendor,
                    architecture: rawInfo.architecture,
                    description: rawInfo.description,
                    device: normalizeIdentifier(rawInfo.device),
                    subgroupMinSize: rawInfo.subgroupMinSize,
                    subgroupMaxSize: rawInfo.subgroupMaxSize,
                    isFallbackAdapter: false,
                });
            } catch (e) {
                console.error("Error calling wgpuAdapterGetInfo or unpacking struct:", e);
                this._info = EMPTY_ADAPTER_INFO;
            } finally {
                if (infoStructPtr) {
                    this.lib.wgpuAdapterInfoFreeMembers(infoStructPtr);
                }
            }
        }

        return this._info;
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
        this._queue?.destroy();
        this._queue = null;

        this.lib.wgpuDeviceDestroy(this.devicePtr);
        this.instanceTicker.processEvents();
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