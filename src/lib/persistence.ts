import { invoke } from '@tauri-apps/api/core';
import type { AppSnapshot } from '../types';
import { buildDefaultState } from './defaults';
import type { LoadedWorkspace, MutationBatch } from './workspaceChanges';

export const LOCAL_PREVIEW_KEY = 'whybrary.preview.snapshot';
export const LOCAL_PREVIEW_REVISION_KEY = 'whybrary.preview.revision';

export type PersistenceErrorCode =
  | 'load_failed'
  | 'save_failed'
  | 'corrupt_storage'
  | 'revision_conflict'
  | 'quota_exceeded'
  | 'unknown';

export class PersistenceError extends Error {
  readonly code: PersistenceErrorCode;
  readonly recoverable: boolean;

  constructor(
    code: PersistenceErrorCode,
    message: string,
    options?: { cause?: unknown; recoverable?: boolean },
  ) {
    super(message);
    if (options?.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    this.name = 'PersistenceError';
    this.code = code;
    this.recoverable = options?.recoverable ?? true;
  }
}

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function readPreviewSnapshot(): AppSnapshot | undefined {
  const raw = window.localStorage.getItem(LOCAL_PREVIEW_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    return JSON.parse(raw) as AppSnapshot;
  } catch (error) {
    throw new PersistenceError(
      'corrupt_storage',
      'Browser preview storage contains invalid JSON.',
      {
        cause: error,
        recoverable: false,
      },
    );
  }
}

function readPreviewRevision(): number {
  const raw = window.localStorage.getItem(LOCAL_PREVIEW_REVISION_KEY);
  const revision = raw === null ? 0 : Number(raw);
  return Number.isSafeInteger(revision) && revision >= 0 ? revision : 0;
}

function writePreviewSnapshot(snapshot: AppSnapshot, revision: number): void {
  try {
    window.localStorage.setItem(LOCAL_PREVIEW_KEY, JSON.stringify(snapshot));
    window.localStorage.setItem(LOCAL_PREVIEW_REVISION_KEY, String(revision));
  } catch (error) {
    const code =
      error instanceof DOMException && error.name === 'QuotaExceededError'
        ? 'quota_exceeded'
        : 'save_failed';
    throw new PersistenceError(code, 'Unable to save browser preview data.', { cause: error });
  }
}

export async function loadWorkspace(): Promise<
  LoadedWorkspace & { previewFallback?: AppSnapshot }
> {
  if (hasTauriRuntime()) {
    try {
      const loaded = await invoke<LoadedWorkspace>('load_workspace');
      const previewFallback = readPreviewSnapshot();
      return { ...loaded, previewFallback };
    } catch (error) {
      throw new PersistenceError('load_failed', 'Unable to load the SQLite workspace.', {
        cause: error,
      });
    }
  }

  const preview = readPreviewSnapshot();
  return {
    snapshot: preview ?? buildDefaultState(),
    revision: readPreviewRevision(),
  };
}

export async function applyMutationBatch(
  batch: MutationBatch,
  nextSnapshot: AppSnapshot,
): Promise<number> {
  if (hasTauriRuntime()) {
    try {
      const result = await invoke<{ revision: number }>('apply_mutations', { batch });
      return result.revision;
    } catch (error) {
      const message = String(error);
      const code = message.toLowerCase().includes('revision') ? 'revision_conflict' : 'save_failed';
      throw new PersistenceError(code, 'Unable to save the SQLite workspace.', { cause: error });
    }
  }

  writePreviewSnapshot(nextSnapshot, batch.nextRevision);
  return batch.nextRevision;
}

export async function replaceWorkspace(
  snapshot: AppSnapshot,
  nextRevision: number,
): Promise<number> {
  if (hasTauriRuntime()) {
    try {
      const result = await invoke<{ revision: number }>('replace_workspace', {
        snapshot,
        revision: nextRevision,
      });
      return result.revision;
    } catch (error) {
      throw new PersistenceError('save_failed', 'Unable to replace the SQLite workspace.', {
        cause: error,
      });
    }
  }

  writePreviewSnapshot(snapshot, nextRevision);
  return nextRevision;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (hasTauriRuntime()) {
    try {
      return await invoke<AppSnapshot>('load_snapshot');
    } catch (error) {
      console.warn(
        'Failed to load snapshot from SQLite, falling back to local preview storage.',
        error,
      );
    }
  }

  const raw = window.localStorage.getItem(LOCAL_PREVIEW_KEY);
  if (!raw) {
    return buildDefaultState();
  }

  return JSON.parse(raw) as AppSnapshot;
}

export async function saveSnapshot(snapshot: AppSnapshot): Promise<void> {
  if (hasTauriRuntime()) {
    try {
      await invoke('save_snapshot', { snapshot });
      return;
    } catch (error) {
      console.warn(
        'Failed to save snapshot to SQLite, falling back to local preview storage.',
        error,
      );
    }
  }

  window.localStorage.setItem(LOCAL_PREVIEW_KEY, JSON.stringify(snapshot));
}

export function clearPreviewSnapshot(): void {
  window.localStorage.removeItem(LOCAL_PREVIEW_KEY);
  window.localStorage.removeItem(LOCAL_PREVIEW_REVISION_KEY);
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
