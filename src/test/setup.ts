import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

const frameQueue: FrameRequestCallback[] = [];
let nextFrameId = 1;

export function flushAnimationFrame(count = 1) {
  for (let index = 0; index < count; index += 1) {
    const callback = frameQueue.shift();
    if (!callback) {
      return;
    }

    callback(performance.now());
  }
}

export function clearAnimationFrames() {
  frameQueue.length = 0;
}

afterEach(() => {
  cleanup();
  clearAnimationFrames();
  vi.useRealTimers();
});

Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get() {
    return 800;
  },
});

Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
  configurable: true,
  get() {
    return 600;
  },
});

HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 800,
    bottom: 600,
    width: 800,
    height: 600,
    toJSON() {
      return {};
    },
  } as DOMRect;
};

vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
  frameQueue.push(callback);
  const currentId = nextFrameId;
  nextFrameId += 1;
  return currentId;
});
vi.stubGlobal('cancelAnimationFrame', () => undefined);
vi.stubGlobal('PointerEvent', MouseEvent);
vi.stubGlobal(
  'ResizeObserver',
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);
