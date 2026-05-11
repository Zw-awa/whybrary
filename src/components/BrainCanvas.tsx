import { Graph, type GraphConfigInterface } from '@cosmos.gl/graph';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BrainNode, Space, ThemeMode } from '../types';

type BrainCanvasProps = {
  editingNodeId: string | null;
  isEditMode: boolean;
  onAddNeuron: (position?: BrainNode['position']) => void;
  onFinishRenameNode: () => void;
  onMoveNode: (nodeId: string, nextPosition: BrainNode['position']) => void;
  onNodeLabelChange: (nodeId: string, nextLabel: string) => void;
  onPersistNodePositions: (nextNodes: BrainNode[]) => void;
  onStartRenameNode: (nodeId: string) => void;
  onToggleEditMode: () => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
  space: Space;
  theme: ThemeMode;
};

type LabelLayout = Record<
  string,
  {
    dotLeft: number;
    dotTop: number;
    dotScale: number;
    labelLeft: number;
    labelTop: number;
    labelScale: number;
  }
>;

type DragState = {
  nodeId: string;
  originX: number;
  originY: number;
  startX: number;
  startY: number;
};

const LABEL_OFFSET = 18;

function buildGraphConfig(theme: ThemeMode): Partial<GraphConfigInterface> {
  const isDark = theme === 'dark';

  return {
    backgroundColor: isDark ? '#191715' : '#fbf8f3',
    spaceSize: 8192,
    pointDefaultColor: isDark ? '#c6b49c' : '#7b7263',
    pointDefaultSize: 10,
    pointOpacity: 1,
    pointSizeScale: 2.2,
    pointGreyoutOpacity: 0.14,
    hoveredPointCursor: 'grab',
    hoveredLinkCursor: 'pointer',
    renderHoveredPointRing: true,
    hoveredPointRingColor: isDark ? '#f5efe9' : '#fff8f1',
    focusedPointRingColor: isDark ? '#f5efe9' : '#fff8f1',
    renderLinks: true,
    linkDefaultColor: isDark ? '#b79776' : '#9e866f',
    linkDefaultWidth: 2.2,
    linkOpacity: 0.78,
    linkGreyoutOpacity: 0.08,
    linkWidthScale: 1,
    curvedLinks: true,
    curvedLinkSegments: 25,
    curvedLinkWeight: 0.86,
    curvedLinkControlPointDistance: 0.62,
    linkDefaultArrows: false,
    scalePointsOnZoom: true,
    scaleLinksOnZoom: false,
    useClassicQuadtree: false,
    simulationDecay: 5000,
    simulationGravity: 0,
    simulationCenter: 0.12,
    simulationRepulsion: 1,
    simulationRepulsionTheta: 1.15,
    simulationLinkSpring: 0.72,
    simulationLinkDistance: 96,
    simulationLinkDistRandomVariationRange: [1, 1],
    simulationRepulsionFromMouse: 2,
    enableRightClickRepulsion: false,
    simulationFriction: 0.82,
    simulationCluster: 0,
    enableSimulation: true,
    enableZoom: true,
    enableDrag: false,
    fitViewOnInit: true,
    fitViewDelay: 120,
    fitViewPadding: 0.22,
    fitViewDuration: 520,
    pixelRatio: 2,
    showFPSMonitor: false,
    attribution: '',
  };
}

function buildPointPositions(nodes: BrainNode[]): Float32Array {
  return new Float32Array(nodes.flatMap((node) => [node.position.x, node.position.y]));
}

function buildLinks(nodes: BrainNode[], edges: Space['edges']): Float32Array {
  const indexById = new Map(nodes.map((node, index) => [node.id, index]));
  const values: number[] = [];

  for (const edge of edges) {
    const source = indexById.get(edge.source);
    const target = indexById.get(edge.target);
    if (source === undefined || target === undefined) {
      continue;
    }

    values.push(source, target);
  }

  return new Float32Array(values);
}

function buildPointColors(count: number, theme: ThemeMode): Float32Array {
  const color = theme === 'dark' ? [198, 180, 156, 1] : [123, 114, 99, 1];
  return new Float32Array(Array.from({ length: count }, () => color).flat());
}

function buildPointSizes(count: number): Float32Array {
  return new Float32Array(Array.from({ length: count }, () => 10));
}

