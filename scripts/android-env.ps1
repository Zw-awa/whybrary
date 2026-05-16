<#
.SYNOPSIS
为 Whybrary 的 Android 命令注入稳定环境变量。

.DESCRIPTION
优先读取用户已经设置好的 `JAVA_HOME`、`ANDROID_HOME`、`ANDROID_SDK_ROOT`、`NDK_HOME`。
如果缺失则报错，而不是在仓库里硬编码绝对路径。

脚本只把项目内的 Gradle/Kotlin/TEMP 缓存目录固定到工作区，避免污染用户全局目录。

.PARAMETER Command
要执行的命令字符串，例如 `npm run android:mirror` 或 `tauri android build --apk`。

.PARAMETER Help
显示帮助信息。
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$Command,
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ErrorActionPreference = 'Stop'

$workspaceRoot = Split-Path -Parent $PSScriptRoot
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
        throw "缺少环境变量：$name。请先在用户环境变量中设置。"
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

Write-Output "已加载 Android 用户环境变量：JAVA_HOME / ANDROID_HOME / ANDROID_SDK_ROOT / NDK_HOME"
Write-Output "使用项目内缓存目录：.gradle-android-user-home / .kotlin-daemon / .tmp"
Write-Output "执行命令：$Command"

$global:LASTEXITCODE = 0
Invoke-Expression $Command
if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}
