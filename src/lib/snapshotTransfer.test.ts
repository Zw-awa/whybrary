import { describe, expect, it } from 'vitest';
import { buildDefaultState } from './defaults';
import { buildSnapshotFilename, parseSnapshot, serializeSnapshot } from './snapshotTransfer';

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

    expect(parsed).toEqual(snapshot);
  });
});
