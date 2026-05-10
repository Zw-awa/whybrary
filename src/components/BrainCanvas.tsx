import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import type { BrainEdge, BrainNode, Space } from '../types';
import { NeuronNode } from './NeuronNode';

const nodeTypes = {
  neuron: NeuronNode,
};

type BrainCanvasProps = {
  space: Space;
  onAddNeuron: () => void;
  onConnect: (connection: Connection) => void;
  onEdgesChange: (changes: EdgeChange<BrainEdge>[]) => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onNodesChange: (changes: NodeChange<BrainNode>[]) => void;
  onViewportChange: (viewport: Viewport) => void;
};

export function BrainCanvas({
  space,
  onAddNeuron,
  onConnect,
  onEdgesChange,
  onNodeLabelChange,
  onNodesChange,
  onViewportChange,
}: BrainCanvasProps) {
  const flowNodes = space.nodes.map((node) => ({
    ...node,
    type: node.type ?? 'neuron',
    data: {
      label: node.data.label,
      onLabelChange: onNodeLabelChange,
    },
  }));

  const flowEdges = space.edges.map((edge) => ({
    ...edge,
    type: edge.type ?? 'smoothstep',
    markerEnd: { type: MarkerType.ArrowClosed },
  }));

  return (
    <section className="panel panel--graph">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Visual why map</p>
          <h2>Neuron Graph</h2>
          <p className="panel__description">
            Drag nodes, rename them inline, then connect ideas into a local-first reason map.
          </p>
        </div>

        <div className="panel__actions">
          <div className="stat-chip">
            <strong>{space.nodes.length}</strong>
            <span>nodes</span>
          </div>
          <div className="stat-chip">
            <strong>{space.edges.length}</strong>
            <span>links</span>
          </div>
          <button className="button button--accent" onClick={onAddNeuron} type="button">
            New Neuron
          </button>
        </div>
      </div>

      <div className="graph-shell">
        <ReactFlow
          defaultViewport={space.viewport}
          edges={flowEdges}
          key={space.id}
          minZoom={0.35}
          nodeTypes={nodeTypes}
          nodes={flowNodes}
          onConnect={onConnect}
          onEdgesChange={onEdgesChange}
          onMoveEnd={(_, viewport) => onViewportChange(viewport)}
          onNodesChange={onNodesChange}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            className="graph-background"
            color="var(--line-soft)"
            gap={22}
            size={1}
            variant={BackgroundVariant.Dots}
          />
          <MiniMap className="graph-minimap" pannable zoomable />
          <Controls className="graph-controls" showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
