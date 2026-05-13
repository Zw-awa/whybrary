import '../test/setup';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BrainCanvas } from './BrainCanvas';
import type { BrainNode, Space } from '../types';

function makeNode(id: string, label: string, x: number, y: number): BrainNode {
  return {
    id,
    type: 'neuron',
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
        type: 'default',
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

  render(
    <BrainCanvas
      editingNodeId={null}
      isEditMode
      onAddNeuron={onAddNeuron}
      onDeleteNodes={onDeleteNodes}
      onFinishRenameNode={onFinishRenameNode}
      onNodeLabelChange={onNodeLabelChange}
      onPersistNodePositions={onPersistNodePositions}
      onStartRenameNode={onStartRenameNode}
      onToggleConnection={onToggleConnection}
      onToggleEditMode={onToggleEditMode}
      onViewportChange={onViewportChange}
      space={makeSpace()}
      {...overrides}
    />,
  );

  return {
    onAddNeuron,
    onDeleteNodes,
    onPersistNodePositions,
    onNodeLabelChange,
    onStartRenameNode,
    onFinishRenameNode,
    onToggleEditMode,
    onToggleConnection,
    onViewportChange,
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

    await user.click(screen.getByRole('button', { name: 'Link Mode Off' }));
    fireEvent.pointerDown(alpha);
    fireEvent.click(alpha);
    fireEvent.pointerDown(beta);
    fireEvent.click(beta);
    expect(onToggleConnection).toHaveBeenCalledWith('a', 'b');
  });
});
