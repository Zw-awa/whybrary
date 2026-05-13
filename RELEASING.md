# Releasing Whybrary

## Version sources

Before tagging a release, keep these files aligned:

- `package.json`
- `src-tauri/tauri.conf.json`
- `src-tauri/Cargo.toml`

## Standard release flow

```bash
git add .
git commit -m "Prepare vX.Y.Z release"
git push
git tag vX.Y.Z
git push origin vX.Y.Z
```

## What runs

- `ci.yml`
  - web checks
  - Rust checks
  - Linux Tauri runtime smoke
- `release.yml`
  - version verification
  - draft GitHub release
  - desktop bundle builds for macOS, Linux, and Windows

## Pages flow

The web preview is deployed separately through `pages.yml` on pushes to `main`.

## Signing status

Signing is intentionally deferred until broader distribution or explicit trust requirements justify it.

The workflow is prepared for future secrets-based signing, but unsigned releases remain the default expected path for now.
