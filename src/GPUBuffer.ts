import { FFIType, JSCallback, ptr, toArrayBuffer, type Pointer } from "bun:ffi";
import type { FFI_SYMBOLS } from "./ffi";
import { BufferUsageFlags } from ".";
import { fatalError } from "./utils/error";
import { WGPUCallbackInfoStruct } from "./structs_def";
import type { InstanceTicker } from "./GPU";

const BufferMapAsyncStatus = {
  Success: 1,
  CallbackCancelled: 2,
  Error: 3,
  Aborted: 4,
  Force32: 0x7FFFFFFF,
} as const;

export class GPUBufferImpl implements GPUBuffer {
    private _size: GPUSize64;
    private _mode: GPUMapModeFlags | null = null;
    private _descriptor: GPUBufferDescriptor;
    private _mapState: GPUBufferMapState = 'unmapped';
    private _pendingMap: Promise<undefined> | null = null;

    __brand: "GPUBuffer" = "GPUBuffer";
    label: string = '';
    ptr: Pointer;

    constructor(
      public readonly bufferPtr: Pointer, 
      private lib: typeof FFI_SYMBOLS, 
      descriptor: GPUBufferDescriptor,
      private instanceTicker: InstanceTicker
    ) {
      this.ptr = bufferPtr;
      this._size = descriptor.size;
      this._descriptor = descriptor;
      this._mapState = descriptor.mappedAtCreation ? 'mapped' : 'unmapped';
    }

    get size(): GPUSize64 {
      return this._size;
    }

    get usage(): GPUFlagsConstant {
      return this._descriptor.usage;
    }

    get mapState(): GPUBufferMapState {
      return this._mapState;
    }

    mapAsync(mode: GPUMapModeFlags, offset?: GPUSize64, size?: GPUSize64): Promise<undefined> {
      if (this._pendingMap) {
        return this._pendingMap;
      }

      this._mode = mode;
      this._mapState = 'pending';
      this._pendingMap = new Promise((resolve, reject) => {
          // TODO: WGPU requires offset to be multiple of 8 or 0, size multiple of 4. ??
          const mapOffset = BigInt(offset ?? 0);
          const mapSize = BigInt(size ?? this._size);

          const callback = new JSCallback(
              (status: number, messagePtr: Pointer | null, messageSize: number, _userdata1: Pointer | null, _userdata2: Pointer | null) => {   
                this.instanceTicker.unregister();
                this._pendingMap = null;
                
                if (status === BufferMapAsyncStatus.Success) {
                    this._mapState = 'mapped';
                    resolve(undefined);
                } else {
                    this._mapState = 'unmapped';
                    console.error('WGPU Buffer Map Error', status);
                    const statusName = Object.keys(BufferMapAsyncStatus).find(key => BufferMapAsyncStatus[key as keyof typeof BufferMapAsyncStatus] === status) || 'Unknown Map Error';
                    const message = messagePtr ? Buffer.from(toArrayBuffer(messagePtr)).toString() : null;
                    reject(new Error(`WGPU Buffer Map Error (${statusName}): ${message}`));
                }

                queueMicrotask(() => {
                  callback.close(); 
                });
              },
              {
                  args: [FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
                  returns: FFIType.void,
              }
          );

          if (!callback || !callback.ptr) {
            this._pendingMap = null;
            fatalError('Could not create buffer map callback');
          }

          const callbackInfo = WGPUCallbackInfoStruct.pack({
            mode: 'AllowProcessEvents',
            callback: callback.ptr,
          });

          try {
              this.lib.wgpuBufferMapAsync(
                  this.bufferPtr,
                  mode,
                  mapOffset,
                  mapSize,
                  ptr(callbackInfo)
              );
              this.instanceTicker.register();
          } catch(e) {
              this._pendingMap = null;
              this._mapState = 'unmapped';
              this.instanceTicker.unregister();
              reject(e);
          }
      });

      return this._pendingMap;
    }

    getMappedRangePtr(offset?: GPUSize64, size?: GPUSize64): Pointer {
      if (this._descriptor.usage & BufferUsageFlags.MAP_READ) {
        return this._getConstMappedRangePtr(offset, size);
      }

      const mappedSize = size ?? this._size;
      const mappedOffset = offset ?? 0
      
      const readOffset = BigInt(mappedOffset);
      const readSize = BigInt(mappedSize);
      
      const dataPtr = this.lib.wgpuBufferGetMappedRange(this.bufferPtr, readOffset, readSize);
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          fatalError("getMappedRangePtr: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return dataPtr;
    }

    _getConstMappedRangePtr(offset?: GPUSize64, size?: GPUSize64): Pointer {
      const mappedOffset = offset ?? 0;
      const mappedSize = size ?? this._size;
      
      const readOffset = BigInt(mappedOffset);
      const readSize = BigInt(mappedSize);

      const dataPtr = this.lib.wgpuBufferGetConstMappedRange(this.bufferPtr, readOffset, readSize);
      
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          fatalError("getConstMappedRangePtr: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return dataPtr;
    }

    getMappedRange(offset?: GPUSize64, size?: GPUSize64): ArrayBuffer {
      if (this._descriptor.usage & BufferUsageFlags.MAP_READ) {
        return this._getConstMappedRange(offset, size);
      }

      const mappedSize = size ?? this._size;
      const mappedOffset = offset ?? 0
      
      const readOffset = BigInt(mappedOffset);
      const readSize = BigInt(mappedSize);
      
      const dataPtr = this.lib.wgpuBufferGetMappedRange(this.bufferPtr, readOffset, readSize);
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          fatalError("getMappedRange: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return toArrayBuffer(dataPtr, 0, Number(readSize));
    }

    _getConstMappedRange(offset?: GPUSize64, size?: GPUSize64): ArrayBuffer {
      const mappedOffset = offset ?? 0;
      const mappedSize = size ?? this._size;
      
      const readOffset = BigInt(mappedOffset);
      const readSize = BigInt(mappedSize);

      const dataPtr = this.lib.wgpuBufferGetConstMappedRange(this.bufferPtr, readOffset, readSize);
      
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          fatalError("getConstMappedRange: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return toArrayBuffer(dataPtr, 0, Number(readSize));
    }

    unmap(): undefined {
      this.lib.wgpuBufferUnmap(this.bufferPtr);
      this._mapState = 'unmapped';
      return undefined;
    }

    release(): undefined {
      try { 
        this.lib.wgpuBufferRelease(this.bufferPtr); 
      } catch(e) { 
        console.error("FFI Error: wgpuBufferRelease", e); 
      }
    }

    destroy(): undefined {
      try {
        this.lib.wgpuBufferDestroy(this.bufferPtr);
      } catch (e) {
         console.error("Error calling bufferDestroy FFI function:", e);
      }
    }
}