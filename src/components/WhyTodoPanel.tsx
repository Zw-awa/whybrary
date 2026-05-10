import { useMemo, useRef, useState, type FormEvent } from 'react';
import type { Space } from '../types';
import { FloatingActions } from './FloatingActions';

type WhyTodoPanelProps = {
  space: Space;
  onAddTodo: (text: string) => void;
  onChangeTodoText: (todoId: string, nextText: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onToggleTodo: (todoId: string) => void;
};

export function WhyTodoPanel({
  space,
  onAddTodo,
  onChangeTodoText,
  onDeleteTodo,
  onToggleTodo,
}: WhyTodoPanelProps) {
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const openTodos = useMemo(() => space.todos.filter((todo) => !todo.completed), [space.todos]);

  const scrollToTop = () => {
    listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTodo = (todoId: string) => {
    const list = listRef.current;
    const item = itemRefs.current[todoId];
    if (!list || !item) {
      return;
    }

    list.scrollTo({
      top: Math.max(0, item.offsetTop - 14),
      behavior: 'smooth',
    });
  };

  const scrollToFirstOpen = () => {
    const first = openTodos[0];
    if (first) {
      scrollToTodo(first.id);
    }
  };

  const scrollToNextOpen = () => {
    const list = listRef.current;
    if (!list || openTodos.length === 0) {
      return;
    }

    const target = openTodos.find((todo) => {
      const element = itemRefs.current[todo.id];
      return element ? element.offsetTop > list.scrollTop + 18 : false;
    });

    scrollToTodo(target?.id ?? openTodos[0].id);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextText = draft.trim();
    if (!nextText) {
      return;
    }

    onAddTodo(nextText);
    setDraft('');
  };

  return (
    <section className="panel panel--todo">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Short and checkable</p>
          <h2>Why List</h2>
          <p className="panel__description">
            No long notes. Keep each line direct enough to act on or question later.
          </p>
        </div>

        <div className="panel__actions">
          <div className="stat-chip">
            <strong>{openTodos.length}</strong>
            <span>open</span>
          </div>
          <div className="stat-chip">
            <strong>{space.todos.length - openTodos.length}</strong>
            <span>done</span>
          </div>
        </div>
      </div>

      <form className="todo-composer" onSubmit={handleSubmit}>
        <input
          className="todo-composer__input"
          maxLength={160}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Add one short why or action..."
          type="text"
          value={draft}
        />
        <button className="button button--accent" type="submit">
          Add
        </button>
      </form>

      <div className="todo-surface">
        <div className="todo-list" ref={listRef}>
          {space.todos.map((todo) => (
            <div
              className={`todo-item ${todo.completed ? 'is-completed' : ''}`}
              key={todo.id}
              ref={(node) => {
                itemRefs.current[todo.id] = node;
              }}
            >
              <button
                aria-label={todo.completed ? 'Mark as open' : 'Mark as completed'}
                className="todo-check"
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
                  type="text"
                  value={todo.text}
                />
              </div>

              <button
                aria-label="Delete todo"
                className="todo-remove"
                onClick={() => onDeleteTodo(todo.id)}
                type="button"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <FloatingActions
          actions={[
            {
              id: 'top',
              label: '顶部',
              title: 'Back to top',
              onPress: scrollToTop,
              disabled: space.todos.length === 0,
            },
            {
              id: 'first-open',
              label: '首个未完',
              title: 'Jump to the first open todo',
              onPress: scrollToFirstOpen,
              disabled: openTodos.length === 0,
            },
            {
              id: 'next-open',
              label: '下个未完',
              title: 'Jump to the next open todo',
              onPress: scrollToNextOpen,
              disabled: openTodos.length === 0,
            },
          ]}
          containerRef={listRef}
        />
      </div>
    </section>
  );
}
