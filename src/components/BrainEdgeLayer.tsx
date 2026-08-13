import { buildPath, type SimNode } from '../lib/brainPhysics';
import type { Space } from '../types';

type BrainEdgeLayerProps = {
  edges: Space['edges'];
  nodeById: Map<string, SimNode>;
  viewport: Space['viewport'];
};

export function BrainEdgeLayer({ edges, nodeById, viewport }: BrainEdgeLayerProps) {
  return (
    <svg className="mind-map__edges" preserveAspectRatio="none">
      {edges.map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);
        if (!source || !target) {
          return null;
        }

        const screenSource = {
          ...source,
          x: source.x * viewport.zoom + viewport.x,
          y: source.y * viewport.zoom + viewport.y,
        };
        const screenTarget = {
          ...target,
          x: target.x * viewport.zoom + viewport.x,
          y: target.y * viewport.zoom + viewport.y,
        };

        return (
          <path
            className="mind-map__edge"
            d={buildPath(screenSource, screenTarget)}
            key={edge.id}
          />
        );
      })}
    </svg>
  );
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
