#!/bin/bash
set -e

# Download and setup Zig for Linux x86_64
ZIG_VERSION="${ZIG_VERSION:-0.14.1}"
ZIG_URL="https://ziglang.org/download/${ZIG_VERSION}/zig-x86_64-linux-${ZIG_VERSION}.tar.xz"
ZIG_DIR="$(pwd)/zig-x86_64-linux-${ZIG_VERSION}"
ZIG_ARCHIVE="zig-x86_64-linux-${ZIG_VERSION}.tar.xz"

echo "Downloading Zig ${ZIG_VERSION} from ${ZIG_URL}..."
curl -fSL -o "${ZIG_ARCHIVE}" "${ZIG_URL}"

if [ ! -f "${ZIG_ARCHIVE}" ]; then
    echo "Error: Failed to download Zig archive"
    exit 1
fi

FILE_SIZE=$(stat -c%s "${ZIG_ARCHIVE}" 2>/dev/null || stat -f%z "${ZIG_ARCHIVE}" 2>/dev/null || echo 0)
if [ "$FILE_SIZE" -lt 1000000 ]; then
    echo "Error: Downloaded file is too small (${FILE_SIZE} bytes). Download may have failed."
    echo "Content of downloaded file:"
    head -c 500 "${ZIG_ARCHIVE}"
    exit 1
fi

echo "Extracting Zig..."
tar xf "${ZIG_ARCHIVE}"
echo "Zig directory: ${ZIG_DIR}"

echo "Adding Zig to PATH..."
echo "${ZIG_DIR}" >> $GITHUB_PATH

echo "Cleaning up..."
rm "${ZIG_ARCHIVE}"

echo "Zig ${ZIG_VERSION} setup completed successfully!"