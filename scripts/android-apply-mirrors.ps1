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
$repositoryMode = if ($env:WHYBRARY_ANDROID_REPOSITORY_MODE) {
    $env:WHYBRARY_ANDROID_REPOSITORY_MODE.Trim().ToLowerInvariant()
}
elseif ($env:GITHUB_ACTIONS -eq 'true') {
    'official-first'
}
else {
    'mirror-first'
}

if ($repositoryMode -notin @('mirror-first', 'official-first')) {
    throw "Unsupported WHYBRARY_ANDROID_REPOSITORY_MODE: $repositoryMode"
}

$targets = @(
    @{ Path = $gradleWrapperPath; Label = 'Gradle Wrapper' },
    @{ Path = $rootGradlePath; Label = 'Root build.gradle.kts' },
    @{ Path = $buildSrcGradlePath; Label = 'buildSrc build.gradle.kts' },
    @{ Path = $gradlePropertiesPath; Label = 'gradle.properties' },
    @{ Path = $appGradlePath; Label = 'app/build.gradle.kts' },
    @{ Path = $buildTaskKotlinPath; Label = 'buildSrc BuildTask.kt' }
)

foreach ($target in $targets) {
    if (-not (Test-Path $target.Path)) {
        throw "Missing required file for Android patching: $($target.Label)"
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [AllowEmptyString()]
        [string]$Value
    )

    $parentDir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($parentDir) -and -not (Test-Path $parentDir)) {
        New-Item -ItemType Directory -Force -Path $parentDir | Out-Null
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path, $Value, $utf8NoBom)
}

function New-RepositoryBlock {
    param([string]$Indent = '')

    $repositoryLines = if ($repositoryMode -eq 'official-first') {
        @(
            'google()'
            'mavenCentral()'
            'maven(url = "https://maven.aliyun.com/repository/google")'
            'maven(url = "https://maven.aliyun.com/repository/public")'
        )
    }
    else {
        @(
            'maven(url = "https://maven.aliyun.com/repository/google")'
            'maven(url = "https://maven.aliyun.com/repository/public")'
            'google()'
            'mavenCentral()'
        )
    }

    $lines = @("${Indent}repositories {")
    $lines += $repositoryLines | ForEach-Object { "${Indent}    $_" }
    $lines += "${Indent}}"
    return $lines -join "`r`n"
}

Write-Output 'Android project directory: src-tauri/gen/android'
Write-Output "Gradle mirror: $desiredDistributionUrl"
Write-Output "Repository strategy: $repositoryMode"

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

    Write-Utf8NoBom -Path $Path -Value $updated
    Write-Output 'Updated: Gradle wrapper mirror.'
}

function Update-RepositoriesFile {
    param(
        [string]$Path,
        [string]$Label
    )

    $content = Get-Content $Path -Raw
    $normalizedContent = $content -replace "`r`n", "`n"
    $pattern = '(?ms)^(?<indent>[ \t]*)repositories\s*\{.*?^[ \t]*\}'
    $matches = [regex]::Matches($normalizedContent, $pattern)

    if ($matches.Count -eq 0) {
        throw "Could not find repositories block in $Label."
    }

    $updated = $normalizedContent
    for ($index = $matches.Count - 1; $index -ge 0; $index--) {
        $match = $matches[$index]
        $replacement = (New-RepositoryBlock -Indent $match.Groups['indent'].Value) -replace "`r`n", "`n"
        $updated = $updated.Remove($match.Index, $match.Length).Insert($match.Index, $replacement)
    }

    if ($updated -eq $normalizedContent) {
        Write-Output "No change: $Label already uses repository strategy $repositoryMode."
        return
    }

    Write-Utf8NoBom -Path $Path -Value (($updated -replace "`n", "`r`n"))
    Write-Output "Updated: $Label repository strategy to $repositoryMode."
}

