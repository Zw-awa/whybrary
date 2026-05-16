<#
.SYNOPSIS
Applies stable Android mirror and generated-project patches.

.DESCRIPTION
Updates the generated Android Gradle project under src-tauri/gen/android.
This includes the Gradle distribution URL, repository mirrors, local build
guardrails, build tools pinning, release minify behavior, vendored tauri-android,
and the Rust build task override.

.PARAMETER AndroidProjectDir
Generated Android project directory. Defaults to src-tauri/gen/android.

.PARAMETER SelfTest
Checks expected files and prints the intended configuration without writing.

.PARAMETER Help
Shows help text.
#>

[CmdletBinding()]
param(
    [string]$AndroidProjectDir,
    [switch]$SelfTest,
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

$gradleWrapperPath = Join-Path $AndroidProjectDir 'gradle\wrapper\gradle-wrapper.properties'
$rootGradlePath = Join-Path $AndroidProjectDir 'build.gradle.kts'
$buildSrcGradlePath = Join-Path $AndroidProjectDir 'buildSrc\build.gradle.kts'
$gradlePropertiesPath = Join-Path $AndroidProjectDir 'gradle.properties'
$appGradlePath = Join-Path $AndroidProjectDir 'app\build.gradle.kts'
$tauriSettingsGradlePath = Join-Path $AndroidProjectDir 'tauri.settings.gradle'
$buildTaskKotlinPath = Join-Path $AndroidProjectDir 'buildSrc\src\main\java\io\github\zwawa\whybrary\kotlin\BuildTask.kt'
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
    @{ Path = $gradleWrapperPath; Label = 'Gradle Wrapper' },
    @{ Path = $rootGradlePath; Label = 'Root build.gradle.kts' },
    @{ Path = $buildSrcGradlePath; Label = 'buildSrc build.gradle.kts' },
    @{ Path = $gradlePropertiesPath; Label = 'gradle.properties' },
    @{ Path = $appGradlePath; Label = 'app/build.gradle.kts' },
    @{ Path = $tauriSettingsGradlePath; Label = 'tauri.settings.gradle' },
    @{ Path = $buildTaskKotlinPath; Label = 'buildSrc BuildTask.kt' }
)

foreach ($target in $targets) {
    if (-not (Test-Path $target.Path)) {
        throw "Missing required file for Android patching: $($target.Label)"
    }
}

Write-Output 'Android project directory: src-tauri/gen/android'
Write-Output "Gradle mirror: $desiredDistributionUrl"
Write-Output 'Repository strategy: Aliyun mirrors first, official repos kept as fallback.'

if ($SelfTest) {
    Write-Output 'SelfTest passed. No files were modified.'
    exit 0
}

function Update-WrapperFile {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match [regex]::Escape($desiredDistributionUrl)) {
        Write-Output 'No change: Gradle wrapper already uses the mirror.'
        return
    }

    $updated = [regex]::Replace(
        $content,
        '^distributionUrl=.*$',
        $desiredDistributionUrl,
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )

    if ($updated -eq $content) {
        throw 'Could not replace distributionUrl.'
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output 'Updated: Gradle wrapper mirror.'
}

function Update-RepositoriesFile {
    param(
        [string]$Path,
        [string]$Label
    )

    $content = Get-Content $Path -Raw
    if ($content -match 'maven\.aliyun\.com/repository/google' -and $content -match 'maven\.aliyun\.com/repository/public') {
        Write-Output "No change: $Label already contains mirror repositories."
        return
    }

    $pattern = 'repositories\s*\{\s*google\(\)\s*mavenCentral\(\)\s*\}'
    $updated = [regex]::Replace($content, $pattern, $repositoryBlock)

    if ($updated -eq $content) {
        throw "Could not replace repositories block in $Label."
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output "Updated: $Label repository mirrors."
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
        Write-Output 'No change: Gradle local build guardrails are already set.'
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
    Write-Output 'Updated: Gradle local build guardrails.'
}

function Update-AppBuildToolsVersion {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $desiredLine = '    buildToolsVersion = "36.0.0"'

    if ($content -match 'buildToolsVersion\s*=\s*"36\.0\.0"') {
        Write-Output 'No change: buildToolsVersion is already pinned to 36.0.0.'
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
        $marker = 'android {'
        $markerIndex = $content.IndexOf($marker)
        if ($markerIndex -lt 0) {
            throw 'Could not find android block for buildToolsVersion insertion.'
        }

        $insertIndex = $markerIndex + $marker.Length
        $updated = $content.Insert($insertIndex, "`r`n$desiredLine")
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output 'Updated: buildToolsVersion pinned to 36.0.0.'
}

function Update-ReleaseMinifySetting {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match 'getByName\("release"\)\s*\{[\s\S]*?isMinifyEnabled = false') {
        Write-Output 'No change: release minify is already disabled.'
        return
    }

    $updated = [regex]::Replace(
        $content,
        'getByName\("release"\)\s*\{([\s\S]*?)isMinifyEnabled = true',
        'getByName("release") {$1isMinifyEnabled = false',
        [System.Text.RegularExpressions.RegexOptions]::Singleline
    )

    if ($updated -eq $content) {
        throw 'Could not locate release minify configuration.'
    }

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output 'Updated: release minify disabled.'
}

function Resolve-TauriVersion {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $match = [regex]::Match($content, 'name = "tauri"\s+version = "([^"]+)"')
    if (-not $match.Success) {
        throw 'Could not parse tauri version from Cargo.lock.'
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
        throw "Could not find tauri-$tauriVersion Android module source."
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
    Write-Output 'Updated: vendored tauri-android module.'
}

function Update-BuildTaskKotlin {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    if ($content -match 'android:rust:release:aarch64') {
        Write-Output 'No change: BuildTask.kt already uses repository-local Rust Android scripts.'
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
        throw 'Could not find the original tauri Android build invocation in BuildTask.kt.'
    }

    $updated = [regex]::Replace(
        $updated,
        '\s*if \(release\) \{\s*args\("--release"\)\s*\}\s*args\(listOf\("--target", target\)\)',
        ''
    )

    Set-Content -Path $Path -Value $updated -Encoding UTF8
    Write-Output 'Updated: BuildTask.kt now uses repository-local Rust Android scripts.'
}

Update-WrapperFile -Path $gradleWrapperPath
Update-RepositoriesFile -Path $rootGradlePath -Label 'root Gradle config'
Update-RepositoriesFile -Path $buildSrcGradlePath -Label 'buildSrc Gradle config'
Update-GradlePropertiesFile -Path $gradlePropertiesPath
Update-AppBuildToolsVersion -Path $appGradlePath
Update-ReleaseMinifySetting -Path $appGradlePath
$tauriSourceDir = Resolve-TauriAndroidSourceDir -CargoLockPath $cargoLockPath
Sync-TauriAndroidVendor -SourceDir $tauriSourceDir -VendorDir $tauriVendorDir -SettingsPath $tauriSettingsGradlePath
Update-AppBuildToolsVersion -Path (Join-Path $tauriVendorDir 'build.gradle.kts')
Update-BuildTaskKotlin -Path $buildTaskKotlinPath

Write-Output 'Android mirror and patch application complete.'