function buildLinkColors(count: number, theme: ThemeMode): Float32Array {
  const color = theme === 'dark' ? [183, 151, 118, 0.82] : [158, 134, 111, 0.78];
  return new Float32Array(Array.from({ length: count }, () => color).flat());
}

function buildLinkWidths(count: number): Float32Array {
  return new Float32Array(Array.from({ length: count }, () => 2.2));
}

function buildLinkArrows(count: number): boolean[] {
  return Array.from({ length: count }, () => false);
}

function buildLinkStrengths(nodes: BrainNode[], edges: Space['edges']): Float32Array {
  const degreeById = new Map<string, number>();

  for (const node of nodes) {
    degreeById.set(node.id, 0);
  }

  for (const edge of edges) {
    degreeById.set(edge.source, (degreeById.get(edge.source) ?? 0) + 1);
    degreeById.set(edge.target, (degreeById.get(edge.target) ?? 0) + 1);
  }

  return new Float32Array(
    edges.map((edge) => {
      const sourceDegree = degreeById.get(edge.source) ?? 1;
      const targetDegree = degreeById.get(edge.target) ?? 1;
      return 1 / Math.max(1, Math.min(sourceDegree, targetDegree));
    }),
  );
}

function indexOfNode(nodes: BrainNode[], id: string): number {
  return nodes.findIndex((node) => node.id === id);
}

