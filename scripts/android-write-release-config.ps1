<#
.SYNOPSIS
Writes a production-safe tauri.conf.json into the generated Android assets directory.

.DESCRIPTION
The repository's Android Gradle flow builds the generated Android project directly.
That bypasses Tauri CLI's normal Android resource injection, so we must explicitly
write a release-safe tauri.conf.json that does not point at a localhost dev server.
#>

[CmdletBinding()]
param(
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
$sourceConfigPath = Join-Path $workspaceRoot 'src-tauri\tauri.conf.json'
$targetConfigPath = Join-Path $workspaceRoot 'src-tauri\gen\android\app\src\main\assets\tauri.conf.json'

$config = Get-Content $sourceConfigPath -Raw | ConvertFrom-Json

if ($null -eq $config.build) {
    throw 'Missing build configuration in src-tauri/tauri.conf.json.'
}

$config.build.PSObject.Properties.Remove('devUrl')
$config.build.beforeDevCommand = $null
$config.build.beforeBuildCommand = $null

$targetDir = Split-Path -Parent $targetConfigPath
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

$json = $config | ConvertTo-Json -Depth 100 -Compress
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($targetConfigPath, $json, $utf8NoBom)

Write-Output "Wrote Android release config: $targetConfigPath"
