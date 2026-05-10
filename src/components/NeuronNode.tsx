import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { BrainNode } from '../types';

export function NeuronNode({ id, data, selected }: NodeProps<BrainNode>) {
  return (
    <div className={`neuron-node ${selected ? 'is-selected' : ''}`}>
      <Handle className="neuron-node__handle" position={Position.Left} type="target" />
      <div className="neuron-node__pulse" />
      <p className="neuron-node__meta">Neuron</p>
      <input
        className="neuron-node__input nodrag nowheel"
        onChange={(event) => data.onLabelChange?.(id, event.target.value)}
        placeholder="Name this neuron"
        type="text"
        value={data.label}
      />
      <Handle className="neuron-node__handle" position={Position.Right} type="source" />
    </div>
  );
}
