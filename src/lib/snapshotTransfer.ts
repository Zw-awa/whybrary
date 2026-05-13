import { normalizeSnapshot } from './defaults';
import type { AppSnapshot } from '../types';

export function buildSnapshotFilename(timestamp = new Date()): string {
  const iso = timestamp.toISOString().replace(/:/g, '-');
  return `whybrary-snapshot-${iso}.json`;
}

export function serializeSnapshot(snapshot: AppSnapshot): string {
  return JSON.stringify(snapshot, null, 2);
}

export function parseSnapshot(raw: string): AppSnapshot {
  const parsed = JSON.parse(raw) as AppSnapshot;
  return normalizeSnapshot(parsed);
}
