<#
.SYNOPSIS
Signs a Whybrary Android APK with zipalign and apksigner.

.DESCRIPTION
Reads signing inputs from environment variables and writes a signed APK using a
stable output filename.

.PARAMETER ApkDir
APK output directory. Defaults to arm64 release output.

.PARAMETER Version
Version string. Defaults to the version in package.json.

.PARAMETER Help
Shows help text.
#>

[CmdletBinding()]
param(
    [string]$ApkDir,
    [string]$Version,
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
$packageJsonPath = Join-Path $workspaceRoot 'package.json'

if ([string]::IsNullOrWhiteSpace($ApkDir)) {
    $ApkDir = Join-Path $workspaceRoot 'src-tauri\gen\android\app\build\outputs\apk\arm64\release'
}

if ([string]::IsNullOrWhiteSpace($env:ANDROID_HOME)) {
    throw 'Missing ANDROID_HOME.'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PATH)) {
    throw 'Missing ANDROID_KEYSTORE_PATH.'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEYSTORE_PASSWORD)) {
    throw 'Missing ANDROID_KEYSTORE_PASSWORD.'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEY_ALIAS)) {
    throw 'Missing ANDROID_KEY_ALIAS.'
}
if ([string]::IsNullOrWhiteSpace($env:ANDROID_KEY_PASSWORD)) {
    throw 'Missing ANDROID_KEY_PASSWORD.'
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    $package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $Version = $package.version
}

if (-not (Test-Path $ApkDir)) {
    throw 'APK output directory was not found. Run android:build:apk first.'
}

$buildTools = Get-ChildItem (Join-Path $env:ANDROID_HOME 'build-tools') -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $buildTools) {
    throw 'Android build-tools were not found.'
}

$zipalign = Join-Path $buildTools.FullName 'zipalign.exe'
$apksigner = Join-Path $buildTools.FullName 'apksigner.bat'

if (-not (Test-Path $zipalign)) {
    throw 'zipalign.exe was not found.'
}
if (-not (Test-Path $apksigner)) {
    throw 'apksigner.bat was not found.'
}

$unsignedApk = Get-ChildItem $ApkDir -Filter 'whybrary-*-arm64-release-unsigned.apk' -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
if (-not $unsignedApk) {
    $unsignedApk = Get-ChildItem $ApkDir -Filter 'app-arm64-release-unsigned.apk' -ErrorAction SilentlyContinue |
        Select-Object -First 1
}
if (-not $unsignedApk) {
    throw 'Unsigned APK was not found. Run android:build:apk first.'
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
Write-Output "Generated signed APK: $relativePath"
