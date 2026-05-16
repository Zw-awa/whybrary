<#
.SYNOPSIS
为 Tauri 生成的 Android 工程统一应用镜像源配置。

.DESCRIPTION
在 `src-tauri/gen/android` 已存在的前提下，修补 Gradle Wrapper 分发地址，以及
顶层 Gradle / buildSrc 的仓库声明，改为“镜像优先，官方回退”。

默认行为是直接修改生成目录中的文件，并且可重复执行。

.PARAMETER AndroidProjectDir
Tauri 生成的 Android 工程目录。默认指向 `src-tauri/gen/android`。

.PARAMETER SelfTest
仅检查目标文件是否存在，并打印将要应用的镜像配置，不执行写入。

.PARAMETER Help
显示帮助信息。
#>

[CmdletBinding()]
param(
    [string]$AndroidProjectDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'src-tauri\gen\android'),
    [switch]$SelfTest,
    [switch]$Help
)

if ($Help) {
    Get-Help $PSCommandPath -Detailed
    exit 0
}

$ErrorActionPreference = 'Stop'

$gradleWrapperPath = Join-Path $AndroidProjectDir 'gradle\wrapper\gradle-wrapper.properties'
$rootGradlePath = Join-Path $AndroidProjectDir 'build.gradle.kts'
$buildSrcGradlePath = Join-Path $AndroidProjectDir 'buildSrc\build.gradle.kts'
$gradlePropertiesPath = Join-Path $AndroidProjectDir 'gradle.properties'
$appGradlePath = Join-Path $AndroidProjectDir 'app\build.gradle.kts'
$tauriSettingsGradlePath = Join-Path $AndroidProjectDir 'tauri.settings.gradle'
$buildTaskKotlinPath = Join-Path $AndroidProjectDir 'buildSrc\src\main\java\io\github\zwawa\whybrary\kotlin\BuildTask.kt'
$workspaceRoot = Split-Path -Parent $PSScriptRoot
$cargoLockPath = Join-Path $workspaceRoot 'src-tauri\Cargo.lock'
$tauriVendorDir = Join-Path $AndroidProjectDir 'tauri-android-vendor'

$desiredDistributionUrl = 'distributionUrl=https\://mirrors.cloud.tencent.com/gradle/gradle-8.14.3-bin.zip'
$repositoryBlock = @"
repositories {
    maven(url = "https://maven.aliyun.com/repository/google")
    maven(url = "https://maven.aliyun.com/repository/public")
    google()
    mavenCentral()
}
"@

$targets = @(
    @{ Path = $gradleWrapperPath; Label = 'Gradle Wrapper'; Type = 'wrapper' },
    @{ Path = $rootGradlePath; Label = 'Android build.gradle.kts'; Type = 'repositories' },
    @{ Path = $buildSrcGradlePath; Label = 'Android buildSrc/build.gradle.kts'; Type = 'repositories' },
    @{ Path = $gradlePropertiesPath; Label = 'Android gradle.properties'; Type = 'properties' },
    @{ Path = $appGradlePath; Label = 'Android app/build.gradle.kts'; Type = 'buildtools' },
    @{ Path = $tauriSettingsGradlePath; Label = 'Android tauri.settings.gradle'; Type = 'tauri-settings' },
    @{ Path = $buildTaskKotlinPath; Label = 'Android buildSrc BuildTask.kt'; Type = 'buildtask' }
)

foreach ($target in $targets) {
    if (-not (Test-Path $target.Path)) {
        throw "目标文件不存在。请先执行 android:init 或 android:prepare。"
    }
}

Write-Output "Android 工程目录：src-tauri/gen/android"
Write-Output "Gradle 镜像：$desiredDistributionUrl"
Write-Output "Maven 镜像优先：阿里云 Google / public，保留 google() 和 mavenCentral() 作为回退。"

if ($SelfTest) {
    Write-Output "SelfTest 通过：目标文件已找到，未执行写入。"
    exit 0
}

function Update-WrapperFile {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match [regex]::Escape($desiredDistributionUrl)) {
        Write-Output "未变更：Gradle Wrapper 已使用镜像。"
        return
    }

    $updated = [regex]::Replace(
        $content,
        '^distributionUrl=.*$',
        $desiredDistributionUrl,
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )

    if ($updated -eq $content) {
        throw "未找到可替换的 distributionUrl。"
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：Gradle Wrapper 镜像。"
}

function Update-RepositoriesFile {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match 'maven\.aliyun\.com/repository/google' -and $content -match 'maven\.aliyun\.com/repository/public') {
        Write-Output "未变更：$Path 已包含镜像仓库。"
        return
    }

    $pattern = 'repositories\s*\{\s*google\(\)\s*mavenCentral\(\)\s*\}'
    $updated = [regex]::Replace(
        $content,
        $pattern,
        $repositoryBlock
    )

    if ($updated -eq $content) {
        throw "未找到可替换的 repositories 块。"
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：$Path 的仓库镜像配置。"
}

