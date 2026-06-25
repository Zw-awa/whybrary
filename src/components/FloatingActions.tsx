import { useEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';
import type { AppLocale } from '../types';

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
  const dockRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  useEffect(() => {
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
          return clampPosition(
            container,
            dock,
            container.clientWidth - dock.offsetWidth - 18,
            container.clientHeight - dock.offsetHeight - 18,
          );
        }

        return clampPosition(container, dock, current.x, current.y);
      });
    };

    placeDock();

    const resizeObserver = new ResizeObserver(placeDock);
    resizeObserver.observe(container);

    return () => resizeObserver.disconnect();
  }, [containerRef]);

  useEffect(() => {
    if (!dragging || isMobile) {
      return;
    }

    const handleMove = (event: globalThis.PointerEvent) => {
      const container = containerRef.current;
      const dock = dockRef.current;
      const dragOffset = dragOffsetRef.current;
      if (!container || !dock || !dragOffset) {
        return;
      }

      const rect = container.getBoundingClientRect();
      setPosition(
        clampPosition(
          container,
          dock,
          event.clientX - rect.left - dragOffset.x,
          event.clientY - rect.top - dragOffset.y,
        ),
      );
    };

    const handleEnd = () => {
      dragOffsetRef.current = null;
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

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
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
    setDragging(true);
  };

  return (
    <div
      className={`floating-actions ${dragging ? 'is-dragging' : ''} ${isMobile ? 'is-mobile' : ''}`}
      ref={dockRef}
      style={isMobile ? undefined : position ? { left: position.x, top: position.y } : undefined}
    >
      {!isMobile ? (
        <div className="floating-actions__grip" onPointerDown={handlePointerDown}>
          {locale === 'zh' ? '拖动' : 'Drag'}
        </div>
      ) : null}

      {actions.map((action) => (
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
      ))}
    </div>
  );
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
