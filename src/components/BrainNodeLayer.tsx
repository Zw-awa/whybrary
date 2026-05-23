import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { getCopy } from '../lib/i18n';
import type { SimNode } from '../lib/brainPhysics';
import type { AppLocale, BrainNode, Space } from '../types';

const LABEL_OFFSET = 18;

type BrainNodeLayerProps = {
  editingNodeId: string | null;
  isEditMode: boolean;
  isMobile?: boolean;
  locale: AppLocale;
  nodes: SimNode[];
  onDotClick: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => void;
  onFinishRenameNode: () => void;
  onLabelClick: (event: ReactMouseEvent<HTMLButtonElement>, nodeId: string) => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onNodePointerDown: (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => void;
  onNodeLongPress?: (nodeId: string) => void;
  onStartRenameNode: (nodeId: string) => void;
  selectedNodeId: string | null;
  spaceNodes: BrainNode[];
  viewport: Space['viewport'];
};

export function BrainNodeLayer({
  editingNodeId,
  isEditMode,
  isMobile = false,
  locale,
  nodes,
  onDotClick,
  onFinishRenameNode,
  onLabelClick,
  onNodeLabelChange,
  onNodePointerDown,
  onNodeLongPress,
  onStartRenameNode,
  selectedNodeId,
  spaceNodes,
  viewport,
}: BrainNodeLayerProps) {
  const copy = getCopy(locale);

  return (
    <div className="mind-map__nodes">
      {nodes.map((node) => {
        const editing = isEditMode && editingNodeId === node.id;
        const sourceNode = spaceNodes.find((item) => item.id === node.id);
        const label = sourceNode?.data.label ?? node.label;
        let longPressTimer: number | null = null;

        const clearLongPress = () => {
          if (longPressTimer !== null) {
            window.clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };

        const startLongPress = () => {
          if (!isMobile || !isEditMode || !onNodeLongPress) {
            return;
          }

          longPressTimer = window.setTimeout(() => {
            onNodeLongPress(node.id);
            longPressTimer = null;
          }, 420);
        };

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
              onPointerCancel={clearLongPress}
              onPointerDown={startLongPress}
              onPointerLeave={clearLongPress}
              onPointerUp={clearLongPress}
              onContextMenu={(event) => {
                event.preventDefault();
                if (isMobile && onNodeLongPress) {
                  onNodeLongPress(node.id);
                }
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
                placeholder={copy.map.untitled}
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
                onPointerCancel={clearLongPress}
                onPointerDown={startLongPress}
                onPointerLeave={clearLongPress}
                onPointerUp={clearLongPress}
                style={{
                  transform: `translateY(${LABEL_OFFSET}px)`,
                }}
                type="button"
              >
                {label || copy.map.untitled}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
