import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { clamp, type SimNode } from '../lib/brainPhysics';
import type { Space } from '../types';

type UseBrainViewportArgs = {
  nodes: SimNode[];
  onViewportChange: (viewport: Space['viewport']) => void;
  shellRef: RefObject<HTMLDivElement>;
  viewport: Space['viewport'];
};

type PanState = {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

export function useBrainViewport({
  nodes,
  onViewportChange,
  shellRef,
  viewport,
}: UseBrainViewportArgs) {
  const [panState, setPanState] = useState<PanState | null>(null);
  const [trackedNodeId, setTrackedNodeId] = useState<string | null>(null);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const trackedNode = trackedNodeId ? nodeById.get(trackedNodeId) : undefined;

  useEffect(() => {
    if (!trackedNodeId) {
      return;
    }

    const exists = nodes.some((node) => node.id === trackedNodeId);
    if (!exists) {
      setTrackedNodeId(null);
    }
  }, [nodes, trackedNodeId]);

  useEffect(() => {
    if (!panState) {
      return;
    }

    const handleMove = (event: PointerEvent) => {
      onViewportChange({
        ...viewport,
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
  }, [onViewportChange, panState, viewport]);

  const getViewportForNode = (node: SimNode | undefined): Space['viewport'] | null => {
    const shell = shellRef.current;
    if (!shell || !node) {
      return null;
    }

    const rect = shell.getBoundingClientRect();
    return {
      x: rect.width / 2 - node.x * viewport.zoom,
      y: rect.height / 2 - node.y * viewport.zoom,
      zoom: viewport.zoom,
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

  const effectiveViewport = getViewportForNode(trackedNode) ?? viewport;

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
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
    const nextZoom = clamp(viewport.zoom * zoomDelta, 0.35, 1.8);
    if (nextZoom === viewport.zoom) {
      return;
    }

    const worldX = (pointerX - effectiveViewport.x) / effectiveViewport.zoom;
    const worldY = (pointerY - effectiveViewport.y) / effectiveViewport.zoom;

    onViewportChange({
      x: pointerX - worldX * nextZoom,
      y: pointerY - worldY * nextZoom,
      zoom: nextZoom,
    });
  };

  const handleBackgroundPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
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
  };

  return {
    clearTrackedNode: () => setTrackedNodeId(null),
    commitTrackedViewportAndClear,
    effectiveViewport,
    handleBackgroundPointerDown,
    handleWheel,
    isPanning: panState !== null,
    setTrackedNodeId,
    trackedNodeId,
  };
}
