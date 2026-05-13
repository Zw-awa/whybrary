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

## Engineering Status

Whybrary is usable and under active refinement.

- Frontend: React + TypeScript
- Desktop shell: Tauri v2
- Persistence: local SQLite snapshot storage
- Graph rendering: local DOM + SVG + in-app force simulation
- Quality gates currently expected on each change:
  - `npm run lint`
  - `npm run test`
  - `npm run build`

## Privacy

- No account
- No sync
- No upload
- No required network connection
- Your data stays on your device

## Run From Source

```bash
npm install
npm run tauri dev
```

## Useful Scripts

```bash
npm run lint
npm run test
npm run build
npm run tauri dev
```

## License

MIT, authored by `Zw-awa`.
