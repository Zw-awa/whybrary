import { useEffect, useLayoutEffect, useState } from 'react';
import type { AppLocale } from '../types';

export type TutorialStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

type GuidedTutorialProps = {
  locale: AppLocale;
  onBack: () => void;
  onExit: () => void;
  onNext: () => void;
  step: TutorialStep;
};

const targets = ['spaces', 'edit-map', 'add-node', 'node', 'link-mode', 'node-delete', 'todo-add', 'todo-check'];

const messages = {
  en: [
    ['Your spaces', 'Spaces keep different topics separate. This tutorial uses its own example space.'],
    ['Edit the map', 'Select Edit Content to reveal node editing tools.'],
    ['Create a node', 'Select New Point to add a node to the map.'],
    ['Move the idea', 'Finish naming the new node, then drag it and watch connected ideas respond.'],
    ['Connect ideas', 'Enable Link Mode, then select two nodes.'],
    ['Remove a node', 'Select a node, then use the nearby Delete action or a keyboard shortcut.'],
    ['Add a next action', 'Type a short task, then select Add or use the keyboard shortcut.'],
    ['Complete the task', 'Select the task check control to finish the tutorial.'],
  ],
  zh: [
    ['认识空间', '空间可以分开不同主题。本教程会使用独立的示例空间。'],
    ['编辑脑图', '点击“编辑内容”，显示节点编辑工具。'],
    ['创建节点', '点击“新建节点”，向脑图添加一个想法。'],
    ['移动想法', '先完成新节点命名，再拖动它并观察相连节点受到牵拉。'],
    ['连接想法', '开启连线模式，然后依次选择两个节点。'],
    ['删除节点', '先选中节点，再点击节点旁的“删除”，也可以使用快捷键。'],
    ['添加下一步', '输入一条简短任务，再点击“添加”或使用快捷键。'],
    ['完成任务', '点击待办的完成按钮，结束本次教程。'],
  ],
} as const;

const shortcuts: Partial<Record<TutorialStep, { keys: string; en: string; zh: string }>> = {
  3: { keys: 'Enter', en: 'Finish naming the node', zh: '完成节点命名' },
  5: { keys: 'Backspace / Delete', en: 'Delete the selected node', zh: '删除已选节点' },
  6: { keys: 'Enter', en: 'Add the typed todo', zh: '添加已输入的待办' },
};

export function GuidedTutorial({ locale, onBack, onExit, onNext, step }: GuidedTutorialProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [revision, setRevision] = useState(0);
  const message = messages[locale][step];

  useLayoutEffect(() => {
    const update = () => {
      const linkModeActive = step === 4 && document.querySelector('[data-tour-id="link-mode"].button--accent');
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
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const padding = 8;
  const left = Math.max(0, (rect?.left ?? window.innerWidth / 2) - padding);
  const top = Math.max(0, (rect?.top ?? window.innerHeight / 2) - padding);
  const right = Math.min(window.innerWidth, (rect?.right ?? window.innerWidth / 2) + padding);
  const bottom = Math.min(window.innerHeight, (rect?.bottom ?? window.innerHeight / 2) + padding);
  const calloutBelow = bottom + 250 < window.innerHeight;
  const shortcut = shortcuts[step];
  const activateTarget = () => {
    const target = document.querySelector(`[data-tour-id="${targets[step]}"]`) as HTMLElement | null;
    target?.click();
  };

  return (
    <div className="guided-tour" role="dialog" aria-label={locale === 'zh' ? '新手教程' : 'Guided tutorial'}>
      <div className="guided-tour__shade" style={{ inset: `0 0 ${window.innerHeight - top}px 0` }} />
      <div className="guided-tour__shade" style={{ inset: `${bottom}px 0 0 0` }} />
      <div className="guided-tour__shade" style={{ inset: `${top}px ${window.innerWidth - left}px ${window.innerHeight - bottom}px 0` }} />
      <div className="guided-tour__shade" style={{ inset: `${top}px 0 ${window.innerHeight - bottom}px ${right}px` }} />
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
        <strong>{message[0]}</strong>
        <p>{message[1]}</p>
        {step > 0 ? (
          <p className="guided-tour__hint">
            {locale === 'zh'
              ? '完成高亮区域中的操作后，教程会自动继续。'
              : 'Complete the highlighted action to continue automatically.'}
          </p>
        ) : null}
        {shortcut ? (
          <div className="guided-tour__shortcut">
            <kbd>{shortcut.keys}</kbd>
            <span>{shortcut[locale]}</span>
          </div>
        ) : null}
        <div className="guided-tour__actions">
          <button disabled={step === 0} onClick={onBack} type="button">{locale === 'zh' ? '上一步' : 'Back'}</button>
          <button onClick={onExit} type="button">{locale === 'zh' ? '退出' : 'Exit'}</button>
          {step === 0 ? <button onClick={onNext} type="button">{locale === 'zh' ? '开始' : 'Start'}</button> : null}
          {step === 1 || step === 2 ? (
            <button onClick={activateTarget} type="button">
              {step === 1
                ? locale === 'zh' ? '打开编辑内容' : 'Open Editing'
                : locale === 'zh' ? '新建节点' : 'Create Node'}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
