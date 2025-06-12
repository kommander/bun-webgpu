#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Debug", "Release")]
    [string]$BuildType = "Release"
)

Write-Host "Building WebGPU wrapper manually for Windows ($BuildType build)..."

# Find Visual Studio installation and MSVC tools
$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
if (Test-Path $vswhere) {
    $vsPath = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($vsPath) {
        $msvcPath = Get-ChildItem -Path "$vsPath\VC\Tools\MSVC" | Sort-Object Name -Descending | Select-Object -First 1
        $linkExe = "$($msvcPath.FullName)\bin\Hostx64\x64\link.exe"
        Write-Host "Found MSVC linker at: $linkExe"
    }
}

# Fallback to searching PATH for link.exe specifically
if (-not $linkExe -or -not (Test-Path $linkExe)) {
    $linkExe = Get-Command "link.exe" -ErrorAction SilentlyContinue | Where-Object { $_.Source -like "*Microsoft*" -or $_.Source -like "*VC*" } | Select-Object -First 1 -ExpandProperty Source
    if ($linkExe) {
        Write-Host "Found MSVC linker in PATH at: $linkExe"
    } else {
        throw "Could not find MSVC link.exe. Please ensure Visual Studio Build Tools are installed."
    }
}

# Create temporary directory for build artifacts
$TempDir = New-TemporaryFile | ForEach-Object { Remove-Item $_; New-Item -ItemType Directory -Path $_ }
Write-Host "Using temporary directory: $TempDir"

try {
    # Determine optimization flags and output names based on build type
    $zigOptFlag = if ($BuildType -eq "Debug") { "-ODebug" } else { "-OReleaseFast" }
    
    Write-Host "Using optimization: $zigOptFlag"
    
    # Compile the Zig code to object file in temp directory
    & zig build-obj src/zig/lib.zig `
        -target x86_64-windows-msvc `
        $zigOptFlag `
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

    # Generate .def file from object file symbols
    Write-Host "Generating module definition file from object symbols..."
    $objFile = "$TempDir\webgpu_wrapper.obj"
    $defFile = "$TempDir\webgpu_wrapper.def"
    
    # Use dumpbin to extract symbols and create .def file
    $dumpbinExe = Split-Path $linkExe | Join-Path -ChildPath "dumpbin.exe"
    if (-not (Test-Path $dumpbinExe)) {
        # Fallback: look for dumpbin in the same directory structure
        $vcToolsDir = Split-Path (Split-Path (Split-Path $linkExe))
        $dumpbinExe = Get-ChildItem -Path $vcToolsDir -Recurse -Name "dumpbin.exe" | Select-Object -First 1
        if ($dumpbinExe) {
            $dumpbinExe = Join-Path $vcToolsDir $dumpbinExe
        } else {
            throw "Could not find dumpbin.exe"
        }
    }
    
    Write-Host "Using dumpbin: $dumpbinExe"
    
    # Extract symbols from object file
    $symbols = & "$dumpbinExe" /SYMBOLS "$objFile" | Where-Object { 
        $_ -match "External.*zwgpu" 
    } | ForEach-Object {
        if ($_ -match "\|\s+(\w+)") {
            $matches[1]
        }
    } | Sort-Object -Unique
    
    # Create .def file
    "EXPORTS" | Out-File -FilePath $defFile -Encoding ASCII
    $symbols | Out-File -FilePath $defFile -Append -Encoding ASCII
    
    Write-Host "Generated .def file with $($symbols.Count) symbols"

    # Ensure the output directory exists
    New-Item -ItemType Directory -Path "src\lib\x86_64-windows" -Force | Out-Null

    # Select appropriate runtime libraries and flags based on build type
    if ($BuildType -eq "Debug") {
        $runtimeLibs = "msvcrtd.lib vcruntimed.lib ucrtd.lib"
        $noDefaultLibs = "/NODEFAULTLIB:MSVCRT"
        Write-Host "Using debug runtime libraries"
    } else {
        $runtimeLibs = "msvcrt.lib vcruntime.lib ucrt.lib"
        $noDefaultLibs = ""
        Write-Host "Using release runtime libraries"
    }

    # Link everything into a shared library using MSVC linker
    Write-Host "Linking with: $linkExe"
    $linkArgs = @(
        "/DLL"
        "/OUT:src\lib\x86_64-windows\webgpu_wrapper.dll"
        "/IMPLIB:src\lib\x86_64-windows\webgpu_wrapper.lib"
        "/DEF:$defFile"
        "$TempDir\webgpu_wrapper.obj"
        "dawn\libs\x86_64-windows\webgpu_dawn.lib"
        "user32.lib", "kernel32.lib", "gdi32.lib", "ole32.lib", "uuid.lib"
        "d3d11.lib", "d3d12.lib", "dxgi.lib", "dxguid.lib"
        $runtimeLibs.Split(' ')
        "ntdll.lib"
        "/LIBPATH:`"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\ucrt\x64`""
        "/LIBPATH:`"C:\Program Files (x86)\Windows Kits\10\Lib\10.0.22621.0\um\x64`""
        "/MACHINE:X64"
        "/SUBSYSTEM:WINDOWS"
    )
    
    if ($noDefaultLibs) {
        $linkArgs += $noDefaultLibs
    }
    
    & "$linkExe" @linkArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to link shared library"
    }

    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host "Output: src\lib\x86_64-windows\webgpu_wrapper.dll"

} finally {
    # Cleanup
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
} 