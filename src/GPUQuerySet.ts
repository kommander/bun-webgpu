import { type Pointer } from "bun:ffi";
import { FFI_SYMBOLS } from "./ffi";

export class GPUQuerySetImpl implements GPUQuerySet {
    __brand: "GPUQuerySet" = "GPUQuerySet";
    label: string;

    constructor(public readonly ptr: Pointer, private lib: typeof FFI_SYMBOLS, public readonly type: GPUQueryType, public readonly count: number, label?: string) {
        this.label = label || '';
    }

    destroy(): undefined {
        this.lib.wgpuQuerySetDestroy(this.ptr);
    }
}

