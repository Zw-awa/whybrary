<#
.SYNOPSIS
Waits for generated Android project files to become visible after init.

.DESCRIPTION
Some runners may observe a short delay between `tauri android init` reporting
success and all generated files becoming visible to subsequent steps. This
script waits for a small set of required files before continuing.

.PARAMETER AndroidProjectDir
Generated Android project directory. Defaults to src-tauri/gen/android.

.PARAMETER TimeoutSeconds
Maximum wait time in seconds. Default is 20.

.PARAMETER Help
Shows help text.
#>

[CmdletBinding()]
param(
    [string]$AndroidProjectDir,
    [int]$TimeoutSeconds = 20,
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

if ([string]::IsNullOrWhiteSpace($AndroidProjectDir)) {
    $AndroidProjectDir = Join-Path $workspaceRoot 'src-tauri\gen\android'
}

$requiredFiles = @(
    (Join-Path $AndroidProjectDir 'settings.gradle')
    (Join-Path $AndroidProjectDir 'tauri.settings.gradle')
    (Join-Path $AndroidProjectDir 'gradle\wrapper\gradle-wrapper.properties')
    (Join-Path $AndroidProjectDir 'app\build.gradle.kts')
)

$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
do {
    $missing = $requiredFiles | Where-Object { -not (Test-Path $_) }
    if ($missing.Count -eq 0) {
        Write-Output 'Android generated project files are ready.'
        exit 0
    }
    Start-Sleep -Milliseconds 500
} while ((Get-Date) -lt $deadline)

throw "Timed out waiting for generated Android project files."
