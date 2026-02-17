#!/usr/bin/env pwsh

param(
    [Parameter(Mandatory=$false)]
    [ValidateSet("Debug", "Release")]
    [string]$BuildType = "Release"
)

Write-Host "Building WebGPU wrapper manually for Windows ($BuildType build)..."

$RepoRoot = $PSScriptRoot
$WindowsLibRoot = Join-Path $RepoRoot "dawn\libs\x86_64-windows"
$DawnStaticLib = Join-Path $WindowsLibRoot "webgpu_dawn.lib"
$OutputDir = Join-Path $RepoRoot "src\lib\x86_64-windows"

function Resolve-DawnIncludeRoot {
    param(
        [Parameter(Mandatory=$true)]
        [string]$LibRoot,
        [Parameter(Mandatory=$true)]
        [string]$ProjectRoot
    )

    $headerCandidates = @(
        (Join-Path $LibRoot "include\dawn\webgpu.h"),
        (Join-Path $LibRoot "dawn\webgpu.h"),
        (Join-Path $ProjectRoot "dawn\include\dawn\webgpu.h")
    )

    foreach ($candidate in $headerCandidates) {
        if (Test-Path $candidate) {
            $dawnDir = Split-Path $candidate -Parent
            return Split-Path $dawnDir -Parent
        }
    }

    $discoveredHeader = Get-ChildItem -Path (Join-Path $ProjectRoot "dawn") -Filter "webgpu.h" -Recurse -File -ErrorAction SilentlyContinue |
        Where-Object { $_.DirectoryName -match "[\\/]dawn$" } |
        Select-Object -First 1

    if ($discoveredHeader) {
        $dawnDir = $discoveredHeader.DirectoryName
        return Split-Path $dawnDir -Parent
    }

    $checked = $headerCandidates -join "`n - "
    throw "Could not locate dawn/webgpu.h. Checked:`n - $checked"
}

$DawnIncludeRoot = Resolve-DawnIncludeRoot -LibRoot $WindowsLibRoot -ProjectRoot $RepoRoot
Write-Host "Using Dawn include root: $DawnIncludeRoot"

if (-not (Test-Path $DawnStaticLib)) {
    throw "Missing Dawn static library at: $DawnStaticLib"
}

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
    $zigArgs = @(
        "build-obj",
        (Join-Path $RepoRoot "src/zig/lib.zig"),
        "-target", "x86_64-windows-msvc",
        $zigOptFlag,
        "-I", $DawnIncludeRoot,
        "-lc",
        "--name", "webgpu_wrapper",
        "--cache-dir", "$TempDir",
        "--global-cache-dir", "$TempDir"
    )

    & zig @zigArgs

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to compile Zig object file"
    }

    # Move the object file to temp directory for linking
    $objCandidates = @(
        (Join-Path (Get-Location) "webgpu_wrapper.obj"),
        (Join-Path $RepoRoot "webgpu_wrapper.obj")
    )
    $builtObj = $objCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $builtObj) {
        throw "Could not locate generated object file webgpu_wrapper.obj"
    }
    Move-Item $builtObj "$TempDir\"

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
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null

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
        "/OUT:$OutputDir\webgpu_wrapper.dll"
        "/IMPLIB:$OutputDir\webgpu_wrapper.lib"
        "/DEF:$defFile"
        "$TempDir\webgpu_wrapper.obj"
        $DawnStaticLib
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
    Write-Host "Output: $OutputDir\webgpu_wrapper.dll"

} finally {
    # Cleanup
    Remove-Item -Recurse -Force $TempDir -ErrorAction SilentlyContinue
} 
