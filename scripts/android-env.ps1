# SPDX-FileCopyrightText: 2026 Zw-awa
# SPDX-License-Identifier: MIT
<#
.SYNOPSIS
Loads stable Android environment variables for Whybrary commands.

.DESCRIPTION
Reads user-configured JAVA_HOME, ANDROID_HOME, ANDROID_SDK_ROOT, and NDK_HOME.
Then pins Gradle, Kotlin daemon, and temp caches to workspace-local directories.

.PARAMETER Command
Command string to execute after the environment is prepared.

.PARAMETER Help
Shows help text.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
    [string[]]$ArgumentList,
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
$requiredEnvNames = @('JAVA_HOME', 'ANDROID_HOME', 'ANDROID_SDK_ROOT', 'NDK_HOME')

foreach ($name in $requiredEnvNames) {
    $value = [System.Environment]::GetEnvironmentVariable($name, 'Process')
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [System.Environment]::GetEnvironmentVariable($name, 'User')
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        $value = [System.Environment]::GetEnvironmentVariable($name, 'Machine')
    }
    if ([string]::IsNullOrWhiteSpace($value)) {
        throw "Missing environment variable: $name"
    }

    Set-Item -Path "Env:$name" -Value $value
}

$env:GRADLE_USER_HOME = (Join-Path $workspaceRoot '.gradle-android-user-home')
$env:KOTLIN_DAEMON_CLIENT_ALIVE_PATH = (Join-Path $workspaceRoot '.kotlin-daemon')
$env:TEMP = (Join-Path $workspaceRoot '.tmp')
$env:TMP = $env:TEMP
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

New-Item -ItemType Directory -Force -Path $env:GRADLE_USER_HOME | Out-Null
New-Item -ItemType Directory -Force -Path $env:KOTLIN_DAEMON_CLIENT_ALIVE_PATH | Out-Null
New-Item -ItemType Directory -Force -Path $env:TEMP | Out-Null

Write-Output 'Loaded Android user environment variables.'
Write-Output 'Using workspace-local cache directories.'
if ($ArgumentList.Count -eq 0) {
    throw 'ArgumentList must contain at least one item.'
}

$displayCommand = [string]::Join(' ', $ArgumentList)
Write-Output "Executing command: $displayCommand"

$commandName = $ArgumentList[0]
$commandArgs = if ($ArgumentList.Count -gt 1) { $ArgumentList[1..($ArgumentList.Count - 1)] } else { @() }

$global:LASTEXITCODE = 0
& $commandName @commandArgs

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
