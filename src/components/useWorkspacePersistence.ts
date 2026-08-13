import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeSnapshot } from '../lib/defaults';
import {
  applyMutationBatch,
  clearPreviewSnapshot,
  loadWorkspace,
  PersistenceError,
  replaceWorkspace,
} from '../lib/persistence';
import { diffSnapshots, type LoadedWorkspace } from '../lib/workspaceChanges';
import type { AppSnapshot } from '../types';

export type WorkspaceSaveStatus = 'loading' | 'saved' | 'saving' | 'error';

type UseWorkspacePersistenceArgs = {
  snapshot: AppSnapshot;
  onLoaded: (snapshot: AppSnapshot) => void;
};

const sameSnapshot = (left: AppSnapshot | null, right: AppSnapshot) =>
  left !== null && JSON.stringify(left) === JSON.stringify(right);

export function useWorkspacePersistence({ snapshot, onLoaded }: UseWorkspacePersistenceArgs) {
  const [status, setStatus] = useState<WorkspaceSaveStatus>('loading');
  const [error, setError] = useState<PersistenceError | null>(null);
  const [previewFallback, setPreviewFallback] = useState<AppSnapshot | null>(null);
  const acknowledgedRef = useRef<AppSnapshot | null>(null);
  const desiredRef = useRef(snapshot);
  const revisionRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);
  const statusRef = useRef<WorkspaceSaveStatus>('loading');
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;
  desiredRef.current = snapshot;

  const setStatusValue = (next: WorkspaceSaveStatus) => {
    statusRef.current = next;
    setStatus(next);
  };

  const load = useCallback(async () => {
    setStatusValue('loading');
    setError(null);
    try {
      const loaded: LoadedWorkspace & { previewFallback?: AppSnapshot } = await loadWorkspace();
      const normalized = normalizeSnapshot(loaded.snapshot);
      acknowledgedRef.current = normalized;
      desiredRef.current = normalized;
      revisionRef.current = loaded.revision;
      const candidate = loaded.previewFallback ? normalizeSnapshot(loaded.previewFallback) : null;
      setPreviewFallback(candidate && !sameSnapshot(normalized, candidate) ? candidate : null);
      onLoadedRef.current(normalized);
      setStatusValue('saved');
    } catch (cause) {
      const persistenceError =
        cause instanceof PersistenceError
          ? cause
          : new PersistenceError('load_failed', 'Unable to load workspace data.', { cause });
      setError(persistenceError);
      setStatusValue('error');
    }
  }, []);

  const save = useCallback(async () => {
    if (inFlightRef.current || statusRef.current === 'loading' || statusRef.current === 'error') {
      return;
    }

    const acknowledged = acknowledgedRef.current;
    const target = desiredRef.current;
    if (!acknowledged || sameSnapshot(acknowledged, target)) {
      return;
    }

    const mutations = diffSnapshots(acknowledged, target);
    if (mutations.length === 0) {
      acknowledgedRef.current = target;
      return;
    }

    inFlightRef.current = true;
    setStatusValue('saving');
    const batch = {
      expectedRevision: revisionRef.current,
      nextRevision: revisionRef.current + 1,
      mutations,
    };

    try {
      const revision = await applyMutationBatch(batch, target);
      acknowledgedRef.current = target;
      revisionRef.current = revision;
      setStatusValue('saved');
      setError(null);
    } catch (cause) {
      const persistenceError =
        cause instanceof PersistenceError
          ? cause
          : new PersistenceError('save_failed', 'Unable to save workspace data.', { cause });
      setError(persistenceError);
      setStatusValue('error');
    } finally {
      inFlightRef.current = false;
      if (
        statusRef.current === 'saved' &&
        !sameSnapshot(acknowledgedRef.current, desiredRef.current)
      ) {
        void save();
      }
    }
  }, []);

  const scheduleSave = useCallback(
    (delay = 420) => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        void save();
      }, delay);
    },
    [save],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (statusRef.current !== 'saved' || sameSnapshot(acknowledgedRef.current, snapshot)) {
      return;
    }
    scheduleSave();
  }, [scheduleSave, snapshot]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const retry = useCallback(() => {
    if (acknowledgedRef.current === null) {
      void load();
      return;
    }
    setError(null);
    setStatusValue('saved');
    void save();
  }, [load, save]);

  const recoverPreviewFallback = useCallback(async () => {
    if (!previewFallback) return;
    setStatusValue('saving');
    setError(null);
    try {
      const revision = await replaceWorkspace(previewFallback, revisionRef.current + 1);
      revisionRef.current = revision;
      acknowledgedRef.current = previewFallback;
      desiredRef.current = previewFallback;
      clearPreviewSnapshot();
      setPreviewFallback(null);
      onLoadedRef.current(previewFallback);
      setStatusValue('saved');
    } catch (cause) {
      const persistenceError =
        cause instanceof PersistenceError
          ? cause
          : new PersistenceError('save_failed', 'Unable to recover browser fallback data.', {
              cause,
            });
      setError(persistenceError);
      setStatusValue('error');
    }
  }, [previewFallback]);

  const discardPreviewFallback = useCallback(() => {
    clearPreviewSnapshot();
    setPreviewFallback(null);
  }, []);

  const startFresh = useCallback(async (freshSnapshot: AppSnapshot) => {
    setStatusValue('saving');
    setError(null);
    try {
      const revision = await replaceWorkspace(freshSnapshot, revisionRef.current + 1);
      revisionRef.current = revision;
      acknowledgedRef.current = freshSnapshot;
      desiredRef.current = freshSnapshot;
      clearPreviewSnapshot();
      setPreviewFallback(null);
      onLoadedRef.current(freshSnapshot);
      setStatusValue('saved');
    } catch (cause) {
      const persistenceError =
        cause instanceof PersistenceError
          ? cause
          : new PersistenceError('save_failed', 'Unable to create a fresh workspace.', { cause });
      setError(persistenceError);
      setStatusValue('error');
    }
  }, []);

  return {
    error,
    previewFallback,
    retry,
    recoverPreviewFallback,
    discardPreviewFallback,
    startFresh,
    status,
  };
}
