import { describe, expect, it } from 'vitest';
import { buildDefaultState } from './defaults';
import {
  MAX_SNAPSHOT_FILE_BYTES,
  buildSnapshotFilename,
  parseSnapshot,
  serializeSnapshot,
} from './snapshotTransfer';

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  writable: true,
  value: () => ({
    matches: false,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

describe('snapshotTransfer', () => {
  it('builds a stable export filename', () => {
    const filename = buildSnapshotFilename(new Date('2026-05-13T08:09:10.000Z'));
    expect(filename).toBe('whybrary-snapshot-2026-05-13T08-09-10.000Z.json');
  });

  it('serializes and parses snapshots', () => {
    const snapshot = buildDefaultState();
    const serialized = serializeSnapshot(snapshot);
    const parsed = parseSnapshot(serialized);
    const envelope = JSON.parse(serialized) as {
      app: string;
      formatVersion: number;
      exportedAt: string;
      snapshot: unknown;
    };

    expect(envelope.app).toBe('whybrary');
    expect(envelope.formatVersion).toBe(1);
    expect(typeof envelope.exportedAt).toBe('string');
    expect(parsed).toEqual(snapshot);
  });

  it('still parses legacy raw snapshot json', () => {
    const snapshot = buildDefaultState();
    const parsed = parseSnapshot(JSON.stringify(snapshot));
    expect(parsed).toEqual(snapshot);
  });

  it('rejects oversized snapshot json', () => {
    const oversized = 'x'.repeat(MAX_SNAPSHOT_FILE_BYTES + 1);
    expect(() => parseSnapshot(oversized)).toThrow(/maximum supported size/i);
  });
});