function Update-GradlePropertiesFile {
    param([string]$Path)

    $content = Get-Content $Path -Raw
    $desiredLines = @(
        'android.builder.sdkDownload=false'
        'android.javaCompile.suppressSourceTargetDeprecationWarning=true'
        'kotlin.compiler.execution.strategy=in-process'
        'org.gradle.vfs.watch=false'
    )

    $lines = $content -split "`r?`n"
    $filtered = New-Object System.Collections.Generic.List[string]
    $desiredKeys = $desiredLines | ForEach-Object { ($_ -split '=')[0] }

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ($desiredKeys -contains ($trimmed -split '=')[0]) {
            continue
        }
        $filtered.Add($line)
    }

    foreach ($line in $desiredLines) {
        $filtered.Add($line)
    }

    $updated = ($filtered -join "`r`n").TrimEnd() + "`r`n"

    if ($updated -eq $content) {
        Write-Output 'No change: Gradle local build guardrails are already set.'
        return
    }

    Write-Utf8NoBom -Path $Path -Value $updated
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

    Write-Utf8NoBom -Path $Path -Value $updated
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

    Write-Utf8NoBom -Path $Path -Value $updated
    Write-Output 'Updated: release minify disabled.'
}

function Update-TauriPropertiesFile {
    param([string]$Path)

    $packageJsonPath = Join-Path $workspaceRoot 'package.json'
    $package = Get-Content $packageJsonPath -Raw | ConvertFrom-Json
    $version = $package.version

    $versionCode = if ($version -match '^(\d+)\.(\d+)\.(\d+)(?:-rc(\d+))?$') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
        $rc = if ($matches[4]) { [int]$matches[4] } else { 99 }
        ($major * 1000000) + ($minor * 10000) + ($patch * 100) + $rc
    }
    else {
        throw "Unsupported version format for Android versioning: $version"
    }

    $lines = @(
        '// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.'
        "tauri.android.versionName=$version"
        "tauri.android.versionCode=$versionCode"
        ''
    )
    $updated = $lines -join "`r`n"

    Write-Utf8NoBom -Path $Path -Value $updated
    Write-Output "Updated: tauri.properties versionName/versionCode for $version."
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

    $cargoManifest = Join-Path $workspaceRoot 'src-tauri\Cargo.toml'
    $metadataJson = & cargo metadata --manifest-path $cargoManifest --format-version 1 2>$null
    if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($metadataJson)) {
        try {
            $metadata = $metadataJson | ConvertFrom-Json
            $tauriPackage = $metadata.packages | Where-Object { $_.name -eq 'tauri' } | Select-Object -First 1
            if ($tauriPackage) {
                $tauriManifestDir = Split-Path -Parent $tauriPackage.manifest_path
                $candidate = Join-Path $tauriManifestDir 'mobile\android'
                if (Test-Path $candidate) {
                    return $candidate
                }
            }
        }
        catch {
            # Fall back to direct registry lookup below.
        }
    }

    $cargoHome = $env:CARGO_HOME
    if ([string]::IsNullOrWhiteSpace($cargoHome)) {
        $cargoHome = Join-Path $env:USERPROFILE '.cargo'
    }
    $registryRoot = Join-Path $cargoHome 'registry\src'
    if (-not (Test-Path $registryRoot)) {
        throw "Cargo registry source directory was not found."
    }

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
    Write-Utf8NoBom -Path $SettingsPath -Value $settingsContent
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

    $updated = [regex]::Replace(
        $updated,
        '^\s*val release = release \?: throw GradleException\("release cannot be null"\)\r?\n',
        '',
        [System.Text.RegularExpressions.RegexOptions]::Multiline
    )

    Write-Utf8NoBom -Path $Path -Value $updated
    Write-Output 'Updated: BuildTask.kt now uses repository-local Rust Android scripts.'
}

Update-WrapperFile -Path $gradleWrapperPath
Update-RepositoriesFile -Path $rootGradlePath -Label 'root Gradle config'
Update-RepositoriesFile -Path $buildSrcGradlePath -Label 'buildSrc Gradle config'
Update-GradlePropertiesFile -Path $gradlePropertiesPath
Update-AppBuildToolsVersion -Path $appGradlePath
Update-ReleaseMinifySetting -Path $appGradlePath
Update-TauriPropertiesFile -Path (Join-Path $AndroidProjectDir 'app\tauri.properties')
$tauriSourceDir = Resolve-TauriAndroidSourceDir -CargoLockPath $cargoLockPath
Sync-TauriAndroidVendor -SourceDir $tauriSourceDir -VendorDir $tauriVendorDir -SettingsPath $tauriSettingsGradlePath
Update-AppBuildToolsVersion -Path (Join-Path $tauriVendorDir 'build.gradle.kts')
Update-BuildTaskKotlin -Path $buildTaskKotlinPath

Write-Output 'Android mirror and patch application complete.'
