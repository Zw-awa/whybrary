import { describe, expect, it } from 'vitest';
import { createSpace } from '../lib/defaults';
import { reviewSpace } from './whyReview';

describe('why review plugin', () => {
  it('reports empty and disconnected nodes deterministically', () => {
    const space = createSpace('Test', 'en');
    space.nodes.push({ id: 'orphan', position: { x: 0, y: 0 }, data: { label: '' } });
    const before = JSON.stringify(space);
    const result = reviewSpace(space, 'en');
    expect(result.map((item) => item.id)).toContain('node.empty.orphan');
    expect(result.map((item) => item.id)).toContain('node.orphan.orphan');
    expect(JSON.stringify(space)).toBe(before);
  });

  it('reports invalid and duplicate edges', () => {
    const space = createSpace('Test', 'en');
    const first = space.nodes[0].id;
    const second = space.nodes[1].id;
    space.edges.push(
      { id: 'self', source: first, target: first },
      { id: 'duplicate', source: second, target: first },
      { id: 'missing', source: 'gone', target: first },
    );
    const ids = reviewSpace(space, 'en').map((item) => item.id);
    expect(ids).toEqual(expect.arrayContaining(['edge.self.self', 'edge.duplicate.duplicate', 'edge.missing.missing']));
  });

  it('returns localized clear output for a healthy space', () => {
    const space = createSpace('Test', 'zh');
    space.todos.forEach((todo) => { todo.completed = true; });
    expect(reviewSpace(space, 'zh')).toEqual([
      { id: 'todo.none-open', label: '当前没有待推进的行动', tone: 'neutral' },
    ]);
  });
});
