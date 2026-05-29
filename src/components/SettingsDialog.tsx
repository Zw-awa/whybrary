import type { AppLocale } from '../types';
import { getCopy } from '../lib/i18n';

type SettingsDialogProps = {
  locale: AppLocale;
  onClose: () => void;
  onLocaleChange: (nextLocale: AppLocale) => void;
  onOpenTutorial: () => void;
};

export function SettingsDialog({
  locale,
  onClose,
  onLocaleChange,
  onOpenTutorial,
}: SettingsDialogProps) {
  const copy = getCopy(locale);

  return (
    <div
      aria-modal="true"
      className="dialog-backdrop"
      onClick={onClose}
      role="dialog"
    >
      <div
        className="dialog-card settings-card"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card__body settings-card__body">
          <p className="eyebrow">{copy.appName}</p>
          <div className="settings-card__header">
            <h3>{copy.settings.title}</h3>
            <button className="sidebar__close" onClick={onClose} type="button">
              {copy.settings.close}
            </button>
          </div>

          <section className="settings-card__section">
            <div>
              <strong>{copy.settings.languageTitle}</strong>
              <p>{copy.settings.languageBody}</p>
            </div>

            <div className="settings-card__locale-grid">
              <button
                className={`settings-card__locale-option ${locale === 'en' ? 'is-active' : ''}`}
                onClick={() => onLocaleChange('en')}
                type="button"
              >
                {copy.settings.languageEnglish}
              </button>
              <button
                className={`settings-card__locale-option ${locale === 'zh' ? 'is-active' : ''}`}
                onClick={() => onLocaleChange('zh')}
                type="button"
              >
                {copy.settings.languageChinese}
              </button>
            </div>
          </section>

          <section className="settings-card__section">
            <div>
              <strong>{copy.settings.tutorialTitle}</strong>
              <p>{copy.settings.tutorialBody}</p>
            </div>

            <button className="button" onClick={onOpenTutorial} type="button">
              {copy.settings.tutorialButton}
            </button>
          </section>

          <section className="settings-card__section">
            <div>
              <strong>{copy.settings.aboutTitle}</strong>
              <p>{copy.settings.aboutLead}</p>
            </div>

            <div className="settings-card__facts">
              <div className="settings-card__fact">
                <span>{copy.settings.authorLabel}</span>
                <strong>{copy.settings.authorValue}</strong>
              </div>
              <div className="settings-card__fact">
                <span>{copy.settings.githubLabel}</span>
                <a
                  className="welcome-panel__link"
                  href="https://github.com/Zw-awa/whybrary"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {copy.settings.githubValue}
                </a>
              </div>
              <div className="settings-card__fact">
                <span>{copy.settings.pricingLabel}</span>
                <strong>{copy.settings.pricingValue}</strong>
              </div>
              <div className="settings-card__fact">
                <span>{copy.settings.licenseLabel}</span>
                <strong>{copy.settings.licenseValue}</strong>
              </div>
              <div className="settings-card__fact">
                <span>{copy.settings.privacyLabel}</span>
                <strong>{copy.settings.privacyValue}</strong>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
