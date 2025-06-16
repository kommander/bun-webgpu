import { FFIType, JSCallback, type Pointer, ptr } from "bun:ffi";
import { 
    WGPUSupportedFeaturesStruct, 
    WGPUFragmentStateStruct, 
    WGPUBindGroupLayoutDescriptorStruct, 
    WGPUShaderModuleDescriptorStruct, 
    WGPUSType, 
    WGPUShaderSourceWGSLStruct, 
    WGPUPipelineLayoutDescriptorStruct, 
    WGPUBindGroupDescriptorStruct, 
    WGPURenderPipelineDescriptorStruct, 
    WGPUVertexStateStruct, 
    WGPUComputeStateStruct, 
    UINT64_MAX, 
    WGPUCommandEncoderDescriptorStruct, 
    WGPUQuerySetDescriptorStruct, 
    WGPUAdapterInfoStruct, 
    WGPUErrorFilter, 
    WGPUCallbackInfoStruct, 
    WGPUExternalTextureBindingLayoutStruct, 
    normalizeGPUExtent3DStrict, 
    WGPUStringView,
} from "./structs_def";
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
import { createWGPUError, fatalError, GPUPipelineErrorImpl, OperationError } from "./utils/error";
import { WGPULimitsStruct } from "./structs_def";
import { WGPUBufferDescriptorStruct, WGPUTextureDescriptorStruct, WGPUSamplerDescriptorStruct, WGPURenderBundleEncoderDescriptorStruct } from "./structs_def";
import type { InstanceTicker } from "./GPU";
import { normalizeIdentifier, DEFAULT_SUPPORTED_LIMITS, GPUSupportedLimitsImpl, decodeCallbackMessage, AsyncStatus, unpackUserDataId, packUserDataId } from "./shared";
import { GPUAdapterInfoImpl, WGPUErrorType } from "./shared";
import { EventEmitter } from "events";
import { GPUTextureViewImpl } from "./GPUTextureView";
import { GPURenderBundleEncoderImpl } from "./GPURenderBundleEncoder";

type EventListenerOptions = any;
export type DeviceErrorCallback = (this: GPUDevice, ev: GPUUncapturedErrorEvent) => any;

const PopErrorScopeStatus = {
    Success: 1,
    CallbackCancelled: 2,
    Error: 3,
} as const;

function isDepthTextureFormat(format: string): boolean {
    return format === 'depth16unorm' || 
           format === 'depth24plus' || 
           format === 'depth24plus-stencil8' || 
           format === 'depth32float' || 
           format === 'depth32float-stencil8';
}

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

let createComputePipelineAsyncId = 0;
let createRenderPipelineAsyncId = 0;

export class GPUDeviceImpl extends EventEmitter implements GPUDevice {
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
    private _errorScopePopId = 0;
    private _popErrorScopeCallback: JSCallback;
    private _popErrorScopePromises: Map<number, {
        resolve: (value: GPUError | null) => void,
        reject: (reason?: any) => void,
    }> = new Map();

    private _createComputePipelineAsyncCallback: JSCallback;
    private _createComputePipelineAsyncPromises: Map<number, {
        resolve: (value: GPUComputePipeline) => void,
        reject: (reason?: any) => void,
    }> = new Map();

    private _createRenderPipelineAsyncCallback: JSCallback;
    private _createRenderPipelineAsyncPromises: Map<number, {
        resolve: (value: GPURenderPipeline) => void,
        reject: (reason?: any) => void,
    }> = new Map();

    private _buffers: Set<GPUBufferImpl> = new Set();

    __brand: "GPUDevice" = "GPUDevice";
    label: string = '';

