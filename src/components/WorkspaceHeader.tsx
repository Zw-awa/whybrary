import { getCopy } from '../lib/i18n';
import type { AppLocale, Space } from '../types';

type WorkspaceHeaderProps = {
  activeSpace: Space;
  isMobile: boolean;
  locale: AppLocale;
  onOpenSpaces: () => void;
};

function isWebPreview(): boolean {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
}

export function WorkspaceHeader({
  activeSpace,
  isMobile,
  locale,
  onOpenSpaces,
}: WorkspaceHeaderProps) {
  const copy = getCopy(locale);
  const openTodos = activeSpace.todos.filter((todo) => !todo.completed).length;

  return (
    <header className="workspace__header">
      <div className="workspace__title">
        <div>
          <h2>{activeSpace.name || copy.sidebar.untitledSpace}</h2>
          <p className="workspace__summary">
            <span className="summary-card">{copy.workspace.points(activeSpace.nodes.length)}</span>
            <span className="summary-card">{copy.workspace.openTasks(openTodos)}</span>
          </p>
          {isWebPreview() ? (
            <p className="workspace__subhead">{copy.workspace.webPreviewSubhead}</p>
          ) : null}
        </div>
        {isMobile ? (
          <button className="button workspace__spaces-button" onClick={onOpenSpaces} type="button">
            {copy.workspace.spacesButton}
          </button>
        ) : null}
      </div>
    </header>
  );
}
