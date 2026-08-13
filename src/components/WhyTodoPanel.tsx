import { memo, useMemo, useRef, useState, type FormEvent } from 'react';
import { getCopy } from '../lib/i18n';
import type { AppLocale, TodoItem, TodoPriority } from '../types';
import { FloatingActions } from './FloatingActions';

type WhyTodoPanelProps = {
  isMobile?: boolean;
  locale: AppLocale;
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  todos: TodoItem[];
  onAddTodo: (text: string) => void;
  onChangeTodoText: (todoId: string, nextText: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onToggleTodo: (todoId: string) => void;
  advancedEnabled?: boolean;
  onTodoMetadataChange?: (todoId: string, priority?: TodoPriority, dueDate?: string | null) => void;
};

export const WhyTodoPanel = memo(function WhyTodoPanel({
  isMobile = false,
  locale,
  isExpanded = false,
  onToggleExpanded,
  todos,
  onAddTodo,
  onChangeTodoText,
  onDeleteTodo,
  onToggleTodo,
  advancedEnabled = false,
  onTodoMetadataChange,
}: WhyTodoPanelProps) {
  const copy = getCopy(locale);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const openTodos = useMemo(() => todos.filter((todo) => !todo.completed), [todos]);

  const canScrollWithinList = () => {
    const list = listRef.current;
    if (!list) {
      return false;
    }

    return list.scrollHeight > list.clientHeight + 1;
  };

  const smoothScrollElement = (element: HTMLDivElement, top: number) => {
    try {
      element.scrollTo({ top, behavior: 'smooth' });
    } catch {
      element.scrollTop = top;
    }
  };

  const scrollItemIntoView = (item: HTMLDivElement | null) => {
    if (!item) {
      return;
    }

    try {
      item.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    } catch {
      item.scrollIntoView(true);
    }
  };

  const getVisibleTop = () => {
    const list = listRef.current;
    if (!list) {
      return 18;
    }

    return Math.max(list.getBoundingClientRect().top, 0) + 18;
  };

  const scrollListToTop = () => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    if (canScrollWithinList()) {
      smoothScrollElement(list, 0);
      return;
    }

    try {
      list.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
        inline: 'nearest',
      });
    } catch {
      list.scrollIntoView(true);
    }
  };

  const submitDraft = () => {
    const nextText = draft.trim();
    if (!nextText) {
      return;
    }

    onAddTodo(nextText);
    setDraft('');
    requestAnimationFrame(() => {
      scrollListToTop();
    });
  };

  const scrollToTop = () => {
    scrollListToTop();
  };

  const scrollToTodo = (todoId: string) => {
    const item = itemRefs.current[todoId];
    scrollItemIntoView(item);
  };

  const scrollToFirstOpen = () => {
    const first = openTodos[0];
    if (first) {
      scrollToTodo(first.id);
    }
  };

  const scrollToNextOpen = () => {
    if (openTodos.length === 0) {
      return;
    }

    const visibleTop = getVisibleTop();
    const target = openTodos.find((todo) => {
      const element = itemRefs.current[todo.id];
      return element ? element.getBoundingClientRect().top > visibleTop : false;
    });

    scrollToTodo(target?.id ?? openTodos[0].id);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submitDraft();
  };

  return (
    <section className="panel panel--todo">
      <div className="panel__header">
        <h2>{copy.todo.title}</h2>
        {onToggleExpanded ? (
          <button className="button panel__expand" onClick={onToggleExpanded} type="button">
            {isExpanded ? copy.todo.restorePanel : copy.todo.expandPanel}
          </button>
        ) : null}
      </div>

      <form className="todo-composer" data-tour-id="todo-add" onSubmit={handleSubmit}>
        <input
          className="todo-composer__input"
          maxLength={160}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              submitDraft();
            }
          }}
          placeholder={copy.todo.addPlaceholder}
          type="text"
          value={draft}
        />
        <button className="button button--accent" onClick={submitDraft} type="button">
          {copy.todo.add}
        </button>
      </form>

      <div className="todo-surface">
        <div className="todo-list" ref={listRef}>
          {todos.map((todo) => (
            <div
              className={`todo-item ${todo.completed ? 'is-completed' : ''}`}
              key={todo.id}
              ref={(node) => {
                itemRefs.current[todo.id] = node;
              }}
            >
              <button
                aria-label={todo.completed ? copy.todo.markOpen : copy.todo.markCompleted}
                className="todo-check"
                data-tour-id="todo-check"
                onClick={() => onToggleTodo(todo.id)}
                type="button"
              >
                <span />
              </button>

              <div className="todo-body">
                <input
                  className="todo-body__input"
                  maxLength={160}
                  onChange={(event) => onChangeTodoText(todo.id, event.target.value)}
                  placeholder={copy.todo.emptyTask}
                  type="text"
                  value={todo.text}
                />
                {advancedEnabled ? (
                  <div className="todo-advanced-fields">
                    <label>
                      <span>{copy.advanced.priority}</span>
                      <select
                        aria-label={`${copy.advanced.priority}: ${todo.text}`}
                        onChange={(event) =>
                          onTodoMetadataChange?.(
                            todo.id,
                            (event.target.value || undefined) as TodoPriority | undefined,
                            todo.dueDate,
                          )
                        }
                        value={todo.priority ?? ''}
                      >
                        <option value="">{copy.advanced.none}</option>
                        {(['low', 'medium', 'high'] as const).map((value) => (
                          <option key={value} value={value}>
                            {copy.advanced.priorities[value]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>{copy.advanced.dueDate}</span>
                      <input
                        aria-label={`${copy.advanced.dueDate}: ${todo.text}`}
                        onChange={(event) =>
                          onTodoMetadataChange?.(todo.id, todo.priority, event.target.value || null)
                        }
                        type="date"
                        value={todo.dueDate ?? ''}
                      />
                    </label>
                  </div>
                ) : null}
              </div>

              <button
                aria-label={copy.todo.deleteTodo}
                className="todo-remove"
                onClick={() => onDeleteTodo(todo.id)}
                type="button"
              >
                {copy.todo.remove}
              </button>
            </div>
          ))}
        </div>

        <FloatingActions
          actions={[
            {
              id: 'top',
              label: copy.todo.dockTop,
              title: copy.todo.dockTopTitle,
              onPress: scrollToTop,
              disabled: todos.length === 0,
            },
            {
              id: 'first-open',
              label: copy.todo.dockFirstOpen,
              title: copy.todo.dockFirstOpenTitle,
              onPress: scrollToFirstOpen,
              disabled: openTodos.length === 0,
            },
            {
              id: 'next-open',
              label: copy.todo.dockNextOpen,
              title: copy.todo.dockNextOpenTitle,
              onPress: scrollToNextOpen,
              disabled: openTodos.length === 0,
            },
          ]}
          containerRef={listRef}
          isMobile={isMobile}
          locale={locale}
        />
      </div>
    </section>
  );
});
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
