import { useMemo, useRef, useState } from 'react';
import { buildSimNodes, findSpawnPosition, type SimNode } from '../lib/brainPhysics';
import type { BrainNode, Space } from '../types';
import { BrainEdgeLayer } from './BrainEdgeLayer';
import { BrainInfoPanel } from './BrainInfoPanel';
import { BrainNodeLayer } from './BrainNodeLayer';
import { useBrainDrag } from './useBrainDrag';
import { useBrainSelection } from './useBrainSelection';
import { useBrainSimulation } from './useBrainSimulation';
import { useBrainViewport } from './useBrainViewport';

type BrainCanvasProps = {
  editingNodeId: string | null;
  isMobile?: boolean;
  onDeleteNodes: (nodeIds: string[]) => void;
  onRequestDeleteNodes?: (nodeIds: string[], labels: string[]) => void;
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

function appendTransientNode(current: SimNode[], nextNode: BrainNode): SimNode[] {
  if (current.some((node) => node.id === nextNode.id)) {
    return current;
  }

  return [
    ...current,
    {
      id: nextNode.id,
      label: nextNode.data.label,
      x: nextNode.position.x,
      y: nextNode.position.y,
      vx: 0,
      vy: 0,
    },
  ];
}

export function BrainCanvas({
  editingNodeId,
  isMobile = false,
  onDeleteNodes,
  onRequestDeleteNodes,
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
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const simNodesRef = useRef<SimNode[]>(buildSimNodes(space));
  const selectionNodeLabels = useMemo(
    () => space.nodes.map((node) => ({ id: node.id, label: node.data.label })),
    [space.nodes],
  );
  const {
    clearTrackedNode,
    commitTrackedViewportAndClear,
    effectiveViewport,
    handleBackgroundPointerDown,
    handleWheel,
    isPanning,
    setTrackedNodeId,
    trackedNodeId,
  } = useBrainViewport({
    nodes: simNodesRef.current,
    onViewportChange,
    shellRef,
    viewport: space.viewport,
  });
  const {
    clearSelection,
    deleteInfoSelection,
    handleInfoNodeClick,
    handleNodeClick,
    infoSelection,
    isConnectMode,
    isInfoMultiSelect,
    selectedNodeId,
    setInfoSelection,
    setSelectedNodeId,
    toggleConnectMode,
    toggleMultiSelect,
  } = useBrainSelection({
    clearTrackedNode,
    isEditMode,
    nodeLabels: selectionNodeLabels,
    onDeleteNodes,
    onRequestDeleteSelection: onRequestDeleteNodes,
    onToggleConnection,
    setTrackedNodeId,
  });
  const {
    consumeSuppressedClick,
    dragPointerRef,
    dragStateRef,
    handleNodePointerDown,
  } = useBrainDrag({
    effectiveViewport,
    onPersistNodePositions,
    onSelectNode: setSelectedNodeId,
    shellRef,
    simNodesRef,
    space,
  });
  const { nodeById, setSimNodes, simNodes } = useBrainSimulation({
    dragPointerRef,
    dragStateRef,
    shellRef,
    simNodesRef,
    space,
  });

  const addTransientNodeToSimulation = (nextNode: BrainNode) => {
    setSelectedNodeId(nextNode.id);
    setSimNodes((current) => appendTransientNode(current, nextNode));
  };

  const selectedNodeLabel =
    selectionNodeLabels.find((node) => node.id === selectedNodeId)?.label || 'Untitled';

  const requestSelectedNodeDeletion = () => {
    if (!selectedNodeId || !onRequestDeleteNodes) {
      return;
    }

    onRequestDeleteNodes([selectedNodeId], [selectedNodeLabel]);
  };

  const renderAddNodeAction = () => (
    <button
      className="button button--accent"
      onClick={() => {
        const shell = shellRef.current;
        if (!shell) {
          const nextNode = onAddNeuron();
          if (nextNode) {
            addTransientNodeToSimulation(nextNode);
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
          addTransientNodeToSimulation(nextNode);
        }
      }}
      type="button"
    >
      New Point
    </button>
  );

  const withNodeClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    nodeId: string,
  ) => {
    event.stopPropagation();

    if (consumeSuppressedClick()) {
      return;
    }

    handleNodeClick(nodeId);
  };

  return (
    <section className="panel panel--graph">
      <div className="panel__header">
        <h2>Mind Map</h2>
        {!isMobile ? (
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
                onClick={toggleConnectMode}
                type="button"
              >
                {isConnectMode ? 'Link Mode On' : 'Link Mode Off'}
              </button>
            ) : null}
            {isEditMode ? renderAddNodeAction() : null}
          </div>
        ) : (
          <div className="graph-mode-pill">{isEditMode ? 'Editing enabled' : 'Viewing mode'}</div>
        )}
      </div>

      <div
        className={`graph-shell graph-shell--custom ${isEditMode ? 'is-editing' : 'is-viewing'} ${isPanning ? 'is-panning' : ''}`}
        onClick={() => {
          if (isEditMode) {
            setSelectedNodeId(null);
          }
        }}
        onWheel={handleWheel}
        onPointerDown={handleBackgroundPointerDown}
        ref={shellRef}
      >
        {isInfoOpen ? (
          <BrainInfoPanel
            edgesCount={space.edges.length}
            infoSelection={infoSelection}
            isMobile={isMobile}
            isMultiSelect={isInfoMultiSelect}
            nodes={simNodes}
            onClose={() => setIsInfoOpen(false)}
            onClearSelection={clearSelection}
            onDeleteSelection={deleteInfoSelection}
            onNodeClick={handleInfoNodeClick}
            onSelectAll={() => setInfoSelection(simNodes.map((node) => node.id))}
            onToggleMultiSelect={toggleMultiSelect}
            trackedNodeId={trackedNodeId}
          />
        ) : null}

        <BrainEdgeLayer edges={space.edges} nodeById={nodeById} viewport={effectiveViewport} />

        <BrainNodeLayer
          editingNodeId={editingNodeId}
          isEditMode={isEditMode}
          isMobile={isMobile}
          nodes={simNodes}
          onDotClick={withNodeClick}
          onFinishRenameNode={onFinishRenameNode}
          onLabelClick={withNodeClick}
          onNodeLabelChange={onNodeLabelChange}
          onNodeLongPress={(nodeId) => {
            setSelectedNodeId(nodeId);
            onStartRenameNode(nodeId);
          }}
          onNodePointerDown={(event, nodeId) => {
            event.stopPropagation();
            commitTrackedViewportAndClear();
            if (isConnectMode) {
              return;
            }
            handleNodePointerDown(event, nodeId);
          }}
          onStartRenameNode={onStartRenameNode}
          selectedNodeId={selectedNodeId}
          spaceNodes={space.nodes}
          viewport={effectiveViewport}
        />

        {isMobile ? (
          <>
            {selectedNodeId && isEditMode ? (
              <div className="graph-selection-bar">
                <strong>{selectedNodeLabel || 'Untitled'}</strong>
                <div className="graph-selection-bar__actions">
                  <button className="button" onClick={() => onStartRenameNode(selectedNodeId)} type="button">
                    Rename
                  </button>
                  <button className="button button--danger" onClick={requestSelectedNodeDeletion} type="button">
                    Delete
                  </button>
                  <button className="button" onClick={() => setSelectedNodeId(null)} type="button">
                    Clear
                  </button>
                </div>
              </div>
            ) : null}

            <div className="graph-mobile-bar">
              <button className="button" onClick={() => setIsInfoOpen((current) => !current)} type="button">
                {isInfoOpen ? 'Hide Info' : 'Show Info'}
              </button>
              <button className="button button--ghost" onClick={onToggleEditMode} type="button">
                {isEditMode ? 'Done' : 'Edit'}
              </button>
              {isEditMode ? (
                <button
                  className={`button ${isConnectMode ? 'button--accent' : ''}`}
                  onClick={toggleConnectMode}
                  type="button"
                >
                  {isConnectMode ? 'Link On' : 'Link'}
                </button>
              ) : null}
              {isEditMode ? renderAddNodeAction() : null}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
