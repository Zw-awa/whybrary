import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WhyTodoPanel } from './WhyTodoPanel';
import type { Space } from '../types';

function makeSpace(): Space {
  return {
    id: 'space-1',
    name: 'Test Space',
    nodes: [],
    edges: [],
    todos: [
      {
        id: 'todo-1',
        text: 'done',
        completed: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'todo-2',
        text: 'open 1',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'todo-3',
        text: 'open 2',
        completed: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function renderPanel(overrides?: Partial<React.ComponentProps<typeof WhyTodoPanel>>) {
  render(
    <WhyTodoPanel
      locale="zh"
      onAddTodo={vi.fn()}
      onChangeTodoText={vi.fn()}
      onDeleteTodo={vi.fn()}
      onToggleTodo={vi.fn()}
      space={makeSpace()}
      {...overrides}
    />,
  );
}

describe('WhyTodoPanel dock actions', () => {
  it('scrolls the internal todo list when the list itself is scrollable', async () => {
    const user = userEvent.setup();
    const scrollToSpy = vi.fn();

    renderPanel();

    const list = document.querySelector('.todo-list') as HTMLDivElement;
    Object.defineProperty(list, 'clientHeight', {
      configurable: true,
      value: 300,
    });
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(list, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 240,
    });
    list.scrollTo = scrollToSpy;

    await user.click(screen.getByRole('button', { name: '顶部' }));

    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('falls back to item scrollIntoView when the page is the real scroll container', async () => {
    const user = userEvent.setup();

    renderPanel({ isMobile: true });

    const list = document.querySelector('.todo-list') as HTMLDivElement;
    Object.defineProperty(list, 'clientHeight', {
      configurable: true,
      value: 600,
    });
    Object.defineProperty(list, 'scrollHeight', {
      configurable: true,
      value: 600,
    });

    const items = Array.from(document.querySelectorAll('.todo-item')) as HTMLDivElement[];
    const scrollIntoViewSpies = items.map(() => vi.fn());
    let simulatedPageOffset = 0;
    items.forEach((item, index) => {
      item.scrollIntoView = vi.fn((options?: ScrollIntoViewOptions | boolean) => {
        scrollIntoViewSpies[index](options);
        if (index === 1) {
          simulatedPageOffset = 70;
        }

        if (index === 2) {
          simulatedPageOffset = 250;
        }
      });
    });

    const makeRect = (absoluteTop: number) =>
      ({
        top: absoluteTop - simulatedPageOffset,
        left: 0,
        right: 100,
        bottom: absoluteTop - simulatedPageOffset + 40,
        width: 100,
        height: 40,
        x: 0,
        y: absoluteTop - simulatedPageOffset,
        toJSON() {
          return {};
        },
      }) as DOMRect;

    items[0].getBoundingClientRect = () => makeRect(20);
    items[1].getBoundingClientRect = () => makeRect(80);
    items[2].getBoundingClientRect = () => makeRect(260);

    await user.click(screen.getByRole('button', { name: '首个未完' }));
    expect(scrollIntoViewSpies[1]).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });

    await user.click(screen.getByRole('button', { name: '下个未完' }));
    expect(scrollIntoViewSpies[2]).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'start',
      inline: 'nearest',
    });
  });
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
