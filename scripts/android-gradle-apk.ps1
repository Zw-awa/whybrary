# SPDX-FileCopyrightText: 2026 Zw-awa
# SPDX-License-Identifier: MIT
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$scriptRoot = $PSScriptRoot
if ([string]::IsNullOrWhiteSpace($scriptRoot)) {
    $scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$workspaceRoot = Split-Path -Parent $scriptRoot
$gradlePath = Join-Path $workspaceRoot 'src-tauri\gen\android\gradlew.bat'

Push-Location $workspaceRoot
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    npm run android:mirror
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    powershell -ExecutionPolicy Bypass -File scripts/android-write-release-config.ps1
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    npm run android:rust:release:aarch64
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $gradleArgs = @(
        '--project-dir', 'src-tauri/gen/android',
        '--no-daemon',
        '-Dkotlin.compiler.execution.strategy=in-process',
        '-Dorg.gradle.vfs.watch=false'
    )
    if ($env:WHYBRARY_ANDROID_GRADLE_LOG_LEVEL -eq 'info') {
        $gradleArgs += '--stacktrace'
        $gradleArgs += '--info'
    }
    elseif ($env:WHYBRARY_ANDROID_GRADLE_LOG_LEVEL -eq 'debug') {
        $gradleArgs += '--stacktrace'
        $gradleArgs += '--debug'
    }
    elseif ($env:WHYBRARY_ANDROID_GRADLE_STACKTRACE -eq '1') {
        $gradleArgs += '--stacktrace'
    }
    $gradleArgs += 'assembleArm64Release'

    & $gradlePath @gradleArgs
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    npm run android:finalize:apk
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
