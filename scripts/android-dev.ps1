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

Push-Location $workspaceRoot
try {
    npm run android:mirror
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    & tauri android dev
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
