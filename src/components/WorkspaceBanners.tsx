import { getCopy } from '../lib/i18n';
import type { AppLocale, AppSnapshot } from '../types';

type WorkspaceBannersProps = {
  bannerMessage: string | null;
  locale: AppLocale;
  persistence: {
    discardPreviewFallback: () => void;
    error: unknown;
    previewFallback: AppSnapshot | null;
    recoverPreviewFallback: () => void;
    retry: () => void;
  };
};

export function WorkspaceBanners({ bannerMessage, locale, persistence }: WorkspaceBannersProps) {
  const copy = getCopy(locale);

  return (
    <>
      {persistence.error ? (
        <div className="workspace__banner workspace__banner--error">
          <span>{copy.persistence.saveFailed}</span>
          <button className="button button--ghost" onClick={persistence.retry} type="button">
            {copy.persistence.retry}
          </button>
        </div>
      ) : null}
      {persistence.previewFallback ? (
        <div className="workspace__banner">
          <span>{copy.persistence.fallbackBody}</span>
          <button
            className="button button--ghost"
            onClick={persistence.recoverPreviewFallback}
            type="button"
          >
            {copy.persistence.recoverFallback}
          </button>
          <button
            className="button button--ghost"
            onClick={persistence.discardPreviewFallback}
            type="button"
          >
            {copy.persistence.discardFallback}
          </button>
        </div>
      ) : null}
      {bannerMessage ? <div className="workspace__banner">{bannerMessage}</div> : null}
    </>
  );
}
