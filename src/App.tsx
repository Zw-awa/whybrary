import { startTransition, useEffect, useState } from 'react';
import { AppDialog } from './components/AppDialog';
import { LanguageGate } from './components/LanguageGate';
import { SettingsDialog } from './components/SettingsDialog';
import { WorkspaceShell } from './components/WorkspaceShell';
import { useTutorialController } from './components/useTutorialController';
import { useWorkspaceCommands } from './components/useWorkspaceCommands';
import { useWorkspaceController } from './components/useWorkspaceController';
import { useWorkspacePersistence } from './components/useWorkspacePersistence';
import { useWorkspaceViewModel } from './components/useWorkspaceViewModel';
import { buildDefaultState, normalizeSnapshot } from './lib/defaults';
import { getCopy } from './lib/i18n';

export default function App() {
  const controller = useWorkspaceController(buildDefaultState);
  const commands = useWorkspaceCommands(controller);
  const tutorial = useTutorialController(controller.replaceSnapshot);
  const [hydrated, setHydrated] = useState(false);
  const [languageGateOpen, setLanguageGateOpen] = useState(false);
  const snapshot = controller.snapshot;
  const activeSpace =
    snapshot.spaces.find((space) => space.id === snapshot.activeSpaceId) ?? snapshot.spaces[0];
  const copy = getCopy(snapshot.locale);
  const persistence = useWorkspacePersistence({
    snapshot,
    onLoaded: (loaded) => {
      const normalized = normalizeSnapshot(loaded);
      startTransition(() => {
        controller.replaceSnapshot(normalized);
        setLanguageGateOpen(!normalized.hasSeenTutorial);
        setHydrated(true);
      });
    },
  });

  const viewModel = useWorkspaceViewModel({
    activeSpace: activeSpace ?? buildDefaultState(snapshot.locale).spaces[0],
    commands,
    controller,
    persistence,
    snapshot,
    tutorial,
  });

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        snapshot.theme === 'system' ? (media.matches ? 'dark' : 'light') : snapshot.theme;
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [snapshot.theme]);

  if (!hydrated || !activeSpace) {
    if (persistence.error) {
      return (
        <main className="loading-shell">
          <div className="loading-card loading-card--error">
            <p className="eyebrow">{copy.appName}</p>
            <h1>{copy.persistence.loadFailedTitle}</h1>
            <p>{copy.persistence.loadFailedBody}</p>
            <div className="loading-card__actions">
              <button className="button button--accent" onClick={persistence.retry} type="button">
                {copy.persistence.retry}
              </button>
              <button
                className="button button--ghost"
                onClick={() => {
                  const fresh = buildDefaultState(snapshot.locale);
                  controller.replaceSnapshot(fresh);
                  void persistence.startFresh(fresh);
                }}
                type="button"
              >
                {copy.persistence.startFresh}
              </button>
            </div>
          </div>
        </main>
      );
    }

    return (
      <main className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">{copy.appName}</p>
          <h1>{copy.loading.title}</h1>
          <p>{copy.loading.body}</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <WorkspaceShell model={viewModel.shellModel} />
      {languageGateOpen ? (
        <LanguageGate
          locale={snapshot.locale}
          onLocaleChange={commands.preferences.setLocale}
          onContinue={() => {
            setLanguageGateOpen(false);
            tutorial.start(controller.getSnapshot());
          }}
        />
      ) : null}
      {viewModel.settings.open ? <SettingsDialog {...viewModel.settings} /> : null}
      {viewModel.dialogState ? (
        <AppDialog
          cancelLabel={viewModel.dialogState.cancelLabel ?? copy.dialogs.cancel}
          confirmLabel={viewModel.dialogState.confirmLabel}
          message={viewModel.dialogState.message}
          onCancel={viewModel.dialogState.onCancel ?? viewModel.closeDialog}
          onConfirm={viewModel.dialogState.onConfirm}
          title={viewModel.dialogState.title}
          tone={viewModel.dialogState.tone}
          variant={viewModel.dialogState.variant}
        />
      ) : null}
    </>
  );
}
