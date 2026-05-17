# Releasing Whybrary

This project is released as direct-download installers and packages.

- Windows: NSIS `-setup.exe`
- macOS: `.dmg`
- Linux: `.deb`, `.rpm`, plus optional `.AppImage`
- Android: signed `.apk` for sideloading

No app-store packaging is required for the current release flow.

## Version sources

Before tagging a release, keep these files aligned:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

## Pre-release checks

Run these locally before creating the release tag:

```bash
npm install
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

## Standard desktop release flow

```bash
git add .
git commit -m "Prepare vX.Y.Z release"
git push
git tag vX.Y.Z
git push origin vX.Y.Z
```

## What the desktop release workflow does

`release.yml` currently does the following on version tag push:

1. verifies that the tag version matches:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
2. creates a draft GitHub release
3. builds and uploads direct-download desktop assets:
   - macOS: `dmg`
   - Linux: `deb`, `rpm`, `appimage`
   - Windows: `nsis`
4. explicitly disables desktop code signing in the build arguments (`--no-sign`)

After the workflow finishes:

1. open the draft GitHub release
2. review the uploaded assets and notes
3. publish the release manually

## Local packaging shortcuts

### Windows

```bash
npm run desktop:win
```

Output goal:

- `Whybrary_x.y.z_x64-setup.exe` or equivalent NSIS installer

Behavior note:

- the installer uses the default WebView2 `downloadBootstrapper` flow
- this keeps the setup file smaller and avoids embedding the full offline runtime

### macOS

```bash
npm run desktop:mac
```

Host requirement:

- run this on a macOS machine or macOS CI runner

Output goal:

- `Whybrary_x.y.z_aarch64.dmg` or equivalent DMG installer

### Linux

```bash
npm run desktop:linux
```

Host requirement:

- run this on a Linux machine or Linux CI runner

Output goal:

- `.deb`
- `.rpm`
- `.AppImage`

## Android release flow

Prepare the Android toolchain first:

- Android Studio
- Android SDK
- Android NDK
- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `NDK_HOME`
- Rust Android targets

Then run:

```bash
npm run android:prepare
npm run android:build:apk
npm run android:sign:apk
```

`android:prepare` is the stable entrypoint for Android project regeneration in this repository:

- runs `tauri android init --ci`
- reads the user-configured `JAVA_HOME`, `ANDROID_HOME`, `ANDROID_SDK_ROOT`, and `NDK_HOME`
- reapplies mirror settings to the generated Gradle wrapper and repository declarations
- rewrites `tauri.settings.gradle` to use a local vendored `tauri-android` module

Android mirror policy:

- Gradle distribution URL: Tencent mirror
- Maven repositories:
  - local default: Aliyun mirrors first, official `google()` / `mavenCentral()` retained as fallback
  - GitHub Actions default: official `google()` / `mavenCentral()` first, Aliyun mirrors retained as fallback
- Android SDK auto-download: disabled in generated `gradle.properties` so local builds fail fast instead of hanging on remote package manifest checks

This avoids depending on hand-edits inside `src-tauri/gen/android`, which is a generated directory and may be overwritten by future init runs.

For APK packaging, the repository intentionally calls the generated Android Gradle project directly instead of `tauri android build --apk`, so the vendored `tauri-android` module and local Build Tools override are preserved during the build.

The default APK target is currently `arm64` release (`assembleArm64Release`) because that is the stable ABI path already verified locally.

After the Gradle task completes, the repository also copies the APK to a stable release-style filename:

- `whybrary-<version>-arm64-release-unsigned.apk`

To produce a signed APK, set these environment variables before running `npm run android:sign:apk`:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The signed output is:

- `whybrary-<version>-arm64-release.apk`

GitHub Actions release flow:

- the Android release job decodes the base64 keystore from `ANDROID_KEYSTORE_BASE64`
- exports the same four signing variables to the build process
- runs `npm run android:build:signed`
- uploads the signed APK both as an artifact and to the GitHub Release
- asserts generated Android metadata, versionName/versionCode, and BOM-free patched Gradle files before building

Expected environment variables:

- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `NDK_HOME`

Workspace-local cache directories:

- `.gradle-android-user-home`
- `.kotlin-daemon`
- `.tmp`

If you want to distribute the APK to real users, use a release keystore and sign the APK. This is required for distribution itself, not only for store publishing.

## Signing status

Desktop signing is now explicitly disabled in the shared release workflow:

- Windows: NSIS installer is built unsigned
- macOS: DMG is built unsigned
- Linux: packages are built unsigned

This avoids accidental signing attempts caused by inherited or environment-level secrets.

Platform trust prompts still differ:

- Windows: unsigned installers may trigger SmartScreen warnings
- macOS: unsigned or unnotarized builds may require manual approval in Gatekeeper
- Linux: package signing is optional but can improve trust for some users
- Android: release APK distribution should use your own signing key

## Pages flow

The web preview is deployed separately through `pages.yml` on pushes to `main`.
