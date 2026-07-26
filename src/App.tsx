import { startTransition, useEffect, useState } from 'react';
import { AppDialog } from './components/AppDialog';
import { BrainCanvas } from './components/BrainCanvas';
import { GuidedTutorial, type TutorialStep } from './components/GuidedTutorial';
import { SettingsDialog } from './components/SettingsDialog';
import { SpaceSidebar } from './components/SpaceSidebar';
import { WhyTodoPanel } from './components/WhyTodoPanel';
import {
  buildDefaultState,
  createNeuronNode,
  createSpace,
  normalizeSnapshot,
  nowIso,
} from './lib/defaults';
import { clearPreviewSnapshot, loadSnapshot, saveSnapshot } from './lib/persistence';
import { getCopy } from './lib/i18n';
import {
  MAX_SNAPSHOT_FILE_BYTES,
  buildSnapshotFilename,
  parseSnapshot,
  serializeSnapshot,
} from './lib/snapshotTransfer';
import type {
  AppLocale,
  AppSnapshot,
  BrainNode,
  DeviceLayoutMode,
  MobilePrimaryView,
  Space,
} from './types';

type AppDialogState =
  | null
  | {
      cancelLabel?: string;
      confirmLabel: string;
      message: string;
      onCancel?: () => void;
      onConfirm: () => void;
      title: string;
      tone?: 'neutral' | 'danger';
      variant?: 'confirm' | 'notice';
    };

function saveStatusLabel(
  status: 'booting' | 'saving' | 'saved' | 'error',
  locale: AppLocale,
): string {
  const copy = getCopy(locale);

  switch (status) {
    case 'booting':
      return copy.status.booting;
    case 'saving':
      return copy.status.saving;
    case 'saved':
      return copy.status.saved;
    case 'error':
      return copy.status.error;
    default:
      return copy.status.saved;
  }
}

function isWebPreview(): boolean {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
}

function getLayoutMode(width: number): DeviceLayoutMode {
  if (width <= 760) {
    return 'phone';
  }

  if (width < 900) {
    return 'tablet';
  }

  return 'desktop';
}

