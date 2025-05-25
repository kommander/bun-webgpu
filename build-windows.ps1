#!/usr/bin/env pwsh

Write-Host "Building WebGPU wrapper manually for Windows..."

# Create temporary directory for build artifacts
$TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Write-Host "Using temporary directory: $TempDir"

try {
    # Compile the Zig code to object file in temp directory
    & zig build-obj src/zig/lib.zig `
        -target x86_64-windows-msvc `
        -OReleaseFast `
        -I dawn/libs/x86_64-windows/include `
        -I dawn/include `
        -lc `
        --name webgpu_wrapper `
        --cache-dir "$TempDir" `
        --global-cache-dir "$TempDir"

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compile Zig object file"
    }

    # Move the object file to temp directory for linking
    Move-Item webgpu_wrapper.obj "$TempDir\"

    # Ensure the output directory exists
    New-Item -ItemType Directory -Path "src\lib\x86_64-windows" -Force | Out-Null

    # Link everything into a shared library using MSVC linker
    & link.exe /DLL `
        /OUT:src\lib\x86_64-windows\webgpu_wrapper.dll `
        /IMPLIB:src\lib\x86_64-windows\webgpu_wrapper.lib `
        "$TempDir\webgpu_wrapper.obj" `
        "dawn\libs\x86_64-windows\webgpu_dawn.lib" `
        user32.lib kernel32.lib gdi32.lib ole32.lib uuid.lib `
        d3d11.lib d3d12.lib dxgi.lib dxguid.lib `
        msvcrt.lib vcruntime.lib ucrt.lib `
        /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64" `
        /LIBPATH:"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64" `
        /MACHINE:X64 `
        /SUBSYSTEM:WINDOWS

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to link shared library"
    }

    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Output: src\lib\x86_64-windows\webgpu_wrapper.dll"

} finally {
    # Cleanup
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
} 