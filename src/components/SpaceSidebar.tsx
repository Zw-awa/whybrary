import { type AppLocale, type Space, type ThemeMode } from '../types';
import { getCopy } from '../lib/i18n';

type SpaceSidebarProps = {
  spaces: Space[];
  activeSpaceId: string | null;
  activeSpaceName: string;
  drawerTitle?: string;
  isDrawer?: boolean;
  locale: AppLocale;
  theme: ThemeMode;
  saveLabel: string;
  onClose?: () => void;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
  onResetPreviewData: () => void;
  onOpenSettings: () => void;
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
  drawerTitle = 'Spaces',
  isDrawer = false,
  locale,
  theme,
  saveLabel,
  onClose,
  onExportSnapshot,
  onImportSnapshot,
  onResetPreviewData,
  onOpenSettings,
  onSelectSpace,
  onCreateSpace,
  onRenameActiveSpace,
  onDeleteActiveSpace,
  onToggleTheme,
}: SpaceSidebarProps) {
  const copy = getCopy(locale);

  return (
    <aside className={`sidebar ${isDrawer ? 'sidebar--drawer' : ''}`}>
      <div className="sidebar__brand">
        <div>
          <p className="eyebrow">{drawerTitle}</p>
          <h1>{copy.appName}</h1>
          <p className="sidebar__status-note">{saveLabel}</p>
        </div>
        {onClose ? (
          <button
            aria-label={copy.sidebar.closeSpaces}
            className="sidebar__close"
            onClick={onClose}
            type="button"
          >
            {copy.settings.close}
          </button>
        ) : null}
      </div>

      <div className="sidebar__controls">
        <button className="button button--accent" onClick={onCreateSpace} type="button">
          {copy.sidebar.newSpace}
        </button>
        <button className="button button--ghost" onClick={onExportSnapshot} type="button">
          {copy.sidebar.exportJson}
        </button>
        <button className="button button--ghost" onClick={onImportSnapshot} type="button">
          {copy.sidebar.importJson}
        </button>
        <button className="button button--ghost" onClick={onResetPreviewData} type="button">
          {copy.sidebar.resetBrowserData}
        </button>
        <button className="button button--ghost" onClick={onOpenSettings} type="button">
          {copy.sidebar.settings}
        </button>
        <button className="button button--ghost" onClick={onToggleTheme} type="button">
          {theme === 'dark' ? copy.sidebar.useLightTheme : copy.sidebar.useDarkTheme}
        </button>
      </div>

      <section className="sidebar__section sidebar__section--spaces">
        <div className="section-heading">
          <strong>{copy.sidebar.spaces}</strong>
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
                <span>{copy.sidebar.pointsOpen(space.nodes.length, openCount)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="sidebar__section sidebar__section--editor">
        <div className="section-heading">
          <strong>{copy.sidebar.current}</strong>
          <button className="link-button" onClick={onDeleteActiveSpace} type="button">
            {copy.sidebar.delete}
          </button>
        </div>

        <label className="field">
          <span>{copy.sidebar.name}</span>
          <input
            className="field__input"
            onChange={(event) => onRenameActiveSpace(event.target.value)}
            placeholder={copy.sidebar.untitledSpace}
            type="text"
            value={activeSpaceName}
          />
        </label>
      </section>
    </aside>
  );
}
