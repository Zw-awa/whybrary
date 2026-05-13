import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { BrainNode, Space } from '../types';
import {
  buildPath,
  buildSimNodes,
  CENTER_PULL,
  clamp,
  DAMPING,
  FAR_ATTRACTION_RADIUS,
  FAR_ATTRACTION_STRENGTH,
  findSpawnPosition,
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

type BrainCanvasProps = {
  editingNodeId: string | null;
  onDeleteNodes: (nodeIds: string[]) => void;
  isEditMode: boolean;
  onAddNeuron: (position?: BrainNode['position']) => BrainNode | null;
  onFinishRenameNode: () => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onPersistNodePositions: (nextNodes: BrainNode[]) => void;
  onStartRenameNode: (nodeId: string) => void;
  onToggleEditMode: () => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
  onViewportChange: (viewport: Space['viewport']) => void;
  space: Space;
};

type DragState = {
  nodeId: string;
  startX: number;
  startY: number;
  started: boolean;
};

type PanState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const LABEL_OFFSET = 18;
const PERSIST_DEBOUNCE_MS = 220;
const DRAG_START_DISTANCE = 4;

export function BrainCanvas({
  editingNodeId,
  onDeleteNodes,
  isEditMode,
  onAddNeuron,
  onFinishRenameNode,
  onNodeLabelChange,
  onPersistNodePositions,
  onStartRenameNode,
  onToggleEditMode,
  onToggleConnection,
  onViewportChange,
  space,
}: BrainCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [isInfoMultiSelect, setIsInfoMultiSelect] = useState(false);
  const [infoSelection, setInfoSelection] = useState<string[]>([]);
  const [simNodes, setSimNodes] = useState<SimNode[]>(() => buildSimNodes(space));
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [panState, setPanState] = useState<PanState | null>(null);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [trackedNodeId, setTrackedNodeId] = useState<string | null>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<SimNode[]>(simNodes);
  const dragStateRef = useRef<DragState | null>(dragState);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);
  const suppressClickRef = useRef(false);
  const persistTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const nodeSignature = useMemo(() => space.nodes.map((node) => node.id).join('|'), [space.nodes]);
  const edgeSignature = useMemo(
    () => space.edges.map((edge) => `${edge.source}:${edge.target}`).join('|'),
    [space.edges],
  );

  useEffect(() => {
    simNodesRef.current = simNodes;
  }, [simNodes]);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    if (!isInfoMultiSelect) {
      setInfoSelection([selectedNodeId]);
    }
  }, [isInfoMultiSelect, selectedNodeId]);

  useLayoutEffect(() => {
    setSimNodes((current) => mergeSimNodes(current, space));
  }, [nodeSignature, edgeSignature, space]);

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

      if (moved || draggedNodeId) {
        if (!samePositions(current, next)) {
          simNodesRef.current = next;
          setSimNodes(next);
        }
      }

      frameRef.current = window.requestAnimationFrame(step);
    };

    frameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }
    };
  }, [space.edges, space.viewport.x, space.viewport.y, space.viewport.zoom]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell) {
        return;
      }

      const rect = shell.getBoundingClientRect();
      const nextX =
        (event.clientX - rect.left - space.viewport.x) / space.viewport.zoom;
      const nextY =
        (event.clientY - rect.top - space.viewport.y) / space.viewport.zoom;

      const dx = event.clientX - dragState.startX;
      const dy = event.clientY - dragState.startY;
      const shouldStartDrag =
        dragState.started || Math.sqrt(dx * dx + dy * dy) >= DRAG_START_DISTANCE;

      if (!dragState.started && shouldStartDrag) {
        setDragState((current) => (current ? { ...current, started: true } : current));
        setSelectedNodeId(dragState.nodeId);
        suppressClickRef.current = true;
      }

      if (!shouldStartDrag) {
        return;
      }

      dragPointerRef.current = { x: nextX, y: nextY };
    };

    const handleEnd = () => {
      const wasDragging = dragState.started;
      setDragState(null);
      dragPointerRef.current = null;

      if (!wasDragging) {
        return;
      }

      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }

      persistTimerRef.current = window.setTimeout(() => {
        const nextNodes = space.nodes.map((node) => {
          const simNode = simNodesRef.current.find((item) => item.id === node.id);
          if (!simNode) {
            return node;
          }

          return {
            ...node,
            position: {
              x: simNode.x,
              y: simNode.y,
            },
          };
        });

        onPersistNodePositions(nextNodes);
      }, PERSIST_DEBOUNCE_MS);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [dragState, onPersistNodePositions, space.nodes, space.viewport.x, space.viewport.y, space.viewport.zoom]);

  useEffect(() => {
    if (!panState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      onViewportChange({
        ...space.viewport,
        x: panState.originX + (event.clientX - panState.startX),
        y: panState.originY + (event.clientY - panState.startY),
      });
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
  }, [onViewportChange, panState, space.viewport]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const exists = space.nodes.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [selectedNodeId, space.nodes]);

  useEffect(() => {
    setInfoSelection((current) =>
      current.filter((nodeId) => space.nodes.some((node) => node.id === nodeId)),
    );
  }, [space.nodes]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const selection =
        infoSelection.length > 0
          ? infoSelection
          : selectedNodeIdRef.current
            ? [selectedNodeIdRef.current]
            : [];

    if (selection.length === 0) {
      return;
    }

      if (event.key !== 'Backspace' && event.key !== 'Delete') {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName;
      const editingField =
        tagName === 'INPUT' ||
        tagName === 'TEXTAREA' ||
        (target instanceof HTMLElement && target.isContentEditable);

      if (editingField) {
        return;
      }

      event.preventDefault();
      onDeleteNodes(selection);
      setInfoSelection([]);
      setSelectedNodeId(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [infoSelection, onDeleteNodes]);

  useEffect(() => {
    if (!trackedNodeId) {
      return;
    }

    const exists = simNodes.some((node) => node.id === trackedNodeId);
    if (!exists) {
      setTrackedNodeId(null);
    }
  }, [simNodes, trackedNodeId]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const nodeById = useMemo(() => new Map(simNodes.map((node) => [node.id, node])), [simNodes]);
  const trackedNode = trackedNodeId ? nodeById.get(trackedNodeId) : undefined;

  const getViewportForNode = (node: SimNode | undefined): Space['viewport'] | null => {
    const shell = shellRef.current;
    if (!shell || !node) {
      return null;
    }

    const rect = shell.getBoundingClientRect();
    return {
      x: rect.width / 2 - node.x * space.viewport.zoom,
      y: rect.height / 2 - node.y * space.viewport.zoom,
      zoom: space.viewport.zoom,
    };
  };

  const commitTrackedViewportAndClear = () => {
    if (!trackedNodeId) {
      return;
    }

    const nextViewport = getViewportForNode(trackedNode);
    if (nextViewport) {
      onViewportChange(nextViewport);
    }

    setTrackedNodeId(null);
  };

  const effectiveViewport = getViewportForNode(trackedNode) ?? space.viewport;
  const deleteInfoSelection = () => {
    if (infoSelection.length === 0) {
      return;
    }

    const preview = infoSelection
      .map((nodeId) => simNodesRef.current.find((node) => node.id === nodeId)?.label || 'Untitled')
      .slice(0, 3)
      .join(', ');
    const suffix = infoSelection.length > 3 ? ` and ${infoSelection.length - 3} more` : '';
    const confirmed = window.confirm(
      `Delete ${infoSelection.length} selected node${infoSelection.length > 1 ? 's' : ''}? ${preview}${suffix}`,
    );

    if (!confirmed) {
      return;
    }

    onDeleteNodes(infoSelection);
    setInfoSelection([]);
    setSelectedNodeId(null);
  };

  return (
    <section className="panel panel--graph">
      <div className="panel__header">
        <h2>Mind Map</h2>
        <div className="panel__actions">
          <button
            className="button"
            onClick={() => setIsInfoOpen((current) => !current)}
            type="button"
          >
            {isInfoOpen ? 'Hide Info' : 'Show Info'}
          </button>
          <button className="button button--ghost" onClick={onToggleEditMode} type="button">
            {isEditMode ? 'Done' : 'Edit Content'}
          </button>
          {isEditMode ? (
            <button
              className={`button ${isConnectMode ? 'button--accent' : ''}`}
              onClick={() => {
                setIsConnectMode((current) => !current);
                setSelectedNodeId(null);
              }}
              type="button"
            >
              {isConnectMode ? 'Link Mode On' : 'Link Mode Off'}
            </button>
          ) : null}
          {isEditMode ? (
            <button
              className="button button--accent"
              onClick={() => {
                const shell = shellRef.current;
                if (!shell) {
                  const nextNode = onAddNeuron();
                  if (nextNode) {
                    setSelectedNodeId(nextNode.id);
                    setSimNodes((current) =>
                      current.some((node) => node.id === nextNode.id)
                        ? current
                        : [
                            ...current,
                            {
                              id: nextNode.id,
                              label: nextNode.data.label,
                              x: nextNode.position.x,
                              y: nextNode.position.y,
                              vx: 0,
                              vy: 0,
                            },
                          ],
                    );
                  }
                  return;
                }

                const nextNode = onAddNeuron(
                  findSpawnPosition(simNodesRef.current, effectiveViewport, {
                    width: shell.clientWidth,
                    height: shell.clientHeight,
                  }),
                );
                if (nextNode) {
                  setSelectedNodeId(nextNode.id);
                  setSimNodes((current) =>
                    current.some((node) => node.id === nextNode.id)
                      ? current
                      : [
                          ...current,
                          {
                            id: nextNode.id,
                            label: nextNode.data.label,
                            x: nextNode.position.x,
                            y: nextNode.position.y,
                            vx: 0,
                            vy: 0,
                          },
                        ],
                  );
                }
              }}
              type="button"
            >
              New Point
            </button>
          ) : null}
        </div>
      </div>

      <div
        className={`graph-shell graph-shell--custom ${isEditMode ? 'is-editing' : 'is-viewing'} ${panState ? 'is-panning' : ''}`}
        onClick={() => {
          if (isEditMode) {
            setSelectedNodeId(null);
          }
        }}
        onWheel={(event) => {
          event.preventDefault();
          commitTrackedViewportAndClear();
          const shell = shellRef.current;
          if (!shell) {
            return;
          }

          const rect = shell.getBoundingClientRect();
          const pointerX = event.clientX - rect.left;
          const pointerY = event.clientY - rect.top;
          const zoomDelta = event.deltaY > 0 ? 0.92 : 1.08;
          const nextZoom = clamp(space.viewport.zoom * zoomDelta, 0.35, 1.8);
          if (nextZoom === space.viewport.zoom) {
            return;
          }

          const worldX = (pointerX - effectiveViewport.x) / effectiveViewport.zoom;
          const worldY = (pointerY - effectiveViewport.y) / effectiveViewport.zoom;

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

          commitTrackedViewportAndClear();
          setPanState({
            startX: event.clientX,
            startY: event.clientY,
            originX: effectiveViewport.x,
            originY: effectiveViewport.y,
          });
        }}
        ref={shellRef}
      >
        {isInfoOpen ? (
          <aside
            className="graph-info"
            onPointerDown={(event) => event.stopPropagation()}
            onWheelCapture={(event) => event.stopPropagation()}
          >
            <div className="graph-info__summary">
              <strong>{simNodes.length} nodes</strong>
              <span>{space.edges.length} links</span>
            </div>

            <div className="graph-info__actions">
              <button
                className={`graph-info__action ${isInfoMultiSelect ? 'is-active' : ''}`}
                onClick={() => {
                  setIsInfoMultiSelect((current) => {
                    const next = !current;
                    if (next) {
                      setTrackedNodeId(null);
                      setSelectedNodeId(null);
                      setInfoSelection([]);
                    } else if (selectedNodeIdRef.current) {
                      setInfoSelection([selectedNodeIdRef.current]);
                    }
                    return next;
                  });
                }}
                type="button"
              >
                {isInfoMultiSelect ? 'Multi On' : 'Multi Off'}
              </button>
              <button
                className="graph-info__action"
                onClick={() => setInfoSelection(simNodes.map((node) => node.id))}
                type="button"
                disabled={!isInfoMultiSelect}
              >
                Select All
              </button>
              <button
                className="graph-info__action"
                onClick={() => {
                  setInfoSelection([]);
                  setSelectedNodeId(null);
                }}
                type="button"
              >
                Clear
              </button>
              <button
                className="graph-info__action graph-info__action--danger"
                disabled={infoSelection.length === 0}
                onClick={deleteInfoSelection}
                type="button"
              >
                Delete Selected
              </button>
            </div>

            <div className="graph-info__list" onWheelCapture={(event) => event.stopPropagation()}>
              {simNodes.map((node, index) => (
                <button
                  className={`graph-info__item ${trackedNodeId === node.id ? 'is-tracked' : ''} ${infoSelection.includes(node.id) ? 'is-selected' : ''}`}
                  key={node.id}
                  onClick={() => {
                    setSelectedNodeId(node.id);
                    if (isInfoMultiSelect) {
                      setInfoSelection((current) =>
                        current.includes(node.id)
                          ? current.filter((item) => item !== node.id)
                          : [...current, node.id],
                      );
                      return;
                    }

                    setTrackedNodeId(node.id);
                    setInfoSelection([node.id]);
                  }}
                  type="button"
                >
                  <strong>{node.label || `Untitled ${index + 1}`}</strong>
                  <span>
                    {node.x.toFixed(0)}, {node.y.toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          </aside>
        ) : null}

        <svg className="mind-map__edges" preserveAspectRatio="none">
          {space.edges.map((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            if (!source || !target) {
              return null;
            }

            const screenSource = {
              ...source,
              x: source.x * effectiveViewport.zoom + effectiveViewport.x,
              y: source.y * effectiveViewport.zoom + effectiveViewport.y,
            };
            const screenTarget = {
              ...target,
              x: target.x * effectiveViewport.zoom + effectiveViewport.x,
              y: target.y * effectiveViewport.zoom + effectiveViewport.y,
            };

            return <path className="mind-map__edge" d={buildPath(screenSource, screenTarget)} key={edge.id} />;
          })}
        </svg>

        <div className="mind-map__nodes">
          {simNodes.map((node) => {
            const editing = isEditMode && editingNodeId === node.id;

            return (
              <div
                className={`mind-node ${selectedNodeId === node.id ? 'is-selected' : ''}`}
                key={node.id}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  commitTrackedViewportAndClear();
                  if (isConnectMode) {
                    return;
                  }
                  setSelectedNodeId(node.id);
                  const shell = shellRef.current;
                  if (!shell) {
                    return;
                  }

                  const shellRect = shell.getBoundingClientRect();
                  dragPointerRef.current = {
                    x: (event.clientX - shellRect.left - effectiveViewport.x) / effectiveViewport.zoom,
                    y: (event.clientY - shellRect.top - effectiveViewport.y) / effectiveViewport.zoom,
                  };
                  setDragState({
                    nodeId: node.id,
                    startX: event.clientX,
                    startY: event.clientY,
                    started: false,
                  });
                }}
                style={{
                  left: `${node.x * effectiveViewport.zoom + effectiveViewport.x}px`,
                  top: `${node.y * effectiveViewport.zoom + effectiveViewport.y}px`,
                  transform: `translate(-50%, -50%) scale(${effectiveViewport.zoom})`,
                }}
              >
                <button
                  className={`mind-node__dot ${isEditMode ? 'is-editable' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();

                    if (suppressClickRef.current) {
                      suppressClickRef.current = false;
                      return;
                    }

                    if (selectedNodeId && selectedNodeId !== node.id) {
                      if (isEditMode && isConnectMode) {
                        onToggleConnection(selectedNodeId, node.id);
                      }
                      setSelectedNodeId(null);
                      return;
                    }

                    setSelectedNodeId((current) => (current === node.id ? null : node.id));
                  }}
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
                    value={space.nodes.find((item) => item.id === node.id)?.data.label ?? node.label}
                  />
                ) : (
                  <button
                    className={`mind-node__label ${isEditMode ? 'is-editable' : ''}`}
                    onClick={(event) => {
                      event.stopPropagation();

                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }

                      if (selectedNodeId && selectedNodeId !== node.id) {
                        if (isEditMode && isConnectMode) {
                          onToggleConnection(selectedNodeId, node.id);
                        }
                        setSelectedNodeId(null);
                        return;
                      }

                      setSelectedNodeId((current) => (current === node.id ? null : node.id));
                    }}
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
                    {(space.nodes.find((item) => item.id === node.id)?.data.label ?? node.label) || 'Untitled'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
