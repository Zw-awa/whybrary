import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrainNode, Space, ViewportState } from '../types';

type BrainCanvasProps = {
  editingNodeId: string | null;
  isEditMode: boolean;
  onAddNeuron: () => void;
  onFinishRenameNode: () => void;
  onMoveNode: (nodeId: string, nextPosition: BrainNode['position']) => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onPanViewport: (x: number, y: number) => void;
  onStartRenameNode: (nodeId: string) => void;
  onToggleEditMode: () => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
  onViewportChange: (viewport: ViewportState) => void;
  space: Space;
};

type DragState = {
  nodeId: string;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
};

type PanState = {
  originX: number;
  originY: number;
  startX: number;
  startY: number;
};

function toScreenPosition(
  position: BrainNode['position'],
  viewport: ViewportState,
): BrainNode['position'] {
  return {
    x: position.x * viewport.zoom + viewport.x,
    y: position.y * viewport.zoom + viewport.y,
  };
}

function buildPath(
  source: BrainNode['position'],
  target: BrainNode['position'],
  viewport: ViewportState,
): string {
  const from = toScreenPosition(source, viewport);
  const to = toScreenPosition(target, viewport);
  const curve = Math.max(42, Math.abs(to.x - from.x) * 0.28);
  return `M ${from.x} ${from.y} C ${from.x + curve} ${from.y}, ${to.x - curve} ${to.y}, ${to.x} ${to.y}`;
}

