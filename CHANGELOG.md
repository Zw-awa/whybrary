# Changelog

## v0.4.0

- Added undo and redo for workspace changes, node search, and fit-to-nodes controls
- Added an initial language choice, fully localized tutorial content, and system-theme support
- Added opt-in advanced metadata: node category and color, plus task priority and due date
- Added SQLite schema v3 migration, incremental persistence mutations, revision conflict handling, and browser-preview recovery
- Reorganized the application around workspace commands, tutorial and persistence controllers, and a domain-scoped workspace view model
- Improved responsive workspace controls, including the graph toolbar and sidebar history layout
- Added Prettier formatting checks and expanded front-end, persistence, and Rust migration test coverage

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
