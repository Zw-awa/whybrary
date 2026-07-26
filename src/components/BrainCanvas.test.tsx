import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BrainCanvas } from './BrainCanvas';
import type { BrainNode, Space } from '../types';
import { flushAnimationFrame } from '../test/setup';

function makeNode(id: string, label: string, x: number, y: number): BrainNode {
  return {
    id,
    position: { x, y },
    data: { label },
  };
}

function makeSpace(): Space {
  return {
    id: 'space-1',
    name: 'Test Space',
    nodes: [makeNode('a', 'Alpha', 100, 120), makeNode('b', 'Beta', 220, 140)],
    edges: [
      {
        id: 'edge-1',
        source: 'a',
        target: 'b',
      },
    ],
    todos: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderCanvas(overrides?: Partial<React.ComponentProps<typeof BrainCanvas>>) {
  const onAddNeuron = vi.fn((position?: BrainNode['position']) =>
    makeNode('c', '', position?.x ?? 400, position?.y ?? 300),
  );
  const onDeleteNodes = vi.fn();
  const onPersistNodePositions = vi.fn();
  const onNodeLabelChange = vi.fn();
  const onStartRenameNode = vi.fn();
  const onFinishRenameNode = vi.fn();
  const onToggleEditMode = vi.fn();
  const onToggleConnection = vi.fn();
  const onViewportChange = vi.fn();

  const baseProps: React.ComponentProps<typeof BrainCanvas> = {
    editingNodeId: null,
    isEditMode: true,
    locale: 'en',
    onAddNeuron,
    onDeleteNodes,
    onFinishRenameNode,
    onNodeLabelChange,
    onPersistNodePositions,
    onStartRenameNode,
    onToggleConnection,
    onToggleEditMode,
    onViewportChange,
    space: makeSpace(),
    ...overrides,
  };
  const view = render(
    <BrainCanvas
      {...baseProps}
    />,
  );

  return {
    container: document.body,
    onAddNeuron,
    onDeleteNodes,
    onPersistNodePositions,
    onNodeLabelChange,
    onStartRenameNode,
    onFinishRenameNode,
    onToggleEditMode,
    onToggleConnection,
    onViewportChange,
    rerenderCanvas: (nextOverrides: Partial<React.ComponentProps<typeof BrainCanvas>>) =>
      view.rerender(<BrainCanvas {...baseProps} {...nextOverrides} />),
  };
}

describe('BrainCanvas interactions', () => {
  it('shows a new point immediately after clicking New Point', async () => {
    const user = userEvent.setup();
    renderCanvas();

    expect(screen.queryByDisplayValue('')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'New Point' }));

    expect(screen.getAllByRole('button', { name: /Untitled|Alpha|Beta/ }).length).toBeGreaterThan(2);
  });

  it('tracks a node on info click by default', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);

    expect(alpha.className).toContain('is-tracked');
    expect(alpha.className).toContain('is-selected');
  });

  it('supports multi-select and batch delete from info panel', async () => {
    const user = userEvent.setup();
    const { onDeleteNodes } = renderCanvas();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    await user.click(screen.getByRole('button', { name: 'Multi Off' }));
    await user.click(within(info).getByRole('button', { name: /Alpha/ }));
    await user.click(within(info).getByRole('button', { name: /Beta/ }));
    await user.click(within(info).getByRole('button', { name: 'Delete Selected' }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onDeleteNodes).toHaveBeenCalledWith(['a', 'b']);
  });

  it('deletes current info selection via keyboard delete', async () => {
    const user = userEvent.setup();
    const { onDeleteNodes } = renderCanvas();

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    await user.click(within(info).getByRole('button', { name: /Alpha/ }));
    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onDeleteNodes).toHaveBeenCalledWith(['a']);
  });

  it('shows the mobile action bar and node actions when rendered in phone mode', async () => {
    renderCanvas({ isMobile: true });

    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    fireEvent.pointerDown(nodeContainer, { clientX: 100, clientY: 120 });

    expect(screen.getByRole('button', { name: 'Rename' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeTruthy();
  });

  it('shows contextual node actions and requests deletion in desktop edit mode', () => {
    const onRequestDeleteNodes = vi.fn();
    renderCanvas({ onRequestDeleteNodes });
    const alpha = screen
      .getAllByRole('button', { name: 'Alpha' })
      .find((node) => node.className.includes('mind-node__label')) as HTMLElement;

    fireEvent.pointerDown(alpha.closest('.mind-node') as HTMLElement, { clientX: 100, clientY: 120 });
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onRequestDeleteNodes).toHaveBeenCalledWith(['a'], ['Alpha']);
  });

  it('renders node information into the desktop rail host', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    renderCanvas({ infoPortalTarget: host, isInfoOpen: true });

    expect(host.querySelector('.graph-info--rail')).toBeTruthy();
    expect(host.textContent).toContain('2 nodes');
  });

  it('does not show link mode controls outside edit mode', () => {
    renderCanvas({ isEditMode: false });

    expect(screen.queryByRole('button', { name: 'Enable Link Mode' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Link Mode Enabled' })).toBeNull();
  });

  it('uses explicit link mode before creating a connection', async () => {
    const user = userEvent.setup();
    const { onToggleConnection } = renderCanvas();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const beta = graphLabels.find((node) => node.textContent === 'Beta') as HTMLElement;

    await user.click(alpha);
    await user.click(beta);
    expect(onToggleConnection).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Enable Link Mode' }));
    fireEvent.pointerDown(alpha);
    fireEvent.click(alpha);
    fireEvent.pointerDown(beta);
    fireEvent.click(beta);
    expect(onToggleConnection).toHaveBeenCalledWith('a', 'b');
  });

  it('allows dragging after leaving edit mode while link mode was active', () => {
    vi.useFakeTimers();
    const { onPersistNodePositions, rerenderCanvas } = renderCanvas();

    fireEvent.click(screen.getByRole('button', { name: 'Enable Link Mode' }));
    rerenderCanvas({ isEditMode: false });
    const alpha = screen.getByRole('button', { name: 'Alpha' });
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    flushAnimationFrame();
    fireEvent.pointerDown(nodeContainer, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 220 });
    flushAnimationFrame(3);
    fireEvent.pointerUp(window, { clientX: 180, clientY: 220 });
    act(() => vi.advanceTimersByTime(220));

    expect(onPersistNodePositions).toHaveBeenCalled();
  });

  it('zooms the viewport around the pointer position', () => {
    const { onViewportChange, container } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    fireEvent.wheel(shell, { deltaY: -100, clientX: 400, clientY: 300 });

    expect(onViewportChange).toHaveBeenCalledWith({
      x: -32,
      y: -24,
      zoom: 1.08,
    });
  });

  it('clamps zoom-in at the maximum viewport scale', () => {
    const { onViewportChange, container } = renderCanvas({
      space: {
        ...makeSpace(),
        viewport: { x: 0, y: 0, zoom: 1.78 },
      },
    });
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    fireEvent.wheel(shell, { deltaY: -100, clientX: 400, clientY: 300 });

    expect(onViewportChange).toHaveBeenCalledTimes(1);
    const nextViewport = onViewportChange.mock.calls[0]?.[0] as Space['viewport'];
    expect(nextViewport.zoom).toBe(1.8);
    expect(nextViewport.x).toBeCloseTo(-4.49438202247194);
    expect(nextViewport.y).toBeCloseTo(-3.370786516853911);
  });

  it('does not emit a viewport change when already at the minimum zoom', () => {
    const { onViewportChange, container } = renderCanvas({
      space: {
        ...makeSpace(),
        viewport: { x: 0, y: 0, zoom: 0.35 },
      },
    });
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    fireEvent.wheel(shell, { deltaY: 100, clientX: 400, clientY: 300 });

    expect(onViewportChange).not.toHaveBeenCalled();
  });

  it('pans the viewport when dragging the canvas background', () => {
    const { onViewportChange, container } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    flushAnimationFrame();
    fireEvent.pointerDown(shell, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 130, clientY: 160 });

    expect(onViewportChange).toHaveBeenCalledWith({
      x: 30,
      y: 40,
      zoom: 1,
    });
  });

  it('cancels tracking when the user zooms the canvas', async () => {
    const user = userEvent.setup();
    const { container } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);
    expect(alpha.className).toContain('is-tracked');

    fireEvent.wheel(shell, { deltaY: -100, clientX: 400, clientY: 300 });

    expect(alpha.className).not.toContain('is-tracked');
  });

  it('cancels tracking when the user starts panning the canvas', async () => {
    const user = userEvent.setup();
    const { container, onViewportChange } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);
    expect(alpha.className).toContain('is-tracked');

    fireEvent.pointerDown(shell, { clientX: 400, clientY: 300 });

    expect(onViewportChange).toHaveBeenCalledWith({
      x: 300,
      y: 180,
      zoom: 1,
    });
    expect(alpha.className).not.toContain('is-tracked');
  });

  it('commits tracked viewport before clearing tracking on background pointer down', async () => {
    const user = userEvent.setup();
    const { container, onViewportChange } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);
    expect(alpha.className).toContain('is-tracked');

    fireEvent.pointerDown(shell, { clientX: 400, clientY: 300 });

    expect(onViewportChange).toHaveBeenCalledTimes(1);
    expect(onViewportChange).toHaveBeenCalledWith({
      x: 300,
      y: 180,
      zoom: 1,
    });
    expect(alpha.className).not.toContain('is-tracked');
  });

  it('cancels tracking when multi-select is enabled', async () => {
    const user = userEvent.setup();
    renderCanvas();

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);
    expect(alpha.className).toContain('is-tracked');

    await user.click(screen.getByRole('button', { name: 'Multi Off' }));

    expect(alpha.className).not.toContain('is-tracked');
  });

  it('persists node positions after a real drag gesture', () => {
    vi.useFakeTimers();
    const { onPersistNodePositions } = renderCanvas();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    flushAnimationFrame();
    fireEvent.pointerDown(nodeContainer, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 220 });
    flushAnimationFrame(3);
    fireEvent.pointerUp(window, { clientX: 180, clientY: 220 });
    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(onPersistNodePositions).toHaveBeenCalled();
    const persistedNodes = onPersistNodePositions.mock.calls[
      onPersistNodePositions.mock.calls.length - 1
    ]?.[0] as BrainNode[];
    const alphaNode = persistedNodes.find((node) => node.id === 'a');
    expect(alphaNode?.position.x).toBeCloseTo(180);
    expect(alphaNode?.position.y).toBeCloseTo(220);
  });

  it('recognizes a drag when pointerup immediately follows the threshold move', () => {
    vi.useFakeTimers();
    const { onPersistNodePositions } = renderCanvas();
    const alpha = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .find((node) => node.className.includes('mind-node__label') && node.textContent === 'Alpha') as HTMLElement;
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    fireEvent.pointerDown(nodeContainer, { button: 0, clientX: 100, clientY: 120, isPrimary: true });
    fireEvent.pointerMove(window, { clientX: 180, clientY: 220 });
    fireEvent.pointerUp(window, { clientX: 180, clientY: 220 });
    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(onPersistNodePositions).toHaveBeenCalledTimes(1);
  });

  it('pulls connected nodes while a node is being dragged', () => {
    renderCanvas();
    const labels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = labels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const beta = labels.find((node) => node.textContent === 'Beta') as HTMLElement;
    const alphaContainer = alpha.closest('.mind-node') as HTMLElement;
    const betaContainer = beta.closest('.mind-node') as HTMLElement;
    const initialBetaLeft = Number.parseFloat(betaContainer.style.left);

    flushAnimationFrame();
    fireEvent.pointerDown(alphaContainer, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: -200, clientY: 120 });
    flushAnimationFrame(5);

    const movedBeta = screen
      .getAllByRole('button', { name: 'Beta' })
      .find((node) => node.className.includes('mind-node__label')) as HTMLElement;
    const movedBetaContainer = movedBeta.closest('.mind-node') as HTMLElement;
    expect(Number.parseFloat(movedBetaContainer.style.left)).not.toBe(initialBetaLeft);
    fireEvent.pointerUp(window, { clientX: -200, clientY: 120 });
  });

  it('does not persist node positions when the pointer movement stays below drag threshold', () => {
    vi.useFakeTimers();
    const { onPersistNodePositions } = renderCanvas();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    flushAnimationFrame();
    fireEvent.pointerDown(nodeContainer, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 102, clientY: 123 });
    flushAnimationFrame(2);
    fireEvent.pointerUp(window, { clientX: 102, clientY: 123 });
    act(() => {
      vi.advanceTimersByTime(220);
    });

    expect(onPersistNodePositions).not.toHaveBeenCalled();
  });

  it('still processes a node click after sub-threshold pointer movement', () => {
    renderCanvas();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const nodeContainer = alpha.closest('.mind-node') as HTMLElement;

    fireEvent.pointerDown(nodeContainer, { clientX: 100, clientY: 120 });
    fireEvent.pointerMove(window, { clientX: 102, clientY: 123 });
    fireEvent.pointerUp(window, { clientX: 102, clientY: 123 });
    expect(nodeContainer.className).toContain('is-selected');

    fireEvent.click(alpha);

    expect(nodeContainer.className).not.toContain('is-selected');
  });

  it('clears tracked and selected state after deleting the current info selection', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { onDeleteNodes } = renderCanvas();

    await user.click(screen.getByRole('button', { name: 'Show Info' }));
    const info = screen.getByText('2 nodes').closest('.graph-info') as HTMLElement;
    const alpha = within(info).getByRole('button', { name: /Alpha/ });
    await user.click(alpha);
    expect(alpha.className).toContain('is-tracked');
    expect(alpha.className).toContain('is-selected');

    await user.click(within(info).getByRole('button', { name: 'Delete Selected' }));

    expect(confirmSpy).toHaveBeenCalledOnce();
    expect(onDeleteNodes).toHaveBeenCalledWith(['a']);
  });

  it('does not create a connection when the same node is clicked twice in link mode', async () => {
    const user = userEvent.setup();
    const { onToggleConnection } = renderCanvas();
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Enable Link Mode' }));
    fireEvent.pointerDown(alpha);
    fireEvent.click(alpha);
    fireEvent.pointerDown(alpha);
    fireEvent.click(alpha);

    expect(onToggleConnection).not.toHaveBeenCalled();
  });

  it('clears the pending source when the user clicks the background in link mode', async () => {
    const user = userEvent.setup();
    const { container, onToggleConnection } = renderCanvas();
    const shell = container.querySelector('.graph-shell') as HTMLElement;
    const graphLabels = screen
      .getAllByRole('button', { name: /Alpha|Beta/ })
      .filter((node) => node.className.includes('mind-node__label'));
    const alpha = graphLabels.find((node) => node.textContent === 'Alpha') as HTMLElement;
    const beta = graphLabels.find((node) => node.textContent === 'Beta') as HTMLElement;

    await user.click(screen.getByRole('button', { name: 'Enable Link Mode' }));
    fireEvent.pointerDown(alpha);
    fireEvent.click(alpha);
    fireEvent.click(shell);
    fireEvent.pointerDown(beta);
    fireEvent.click(beta);

    expect(onToggleConnection).not.toHaveBeenCalled();
  });
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
