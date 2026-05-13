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
  <img alt="Local First" src="https://img.shields.io/badge/Mode-Local--First-7c5cff?style=flat-square" />
  <img alt="Offline" src="https://img.shields.io/badge/Network-Offline%20Only-a94f67?style=flat-square" />
  <img alt="Storage" src="https://img.shields.io/badge/Storage-SQLite-4767d8?style=flat-square" />
</p>

<p align="center">
  A local-first desktop app for keeping your own "why" visible through a mind map and a lightweight To-Do list.
</p>

## Try Online

- GitHub Pages web preview: `https://zw-awa.github.io/whybrary/`
- Best current portability path: export and import JSON snapshots

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
- Delete the current selection with the keyboard
- Keep short single-line To-Do items beside the map
- Switch between light and dark themes
- Work entirely offline with local SQLite persistence
- Import and export portable JSON snapshots in the browser preview

## Engineering Status

Whybrary is usable and under active refinement.

- Frontend: React + TypeScript
- Desktop shell: Tauri v2
- Persistence: local SQLite snapshot storage with schema versioning (`PRAGMA user_version`)
- Graph rendering: local DOM + SVG + in-app force simulation
- Quality gates currently expected on each change:
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - `cargo test --manifest-path src-tauri/Cargo.toml --lib`

## Testing and CI

Current automated coverage is split across three layers:

- Frontend tests: `46` Vitest cases across `App`, `BrainCanvas`, persistence, defaults, snapshot transfer, and force simulation
- Rust persistence tests: `8` SQLite-focused tests for empty DB load, snapshot round-trip, stale row cleanup, active-space cleanup, schema version initialization, migration idempotence, legacy schema migration, and future-version rejection
- Real Tauri runtime smoke: a dedicated Linux CI job boots the Tauri app under `xvfb`, writes to a real SQLite file, emits a smoke report, and exits

Current GitHub Actions workflows:

- `ci.yml`
  - `web-checks`: lint, test, build
  - `tauri-checks`: `cargo check --tests` and `cargo test --lib`
  - `tauri-smoke-linux`: real Tauri runtime smoke against a real app data directory
- `pages.yml`
  - builds and deploys the browser preview to GitHub Pages
- `release.yml`
  - version-verified desktop packaging on tag push

## SQLite Schema

The current SQLite schema starts at:

- `user_version = 1`

Migration behavior is explicit:

- new databases initialize to schema version `1`
- legacy unversioned databases are migrated through the `0 -> 1` step
- newer unsupported schema versions are rejected instead of being silently opened

## Release Flow

Desktop release packaging is triggered by pushing a version tag:

```bash
git tag v0.2.0
git push origin v0.2.0
```

The release workflow verifies that these three files all match the tag version before bundling:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

It then creates a draft GitHub release and builds desktop bundles for:

- macOS: `app`, `dmg`
- Linux: `appimage`, `deb`
- Windows: `nsis`

Signing and notarization hardening is partially prepared in the workflow, but still depends on repository secrets and platform certificates.

For now, signed desktop distribution is intentionally deferred until broader multi-user distribution or explicit trust requirements make it worth the overhead and identity exposure.

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

## Useful Scripts

```bash
npm run lint
npm run test
npm run build
npm run tauri dev
```

## Release Notes

- Changelog: [CHANGELOG.md](./CHANGELOG.md)
- Release process: [RELEASING.md](./RELEASING.md)

## License

MIT, authored by `Zw-awa`.
