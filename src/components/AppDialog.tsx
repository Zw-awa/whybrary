type AppDialogProps = {
  cancelLabel?: string;
  confirmLabel: string;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  tone?: 'neutral' | 'danger';
  variant?: 'confirm' | 'notice';
  title: string;
};

export function AppDialog({
  cancelLabel = 'Cancel',
  confirmLabel,
  message,
  onCancel,
  onConfirm,
  tone = 'neutral',
  variant = 'confirm',
  title,
}: AppDialogProps) {
  return (
    <div
      aria-modal="true"
      className="dialog-backdrop"
      onClick={onCancel}
      role="dialog"
    >
      <div
        className={`dialog-card dialog-card--${tone}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dialog-card__body">
          <p className="eyebrow">Whybrary</p>
          <h3>{title}</h3>
          <p>{message}</p>
        </div>

        <div className="dialog-card__actions">
          {variant === 'confirm' ? (
            <button className="button" onClick={onCancel} type="button">
              {cancelLabel}
            </button>
          ) : null}
          <button
            className={`button ${tone === 'danger' ? 'button--danger' : 'button--accent'}`}
            onClick={onConfirm}
            type="button"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
