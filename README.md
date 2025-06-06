# bun-webgpu

WebGPU ([Dawn](https://dawn.googlesource.com/dawn)) FFI bindings for Bun.

## Usage

TBD

## Building

### Prerequisites

*   **Bun**: Ensure you have BunJS installed. (https://bun.sh)
*   **Zig**: The native components of this library are written in Zig. Ensure Zig is installed and available in your PATH. (https://ziglang.org/learn/getting-started/)
*   **Pre-built Dawn Libraries**: This project relies on pre-built Dawn libraries.
    *   See [packages/bun-webgpu/dawn/README.md](./dawn/README.md) for details on how to download the required Dawn shared libraries.
    * Basically just run `bun run ./dawn/download_artifacts.ts`

### Building the FFI Liberary

The `package.json` includes scripts to build the native library components.

*   `build:dev`
*   `build:prod`

## Conformance Test Suite (CTS)

To run the CTS, build the library first, then run the tests:

```bash
./run-cts.sh 'webgpu:api,operation,adapter,requestDevice:always_returns_device:*'
```

Run all webgpu tests for example with `./run-cts.sh 'webgpu:*'`

## Testing

To run tests, build the library first, then run the tests:

```bash
bun test
```
