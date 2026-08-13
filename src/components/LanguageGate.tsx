import { getCopy } from '../lib/i18n';
import type { AppLocale } from '../types';

type LanguageGateProps = {
  locale: AppLocale;
  onContinue: () => void;
  onLocaleChange: (locale: AppLocale) => void;
};

export function LanguageGate({ locale, onContinue, onLocaleChange }: LanguageGateProps) {
  const copy = getCopy(locale);
  return (
    <div
      aria-modal="true"
      className="dialog-backdrop"
      role="dialog"
      aria-label={copy.onboarding.languageTitle}
    >
      <div className="dialog-card settings-card">
        <div className="dialog-card__body settings-card__body">
          <p className="eyebrow">{copy.appName}</p>
          <h3>{copy.onboarding.languageTitle}</h3>
          <p>{copy.onboarding.languageBody}</p>
          <div className="settings-card__locale-grid">
            <button
              className={
                locale === 'en'
                  ? 'settings-card__locale-option is-active'
                  : 'settings-card__locale-option'
              }
              onClick={() => onLocaleChange('en')}
              type="button"
            >
              English
            </button>
            <button
              className={
                locale === 'zh'
                  ? 'settings-card__locale-option is-active'
                  : 'settings-card__locale-option'
              }
              onClick={() => onLocaleChange('zh')}
              type="button"
            >
              简体中文
            </button>
          </div>
        </div>
        <div className="dialog-card__actions">
          <button className="button button--accent" onClick={onContinue} type="button">
            {copy.onboarding.continue}
          </button>
        </div>
      </div>
    </div>
  );
}
