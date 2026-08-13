import { getCopy } from '../lib/i18n';
import type { AppLocale, MobilePrimaryView } from '../types';

type WorkspaceMobileNavigationProps = {
  isSidebarOpen: boolean;
  locale: AppLocale;
  mobileView: MobilePrimaryView;
  onOpenSpaces: () => void;
  onSelectView: (view: Exclude<MobilePrimaryView, 'spaces'>) => void;
};

export function WorkspaceMobileNavigation({
  isSidebarOpen,
  locale,
  mobileView,
  onOpenSpaces,
  onSelectView,
}: WorkspaceMobileNavigationProps) {
  const copy = getCopy(locale);

  return (
    <nav aria-label="Primary mobile navigation" className="mobile-nav">
      <button
        className={`mobile-nav__item ${mobileView === 'map' ? 'is-active' : ''}`}
        onClick={() => onSelectView('map')}
        type="button"
      >
        {copy.nav.map}
      </button>
      <button
        className={`mobile-nav__item ${mobileView === 'todo' ? 'is-active' : ''}`}
        onClick={() => onSelectView('todo')}
        type="button"
      >
        {copy.nav.todo}
      </button>
      <button
        className={`mobile-nav__item ${isSidebarOpen ? 'is-active' : ''}`}
        onClick={onOpenSpaces}
        type="button"
      >
        {copy.nav.spaces}
      </button>
    </nav>
  );
}
