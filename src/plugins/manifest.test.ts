import { describe, expect, it } from 'vitest';
import { validatePluginManifest } from './manifest';

describe('validatePluginManifest', () => {
  const valid = {
    schemaVersion: 1,
    id: 'community.focus-tools',
    name: 'Focus Tools',
    version: '1.0.0',
    engine: '^0.4.0',
    entry: 'dist/plugin.js',
    permissions: ['workspace:read', 'ui:panel'],
  };

  it('accepts a complete manifest', () => {
    expect(validatePluginManifest(valid)).toEqual({ ok: true, manifest: valid });
  });

  it.each([
    [{ ...valid, id: 'Focus Tools' }, 'manifest.id'],
    [{ ...valid, entry: '../plugin.js' }, 'manifest.entry'],
    [{ ...valid, permissions: ['filesystem:all'] }, 'manifest.permissions'],
    [{ ...valid, permissions: ['ui:panel', 'ui:panel'] }, 'manifest.permissions'],
    [{ ...valid, schemaVersion: 2 }, 'manifest.schema-version'],
  ])('rejects unsafe or unsupported input', (manifest, code) => {
    const result = validatePluginManifest(manifest);
    expect(result).toMatchObject({ ok: false, code });
  });
});
