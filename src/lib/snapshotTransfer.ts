import { normalizeSnapshot } from './defaults';
import type { AppSnapshot } from '../types';

type SnapshotExportEnvelope = {
  app: 'whybrary';
  formatVersion: 1;
  exportedAt: string;
  snapshot: AppSnapshot;
};

export function buildSnapshotFilename(timestamp = new Date()): string {
  const iso = timestamp.toISOString().replace(/:/g, '-');
  return `whybrary-snapshot-${iso}.json`;
}

export function serializeSnapshot(snapshot: AppSnapshot): string {
  const envelope: SnapshotExportEnvelope = {
    app: 'whybrary',
    formatVersion: 1,
    exportedAt: new Date().toISOString(),
    snapshot,
  };

  return JSON.stringify(envelope, null, 2);
}

export function parseSnapshot(raw: string): AppSnapshot {
  const parsed = JSON.parse(raw) as AppSnapshot | SnapshotExportEnvelope;
  if (
    typeof parsed === 'object' &&
    parsed !== null &&
    'app' in parsed &&
    parsed.app === 'whybrary' &&
    'snapshot' in parsed
  ) {
    return normalizeSnapshot(parsed.snapshot);
  }

  return normalizeSnapshot(parsed as AppSnapshot);
}
