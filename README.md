<h1 align="center">Whybrary</h1>

<p align="center">
  <img src="./assets/whybrary-mark.svg" width="92" alt="Whybrary icon" />
</p>

<p align="center">
  <a href="./README.md"><strong>English</strong></a>
  ·
  <a href="./README_CN.md"><strong>简体中文</strong></a>
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-c97838?style=flat-square" />
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri%20v2-4767d8?style=flat-square" />
  <img alt="Android" src="https://img.shields.io/badge/Android-APK%20SideLoad-5a8f61?style=flat-square" />
  <img alt="Mode" src="https://img.shields.io/badge/Mode-Local--First-7c5cff?style=flat-square" />
  <img alt="Storage" src="https://img.shields.io/badge/Storage-SQLite-4767d8?style=flat-square" />
</p>

<p align="center">
  A local-first app for keeping your own "why" visible through a mind map and a lightweight To-Do list.
</p>

## Install

Whybrary is distributed as direct-download installers and packages. It is not currently targeting app stores.

- Windows: download the `-setup.exe` asset from GitHub Releases and run it
  - if WebView2 is missing, the installer will fetch the Microsoft bootstrapper during install
- macOS: download the `.dmg` asset, open it, and drag Whybrary into `Applications`
- Linux:
  - Debian / Ubuntu: download the `.deb` package and install it
  - Fedora / RHEL / openSUSE: download the `.rpm` package and install it
  - Portable fallback: use the `.AppImage` if you prefer a no-install build
- Android: build or distribute a signed `.apk` for direct sideload installation

Release assets are published here:

- GitHub Releases: `https://github.com/Zw-awa/whybrary/releases`

If a build is unsigned on your platform, the operating system may show an extra trust prompt before first launch. That is separate from app-store publishing.

## Web Preview

- GitHub Pages preview: `https://zw-awa.github.io/whybrary/`
- The browser preview is for quick use and JSON import/export portability

## Overview

Whybrary is built for one person, on one machine, with one goal: keep your reasons clear enough to act on.

Instead of mixing long notes, bookmarks, and task clutter, Whybrary keeps things narrow:

- a local mind map for connecting motivations, reasons, and directions
- a compact To-Do list for turning those reasons into small, checkable actions

## Current Capabilities

- Create and switch between multiple spaces
- Add nodes locally and place new nodes near the current viewport center
- Drag nodes and persist their positions
- Pan and zoom the map viewport
- Toggle explicit link mode before connecting two nodes
- Open the info panel to inspect node positions and link counts
- Track a node from the info panel so the viewport centers on it
- Enable multi-select, select all, and batch delete from the info panel
- Keep short single-line To-Do items beside the map
- Switch between light and dark themes
- Use the mobile layout with bottom navigation, touch-friendly map actions, and in-app confirmation dialogs
- Work entirely offline with local SQLite persistence
- Import and export portable JSON snapshots in the browser preview

## Engineering Status

Whybrary is usable and under active refinement.

- Frontend: React + TypeScript
- App shell: Tauri v2
- Persistence: local SQLite snapshot storage with schema versioning (`PRAGMA user_version`)
- Graph rendering: local DOM + SVG + in-app force simulation
- Expected checks on each change:
  - `npm run test`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib`

## Testing and CI

Current automated coverage is split across three layers:

- Frontend tests: `51` Vitest cases across `App`, `BrainCanvas`, persistence, defaults, snapshot transfer, and force simulation
- Rust persistence tests: `8` SQLite-focused tests for empty DB load, snapshot round-trip, stale row cleanup, active-space cleanup, schema version initialization, migration idempotence, legacy schema migration, and future-version rejection
- Real Tauri runtime smoke: a dedicated Linux CI job boots the Tauri app under `xvfb`, writes to a real SQLite file, emits a smoke report, and exits

Current GitHub Actions workflows:

- `ci.yml`
  - web checks
  - Rust checks
  - Linux Tauri runtime smoke
- `pages.yml`
  - builds and deploys the browser preview to GitHub Pages
- `release.yml`
  - verifies the tag version
  - creates a draft GitHub release
  - uploads direct-download desktop packages:
    - Windows: `nsis`
    - macOS: `dmg`
    - Linux: `deb`, `rpm`, `appimage`

## Release Tutorial

If you are the maintainer and want to publish a new version:

1. Update the version in:
   - `package.json`
   - `src-tauri/tauri.conf.json`
   - `src-tauri/Cargo.toml`
2. Run:

```bash
npm install
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

