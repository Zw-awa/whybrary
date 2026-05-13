import { invoke } from '@tauri-apps/api/core';
import type { AppSnapshot } from '../types';
import { buildDefaultState } from './defaults';

export const LOCAL_PREVIEW_KEY = 'whybrary.preview.snapshot';

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export async function loadSnapshot(): Promise<AppSnapshot> {
  if (hasTauriRuntime()) {
    try {
      return await invoke<AppSnapshot>('load_snapshot');
    } catch (error) {
      console.warn('Failed to load snapshot from SQLite, falling back to local preview storage.', error);
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
      console.warn('Failed to save snapshot to SQLite, falling back to local preview storage.', error);
    }
  }

  window.localStorage.setItem(LOCAL_PREVIEW_KEY, JSON.stringify(snapshot));
}

export function clearPreviewSnapshot(): void {
  window.localStorage.removeItem(LOCAL_PREVIEW_KEY);
}
