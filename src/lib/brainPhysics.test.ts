import '../test/setup';
import { describe, expect, it } from 'vitest';
import {
  buildPath,
  buildSimNodes,
  clamp,
  findSpawnPosition,
  mergeSimNodes,
  samePositions,
  separationVector,
} from './brainPhysics';
import type { Space } from '../types';

function makeSpace(): Space {
  return {
    id: 'space-1',
    name: 'Test',
    nodes: [
      {
        id: 'a',
        position: { x: 100, y: 120 },
        data: { label: 'A' },
      },
      {
        id: 'b',
        position: { x: 220, y: 140 },
        data: { label: 'B' },
      },
    ],
    edges: [
      {
        id: 'e1',
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

describe('brainPhysics', () => {
  it('clamps values into range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(20, 0, 10)).toBe(10);
  });

  it('builds stable path output', () => {
    const path = buildPath(
      { id: 'a', label: 'A', x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'b', label: 'B', x: 100, y: 50, vx: 0, vy: 0 },
    );

    expect(path.startsWith('M 0 0 C')).toBe(true);
    expect(path.includes('100 50')).toBe(true);
  });

  it('creates normalized separation vectors for overlapping nodes', () => {
    const [x, y] = separationVector({ x: 10, y: 10 }, { x: 10, y: 10 }, 3);
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
    expect(Math.abs(Math.sqrt(x * x + y * y) - 1)).toBeLessThan(1e-6);
  });

  it('builds sim nodes from space nodes', () => {
    const nodes = buildSimNodes(makeSpace());
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ id: 'a', label: 'A', x: 100, y: 120, vx: 0, vy: 0 });
  });

  it('merges sim nodes while preserving previous velocities', () => {
    const previous = [
      { id: 'a', label: 'old', x: 10, y: 20, vx: 3, vy: 4 },
      { id: 'b', label: 'old2', x: 30, y: 40, vx: 5, vy: 6 },
    ];

    const merged = mergeSimNodes(previous, makeSpace());
    expect(merged[0]).toMatchObject({ id: 'a', label: 'A', x: 10, y: 20, vx: 3, vy: 4 });
    expect(merged[1]).toMatchObject({ id: 'b', label: 'B', x: 30, y: 40, vx: 5, vy: 6 });
  });

  it('detects identical position lists', () => {
    const a = buildSimNodes(makeSpace());
    const b = buildSimNodes(makeSpace());
    expect(samePositions(a, b)).toBe(true);
    b[0].x += 1;
    expect(samePositions(a, b)).toBe(false);
  });

  it('finds a visible non-overlapping spawn position near the viewport center', () => {
    const position = findSpawnPosition(
      [
        { x: 200, y: 150 },
        { x: 284, y: 150 },
      ],
      { x: 0, y: 0, zoom: 1 },
      { width: 400, height: 300 },
    );

    expect(Number.isFinite(position.x)).toBe(true);
    expect(Number.isFinite(position.y)).toBe(true);
    const tooClose = [
      Math.hypot(position.x - 200, position.y - 150),
      Math.hypot(position.x - 284, position.y - 150),
    ].some((distance) => distance < 76);
    expect(tooClose).toBe(false);
  });
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
