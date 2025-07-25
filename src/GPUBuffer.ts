import { FFIType, JSCallback, ptr, toArrayBuffer, type Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";
import { BufferUsageFlags } from "./common";
import { fatalError, OperationError } from "./utils/error";
import { WGPUCallbackInfoStruct } from "./structs_def";
import type { InstanceTicker } from "./GPU";
import { AsyncStatus, decodeCallbackMessage, packUserDataId, unpackUserDataId } from "./shared";
import type { GPUDeviceImpl } from "./GPUDevice";
import { EventEmitter } from "events";

export class GPUBufferImpl extends EventEmitter implements GPUBuffer {
    private _size: GPUSize64;
    private _descriptor: GPUBufferDescriptor;
    private _mapState: GPUBufferMapState = 'unmapped';
    private _pendingMap: Promise<undefined> | null = null;
    private _mapCallback: JSCallback;
    private _mapCallbackPromiseData: {
      resolve: (value: undefined) => void;
      reject: (reason?: any) => void;
    } | null = null;
    private _destroyed = false;
    private _mappedOffset: number = 0;
    private _mappedSize: number = 0;
    private _returnedRanges: Array<{offset: number, size: number}> = [];
    private _detachableArrayBuffers: Array<ArrayBuffer> = [];
    
    __brand: "GPUBuffer" = "GPUBuffer";
    label: string = '';
    ptr: Pointer;

    constructor(
      public readonly bufferPtr: Pointer,
      private readonly device: GPUDeviceImpl,
      private lib: FFISymbols, 
      descriptor: GPUBufferDescriptor,
      private instanceTicker: InstanceTicker
    ) {
      super();
      this.ptr = bufferPtr;
      this._size = descriptor.size;
      this._descriptor = descriptor;
      this._mapState = descriptor.mappedAtCreation ? 'mapped' : 'unmapped';
      
      if (descriptor.mappedAtCreation) {
        this._mappedOffset = 0;
        this._mappedSize = this._size;
      }

      this._mapCallback = new JSCallback(
        (status: number, messagePtr: Pointer | null, messageSize: bigint, userdata1: Pointer, _userdata2: Pointer | null) => {   
          this.instanceTicker.unregister();
          this._pendingMap = null;
          
          // Note: Workaround for windows, where the message is not spread across multiple arguments
          const message = decodeCallbackMessage(messagePtr, process.platform === 'win32' ? undefined : messageSize);
          
          let actualUserData: Pointer | number;
          // TODO: The zig wrapper should probably wrap the callback as well and pass the arguemnts correctly
          if (process.platform === 'win32') {
            // On windows, the WGPUStringView as value is not spread across multiple arguments, for some reason,
            // so we need to pass the messageSize as the userdata1 pointer
            actualUserData = Number(messageSize as unknown as Pointer);
          } else {
            actualUserData = userdata1;
          }
          const userData = unpackUserDataId(actualUserData as Pointer);
          
          if (status === AsyncStatus.Success) {
              this._mapState = 'mapped';
              this._returnedRanges = [];
              this._detachableArrayBuffers = [];
              this._mapCallbackPromiseData?.resolve(undefined);
          } else {
              const statusName = Object.keys(AsyncStatus).find(key => AsyncStatus[key as keyof typeof AsyncStatus] === status) || 'Unknown Map Error';
              const errorMessage = `WGPU Buffer Map Error (${statusName}): ${message}`;
              const wasAlreadyMapped = userData === 1;
              const wasPending = this._mapState === 'pending';

              this._mapState = wasAlreadyMapped ? 'mapped' : 'unmapped';

              switch (status) {
                case AsyncStatus.Error:
                  if (wasPending) {
                    this._mapCallbackPromiseData?.reject(new OperationError(errorMessage));
                  } else {
                    this._mapCallbackPromiseData?.reject(new AbortError(errorMessage));
                  }
                  break;
                default:
                  this._mapCallbackPromiseData?.reject(new AbortError(errorMessage));
              }
          }

          this._mapCallbackPromiseData = null;

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

    private _checkRangeOverlap(newOffset: number, newSize: number): boolean {
      const newEnd = newOffset + newSize;
      
      for (const range of this._returnedRanges) {
        const rangeEnd = range.offset + range.size;
        const disjoint = (newOffset >= rangeEnd) || (range.offset >= newEnd);
        
        if (!disjoint) {
          return true;
        }
      }
      
      return false;
    }

    private _createDetachableArrayBuffer(actualArrayBuffer: ArrayBuffer): ArrayBuffer {
      this._detachableArrayBuffers.push(actualArrayBuffer);
      return actualArrayBuffer;
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
        this.device.injectError('validation', 'Buffer is destroyed');
        return new Promise((_, reject) => {
          process.nextTick(() => {
            reject(new OperationError('Buffer is destroyed'));
          });
        });
      }

      if (this._pendingMap) {
        return Promise.reject(new OperationError('Buffer mapping is already pending'));
      }

      const originalMapState = this._mapState;

      this._mapState = 'pending';
      this._pendingMap = new Promise((resolve, reject) => {
          const mapOffsetValue = offset ?? 0;
          const mapSizeValue = size ?? (this._size - mapOffsetValue);
          const mapOffset = BigInt(mapOffsetValue);
          const mapSize = BigInt(mapSizeValue);

          const userDataBuffer = packUserDataId(originalMapState === 'mapped' ? 1 : 0);
          const userDataPtr = ptr(userDataBuffer);
          
          this._mapCallbackPromiseData = {
            resolve,
            reject,
          };

          if (!this._mapCallback.ptr) {
            fatalError('Could not create buffer map callback');
          }

          const callbackInfo = WGPUCallbackInfoStruct.pack({
            mode: 'AllowProcessEvents',
            callback: this._mapCallback.ptr,
            userdata1: userDataPtr,
          });

          try {
              this.lib.wgpuBufferMapAsync(
                  this.bufferPtr,
                  mode,
                  mapOffset,
                  mapSize,
                  ptr(callbackInfo)
              );
              
              this._mappedOffset = mapOffsetValue;
              this._mappedSize = mapSizeValue;
              
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

    private _validateAlignment(offset: GPUSize64, size: GPUSize64): void {
      const kOffsetAlignment = 8;
      const kSizeAlignment = 4;
      
      if (offset % kOffsetAlignment !== 0) {
        throw new OperationError(`offset (${offset}) is not aligned to ${kOffsetAlignment} bytes.`);
      }
      
      if (size % kSizeAlignment !== 0) {
        throw new OperationError(`size (${size}) is not aligned to ${kSizeAlignment} bytes.`);
      }
    }

    getMappedRangePtr(offset?: GPUSize64, size?: GPUSize64): Pointer {
      if (this._destroyed) {
        throw new OperationError('Buffer is destroyed');
      }

      const mappedOffset = offset ?? 0;
      const mappedSize = size ?? (this._size - mappedOffset);

      this._validateAlignment(mappedOffset, mappedSize);

      if (this._checkRangeOverlap(mappedOffset, mappedSize)) {
        throw new OperationError("getMappedRangePtr: Requested range overlaps with an existing range.");
      }

      this._returnedRanges.push({ offset: mappedOffset, size: mappedSize });

      if (this._descriptor.usage & BufferUsageFlags.MAP_READ) {
        return this._getConstMappedRangePtr(mappedOffset, mappedSize);
      }
      
      const readOffset = BigInt(mappedOffset);
      const readSize = BigInt(mappedSize);
      
      const dataPtr = this.lib.wgpuBufferGetMappedRange(this.bufferPtr, readOffset, readSize);
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          throw new OperationError("getMappedRangePtr: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return dataPtr;
    }

    _getConstMappedRangePtr(offset: GPUSize64, size: GPUSize64): Pointer {
      const readOffset = BigInt(offset);
      const readSize = BigInt(size);

      const dataPtr = this.lib.wgpuBufferGetConstMappedRange(this.bufferPtr, readOffset, readSize);
      
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          throw new OperationError("getConstMappedRangePtr: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return dataPtr;
    }

    getMappedRange(offset?: GPUSize64, size?: GPUSize64): ArrayBuffer {
      if (this._destroyed) {
        throw new OperationError('Buffer is destroyed');
      }

      if (this._mapState !== 'mapped') {
        throw new OperationError("getMappedRange: Buffer is not in mapped state.");
      }

      const requestedOffset = offset ?? 0;
      const requestedSize = size ?? (this._size - requestedOffset);

      this._validateAlignment(requestedOffset, requestedSize);

      if (requestedOffset < this._mappedOffset ||
          requestedOffset > this._size ||
          requestedOffset + requestedSize > this._mappedOffset + this._mappedSize) {
        throw new OperationError("getMappedRange: Requested range is outside the mapped region.");
      }

      if (this._checkRangeOverlap(requestedOffset, requestedSize)) {
        throw new OperationError("getMappedRange: Requested range overlaps with an existing range.");
      }

      this._returnedRanges.push({ offset: requestedOffset, size: requestedSize });

      if (requestedSize === 0) {
        return new ArrayBuffer(0);
      }

      if (this._descriptor.usage & BufferUsageFlags.MAP_READ) {
        const actualArrayBuffer = this._getConstMappedRange(requestedOffset, requestedSize);
        return this._createDetachableArrayBuffer(actualArrayBuffer);
      }
      
      const readOffset = BigInt(requestedOffset);
      const readSize = BigInt(requestedSize);
      
      const dataPtr = this.lib.wgpuBufferGetMappedRange(this.bufferPtr, readOffset, readSize);
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          throw new OperationError("getMappedRange: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      const actualArrayBuffer = toArrayBuffer(dataPtr, 0, Number(readSize));
      return this._createDetachableArrayBuffer(actualArrayBuffer);
    }

    _getConstMappedRange(offset: GPUSize64, size: GPUSize64): ArrayBuffer {
      const readOffset = BigInt(offset);
      const readSize = BigInt(size);

      const dataPtr = this.lib.wgpuBufferGetConstMappedRange(this.bufferPtr, readOffset, readSize);
      
      if (dataPtr === null || dataPtr.valueOf() === 0) {
          throw new OperationError("getConstMappedRange: Received null pointer (buffer likely not mapped or range invalid).");
      }
      
      return toArrayBuffer(dataPtr, 0, Number(readSize));
    }

    _detachBuffers(): void {
      for (const buffer of this._detachableArrayBuffers) {
        // Workaround to detach the ArrayBuffer
        structuredClone(buffer, { transfer: [buffer] });
      }
      this._detachableArrayBuffers = [];
    }

    unmap(): undefined {
      // NOTE: It is valid to call unmap on a buffer that is destroyed 
      // (at creation, or after mappedAtCreation or mapAsync)
      
      this._detachBuffers();
      
      this.lib.wgpuBufferUnmap(this.bufferPtr);
      this._mapState = 'unmapped';
      this._mappedOffset = 0;
      this._mappedSize = 0;
      this._returnedRanges = [];

      this.instanceTicker.processEvents();
      
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

      this._detachBuffers();

      try {
        this.lib.wgpuBufferDestroy(this.bufferPtr);
        this._destroyed = true;
        this.emit('destroyed');
        this._mapState = 'unmapped';
      } catch (e) {
         console.error("Error calling bufferDestroy FFI function:", e);
      }
    }
}