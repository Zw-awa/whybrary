import { useCallback, useState } from 'react';
import { createSpace, nowIso } from '../lib/defaults';
import { getCopy } from '../lib/i18n';
import type { AppSnapshot, Space } from '../types';
import type { TutorialStep } from './GuidedTutorial';

export type TutorialCloseRequest = { kind: 'tutorial.close' } | null;

function createTutorialSpace(locale: AppSnapshot['locale']): Space {
  return {
    ...createSpace(getCopy(locale).tutorial.exampleSpace, locale),
    id: `tutorial-${crypto.randomUUID()}`,
  };
}

export function useTutorialController(replaceSnapshot: (snapshot: AppSnapshot) => void) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [step, setStep] = useState<TutorialStep>(0);
  const [originalSpaceId, setOriginalSpaceId] = useState<string | null>(null);
  const [tutorialSpaceId, setTutorialSpaceId] = useState<string | null>(null);
  const [closeRequest, setCloseRequest] = useState<TutorialCloseRequest>(null);

  const begin = useCallback((snapshot: AppSnapshot) => {
    const tutorialSpace = createTutorialSpace(snapshot.locale);
    setOriginalSpaceId(snapshot.activeSpaceId);
    setTutorialSpaceId(tutorialSpace.id);
    setStep(0);
    setShowTutorial(true);
    return {
      ...snapshot,
      spaces: [...snapshot.spaces, tutorialSpace],
      activeSpaceId: tutorialSpace.id,
      lastOpenedAt: nowIso(),
    };
  }, []);

  const initialize = useCallback(
    (snapshot: AppSnapshot) => {
      if (snapshot.hasSeenTutorial) {
        setShowTutorial(false);
        return snapshot;
      }
      const existing = snapshot.spaces.find((space) => space.id.startsWith('tutorial-'));
      const prepared = existing ? { ...snapshot, activeSpaceId: existing.id } : begin(snapshot);
      setOriginalSpaceId(snapshot.activeSpaceId);
      setTutorialSpaceId(existing?.id ?? prepared.activeSpaceId);
      setStep(0);
      setShowTutorial(true);
      return prepared;
    },
    [begin],
  );

  const start = useCallback(
    (snapshot: AppSnapshot) => replaceSnapshot(begin(snapshot)),
    [begin, replaceSnapshot],
  );
  const advance = useCallback(
    (expected: TutorialStep) => {
      if (!showTutorial || step !== expected) return;
      if (expected === 7) {
        setShowTutorial(false);
        setCloseRequest({ kind: 'tutorial.close' });
        return;
      }
      setStep((expected + 1) as TutorialStep);
    },
    [showTutorial, step],
  );
  const back = useCallback(
    () => setStep((current) => Math.max(0, current - 1) as TutorialStep),
    [],
  );
  const requestClose = useCallback(() => {
    setShowTutorial(false);
    setCloseRequest({ kind: 'tutorial.close' });
  }, []);
  const resolveClose = useCallback(
    (snapshot: AppSnapshot, keepExample: boolean) => {
      const spaces =
        keepExample || !tutorialSpaceId
          ? snapshot.spaces
          : snapshot.spaces.filter((space) => space.id !== tutorialSpaceId);
      const activeSpaceId =
        originalSpaceId && spaces.some((space) => space.id === originalSpaceId)
          ? originalSpaceId
          : (spaces[0]?.id ?? null);
      replaceSnapshot({
        ...snapshot,
        spaces,
        activeSpaceId,
        hasSeenTutorial: true,
        lastOpenedAt: nowIso(),
      });
      setCloseRequest(null);
      setTutorialSpaceId(null);
      setOriginalSpaceId(null);
    },
    [originalSpaceId, replaceSnapshot, tutorialSpaceId],
  );

  return {
    showTutorial,
    step,
    closeRequest,
    initialize,
    start,
    advance,
    back,
    requestClose,
    resolveClose,
  };
}
