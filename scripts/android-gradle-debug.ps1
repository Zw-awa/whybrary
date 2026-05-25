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

    & $gradlePath `
        --project-dir 'src-tauri/gen/android' `
        --no-daemon `
        '-Dkotlin.compiler.execution.strategy=in-process' `
        '-Dorg.gradle.vfs.watch=false' `
        assembleDebug
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}
finally {
    Pop-Location
}
