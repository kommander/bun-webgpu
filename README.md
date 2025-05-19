# bun-webgpu

WebGPU ([Dawn](https://dawn.googlesource.com/dawn)) FFI bindings for Bun.

## Usage

TBD

## Building

### Prerequisites

*   **Bun**: Ensure you have BunJS installed. (https://bun.sh)
*   **Zig**: The native components of this library are written in Zig. Ensure Zig is installed and available in your PATH. (https://ziglang.org/learn/getting-started/)
*   **Pre-built Dawn Libraries**: This project relies on pre-built Dawn libraries. Instructions for downloading these are in a separate README.
    *   See [packages/bun-webgpu/dawn/README.md](./dawn/README.md) for details on how to download the required Dawn shared libraries using the provided script. The script will place them in `packages/bun-webgpu/dawn/libs/`.

### Building the FFI Library

The `package.json` includes scripts to build the native library components.

*   `build:dev`
*   `build:prod`

## Testing

To run tests, build the library first, then run the tests:

```bash
bun test
```