export function BrainCanvas({
  editingNodeId,
  isEditMode,
  onAddNeuron,
  onFinishRenameNode,
  onMoveNode,
  onNodeLabelChange,
  onPersistNodePositions,
  onStartRenameNode,
  onToggleEditMode,
  onToggleConnection,
  space,
  theme,
}: BrainCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [labelLayout, setLabelLayout] = useState<LabelLayout>({});
  const [graphError, setGraphError] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Graph | null>(null);

  const nodeSignature = useMemo(() => space.nodes.map((node) => node.id).join('|'), [space.nodes]);
  const edgeSignature = useMemo(
    () => space.edges.map((edge) => `${edge.source}:${edge.target}`).join('|'),
    [space.edges],
  );

  const syncLabelLayout = () => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const positions = graph.getPointPositions();
    const zoom = Math.max(0.35, graph.getZoomLevel() || 1);
    const nextLayout: LabelLayout = {};

    space.nodes.forEach((node, index) => {
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];
      const [screenX, screenY] =
        x === undefined || y === undefined
          ? graph.spaceToScreenPosition([node.position.x, node.position.y])
          : graph.spaceToScreenPosition([x, y]);

      nextLayout[node.id] = {
        dotLeft: screenX,
        dotTop: screenY,
        dotScale: Math.max(0.82, Math.min(1.32, zoom * 0.92)),
        labelLeft: screenX,
        labelTop: screenY + LABEL_OFFSET,
        labelScale: Math.max(0.72, Math.min(1.15, zoom)),
      };
    });

    setLabelLayout(nextLayout);
  };

  const syncNodePositionsToState = () => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    const positions = graph.getPointPositions();
    const nextNodes = space.nodes.map((node, index) => {
      const x = positions[index * 2];
      const y = positions[index * 2 + 1];

      if (x === undefined || y === undefined) {
        return node;
      }

      return {
        ...node,
        position: { x, y },
      };
    });

    onPersistNodePositions(nextNodes);
  };

  const mountGraph = () => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }

    const graph = new Graph(container, buildGraphConfig(theme));
    graph.setConfig({
      onZoom: () => {
        syncLabelLayout();
      },
      onZoomEnd: () => {
        syncLabelLayout();
      },
      onSimulationTick: () => {
        syncLabelLayout();
      },
      onDragEnd: () => {
        syncLabelLayout();
        syncNodePositionsToState();
      },
      onSimulationEnd: () => {
        syncLabelLayout();
        syncNodePositionsToState();
      },
    });
    graph.setPointPositions(buildPointPositions(space.nodes), true);
    graph.setPointColors(buildPointColors(space.nodes.length, theme));
    graph.setPointSizes(buildPointSizes(space.nodes.length));
    graph.setLinks(buildLinks(space.nodes, space.edges));
    graph.setLinkColors(buildLinkColors(space.edges.length, theme));
    graph.setLinkWidths(buildLinkWidths(space.edges.length));
    graph.setLinkArrows(buildLinkArrows(space.edges.length));
    graph.setLinkStrength(buildLinkStrengths(space.nodes, space.edges));
    graph.trackPointPositionsByIndices(space.nodes.map((_, index) => index));
    graph.render(0.28);
    graph.fitView(320, 0.22);
    graphRef.current = graph;
    syncLabelLayout();
    return graph;
  };

  useEffect(() => {
    try {
      graphRef.current?.destroy();
      graphRef.current = null;
      mountGraph();
      setGraphError(null);
    } catch (error) {
      setGraphError(error instanceof Error ? error.message : 'Failed to initialize graph renderer.');
      graphRef.current = null;
    }

    return () => {
      graphRef.current?.destroy();
      graphRef.current = null;
    };
  }, [space.id, nodeSignature, edgeSignature, theme]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const graph = graphRef.current;
      const layout = labelLayout[dragState.nodeId];
      if (!graph || !layout) {
        return;
      }

      const nextScreenX = dragState.originX + (event.clientX - dragState.startX);
      const nextScreenY = dragState.originY + (event.clientY - dragState.startY);
      const [spaceX, spaceY] = graph.screenToSpacePosition([nextScreenX, nextScreenY]);
      onMoveNode(dragState.nodeId, { x: spaceX, y: spaceY });
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
  }, [dragState, labelLayout, onMoveNode]);

  const handlePointSelection = (nodeId: string) => {
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

  useEffect(() => {
    if (!isEditMode) {
      setSelectedNodeId(null);
    }
  }, [isEditMode]);

  return (
    <section className="panel panel--graph">
      <div className="panel__header">
        <h2>Mind Map</h2>
        <div className="panel__actions">
          <button className="button button--ghost" onClick={onToggleEditMode} type="button">
            {isEditMode ? 'Done' : 'Edit Content'}
          </button>
          {isEditMode ? (
            <button
              className="button button--accent"
              onClick={() => {
                const graph = graphRef.current;
                const container = containerRef.current;
                if (!graph || !container) {
                  onAddNeuron();
                  return;
                }

                const rect = container.getBoundingClientRect();
                const position = graph.screenToSpacePosition([rect.width / 2, rect.height / 2]);
                onAddNeuron({ x: position[0], y: position[1] });
              }}
              type="button"
            >
              New Point
            </button>
          ) : null}
        </div>
      </div>

      <div className="graph-shell graph-shell--custom cosmos-shell" ref={containerRef}>
        {graphError ? (
          <div className="graph-fallback">
            <strong>Graph failed to initialize</strong>
            <span>{graphError}</span>
          </div>
        ) : null}

        <div className="cosmos-overlay">
          {space.nodes.map((node) => {
            const layout = labelLayout[node.id] ?? {
              dotLeft: 0,
              dotTop: 0,
              dotScale: 1,
              labelLeft: 0,
              labelTop: 0,
              labelScale: 1,
            };
            const editing = isEditMode && editingNodeId === node.id;

            return (
              <>
                <div
                  className={`cosmos-node-dot ${selectedNodeId === node.id ? 'is-selected' : ''}`}
                  key={`${node.id}-dot`}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setDragState({
                      nodeId: node.id,
                      originX: layout.dotLeft,
                      originY: layout.dotTop,
                      startX: event.clientX,
                      startY: event.clientY,
                    });
                  }}
                  style={{
                    left: `${layout.dotLeft}px`,
                    top: `${layout.dotTop}px`,
                    transform: `translate(-50%, -50%) scale(${layout.dotScale})`,
                  }}
                >
                  <span className="cosmos-node-dot__core" />
                </div>

                <div
                  className={`cosmos-node-label ${isEditMode ? 'is-interactive' : ''} ${editing ? 'is-editing' : ''}`}
                  key={`${node.id}-label`}
                  style={{
                    left: `${layout.labelLeft}px`,
                    top: `${layout.labelTop}px`,
                    transform: `translate(-50%, -50%) scale(${layout.labelScale})`,
                  }}
                >
                  {editing ? (
                    <input
                      autoFocus
                      className="cosmos-node-input"
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
                    />
                  ) : (
                    <button
                      className="cosmos-node-label__button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handlePointSelection(node.id);
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
              </>
            );
          })}
        </div>
      </div>
    </section>
  );
}
