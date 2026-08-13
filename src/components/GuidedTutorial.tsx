import { useEffect, useLayoutEffect, useState } from 'react';
import type { AppLocale } from '../types';
import { getCopy } from '../lib/i18n';

export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type GuidedTutorialProps = {
  locale: AppLocale;
  onBack: () => void;
  onExit: () => void;
  onNext: () => void;
  step: TutorialStep;
};

const targets = [
  'spaces',
  'edit-map',
  'add-node',
  'node',
  'link-mode',
  'node-delete',
  'todo-add',
  'todo-check',
];

export function GuidedTutorial({ locale, onBack, onExit, onNext, step }: GuidedTutorialProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [revision, setRevision] = useState(0);
  const tutorial = getCopy(locale).tutorial;
  const message = tutorial.steps[step];

  useLayoutEffect(() => {
    const update = () => {
      const linkModeActive =
        step === 4 && document.querySelector('[data-tour-id="link-mode"].button--accent');
      const editingInput = step === 3 ? document.querySelector('.mind-node__input') : null;
      const preferred = editingInput
        ? editingInput.closest('.mind-node')
        : linkModeActive
          ? document.querySelector('[data-tour-id="graph-shell"]')
          : document.querySelector(`[data-tour-id="${targets[step]}"]`);
      const fallback = step === 5 ? document.querySelector('[data-tour-id="graph-shell"]') : null;
      const element = (preferred ?? fallback) as HTMLElement | null;
      setRect(element?.getBoundingClientRect() ?? null);
    };

    update();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [revision, step]);

  useEffect(() => {
    const observer = new MutationObserver(() => setRevision((current) => current + 1));
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, []);

  const padding = 8;
  const left = Math.max(0, (rect?.left ?? window.innerWidth / 2) - padding);
  const top = Math.max(0, (rect?.top ?? window.innerHeight / 2) - padding);
  const right = Math.min(window.innerWidth, (rect?.right ?? window.innerWidth / 2) + padding);
  const bottom = Math.min(window.innerHeight, (rect?.bottom ?? window.innerHeight / 2) + padding);
  const calloutBelow = bottom + 250 < window.innerHeight;
  const shortcut = tutorial.shortcuts[step as 3 | 5 | 6];
  const activateTarget = () => {
    const target = document.querySelector(
      `[data-tour-id="${targets[step]}"]`,
    ) as HTMLElement | null;
    target?.click();
  };

  return (
    <div className="guided-tour" role="dialog" aria-label={tutorial.ariaLabel}>
      <div
        className="guided-tour__shade"
        style={{ inset: `0 0 ${window.innerHeight - top}px 0` }}
      />
      <div className="guided-tour__shade" style={{ inset: `${bottom}px 0 0 0` }} />
      <div
        className="guided-tour__shade"
        style={{
          inset: `${top}px ${window.innerWidth - left}px ${window.innerHeight - bottom}px 0`,
        }}
      />
      <div
        className="guided-tour__shade"
        style={{ inset: `${top}px 0 ${window.innerHeight - bottom}px ${right}px` }}
      />
      <div
        className={`guided-tour__focus ${step === 0 ? 'is-blocking' : ''}`}
        style={{ left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) }}
      />
      <section
        className="guided-tour__callout"
        style={{
          left: Math.min(Math.max(12, left), Math.max(12, window.innerWidth - 332)),
          top: calloutBelow ? bottom + 14 : Math.max(12, top - 234),
        }}
      >
        <span>{step + 1} / 8</span>
        <strong>{message.title}</strong>
        <p>{message.body}</p>
        {step > 0 ? <p className="guided-tour__hint">{tutorial.completionHint}</p> : null}
        {shortcut ? (
          <div className="guided-tour__shortcut">
            <kbd>{shortcut.keys}</kbd>
            <span>{shortcut.label}</span>
          </div>
        ) : null}
        <div className="guided-tour__actions">
          <button disabled={step === 0} onClick={onBack} type="button">
            {tutorial.back}
          </button>
          <button onClick={onExit} type="button">
            {tutorial.exit}
          </button>
          {step === 0 ? (
            <button onClick={onNext} type="button">
              {tutorial.start}
            </button>
          ) : null}
          {step === 1 || step === 2 ? (
            <button onClick={activateTarget} type="button">
              {step === 1 ? tutorial.openEditing : tutorial.createNode}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
