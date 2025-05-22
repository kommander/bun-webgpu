#!/bin/bash
set -e

echo "Building WebGPU wrapper manually..."

# Compile the Zig code to object file
zig build-obj src/zig/lib.zig \
    -target x86_64-linux-gnu \
    -OReleaseFast \
    -I dawn/libs/x86_64-linux/include \
    -lc \
    --name webgpu_wrapper

# Link everything into a shared library
g++ -shared \
    -o src/lib/x86_64-linux/libwebgpu_wrapper.so \
    webgpu_wrapper.o \
    dawn/libs/x86_64-linux/libwebgpu_dawn.a \
    -lstdc++ \
    -lm \
    -lpthread \
    -ldl

echo "Build complete!"
echo "Testing dependency linking:"
ldd src/lib/x86_64-linux/libwebgpu_wrapper.so
