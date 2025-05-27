/// <reference types="../index.d.ts" />
import { type Pointer, FFIType, JSCallback, ptr, toArrayBuffer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";
import { GPUDeviceImpl } from "./GPUDevice";
import { WGPUCallbackInfoStruct, WGPUCallbackMode, WGPUDeviceDescriptorStruct, WGPUErrorType, type WGPUUncapturedErrorCallbackInfo, WGPULimitsStruct, WGPUSupportedFeaturesStruct } from "./structs_def";
import { fatalError } from "./utils/error";
import type { InstanceTicker } from "./GPU";
import { WGPUFeatureNameDef } from "./structs_def";
import { allocStruct } from "./structs_ffi";

const RequestDeviceStatus = {
  Success: 1,
  CallbackCancelled: 2, // Not typically used directly from JS
  Error: 3,
  Unknown: 4,
} as const;

// This assumes WGPUFeatureNameDef values are contiguous or at least correctly ordered for bitmasking.
const BIT_INDEX_TO_FEATURE_NAME = Object.entries(WGPUFeatureNameDef.enum)
    .sort(([, aVal], [, bVal]) => (aVal as number) - (bVal as number))
    .map(([name]) => name as GPUFeatureName);

let deviceCount = 0;

const DEFAULT_ADAPTER_LIMITS: GPUSupportedLimits = Object.freeze({
    __brand: "GPUSupportedLimits" as const,
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
    maxInterStageShaderVariables: 0,
    maxColorAttachments: 0,
    maxColorAttachmentBytesPerSample: 0,
    maxComputeWorkgroupStorageSize: 0,
    maxComputeInvocationsPerWorkgroup: 0,
    maxComputeWorkgroupSizeX: 0,
    maxComputeWorkgroupSizeY: 0,
    maxComputeWorkgroupSizeZ: 0,
    maxComputeWorkgroupsPerDimension: 0,
});

export class GPUAdapterImpl implements GPUAdapter {
    __brand: "GPUAdapter" = "GPUAdapter";
    private _features: GPUSupportedFeatures | null = null;
    private _limits: GPUSupportedLimits | null = null;
    private _destroyed = false;
    private _devices: Map<number, GPUDeviceImpl> = new Map();
    private globalJSErrorCallbackHandle: JSCallback | null = null;

    constructor(
      public readonly adapterPtr: Pointer,
      private instancePtr: Pointer,
      private lib: typeof FFI_SYMBOLS,
      private instanceTicker: InstanceTicker,
    ) {}

    get info(): GPUAdapterInfo {
        console.error('get info', this.adapterPtr);
        throw new Error("Not implemented");
    }

    get features(): GPUSupportedFeatures {
        if (this._destroyed) {
            console.warn("Accessing features on destroyed GPUAdapter");
            return Object.freeze(new Set<GPUFeatureName>());
        }
        if (this._features === null) {
             try {
                 const { buffer: featuresBuffer } = allocStruct(WGPUSupportedFeaturesStruct);
                 const featuresPtr = ptr(featuresBuffer);
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
            console.warn("Accessing limits on destroyed GPUAdapter");
            return DEFAULT_ADAPTER_LIMITS;
        }
        if (this._limits === null) {
            let limitsStructPtr: Pointer | null = null;
            try {
                const { buffer: structBuffer } = allocStruct(WGPULimitsStruct);
                limitsStructPtr = ptr(structBuffer);

                const status = this.lib.wgpuAdapterGetLimits(this.adapterPtr, limitsStructPtr);

                if (status !== 1) { // WGPUStatus_Success = 1
                    console.error(`wgpuAdapterGetLimits failed with status: ${status}`);
                    this._limits = DEFAULT_ADAPTER_LIMITS; // Cache default on failure
                    return this._limits;
                }

                const jsLimits = WGPULimitsStruct.unpack(structBuffer);

                this._limits = Object.freeze({
                    __brand: "GPUSupportedLimits" as const,
                    ...jsLimits,
                    maxUniformBufferBindingSize: Number(jsLimits.maxUniformBufferBindingSize),
                    maxStorageBufferBindingSize: Number(jsLimits.maxStorageBufferBindingSize),
                    maxBufferSize: Number(jsLimits.maxBufferSize),
                } as GPUSupportedLimits);

            } catch (e) {
                console.error("Error calling wgpuAdapterGetLimits or unpacking struct:", e);
                this._limits = DEFAULT_ADAPTER_LIMITS; // Cache default on error
            }
        }
        return this._limits;
    }

    get isFallbackAdapter(): boolean {
        console.error('get isFallbackAdapter', this.adapterPtr);
        throw new Error("Not implemented");
    }

    private handleUncapturedError(devicePtr: Pointer, typeInt: number, messagePtr: Pointer | null, _unknown: number, userdata1: Pointer | null, userdata2: Pointer | null) {
        const message = messagePtr ? Buffer.from(toArrayBuffer(messagePtr)).toString() : undefined;
        const typeName = Object.keys(WGPUErrorType).find(key => WGPUErrorType[key as keyof typeof WGPUErrorType] === typeInt) || 'Unknown';

        if (userdata1) {
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
                }
            } catch (e) {
                console.error('Error getting deviceId from userdata1', e);
            }
        }
    }

    requestDevice(descriptor?: GPUDeviceDescriptor): Promise<GPUDevice> {
      if (this._destroyed) {
          console.warn("requestDevice called on destroyed GPUAdapter.");
          // Spec doesn't explicitly state rejection, but it seems logical.
          return Promise.reject(new Error("Adapter destroyed"));
      }
      if (!this.adapterPtr) {
          return Promise.reject(new Error("Adapter pointer is null"));
      }

      return new Promise((resolve, reject) => {
          let packedDescriptorPtr: Pointer | null = null;
          let jsCallback: JSCallback | null = null;

          try {
              // --- 1. Pack Descriptor ---
              const deviceId = ++deviceCount;
              const userDataBuffer = new Uint32Array(1);
              userDataBuffer[0] = deviceId;
              const userDataPtr = ptr(userDataBuffer.buffer);

              const uncapturedErrorCallback = new JSCallback(
                  (
                      devicePtr: Pointer,
                      typeInt: number,
                      messagePtr: Pointer | null,
                      messageSize: number,
                      userdata1: Pointer | null,
                      userdata2: Pointer | null
                  ) => {
                      this.handleUncapturedError(devicePtr, typeInt, messagePtr, messageSize, userdata1, userdata2);
                  },
                  {
                    // NOTE: The message is a WGPUStringView, which is a struct with a pointer and a size.
                    // FFI cannot represent this directly, so it is passed in two arguments a pointer+size.
                    // At least is seems to be the size of the message, but I'm not sure.
                    args: [FFIType.pointer, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ],
                    returns: FFIType.void
                  }
              );
              this.globalJSErrorCallbackHandle = uncapturedErrorCallback;

              const deviceLostCallback = new JSCallback(
                (
                    devicePtr: Pointer | null,
                    reason: number,
                    messagePtr: Pointer | null,
                    messageSize: number,
                    userdata1: Pointer | null,
                    userdata2: Pointer | null
                ) => {
                    console.log('=== DEVICE LOST ===', devicePtr, reason, messagePtr, userdata1, userdata2);
                    // this.handleDeviceLost(devicePtr, typeInt, messagePtr, userdata1, userdata2);
                },
                {
                  args: [FFIType.pointer, FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ],
                  returns: FFIType.void
                }
              );

              if (!uncapturedErrorCallback.ptr) {
                fatalError("Failed to create uncapturedErrorCallback");
              }

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
                  userdata1: null,
                  userdata2: null,
                },
                defaultQueue: {
                  label: 'default queue',
                },
              }
              const descBuffer = WGPUDeviceDescriptorStruct.pack(fullDescriptor);
              packedDescriptorPtr = ptr(descBuffer);

              // --- 2. Create JSCallback ---
              const callbackFn = (status: number, devicePtr: Pointer | null, messagePtr: Pointer | null, messageSize: number, userdata1: Pointer | null, userdata2: Pointer | null) => {
                  this.instanceTicker.unregister();
                  const message = messagePtr ? Buffer.from(toArrayBuffer(messagePtr)).toString() : null;

                  if (status === RequestDeviceStatus.Success) {
                      if (devicePtr) {
                          const device = new GPUDeviceImpl(devicePtr, this.lib, this.instanceTicker);
                          this._devices.set(deviceId, device);
                          resolve(device);
                      } else {
                          console.error("WGPU Error: requestDevice Success but device pointer is null.");
                          reject(new Error(`WGPU Error (Success but null device): ${message || 'No message.'}`));
                      }
                  } else {
                      let statusName = Object.keys(RequestDeviceStatus).find(key => RequestDeviceStatus[key as keyof typeof RequestDeviceStatus] === status) || 'Unknown WGPU Error';
                      reject(new Error(`WGPU Error (${statusName}): ${message || 'No message provided.'}`));
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
              // Ignore future ID, rely on callback
              this.lib.wgpuAdapterRequestDevice(
                  this.adapterPtr,
                  packedDescriptorPtr, // Pass packed descriptor or null
                  packedCallbackInfoPtr
              );

              // Process events to trigger callback
              this.instanceTicker.register();
          } catch (e) {
              console.error("Error during requestDevice setup or FFI call:", e);
              if (jsCallback) jsCallback.close();
              reject(e);
          }
      });
    }

    destroy(): undefined {
      if (this._destroyed) return;

      this._destroyed = true;
      this._features = null; // Clear cache
      this._limits = null;   // Clear cache
      // this._info = null;     // Clear cache

      try {
          this.lib.wgpuAdapterRelease(this.adapterPtr);
      } catch(e) {
          console.error("FFI Error: wgpuAdapterRelease", e);
      }

      return undefined;
  }
}
