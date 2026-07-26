import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCopy } from '../lib/i18n';
import { buildSimNodes, findSpawnPosition, type SimNode } from '../lib/brainPhysics';
import type { AppLocale, BrainNode, Space } from '../types';
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
  isExpanded?: boolean;
  isInfoOpen?: boolean;
  infoPortalTarget?: HTMLElement | null;
  locale: AppLocale;
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
  onToggleExpanded?: () => void;
  onInfoOpenChange?: (open: boolean) => void;
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
  isExpanded = false,
  isInfoOpen: controlledInfoOpen,
  infoPortalTarget,
  locale,
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
  onToggleExpanded,
  onInfoOpenChange,
  space,
}: BrainCanvasProps) {
  const copy = getCopy(locale);
  const [internalInfoOpen, setInternalInfoOpen] = useState(false);
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
    startConnectFromNode,
    toggleConnectMode,
    toggleMultiSelect,
  } = useBrainSelection({
    clearTrackedNode,
    isEditMode,
    nodeLabels: selectionNodeLabels,
    untitledLabel: copy.map.untitled,
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
    isDragging,
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
  const isInfoOpen = controlledInfoOpen ?? internalInfoOpen;
  const setInfoOpen = (open: boolean) => {
    if (controlledInfoOpen === undefined) {
      setInternalInfoOpen(open);
    }
    onInfoOpenChange?.(open);
  };

  const addTransientNodeToSimulation = (nextNode: BrainNode) => {
    setSelectedNodeId(nextNode.id);
    setSimNodes((current) => appendTransientNode(current, nextNode));
  };

  const selectedNodeLabel =
    selectionNodeLabels.find((node) => node.id === selectedNodeId)?.label || copy.map.untitled;
  const selectedSimNode = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const selectedScreenPosition = selectedSimNode
    ? {
        x: selectedSimNode.x * effectiveViewport.zoom + effectiveViewport.x,
        y: selectedSimNode.y * effectiveViewport.zoom + effectiveViewport.y,
      }
    : null;

  const requestSelectedNodeDeletion = () => {
    if (!selectedNodeId || !onRequestDeleteNodes) {
      return;
    }

    onRequestDeleteNodes([selectedNodeId], [selectedNodeLabel]);
  };

  const renderAddNodeAction = () => (
    <button
      className="button button--accent"
      data-tour-id="add-node"
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
      {copy.map.newPoint}
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
        <h2>{copy.map.title}</h2>
        {onToggleExpanded ? (
          <button className="button panel__expand" onClick={onToggleExpanded} type="button">
            {isExpanded ? copy.map.restorePanel : copy.map.expandPanel}
          </button>
        ) : null}
        {!isMobile ? (
          <div className="panel__actions">
            <button
              className="button"
              onClick={() => setInfoOpen(!isInfoOpen)}
              type="button"
            >
              {isInfoOpen ? copy.map.hideInfo : copy.map.showInfo}
            </button>
            <button className="button button--ghost" data-tour-id="edit-map" onClick={onToggleEditMode} type="button">
              {isEditMode ? copy.map.done : copy.map.editContent}
            </button>
            {isEditMode ? (
              <button
                className={`button ${isConnectMode ? 'button--accent' : ''}`}
                data-tour-id="link-mode"
                onClick={toggleConnectMode}
                type="button"
              >
                {isConnectMode ? copy.map.linkModeOn : copy.map.linkModeOff}
              </button>
            ) : null}
            {isEditMode ? renderAddNodeAction() : null}
          </div>
        ) : (
          <div className="graph-mode-pill">{isEditMode ? copy.map.editingEnabled : copy.map.viewingMode}</div>
        )}
      </div>

      <div
        className={`graph-shell graph-shell--custom ${isEditMode ? 'is-editing' : 'is-viewing'} ${isPanning ? 'is-panning' : ''}`}
        data-tour-id="graph-shell"
        onClick={() => {
          if (isEditMode) {
            setSelectedNodeId(null);
          }
        }}
        onWheel={handleWheel}
        onPointerDown={handleBackgroundPointerDown}
        ref={shellRef}
      >
        {isInfoOpen ? (() => {
          const panel = (
          <BrainInfoPanel
            edgesCount={space.edges.length}
            infoSelection={infoSelection}
            isMobile={isMobile}
            isRail={Boolean(infoPortalTarget && !isMobile)}
            isMultiSelect={isInfoMultiSelect}
            locale={locale}
            nodes={simNodes}
            onClose={() => setInfoOpen(false)}
            onClearSelection={clearSelection}
            onDeleteSelection={deleteInfoSelection}
            onNodeClick={handleInfoNodeClick}
            onSelectAll={() => setInfoSelection(simNodes.map((node) => node.id))}
            onToggleMultiSelect={toggleMultiSelect}
            trackedNodeId={trackedNodeId}
          />
          );
          return infoPortalTarget && !isMobile ? createPortal(panel, infoPortalTarget) : panel;
        })() : null}

        <BrainEdgeLayer edges={space.edges} nodeById={nodeById} viewport={effectiveViewport} />

        <BrainNodeLayer
          editingNodeId={editingNodeId}
          isEditMode={isEditMode}
          isMobile={isMobile}
          locale={locale}
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
            if (isEditMode && isConnectMode) {
              return;
            }
            handleNodePointerDown(event, nodeId);
          }}
          onStartRenameNode={onStartRenameNode}
          selectedNodeId={selectedNodeId}
          spaceNodes={space.nodes}
          viewport={effectiveViewport}
        />

        {!isMobile && isEditMode && selectedNodeId && selectedScreenPosition && !isDragging ? (
          <div
            className={`node-context-toolbar ${selectedScreenPosition.y < 96 ? 'is-below' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: Math.min(Math.max(116, selectedScreenPosition.x), Math.max(116, (shellRef.current?.clientWidth ?? 800) - 116)),
              top: selectedScreenPosition.y,
            }}
          >
            <button onClick={() => onStartRenameNode(selectedNodeId)} type="button">{copy.map.rename}</button>
            <button
              className={isConnectMode ? 'is-active' : ''}
              onClick={() => startConnectFromNode(selectedNodeId)}
              type="button"
            >
              {copy.map.link}
            </button>
            <button className="is-danger" data-tour-id="node-delete" onClick={requestSelectedNodeDeletion} type="button">{copy.map.delete}</button>
          </div>
        ) : null}

        {isMobile ? (
          <>
            {selectedNodeId && isEditMode ? (
              <div className="graph-selection-bar">
                <strong>{selectedNodeLabel || copy.map.untitled}</strong>
                <div className="graph-selection-bar__actions">
                  <button className="button" onClick={() => onStartRenameNode(selectedNodeId)} type="button">
                    {copy.map.rename}
                  </button>
                  <button className="button button--danger" onClick={requestSelectedNodeDeletion} type="button">
                    {copy.map.delete}
                  </button>
                  <button className="button" onClick={() => setSelectedNodeId(null)} type="button">
                    {copy.map.clear}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="graph-mobile-bar">
              <button className="button" onClick={() => setInfoOpen(!isInfoOpen)} type="button">
                {isInfoOpen ? copy.map.hideInfo : copy.map.showInfo}
              </button>
              <button className="button button--ghost" data-tour-id="edit-map" onClick={onToggleEditMode} type="button">
                {isEditMode ? copy.map.done : copy.map.edit}
              </button>
              {isEditMode ? (
                <button
                  className={`button ${isConnectMode ? 'button--accent' : ''}`}
                  data-tour-id="link-mode"
                  onClick={toggleConnectMode}
                  type="button"
                >
                  {isConnectMode ? copy.map.linkOn : copy.map.link}
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
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
