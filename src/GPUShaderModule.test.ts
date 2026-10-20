import { expect, describe, it, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { createGPUInstance, globals } from "./index.js";
import type { GPUImpl } from "./GPU.js";

globals();

let gpu: GPUImpl | null = null;
let adapter: GPUAdapter | null = null;
let device: GPUDevice | null = null;

const validWGSL = /* wgsl */ `
    @fragment fn main() -> @location(0) vec4f {
        return vec4f(1.0, 0.0, 1.0, 1.0);
    }
`;

const invalidWGSL = /* wgsl */ `
    @fragment fn main() -> @location(0) vec4f {
        return undefined_variable;
    }
`;

async function createShaderModuleSuppressingErrors(code: string): Promise<GPUShaderModule> {
    device!.pushErrorScope("validation");
    const shaderModule = device!.createShaderModule({ code });
    await device!.popErrorScope();
    return shaderModule;
}

describe("GPUShaderModule", () => {
    beforeAll(() => {
        gpu = createGPUInstance();
    });

    afterAll(() => {
        device?.destroy();
        device = null;
        adapter = null;
        gpu?.destroy();
        gpu = null;
    });

    beforeEach(async () => {
        adapter = await gpu!.requestAdapter();
        if (!adapter) throw new Error("beforeEach Failed: Could not request adapter.");
        device = await adapter.requestDevice({ label: "Device for shader module test" });
    });

    afterEach(() => {
        device?.destroy();
        device = null;
        adapter = null;
    });

    describe("getCompilationInfo", () => {
        it("resolves with no messages for a valid module", async () => {
            const shaderModule = device!.createShaderModule({ code: validWGSL });

            const info = await shaderModule.getCompilationInfo();

            expect(info.messages).toHaveLength(0);
        });

        it("resolves with an error message for an invalid module", async () => {
            const shaderModule = await createShaderModuleSuppressingErrors(invalidWGSL);

            const info = await shaderModule.getCompilationInfo();

            expect(info.messages.map((m) => m.type)).toContain("error");
        });

        it("reports the line of the failing statement", async () => {
            const shaderModule = await createShaderModuleSuppressingErrors(invalidWGSL);

            const info = await shaderModule.getCompilationInfo();
            const error = info.messages.find((m) => m.type === "error")!;

            expect(error.lineNum).toBe(3);
        });

        it("includes the offending identifier in the message", async () => {
            const shaderModule = await createShaderModuleSuppressingErrors(invalidWGSL);

            const info = await shaderModule.getCompilationInfo();
            const error = info.messages.find((m) => m.type === "error")!;

            expect(error.message).toContain("undefined_variable");
        });
    });
});
