import './test/setup';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSnapshot } from './types';

const { loadSnapshotMock, saveSnapshotMock, clearPreviewSnapshotMock } = vi.hoisted(() => ({
  loadSnapshotMock: vi.fn(),
  saveSnapshotMock: vi.fn(),
  clearPreviewSnapshotMock: vi.fn(),
}));

vi.mock('./lib/persistence', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./lib/persistence')>();
  return {
    ...actual,
    loadWorkspace: async () => ({ snapshot: await loadSnapshotMock(), revision: 0 }),
    applyMutationBatch: async (batch: { nextRevision: number }, snapshot: AppSnapshot) => {
      await saveSnapshotMock(snapshot);
      return batch.nextRevision;
    },
    replaceWorkspace: async (_snapshot: AppSnapshot, revision: number) => revision,
    clearPreviewSnapshot: clearPreviewSnapshotMock,
  };
});

vi.mock('./components/BrainCanvas', () => ({
  BrainCanvas: ({
    onAddNeuron,
    onDeleteNodes,
    onInfoOpenChange,
    onToggleEditMode,
    onToggleExpanded,
    edges,
    nodes,
  }: {
    onAddNeuron?: () => unknown;
    onDeleteNodes: (nodeIds: string[]) => void;
    onInfoOpenChange?: (open: boolean) => void;
    onToggleEditMode?: () => void;
    onToggleExpanded?: () => void;
    edges: AppSnapshot['spaces'][number]['edges'];
    nodes: AppSnapshot['spaces'][number]['nodes'];
  }) => (
    <section data-testid="brain-canvas-mock">
      <div>
        {nodes.length} nodes / {edges.length} edges
      </div>
      <button onClick={() => onDeleteNodes(['node-a'])} type="button">
        Delete Node A
      </button>
      <button onClick={() => onInfoOpenChange?.(true)} type="button">
        Mock Open Info
      </button>
      <button onClick={onToggleExpanded} type="button">
        Mock Expand Map
      </button>
      <button data-tour-id="edit-map" onClick={onToggleEditMode} type="button">
        Mock Edit Map
      </button>
      <button data-tour-id="add-node" onClick={onAddNeuron} type="button">
        Mock Add Node
      </button>
    </section>
  ),
}));

vi.mock('./components/WhyTodoPanel', () => ({
  WhyTodoPanel: ({
    onToggleExpanded,
    todos,
  }: {
    onToggleExpanded?: () => void;
    todos: AppSnapshot['spaces'][number]['todos'];
  }) => (
    <section data-testid="todo-panel-mock">
      {todos.length} todos
      <button onClick={onToggleExpanded} type="button">
        Mock Expand Todo
      </button>
    </section>
  ),
}));

import App from './App';

function makeSnapshot(hasSeenTutorial = true): AppSnapshot {
  return {
    locale: 'en',
    theme: 'dark',
    activeSpaceId: 'space-1',
    lastOpenedAt: '2026-01-01T00:00:00.000Z',
    hasSeenTutorial,
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

function setWindowWidth(width: number) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  });
  window.dispatchEvent(new Event('resize'));
}

