import { useMemo, useRef, useState, type FormEvent } from 'react';
import { getCopy } from '../lib/i18n';
import type { AppLocale, Space } from '../types';
import { FloatingActions } from './FloatingActions';

type WhyTodoPanelProps = {
  isMobile?: boolean;
  locale: AppLocale;
  space: Space;
  onAddTodo: (text: string) => void;
  onChangeTodoText: (todoId: string, nextText: string) => void;
  onDeleteTodo: (todoId: string) => void;
  onToggleTodo: (todoId: string) => void;
};

export function WhyTodoPanel({
  isMobile = false,
  locale,
  space,
  onAddTodo,
  onChangeTodoText,
  onDeleteTodo,
  onToggleTodo,
}: WhyTodoPanelProps) {
  const copy = getCopy(locale);
  const [draft, setDraft] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const openTodos = useMemo(() => space.todos.filter((todo) => !todo.completed), [space.todos]);

  const submitDraft = () => {
    const nextText = draft.trim();
    if (!nextText) {
      return;
    }

    onAddTodo(nextText);
    setDraft('');
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

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
    submitDraft();
  };

  return (
    <section className="panel panel--todo">
      <div className="panel__header">
        <h2>{copy.todo.title}</h2>
      </div>

      <form className="todo-composer" onSubmit={handleSubmit}>
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
          {space.todos.map((todo) => (
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
              disabled: space.todos.length === 0,
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
}