    constructor(public readonly devicePtr: Pointer, private lib: FFISymbols, private instanceTicker: InstanceTicker) {
      super();
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
        (status: number, errorType: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer, userdata2: Pointer | null) => {
            this.instanceTicker.unregister();
            
            const popId = unpackUserDataId(userdata1);
            const promiseData = this._popErrorScopePromises.get(popId);
            
            this._popErrorScopePromises.delete(popId);
            
            if (promiseData) {
                if (messageSize === 0n) {
                    promiseData.resolve(null);
                } else if (status === PopErrorScopeStatus.Error) {
                    const message = decodeCallbackMessage(messagePtr, messageSize);
                    promiseData.reject(new OperationError(message));
                } else {
                    const message = decodeCallbackMessage(messagePtr, messageSize);
                    const error = createWGPUError(errorType, message);
                    promiseData.resolve(error);
                }
            } else {
                console.error('[POP ERROR SCOPE CALLBACK] promise not found for ID:', popId, 'Map size:', this._popErrorScopePromises.size);
            }
        },
        {
            args: [FFIType.u32, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
        }
      );

      this._createComputePipelineAsyncCallback = new JSCallback(
        (status: number, pipeline: Pointer | null, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer, userdata2: Pointer | null) => {
            this.instanceTicker.unregister();
            
            const asyncId = unpackUserDataId(userdata1);
            const promiseData = this._createComputePipelineAsyncPromises.get(asyncId);
            
            this._createComputePipelineAsyncPromises.delete(asyncId);
            
            if (promiseData) {
                if (status === AsyncStatus.Success) {
                    if (pipeline) {
                        const computePipeline = new GPUComputePipelineImpl(pipeline, this.lib, "async-compute-pipeline");
                        promiseData.resolve(computePipeline);
                    } else {
                        promiseData.reject(new Error("Pipeline creation succeeded but pipeline is null"));
                    }
                } else {
                    const message = messagePtr ? decodeCallbackMessage(messagePtr, messageSize) : "Unknown error";
                    promiseData.reject(new GPUPipelineErrorImpl(message, { reason: 'validation' }));
                }
            } else {
                console.error('[CREATE COMPUTE PIPELINE ASYNC CALLBACK] promise not found');
            }
        },
        {
            args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
        }
      );

      this._createRenderPipelineAsyncCallback = new JSCallback(
        (status: number, pipeline: Pointer | null, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer, userdata2: Pointer | null) => {
            this.instanceTicker.unregister();
            
            const asyncId = unpackUserDataId(userdata1);
            const promiseData = this._createRenderPipelineAsyncPromises.get(asyncId);
            
            this._createRenderPipelineAsyncPromises.delete(asyncId);
            
            if (promiseData) {
                if (status === AsyncStatus.Success) {
                    if (pipeline) {
                        const renderPipeline = new GPURenderPipelineImpl(pipeline, this.lib, "async-render-pipeline");
                        promiseData.resolve(renderPipeline);
                    } else {
                        promiseData.reject(new Error("Pipeline creation succeeded but pipeline is null"));
                    }
                } else {
                    const message = messagePtr ? decodeCallbackMessage(messagePtr, messageSize) : "Unknown error";
                    promiseData.reject(new GPUPipelineErrorImpl(message, { reason: 'validation' }));
                }
            } else {
                console.error('[CREATE RENDER PIPELINE ASYNC CALLBACK] promise not found');
            }
        },
        {
            args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
        }
      );
    }

    tick(): undefined {
        this.lib.wgpuDeviceTick(this.devicePtr);
        return undefined;
    }

    addEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void {
        if (typeof options === 'object' && options !== null && options.once) {
            this.once(type, listener);
        } else {
            this.on(type, listener);
        }
    }

    removeEventListener<K extends keyof __GPUDeviceEventMap>(type: K, listener: (this: GPUDevice, ev: __GPUDeviceEventMap[K]) => any, options?: boolean | EventListenerOptions): void {
        this.off(type, listener);
    }

    handleUncapturedError(event: GPUUncapturedErrorEvent) {
        this.emit('uncapturederror', event);
        if (this._userUncapturedErrorCallback) {
            this._userUncapturedErrorCallback.call(this, event);
        } else {
            console.error(`>>> JS Device Error Callback <<< Type: ${event.error.message}`);
        }
    }

