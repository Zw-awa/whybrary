import {
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from 'react';
import type { SimNode } from '../lib/brainPhysics';
import type { BrainNode, Space } from '../types';

export type BrainDragState = {
  nodeId: string;
  startX: number;
  startY: number;
  started: boolean;
};

const PERSIST_DEBOUNCE_MS = 220;
const DRAG_START_DISTANCE = 4;

type UseBrainDragArgs = {
  effectiveViewport: Space['viewport'];
  onPersistNodePositions: (nextNodes: BrainNode[]) => void;
  onSelectNode: (nodeId: string) => void;
  shellRef: RefObject<HTMLDivElement>;
  simNodesRef: MutableRefObject<SimNode[]>;
  space: Space;
};

export function useBrainDrag({
  effectiveViewport,
  onPersistNodePositions,
  onSelectNode,
  shellRef,
  simNodesRef,
  space,
}: UseBrainDragArgs) {
  const [dragState, setDragState] = useState<BrainDragState | null>(null);
  const dragPointerRef = useRef<{ x: number; y: number } | null>(null);
  const dragStateRef = useRef<BrainDragState | null>(dragState);
  const persistTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (!dragState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      const currentDrag = dragStateRef.current;
      const shell = shellRef.current;
      if (!shell || !currentDrag) {
        return;
      }

      const rect = shell.getBoundingClientRect();
      const nextX = (event.clientX - rect.left - effectiveViewport.x) / effectiveViewport.zoom;
      const nextY = (event.clientY - rect.top - effectiveViewport.y) / effectiveViewport.zoom;
      const dx = event.clientX - currentDrag.startX;
      const dy = event.clientY - currentDrag.startY;
      const shouldStartDrag =
        currentDrag.started || Math.sqrt(dx * dx + dy * dy) >= DRAG_START_DISTANCE;

      if (!currentDrag.started && shouldStartDrag) {
        const startedDrag = { ...currentDrag, started: true };
        dragStateRef.current = startedDrag;
        setDragState(startedDrag);
        onSelectNode(currentDrag.nodeId);
        suppressClickRef.current = true;
      }

      if (!shouldStartDrag) {
        return;
      }

      dragPointerRef.current = { x: nextX, y: nextY };
    };

    const handleEnd = () => {
      const wasDragging = dragStateRef.current?.started ?? false;
      dragStateRef.current = null;
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
  }, [
    dragState,
    effectiveViewport,
    onPersistNodePositions,
    onSelectNode,
    shellRef,
    simNodesRef,
    space,
  ]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current !== null) {
        window.clearTimeout(persistTimerRef.current);
      }
    };
  }, []);

  const consumeSuppressedClick = () => {
    if (!suppressClickRef.current) {
      return false;
    }

    suppressClickRef.current = false;
    return true;
  };

  const handleNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, nodeId: string) => {
    if (event.isPrimary === false || (event.button !== undefined && event.button !== 0)) {
      return;
    }

    onSelectNode(nodeId);
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    const shellRect = shell.getBoundingClientRect();
    dragPointerRef.current = {
      x: (event.clientX - shellRect.left - effectiveViewport.x) / effectiveViewport.zoom,
      y: (event.clientY - shellRect.top - effectiveViewport.y) / effectiveViewport.zoom,
    };
    const nextDragState = {
      nodeId,
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
    dragStateRef.current = nextDragState;
    setDragState(nextDragState);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  return {
    consumeSuppressedClick,
    dragPointerRef,
    dragStateRef,
    handleNodePointerDown,
    isDragging: dragState?.started ?? false,
  };
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
