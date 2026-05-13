import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { SimNode } from '../lib/brainPhysics';
import type { BrainNode, Space } from '../types';

const LABEL_OFFSET = 18;

type BrainNodeLayerProps = {
  editingNodeId: string | null;
  isEditMode: boolean;
  nodes: SimNode[];
  onDotClick: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => void;
  onFinishRenameNode: () => void;
  onLabelClick: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  onStartRenameNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  spaceNodes: BrainNode[];
  viewport: Space['viewport'];
};

export function BrainNodeLayer({
  editingNodeId,
  isEditMode,
  nodes,
  onDotClick,
  onFinishRenameNode,
  onLabelClick,
  onNodeLabelChange,
  onNodePointerDown,
  onStartRenameNode,
  selectedNodeId,
  spaceNodes,
  viewport,
}: BrainNodeLayerProps) {
  return (
    <div className="mind-map__nodes">
      {nodes.map((node) => {
        const editing = isEditMode && editingNodeId === node.id;
        const sourceNode = spaceNodes.find((item) => item.id === node.id);
        const label = sourceNode?.data.label ?? node.label;

        return (
          <div
            className={`mind-node ${selectedNodeId === node.id ? 'is-selected' : ''}`}
            key={node.id}
            onPointerDown={(event) => onNodePointerDown(event, node.id)}
            style={{
              left: `${node.x * viewport.zoom + viewport.x}px`,
              top: `${node.y * viewport.zoom + viewport.y}px`,
              transform: `translate(-50%, -50%) scale(${viewport.zoom})`,
            }}
          >
            <button
              className={`mind-node__dot ${isEditMode ? 'is-editable' : ''}`}
              onClick={(event) => onDotClick(event, node.id)}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onStartRenameNode(node.id);
              }}
              type="button"
            >
              <span className="mind-node__core" />
            </button>

            {editing ? (
              <input
                autoFocus
                className="mind-node__input"
                onBlur={onFinishRenameNode}
                onChange={(event) => onNodeLabelChange(node.id, event.target.value)}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === 'Escape') {
                    onFinishRenameNode();
                  }
                }}
                placeholder="Untitled"
                type="text"
                value={label}
              />
            ) : (
              <button
                className={`mind-node__label ${isEditMode ? 'is-editable' : ''}`}
                onClick={(event) => onLabelClick(event, node.id)}
                onDoubleClick={(event) => {
                  if (!isEditMode) {
                    return;
                  }

                  event.stopPropagation();
                  onStartRenameNode(node.id);
                }}
                style={{
                  transform: `translateY(${LABEL_OFFSET}px)`,
                }}
                type="button"
              >
                {label || 'Untitled'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
