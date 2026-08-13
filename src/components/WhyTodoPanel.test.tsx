import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      todos={makeSpace().todos}
      {...overrides}
    />,
  );
}

describe('WhyTodoPanel dock actions', () => {
  beforeEach(() => window.localStorage.clear());

  it('groups the todo input and add button into one tutorial target', () => {
    renderPanel();
    const target = document.querySelector('[data-tour-id="todo-add"]') as HTMLElement;

    expect(target.tagName).toBe('FORM');
    expect(target.querySelector('input')).toBeTruthy();
    expect(target.querySelector('button')).toBeTruthy();
  });

  it('keeps advanced planning fields hidden until enabled', async () => {
    const onTodoMetadataChange = vi.fn();
    const { rerender } = render(
      <WhyTodoPanel
        locale="en"
        onAddTodo={vi.fn()}
        onChangeTodoText={vi.fn()}
        onDeleteTodo={vi.fn()}
        onTodoMetadataChange={onTodoMetadataChange}
        onToggleTodo={vi.fn()}
        todos={makeSpace().todos}
      />,
    );
    expect(screen.queryByLabelText('Priority: open 1')).toBeNull();
    rerender(
      <WhyTodoPanel
        advancedEnabled
        locale="en"
        onAddTodo={vi.fn()}
        onChangeTodoText={vi.fn()}
        onDeleteTodo={vi.fn()}
        onTodoMetadataChange={onTodoMetadataChange}
        onToggleTodo={vi.fn()}
        todos={makeSpace().todos}
      />,
    );
    fireEvent.change(screen.getByLabelText('Priority: open 1'), { target: { value: 'high' } });
    fireEvent.change(screen.getByLabelText('Due date: open 1'), {
      target: { value: '2026-02-14' },
    });
    expect(onTodoMetadataChange).toHaveBeenCalledWith('todo-2', 'high', undefined);
    expect(onTodoMetadataChange).toHaveBeenCalledWith('todo-2', undefined, '2026-02-14');
  });

  it('minimizes and restores the floating action dock', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('button', { name: '收起快捷操作' }));
    expect(screen.queryByRole('button', { name: '顶部' })).toBeNull();
    expect(document.querySelector('.floating-actions')?.className).toContain('is-edge-right');

    await user.click(document.querySelector('.floating-actions') as HTMLDivElement);
    expect(screen.getByRole('button', { name: '顶部' })).toBeTruthy();
    expect(document.querySelector('.floating-actions')?.className).not.toContain('is-edge-peek');
  });

  it('repositions a right-edge dock inside the viewport before expanding it', async () => {
    const user = userEvent.setup();
    renderPanel();
    const dock = document.querySelector('.floating-actions') as HTMLDivElement;
    Object.defineProperty(dock, 'offsetWidth', {
      configurable: true,
      get: () => (dock.classList.contains('is-minimized') ? 46 : 112),
    });

    await user.click(screen.getByRole('button', { name: '收起快捷操作' }));
    expect(dock.style.left).toBe('742px');

    await user.click(screen.getByRole('button', { name: '展开快捷操作' }));
    expect(dock.style.left).toBe('676px');
    expect(screen.getByRole('button', { name: '顶部' })).toBeTruthy();
  });

  it('drags the minimized control, snaps it, and stores its position', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '收起快捷操作' }));
    const toggle = screen.getByRole('button', { name: '展开快捷操作' });
    const dock = toggle.closest('.floating-actions') as HTMLDivElement;

    fireEvent.pointerDown(dock, { clientX: 700, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 20, clientY: 180 });
    fireEvent.pointerUp(window, { clientX: 20, clientY: 180 });

    expect(
      JSON.parse(window.localStorage.getItem('whybrary.ui.todoDockPosition') ?? '{}'),
    ).toMatchObject({ edge: 'left' });
    expect(dock.className).toContain('is-edge-left');
    expect(screen.getByRole('button', { name: '展开快捷操作' })).toBeTruthy();
  });

  it('uses localized floating action labels', () => {
    render(
      <WhyTodoPanel
        locale="en"
        onAddTodo={vi.fn()}
        onChangeTodoText={vi.fn()}
        onDeleteTodo={vi.fn()}
        onToggleTodo={vi.fn()}
        todos={makeSpace().todos}
      />,
    );

    expect(screen.getByText('Drag')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Minimize quick actions' })).toBeTruthy();
  });

  it('keeps the minimized control floating when released away from an edge', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole('button', { name: '收起快捷操作' }));
    const dock = document.querySelector('.floating-actions') as HTMLDivElement;

    fireEvent.pointerDown(dock, { clientX: 700, clientY: 500 });
    fireEvent.pointerMove(window, { clientX: 1100, clientY: 300 });
    fireEvent.pointerUp(window, { clientX: 1100, clientY: 300 });

    expect(
      JSON.parse(window.localStorage.getItem('whybrary.ui.todoDockPosition') ?? '{}'),
    ).toMatchObject({
      edge: null,
    });
    expect(dock.className).not.toContain('is-edge-peek');
    expect(dock.className).not.toContain('is-edge-left');
    expect(dock.className).not.toContain('is-edge-right');
    expect(dock.style.left).toBe('400px');
  });

  it('requests panel expansion and restoration', async () => {
    const user = userEvent.setup();
    const onToggleExpanded = vi.fn();
    const { rerender } = render(
      <WhyTodoPanel
        locale="zh"
        onAddTodo={vi.fn()}
        onChangeTodoText={vi.fn()}
        onDeleteTodo={vi.fn()}
        onToggleExpanded={onToggleExpanded}
        onToggleTodo={vi.fn()}
        todos={makeSpace().todos}
      />,
    );

    await user.click(screen.getByRole('button', { name: '放大待办' }));
    expect(onToggleExpanded).toHaveBeenCalledOnce();
    rerender(
      <WhyTodoPanel
        isExpanded
        locale="zh"
        onAddTodo={vi.fn()}
        onChangeTodoText={vi.fn()}
        onDeleteTodo={vi.fn()}
        onToggleExpanded={onToggleExpanded}
        onToggleTodo={vi.fn()}
        todos={makeSpace().todos}
      />,
    );
    expect(screen.getByRole('button', { name: '还原布局' })).toBeTruthy();
  });

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
