import '../test/setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from '../types';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));
const defaultSnapshot: AppSnapshot = {
  locale: 'en',
  theme: 'dark',
  activeSpaceId: 'default-space',
  lastOpenedAt: '2026-01-01T00:00:00.000Z',
  hasSeenTutorial: true,
  spaces: [
    {
      id: 'default-space',
      name: 'Default Space',
      nodes: [],
      edges: [],
      todos: [],
      viewport: { x: 0, y: 0, zoom: 0.9 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('./defaults', () => ({
  buildDefaultState: vi.fn(() => defaultSnapshot),
}));

import { clearPreviewSnapshot, loadSnapshot, saveSnapshot } from './persistence';

const previewSnapshot: AppSnapshot = {
  locale: 'zh',
  theme: 'light',
  activeSpaceId: 'preview-space',
  lastOpenedAt: '2026-02-02T00:00:00.000Z',
  hasSeenTutorial: false,
  spaces: [
    {
      id: 'preview-space',
      name: 'Preview Space',
      nodes: [],
      edges: [],
      todos: [],
      viewport: { x: 10, y: 20, zoom: 1.2 },
      createdAt: '2026-02-02T00:00:00.000Z',
      updatedAt: '2026-02-02T00:00:00.000Z',
    },
  ],
};

function setTauriRuntime(enabled: boolean) {
  if (enabled) {
    Object.assign(window, { __TAURI_INTERNALS__: {} });
    return;
  }

  delete (window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}

describe('persistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    setTauriRuntime(false);
  });

  afterEach(() => {
    window.localStorage.clear();
    setTauriRuntime(false);
  });

  it('loads snapshots through Tauri invoke when the runtime is available', async () => {
    setTauriRuntime(true);
    invokeMock.mockResolvedValue(previewSnapshot);

    await expect(loadSnapshot()).resolves.toEqual(previewSnapshot);
    expect(invokeMock).toHaveBeenCalledWith('load_snapshot');
  });

  it('falls back to preview storage when Tauri load fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTauriRuntime(true);
    invokeMock.mockRejectedValue(new Error('sqlite unavailable'));
    window.localStorage.setItem('whybrary.preview.snapshot', JSON.stringify(previewSnapshot));

    await expect(loadSnapshot()).resolves.toEqual(previewSnapshot);
    expect(warnSpy).toHaveBeenCalledOnce();
  });

  it('returns the default snapshot when preview storage is empty', async () => {
    await expect(loadSnapshot()).resolves.toEqual(defaultSnapshot);
  });

  it('saves snapshots through Tauri invoke when the runtime is available', async () => {
    setTauriRuntime(true);
    invokeMock.mockResolvedValue(undefined);

    await saveSnapshot(previewSnapshot);

    expect(invokeMock).toHaveBeenCalledWith('save_snapshot', { snapshot: previewSnapshot });
    expect(window.localStorage.getItem('whybrary.preview.snapshot')).toBeNull();
  });

  it('falls back to preview storage when Tauri save fails', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    setTauriRuntime(true);
    invokeMock.mockRejectedValue(new Error('sqlite unavailable'));

    await saveSnapshot(previewSnapshot);

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem('whybrary.preview.snapshot')).toBe(
      JSON.stringify(previewSnapshot),
    );
  });

  it('clears the preview snapshot from local storage', () => {
    window.localStorage.setItem('whybrary.preview.snapshot', JSON.stringify(previewSnapshot));
    clearPreviewSnapshot();
    expect(window.localStorage.getItem('whybrary.preview.snapshot')).toBeNull();
  });
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
