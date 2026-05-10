import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useEffect, useRef } from 'react';
import type { BrainNode } from '../types';

export function NeuronNode({ id, data, selected }: NodeProps<BrainNode>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const centerHandleStyle = {
    left: '50%',
    top: '50%',
    transform: 'translate(-50%, -50%)',
  } as const;

  useEffect(() => {
    if (!data.isEditing) {
      return;
    }

    inputRef.current?.focus();
    inputRef.current?.select();
  }, [data.isEditing]);

  return (
    <div
      className={`neuron-node ${selected ? 'is-selected' : ''} ${data.isEditing ? 'is-editing' : ''}`}
      onDoubleClick={() => data.onStartRename?.(id)}
    >
      <Handle
        className="neuron-node__handle neuron-node__handle--center"
        position={Position.Left}
        style={centerHandleStyle}
        type="target"
      />
      <div className="neuron-node__dot">
        <div className="neuron-node__core" />
      </div>
      {data.isEditing ? (
        <input
          className="neuron-node__input nodrag nowheel"
          onBlur={() => data.onFinishRename?.()}
          onChange={(event) => data.onLabelChange?.(id, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === 'Escape') {
              data.onFinishRename?.();
            }
          }}
          placeholder="Name this neuron"
          ref={inputRef}
          type="text"
          value={data.label}
        />
      ) : (
        <p className="neuron-node__label">{data.label || 'Untitled'}</p>
      )}
      <Handle
        className="neuron-node__handle neuron-node__handle--center"
        position={Position.Right}
        style={centerHandleStyle}
        type="source"
      />
    </div>
  );
}
