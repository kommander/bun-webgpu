/// <reference types="../index.d.ts" />
import { type Pointer, FFIType, JSCallback, ptr, toArrayBuffer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPUDeviceImpl } from "./GPUDevice";
import { 
    WGPUCallbackInfoStruct, 
    WGPUDeviceDescriptorStruct, 
    type WGPUUncapturedErrorCallbackInfo, 
    WGPULimitsStruct, 
    WGPUSupportedFeaturesStruct,
    WGPUAdapterInfoStruct,
    WGPUDeviceLostReasonDef,
} from "./structs_def";
import { createWGPUError, fatalError, GPUErrorImpl, OperationError } from "./utils/error";
import type { InstanceTicker } from "./GPU";
import { allocStruct } from "./structs_ffi";
import { GPUAdapterInfoImpl, normalizeIdentifier, DEFAULT_SUPPORTED_LIMITS, GPUSupportedLimitsImpl, decodeCallbackMessage } from "./shared";

const RequestDeviceStatus = {
  Success: 1,
  CallbackCancelled: 2,
  Error: 3,
  Unknown: 4,
} as const;
const ReverseDeviceStatus = Object.fromEntries(Object.entries(RequestDeviceStatus).map(([key, value]) => [value, key]));
                      
const EMPTY_ADAPTER_INFO: Readonly<GPUAdapterInfo> = Object.create(GPUAdapterInfoImpl.prototype);
const DEFAULT_LIMITS = Object.assign(Object.create(GPUSupportedLimitsImpl.prototype), DEFAULT_SUPPORTED_LIMITS);

export class GPUUncapturedErrorEventImpl extends Event implements GPUUncapturedErrorEvent {
    __brand: "GPUUncapturedErrorEvent" = "GPUUncapturedErrorEvent";
    error: GPUError;

    constructor(error: GPUError) {
        super('uncapturederror', { bubbles: true, cancelable: true });
        this.error = error;
    }
}

export class GPUAdapterImpl implements GPUAdapter {
    __brand: "GPUAdapter" = "GPUAdapter";
    private _features: GPUSupportedFeatures | null = null;
    private _limits: GPUSupportedLimits = DEFAULT_LIMITS;
    private _info: GPUAdapterInfo = EMPTY_ADAPTER_INFO;
    private _destroyed = false;
    private _device: GPUDeviceImpl | null = null;
    private _state: 'valid' | 'consumed' | 'invalid' = 'valid';

    constructor(
      public readonly adapterPtr: Pointer,
      private instancePtr: Pointer,
      private lib: FFISymbols,
      private instanceTicker: InstanceTicker,
    ) {}

    get info(): GPUAdapterInfo {
        if (this._destroyed) {
            return EMPTY_ADAPTER_INFO;
        }

        if (this._info === EMPTY_ADAPTER_INFO) {
            let infoStructPtr: Pointer | null = null;
            try {
                const { buffer: structBuffer } = allocStruct(WGPUAdapterInfoStruct);
                infoStructPtr = ptr(structBuffer);
                const status = this.lib.wgpuAdapterGetInfo(this.adapterPtr, infoStructPtr);

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
                this._info = EMPTY_ADAPTER_INFO; // Cache default on error
            } finally {
                if (infoStructPtr) {
                    this.lib.wgpuAdapterInfoFreeMembers(infoStructPtr);
                }
            }
        }

        return this._info;
    }

