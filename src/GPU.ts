/// <reference types="@webgpu/types" />
import { JSCallback, toArrayBuffer, type Pointer, ptr, FFIType } from "bun:ffi";
import { FFI_SYMBOLS } from "./ffi";
import { GPUAdapterImpl } from "./GPUAdapter";
import { 
  WGPUCallbackMode, 
  WGPUCallbackInfoStruct, 
  WGPURequestAdapterOptionsStruct, 
} from "./structs_def";
import { fatalError } from "./utils/error";

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
  
  constructor(public readonly instancePtr: Pointer, private lib: typeof FFI_SYMBOLS) {}

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
          this.lib.wgpuInstanceProcessEvents(this.instancePtr);
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

  constructor(private instancePtr: Pointer, private lib: typeof FFI_SYMBOLS) {
    this._ticker = new InstanceTicker(instancePtr, lib);
  }

  getPreferredCanvasFormat(): GPUTextureFormat {
    return 'bgra8unorm';
  }

  get wgslLanguageFeatures(): WGSLLanguageFeatures {
    console.error('wgslLanguageFeatures not implemented');
    throw new Error("Not implemented");
  }

  requestAdapter(options?: GPURequestAdapterOptions): Promise<GPUAdapter | null> {
    if (this._destroyed) {
      return Promise.reject(new Error("GPU instance has been destroyed"));
    }
    
    return new Promise((resolve, reject) => {
        let packedOptionsPtr: Pointer | null = null;
        let jsCallback: JSCallback | null = null;
        let callbackInfoBuffer: ArrayBuffer | null = null;

        try {
            // --- 1. Pack Options Struct ---
            if (options) {
                const buffer = WGPURequestAdapterOptionsStruct.pack(options); 
                packedOptionsPtr = ptr(buffer);
            }

            // --- 2. Create JSCallback ---
            const callbackFn = (status: number, adapterPtr: Pointer | null, messagePtr: Pointer | null, messageSize: number, userdata1: Pointer | null, userdata2: Pointer | null) => {
                this._ticker.unregister();
                const message = messagePtr ? Buffer.from(toArrayBuffer(messagePtr)).toString() : null;

                if (status === RequestAdapterStatus.Success) {
                    if (adapterPtr) {
                        resolve(new GPUAdapterImpl(adapterPtr, this.instancePtr, this.lib, this._ticker));
                    } else {
                        console.error("WGPU Error: requestAdapter Success but adapter pointer is null.");
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
                } else {
                    console.warn("requestAdapter C-Callback: jsCallback handle was null, couldn't close.");
                }
                callbackInfoBuffer = null;
            };

            jsCallback = new JSCallback(callbackFn, { 
              args: [FFIType.u32, FFIType.pointer, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer ], returns: FFIType.void 
            });

            if (!jsCallback?.ptr) {
                fatalError("Failed to create JSCallback");
            }

            // --- 3. Pack CallbackInfo Struct ---
            const buffer = WGPUCallbackInfoStruct.pack({
                nextInChain: null,
                mode: "AllowProcessEvents",
                callback: jsCallback?.ptr,
                userdata1: null,
                userdata2: null,
            });

            const packedCallbackInfoPtr = ptr(buffer);

            // --- 4. Call FFI ---
            this.lib.wgpuInstanceRequestAdapter(
                this.instancePtr,
                packedOptionsPtr,
                packedCallbackInfoPtr
            );
            this._ticker.register();
        } catch (e) {
            console.error("Error during requestAdapter setup or FFI call:", e);
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

