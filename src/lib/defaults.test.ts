import '../test/setup';
import { describe, expect, it } from 'vitest';
import { createNeuronNode, createSpace, normalizeSnapshot } from './defaults';

describe('defaults', () => {
  it('creates nodes and edges without legacy type fields', () => {
    const node = createNeuronNode('Why', 120, 160);
    const space = createSpace('Model Test');

    expect('type' in node).toBe(false);
    expect('type' in space.nodes[0]).toBe(false);
    expect('type' in space.edges[0]).toBe(false);
  });

  it('normalizes legacy snapshots while stripping legacy type fields', () => {
    const normalized = normalizeSnapshot({
      theme: 'dark',
      activeSpaceId: 'space-1',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
      spaces: [
        {
          id: 'space-1',
          name: ' Legacy Space ',
          nodes: [
            {
              id: 'a',
              type: 'neuron',
              position: { x: 40, y: 50 },
              data: { label: ' Alpha ' },
            },
          ],
          edges: [
            {
              id: 'e1',
              source: 'a',
              target: 'b',
              type: 'smoothstep',
            },
          ],
          todos: [],
          viewport: { x: 1, y: 2, zoom: 0.8 },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    } as never);

    expect(normalized.spaces[0].nodes[0].data.label).toBe('Alpha');
    expect('type' in normalized.spaces[0].nodes[0]).toBe(false);
    expect('type' in normalized.spaces[0].edges[0]).toBe(false);
  });

  it('falls back to the default viewport when the persisted viewport is invalid', () => {
    const normalized = normalizeSnapshot({
      theme: 'light',
      activeSpaceId: 'space-1',
      lastOpenedAt: '2026-01-01T00:00:00.000Z',
      spaces: [
        {
          id: 'space-1',
          name: 'Viewport Space',
          nodes: [],
          edges: [],
          todos: [],
          viewport: { x: Number.NaN, y: 0, zoom: 100 },
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(normalized.spaces[0].viewport).toEqual({ x: 0, y: 0, zoom: 0.9 });
  });
});
