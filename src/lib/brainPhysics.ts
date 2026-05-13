import type { Space } from '../types';

export type SimNode = {
  id: string;
  label: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export const REPULSION_STRENGTH = 6200;
export const REPULSION_RADIUS = 190;
export const FAR_ATTRACTION_STRENGTH = 0.0009;
export const FAR_ATTRACTION_RADIUS = 360;
export const SPRING_STRENGTH = 0.012;
export const SPRING_LENGTH = 168;
export const DAMPING = 0.78;
export const CENTER_PULL = 0;
export const MAX_SPEED = 18;
export const MIN_MOVEMENT = 0.004;
export const OVERLAP_DISTANCE = 36;
export const OVERLAP_PUSH = 1.4;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildPath(source: SimNode, target: SimNode): string {
  const dx = target.x - source.x;
  const curve = Math.max(40, Math.abs(dx) * 0.28);
  const offset = dx >= 0 ? curve : -curve;

  return `M ${source.x} ${source.y} C ${source.x + offset} ${source.y}, ${target.x - offset} ${target.y}, ${target.x} ${target.y}`;
}

export function separationVector(
  a: Pick<SimNode, 'x' | 'y'>,
  b: Pick<SimNode, 'x' | 'y'>,
  fallbackSeed: number,
): [number, number] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  if (distance > 0.0001) {
    return [dx / distance, dy / distance];
  }

  const angle = fallbackSeed * 2.399963229728653;
  return [Math.cos(angle), Math.sin(angle)];
}

export function buildSimNodes(space: Space): SimNode[] {
  return space.nodes.map((node) => ({
    id: node.id,
    label: node.data.label,
    x: node.position.x,
    y: node.position.y,
    vx: 0,
    vy: 0,
  }));
}

export function mergeSimNodes(previous: SimNode[], space: Space): SimNode[] {
  const previousById = new Map(previous.map((node) => [node.id, node]));

  return space.nodes.map((node) => {
    const existing = previousById.get(node.id);
    if (!existing) {
      return {
        id: node.id,
        label: node.data.label,
        x: node.position.x,
        y: node.position.y,
        vx: 0,
        vy: 0,
      };
    }

    return {
      ...existing,
      label: node.data.label,
    };
  });
}

export function samePositions(a: SimNode[], b: SimNode[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((node, index) => {
    const other = b[index];
    return !!other && node.id === other.id && node.x === other.x && node.y === other.y;
  });
}

export function findSpawnPosition(
  nodes: Pick<SimNode, 'x' | 'y'>[],
  viewport: Space['viewport'],
  shellSize: { width: number; height: number } | null,
): { x: number; y: number } {
  if (!shellSize) {
    return { x: 220, y: 180 };
  }

  const centerX = (shellSize.width / 2 - viewport.x) / viewport.zoom;
  const centerY = (shellSize.height / 2 - viewport.y) / viewport.zoom;
  const offsets: Array<[number, number]> = [
    [0, 0],
    [84, 0],
    [-84, 0],
    [0, 84],
    [0, -84],
    [72, 72],
    [-72, 72],
    [72, -72],
    [-72, -72],
    [132, 0],
    [0, 132],
    [-132, 0],
    [0, -132],
  ];

  for (const [dx, dy] of offsets) {
    const x = centerX + dx;
    const y = centerY + dy;
    const overlaps = nodes.some((node) => {
      const offsetX = node.x - x;
      const offsetY = node.y - y;
      return Math.sqrt(offsetX * offsetX + offsetY * offsetY) < 76;
    });

    if (!overlaps) {
      return { x, y };
    }
  }

  return { x: centerX + 160, y: centerY + 64 };
}
