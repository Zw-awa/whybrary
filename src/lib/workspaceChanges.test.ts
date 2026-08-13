import { describe, expect, it } from 'vitest';
import type { AppSnapshot } from '../types';
import { diffSnapshots } from './workspaceChanges';

const base: AppSnapshot = {
  locale: 'en',
  theme: 'light',
  activeSpaceId: 'space-1',
  lastOpenedAt: 'one',
  hasSeenTutorial: true,
  spaces: [
    {
      id: 'space-1',
      name: 'Space',
      nodes: [
        { id: 'node-1', position: { x: 1, y: 2 }, data: { label: 'One' } },
        { id: 'node-2', position: { x: 3, y: 4 }, data: { label: 'Two' } },
      ],
      edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
      todos: [{ id: 'todo-1', text: 'Do', completed: false, createdAt: 'one', updatedAt: 'one' }],
      viewport: { x: 0, y: 0, zoom: 1 },
      createdAt: 'one',
      updatedAt: 'one',
    },
  ],
};

const clone = (): AppSnapshot => structuredClone(base);

describe('diffSnapshots', () => {
  it('returns no mutations for equal snapshots', () => {
    expect(diffSnapshots(base, clone())).toEqual([]);
  });

  it('writes only the changed node, space metadata, and settings', () => {
    const next = clone();
    next.spaces[0].nodes[0].data.label = 'Changed';
    next.spaces[0].updatedAt = 'two';
    next.lastOpenedAt = 'two';

    expect(diffSnapshots(base, next).map((item) => item.kind)).toEqual([
      'space.upsert',
      'node.upsert',
      'settings.patch',
    ]);
  });

  it('deletes an edge before deleting its node', () => {
    const next = clone();
    next.spaces[0].edges = [];
    next.spaces[0].nodes = [next.spaces[0].nodes[1]];

    expect(diffSnapshots(base, next).slice(0, 2)).toEqual([
      { kind: 'edge.delete', edgeId: 'edge-1' },
      { kind: 'node.delete', nodeId: 'node-1' },
    ]);
  });

  it('upserts every child for a newly-created space', () => {
    const next = clone();
    const created = structuredClone(next.spaces[0]);
    created.id = 'space-2';
    created.nodes[0].id = 'node-3';
    created.nodes[1].id = 'node-4';
    created.edges[0] = { id: 'edge-2', source: 'node-3', target: 'node-4' };
    created.todos[0].id = 'todo-2';
    next.spaces.push(created);

    expect(diffSnapshots(base, next).map((item) => item.kind)).toEqual([
      'space.upsert',
      'node.upsert',
      'node.upsert',
      'edge.upsert',
      'todo.upsert',
    ]);
  });
});
