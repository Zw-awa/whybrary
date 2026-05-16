import type { SimNode } from '../lib/brainPhysics';

type BrainInfoPanelProps = {
  edgesCount: number;
  infoSelection: string[];
  isMobile?: boolean;
  isMultiSelect: boolean;
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
  isMultiSelect,
  nodes,
  onClose,
  onClearSelection,
  onDeleteSelection,
  onNodeClick,
  onSelectAll,
  onToggleMultiSelect,
  trackedNodeId,
}: BrainInfoPanelProps) {
  return (
    <aside
      className={`graph-info ${isMobile ? 'graph-info--sheet' : ''}`}
      onPointerDown={(event) => event.stopPropagation()}
      onWheelCapture={(event) => event.stopPropagation()}
    >
      <div className="graph-info__topbar">
        <div className="graph-info__summary">
          <strong>{nodes.length} nodes</strong>
          <span>{edgesCount} links</span>
        </div>
        {onClose ? (
          <button className="graph-info__dismiss" onClick={onClose} type="button">
            Close
          </button>
        ) : null}
      </div>

      <div className="graph-info__actions">
        <button
          className={`graph-info__action ${isMultiSelect ? 'is-active' : ''}`}
          onClick={onToggleMultiSelect}
          type="button"
        >
          {isMultiSelect ? 'Multi On' : 'Multi Off'}
        </button>
        <button
          className="graph-info__action"
          onClick={onSelectAll}
          type="button"
          disabled={!isMultiSelect}
        >
          Select All
        </button>
        <button className="graph-info__action" onClick={onClearSelection} type="button">
          Clear
        </button>
        <button
          className="graph-info__action graph-info__action--danger"
          disabled={infoSelection.length === 0}
          onClick={onDeleteSelection}
          type="button"
        >
          Delete Selected
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
            <strong>{node.label || `Untitled ${index + 1}`}</strong>
            <span>
              {node.x.toFixed(0)}, {node.y.toFixed(0)}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
