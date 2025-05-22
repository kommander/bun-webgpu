#!/bin/bash
set -e

echo "Building WebGPU wrapper manually..."

# Create temporary directory for build artifacts
TEMP_DIR=$(mktemp -d)
echo "Using temporary directory: $TEMP_DIR"

# Ensure cleanup on exit
trap "rm -rf $TEMP_DIR" EXIT

# Compile the Zig code to object file in temp directory
zig build-obj src/zig/lib.zig \
    -target x86_64-linux-gnu \
    -OReleaseFast \
    -I dawn/libs/x86_64-linux/include \
    -lc \
    --name webgpu_wrapper \
    --cache-dir "$TEMP_DIR" \
    --global-cache-dir "$TEMP_DIR"

# Move the object file to temp directory for linking
mv webgpu_wrapper.o "$TEMP_DIR/"

# Ensure the output directory exists
mkdir -p src/lib/x86_64-linux

# Link everything into a shared library
g++ -shared \
    -o src/lib/x86_64-linux/libwebgpu_wrapper.so \
    "$TEMP_DIR/webgpu_wrapper.o" \
    dawn/libs/x86_64-linux/libwebgpu_dawn.a \
    -lstdc++ \
    -lm \
    -lpthread \
    -ldl

echo "Build complete!"
echo "Testing dependency linking:"
ldd src/lib/x86_64-linux/libwebgpu_wrapper.so

echo "Cleaned up temporary files."
