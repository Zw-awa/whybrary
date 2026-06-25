import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import {
  CENTER_PULL,
  clamp,
  DAMPING,
  FAR_ATTRACTION_RADIUS,
  FAR_ATTRACTION_STRENGTH,
  MAX_SPEED,
  mergeSimNodes,
  MIN_MOVEMENT,
  OVERLAP_DISTANCE,
  OVERLAP_PUSH,
  REPULSION_RADIUS,
  REPULSION_STRENGTH,
  samePositions,
  separationVector,
  type SimNode,
  SPRING_LENGTH,
  SPRING_STRENGTH,
} from '../lib/brainPhysics';
import type { Space } from '../types';
import type { BrainDragState } from './useBrainDrag';

type UseBrainSimulationArgs = {
  dragPointerRef: RefObject<{ x: number; y: number } | null>;
  dragStateRef: RefObject<BrainDragState | null>;
  shellRef: RefObject<HTMLDivElement>;
  simNodesRef: MutableRefObject<SimNode[]>;
  space: Space;
};

export function useBrainSimulation({
  dragPointerRef,
  dragStateRef,
  shellRef,
  simNodesRef,
  space,
}: UseBrainSimulationArgs) {
  const [simNodes, setSimNodes] = useState<SimNode[]>(() => simNodesRef.current);
  const frameRef = useRef<number | null>(null);
  const nodeSignature = useMemo(() => space.nodes.map((node) => node.id).join('|'), [space.nodes]);
  const edgeSignature = useMemo(
    () => space.edges.map((edge) => `${edge.source}:${edge.target}`).join('|'),
    [space.edges],
  );

  useEffect(() => {
    simNodesRef.current = simNodes;
  }, [simNodes, simNodesRef]);

  useLayoutEffect(() => {
    setSimNodes((current) => mergeSimNodes(current, space));
  }, [edgeSignature, nodeSignature, space]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const step = () => {
      const current = simNodesRef.current;
      if (current.length === 0) {
        frameRef.current = window.requestAnimationFrame(step);
        return;
      }

      const rect = shell.getBoundingClientRect();
      const centerX = (rect.width / 2 - space.viewport.x) / space.viewport.zoom;
      const centerY = (rect.height / 2 - space.viewport.y) / space.viewport.zoom;
      const next = current.map((node) => ({ ...node }));
      const indexById = new Map(next.map((node, index) => [node.id, index]));
      const draggedNodeId = dragStateRef.current?.nodeId ?? null;
      const dragPointer = dragPointerRef.current;

      if (draggedNodeId && dragPointer) {
        const draggedIndex = indexById.get(draggedNodeId);
        if (draggedIndex !== undefined) {
          next[draggedIndex].x = dragPointer.x;
          next[draggedIndex].y = dragPointer.y;
          next[draggedIndex].vx = 0;
          next[draggedIndex].vy = 0;
        }
      }

      for (let i = 0; i < next.length; i += 1) {
        for (let j = i + 1; j < next.length; j += 1) {
          const a = next[i];
          const b = next[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distanceSq = dx * dx + dy * dy + 0.01;
          const distance = Math.sqrt(distanceSq);
          const [dirX, dirY] = separationVector(a, b, i + j + 1);
          let fx = 0;
          let fy = 0;

          if (distance < OVERLAP_DISTANCE) {
            const overlap = 1 - distance / OVERLAP_DISTANCE;
            fx += dirX * overlap * OVERLAP_PUSH;
            fy += dirY * overlap * OVERLAP_PUSH;
          } else if (distance < REPULSION_RADIUS) {
            const closeness = 1 - distance / REPULSION_RADIUS;
            const force = (REPULSION_STRENGTH * closeness * closeness) / distanceSq;
            fx += dirX * force;
            fy += dirY * force;
          } else if (distance > FAR_ATTRACTION_RADIUS) {
            const stretch = distance - FAR_ATTRACTION_RADIUS;
            const force = stretch * FAR_ATTRACTION_STRENGTH;
            fx -= dirX * force;
            fy -= dirY * force;
          }

          if (a.id !== draggedNodeId) {
            a.vx -= fx;
            a.vy -= fy;
          }

          if (b.id !== draggedNodeId) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }

      for (const edge of space.edges) {
        const sourceIndex = indexById.get(edge.source);
        const targetIndex = indexById.get(edge.target);
        if (sourceIndex === undefined || targetIndex === undefined) {
          continue;
        }

        const source = next[sourceIndex];
        const target = next[targetIndex];
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const stretch = distance - SPRING_LENGTH;
        const force = stretch * SPRING_STRENGTH;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        if (source.id !== draggedNodeId) {
          source.vx += fx;
          source.vy += fy;
        }

        if (target.id !== draggedNodeId) {
          target.vx -= fx;
          target.vy -= fy;
        }
      }

      let moved = false;
      let driftingNodes = 0;
      let totalVx = 0;
      let totalVy = 0;

      for (const node of next) {
        if (node.id === draggedNodeId) {
          node.vx = 0;
          node.vy = 0;
          continue;
        }

        node.vx += (centerX - node.x) * CENTER_PULL;
        node.vy += (centerY - node.y) * CENTER_PULL;
        node.vx *= DAMPING;
        node.vy *= DAMPING;
        node.vx = clamp(node.vx, -MAX_SPEED, MAX_SPEED);
        node.vy = clamp(node.vy, -MAX_SPEED, MAX_SPEED);
        totalVx += node.vx;
        totalVy += node.vy;
        driftingNodes += 1;
      }

      const driftVx = driftingNodes > 0 ? totalVx / driftingNodes : 0;
      const driftVy = driftingNodes > 0 ? totalVy / driftingNodes : 0;

      for (const node of next) {
        if (node.id === draggedNodeId) {
          continue;
        }

        node.vx -= driftVx;
        node.vy -= driftVy;

        if (Math.abs(node.vx) > MIN_MOVEMENT || Math.abs(node.vy) > MIN_MOVEMENT) {
          moved = true;
        }

        node.x += node.vx;
        node.y += node.vy;
      }

      if ((moved || draggedNodeId) && !samePositions(current, next)) {
        simNodesRef.current = next;
        setSimNodes(next);
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [dragPointerRef, dragStateRef, edgeSignature, frameRef, shellRef, simNodesRef, space]);

  const nodeById = useMemo(() => new Map(simNodes.map((node) => [node.id, node])), [simNodes]);

  return {
    nodeById,
    setSimNodes,
    simNodes,
  };
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
