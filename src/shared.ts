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