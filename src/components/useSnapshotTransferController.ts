import { startTransition, useCallback } from 'react';
import type { AppDialogState } from './AppDialog';
import { buildDefaultState, nowIso } from '../lib/defaults';
import { getCopy } from '../lib/i18n';
import { clearPreviewSnapshot } from '../lib/persistence';
import {
  MAX_SNAPSHOT_FILE_BYTES,
  buildSnapshotFilename,
  parseSnapshot,
  serializeSnapshot,
} from '../lib/snapshotTransfer';
import type { AppSnapshot } from '../types';

type UseSnapshotTransferControllerArgs = {
  clearMapInteraction: () => void;
  closeDialog: () => void;
  getSnapshot: () => AppSnapshot;
  replaceSnapshot: (snapshot: AppSnapshot) => void;
  setBannerMessage: (message: string) => void;
  setDialogState: (state: AppDialogState) => void;
  startTutorial: (snapshot: AppSnapshot) => void;
};

export function useSnapshotTransferController({
  clearMapInteraction,
  closeDialog,
  getSnapshot,
  replaceSnapshot,
  setBannerMessage,
  setDialogState,
  startTutorial,
}: UseSnapshotTransferControllerArgs) {
  const snapshot = getSnapshot();
  const copy = getCopy(snapshot.locale);

  const exportSnapshot = useCallback(() => {
    const url = URL.createObjectURL(
      new Blob([serializeSnapshot(getSnapshot())], { type: 'application/json' }),
    );
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildSnapshotFilename();
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBannerMessage(copy.banners.exported);
  }, [copy.banners.exported, getSnapshot, setBannerMessage]);

  const importSnapshot = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        if (file.size > MAX_SNAPSHOT_FILE_BYTES) throw new Error('Snapshot too large');
        const imported = parseSnapshot(await file.text());
        startTransition(() => {
          replaceSnapshot({ ...imported, lastOpenedAt: nowIso() });
          clearMapInteraction();
          setBannerMessage(getCopy(imported.locale).banners.imported);
        });
      } catch (error) {
        console.warn('Failed to import snapshot JSON.', error);
        setDialogState({
          confirmLabel: copy.dialogs.close,
          message: copy.notices.importFailedMessage,
          onConfirm: closeDialog,
          title: copy.notices.importFailedTitle,
          variant: 'notice',
        });
      }
    };
    input.click();
  }, [
    clearMapInteraction,
    closeDialog,
    copy.dialogs.close,
    copy.notices.importFailedMessage,
    copy.notices.importFailedTitle,
    replaceSnapshot,
    setBannerMessage,
    setDialogState,
  ]);

  const resetPreview = useCallback(() => {
    setDialogState({
      confirmLabel: copy.dialogs.resetBrowserConfirm,
      message: copy.dialogs.resetBrowserMessage,
      onConfirm: () => {
        const fresh = buildDefaultState(getSnapshot().locale);
        clearPreviewSnapshot();
        replaceSnapshot(fresh);
        startTutorial(fresh);
        clearMapInteraction();
        setBannerMessage(getCopy(fresh.locale).banners.reset);
        closeDialog();
      },
      title: copy.dialogs.resetBrowserTitle,
      tone: 'danger',
    });
  }, [
    clearMapInteraction,
    closeDialog,
    copy.dialogs.resetBrowserConfirm,
    copy.dialogs.resetBrowserMessage,
    copy.dialogs.resetBrowserTitle,
    getSnapshot,
    replaceSnapshot,
    setBannerMessage,
    setDialogState,
    startTutorial,
  ]);

  return { exportSnapshot, importSnapshot, resetPreview };
}
