#!/bin/bash
#
# link-dev.sh - Development linking script for bun-webgpu
#
# This script creates a symbolic link (or copy) of the bun-webgpu package
# into another project's node_modules directory for local development and testing.
#
# Usage:
#   ./scripts/link-dev.sh <target-project-root> [options]
#
# Arguments:
#   <target-project-root>  Path to the project where you want to link this package
#
# Options:
#   --dist    Link the dist/ directory instead of the source root
#             Use this when testing the built package output
#   --copy    Copy files instead of creating symlinks (requires --dist)
#             Useful for scenarios where symlinks don't work (e.g., Docker volumes)
#   --bin     Copy binary packages as well (requires --copy and --dist)
#             Copies platform-specific native packages from node_modules
#
# Examples:
#   # Link source for active development with hot-reload
#   ./scripts/link-dev.sh /path/to/your/project
#
#   # Link built dist directory for testing production builds
#   ./scripts/link-dev.sh /path/to/your/project --dist
#
#   # Copy dist directory (useful for containerized environments)
#   ./scripts/link-dev.sh /path/to/your/project --dist --copy
#
#   # Copy dist directory with binary packages
#   ./scripts/link-dev.sh /path/to/your/project --dist --copy --bin
#
# Notes:
#   - Target project must have node_modules directory (run bun/npm install first)
#   - Use --dist when you need to test the actual build output
#   - Use --copy with --dist when symlinks aren't supported in your environment
#   - Use --bin with --copy to include platform-specific binary packages
#

set -e 

LINK_DIST=false
COPY_MODE=false
COPY_BINS=false
TARGET_ROOT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --dist)
            LINK_DIST=true
            shift
            ;;
        --copy)
            COPY_MODE=true
            shift
            ;;
        --bin)
            COPY_BINS=true
            shift
            ;;
        *)
            TARGET_ROOT="$1"
            shift
            ;;
    esac
done

if [ -z "$TARGET_ROOT" ]; then
    echo "Usage: $0 <target-project-root> [--dist] [--copy] [--bin]"
    echo "Example: $0 /path/to/your/project"
    echo "Example: $0 /path/to/your/project --dist"
    echo "Example: $0 /path/to/your/project --dist --copy"
    echo "Example: $0 /path/to/your/project --dist --copy --bin"
    echo ""
    echo "Options:"
    echo "  --dist    Link dist directory instead of source"
    echo "  --copy    Copy dist directory instead of symlinking (requires --dist)"
    echo "  --bin     Copy binary packages as well (requires --copy and --dist)"
    exit 1
fi

if [ "$COPY_MODE" = true ] && [ "$LINK_DIST" = false ]; then
    echo "Error: --copy requires --dist to be specified"
    exit 1
fi

if [ "$COPY_BINS" = true ] && [ "$COPY_MODE" = false ]; then
    echo "Error: --bin requires --copy to be specified"
    exit 1
fi

if [ "$COPY_BINS" = true ] && [ "$LINK_DIST" = false ]; then
    echo "Error: --bin requires --dist to be specified"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NODE_MODULES_DIR="$TARGET_ROOT/node_modules"

if [ ! -d "$TARGET_ROOT" ]; then
    echo "Error: Target project root directory does not exist: $TARGET_ROOT"
    exit 1
fi

if [ ! -d "$NODE_MODULES_DIR" ]; then
    echo "Error: node_modules directory does not exist: $NODE_MODULES_DIR"
    echo "Please run 'bun install' or 'npm install' in the target project first."
    exit 1
fi

echo "Linking bun-webgpu from: $REPO_ROOT"
echo "To node_modules in: $NODE_MODULES_DIR"
echo

remove_if_exists() {
    local path="$1"
    if [ -e "$path" ]; then
        echo "Removing existing: $path"
        rm -rf "$path"
    fi
}

link_or_copy() {
    local source_path="$1"
    local target_path="$2"
    local package_name="$3"
    
    if [ "$COPY_MODE" = true ]; then
        cp -r "$source_path" "$target_path"
        echo "✓ Copied $package_name"
    else
        ln -s "$source_path" "$target_path"
        echo "✓ Linked $package_name"
    fi
}

# Determine path suffix and message
if [ "$LINK_DIST" = true ]; then
    SUFFIX="/dist"
    if [ "$COPY_MODE" = true ]; then
        echo "Copying dist directory..."
    else
        echo "Creating symbolic link (using dist directory)..."
    fi
else
    SUFFIX=""
    echo "Creating symbolic link..."
fi

# Link bun-webgpu
remove_if_exists "$NODE_MODULES_DIR/bun-webgpu"
PACKAGE_PATH="$REPO_ROOT$SUFFIX"
if [ -d "$PACKAGE_PATH" ]; then
    link_or_copy "$PACKAGE_PATH" "$NODE_MODULES_DIR/bun-webgpu" "bun-webgpu"
else
    echo "Warning: $PACKAGE_PATH not found"
fi

echo

# Copy binary packages if requested
if [ "$COPY_BINS" = true ]; then
    echo "Copying binary packages..."
    
    # Check if dist/package.json exists
    DIST_PACKAGE_JSON="$REPO_ROOT/dist/package.json"
    if [ ! -f "$DIST_PACKAGE_JSON" ]; then
        echo "Warning: dist/package.json not found, skipping binary packages"
    else
        # Read optionalDependencies from dist/package.json
        # Use node to parse JSON and extract package names
        BIN_PACKAGES=$(node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('$DIST_PACKAGE_JSON', 'utf8'));
            const deps = pkg.optionalDependencies || {};
            const bunWebgpuDeps = Object.keys(deps).filter(name => name.startsWith('bun-webgpu/'));
            console.log(bunWebgpuDeps.join(' '));
        " 2>/dev/null)
        
        if [ -z "$BIN_PACKAGES" ]; then
            echo "No binary packages found in optionalDependencies"
        else
            # Create @bun-webgpu directory in target node_modules if it doesn't exist
            BUN_WEBGPU_SCOPE_DIR="$NODE_MODULES_DIR/@bun-webgpu"
            mkdir -p "$BUN_WEBGPU_SCOPE_DIR"
            
            # Copy each binary package
            for PKG_SCOPED_NAME in $BIN_PACKAGES; do
                # Extract the package name after the scope (e.g., "darwin-arm64" from "bun-webgpu/darwin-arm64")
                PKG_NAME="${PKG_SCOPED_NAME#*/}"
                
                SOURCE_PKG_PATH="$REPO_ROOT/node_modules/@bun-webgpu/$PKG_NAME"
                TARGET_PKG_PATH="$BUN_WEBGPU_SCOPE_DIR/$PKG_NAME"
                
                if [ -d "$SOURCE_PKG_PATH" ]; then
                    remove_if_exists "$TARGET_PKG_PATH"
                    cp -r "$SOURCE_PKG_PATH" "$TARGET_PKG_PATH"
                    echo "✓ Copied @bun-webgpu/$PKG_NAME"
                else
                    echo "Warning: Binary package not found: $SOURCE_PKG_PATH"
                fi
            done
        fi
    fi
    
    echo
fi

echo "Development linking complete!"