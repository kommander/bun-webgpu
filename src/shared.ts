import { type Pointer, toArrayBuffer } from "bun:ffi";
import { BufferPool, type BlockBuffer } from "./buffer_pool";

export const AsyncStatus = {
    Success: 1,
    CallbackCancelled: 2,
    Error: 3,
    Aborted: 4,
    Force32: 0x7FFFFFFF,
} as const;

export const WGPUErrorType = {
    "no-error": 1,
    "validation": 2,
    "out-of-memory": 3,
    "internal": 4,
    "unknown": 5,
    // "device-lost": 6,
    "force-32": 0x7FFFFFFF
} as const;

const idBufferPool = new BufferPool(64, 1024, 8);

export function packUserDataId(id: number): ArrayBuffer {
    const blockBuffer = idBufferPool.request();
    const userDataBuffer = new Uint32Array(blockBuffer.buffer);
    userDataBuffer[0] = id;
    userDataBuffer[1] = blockBuffer.index;
    return blockBuffer.buffer;
}

export function unpackUserDataId(userDataPtr: Pointer): number {
    const userDataBuffer = toArrayBuffer(userDataPtr, 0, 8);
    const userDataView = new Uint32Array(userDataBuffer);
    console.log('userDataView', userDataView);
    const view = new DataView(userDataBuffer);
    const id = view.getUint32(0);
    const index = view.getUint32(4);
    idBufferPool.releaseBlock(index);
    return id;
}

export class GPUAdapterInfoImpl implements GPUAdapterInfo {
    __brand: "GPUAdapterInfo" = "GPUAdapterInfo";
    vendor: string = "";
    architecture: string = "";
    device: string = "";
    description: string = "";
    subgroupMinSize: number = 0;
    subgroupMaxSize: number = 0;
    isFallbackAdapter: boolean = false;

    constructor() {
        throw new TypeError('Illegal constructor');
    }
}

export function normalizeIdentifier(input: string): string {
    if (!input || input.trim() === '') {
        return '';
    }
    
    return input
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

export function decodeCallbackMessage(messagePtr: Pointer | null, messageSize?: number | bigint): string {
    if (!messagePtr || messageSize === 0n || messageSize === 0) {
        return '[empty message]';
    }

    let arrayBuffer: ArrayBuffer | null = null;
    arrayBuffer = messageSize ? toArrayBuffer(messagePtr, 0, Number(messageSize)) : toArrayBuffer(messagePtr);

    let message = 'Could not decode error message';
    if (arrayBuffer instanceof Error) {
        message = arrayBuffer.message;
    } else {
        message = Buffer.from(arrayBuffer).toString();
    }
    return message;
}

export const DEFAULT_SUPPORTED_LIMITS: Omit<GPUSupportedLimits, '__brand'> & { maxImmediateSize: number } = Object.freeze({
    maxTextureDimension1D: 8192,
    maxTextureDimension2D: 8192,
    maxTextureDimension3D: 2048,
    maxTextureArrayLayers: 256,
    maxBindGroups: 4,
    maxBindGroupsPlusVertexBuffers: 24,
    maxBindingsPerBindGroup: 1000,
    maxStorageBuffersInFragmentStage: 8,
    maxStorageBuffersInVertexStage: 8,
    maxStorageTexturesInFragmentStage: 4,
    maxStorageTexturesInVertexStage: 4,
    maxDynamicUniformBuffersPerPipelineLayout: 8,
    maxDynamicStorageBuffersPerPipelineLayout: 4,
    maxSampledTexturesPerShaderStage: 16,
    maxSamplersPerShaderStage: 16,
    maxStorageBuffersPerShaderStage: 8,
    maxStorageTexturesPerShaderStage: 4,
    maxUniformBuffersPerShaderStage: 12,
    maxUniformBufferBindingSize: 65536,
    maxStorageBufferBindingSize: 134217728,
    minUniformBufferOffsetAlignment: 256,
    minStorageBufferOffsetAlignment: 256,
    maxVertexBuffers: 8,
    maxBufferSize: 268435456,
    maxVertexAttributes: 16,
    maxVertexBufferArrayStride: 2048,
    maxInterStageShaderComponents: 4294967295,
    maxInterStageShaderVariables: 16,
    maxColorAttachments: 8,
    maxColorAttachmentBytesPerSample: 32,
    maxComputeWorkgroupStorageSize: 16384,
    maxComputeInvocationsPerWorkgroup: 256,
    maxComputeWorkgroupSizeX: 256,
    maxComputeWorkgroupSizeY: 256,
    maxComputeWorkgroupSizeZ: 64,
    maxComputeWorkgroupsPerDimension: 65535,
    maxImmediateSize: 0,
});

export class GPUSupportedLimitsImpl implements GPUSupportedLimits {
    __brand: "GPUSupportedLimits" = "GPUSupportedLimits";
    maxTextureDimension1D = 8192;
    maxTextureDimension2D = 8192;
    maxTextureDimension3D = 2048;
    maxTextureArrayLayers = 256;
    maxBindGroups = 4;
    maxBindGroupsPlusVertexBuffers = 24;
    maxBindingsPerBindGroup = 1000;
    maxStorageBuffersInFragmentStage = 8;
    maxStorageBuffersInVertexStage = 8;
    maxStorageTexturesInFragmentStage = 4;
    maxStorageTexturesInVertexStage = 4;
    maxDynamicUniformBuffersPerPipelineLayout = 8;
    maxDynamicStorageBuffersPerPipelineLayout = 4;
    maxSampledTexturesPerShaderStage = 16;
    maxSamplersPerShaderStage = 16;
    maxStorageBuffersPerShaderStage = 8;
    maxStorageTexturesPerShaderStage = 4;
    maxUniformBuffersPerShaderStage = 12;
    maxUniformBufferBindingSize = 65536;
    maxStorageBufferBindingSize = 134217728;
    minUniformBufferOffsetAlignment = 256;
    minStorageBufferOffsetAlignment = 256;
    maxVertexBuffers = 8;
    maxBufferSize = 268435456;
    maxVertexAttributes = 16;
    maxVertexBufferArrayStride = 2048;
    maxInterStageShaderComponents = 4294967295;
    maxInterStageShaderVariables = 16;
    maxColorAttachments = 8;
    maxColorAttachmentBytesPerSample = 32;
    maxComputeWorkgroupStorageSize = 16384;
    maxComputeInvocationsPerWorkgroup = 256;
    maxComputeWorkgroupSizeX = 256;
    maxComputeWorkgroupSizeY = 256;
    maxComputeWorkgroupSizeZ = 64;
    maxComputeWorkgroupsPerDimension = 65535;

    constructor() {
        throw new TypeError('Illegal constructor');
    }
}