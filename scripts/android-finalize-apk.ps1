# SPDX-FileCopyrightText: 2026 Zw-awa
# SPDX-License-Identifier: MIT
<#
.SYNOPSIS
Renames Android build output to a stable release-style filename.

.DESCRIPTION
Copies the default APK output to a stable Whybrary filename while keeping the
original Gradle output in place.

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

if ([string]::IsNullOrWhiteSpace($Version)) {
    $package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $Version = $package.version
}

if (-not (Test-Path $ApkDir)) {
    throw 'APK output directory was not found. Run android:build:apk first.'
}

$sourceApk = Join-Path $ApkDir 'app-arm64-release-unsigned.apk'
if (-not (Test-Path $sourceApk)) {
    throw 'Default APK output was not found. Run android:build:apk first.'
}

$targetApk = Join-Path $ApkDir "whybrary-$Version-arm64-release-unsigned.apk"
Copy-Item -Path $sourceApk -Destination $targetApk -Force

$relativePath = Resolve-Path $targetApk | ForEach-Object {
    $_.Path.Replace("$workspaceRoot\", '')
}
Write-Output "Generated stable APK name: $relativePath"
