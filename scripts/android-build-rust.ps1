<#
.SYNOPSIS
为指定 Android ABI 构建 Rust 动态库，并复制到 jniLibs。

.DESCRIPTION
直接运行 cargo 构建 Whybrary 的 Rust 动态库，避免依赖 Tauri CLI 的
android-studio-script / WebSocket 协调流程。

.PARAMETER Target
Android Rust target：aarch64 / armv7 / i686 / x86_64

.PARAMETER Release
是否构建 release 版本。

.PARAMETER Help
显示帮助信息。
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

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$cargoManifest = Join-Path $workspaceRoot 'src-tauri\Cargo.toml'
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
    throw "未找到 Android linker，请检查 NDK_HOME。"
}
if (-not (Test-Path $clangPath)) {
    throw "未找到 Android clang，请检查 NDK_HOME。"
}
if (-not (Test-Path $llvmArPath)) {
    throw "未找到 llvm-ar，请检查 NDK_HOME。"
}

$upperTarget = $targetTriple.ToUpper().Replace('-', '_')
$envVarLinker = "CARGO_TARGET_${upperTarget}_LINKER"
$envVarRustflags = "CARGO_TARGET_${upperTarget}_RUSTFLAGS"
$envVarAr = "CARGO_TARGET_${upperTarget}_AR"

Set-Item -Path "Env:$envVarLinker" -Value $linkerPath
Set-Item -Path "Env:$envVarRustflags" -Value '-Clink-arg=-landroid -Clink-arg=-llog -Clink-arg=-lOpenSLES'
Set-Item -Path "Env:$envVarAr" -Value $llvmArPath

# Help cc-rs based native dependencies such as libsqlite3-sys resolve the Android toolchain.
Set-Item -Path "Env:CC" -Value $clangPath
Set-Item -Path "Env:AR" -Value $llvmArPath
Set-Item -Path "Env:TARGET_CC" -Value $clangPath
Set-Item -Path "Env:TARGET_AR" -Value $llvmArPath
Set-Item -Path "Env:CC_$targetTriple" -Value $clangPath
Set-Item -Path "Env:AR_$targetTriple" -Value $llvmArPath
Set-Item -Path ("Env:CC_" + $targetTriple.Replace('-', '_')) -Value $clangPath
Set-Item -Path ("Env:AR_" + $targetTriple.Replace('-', '_')) -Value $llvmArPath

$cargoArgs = @('build', '--manifest-path', $cargoManifest, '--lib', '--target', $targetTriple)
if ($Release) {
    $cargoArgs += '--release'
}

Write-Output "开始构建 Rust Android 动态库：$Target"
& cargo @cargoArgs
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$profileDir = if ($Release) { 'release' } else { 'debug' }
$builtLib = Join-Path $workspaceRoot "src-tauri\target\$targetTriple\$profileDir\libwhybrary_lib.so"
if (-not (Test-Path $builtLib)) {
    throw "未找到 Rust 动态库产物。"
}

$jniAbiDir = Join-Path $jniLibsRoot $targetAbi
New-Item -ItemType Directory -Force -Path $jniAbiDir | Out-Null
$destLib = Join-Path $jniAbiDir 'libwhybrary_lib.so'

if (Test-Path $destLib) {
    Remove-Item $destLib -Force
}

Copy-Item -Path $builtLib -Destination $destLib -Force
Write-Output "已同步 JNI 动态库：app/src/main/jniLibs/$targetAbi/libwhybrary_lib.so"
