<#
.SYNOPSIS
Builds the Rust Android shared library for a target ABI and copies it into jniLibs.

.DESCRIPTION
Runs cargo directly for the requested Android target and avoids the Tauri CLI
android-studio-script / WebSocket coordination path.

.PARAMETER Target
Android Rust target: aarch64 / armv7 / i686 / x86_64

.PARAMETER Release
Builds the release profile when provided.

.PARAMETER Help
Shows help text.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('aarch64', 'armv7', 'i686', 'x86_64')]
    [string]$Target,
    [switch]$Release,
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$workspaceRoot = Split-Path -Parent $scriptRoot
$cargoManifest = Join-Path $workspaceRoot 'src-tauri\Cargo.toml'
$tauriConfigPath = Join-Path $workspaceRoot 'src-tauri\tauri.conf.json'
$androidProjectDir = Join-Path $workspaceRoot 'src-tauri\gen\android'
$jniLibsRoot = Join-Path $androidProjectDir 'app\src\main\jniLibs'

$targetMap = @{
    'aarch64' = @{
        Triple = 'aarch64-linux-android'
        Abi = 'arm64-v8a'
        Linker = 'aarch64-linux-android24-clang.cmd'
    }
    'armv7' = @{
        Triple = 'armv7-linux-androideabi'
        Abi = 'armeabi-v7a'
        Linker = 'armv7a-linux-androideabi24-clang.cmd'
    }
    'i686' = @{
        Triple = 'i686-linux-android'
        Abi = 'x86'
        Linker = 'i686-linux-android24-clang.cmd'
    }
    'x86_64' = @{
        Triple = 'x86_64-linux-android'
        Abi = 'x86_64'
        Linker = 'x86_64-linux-android24-clang.cmd'
    }
}

$targetInfo = $targetMap[$Target]
$targetTriple = $targetInfo.Triple
$targetAbi = $targetInfo.Abi
$targetApiLevel = '24'
$linkerPath = Join-Path $env:NDK_HOME "toolchains\llvm\prebuilt\windows-x86_64\bin\$($targetInfo.Linker)"
$clangBaseName = "$targetTriple$targetApiLevel-clang"
$clangPath = Join-Path $env:NDK_HOME "toolchains\llvm\prebuilt\windows-x86_64\bin\$clangBaseName.cmd"
$llvmArPath = Join-Path $env:NDK_HOME 'toolchains\llvm\prebuilt\windows-x86_64\bin\llvm-ar.exe'

if (-not (Test-Path $linkerPath)) {
    throw 'Android linker was not found. Check NDK_HOME.'
}
if (-not (Test-Path $clangPath)) {
    throw 'Android clang was not found. Check NDK_HOME.'
}
if (-not (Test-Path $llvmArPath)) {
    throw 'llvm-ar was not found. Check NDK_HOME.'
}

$upperTarget = $targetTriple.ToUpper().Replace('-', '_')
$envVarLinker = "CARGO_TARGET_${upperTarget}_LINKER"
$envVarRustflags = "CARGO_TARGET_${upperTarget}_RUSTFLAGS"
$envVarAr = "CARGO_TARGET_${upperTarget}_AR"

Set-Item -Path "Env:$envVarLinker" -Value $linkerPath
Set-Item -Path "Env:$envVarRustflags" -Value '-Clink-arg=-landroid -Clink-arg=-llog -Clink-arg=-lOpenSLES'
Set-Item -Path "Env:$envVarAr" -Value $llvmArPath

# Help cc-rs based native dependencies such as libsqlite3-sys resolve the Android toolchain.
Set-Item -Path 'Env:CC' -Value $clangPath
Set-Item -Path 'Env:AR' -Value $llvmArPath
Set-Item -Path 'Env:TARGET_CC' -Value $clangPath
Set-Item -Path 'Env:TARGET_AR' -Value $llvmArPath
Set-Item -Path "Env:CC_$targetTriple" -Value $clangPath
Set-Item -Path "Env:AR_$targetTriple" -Value $llvmArPath
Set-Item -Path ("Env:CC_" + $targetTriple.Replace('-', '_')) -Value $clangPath
Set-Item -Path ("Env:AR_" + $targetTriple.Replace('-', '_')) -Value $llvmArPath

