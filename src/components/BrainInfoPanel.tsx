import { getCopy } from '../lib/i18n';
import type { SimNode } from '../lib/brainPhysics';
import type { AppLocale } from '../types';

type BrainInfoPanelProps = {
  edgesCount: number;
  infoSelection: string[];
  isMobile?: boolean;
  isRail?: boolean;
  isMultiSelect: boolean;
  locale: AppLocale;
  nodes: SimNode[];
  onClose?: () => void;
  onClearSelection: () => void;
  onDeleteSelection: () => void;
  onNodeClick: (nodeId: string) => void;
  onSelectAll: () => void;
  onToggleMultiSelect: () => void;
  trackedNodeId: string | null;
};

export function BrainInfoPanel({
  edgesCount,
  infoSelection,
  isMobile = false,
  isRail = false,
  isMultiSelect,
  locale,
  nodes,
  onClose,
  onClearSelection,
  onDeleteSelection,
  onNodeClick,
  onSelectAll,
  onToggleMultiSelect,
  trackedNodeId,
}: BrainInfoPanelProps) {
  const copy = getCopy(locale);

  return (
    <aside
      className={`graph-info ${isMobile ? 'graph-info--sheet' : ''} ${isRail ? 'graph-info--rail' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className="graph-info__topbar">
        <div className="graph-info__summary">
          <strong>{copy.info.nodes(nodes.length)}</strong>
          <span>{copy.info.links(edgesCount)}</span>
        </div>
        {onClose ? (
          <button className="graph-info__dismiss" onClick={onClose} type="button">
            {copy.info.close}
          </button>
        ) : null}
      </div>

      <div className="graph-info__actions">
        <button
          className={`graph-info__action ${isMultiSelect ? 'is-active' : ''}`}
          onClick={onToggleMultiSelect}
          type="button"
        >
          {isMultiSelect ? copy.info.multiOn : copy.info.multiOff}
        </button>
        <button
          className="graph-info__action"
          onClick={onSelectAll}
          type="button"
          disabled={!isMultiSelect}
        >
          {copy.info.selectAll}
        </button>
        <button className="graph-info__action" onClick={onClearSelection} type="button">
          {copy.info.clear}
        </button>
        <button
          className="graph-info__action graph-info__action--danger"
          disabled={infoSelection.length === 0}
          onClick={onDeleteSelection}
          type="button"
        >
          {copy.info.deleteSelected}
        </button>
      </div>

      <div className="graph-info__list" onWheelCapture={(event) => event.stopPropagation()}>
        {nodes.map((node, index) => (
          <button
            className={`graph-info__item ${trackedNodeId === node.id ? 'is-tracked' : ''} ${infoSelection.includes(node.id) ? 'is-selected' : ''}`}
            key={node.id}
            onClick={() => onNodeClick(node.id)}
            type="button"
          >
            <strong>{node.label || copy.info.untitledNode(index + 1)}</strong>
            <span>
              {node.x.toFixed(0)}, {node.y.toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
