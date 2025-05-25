#!/bin/bash
set -e

# Download and setup Zig 0.14.0 for Linux x86_64
ZIG_VERSION="0.14.0"
ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/zig-linux-x86_64-${ZIG_VERSION}.tar.xz"
ZIG_DIR="/opt/zig"
ZIG_ARCHIVE="zig-linux-x86_64-${ZIG_VERSION}.tar.xz"

echo "Downloading Zig ${ZIG_VERSION}..."
curl -L -o "${ZIG_ARCHIVE}" "${ZIG_URL}"

echo "Extracting Zig..."
sudo mkdir -p "${ZIG_DIR}"
sudo tar -xJf "${ZIG_ARCHIVE}" -C "${ZIG_DIR}" --strip-components=1

echo "Adding Zig to PATH..."
echo "${ZIG_DIR}" >> $GITHUB_PATH

echo "Cleaning up..."
rm "${ZIG_ARCHIVE}"

echo "Validating Zig installation..."
"${ZIG_DIR}/zig" version

echo "Zig setup completed successfully!"