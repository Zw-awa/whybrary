import { renderHook, act, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../test/setup';
import { buildDefaultState } from '../lib/defaults';
import type { AppSnapshot } from '../types';
import { useWorkspacePersistence } from './useWorkspacePersistence';

const persistence = vi.hoisted(() => ({
  apply: vi.fn(),
  clear: vi.fn(),
  load: vi.fn(),
  replace: vi.fn(),
}));

Object.defineProperty(window, 'matchMedia', {
  configurable: true,
  value: () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }),
});

vi.mock('../lib/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/persistence')>();
  return {
    ...actual,
    applyMutationBatch: persistence.apply,
    clearPreviewSnapshot: persistence.clear,
    loadWorkspace: persistence.load,
    replaceWorkspace: persistence.replace,
  };
});

function snapshot(name = 'One'): AppSnapshot {
  const result = buildDefaultState('en');
  return { ...result, spaces: result.spaces.map((space) => ({ ...space, name })) };
}

describe('useWorkspacePersistence', () => {
  beforeEach(() => {
    persistence.apply.mockReset();
    persistence.clear.mockReset();
    persistence.load.mockReset();
    persistence.replace.mockReset();
  });

  it('queues edits that arrive while an earlier save is in flight', async () => {
    const first = snapshot();
    const second = snapshot('Two');
    const third = snapshot('Three');
    let resolveFirst: (revision: number) => void = () => undefined;
    persistence.load.mockResolvedValue({ snapshot: first, revision: 0 });
    persistence.apply
      .mockImplementationOnce(
        () =>
          new Promise<number>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce(2);
    const loaded = vi.fn();
    const { rerender } = renderHook(
      ({ current }) => useWorkspacePersistence({ snapshot: current, onLoaded: loaded }),
      { initialProps: { current: first } },
    );
    await waitFor(() => expect(loaded).toHaveBeenCalled());
    rerender({ current: second });
    await new Promise((resolve) => setTimeout(resolve, 450));
    expect(persistence.apply).toHaveBeenCalledTimes(1);
    rerender({ current: third });
    act(() => resolveFirst(1));
    await waitFor(() => expect(persistence.apply).toHaveBeenCalledTimes(2));
    expect(persistence.apply.mock.calls[1][1]).toEqual(third);
  });

  it('retries a failed save without losing the desired snapshot', async () => {
    const first = snapshot();
    const changed = snapshot('Changed');
    persistence.load.mockResolvedValue({ snapshot: first, revision: 0 });
    persistence.apply.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(2);
    const { result, rerender } = renderHook(
      ({ current }) => useWorkspacePersistence({ snapshot: current, onLoaded: vi.fn() }),
      { initialProps: { current: first } },
    );
    await waitFor(() => expect(result.current.status).toBe('saved'));
    rerender({ current: changed });
    await waitFor(() => expect(result.current.status).toBe('error'), { timeout: 1000 });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(persistence.apply).toHaveBeenCalledTimes(2);
  });
});
