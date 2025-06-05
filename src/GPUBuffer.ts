import { FFIType, JSCallback, ptr, toArrayBuffer, type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { BufferUsageFlags } from "./common";
import { fatalError } from "./utils/error";
import { WGPUCallbackInfoStruct } from "./structs_def";
import type { InstanceTicker } from "./GPU";
import { decodeCallbackMessage } from "./shared";

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
    private _mapCallback: JSCallback;
    private _mapCallbackResolve: ((value: undefined) => void) | null = null;
    private _mapCallbackReject: ((reason?: any) => void) | null = null;
    private _destroyed = false;

    __brand: "GPUBuffer" = "GPUBuffer";
    label: string = '';
    ptr: Pointer;

    constructor(
      public readonly bufferPtr: Pointer, 
      private lib: FFISymbols, 
      descriptor: GPUBufferDescriptor,
      private instanceTicker: InstanceTicker
    ) {
      this.ptr = bufferPtr;
      this._size = descriptor.size;
      this._descriptor = descriptor;
      this._mapState = descriptor.mappedAtCreation ? 'mapped' : 'unmapped';
      this._mapCallback = new JSCallback(
        (status: number, messagePtr: Pointer | null, messageSize: bigint, _userdata1: Pointer | null, _userdata2: Pointer | null) => {   
          this.instanceTicker.unregister();
          this._pendingMap = null;
          
          if (status === BufferMapAsyncStatus.Success) {
              this._mapState = 'mapped';
              this._mapCallbackResolve?.(undefined);
          } else {
              this._mapState = 'unmapped';
              const statusName = Object.keys(BufferMapAsyncStatus).find(key => BufferMapAsyncStatus[key as keyof typeof BufferMapAsyncStatus] === status) || 'Unknown Map Error';
              const message = decodeCallbackMessage(messagePtr, messageSize);

              this._mapCallbackReject?.(new Error(`WGPU Buffer Map Error (${statusName}): ${message}`));
          }

          this._mapCallbackResolve = null;
          this._mapCallbackReject = null;

          if (this._destroyed) {
            this._mapCallback.close();
          }
        },
        {
            args: [FFIType.u32, FFIType.pointer, FFIType.u64, FFIType.pointer, FFIType.pointer],
            returns: FFIType.void,
        }
      );
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
      if (this._destroyed) {
        return Promise.reject(new Error('Buffer is destroyed'));
      }

      if (this._pendingMap) {
        // TODO: Should throw an error?
        return this._pendingMap;
      }

      this._mode = mode;
      this._mapState = 'pending';
      this._pendingMap = new Promise((resolve, reject) => {
          // TODO: WGPU requires offset to be multiple of 8 or 0, size multiple of 4. ??
          const mapOffset = BigInt(offset ?? 0);
          const mapSize = BigInt(size ?? this._size);

          this._mapCallbackResolve = resolve;
          this._mapCallbackReject = reject;

          if (!this._mapCallback.ptr) {
            fatalError('Could not create buffer map callback');
          }

          const callbackInfo = WGPUCallbackInfoStruct.pack({
            mode: 'AllowProcessEvents',
            callback: this._mapCallback.ptr,
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
      if (this._destroyed) {
        throw new Error('Buffer is destroyed');
      }

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
      if (this._destroyed) {
        throw new Error('Buffer is destroyed');
      }

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
      if (this._destroyed) {
        throw new Error('Buffer is destroyed');
      }

      this.lib.wgpuBufferUnmap(this.bufferPtr);
      this._mapState = 'unmapped';
      return undefined;
    }

    release(): undefined {
      if (this._destroyed) {
        throw new Error('Buffer is destroyed');
      }

      try { 
        this.lib.wgpuBufferRelease(this.bufferPtr); 
      } catch(e) { 
        console.error("FFI Error: wgpuBufferRelease", e); 
      }
    }

    destroy(): undefined {
      if (this._destroyed) {
        return;
      }

      try {
        this.lib.wgpuBufferDestroy(this.bufferPtr);
        this._destroyed = true;
      } catch (e) {
         console.error("Error calling bufferDestroy FFI function:", e);
      }
    }
}