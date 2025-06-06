import { WGPUErrorType } from "../structs_def";

export function fatalError(...args: any[]): never {
    const message = args.join(' ');
    console.error('FATAL ERROR:', message);
    throw new Error(message);
}

export class OperationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'OperationError';
    }
}

export class GPUErrorImpl extends Error implements GPUError {
    constructor(message: string) {
        super(message);
        this.name = 'GPUError';
    }
}

export class GPUOutOfMemoryError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GPUOutOfMemoryError';
    }
}

export class GPUInternalError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GPUInternalError';
    }
}

export class GPUValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GPUValidationError';
    }
}

export class AbortError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'AbortError';
    }
}

export function createWGPUError(type: number, message: string) {
    switch (type) {
        case WGPUErrorType['out-of-memory']:
            return new GPUOutOfMemoryError(message);
        case WGPUErrorType.internal:
            return new GPUInternalError(message);
        case WGPUErrorType.validation:
            return new GPUValidationError(message);
        default:
            return new GPUErrorImpl(message);
    }
}