$tauriConfig = Get-Content $tauriConfigPath -Raw | ConvertFrom-Json
$appIdentifier = $tauriConfig.identifier
if ([string]::IsNullOrWhiteSpace($appIdentifier)) {
    throw 'Missing identifier in src-tauri/tauri.conf.json.'
}

$packagePath = $appIdentifier.Replace('.', '\')
$packageJavaDir = Join-Path (Join-Path $androidProjectDir 'app\src\main\java') $packagePath
$kotlinOutDir = Join-Path $packageJavaDir 'generated'
$cratePackage = Get-Content $cargoManifest -Raw
$crateNameMatch = [regex]::Match($cratePackage, '(?m)^name = "([^"]+)"')
if (-not $crateNameMatch.Success) {
    throw 'Could not parse crate name from src-tauri/Cargo.toml.'
}
$crateLibNameMatch = [regex]::Match($cratePackage, '(?ms)^\[lib\].*?^name = "([^"]+)"')
$crateLibraryName = if ($crateLibNameMatch.Success) {
    $crateLibNameMatch.Groups[1].Value.Replace('-', '_')
}
else {
    $crateNameMatch.Groups[1].Value.Replace('-', '_')
}

@(
    'Ipc.kt',
    'Logger.kt',
    'PermissionHelper.kt',
    'Rust.kt',
    'RustWebChromeClient.kt',
    'RustWebView.kt',
    'RustWebViewClient.kt',
    'TauriActivity.kt',
    'WryActivity.kt'
) | ForEach-Object {
    $legacyPath = Join-Path $packageJavaDir $_
    if (Test-Path $legacyPath) {
        Remove-Item $legacyPath -Force
    }
}

New-Item -ItemType Directory -Force -Path $kotlinOutDir | Out-Null
Set-Item -Path 'Env:WRY_ANDROID_KOTLIN_FILES_OUT_DIR' -Value $kotlinOutDir
Set-Item -Path 'Env:WRY_ANDROID_PACKAGE' -Value $appIdentifier
Set-Item -Path 'Env:WRY_ANDROID_LIBRARY' -Value $crateLibraryName
Set-Item -Path 'Env:WRY_TAURIACTIVITY_CLASS_EXTENSION' -Value ': WryActivity()'
Set-Item -Path 'Env:WRY_TAURIACTIVITY_CLASS_INIT' -Value ''

$cargoArgs = @('build', '--manifest-path', $cargoManifest, '--lib', '--target', $targetTriple)
if ($Release) {
    $cargoArgs += @('--release', '--features', 'tauri/custom-protocol')
}

Write-Output "Building Rust Android shared library for target: $Target"
& cargo @cargoArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$expectedKotlinFiles = @(
    'Rust.kt',
    'WryActivity.kt',
    'TauriActivity.kt'
)

foreach ($expectedFile in $expectedKotlinFiles) {
    $generatedPath = Join-Path $kotlinOutDir $expectedFile
    if (-not (Test-Path $generatedPath)) {
        throw "Expected generated Android Kotlin file was not created: $generatedPath"
    }
}

$profileDir = if ($Release) { 'release' } else { 'debug' }
$builtLib = Join-Path $workspaceRoot "src-tauri\target\$targetTriple\$profileDir\libwhybrary_lib.so"
if (-not (Test-Path $builtLib)) {
    throw 'Rust shared library output was not found.'
}

$jniAbiDir = Join-Path $jniLibsRoot $targetAbi
New-Item -ItemType Directory -Force -Path $jniAbiDir | Out-Null
$destLib = Join-Path $jniAbiDir 'libwhybrary_lib.so'

if (Test-Path $destLib) {
    Remove-Item $destLib -Force
}

Copy-Item -Path $builtLib -Destination $destLib -Force
Write-Output "Copied JNI library to app/src/main/jniLibs/$targetAbi/libwhybrary_lib.so"