export function BrainCanvas({
  editingNodeId,
  isEditMode,
  onAddNeuron,
  onFinishRenameNode,
  onMoveNode,
  onNodeLabelChange,
  onPanViewport,
  onStartRenameNode,
  onToggleEditMode,
  onToggleConnection,
  onViewportChange,
  space,
}: BrainCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const autoCenterKeyRef = useRef('');
  const nodeMap = useMemo(
    () => new Map(space.nodes.map((node) => [node.id, node])),
    [space.nodes],
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;

      onMoveNode(dragState.nodeId, {
        x: dragState.originX + dx / space.viewport.zoom,
        y: dragState.originY + dy / space.viewport.zoom,
      });
    };

    const handleEnd = () => {
      setDragState(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [dragState, onMoveNode, space.viewport.zoom]);

  useEffect(() => {
    if (!panState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const dx = event.clientX - panState.startX;
      const dy = event.clientY - panState.startY;

      onPanViewport(panState.originX + dx, panState.originY + dy);
    };

    const handleEnd = () => {
      setPanState(null);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [onPanViewport, panState]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const stillExists = space.nodes.some((node) => node.id === selectedNodeId);
    if (!stillExists) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, space.nodes]);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || space.nodes.length === 0) {
      return;
    }

    const width = shell.clientWidth;
    const height = shell.clientHeight;
    if (width <= 0 || height <= 0) {
      return;
    }

    const positions = space.nodes.map((node) => toScreenPosition(node.position, space.viewport));
    const hasVisibleNode = positions.some(
      (position) =>
        position.x >= 32 &&
        position.x <= width - 32 &&
        position.y >= 32 &&
        position.y <= height - 32,
    );

    if (hasVisibleNode) {
      autoCenterKeyRef.current = '';
      return;
    }

    const worldMinX = Math.min(...space.nodes.map((node) => node.position.x));
    const worldMaxX = Math.max(...space.nodes.map((node) => node.position.x));
    const worldMinY = Math.min(...space.nodes.map((node) => node.position.y));
    const worldMaxY = Math.max(...space.nodes.map((node) => node.position.y));

    const centeredX = width / 2 - ((worldMinX + worldMaxX) / 2) * space.viewport.zoom;
    const centeredY = height / 2 - ((worldMinY + worldMaxY) / 2) * space.viewport.zoom;
    const nextKey = `${space.id}:${centeredX.toFixed(1)}:${centeredY.toFixed(1)}`;

    if (autoCenterKeyRef.current === nextKey) {
      return;
    }

    autoCenterKeyRef.current = nextKey;
    onPanViewport(centeredX, centeredY);
  }, [onPanViewport, space.id, space.nodes, space.viewport]);

  const handleNodeClick = (nodeId: string) => {
    if (!isEditMode) {
      return;
    }

    if (selectedNodeId && selectedNodeId !== nodeId) {
      onToggleConnection(selectedNodeId, nodeId);
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
  };

  return (
    <section className="panel panel--graph">
      <div className="panel__header">
        <h2>Mind Map</h2>
        <div className="panel__actions">
          <button className="button button--ghost" onClick={onToggleEditMode} type="button">
            {isEditMode ? 'Done' : 'Edit Content'}
          </button>
          {isEditMode ? (
            <button className="button button--accent" onClick={onAddNeuron} type="button">
              New Point
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`graph-shell graph-shell--custom ${isEditMode ? 'is-editing' : 'is-viewing'} ${panState ? 'is-panning' : ''}`}
        onClick={() => setSelectedNodeId(null)}
        onWheel={(event) => {
          event.preventDefault();

          const shell = shellRef.current;
          if (!shell) {
            return;
          }

          const rect = shell.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const zoomDelta = event.deltaY > 0 ? 0.92 : 1.08;
          const nextZoom = Math.min(1.8, Math.max(0.35, space.viewport.zoom * zoomDelta));
          if (nextZoom === space.viewport.zoom) {
            return;
          }

          const worldX = (pointerX - space.viewport.x) / space.viewport.zoom;
          const worldY = (pointerY - space.viewport.y) / space.viewport.zoom;

          onViewportChange({
            x: pointerX - worldX * nextZoom,
            y: pointerY - worldY * nextZoom,
            zoom: nextZoom,
          });
        }}
        onPointerDown={(event) => {
          const target = event.target as HTMLElement;
          if (target.closest('.mind-node')) {
            return;
          }

          setSelectedNodeId(null);
          setPanState({
            originX: space.viewport.x,
            originY: space.viewport.y,
            startX: event.clientX,
            startY: event.clientY,
          });
        }}
        ref={shellRef}
      >
        <svg className="mind-map__edges" preserveAspectRatio="none">
          {space.edges.map((edge) => {
            const source = nodeMap.get(edge.source);
            const target = nodeMap.get(edge.target);
            if (!source || !target) {
              return null;
            }

            return (
              <path
                className="mind-map__edge"
                d={buildPath(source.position, target.position, space.viewport)}
                key={edge.id}
              />
            );
          })}
        </svg>

        <div className="mind-map__nodes">
          {space.nodes.map((node) => (
            <div
              className={`mind-node ${selectedNodeId === node.id ? 'is-selected' : ''}`}
              key={node.id}
              style={{
                left: `${node.position.x * space.viewport.zoom + space.viewport.x}px`,
                top: `${node.position.y * space.viewport.zoom + space.viewport.y}px`,
                transform: `translate(-50%, -50%) scale(${space.viewport.zoom})`,
              }}
            >
              <button
                className={`mind-node__dot ${isEditMode ? 'is-editable' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleNodeClick(node.id);
                }}
                onDoubleClick={(event) => {
                  if (!isEditMode) {
                    return;
                  }

                  event.stopPropagation();
                  onStartRenameNode(node.id);
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  setDragState({
                    nodeId: node.id,
                    originX: node.position.x,
                    originY: node.position.y,
                    startX: event.clientX,
                    startY: event.clientY,
                  });
                }}
                type="button"
              >
                <span className="mind-node__core" />
              </button>

              {editingNodeId === node.id && isEditMode ? (
                <input
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
                  value={node.data.label}
                  autoFocus
                />
              ) : (
                <button
                  className={`mind-node__label ${isEditMode ? 'is-editable' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleNodeClick(node.id);
                  }}
                  onDoubleClick={(event) => {
                    if (!isEditMode) {
                      return;
                    }

                    event.stopPropagation();
                    onStartRenameNode(node.id);
                  }}
                  type="button"
                >
                  {node.data.label || 'Untitled'}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
