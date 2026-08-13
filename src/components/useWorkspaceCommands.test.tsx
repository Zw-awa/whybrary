import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWorkspaceCommands } from './useWorkspaceCommands';
import type { AppSnapshot } from '../types';

function makeSnapshot(): AppSnapshot {
  return {
    activeSpaceId: 'space-1',
    hasSeenTutorial: true,
    lastOpenedAt: '2026-08-13T00:00:00.000Z',
    locale: 'zh',
    spaces: [
      {
        createdAt: '2026-08-13T00:00:00.000Z',
        edges: [],
        id: 'space-1',
        name: '当前空间',
        nodes: [],
        todos: [],
        updatedAt: '2026-08-13T00:00:00.000Z',
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    ],
    theme: 'light',
  };
}

describe('useWorkspaceCommands localization', () => {
  it('uses localized names when creating or replacing the final space', () => {
    const snapshot = makeSnapshot();
    const dispatch = vi.fn();
    const { result } = renderHook(() =>
      useWorkspaceCommands({
        dispatch,
        getSnapshot: () => snapshot,
        replaceSnapshot: vi.fn(),
      }),
    );

    result.current.spaces.create();
    result.current.spaces.delete('space-1');

    expect(dispatch.mock.calls[0][0]).toMatchObject({
      type: 'space.create',
      space: { name: '空间 2' },
    });
    expect(dispatch.mock.calls[1][0]).toMatchObject({
      type: 'space.delete',
      replacement: { name: '我的第一个空间' },
    });
  });
});
