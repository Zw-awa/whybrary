# Contributing

## Scope

Whybrary is a local-first desktop app built with Tauri, React, TypeScript, and SQLite.

## Setup

1. Install Node.js and Rust.
2. Install dependencies:

```bash
npm install
```

3. Start the app:

```bash
npm run tauri dev
```

## Before Opening A PR

Run:

```bash
npm run build
```

Keep changes focused. Avoid mixing unrelated refactors into the same pull request.

## Style

- Match the existing code style.
- Prefer small, direct changes over broad abstractions.
- Keep the app local-first. Do not add network-dependent behavior unless explicitly discussed.

## Issues

When filing a bug, include steps to reproduce and your environment.
