import { useCallback, useReducer, useRef, useState } from 'react';
import type { AppSnapshot } from '../types';
import { workspaceReducer, type WorkspaceAction } from '../lib/workspaceReducer';

type SnapshotUpdater = AppSnapshot | ((current: AppSnapshot) => AppSnapshot);

export function useWorkspaceController(initializer: () => AppSnapshot) {
  const [snapshot, dispatch] = useReducer(workspaceReducer, undefined, initializer);
  const snapshotRef = useRef(snapshot);
  const historyRef = useRef<AppSnapshot[]>([]);
  const futureRef = useRef<AppSnapshot[]>([]);
  const [, setHistoryRevision] = useState(0);
  snapshotRef.current = snapshot;

  const dispatchAction = useCallback((action: WorkspaceAction) => {
    if (action.type !== 'snapshot.replace') {
      historyRef.current = [...historyRef.current.slice(-49), snapshotRef.current];
      futureRef.current = [];
    }
    snapshotRef.current = workspaceReducer(snapshotRef.current, action);
    dispatch(action);
    setHistoryRevision((value) => value + 1);
  }, []);

  const replaceSnapshot = useCallback((next: SnapshotUpdater) => {
    const resolved = typeof next === 'function' ? next(snapshotRef.current) : next;
    snapshotRef.current = resolved;
    dispatch({ type: 'snapshot.replace', snapshot: resolved });
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);
  const undo = useCallback(() => {
    const previous = historyRef.current.pop();
    if (!previous) return;
    futureRef.current.push(snapshotRef.current);
    snapshotRef.current = previous;
    dispatch({ type: 'snapshot.replace', snapshot: previous });
    setHistoryRevision((value) => value + 1);
  }, []);
  const redo = useCallback(() => {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(snapshotRef.current);
    snapshotRef.current = next;
    dispatch({ type: 'snapshot.replace', snapshot: next });
    setHistoryRevision((value) => value + 1);
  }, []);

  return {
    snapshot,
    dispatch: dispatchAction,
    replaceSnapshot,
    getSnapshot,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
  };
}