function createTutorialSpace(locale: AppLocale): Space {
  return {
    ...createSpace(locale === 'zh' ? '教程示例' : 'Tutorial Example', locale),
    id: `tutorial-${crypto.randomUUID()}`,
  };
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => buildDefaultState());
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'booting' | 'saving' | 'saved' | 'error'>('booting');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isMapEditing, setIsMapEditing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<DeviceLayoutMode>(() =>
    typeof window === 'undefined' ? 'desktop' : getLayoutMode(window.innerWidth),
  );
  const [mobileView, setMobileView] = useState<MobilePrimaryView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dialogState, setDialogState] = useState<AppDialogState>(null);
  const [expandedPanel, setExpandedPanel] = useState<'todo' | 'map' | null>(null);
  const [isMapInfoOpen, setIsMapInfoOpen] = useState(false);
  const [infoPortalTarget, setInfoPortalTarget] = useState<HTMLElement | null>(null);
  const [expandedInfoPortalTarget, setExpandedInfoPortalTarget] = useState<HTMLElement | null>(null);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>(0);
  const [tutorialOriginalSpaceId, setTutorialOriginalSpaceId] = useState<string | null>(null);
  const [tutorialSpaceId, setTutorialSpaceId] = useState<string | null>(null);
  const isMobile = layoutMode === 'phone';
  const copy = getCopy(snapshot.locale);

  const activeSpace =
    snapshot.spaces.find((space) => space.id === snapshot.activeSpaceId) ?? snapshot.spaces[0];

  useEffect(() => {
    const handleResize = () => {
      setLayoutMode(getLayoutMode(window.innerWidth));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!editingNodeId || !activeSpace) {
      return;
    }

    const stillExists = activeSpace.nodes.some((node) => node.id === editingNodeId);
    if (!stillExists) {
      setEditingNodeId(null);
    }
  }, [activeSpace, editingNodeId]);

  useEffect(() => {
    if (!isMobile) {
      setIsSidebarOpen(false);
    }
  }, [isMobile]);

  useEffect(() => {
    if (mobileView === 'spaces' && !isMobile) {
      setMobileView('map');
    }
  }, [isMobile, mobileView]);

  useEffect(() => {
    if (showTutorial && isMobile) {
      setMobileView(tutorialStep >= 6 ? 'todo' : 'map');
    }
  }, [isMobile, showTutorial, tutorialStep]);

  useEffect(() => {
    let cancelled = false;

    loadSnapshot()
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        const normalized = normalizeSnapshot(loaded);
        const shouldStartTutorial = !normalized.hasSeenTutorial;
        const existingTutorialSpace = normalized.spaces.find((space) => space.id.startsWith('tutorial-'));
        const tutorialSpace = shouldStartTutorial ? existingTutorialSpace ?? createTutorialSpace(normalized.locale) : null;
        startTransition(() => {
          setSnapshot(tutorialSpace ? {
            ...normalized,
            spaces: existingTutorialSpace ? normalized.spaces : [...normalized.spaces, tutorialSpace],
            activeSpaceId: tutorialSpace.id,
          } : normalized);
          setHydrated(true);
          setSaveStatus('saved');
          setTutorialOriginalSpaceId(normalized.activeSpaceId);
          setTutorialSpaceId(tutorialSpace?.id ?? null);
          setTutorialStep(0);
          setShowTutorial(shouldStartTutorial);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const fallback = buildDefaultState();
        const tutorialSpace = createTutorialSpace(fallback.locale);
        startTransition(() => {
          setSnapshot({
            ...fallback,
            spaces: [...fallback.spaces, tutorialSpace],
            activeSpaceId: tutorialSpace.id,
          });
          setHydrated(true);
          setSaveStatus('error');
          setTutorialOriginalSpaceId(fallback.activeSpaceId);
          setTutorialSpaceId(tutorialSpace.id);
          setTutorialStep(0);
          setShowTutorial(true);
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = snapshot.theme;
  }, [snapshot.theme]);

  useEffect(() => {
    if (!bannerMessage) {
      return;
    }

    const timer = window.setTimeout(() => setBannerMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }

    setSaveStatus('saving');

    const timer = window.setTimeout(async () => {
      try {
        await saveSnapshot(snapshot);
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, 420);

    return () => window.clearTimeout(timer);
  }, [hydrated, snapshot]);

  const updateSnapshot = (updater: (current: AppSnapshot) => AppSnapshot) => {
    setSnapshot((current) => ({
      ...updater(current),
      lastOpenedAt: nowIso(),
    }));
  };

  const updateActiveSpace = (updater: (space: Space) => Space) => {
    updateSnapshot((current) => ({
      ...current,
      spaces: current.spaces.map((space) =>
        space.id === current.activeSpaceId
          ? {
              ...updater(space),
              updatedAt: nowIso(),
            }
          : space,
      ),
    }));
  };

  const closeDialog = () => {
    setDialogState(null);
  };

  const markTutorialSeen = () => {
    setSnapshot((current) =>
      current.hasSeenTutorial
        ? current
        : {
            ...current,
            hasSeenTutorial: true,
            lastOpenedAt: nowIso(),
          },
    );
  };

  const openTutorial = () => {
    const tutorialSpace = createTutorialSpace(snapshot.locale);
    setTutorialOriginalSpaceId(snapshot.activeSpaceId);
    setTutorialSpaceId(tutorialSpace.id);
    setTutorialStep(0);
    updateSnapshot((current) => ({
      ...current,
      spaces: [...current.spaces, tutorialSpace],
      activeSpaceId: tutorialSpace.id,
    }));
    setShowTutorial(true);
    setIsSettingsOpen(false);
    setIsSidebarOpen(false);
  };

  const completeTutorial = (keepExample: boolean) => {
    setShowTutorial(false);
    setDialogState(null);
    setIsMapEditing(false);
    setEditingNodeId(null);
    updateSnapshot((current) => {
      const spaces = keepExample || !tutorialSpaceId
        ? current.spaces
        : current.spaces.filter((space) => space.id !== tutorialSpaceId);
      const originalExists = tutorialOriginalSpaceId
        ? spaces.some((space) => space.id === tutorialOriginalSpaceId)
        : false;
      return {
        ...current,
        hasSeenTutorial: true,
        spaces,
        activeSpaceId: originalExists ? tutorialOriginalSpaceId : spaces[0]?.id ?? null,
      };
    });
    setTutorialOriginalSpaceId(null);
    setTutorialSpaceId(null);
  };

  const closeTutorial = () => {
    setShowTutorial(false);
    setDialogState({
      cancelLabel: snapshot.locale === 'zh' ? '删除示例' : 'Delete Example',
      confirmLabel: snapshot.locale === 'zh' ? '保留示例' : 'Keep Example',
      message: snapshot.locale === 'zh'
        ? '是否保留教程中创建的示例空间？'
        : 'Would you like to keep the example space created by the tutorial?',
      onCancel: () => completeTutorial(false),
      onConfirm: () => completeTutorial(true),
      title: snapshot.locale === 'zh' ? '结束教程' : 'Finish Tutorial',
    });
  };

  const advanceTutorial = (expected: TutorialStep) => {
    if (!showTutorial || tutorialStep !== expected) {
      return;
    }
    if (expected === 7) {
      closeTutorial();
      return;
    }
    setTutorialStep((expected + 1) as TutorialStep);
  };

  const showNotice = (title: string, message: string) => {
    setDialogState({
      confirmLabel: copy.dialogs.close,
      message,
      onConfirm: () => setDialogState(null),
      title,
      variant: 'notice',
    });
  };

  const handleLocaleChange = (nextLocale: AppLocale) => {
    updateSnapshot((current) => ({
      ...current,
      locale: nextLocale,
    }));
  };

  const handleToggleTheme = () => {
    updateSnapshot((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleExportSnapshot = () => {
    setShowTutorial(false);
    const blob = new Blob([serializeSnapshot(snapshot)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildSnapshotFilename();
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setBannerMessage(copy.banners.exported);
  };

  const handleImportSnapshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }

      try {
        if (file.size > MAX_SNAPSHOT_FILE_BYTES) {
          throw new Error('Snapshot JSON exceeds the maximum supported size.');
        }

        const raw = await file.text();
        const imported = parseSnapshot(raw);

        startTransition(() => {
          setEditingNodeId(null);
          setIsMapEditing(false);
          setShowTutorial(false);
          setSnapshot({
            ...imported,
            lastOpenedAt: nowIso(),
          });
          setHydrated(true);
          setSaveStatus('saved');
          setBannerMessage(getCopy(imported.locale).banners.imported);
          setIsSidebarOpen(false);
        });
      } catch (error) {
        console.warn('Failed to import snapshot JSON.', error);
        showNotice(copy.notices.importFailedTitle, copy.notices.importFailedMessage);
      }
    };

    input.click();
  };

  const handleResetPreviewData = () => {
    setDialogState({
      confirmLabel: copy.dialogs.resetBrowserConfirm,
      message: copy.dialogs.resetBrowserMessage,
      onConfirm: () => {
        const fallback = buildDefaultState(snapshot.locale);
        const tutorialSpace = createTutorialSpace(fallback.locale);
        clearPreviewSnapshot();
        setEditingNodeId(null);
        setIsMapEditing(false);
        setTutorialOriginalSpaceId(fallback.activeSpaceId);
        setTutorialSpaceId(tutorialSpace.id);
        setTutorialStep(0);
        setShowTutorial(true);
        setSnapshot({
          ...fallback,
          spaces: [...fallback.spaces, tutorialSpace],
          activeSpaceId: tutorialSpace.id,
        });
        setHydrated(true);
        setSaveStatus('saved');
        setBannerMessage(getCopy(fallback.locale).banners.reset);
        setDialogState(null);
        setIsSidebarOpen(false);
        setMobileView('map');
      },
      title: copy.dialogs.resetBrowserTitle,
      tone: 'danger',
    });
  };

  const handleSelectSpace = (spaceId: string) => {
    setIsMapEditing(false);
    setEditingNodeId(null);
    updateSnapshot((current) => ({
      ...current,
      activeSpaceId: spaceId,
    }));
    if (isMobile) {
      setMobileView('map');
      setIsSidebarOpen(false);
    }
  };

  const handleCreateSpace = () => {
    setIsMapEditing(false);
    setEditingNodeId(null);
    setShowTutorial(false);
    markTutorialSeen();
    updateSnapshot((current) => {
      const nextSpace = createSpace(
        current.locale === 'zh' ? `空间 ${current.spaces.length + 1}` : `Space ${current.spaces.length + 1}`,
        current.locale,
      );

      return {
        ...current,
        spaces: [...current.spaces, nextSpace],
        activeSpaceId: nextSpace.id,
      };
    });
    if (isMobile) {
      setMobileView('map');
    }
  };

  const handleRenameActiveSpace = (nextName: string) => {
    updateActiveSpace((space) => ({
      ...space,
      name: nextName,
    }));
  };

  const handleDeleteActiveSpace = () => {
    if (!activeSpace) {
      return;
    }

    setDialogState({
      confirmLabel: copy.dialogs.deleteSpaceConfirm,
      message: copy.dialogs.deleteSpaceMessage(activeSpace.name || copy.sidebar.untitledSpace),
      onConfirm: () => {
        setEditingNodeId(null);
        setIsMapEditing(false);
        updateSnapshot((current) => {
          const remaining = current.spaces.filter((space) => space.id !== current.activeSpaceId);
          if (remaining.length === 0) {
            const replacement = createSpace(
              current.locale === 'zh' ? '我的第一个空间' : 'My First Space',
              current.locale,
            );

            return {
              ...current,
              spaces: [replacement],
              activeSpaceId: replacement.id,
            };
          }

          return {
            ...current,
            spaces: remaining,
            activeSpaceId: remaining[0].id,
          };
        });
        setDialogState(null);
        if (isMobile) {
          setMobileView('map');
        }
      },
      title: copy.dialogs.deleteSpaceTitle,
      tone: 'danger',
    });
  };

  const handlePersistNodePositions = (nextNodes: BrainNode[]) => {
    updateActiveSpace((space) => ({
      ...space,
      nodes: space.nodes.map((node) => {
        const match = nextNodes.find((item) => item.id === node.id);
        if (!match) {
          return node;
        }

        return {
          ...node,
          position: match.position,
        };
      }),
    }));
    advanceTutorial(3);
  };

  const handleViewportChange = (viewport: Space['viewport']) => {
    updateActiveSpace((space) => ({
      ...space,
      viewport,
    }));
  };

  const handleToggleConnection = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) {
      return;
    }

    updateActiveSpace((space) => ({
      ...space,
      edges: (() => {
        const existing = space.edges.find(
          (edge) =>
            (edge.source === sourceId && edge.target === targetId) ||
            (edge.source === targetId && edge.target === sourceId),
        );

        if (existing) {
          return space.edges.filter((edge) => edge.id !== existing.id);
        }

        return [
          ...space.edges,
          {
            id: crypto.randomUUID(),
            source: sourceId,
            target: targetId,
          },
        ];
      })(),
    }));
    advanceTutorial(4);
  };

  const commitDeleteNodes = (nodeIds: string[]) => {
    if (!activeSpace) {
      return;
    }

    const deleteSet = new Set(nodeIds);
    if (deleteSet.size === 0) {
      return;
    }

    setEditingNodeId((current) => (current && deleteSet.has(current) ? null : current));
    updateActiveSpace((space) => ({
      ...space,
      nodes: space.nodes.filter((node) => !deleteSet.has(node.id)),
      edges: space.edges.filter(
        (edge) => !deleteSet.has(edge.source) && !deleteSet.has(edge.target),
      ),
    }));
    advanceTutorial(5);
  };

  const handleDeleteNodes = (nodeIds: string[]) => {
    commitDeleteNodes(nodeIds);
  };

  const handleRequestDeleteNodes = (nodeIds: string[], labels: string[]) => {
    const preview = labels.slice(0, 3).join(', ');
    const suffix =
      nodeIds.length > 3
        ? snapshot.locale === 'zh'
          ? `，以及另外 ${nodeIds.length - 3} 个`
          : ` and ${nodeIds.length - 3} more`
        : '';

    setDialogState({
      confirmLabel:
        nodeIds.length > 1 ? copy.dialogs.deleteNodesConfirmMultiple : copy.dialogs.deleteNodesConfirmSingle,
      message: copy.dialogs.deleteNodesMessage(nodeIds.length, preview, suffix),
      onConfirm: () => {
        commitDeleteNodes(nodeIds);
        setDialogState(null);
      },
      title: copy.dialogs.deleteNodesTitle,
      tone: 'danger',
    });
  };

  const handleAddNeuron = (position?: BrainNode['position']) => {
    const nextNode = createNeuronNode('', position?.x ?? 220, position?.y ?? 180);
    setIsMapEditing(true);
    setEditingNodeId(nextNode.id);

    updateActiveSpace((space) => ({
      ...space,
      nodes: [...space.nodes, nextNode],
    }));
    advanceTutorial(2);

    if (isMobile) {
      setMobileView('map');
    }

    return nextNode;
  };

  const handleNodeLabelChange = (nodeId: string, nextLabel: string) => {
    updateActiveSpace((space) => ({
      ...space,
      nodes: space.nodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                label: nextLabel,
              },
            }
          : node,
      ),
    }));
  };

  const handleStartRenameNode = (nodeId: string) => {
    setEditingNodeId(nodeId);
  };

  const handleFinishRenameNode = () => {
    setEditingNodeId(null);
  };

  const handleAddTodo = (text: string) => {
    if (!text.trim()) {
      return;
    }

    updateActiveSpace((space) => ({
      ...space,
      todos: [
        {
          id: crypto.randomUUID(),
          text,
          completed: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
        ...space.todos,
      ],
    }));
    advanceTutorial(6);
  };

  const handleChangeTodoText = (todoId: string, nextText: string) => {
    updateActiveSpace((space) => ({
      ...space,
      todos: space.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              text: nextText,
              updatedAt: nowIso(),
            }
          : todo,
      ),
    }));
  };

  const handleToggleTodo = (todoId: string) => {
    updateActiveSpace((space) => ({
      ...space,
      todos: space.todos.map((todo) =>
        todo.id === todoId
          ? {
              ...todo,
              completed: !todo.completed,
              updatedAt: nowIso(),
            }
          : todo,
      ),
    }));
    advanceTutorial(7);
  };

  const handleDeleteTodo = (todoId: string) => {
    updateActiveSpace((space) => ({
      ...space,
      todos: space.todos.filter((todo) => todo.id !== todoId),
    }));
  };

  const renderSidebar = (drawer = false) => (
    <SpaceSidebar
      activeSpaceId={snapshot.activeSpaceId}
      activeSpaceName={activeSpace?.name ?? ''}
      drawerTitle={drawer ? (snapshot.locale === 'zh' ? '空间库' : 'Space Library') : copy.sidebar.drawerTitle}
      isDrawer={drawer}
      locale={snapshot.locale}
      onClose={drawer ? () => setIsSidebarOpen(false) : undefined}
      onCreateSpace={handleCreateSpace}
      onDeleteActiveSpace={handleDeleteActiveSpace}
      onExportSnapshot={handleExportSnapshot}
      onImportSnapshot={handleImportSnapshot}
      onOpenSettings={() => setIsSettingsOpen(true)}
      onResetPreviewData={handleResetPreviewData}
      onRenameActiveSpace={handleRenameActiveSpace}
      onSelectSpace={handleSelectSpace}
      onToggleTheme={handleToggleTheme}
      saveLabel={saveStatusLabel(saveStatus, snapshot.locale)}
      spaces={snapshot.spaces}
      theme={snapshot.theme}
    />
  );

  if (!hydrated || !activeSpace) {
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

  const showMap = !isMobile || mobileView === 'map';
  const showTodo = !isMobile || mobileView === 'todo';
  const isOverlayInfoOpen = !isMobile && isMapInfoOpen && expandedPanel === 'map';
  const isRailInfoOpen = !isMobile && isMapInfoOpen && expandedPanel === null;
  const toggleExpandedPanel = (panel: 'todo' | 'map') => {
    setExpandedPanel((current) => current === panel ? null : panel);
    setIsMapInfoOpen(false);
  };

  return (
    <div className={`app-shell app-shell--${layoutMode} ${expandedPanel ? 'is-panel-expanded' : ''} ${isRailInfoOpen ? 'is-info-open' : ''} ${isOverlayInfoOpen ? 'is-overlay-info-open' : ''}`}>
      {!isMobile ? (
        <div className="app-rail">
          <div className="app-rail__spaces">{renderSidebar(false)}</div>
          <aside className="app-rail__details">
            <div className="app-rail__details-host" ref={setInfoPortalTarget} />
          </aside>
        </div>
      ) : null}

      <main className={`workspace ${expandedPanel ? 'workspace--panel-expanded' : ''}`}>
        <header className="workspace__header">
          <div className="workspace__title">
            <div>
              <h2>{activeSpace.name || copy.sidebar.untitledSpace}</h2>
              <p className="workspace__summary">
                <span className="summary-card">{copy.workspace.points(activeSpace.nodes.length)}</span>
                <span className="summary-card">
                  {copy.workspace.openTasks(activeSpace.todos.filter((todo) => !todo.completed).length)}
                </span>
              </p>
              {isWebPreview() ? (
                <p className="workspace__subhead">{copy.workspace.webPreviewSubhead}</p>
              ) : null}
            </div>

            {isMobile ? (
              <button className="button workspace__spaces-button" onClick={() => setIsSidebarOpen(true)} type="button">
                {copy.workspace.spacesButton}
              </button>
            ) : null}
          </div>
        </header>

        {bannerMessage ? <div className="workspace__banner">{bannerMessage}</div> : null}

        <div
          className={`workspace__grid ${showMap && showTodo ? '' : 'workspace__grid--single'} ${expandedPanel ? `workspace__grid--${expandedPanel}-expanded` : ''} ${isRailInfoOpen ? 'workspace__grid--info-open' : ''}`}
        >
          {showTodo ? (
            <WhyTodoPanel
              isExpanded={expandedPanel === 'todo'}
              isMobile={isMobile}
              locale={snapshot.locale}
              onAddTodo={handleAddTodo}
              onChangeTodoText={handleChangeTodoText}
              onDeleteTodo={handleDeleteTodo}
              onToggleTodo={handleToggleTodo}
              onToggleExpanded={() => toggleExpandedPanel('todo')}
              space={activeSpace}
            />
          ) : null}

          {showMap ? (
            <BrainCanvas
              editingNodeId={editingNodeId}
              isEditMode={isMapEditing}
              locale={snapshot.locale}
              isMobile={isMobile}
              isExpanded={expandedPanel === 'map'}
              isInfoOpen={isMapInfoOpen}
              infoPortalTarget={isOverlayInfoOpen ? expandedInfoPortalTarget : infoPortalTarget}
              onAddNeuron={handleAddNeuron}
              onDeleteNodes={handleDeleteNodes}
              onFinishRenameNode={handleFinishRenameNode}
              onNodeLabelChange={handleNodeLabelChange}
              onPersistNodePositions={handlePersistNodePositions}
              onRequestDeleteNodes={handleRequestDeleteNodes}
              onStartRenameNode={handleStartRenameNode}
              onToggleConnection={handleToggleConnection}
              onToggleEditMode={() => {
                setEditingNodeId(null);
                setIsMapEditing((current) => !current);
                advanceTutorial(1);
              }}
              onToggleExpanded={() => toggleExpandedPanel('map')}
              onInfoOpenChange={setIsMapInfoOpen}
              onViewportChange={handleViewportChange}
              space={activeSpace}
            />
          ) : null}
        </div>

        {showTutorial ? (
          <GuidedTutorial
            locale={snapshot.locale}
            onBack={() => {
              setTutorialStep((current) => {
                const next = Math.max(0, current - 1) as TutorialStep;
                if (next === 1) {
                  setIsMapEditing(false);
                } else if (next >= 2 && next <= 5) {
                  setIsMapEditing(true);
                }
                return next;
              });
            }}
            onExit={closeTutorial}
            onNext={() => advanceTutorial(0)}
            step={tutorialStep}
          />
        ) : null}
      </main>

      {!isMobile ? (
        <aside className="expanded-info-drawer">
          <div className="expanded-info-drawer__host" ref={setExpandedInfoPortalTarget} />
        </aside>
      ) : null}

      {isMobile ? (
        <>
          <nav aria-label="Primary mobile navigation" className="mobile-nav">
            <button
              className={`mobile-nav__item ${mobileView === 'map' ? 'is-active' : ''}`}
              onClick={() => setMobileView('map')}
              type="button"
            >
              {copy.nav.map}
            </button>
            <button
              className={`mobile-nav__item ${mobileView === 'todo' ? 'is-active' : ''}`}
              onClick={() => setMobileView('todo')}
              type="button"
            >
              {copy.nav.todo}
            </button>
            <button
              className={`mobile-nav__item ${isSidebarOpen ? 'is-active' : ''}`}
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            >
              {copy.nav.spaces}
            </button>
          </nav>

          {isSidebarOpen ? (
            <div className="sheet-backdrop" onClick={() => setIsSidebarOpen(false)} role="presentation">
              <div className="sheet-shell" onClick={(event) => event.stopPropagation()}>
                {renderSidebar(true)}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {isSettingsOpen ? (
        <SettingsDialog
          locale={snapshot.locale}
          onClose={() => setIsSettingsOpen(false)}
          onLocaleChange={handleLocaleChange}
          onOpenTutorial={openTutorial}
        />
      ) : null}

      {dialogState ? (
        <AppDialog
          cancelLabel={dialogState.cancelLabel ?? copy.dialogs.cancel}
          confirmLabel={dialogState.confirmLabel}
          message={dialogState.message}
          onCancel={dialogState.onCancel ?? closeDialog}
          onConfirm={dialogState.onConfirm}
          title={dialogState.title}
          tone={dialogState.tone}
          variant={dialogState.variant}
        />
      ) : null}
    </div>
  );
}
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
