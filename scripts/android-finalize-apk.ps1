<#
.SYNOPSIS
将 Android 构建产物整理为稳定、可发布的文件名。

.DESCRIPTION
在 APK 已经构建完成后，把默认的 `app-*.apk` 复制成更明确的 Whybrary 命名。
默认不会删除原始输出，只补充一份稳定文件名的副本。

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

if ([string]::IsNullOrWhiteSpace($Version)) {
    $package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $Version = $package.version
}

if (-not (Test-Path $ApkDir)) {
    throw "APK 输出目录不存在：$ApkDir"
}

$sourceApk = Join-Path $ApkDir 'app-arm64-release-unsigned.apk'
if (-not (Test-Path $sourceApk)) {
    throw "未找到默认 APK：$sourceApk"
}

$targetApk = Join-Path $ApkDir "whybrary-$Version-arm64-release-unsigned.apk"
Copy-Item -Path $sourceApk -Destination $targetApk -Force

$relativePath = Resolve-Path $targetApk | ForEach-Object {
    $_.Path.Replace("$workspaceRoot\", '')
}
Write-Output "已生成稳定命名 APK：$relativePath"
