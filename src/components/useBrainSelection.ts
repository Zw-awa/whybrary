import { useEffect, useRef, useState } from 'react';

type UseBrainSelectionArgs = {
  clearTrackedNode: () => void;
  isEditMode: boolean;
  nodeLabels: Array<{ id: string; label: string }>;
  untitledLabel: string;
  onDeleteNodes: (nodeIds: string[]) => void;
  onRequestDeleteSelection?: (nodeIds: string[], labels: string[]) => void;
  onToggleConnection: (sourceId: string, targetId: string) => void;
  setTrackedNodeId: (nodeId: string | null) => void;
};

export function useBrainSelection({
  clearTrackedNode,
  isEditMode,
  nodeLabels,
  untitledLabel,
  onDeleteNodes,
  onRequestDeleteSelection,
  onToggleConnection,
  setTrackedNodeId,
}: UseBrainSelectionArgs) {
  const [infoSelection, setInfoSelection] = useState<string[]>([]);
  const [isConnectMode, setIsConnectMode] = useState(false);
  const [isInfoMultiSelect, setIsInfoMultiSelect] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(selectedNodeId);

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

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const exists = nodeLabels.some((node) => node.id === selectedNodeId);
    if (!exists) {
      setSelectedNodeId(null);
    }
  }, [nodeLabels, selectedNodeId]);

  useEffect(() => {
    setInfoSelection((current) => {
      const next = current.filter((nodeId) => nodeLabels.some((node) => node.id === nodeId));
      if (next.length === current.length && next.every((nodeId, index) => nodeId === current[index])) {
        return current;
      }
      return next;
    });
  }, [nodeLabels]);

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

  const clearSelection = () => {
    setInfoSelection([]);
    setSelectedNodeId(null);
  };

  const deleteInfoSelection = () => {
    if (infoSelection.length === 0) {
      return;
    }

    const labels = infoSelection.map(
      (nodeId) => nodeLabels.find((node) => node.id === nodeId)?.label || untitledLabel,
    );

    if (onRequestDeleteSelection) {
      onRequestDeleteSelection(infoSelection, labels);
      return;
    }

    const preview = labels.slice(0, 3).join(', ');
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

  const handleInfoNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    if (isInfoMultiSelect) {
      setInfoSelection((current) =>
        current.includes(nodeId)
          ? current.filter((item) => item !== nodeId)
          : [...current, nodeId],
      );
      return;
    }

    setTrackedNodeId(nodeId);
    setInfoSelection([nodeId]);
  };

  const handleNodeClick = (nodeId: string) => {
    if (selectedNodeId && selectedNodeId !== nodeId) {
      if (isEditMode && isConnectMode) {
        onToggleConnection(selectedNodeId, nodeId);
      }
      setSelectedNodeId(null);
      return;
    }

    setSelectedNodeId((current) => (current === nodeId ? null : nodeId));
  };

  const toggleConnectMode = () => {
    setIsConnectMode((current) => !current);
    setSelectedNodeId(null);
  };

  const toggleMultiSelect = () => {
    setIsInfoMultiSelect((current) => {
      const next = !current;
      if (next) {
        clearTrackedNode();
        setSelectedNodeId(null);
        setInfoSelection([]);
      } else if (selectedNodeIdRef.current) {
        setInfoSelection([selectedNodeIdRef.current]);
      }
      return next;
    });
  };

  return {
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
  };
}