3. Commit and push:

```bash
git add .
git commit -m "Prepare vX.Y.Z release"
git push
```

4. Create and push the tag:

```bash
git tag vX.Y.Z
git push origin vX.Y.Z
```

5. Wait for the `release.yml` workflow to finish.
6. Open the draft GitHub release, review the uploaded assets, then publish it.

### Local packaging shortcuts

```bash
npm run desktop:win
npm run desktop:mac
npm run desktop:linux
```

Platform note:

- `desktop:win` is meant to run on Windows
- `desktop:mac` is meant to run on macOS
- `desktop:linux` is meant to run on Linux
- cross-platform desktop release packaging is expected to happen through the GitHub Actions release workflow

### Android packaging shortcuts

```bash
npm run android:prepare
npm run android:build:apk
npm run android:sign:apk
npm run android:build:signed
npm run android:dev
```

Recommended Android flow:

1. `npm run android:prepare`
   - initializes `src-tauri/gen/android`
   - reads your existing `JAVA_HOME` / `ANDROID_HOME` / `ANDROID_SDK_ROOT` / `NDK_HOME`
   - rewrites the generated Gradle wrapper and repositories to mirror-first sources
2. `npm run android:build:apk`
   - reapplies the same fixed Android environment
   - keeps the locally vendored `tauri-android` module instead of letting the Tauri CLI regenerate it during build
   - reapplies mirrors
   - runs the generated Android Gradle project directly
   - currently builds the `arm64` release APK, which matches the available local Rust Android target output
   - copies the default Gradle output to a stable release-friendly filename
3. `npm run android:sign:apk`
   - reads signing inputs from environment variables
   - runs `zipalign` and `apksigner`
   - produces `whybrary-<version>-arm64-release.apk`

Local note:

- before running `android:sign:apk` locally, export the four signing variables in your current shell
- in GitHub Actions, the Android release job reads the same values from repository secrets

Required signing environment variables:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Mirror policy:

- Gradle distribution: Tencent mirror
- Maven repositories: Aliyun mirror first, official `google()` / `mavenCentral()` kept as fallback
- Android SDK auto-download: disabled to avoid long remote manifest waits during local builds

Expected environment:

- `JAVA_HOME`
- `ANDROID_HOME`
- `ANDROID_SDK_ROOT`
- `NDK_HOME`

Workspace-local caches used by the scripts:

- `.gradle-android-user-home`
- `.kotlin-daemon`
- `.tmp`

Android release packaging is currently expected to be done locally after preparing Android Studio, SDK/NDK, and Rust Android targets.

## Privacy

- No account
- No sync
- No upload
- No required network connection
- Your data stays on your device
- In the GitHub Pages preview, data stays in your current browser unless you export JSON

## Run From Source

```bash
npm install
npm run tauri dev
```

## Smoke Mode

There is an internal smoke path used by CI for real Tauri runtime verification.

Relevant environment variables:

- `WHYBRARY_TAURI_SMOKE=1`
- `WHYBRARY_APP_DATA_DIR=/path/to/temp/app-data`

In smoke mode the app:

- disables normal window creation
- persists a real snapshot into SQLite
- reads it back through the Tauri runtime
- writes `smoke-report.json`
- exits with a success or failure code

## Browser Preview Data Flow

The web preview is designed for quick use and easy portability:

- it stores the current snapshot in browser-local storage
- it can export a JSON snapshot with basic metadata
- it can import both current export envelopes and legacy raw snapshot JSON
- it includes a browser-local reset action for clearing preview data

## Release Notes

- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Release process: [RELEASING.md](./RELEASING.md)

## License

MIT, authored by `Zw-awa`.
