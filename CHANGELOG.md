# Changelog

## v0.2.0

- Added explicit SQLite schema versioning through `PRAGMA user_version`
- Added `0 -> 1` migration handling and persistence safety tests
- Added `ci.yml` coverage for web, Rust, and real Tauri runtime smoke
- Added `release.yml` for version-checked desktop packaging
- Added first-pass release/signing hardening hooks
- Added GitHub Pages deployment workflow
- Added browser-side JSON import/export for the web preview
- Added a Web welcome panel that explains browser-local usage and JSON portability

## v0.1.x

- Established the first Tauri + React + SQLite baseline
- Added front-end interaction coverage for `App` and `BrainCanvas`
