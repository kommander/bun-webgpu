/// <reference types="../index.d.ts" />
import { type Pointer, FFIType, JSCallback, ptr, toArrayBuffer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { GPUDeviceImpl } from "./GPUDevice";
import { 
    WGPUCallbackInfoStruct, 
    WGPUDeviceDescriptorStruct, 
    WGPUErrorType, 
    type WGPUUncapturedErrorCallbackInfo, 
    WGPULimitsStruct, 
    WGPUSupportedFeaturesStruct,
    WGPUAdapterInfoStruct,
    WGPUDeviceLostReasonDef
} from "./structs_def";
import { fatalError, OperationError } from "./utils/error";
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
                      
let deviceCount = 0;

const EMPTY_ADAPTER_INFO: Readonly<GPUAdapterInfo> = Object.create(GPUAdapterInfoImpl.prototype);
const DEFAULT_LIMITS = Object.assign(Object.create(GPUSupportedLimitsImpl.prototype), DEFAULT_SUPPORTED_LIMITS);

export class GPUAdapterImpl implements GPUAdapter {
    __brand: "GPUAdapter" = "GPUAdapter";
    private _features: GPUSupportedFeatures | null = null;
    private _limits: GPUSupportedLimits = DEFAULT_LIMITS;
    private _info: GPUAdapterInfo = EMPTY_ADAPTER_INFO;
    private _destroyed = false;
    private _devices: Map<number, GPUDeviceImpl> = new Map();
    private _consumed = false;

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
                const featuresStructBuffer = new ArrayBuffer(16);
                const featuresBuffer = new ArrayBuffer(256);
                const featuresView = new DataView(featuresStructBuffer);
                const featuresPtr = ptr(featuresStructBuffer);
                
                featuresView.setBigUint64(8, BigInt(featuresPtr), true);
                this.lib.wgpuAdapterGetFeatures(this.adapterPtr, featuresPtr);
                const supportedFeatures = new Set<GPUFeatureName>();

                const unpacked = WGPUSupportedFeaturesStruct.unpack(featuresBuffer);
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
        const typeName = Object.keys(WGPUErrorType).find(key => WGPUErrorType[key as keyof typeof WGPUErrorType] === typeInt) || 'Unknown';

        if (!userdata1) {
            console.error('No userdata1 for uncaptured error');
            return;
        }

        try {
            const userdata1Buffer = toArrayBuffer(userdata1, 0, 4);
            const userDataView = new DataView(userdata1Buffer);
            const deviceId = userDataView.getUint32(0, true);
            const device = this._devices.get(deviceId);
            if (device) {
                const event: GPUUncapturedErrorEvent = Object.assign(new Event('uncapturederror', { bubbles: true, cancelable: true }), {
                    __brand: "GPUUncapturedErrorEvent" as const,
                    error: {
                        message: message || '(none)'
                    }
                });
                device.handleUncapturedError(event);
                device.dispatchEvent(event);
            } else {
                console.error(`Device ${deviceId} not found for uncaptured error`);
            }
        } catch (e) {
            console.error('Error getting deviceId from userdata1', e);
        }
    }

    private handleDeviceLost(devicePtr: Pointer | null, reason: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) {
        const message = decodeCallbackMessage(messagePtr, messageSize);
        if (!userdata1) {
            console.error('No userdata1 for device lost');
            return;
        }

        try {
            const userdata1Buffer = toArrayBuffer(userdata1, 0, 4);
            const userDataView = new DataView(userdata1Buffer);
            const deviceId = userDataView.getUint32(0, true);
            const device = this._devices.get(deviceId);
            
            if (device) {
                device.handleDeviceLost(WGPUDeviceLostReasonDef.from(reason) as GPUDeviceLostReason, message);
            }
        } catch (e) {
            console.error('Error getting deviceId from userdata1', e);
        }
    }

    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice> {
      if (this._destroyed) {
          return Promise.reject(new Error("Adapter destroyed"));
      }
      if (this._consumed) {
          return Promise.reject(new OperationError("Adapter already consumed"));
      }
      if (!this.adapterPtr) {
          return Promise.reject(new Error("Adapter pointer is null"));
      }

      this._consumed = true;

      return new Promise((resolve, reject) => {
          let packedDescriptorPtr: Pointer | null = null;
          let jsCallback: JSCallback | null = null;

          try {
              // --- 1. Pack Descriptor ---
              const userDataBuffer = new Uint32Array(1);
              userDataBuffer[0] = ++deviceCount;
              const userDataPtr = ptr(userDataBuffer.buffer);

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
                  userdata1: userDataPtr,
                  userdata2: null,
                },
                deviceLostCallbackInfo: {
                  nextInChain: null,
                  mode: 'AllowProcessEvents',
                  callback: deviceLostCallback.ptr,
                  userdata1: userDataPtr,
                  userdata2: null,
                },
                defaultQueue: {
                  label: 'default queue',
                },
              }
              
              try {
                const descBuffer = WGPUDeviceDescriptorStruct.pack(fullDescriptor, { validationHints: this._limits });
                packedDescriptorPtr = ptr(descBuffer);
              } catch (e) {
                this._consumed = false;
                reject(e);
                return;
              }

              // --- 2. Create JSCallback ---
              const callbackFn = (status: number, devicePtr: Pointer | null, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer | null, userdata2: Pointer | null) => {
                  this.instanceTicker.unregister();
                  const message = decodeCallbackMessage(messagePtr, messageSize);
                  
                  if (status === RequestDeviceStatus.Success) {
                      if (userdata1 && devicePtr) {
                            const userdata1Buffer = toArrayBuffer(userdata1, 0, 4);
                            const userDataView = new DataView(userdata1Buffer);
                            const deviceId = userDataView.getUint32(0, true);
                            const device = new GPUDeviceImpl(devicePtr, this.lib, this.instanceTicker);
                            this._devices.set(deviceId, device);
                            resolve(device);
                        } else {
                            console.error("WGPU Error: requestDevice Success but device pointer is null.");
                            reject(new Error(`WGPU Error (Success but null device): ${message || 'No message.'}`));
                        }
                  } else {
                      this._consumed = false;
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
                  userdata1: userDataPtr,
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
              this._consumed = false;
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
