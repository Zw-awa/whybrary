import { describe, expect, it } from 'vitest';
import type { AppSnapshot, BrainNode, Space, TodoItem } from '../types';
import { workspaceReducer } from './workspaceReducer';

const at = '2026-08-11T00:00:00.000Z';
const node = (id: string): BrainNode => ({ id, position: { x: 1, y: 2 }, data: { label: id } });
const space = (id = 'space-1'): Space => ({
  id,
  name: id,
  nodes: [node('node-1'), node('node-2')],
  edges: [{ id: 'edge-1', source: 'node-1', target: 'node-2' }],
  todos: [],
  viewport: { x: 0, y: 0, zoom: 1 },
  createdAt: at,
  updatedAt: at,
});
const snapshot = (): AppSnapshot => ({
  locale: 'en',
  theme: 'light',
  spaces: [space()],
  activeSpaceId: 'space-1',
  lastOpenedAt: at,
  hasSeenTutorial: true,
});

describe('workspaceReducer', () => {
  it('updates settings and ignores an unknown active space', () => {
    const themed = workspaceReducer(snapshot(), { type: 'theme.set', theme: 'dark', at: 'later' });
    const unchanged = workspaceReducer(themed, {
      type: 'space.select',
      spaceId: 'missing',
      at: 'latest',
    });
    expect(themed).toMatchObject({ theme: 'dark', lastOpenedAt: 'later' });
    expect(unchanged).toBe(themed);
  });

  it('deletes connected edges with a node', () => {
    const next = workspaceReducer(snapshot(), {
      type: 'nodes.delete',
      spaceId: 'space-1',
      nodeIds: ['node-1'],
      at: 'later',
    });
    expect(next.spaces[0].nodes.map((item) => item.id)).toEqual(['node-2']);
    expect(next.spaces[0].edges).toEqual([]);
  });

  it('replaces the last space using the supplied replacement', () => {
    const replacement = space('replacement');
    const next = workspaceReducer(snapshot(), {
      type: 'space.delete',
      spaceId: 'space-1',
      replacement,
      at: 'later',
    });
    expect(next.spaces).toEqual([replacement]);
    expect(next.activeSpaceId).toBe('replacement');
  });

  it('toggles undirected edges without creating self-links', () => {
    const removed = workspaceReducer(snapshot(), {
      type: 'edge.toggle',
      spaceId: 'space-1',
      edge: { id: 'new', source: 'node-2', target: 'node-1' },
      at: 'later',
    });
    const ignored = workspaceReducer(removed, {
      type: 'edge.toggle',
      spaceId: 'space-1',
      edge: { id: 'self', source: 'node-1', target: 'node-1' },
      at: 'latest',
    });
    expect(removed.spaces[0].edges).toEqual([]);
    expect(ignored.spaces[0].edges).toEqual([]);
  });

  it('trims new todos and timestamps later edits', () => {
    const todo: TodoItem = {
      id: 'todo-1',
      text: '  Focus  ',
      completed: false,
      createdAt: at,
      updatedAt: at,
    };
    const added = workspaceReducer(snapshot(), {
      type: 'todo.add',
      spaceId: 'space-1',
      todo,
      at: 'later',
    });
    const toggled = workspaceReducer(added, {
      type: 'todo.toggle',
      spaceId: 'space-1',
      todoId: todo.id,
      at: 'latest',
    });
    expect(added.spaces[0].todos[0].text).toBe('Focus');
    expect(toggled.spaces[0].todos[0]).toMatchObject({ completed: true, updatedAt: 'latest' });
  });

  it('uses supplied node positions without affecting other nodes', () => {
    const next = workspaceReducer(snapshot(), {
      type: 'nodes.position',
      spaceId: 'space-1',
      nodes: [{ id: 'node-1', position: { x: 40, y: 80 } }],
      at: 'later',
    });
    expect(next.spaces[0].nodes[0].position).toEqual({ x: 40, y: 80 });
    expect(next.spaces[0].nodes[1].position).toEqual({ x: 1, y: 2 });
  });
});
