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
  <img alt="Status" src="https://img.shields.io/badge/Status-Work%20in%20Progress-b38b2a?style=flat-square" />
  <img alt="Desktop" src="https://img.shields.io/badge/Desktop-Tauri%20v2-1f8f88?style=flat-square" />
  <img alt="Rust" src="https://img.shields.io/badge/Rust-Backend-2c2018?style=flat-square" />
  <img alt="React" src="https://img.shields.io/badge/React-Frontend-4d9ecf?style=flat-square" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-UI%20Logic-356fa8?style=flat-square" />
  <img alt="SQLite" src="https://img.shields.io/badge/SQLite-Local%20Storage-4f7d95?style=flat-square" />
  <img alt="Mode" src="https://img.shields.io/badge/Mode-Local--First-5b8f5a?style=flat-square" />
</p>

<p align="center">
  A local-first desktop app for mapping your personal "why" and keeping it actionable through a visual neuron graph and lightweight To-Do lists.
</p>

## What Whybrary Is

Whybrary is a personal desktop application built around two linked workflows:

- turning motivations, reasons, and directions into a visual graph
- keeping those reasons concrete through short, checkable To-Do items

The project is intentionally narrow in scope. It is not a long-form note system, not a collaboration tool, and not a cloud service.

## Who It Is For

Whybrary is meant for people who want a private place to think with structure:

- people who organize life decisions through short reasons instead of long journals
- people who want a graph they can shape manually, not an auto-generated knowledge map
- people who prefer local ownership of their personal data

## Core Principles

- Local-first: your data stays on your machine
- Lightweight: short reasons and single-line tasks instead of heavy note-taking
- Visual: ideas can be named, moved, and connected directly
- Extensible: the storage model is designed so the renderer can evolve later, including toward richer 3D graph experiences

## Current Features

- Multiple independent Spaces
- Light and dark themes
- Local SQLite persistence
- Create, rename, drag, and connect neuron nodes
- Single-line To-Do items with completion states
- Animated strike-through feedback for completed items
- Draggable floating actions in the To-Do panel:
  - back to top
  - jump to the first open item
  - jump to the next open item

## Privacy

- No account system
- No required network service
- No upload logic
- No cloud sync in the current version

## Tech Stack

- Desktop shell: `Tauri v2`
- Backend: `Rust`
- Frontend: `React + TypeScript + Vite`
- Local storage: `SQLite`
- Graph canvas: `React Flow`

## Getting Started

### Requirements

- Rust stable toolchain
- Node.js 20+
- npm
- Visual Studio C++ Build Tools
- WebView2 Runtime

### Install dependencies

```bash
npm install
```

### Generate app icons

```bash
npm run tauri:icon
```

### Run in development

```bash
npm run tauri dev
```

## How Data Is Stored

Whybrary stores application data locally in SQLite through the Tauri backend.  
For frontend-only preview outside Tauri, the UI falls back to browser local storage for development convenience.

## Project Structure

```text
whybrary/
├─ assets/              # README assets and icon source
├─ src/                 # React frontend
├─ src-tauri/           # Tauri + Rust + SQLite
├─ private-docs/        # private work notes, ignored by git
├─ README.md
├─ README_CN.md
└─ LICENSE
```

## Roadmap

1. Finish the first fully usable version of the graph and To-Do workflows
2. Harden the SQLite schema and migration strategy
3. Improve drag behavior, motion polish, and keyboard support
4. Prepare the rendering layer for future immersive 3D graph exploration

## License

MIT, authored by `Zw-awa`.
