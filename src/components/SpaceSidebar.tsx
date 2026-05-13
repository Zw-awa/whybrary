import type { Space, ThemeMode } from '../types';

type SpaceSidebarProps = {
  spaces: Space[];
  activeSpaceId: string | null;
  activeSpaceName: string;
  theme: ThemeMode;
  saveLabel: string;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
  onResetPreviewData: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onRenameActiveSpace: (nextName: string) => void;
  onDeleteActiveSpace: () => void;
  onToggleTheme: () => void;
};

export function SpaceSidebar({
  spaces,
  activeSpaceId,
  activeSpaceName,
  theme,
  saveLabel,
  onExportSnapshot,
  onImportSnapshot,
  onResetPreviewData,
  onSelectSpace,
  onCreateSpace,
  onRenameActiveSpace,
  onDeleteActiveSpace,
  onToggleTheme,
}: SpaceSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div>
          <h1>Whybrary</h1>
          <p className="sidebar__status-note">{saveLabel}</p>
        </div>
      </div>

      <div className="sidebar__controls">
        <button className="button button--accent" onClick={onCreateSpace} type="button">
          New Space
        </button>
        <button className="button button--ghost" onClick={onExportSnapshot} type="button">
          Export JSON
        </button>
        <button className="button button--ghost" onClick={onImportSnapshot} type="button">
          Import JSON
        </button>
        <button className="button button--ghost" onClick={onResetPreviewData} type="button">
          Reset Browser Data
        </button>
        <button className="button button--ghost" onClick={onToggleTheme} type="button">
          {theme === 'dark' ? 'Use Light Theme' : 'Use Dark Theme'}
        </button>
      </div>

      <section className="sidebar__section">
        <div className="section-heading">
          <strong>Spaces</strong>
          <span>{spaces.length}</span>
        </div>

        <div className="space-list">
          {spaces.map((space) => {
            const openCount = space.todos.filter((todo) => !todo.completed).length;

            return (
              <button
                key={space.id}
                className={`space-card ${space.id === activeSpaceId ? 'is-active' : ''}`}
                onClick={() => onSelectSpace(space.id)}
                type="button"
              >
                <strong>{space.name}</strong>
                <span>
                  {space.nodes.length} points · {openCount} open
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar__section sidebar__section--editor">
        <div className="section-heading">
          <strong>Current</strong>
          <button className="link-button" onClick={onDeleteActiveSpace} type="button">
            Delete
          </button>
        </div>

        <label className="field">
          <span>Name</span>
          <input
            className="field__input"
            onChange={(event) => onRenameActiveSpace(event.target.value)}
            placeholder="Untitled Space"
            type="text"
            value={activeSpaceName}
          />
        </label>
      </section>
    </aside>
  );
}