function Update-GradlePropertiesFile {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $desiredLines = @(
        'android.builder.sdkDownload=false'
        'android.javaCompile.suppressSourceTargetDeprecationWarning=true'
    )

    if (
        $content -match '^android\.builder\.sdkDownload=false$' -and
        $content -match '^android\.javaCompile\.suppressSourceTargetDeprecationWarning=true$'
    ) {
        Write-Output "未变更：Gradle 本地构建保护项已就位。"
        return
    }

    $updated = $content
    foreach ($line in $desiredLines) {
        $key = ($line -split '=')[0]
        if ($updated -match "^$([regex]::Escape($key))=.*$") {
            $updated = [regex]::Replace(
                $updated,
                "^$([regex]::Escape($key))=.*$",
                $line,
                [System.Text.RegularExpressions.RegexOptions]::Multiline
            )
        }
        else {
            $updated = $updated.TrimEnd() + "`r`n$line`r`n"
        }
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：Gradle 本地构建保护项。"
}

function Update-AppBuildToolsVersion {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $desiredLine = '    buildToolsVersion = "36.0.0"'

    if ($content -match 'buildToolsVersion\s*=\s*"36\.0\.0"') {
        Write-Output "未变更：已显式指定 buildToolsVersion=36.0.0。"
        return
    }

    if ($content -match 'buildToolsVersion\s*=') {
        $updated = [regex]::Replace(
            $content,
            '^\s*buildToolsVersion\s*=.*$',
            $desiredLine,
            [System.Text.RegularExpressions.RegexOptions]::Multiline
        )
    }
    else {
        $marker = "android {"
        $markerIndex = $content.IndexOf($marker)
        if ($markerIndex -lt 0) {
            throw "未找到可插入 buildToolsVersion 的 android 块。"
        }

        $insertIndex = $markerIndex + $marker.Length
        $updated = $content.Insert($insertIndex, "`r`n$desiredLine")
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：显式指定 buildToolsVersion=36.0.0。"
}

function Update-ReleaseMinifySetting {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match 'getByName\("release"\)\s*\{[\s\S]*?isMinifyEnabled = false') {
        Write-Output "未变更：release 已禁用 minify。"
        return
    }

    $updated = [regex]::Replace(
        $content,
        'getByName\("release"\)\s*\{([\s\S]*?)isMinifyEnabled = true',
        'getByName("release") {$1isMinifyEnabled = false',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw "未找到 release 构建类型里的 isMinifyEnabled 配置。"
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：release 禁用 minify，用于规避启动期被 R8 裁剪。"
}

function Resolve-TauriVersion {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $match = [regex]::Match($content, 'name = "tauri"\s+version = "([^"]+)"')
    if (-not $match.Success) {
        throw "未能从 Cargo.lock 解析 tauri 版本。"
    }

    return $match.Groups[1].Value
}

function Resolve-TauriAndroidSourceDir {
    param([string]$CargoLockPath)

    $tauriVersion = Resolve-TauriVersion -Path $CargoLockPath
    $registryRoot = Join-Path $env:USERPROFILE '.cargo\registry\src'
    $candidate = Get-ChildItem $registryRoot -Directory -ErrorAction Stop |
        ForEach-Object {
            Join-Path $_.FullName "tauri-$tauriVersion\mobile\android"
        } |
        Where-Object { Test-Path $_ } |
        Select-Object -First 1

    if (-not $candidate) {
        throw "未找到 tauri-$tauriVersion 的 Android 模块源码。"
    }

    return $candidate
}

function Sync-TauriAndroidVendor {
    param(
        [string]$SourceDir,
        [string]$VendorDir,
        [string]$SettingsPath
    )

    if (Test-Path $VendorDir) {
        Remove-Item $VendorDir -Recurse -Force
    }

    Copy-Item $SourceDir $VendorDir -Recurse -Force

    $escapedPath = $VendorDir.Replace('\', '\\')
    $settingsContent = @"
// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
include ':tauri-android'
project(':tauri-android').projectDir = new File("$escapedPath")
"@
    Set-Content -Path $SettingsPath -Value $settingsContent -Encoding UTF8
    Write-Output "已同步：tauri-android 本地 vendor 模块。"
}

function Update-BuildTaskKotlin {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match 'android:rust:release:aarch64') {
        Write-Output "未变更：BuildTask.kt 已改为调用仓库内稳定 Rust Android 构建脚本。"
        return
    }

    $pattern = 'val args = listOf\("run", "--", "tauri", "android", "android-studio-script"\);'
    $replacement = @'
        val scriptName = when (target) {
            "aarch64" -> "android:rust:release:aarch64"
            "armv7" -> "android:rust:release:armv7"
            "i686" -> "android:rust:release:i686"
            "x86_64" -> "android:rust:release:x86_64"
            else -> throw GradleException("unsupported Android target: $target")
        }
        val args = listOf("run", scriptName);
'@

    $updated = [regex]::Replace($content, $pattern, $replacement)
    if ($updated -eq $content) {
        throw "未找到 BuildTask.kt 中的 tauri android android-studio-script 调用。"
    }

    $updated = [regex]::Replace(
        $updated,
        '\s*if \(release\) \{\s*args\("--release"\)\s*\}\s*args\(listOf\("--target", target\)\)',
        ''
    )

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "已更新：BuildTask.kt 改为走仓库内稳定 Rust Android 构建脚本。"
}

Update-WrapperFile -Path $gradleWrapperPath
Update-RepositoriesFile -Path $rootGradlePath
Update-RepositoriesFile -Path $buildSrcGradlePath
Update-GradlePropertiesFile -Path $gradlePropertiesPath
Update-AppBuildToolsVersion -Path $appGradlePath
Update-ReleaseMinifySetting -Path $appGradlePath
$tauriSourceDir = Resolve-TauriAndroidSourceDir -CargoLockPath $cargoLockPath
Sync-TauriAndroidVendor -SourceDir $tauriSourceDir -VendorDir $tauriVendorDir -SettingsPath $tauriSettingsGradlePath
Update-AppBuildToolsVersion -Path (Join-Path $tauriVendorDir 'build.gradle.kts')
Update-BuildTaskKotlin -Path $buildTaskKotlinPath

Write-Output "镜像配置应用完成。"