describe('App integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWindowWidth(1280);
    stubMatchMedia(false);
    document.documentElement.dataset.theme = '';
    loadSnapshotMock.mockResolvedValue(makeSnapshot());
    saveSnapshotMock.mockResolvedValue(undefined);
    clearPreviewSnapshotMock.mockImplementation(() => undefined);
  });

  afterEach(() => {
    document.documentElement.dataset.theme = '';
  });

  it('loads the persisted snapshot and applies its theme', async () => {
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Loaded Space' })).toBeTruthy();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.getByRole('button', { name: 'Use Light Theme' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Guided tutorial' })).toBeNull();
  });

  it('closes map details before expanding the todo panel', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Open Info' }));
    expect(document.querySelector('.app-shell')?.className).toContain('is-info-open');

    fireEvent.click(screen.getByRole('button', { name: 'Mock Expand Todo' }));
    const appShell = document.querySelector('.app-shell') as HTMLElement;
    const workspaceGrid = document.querySelector('.workspace__grid') as HTMLElement;
    expect(appShell.className).toContain('is-panel-expanded');
    expect(appShell.className).not.toContain('is-info-open');
    expect(workspaceGrid.className).toContain('workspace__grid--todo-expanded');
    expect(workspaceGrid.className).not.toContain('workspace__grid--info-open');

    fireEvent.click(screen.getByRole('button', { name: 'Mock Expand Todo' }));
    expect(appShell.className).not.toContain('is-panel-expanded');
  });

  it('keeps the map in the expanded grid column and restores it', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Expand Map' }));
    const workspaceGrid = document.querySelector('.workspace__grid') as HTMLElement;
    expect(workspaceGrid.className).toContain('workspace__grid--map-expanded');
    expect(screen.getByTestId('brain-canvas-mock')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Mock Expand Map' }));
    expect(workspaceGrid.className).not.toContain('workspace__grid--map-expanded');
  });

  it('opens map details as an overlay without leaving expanded mode', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Mock Expand Map' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mock Open Info' }));

    const appShell = document.querySelector('.app-shell') as HTMLElement;
    const workspaceGrid = document.querySelector('.workspace__grid') as HTMLElement;
    expect(appShell.className).toContain('is-panel-expanded');
    expect(appShell.className).toContain('is-overlay-info-open');
    expect(appShell.className).not.toContain('is-info-open');
    expect(workspaceGrid.className).toContain('workspace__grid--map-expanded');
    expect(workspaceGrid.className).not.toContain('workspace__grid--info-open');
  });

  it('opens settings and switches the interface language to chinese', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Loaded Space' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '简体中文' }));

    expect(screen.getByRole('button', { name: '设置' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '切换为浅色主题' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '打开教程' })).toBeTruthy();
  });

  it('switches to mobile navigation and opens the spaces sheet on narrow screens', async () => {
    setWindowWidth(390);
    render(<App />);

    await screen.findByRole('heading', { name: 'Loaded Space' });
    expect(screen.getByRole('navigation', { name: 'Primary mobile navigation' })).toBeTruthy();

    fireEvent.click(screen.getAllByRole('button', { name: 'Spaces' })[0]);
    expect(screen.getByRole('button', { name: 'Close spaces' })).toBeTruthy();
  });

  it('keeps the desktop sidebar layout on narrower desktop windows', async () => {
    setWindowWidth(900);
    render(<App />);

    await screen.findByRole('heading', { name: 'Loaded Space' });
    expect(screen.queryByRole('navigation', { name: 'Primary mobile navigation' })).toBeNull();
    expect(screen.getByRole('button', { name: 'New Space' })).toBeTruthy();
  });

  it('shows a non-destructive load error when snapshot loading fails', async () => {
    loadSnapshotMock.mockRejectedValue(new Error('load failed'));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Unable to open local data' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start Fresh' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Fresh' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Tutorial Example' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /My First Space/ })).toBeTruthy();
  });

  it('toggles theme and persists the updated snapshot', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    expect(saveSnapshotMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Use Light Theme' }));

    expect(document.documentElement.dataset.theme).toBe('light');
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });
    expect((saveSnapshotMock.mock.calls[0]?.[0] as AppSnapshot).theme).toBe('light');
  });

  it('undoes and redoes workspace changes', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });
    fireEvent.click(screen.getByRole('button', { name: 'New Space' }));
    expect(screen.getByRole('heading', { name: 'Space 2' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('heading', { name: 'Loaded Space' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(screen.getByRole('heading', { name: 'Space 2' })).toBeTruthy();
  });

  it('can follow the system theme from settings', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('keeps advanced fields opt-in and remembers the preference', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });
    expect(window.localStorage.getItem('whybrary.ui.advancedFeatures')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    const toggle = screen.getByRole('checkbox', { name: 'Show advanced fields' });
    expect((toggle as HTMLInputElement).checked).toBe(false);
    fireEvent.click(toggle);
    expect(window.localStorage.getItem('whybrary.ui.advancedFeatures')).toBe('true');
  });

  it('exports the current snapshot as json', async () => {
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue('blob:whybrary'),
      revokeObjectURL: vi.fn(),
    });

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:whybrary');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Export JSON' }));

    expect(createObjectUrlSpy).toHaveBeenCalledOnce();
    expect(clickSpy).toHaveBeenCalledOnce();
    await waitFor(() => expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:whybrary'));
    expect(screen.getByText('Snapshot exported as JSON.')).toBeTruthy();
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
    expect(screen.getByText('Snapshot imported successfully.')).toBeTruthy();
  });

  it('starts the guided tutorial in an isolated example space', async () => {
    loadSnapshotMock.mockResolvedValue(makeSnapshot(false));
    render(<App />);
    expect(await screen.findByRole('dialog', { name: 'Choose your language' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '简体中文' }));
    expect(screen.getByRole('button', { name: '继续' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Tutorial Example' });

    expect(screen.getByRole('dialog', { name: 'Guided tutorial' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    expect(screen.getByText('Edit the map')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Open Editing' }));
    expect(screen.getByText('Create a node')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Create Node' }));
    expect(screen.getByText('Move the idea')).toBeTruthy();
    expect(screen.getByText('Finish naming the node')).toBeTruthy();
    expect(screen.getByText('Enter')).toBeTruthy();
  });

  it('places the tutorial exit confirmation above the tutorial overlay', async () => {
    loadSnapshotMock.mockResolvedValue(makeSnapshot(false));
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Continue' }));
    await screen.findByRole('heading', { name: 'Tutorial Example' });

    fireEvent.click(screen.getByRole('button', { name: 'Start' }));
    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));

    expect(screen.queryByRole('dialog', { name: 'Guided tutorial' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Finish Tutorial' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep Example' })).toBeTruthy();
  });

  it('opens the tutorial again from settings', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Tutorial' }));

    expect(screen.getByRole('dialog', { name: 'Guided tutorial' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Tutorial Example' })).toBeTruthy();
  });

  it('does not auto-open the tutorial for older saved snapshots that lack the new flag', async () => {
    const legacySnapshot = Object.fromEntries(
      Object.entries(makeSnapshot()).filter(([key]) => key !== 'hasSeenTutorial'),
    );
    loadSnapshotMock.mockResolvedValue(legacySnapshot as never);

    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    expect(screen.queryByRole('dialog', { name: 'Guided tutorial' })).toBeNull();
  });

  it('resets browser-local preview data to a fresh default state', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    fireEvent.click(screen.getByRole('button', { name: 'Reset Browser Data' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Data' }));

    expect(await screen.findByRole('heading', { name: 'Tutorial Example' })).toBeTruthy();
    expect(clearPreviewSnapshotMock).toHaveBeenCalledOnce();
    expect(screen.getByText('Browser-local snapshot reset.')).toBeTruthy();
  });

  it('creates, renames, switches spaces, and debounces the saved snapshot', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    expect(saveSnapshotMock).not.toHaveBeenCalled();

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
    render(<App />);

    await screen.findByRole('heading', { name: 'Loaded Space' });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Space' }));

    expect(await screen.findByRole('heading', { name: 'My First Space' })).toBeTruthy();
  });

  it('removes connected edges when the canvas deletes a node', async () => {
    render(<App />);
    await screen.findByRole('heading', { name: 'Loaded Space' });

    expect(saveSnapshotMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Node A' }));
    await waitFor(() => expect(saveSnapshotMock).toHaveBeenCalledTimes(1), { timeout: 1200 });

    const saved = saveSnapshotMock.mock.calls[0]?.[0] as AppSnapshot;
    const activeSpace = saved.spaces.find((space) => space.id === 'space-1');
    expect(activeSpace?.nodes.map((node) => node.id)).toEqual(['node-b']);
    expect(activeSpace?.edges).toEqual([]);
  });
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