    handleDeviceLost(reason: GPUDeviceLostReason, message: string, override: boolean = false) {
        if (override) {
            this._lost = Promise.resolve({ 
                reason, 
                message, 
                __brand: "GPUDeviceLostInfo" as const,
            });
            return;
        }
        if (this._lostPromiseResolve) {
            this._lostPromiseResolve({ 
                reason, 
                message, 
                __brand: "GPUDeviceLostInfo" as const,
            });
        }
    }

    dispatchEvent(event: Event): boolean {
        this.emit(event.type, event);
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
            const id = this._errorScopePopId++;
            const userDataBuffer = packUserDataId(id);
            const userDataPtr = ptr(userDataBuffer);
            this._popErrorScopePromises.set(id, { resolve, reject });

            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: this._popErrorScopeCallback.ptr!,
                userdata1: userDataPtr,
            });
            this.lib.wgpuDevicePopErrorScope(this.devicePtr, ptr(callbackInfo));
            this.instanceTicker.register();
        });
    }

    injectError(type: 'validation' | 'out-of-memory' | 'internal', message: string): undefined {
        if (this._destroyed) {
            fatalError('injectError on destroyed GPUDevice');
        }

        const errorType = WGPUErrorType[type];
        if (errorType === undefined) {
            fatalError(`Invalid error type for injectError: ${type}`);
        }

        const messageView = WGPUStringView.pack(message);
        
        this.lib.wgpuDeviceInjectError(this.devicePtr, errorType, ptr(messageView));
        return undefined;
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
                const { buffer: featuresStructBuffer } = allocStruct(WGPUSupportedFeaturesStruct, {
                    lengths: {
                        features: 128, // 77 known features + some room for unknown features or future features
                    }
                });
                
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
            throw new Error("Queue not initialized");
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

        for (const buffer of this._buffers) {
            buffer.destroy();
        }
        this._buffers.clear();

        this.lib.wgpuDeviceDestroy(this.devicePtr);
        this.instanceTicker.processEvents();

        return undefined;
    }

    createBuffer(descriptor: GPUBufferDescriptor): GPUBuffer {
        if (descriptor.size < 0) {
            fatalError("Buffer size must be greater than or equal to 0");
        }

        if (descriptor.mappedAtCreation && descriptor.size % 4 !== 0) {
            throw new RangeError("Buffer size must be a multiple of 4");
        }
        if (descriptor.size > this.limits.maxBufferSize) {
            throw new RangeError(`Buffer size must be less than or equal to ${this.limits.maxBufferSize}`);
        }
        
        const packedDescriptor = WGPUBufferDescriptorStruct.pack(descriptor);

        const bufferPtr = this.lib.wgpuDeviceCreateBuffer(
            this.devicePtr,
            ptr(packedDescriptor)
        );

        if (!bufferPtr) {
            fatalError("Failed to create buffer");
        }

        const buffer = new GPUBufferImpl(bufferPtr, this, this.lib, descriptor, this.instanceTicker);
        this._buffers.add(buffer);
        buffer.on('destroyed', () => this._buffers.delete(buffer));
        return buffer;
    }

    createTexture(descriptor: GPUTextureDescriptor): GPUTexture {
        const packedDescriptor = WGPUTextureDescriptorStruct.pack(descriptor);
        try {
            const texturePtr = this.lib.wgpuDeviceCreateTexture(
                this.devicePtr,
                ptr(packedDescriptor)
            );
            
            if (!texturePtr) {
                fatalError("Failed to create texture");
            }

            const { width, height = 1, depthOrArrayLayers = 1 } = normalizeGPUExtent3DStrict(descriptor.size);
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
        
        const entries = Array.from(descriptor.entries).map((e) => {
            if (e.externalTexture) {
                const chainedStruct = WGPUExternalTextureBindingLayoutStruct.pack({
                    chain: {
                        next: null,
                        sType: WGPUSType.ExternalTextureBindingLayout
                    }
                })
                return {
                    ...e,
                    nextInChain: ptr(chainedStruct)
                }
            }
            return e;
        });

        const packedDescriptorBuffer = WGPUBindGroupLayoutDescriptorStruct.pack({
            ...descriptor,
            entries
        });
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
        const entries = Array.from(descriptor.entries)
        for (let i = 0; i < entries.length; i++) {
            const e = entries[i]!;
            if (e.resource instanceof GPUBufferImpl) {
                entries[i] = {
                    ...e,
                    buffer: e.resource,
                    offset: e.resource.offset ?? 0n,
                    size: e.resource.size ?? UINT64_MAX
                } as GPUBindGroupEntry;
            } else if (e.resource instanceof GPUTextureViewImpl) {
                entries[i] = {
                    ...e,
                    textureView: e.resource
                } as GPUBindGroupEntry;
            } else if (isBufferBinding(e.resource)) {
                entries[i] = {
                    ...e,
                    buffer: e.resource.buffer,
                    offset: e.resource.offset ?? 0n,
                    size: e.resource.size ?? UINT64_MAX
                } as GPUBindGroupEntry;
            } else if (isSampler(e.resource)) {
                entries[i] = {
                    ...e,
                    sampler: e.resource
                } as GPUBindGroupEntry;
            } else if (isTextureView(e.resource)) {
                entries[i] = {
                    ...e,
                    textureView: e.resource
                } as GPUBindGroupEntry;
            }
        }
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

    _prepareComputePipelineDescriptor(descriptor: GPUComputePipelineDescriptor): ArrayBuffer {
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

        return packedPipelineDescriptor;
    }

    createComputePipeline(descriptor: GPUComputePipelineDescriptor): GPUComputePipeline {
        const packedPipelineDescriptor = this._prepareComputePipelineDescriptor(descriptor);

        let pipelinePtr: Pointer | null = null;
        pipelinePtr = this.lib.wgpuDeviceCreateComputePipeline(
            this.devicePtr,
            ptr(packedPipelineDescriptor)
        );
        
        if (!pipelinePtr) {
            fatalError("Failed to create compute pipeline (FFI returned null)");
        }
        return new GPUComputePipelineImpl(pipelinePtr, this.lib, descriptor.label);
    }

    _prepareRenderPipelineDescriptor(descriptor: GPURenderPipelineDescriptor): ArrayBuffer {
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

        return packedPipelineDescriptor;
    }

    createRenderPipeline(descriptor: GPURenderPipelineDescriptor): GPURenderPipeline {
        // Validate depthStencil state
        if (descriptor.depthStencil) {
            const format = descriptor.depthStencil.format;
            const isDepthFormat = isDepthTextureFormat(format);
            
            if (isDepthFormat && descriptor.depthStencil.depthWriteEnabled === undefined) {
                this.injectError('validation', 'depthWriteEnabled is required for depth formats');
            }

            // Check if depthCompare is required
            if (isDepthFormat) {
                const depthWriteEnabled = descriptor.depthStencil.depthWriteEnabled;
                const stencilFront = descriptor.depthStencil.stencilFront;
                const stencilBack = descriptor.depthStencil.stencilBack;
                
                const frontDepthFailOp = stencilFront?.depthFailOp || 'keep';
                const backDepthFailOp = stencilBack?.depthFailOp || 'keep';
                const depthFailOpsAreKeep = frontDepthFailOp === 'keep' && backDepthFailOp === 'keep';
                
                if ((depthWriteEnabled || !depthFailOpsAreKeep) && descriptor.depthStencil.depthCompare === undefined) {
                    this.injectError('validation', 'depthCompare is required when depthWriteEnabled is true or stencil depth fail operations are not keep');
                }
            }
        }
        const packedPipelineDescriptor = this._prepareRenderPipelineDescriptor(descriptor);

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
        if (this._destroyed) {
            return Promise.reject(new Error('createComputePipelineAsync on destroyed GPUDevice'));
        }

        return new Promise((resolve, reject) => {
            const id = createComputePipelineAsyncId++;
            const userDataBuffer = packUserDataId(id);
            this._createComputePipelineAsyncPromises.set(id, { resolve, reject });
            const userDataPtr = ptr(userDataBuffer);
            const packedPipelineDescriptor = this._prepareComputePipelineDescriptor(descriptor);
            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: this._createComputePipelineAsyncCallback.ptr!,
                userdata1: userDataPtr,
            });

            this.lib.wgpuDeviceCreateComputePipelineAsync(
                this.devicePtr,
                ptr(packedPipelineDescriptor),
                ptr(callbackInfo)
            );
            this.instanceTicker.register();
        });
    }

    createRenderPipelineAsync(descriptor: GPURenderPipelineDescriptor): Promise<GPURenderPipeline> {
        if (this._destroyed) {
            return Promise.reject(new Error('createRenderPipelineAsync on destroyed GPUDevice'));
        }

        // Validate depthStencil state
        if (descriptor.depthStencil) {
            const format = descriptor.depthStencil.format;
            const isDepthFormat = isDepthTextureFormat(format);
            
            if (isDepthFormat && descriptor.depthStencil.depthWriteEnabled === undefined) {
                return Promise.reject(new GPUPipelineErrorImpl('depthWriteEnabled is required for depth formats', { reason: 'validation' }));
            }

            // Check if depthCompare is required
            if (isDepthFormat) {
                const depthWriteEnabled = descriptor.depthStencil.depthWriteEnabled;
                const stencilFront = descriptor.depthStencil.stencilFront;
                const stencilBack = descriptor.depthStencil.stencilBack;
                
                const frontDepthFailOp = stencilFront?.depthFailOp || 'keep';
                const backDepthFailOp = stencilBack?.depthFailOp || 'keep';
                const depthFailOpsAreKeep = frontDepthFailOp === 'keep' && backDepthFailOp === 'keep';
                
                if ((depthWriteEnabled || !depthFailOpsAreKeep) && descriptor.depthStencil.depthCompare === undefined) {
                    return Promise.reject(new GPUPipelineErrorImpl('depthCompare is required when depthWriteEnabled is true or stencil depth fail operations are not keep', { reason: 'validation' }));
                }
            }
        }

        return new Promise((resolve, reject) => {
            const id = createRenderPipelineAsyncId++;
            const userDataBuffer = packUserDataId(id);
            this._createRenderPipelineAsyncPromises.set(id, { resolve, reject });
            const userDataPtr = ptr(userDataBuffer);
            const packedPipelineDescriptor = this._prepareRenderPipelineDescriptor(descriptor);
            const callbackInfo = WGPUCallbackInfoStruct.pack({
                mode: 'AllowProcessEvents',
                callback: this._createRenderPipelineAsyncCallback.ptr!,
                userdata1: userDataPtr,
            });

            this.lib.wgpuDeviceCreateRenderPipelineAsync(
                this.devicePtr,
                ptr(packedPipelineDescriptor),
                ptr(callbackInfo)
            );
            this.instanceTicker.register();
        });
    }

    createRenderBundleEncoder(descriptor: GPURenderBundleEncoderDescriptor): GPURenderBundleEncoder {
        if (this._destroyed) {
            fatalError("Cannot call createRenderBundleEncoder on a destroyed GPUDevice");
        }
        const colorFormats = Array.from(descriptor.colorFormats).filter(f => f !== null && f !== undefined) as GPUTextureFormat[];
        const packedDescriptor = WGPURenderBundleEncoderDescriptorStruct.pack({
            ...descriptor,
            colorFormats,
        });
        const encoderPtr = this.lib.wgpuDeviceCreateRenderBundleEncoder(this.devicePtr, ptr(packedDescriptor));
        if (!encoderPtr) {
            fatalError("Failed to create render bundle encoder");
        }
        return new GPURenderBundleEncoderImpl(encoderPtr, this.lib, descriptor);
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