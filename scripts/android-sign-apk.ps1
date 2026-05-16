<#
.SYNOPSIS
对 Whybrary Android APK 执行 zipalign + apksigner 签名。

.DESCRIPTION
默认读取以下环境变量：
- ANDROID_HOME
- ANDROID_KEYSTORE_PATH
- ANDROID_KEYSTORE_PASSWORD
- ANDROID_KEY_ALIAS
- ANDROID_KEY_PASSWORD

输出文件名：
- whybrary-<version>-arm64-release.apk

.PARAMETER ApkDir
APK 输出目录。默认指向 arm64 release 目录。

.PARAMETER Version
版本号。默认从 package.json 读取。

.PARAMETER Help
显示帮助信息。
#>

[CmdletBinding()]
param(
    [string]$ApkDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'src-tauri\gen\android\app\build\outputs\apk\arm64\release'),
    [string]$Version,
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $workspaceRoot 'package.json'

if ([string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
    throw '缺少 ANDROID_HOME。请先设置 Android SDK 环境变量。'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PATH)) {
    throw '缺少 ANDROID_KEYSTORE_PATH。'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PASSWORD)) {
    throw '缺少 ANDROID_KEYSTORE_PASSWORD。'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEY_ALIAS)) {
    throw '缺少 ANDROID_KEY_ALIAS。'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEY_PASSWORD)) {
    throw '缺少 ANDROID_KEY_PASSWORD。'
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    $package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $Version = $package.version
}

if (-not (Test-Path $ApkDir)) {
    throw 'APK 输出目录不存在。请先执行 android:build:apk。'
}

$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $buildTools) {
    throw '未找到 Android build-tools。'
}

$zipalign = Join-Path $buildTools.FullName 'zipalign.exe'
$apksigner = Join-Path $buildTools.FullName 'apksigner.bat'

if (-not (Test-Path $zipalign)) {
    throw '未找到 zipalign.exe。'
}
if (-not (Test-Path $apksigner)) {
    throw '未找到 apksigner.bat。'
}

$unsignedApk = Get-ChildItem $ApkDir -Filter 'whybrary-*-arm64-release-unsigned.apk' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $unsignedApk) {
    $unsignedApk = Get-ChildItem $ApkDir -Filter 'app-arm64-release-unsigned.apk' -ErrorAction SilentlyContinue |
        Select-Object -First 1
}
if (-not $unsignedApk) {
    throw '未找到 unsigned APK。请先执行 android:build:apk。'
}

$alignedApk = Join-Path $ApkDir "whybrary-$Version-arm64-release-aligned.apk"
$signedApk = Join-Path $ApkDir "whybrary-$Version-arm64-release.apk"

& $zipalign -f -p 4 $unsignedApk.FullName $alignedApk
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $apksigner sign `
    --ks $env:ANDROID_KEYSTORE_PATH `
    --ks-pass "env:ANDROID_KEYSTORE_PASSWORD" `
    --key-pass "env:ANDROID_KEY_PASSWORD" `
    --ks-key-alias $env:ANDROID_KEY_ALIAS `
    --out $signedApk `
    $alignedApk
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

& $apksigner verify --print-certs $signedApk
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$relativePath = Resolve-Path $signedApk | ForEach-Object {
    $_.Path.Replace("$workspaceRoot\", '')
}
Write-Output "已生成签名 APK：$relativePath"
