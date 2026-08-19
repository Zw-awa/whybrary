import { useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getCopy } from '../lib/i18n';
import { buildSimNodes, findSpawnPosition, type SimNode } from '../lib/brainPhysics';
import type { AppLocale, BrainEdge, BrainNode, NodeCategory, NodeColor, Space } from '../types';
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
  edges: BrainEdge[];
  nodes: BrainNode[];
  viewport: Space['viewport'];
  advancedEnabled?: boolean;
  onNodeMetadataChange?: (nodeId: string, category?: NodeCategory, color?: NodeColor) => void;
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
  edges,
  nodes,
  viewport,
  advancedEnabled = false,
  onNodeMetadataChange,
}: BrainCanvasProps) {
  const copy = getCopy(locale);
  const [internalInfoOpen, setInternalInfoOpen] = useState(false);
  const [query, setQuery] = useState('');
  const shellRef = useRef<HTMLDivElement>(null);
  const simulationSpace = useMemo(
    () => ({ id: 'graph', nodes, edges, viewport }) as Space,
    [edges, nodes, viewport],
  );
  const simNodesRef = useRef<SimNode[]>(buildSimNodes(simulationSpace));
  const selectionNodeLabels = useMemo(
    () => nodes.map((node) => ({ id: node.id, label: node.data.label })),
    [nodes],
  );
  const {
    clearTrackedNode,
    commitTrackedViewportAndClear,
    effectiveViewport,
    handleBackgroundPointerDown,
    handleWheel,
    fitToNodes,
    isPanning,
    setTrackedNodeId,
    trackedNodeId,
  } = useBrainViewport({
    nodes: simNodesRef.current,
    onViewportChange,
    shellRef,
    viewport,
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
    space: simulationSpace,
  });
  const { nodeById, setSimNodes, simNodes } = useBrainSimulation({
    dragPointerRef,
    dragStateRef,
    shellRef,
    simNodesRef,
    space: simulationSpace,
  });
  const normalizedQuery = query.trim().toLocaleLowerCase(locale);
  const visibleNodes = useMemo(
    () =>
      simNodes.filter(
        (node) =>
          !normalizedQuery || node.label.toLocaleLowerCase(locale).includes(normalizedQuery),
      ),
    [locale, normalizedQuery, simNodes],
  );
  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleEdges = useMemo(
    () => edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)),
    [edges, visibleIds],
  );
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
  const selectedSourceNode = selectedNodeId
    ? nodes.find((node) => node.id === selectedNodeId)
    : undefined;
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

  const withNodeClick = (event: React.MouseEvent<HTMLButtonElement>, nodeId: string) => {
    event.stopPropagation();

    if (consumeSuppressedClick()) {
      return;
    }

    handleNodeClick(nodeId);
  };

  return (
    <section className="panel panel--graph">
      <div className="panel__header panel__header--graph">
        <h2>{copy.map.title}</h2>
        <div className="graph-search">
          <input
            aria-label={copy.map.searchPlaceholder}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.map.searchPlaceholder}
            type="search"
            value={query}
          />
          {query ? (
            <button aria-label={copy.map.clearSearch} onClick={() => setQuery('')} type="button">
              ×
            </button>
          ) : null}
        </div>
        <button className="button panel__fit" onClick={fitToNodes} type="button">
          {copy.map.fitToNodes}
        </button>
        {onToggleExpanded && !isMobile ? (
          <button className="button panel__expand" onClick={onToggleExpanded} type="button">
            {isExpanded ? copy.map.restorePanel : copy.map.expandPanel}
          </button>
        ) : null}
        {!isMobile ? (
          <div className="panel__actions">
            <button className="button" onClick={() => setInfoOpen(!isInfoOpen)} type="button">
              {isInfoOpen ? copy.map.hideInfo : copy.map.showInfo}
            </button>
            <button
              className="button button--ghost"
              data-tour-id="edit-map"
              onClick={onToggleEditMode}
              type="button"
            >
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
          <div className="graph-mode-pill">
            {isEditMode ? copy.map.editingEnabled : copy.map.viewingMode}
          </div>
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
        {isInfoOpen
          ? (() => {
              const panel = (
                <BrainInfoPanel
                  edgesCount={edges.length}
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
            })()
          : null}

        <BrainEdgeLayer edges={visibleEdges} nodeById={nodeById} viewport={effectiveViewport} />

        <BrainNodeLayer
          editingNodeId={editingNodeId}
          isEditMode={isEditMode}
          isMobile={isMobile}
          locale={locale}
          nodes={visibleNodes}
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
          spaceNodes={nodes}
          viewport={effectiveViewport}
        />

        {!isMobile && isEditMode && selectedNodeId && selectedScreenPosition && !isDragging ? (
          <div
            className={`node-context-toolbar ${selectedScreenPosition.y < 96 ? 'is-below' : ''}`}
            onPointerDown={(event) => event.stopPropagation()}
            style={{
              left: Math.min(
                Math.max(116, selectedScreenPosition.x),
                Math.max(116, (shellRef.current?.clientWidth ?? 800) - 116),
              ),
              top: selectedScreenPosition.y,
            }}
          >
            <button onClick={() => onStartRenameNode(selectedNodeId)} type="button">
              {copy.map.rename}
            </button>
            <button
              className={isConnectMode ? 'is-active' : ''}
              onClick={() => startConnectFromNode(selectedNodeId)}
              type="button"
            >
              {copy.map.link}
            </button>
            <button
              className="is-danger"
              data-tour-id="node-delete"
              onClick={requestSelectedNodeDeletion}
              type="button"
            >
              {copy.map.delete}
            </button>
          </div>
        ) : null}

        {advancedEnabled && isEditMode && selectedNodeId && selectedSourceNode ? (
          <div className="node-advanced-editor" onPointerDown={(event) => event.stopPropagation()}>
            <label>
              <span>{copy.advanced.category}</span>
              <select
                aria-label={copy.advanced.category}
                onChange={(event) =>
                  onNodeMetadataChange?.(
                    selectedNodeId,
                    (event.target.value || undefined) as NodeCategory | undefined,
                    selectedSourceNode.data.color,
                  )
                }
                value={selectedSourceNode.data.category ?? ''}
              >
                <option value="">{copy.advanced.noCategory}</option>
                {(['idea', 'reason', 'question', 'action'] as const).map((value) => (
                  <option key={value} value={value}>
                    {copy.advanced.categories[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>{copy.advanced.color}</span>
              <select
                aria-label={copy.advanced.color}
                onChange={(event) =>
                  onNodeMetadataChange?.(
                    selectedNodeId,
                    selectedSourceNode.data.category,
                    event.target.value as NodeColor,
                  )
                }
                value={selectedSourceNode.data.color ?? 'neutral'}
              >
                {(['neutral', 'blue', 'green', 'amber', 'red'] as const).map((value) => (
                  <option key={value} value={value}>
                    {copy.advanced.colors[value]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {isMobile ? (
          <>
            {selectedNodeId && isEditMode ? (
              <div className="graph-selection-bar">
                <strong>{selectedNodeLabel || copy.map.untitled}</strong>
                <div className="graph-selection-bar__actions">
                  <button
                    className="button"
                    onClick={() => onStartRenameNode(selectedNodeId)}
                    type="button"
                  >
                    {copy.map.rename}
                  </button>
                  <button
                    className="button button--danger"
                    onClick={requestSelectedNodeDeletion}
                    type="button"
                  >
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
              <button
                className="button button--ghost"
                data-tour-id="edit-map"
                onClick={onToggleEditMode}
                type="button"
              >
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
