import './test/setup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from './types';

const { loadSnapshotMock, saveSnapshotMock } = vi.hoisted(() => ({
  loadSnapshotMock: vi.fn(),
  saveSnapshotMock: vi.fn(),
}));

vi.mock('./lib/persistence', () => ({
  loadSnapshot: loadSnapshotMock,
  saveSnapshot: saveSnapshotMock,
}));

vi.mock('./components/BrainCanvas', () => ({
  BrainCanvas: ({ onDeleteNodes, space }: { onDeleteNodes: (nodeIds: string[]) => void; space: AppSnapshot['spaces'][number] }) => (
    <section data-testid="brain-canvas-mock">
      <div>
        {space.nodes.length} nodes / {space.edges.length} edges
      </div>
      <button onClick={() => onDeleteNodes(['node-a'])} type="button">
        Delete Node A
      </button>
    </section>
  ),
}));

vi.mock('./components/WhyTodoPanel', () => ({
  WhyTodoPanel: ({ space }: { space: AppSnapshot['spaces'][number] }) => (
    <section data-testid="todo-panel-mock">{space.todos.length} todos</section>
  ),
}));

import App from './App';

function makeSnapshot(): AppSnapshot {
  return {
    theme: 'dark',
    activeSpaceId: 'space-1',
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
    spaces: [
      {
        id: 'space-1',
        name: 'Loaded Space',
        nodes: [
          {
            id: 'node-a',
            position: { x: 120, y: 180 },
            data: { label: 'Alpha' },
          },
          {
            id: 'node-b',
            position: { x: 320, y: 220 },
            data: { label: 'Beta' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-a',
            target: 'node-b',
          },
        ],
        todos: [
          {
            id: 'todo-1',
            text: 'Open task',
            completed: false,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  };
}

function stubMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubMatchMedia(false);
    document.documentElement.dataset.theme = '';
    loadSnapshotMock.mockResolvedValue(makeSnapshot());
    saveSnapshotMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    document.documentElement.dataset.theme = '';
  });

  it('loads the persisted snapshot and applies its theme', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Loaded Space' })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(screen.getByRole('button', { name: 'Use Light Theme' })).toBeTruthy();
  });

  it('falls back to the default state when snapshot loading fails', async () => {
    loadSnapshotMock.mockRejectedValue(new Error('load failed'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'My First Space' })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('toggles theme and persists the updated snapshot', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });
    saveSnapshotMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Use Light Theme' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });
    expect((saveSnapshotMock.mock.calls[0]?.[0] as AppSnapshot).theme).toBe('light');
  });

  it('exports the current snapshot as json', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:whybrary'),
      revokeObjectURL: vi.fn(),
    });

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:whybrary');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:whybrary');
  });

  it('imports a snapshot from json', async () => {
    const imported = {
      ...makeSnapshot(),
      spaces: [
        {
          ...makeSnapshot().spaces[0],
          id: 'space-2',
          name: 'Imported Space',
        },
      ],
      activeSpaceId: 'space-2',
    };

    const file = new File([JSON.stringify(imported)], 'whybrary.json', {
      type: 'application/json',
    });
    Object.defineProperty(file, 'text', {
      configurable: true,
      value: vi.fn().mockResolvedValue(JSON.stringify(imported)),
    });

    const clickMock = vi.fn(function click(this: HTMLInputElement) {
      Object.defineProperty(this, 'files', {
        configurable: true,
        value: [file],
      });
      this.onchange?.(new Event('change'));
    });

    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement');
    createElementSpy.mockImplementation(((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === 'input') {
        Object.defineProperty(element, 'click', {
          configurable: true,
          value: clickMock,
        });
      }
      return element;
    }) as typeof document.createElement);

    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Import JSON' }));

    expect(await screen.findByRole('heading', { name: 'Imported Space' })).toBeTruthy();
    expect(clickMock).toHaveBeenCalledOnce();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('creates, renames, switches spaces, and debounces the saved snapshot', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });
    saveSnapshotMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'New Space' }));
    expect(screen.getByRole('heading', { name: 'Space 2' })).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Renamed Space' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Loaded Space/ }));

    expect(screen.getByRole('heading', { name: 'Loaded Space' })).toBeTruthy();
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });

    const saved = saveSnapshotMock.mock.calls[0]?.[0] as AppSnapshot;
    expect(saved.spaces).toHaveLength(2);
    expect(saved.spaces.some((space) => space.name === 'Renamed Space')).toBe(true);
    expect(saved.activeSpaceId).toBe('space-1');
  });

  it('replaces the last remaining space with a fresh default space on delete', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<App />);

    await screen.findByRole('heading', { name: 'Loaded Space' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('heading', { name: 'My First Space' })).toBeTruthy();
    expect(confirmSpy).toHaveBeenCalledOnce();
  });

  it('removes connected edges when the canvas deletes a node', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });
    saveSnapshotMock.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Node A' }));
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });

    const saved = saveSnapshotMock.mock.calls[0]?.[0] as AppSnapshot;
    const activeSpace = saved.spaces.find((space) => space.id === 'space-1');
    expect(activeSpace?.nodes.map((node) => node.id)).toEqual(['node-b']);
    expect(activeSpace?.edges).toEqual([]);
  });
});
