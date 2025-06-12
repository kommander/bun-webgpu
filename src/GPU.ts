/// <reference types="@webgpu/types" />
import { JSCallback, toArrayBuffer, type Pointer, ptr, FFIType } from "bun:ffi";
import { type FFISymbols } from "./ffi";
import { GPUAdapterImpl } from "./GPUAdapter";
import { 
  WGPUCallbackInfoStruct, 
  WGPURequestAdapterOptionsStruct,
  WGPUSupportedWGSLLanguageFeaturesStruct,
} from "./structs_def";
import { fatalError } from "./utils/error";
import { allocStruct } from "./structs_ffi";

const RequestAdapterStatus = {
  Success: 1,
  CallbackCancelled: 2, // Not typically used directly from JS
  Unavailable: 3,
  Error: 4,
  Unknown: 5,
} as const;

export class InstanceTicker {
  private _waiting: number = 0;
  private _ticking = false;
  private _accTime: number = 0;
  private _lastTime: number = performance.now();
  
  constructor(public readonly instancePtr: Pointer, private lib: FFISymbols) {}

  register() {
      this._lastTime = performance.now();
      this._accTime = 0;
      this._waiting++;
      this.scheduleTick();
  }

  unregister() {
      this._waiting--;
  }

  hasWaiting() {
      return this._waiting > 0;
  }

  processEvents() {
    this._lastTime = performance.now();
    this._accTime = 0;
    this.lib.wgpuInstanceProcessEvents(this.instancePtr);
  }

  private scheduleTick() {
      if (this._ticking) return;
      this._ticking = true;
      setImmediate(() => {
          const now = performance.now();
          this._accTime += now - this._lastTime;
          this._lastTime = now;
          if (this._accTime > 0.05) {
            this.lib.wgpuInstanceProcessEvents(this.instancePtr);
            this._accTime = 0;
          }
          this._ticking = false;
          if (this.hasWaiting()) {
              this.scheduleTick();
          }
      });
  }
}

export class GPUImpl implements GPU {
  __brand: "GPU" = "GPU";
  private _destroyed = false;
  private _ticker: InstanceTicker;
  private _wgslLanguageFeatures: WGSLLanguageFeatures | null = null;

  constructor(private instancePtr: Pointer, private lib: FFISymbols) {
    this._ticker = new InstanceTicker(instancePtr, lib);
  }

  getPreferredCanvasFormat(): GPUTextureFormat {
    return 'bgra8unorm';
  }

  get wgslLanguageFeatures(): WGSLLanguageFeatures {
    if (this._destroyed) {
      console.warn("Accessing wgslLanguageFeatures on destroyed GPU instance");
      return Object.freeze(new Set<string>());
    }

    if (this._wgslLanguageFeatures === null) {
      try {
        const { buffer: structBuffer } = allocStruct(WGPUSupportedWGSLLanguageFeaturesStruct, {
          lengths: {
            features: 32,
          },
        });
        const status = this.lib.wgpuInstanceGetWGSLLanguageFeatures(this.instancePtr, ptr(structBuffer));
        
        if (status !== 1 /* WGPUStatus_Success */) {
          console.error(`wgpuInstanceGetWGSLLanguageFeatures failed with status: ${status}`);
          this._wgslLanguageFeatures = Object.freeze(new Set<string>());
          return this._wgslLanguageFeatures;
        }

        const unpacked = WGPUSupportedWGSLLanguageFeaturesStruct.unpack(structBuffer);
        const supportedFeatures = new Set<string>();

        if (unpacked.features) {
            for (const featureName of unpacked.features) {
                supportedFeatures.add(featureName as string);
            }
        }
        this._wgslLanguageFeatures = Object.freeze(supportedFeatures);
      } catch (e) {
         console.error("Error in wgslLanguageFeatures getter:", e);
         this._wgslLanguageFeatures = Object.freeze(new Set<string>());
      }
    }
    return this._wgslLanguageFeatures;
  }

  requestAdapter(options?: GPURequestAdapterOptions & { featureLevel?: 'core' | 'compatibility' }): Promise<GPUAdapter | null> {
    if (this._destroyed) {
      return Promise.reject(new Error("GPU instance has been destroyed"));
    }
    
    return new Promise((resolve, reject) => {
        let packedOptionsPtr: Pointer | null = null;
        let jsCallback: JSCallback | null = null;
        
        try {
            if (options) {
                try {
                    const buffer = WGPURequestAdapterOptionsStruct.pack(options); 
                    packedOptionsPtr = ptr(buffer);
                } catch (e) {
                    // console.error("Error packing WGPURequestAdapterOptionsStruct", e);
                    resolve(null);
                    return;
                }
            }

            const callbackFn = (status: number, adapterPtr: Pointer | null, messagePtr: Pointer | null, messageSize: number, userdata1: Pointer | null, userdata2: Pointer | null) => {
                this._ticker.unregister();
                const message = messagePtr ? Buffer.from(toArrayBuffer(messagePtr)).toString() : null;

                if (status === RequestAdapterStatus.Success) {
                    if (adapterPtr) {
                        resolve(new GPUAdapterImpl(adapterPtr, this.instancePtr, this.lib, this._ticker));
                    } else {
                        reject(new Error(`WGPU Error (Success but null adapter): ${message || 'No message.'}`));
                    }
                } else if (status === RequestAdapterStatus.Unavailable) {
                    resolve(null);
                } else {
                    let statusName = Object.keys(RequestAdapterStatus).find(key => RequestAdapterStatus[key as keyof typeof RequestAdapterStatus] === status) || 'Unknown WGPU Error';
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

            const buffer = WGPUCallbackInfoStruct.pack({
                nextInChain: null,
                mode: "AllowProcessEvents",
                callback: jsCallback?.ptr,
                userdata1: null,
                userdata2: null,
            });

            const packedCallbackInfoPtr = ptr(buffer);

            this.lib.wgpuInstanceRequestAdapter(
                this.instancePtr,
                packedOptionsPtr,
                packedCallbackInfoPtr
            );
            this._ticker.register();
        } catch (e) {
            if (jsCallback) jsCallback.close();
            reject(e);
        }
    });
  }

  destroy(): undefined {
    if (this._destroyed) return;
    this._destroyed = true;
    try {
        this.lib.wgpuInstanceRelease(this.instancePtr);
    } catch(e) {
        console.error("FFI Error: wgpuInstanceRelease", e);
    }
    return undefined;
  }
}

