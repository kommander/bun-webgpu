import type { Pointer } from "bun:ffi";
import type { FFISymbols } from "./ffi";

export class GPURenderBundleImpl implements GPURenderBundle {
    __brand: "GPURenderBundle" = "GPURenderBundle";
    label: string = '';
    readonly ptr: Pointer;
    private lib: FFISymbols;
    private _destroyed: boolean = false;

    constructor(ptr: Pointer, lib: FFISymbols, label?: string) {
        this.ptr = ptr;
        this.lib = lib;
        if (label) {
            this.label = label;
        }
    }

    destroy(): undefined {
        if (this._destroyed) return;
        this._destroyed = true;
        this.lib.wgpuRenderBundleRelease(this.ptr);
    }
} 