    get features(): GPUSupportedFeatures {
        if (this._destroyed) {
            console.warn("Accessing features on destroyed GPUAdapter");
            return Object.freeze(new Set<GPUFeatureName>());
        }
        if (this._features === null) {
             try {
                const { buffer: featuresStructBuffer, subBuffers } = allocStruct(WGPUSupportedFeaturesStruct, {
                    lengths: {
                        features: 128, // 77 known features + some room for unknown features or future features
                    },
                });
                
                this.lib.wgpuAdapterGetFeatures(this.adapterPtr, ptr(featuresStructBuffer));
                const supportedFeatures = new Set<GPUFeatureName>();

                const unpacked = WGPUSupportedFeaturesStruct.unpack(featuresStructBuffer);
                if (unpacked.features && unpacked.featureCount && unpacked.featureCount > 0) {
                    for (const feature of unpacked.features) {
                        supportedFeatures.add(feature as GPUFeatureName);
                    }
                }
                this._features = Object.freeze(supportedFeatures);

             } catch (e) {
                  console.error("Error calling adapterGetFeatures FFI function:", e);
                  return Object.freeze(new Set<GPUFeatureName>());
             }
        }

        return this._features;
     }

    get limits(): GPUSupportedLimits {
        if (this._destroyed) {
            return this._limits;
        }

        if (this._limits === null) {
            let limitsStructPtr: Pointer | null = null;
            try {
                const { buffer: structBuffer } = allocStruct(WGPULimitsStruct);
                limitsStructPtr = ptr(structBuffer);

                const status = this.lib.wgpuAdapterGetLimits(this.adapterPtr, limitsStructPtr);

                if (status !== 1) { // WGPUStatus_Success = 1
                    console.error(`wgpuAdapterGetLimits failed with status: ${status}`);
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
                console.error("Error calling wgpuAdapterGetLimits or unpacking struct:", e);
            }
        }
        return this._limits;
    }

    get isFallbackAdapter(): boolean {
        console.error('get isFallbackAdapter', this.adapterPtr);
        throw new Error("Not implemented");
    }

    private handleUncapturedError(devicePtr: Pointer, typeInt: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) {
        const message = decodeCallbackMessage(messagePtr, messageSize);
        const error = createWGPUError(typeInt, message);
        if (this._device) {
            const event: GPUUncapturedErrorEvent = new GPUUncapturedErrorEventImpl(error);
            this._device.handleUncapturedError(event);
            this._device.dispatchEvent(event);
        } else {
            console.error(`Device not found for uncaptured error`);
        }
    }

    private handleDeviceLost(devicePtr: Pointer | null, reason: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) {
        const message = decodeCallbackMessage(messagePtr, messageSize);
        this._state = 'invalid';
        if (this._device) {
            this._device.handleDeviceLost(WGPUDeviceLostReasonDef.from(reason) as GPUDeviceLostReason, message);
        }
    }

    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice> {
      if (this._destroyed) {
          return Promise.reject(new Error("Adapter destroyed"));
      }
      if (this._state === 'invalid') {
          this._device?.handleDeviceLost('unknown', 'Adapter already invalid', true);
          return Promise.resolve(this._device as GPUDevice);
      }
      if (this._state === 'consumed') {
          return Promise.reject(new OperationError("Adapter already consumed"));
      }
      
      this._state = 'consumed';

      return new Promise((resolve, reject) => {
          let packedDescriptorPtr: Pointer | null = null;
          let jsCallback: JSCallback | null = null;

          try {
              // --- 1. Pack Descriptor ---
              const uncapturedErrorCallback = new JSCallback(
                  (
                      devicePtr: Pointer,
                      typeInt: number,
                      messagePtr: Pointer | null,
                      messageSize: bigint,
                      userdata1: Pointer | null,
                      userdata2: Pointer | null
                  ) => {
                      this.handleUncapturedError(devicePtr, typeInt, messagePtr, messageSize, userdata1, userdata2);
                  },
                  {
                    // NOTE: The message is a WGPUStringView, which is a struct with a pointer and a size.
                    // FFI cannot represent this directly, so it is passed in two arguments a pointer+size.
                    args: [FFIType.pointer, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ],
                    returns: FFIType.void
                  }
              );

              if (!uncapturedErrorCallback.ptr) {
                fatalError("Failed to create uncapturedErrorCallback");
              }
              
              const deviceLostCallback = new JSCallback(
                (
                    devicePtr: Pointer | null,
                    reason: number,
                    messagePtr: Pointer | null,
                    messageSize: bigint,
                    userdata1: Pointer | null,
                    userdata2: Pointer | null
                ) => {
                    this.handleDeviceLost(devicePtr, reason, messagePtr, messageSize, userdata1, userdata2);
                },
                {
                  args: [FFIType.pointer, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ],
                  returns: FFIType.void,
                }
              );

              if (!deviceLostCallback.ptr) {
                fatalError("Failed to create deviceLostCallback");
              }

              const fullDescriptor: GPUDeviceDescriptor & {
                uncapturedErrorCallbackInfo: WGPUUncapturedErrorCallbackInfo,
                deviceLostCallbackInfo: ReturnType<typeof WGPUCallbackInfoStruct.unpack>,
                defaultQueue: GPUQueueDescriptor,
              } = {
                ...descriptor,
                uncapturedErrorCallbackInfo: {
                  callback: uncapturedErrorCallback.ptr,
                  userdata1: null,
                  userdata2: null,
                },
                deviceLostCallbackInfo: {
                  nextInChain: null,
                  mode: 'AllowProcessEvents',
                  callback: deviceLostCallback.ptr,
                  userdata1: null,
                  userdata2: null,
                },
                defaultQueue: {
                  label: 'default queue',
                },
              }
              
              try {
                const limits = this.limits;
                const features = this.features;
                const descBuffer = WGPUDeviceDescriptorStruct.pack(fullDescriptor, { 
                    validationHints: {
                        limits,
                        features,
                    }
                });
                packedDescriptorPtr = ptr(descBuffer);
              } catch (e) {
                this._state = 'valid';
                reject(e);
                return;
              }

              // --- 2. Create JSCallback ---
              const callbackFn = (status: number, devicePtr: Pointer | null, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) => {
                  this.instanceTicker.unregister();
                  const message = decodeCallbackMessage(messagePtr, messageSize);
                  
                  if (status === RequestDeviceStatus.Success) {
                      if (devicePtr) {
                            const device = new GPUDeviceImpl(devicePtr, this.lib, this.instanceTicker);
                            this._device = device;
                            resolve(device);
                        } else {
                            console.error("WGPU Error: requestDevice Success but device pointer is null.");
                            reject(new Error(`WGPU Error (Success but null device): ${message || 'No message.'}`));
                        }
                  } else {
                      this._state = 'valid';
                      let statusName = ReverseDeviceStatus[status] || 'Unknown WGPU Error';
                      reject(new OperationError(`WGPU Error (${statusName}): ${message || 'No message provided.'}`));
                  }

                  if (jsCallback) {
                      jsCallback.close();
                  }
              };

              jsCallback = new JSCallback(callbackFn, {
                args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ], returns: FFIType.void
              });

              if (!jsCallback?.ptr) {
                fatalError("Failed to create JSCallback");
              }

              // --- 3. Pack CallbackInfo ---
              const buffer = WGPUCallbackInfoStruct.pack({
                  nextInChain: null,
                  mode: "AllowProcessEvents",
                  callback: jsCallback?.ptr,
                  userdata1: null,
                  userdata2: null,
              });

              const packedCallbackInfoPtr = ptr(buffer);

              // --- 4. Call FFI ---
              this.lib.wgpuAdapterRequestDevice(
                  this.adapterPtr,
                  packedDescriptorPtr,
                  packedCallbackInfoPtr
              );

              this.instanceTicker.register();
          } catch (e) {
              console.error("Error during requestDevice:", e);
              this._state = 'valid';
              if (jsCallback) jsCallback.close();
              reject(e);
          }
      });
    }

    destroy(): undefined {
      if (this._destroyed) return;

      this._destroyed = true;
      this._features = null;
      
      try {
          this.lib.wgpuAdapterRelease(this.adapterPtr);
      } catch(e) {
          console.error("FFI Error: wgpuAdapterRelease", e);
      }

      return undefined;
  }
}
