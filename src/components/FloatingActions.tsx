import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from 'react';
import type { AppLocale } from '../types';
import { getCopy } from '../lib/i18n';

type FloatingAction = {
  id: string;
  label: string;
  title: string;
  disabled?: boolean;
  onPress: () => void;
};

type FloatingActionsProps = {
  actions: FloatingAction[];
  containerRef: RefObject<HTMLDivElement>;
  isMobile?: boolean;
  locale: AppLocale;
};

type Position = {
  x: number;
  y: number;
};

type StoredDockPosition = {
  edge: 'left' | 'right' | null;
  normalizedX?: number;
  normalizedY: number;
};

const DOCK_POSITION_KEY = 'whybrary.ui.todoDockPosition';
const DOCK_MARGIN = 12;
const DRAG_THRESHOLD = 4;
const EDGE_SNAP_DISTANCE = 56;

function loadStoredPosition(): StoredDockPosition | null {
  try {
    const raw = window.localStorage.getItem(DOCK_POSITION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredDockPosition>;
    const validEdge = parsed.edge === 'left' || parsed.edge === 'right';
    const validFreePosition = parsed.edge === null && typeof parsed.normalizedX === 'number';
    if ((!validEdge && !validFreePosition) || typeof parsed.normalizedY !== 'number') {
      return null;
    }

    return {
      edge: parsed.edge ?? null,
      normalizedX:
        typeof parsed.normalizedX === 'number'
          ? Math.min(1, Math.max(0, parsed.normalizedX))
          : undefined,
      normalizedY: Math.min(1, Math.max(0, parsed.normalizedY)),
    };
  } catch {
    return null;
  }
}

function clampPosition(
  container: HTMLDivElement,
  dock: HTMLDivElement,
  x: number,
  y: number,
): Position {
  const maxX = Math.max(12, container.clientWidth - dock.offsetWidth - 12);
  const maxY = Math.max(12, container.clientHeight - dock.offsetHeight - 12);

  return {
    x: Math.min(Math.max(12, x), maxX),
    y: Math.min(Math.max(12, y), maxY),
  };
}

export function FloatingActions({
  actions,
  containerRef,
  isMobile = false,
  locale,
}: FloatingActionsProps) {
  const copy = getCopy(locale);
  const dockRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position | null>(null);
  const dragStartRef = useRef<Position | null>(null);
  const movedRef = useRef(false);
  const storedPositionRef = useRef(loadStoredPosition());
  const positionRef = useRef<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [dockEdge, setDockEdge] = useState<'left' | 'right' | null>(
    storedPositionRef.current?.edge ?? 'right',
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const dock = dockRef.current;
    if (!container || !dock) {
      return;
    }

    const placeDock = () => {
      setPosition((current) => {
        if (!container || !dock) {
          return current;
        }

        if (!current) {
          const stored = storedPositionRef.current;
          if (stored) {
            const maxX = Math.max(
              DOCK_MARGIN,
              container.clientWidth - dock.offsetWidth - DOCK_MARGIN,
            );
            const maxY = Math.max(
              DOCK_MARGIN,
              container.clientHeight - dock.offsetHeight - DOCK_MARGIN,
            );
            const next = {
              x:
                stored.edge === 'left'
                  ? DOCK_MARGIN
                  : stored.edge === 'right'
                    ? maxX
                    : DOCK_MARGIN + (stored.normalizedX ?? 0.5) * (maxX - DOCK_MARGIN),
              y: DOCK_MARGIN + stored.normalizedY * (maxY - DOCK_MARGIN),
            };
            positionRef.current = next;
            return next;
          }

          const next = clampPosition(
            container,
            dock,
            container.clientWidth - dock.offsetWidth - 18,
            container.clientHeight - dock.offsetHeight - 18,
          );
          positionRef.current = next;
          return next;
        }

        const maxX = Math.max(DOCK_MARGIN, container.clientWidth - dock.offsetWidth - DOCK_MARGIN);
        const stored = storedPositionRef.current;
        const nextX =
          dockEdge === 'left'
            ? DOCK_MARGIN
            : dockEdge === 'right'
              ? maxX
              : DOCK_MARGIN + (stored?.normalizedX ?? 0.5) * (maxX - DOCK_MARGIN);
        const next = clampPosition(container, dock, nextX, current.y);
        positionRef.current = next;
        return next;
      });
    };

    placeDock();

    const resizeObserver = new ResizeObserver(placeDock);
    resizeObserver.observe(container);
    resizeObserver.observe(dock);

    return () => resizeObserver.disconnect();
  }, [containerRef, dockEdge, minimized]);

  useEffect(() => {
    if (!dragging || isMobile) {
      return;
    }

    const handleMove = (event: globalThis.PointerEvent) => {
      const container = containerRef.current;
      const dock = dockRef.current;
      const dragOffset = dragOffsetRef.current;
      const dragStart = dragStartRef.current;
      if (!container || !dock || !dragOffset) {
        return;
      }

      if (
        dragStart &&
        Math.hypot(event.clientX - dragStart.x, event.clientY - dragStart.y) >= DRAG_THRESHOLD
      ) {
        movedRef.current = true;
      }

      const rect = container.getBoundingClientRect();
      const next = clampPosition(
        container,
        dock,
        event.clientX - rect.left - dragOffset.x,
        event.clientY - rect.top - dragOffset.y,
      );
      positionRef.current = next;
      setPosition(next);
    };

    const handleEnd = () => {
      const container = containerRef.current;
      const dock = dockRef.current;
      const current = positionRef.current;
      if (container && dock && current && movedRef.current) {
        const maxX = Math.max(DOCK_MARGIN, container.clientWidth - dock.offsetWidth - DOCK_MARGIN);
        const maxY = Math.max(
          DOCK_MARGIN,
          container.clientHeight - dock.offsetHeight - DOCK_MARGIN,
        );
        const distanceLeft = current.x;
        const distanceRight = container.clientWidth - current.x - dock.offsetWidth;
        const edge: StoredDockPosition['edge'] =
          distanceLeft <= EDGE_SNAP_DISTANCE
            ? 'left'
            : distanceRight <= EDGE_SNAP_DISTANCE
              ? 'right'
              : null;
        const next = clampPosition(
          container,
          dock,
          edge === 'left' ? DOCK_MARGIN : edge === 'right' ? maxX : current.x,
          current.y,
        );
        const normalizedX =
          maxX === DOCK_MARGIN ? 0 : (next.x - DOCK_MARGIN) / (maxX - DOCK_MARGIN);
        const normalizedY =
          maxY === DOCK_MARGIN ? 0 : (next.y - DOCK_MARGIN) / (maxY - DOCK_MARGIN);
        const stored: StoredDockPosition = {
          edge,
          normalizedX: edge ? undefined : normalizedX,
          normalizedY,
        };
        window.localStorage.setItem(DOCK_POSITION_KEY, JSON.stringify(stored));
        storedPositionRef.current = stored;
        positionRef.current = next;
        setDockEdge(edge);
        setPosition(next);
      }

      dragOffsetRef.current = null;
      dragStartRef.current = null;
      setDragging(false);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    };
  }, [containerRef, dragging, isMobile]);

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (isMobile) {
      return;
    }

    const dock = dockRef.current;
    if (!dock) {
      return;
    }

    const dockRect = dock.getBoundingClientRect();
    dragOffsetRef.current = {
      x: event.clientX - dockRect.left,
      y: event.clientY - dockRect.top,
    };
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    movedRef.current = false;
    setDragging(true);
  };

  const toggleMinimized = () => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }

    setMinimized((current) => !current);
  };

  const edgeClass = minimized && !isMobile && dockEdge ? `is-edge-peek is-edge-${dockEdge}` : '';

  return (
    <div
      className={`floating-actions ${dragging ? 'is-dragging' : ''} ${isMobile ? 'is-mobile' : ''} ${minimized ? 'is-minimized' : ''} ${edgeClass}`}
      onClick={minimized && !isMobile ? toggleMinimized : undefined}
      onPointerDown={minimized && !isMobile ? handlePointerDown : undefined}
      ref={dockRef}
      style={isMobile ? undefined : position ? { left: position.x, top: position.y } : undefined}
    >
      {!isMobile && !minimized ? (
        <div className="floating-actions__grip" onPointerDown={handlePointerDown}>
          {copy.floatingActions.drag}
        </div>
      ) : null}

      {!minimized
        ? actions.map((action) => (
            <button
              className="floating-actions__button"
              disabled={action.disabled}
              key={action.id}
              onClick={action.onPress}
              title={action.title}
              type="button"
            >
              {action.label}
            </button>
          ))
        : null}

      <button
        aria-label={minimized ? copy.floatingActions.expand : copy.floatingActions.minimize}
        className="floating-actions__toggle"
        onClick={!minimized ? toggleMinimized : undefined}
        title={minimized ? copy.floatingActions.expand : copy.floatingActions.minimize}
        type="button"
      >
        {minimized ? '+' : '\u2212'}
      </button>
    </div>
  );
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
