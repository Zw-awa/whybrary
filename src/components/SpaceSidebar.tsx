import type { Space, ThemeMode } from '../types';

type SpaceSidebarProps = {
  spaces: Space[];
  activeSpaceId: string | null;
  activeSpaceName: string;
  theme: ThemeMode;
  saveLabel: string;
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
  onSelectSpace,
  onCreateSpace,
  onRenameActiveSpace,
  onDeleteActiveSpace,
  onToggleTheme,
}: SpaceSidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="brand-mark">W</div>
        <div>
          <p className="eyebrow">Local-first desktop</p>
          <h1>Whybrary</h1>
        </div>
      </div>

      <div className="sidebar__status">
        <span className="status-pill">No network</span>
        <span className="status-pill">{saveLabel}</span>
      </div>

      <div className="sidebar__controls">
        <button className="button button--accent" onClick={onCreateSpace} type="button">
          New Space
        </button>
        <button className="button button--ghost" onClick={onToggleTheme} type="button">
          {theme === 'dark' ? 'Use Light Theme' : 'Use Dark Theme'}
        </button>
      </div>

      <section className="sidebar__section">
        <div className="section-heading">
          <p className="eyebrow">Independent spaces</p>
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
                  {space.nodes.length} neurons · {openCount} open
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar__section sidebar__section--editor">
        <div className="section-heading">
          <p className="eyebrow">Current space</p>
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

        <p className="sidebar__note">
          Each space keeps its own graph, list, and viewport. This makes room for a later 3D renderer
          without changing the storage model.
        </p>
      </section>
    </aside>
  );
}
