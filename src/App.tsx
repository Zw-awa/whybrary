import { startTransition, useEffect, useState } from 'react';
import { AppDialog } from './components/AppDialog';
import { BrainCanvas } from './components/BrainCanvas';
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
import {
  buildSnapshotFilename,
  parseSnapshot,
  serializeSnapshot,
} from './lib/snapshotTransfer';
import type {
  AppSnapshot,
  BrainNode,
  DeviceLayoutMode,
  MobilePrimaryView,
  Space,
} from './types';

type AppDialogState =
  | null
  | {
      confirmLabel: string;
      message: string;
      onConfirm: () => void;
      title: string;
      tone?: 'neutral' | 'danger';
      variant?: 'confirm' | 'notice';
    };

function saveStatusLabel(status: 'booting' | 'saving' | 'saved' | 'error'): string {
  switch (status) {
    case 'booting':
      return 'Booting';
    case 'saving':
      return 'Saving locally';
    case 'saved':
      return 'Saved locally';
    case 'error':
      return 'Save fallback active';
    default:
      return 'Saved locally';
  }
}

function isWebPreview(): boolean {
  return typeof window !== 'undefined' && !('__TAURI_INTERNALS__' in window);
}

function getLayoutMode(width: number): DeviceLayoutMode {
  if (width <= 768) {
    return 'phone';
  }

  if (width < 1200) {
    return 'tablet';
  }

  return 'desktop';
}

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => buildDefaultState());
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'booting' | 'saving' | 'saved' | 'error'>('booting');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isMapEditing, setIsMapEditing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [layoutMode, setLayoutMode] = useState<DeviceLayoutMode>(() =>
    typeof window === 'undefined' ? 'desktop' : getLayoutMode(window.innerWidth),
  );
  const [mobileView, setMobileView] = useState<MobilePrimaryView>('map');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [dialogState, setDialogState] = useState<AppDialogState>(null);
  const webPreview = isWebPreview();
  const isMobile = layoutMode === 'phone';

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
    let cancelled = false;

    loadSnapshot()
      .then((loaded) => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          setSnapshot(normalizeSnapshot(loaded));
          setHydrated(true);
          setSaveStatus('saved');
          setShowWelcome(webPreview);
        });
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        startTransition(() => {
          const fallback = buildDefaultState();
          setSnapshot(fallback);
          setHydrated(true);
          setSaveStatus('error');
          setShowWelcome(webPreview);
        });
      });

    return () => {
      cancelled = true;
    };
  }, [webPreview]);

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

  const showNotice = (title: string, message: string) => {
    setDialogState({
      confirmLabel: 'Close',
      message,
      onConfirm: () => setDialogState(null),
      title,
      variant: 'notice',
    });
  };

  const handleToggleTheme = () => {
    updateSnapshot((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleExportSnapshot = () => {
    setShowWelcome(false);
    const blob = new Blob([serializeSnapshot(snapshot)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = buildSnapshotFilename();
    anchor.click();
    URL.revokeObjectURL(url);
    setBannerMessage('Snapshot exported as JSON.');
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
        const raw = await file.text();
        const imported = parseSnapshot(raw);

        startTransition(() => {
          setEditingNodeId(null);
          setIsMapEditing(false);
          setShowWelcome(false);
          setSnapshot({
            ...imported,
            lastOpenedAt: nowIso(),
          });
          setHydrated(true);
          setSaveStatus('saved');
          setBannerMessage('Snapshot imported successfully.');
          setIsSidebarOpen(false);
        });
      } catch (error) {
        console.warn('Failed to import snapshot JSON.', error);
        showNotice('Import failed', 'Please choose a valid Whybrary JSON snapshot.');
      }
    };

    input.click();
  };

  const handleResetPreviewData = () => {
    setDialogState({
      confirmLabel: 'Reset Data',
      message: 'Clear the browser-local Whybrary snapshot and replace it with a fresh default space?',
      onConfirm: () => {
        const fallback = buildDefaultState();
        clearPreviewSnapshot();
        setEditingNodeId(null);
        setIsMapEditing(false);
        setShowWelcome(webPreview);
        setSnapshot(fallback);
        setHydrated(true);
        setSaveStatus('saved');
        setBannerMessage('Browser-local snapshot reset.');
        setDialogState(null);
        setIsSidebarOpen(false);
        setMobileView('map');
      },
      title: 'Reset browser data',
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
    setShowWelcome(false);
    updateSnapshot((current) => {
      const nextSpace = createSpace(`Space ${current.spaces.length + 1}`);

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
      confirmLabel: 'Delete Space',
      message: `Delete "${activeSpace.name || 'Untitled Space'}"?`,
      onConfirm: () => {
        setEditingNodeId(null);
        setIsMapEditing(false);
        updateSnapshot((current) => {
          const remaining = current.spaces.filter((space) => space.id !== current.activeSpaceId);
          if (remaining.length === 0) {
            const replacement = createSpace('My First Space');

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
      title: 'Delete current space',
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
  };

  const handleDeleteNodes = (nodeIds: string[]) => {
    commitDeleteNodes(nodeIds);
  };

  const handleRequestDeleteNodes = (nodeIds: string[], labels: string[]) => {
    const preview = labels.slice(0, 3).join(', ');
    const suffix = nodeIds.length > 3 ? ` and ${nodeIds.length - 3} more` : '';

    setDialogState({
      confirmLabel: nodeIds.length > 1 ? 'Delete Nodes' : 'Delete Node',
      message: `Delete ${nodeIds.length} selected node${nodeIds.length > 1 ? 's' : ''}? ${preview}${suffix}`,
      onConfirm: () => {
        commitDeleteNodes(nodeIds);
        setDialogState(null);
      },
      title: 'Delete selected nodes',
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
      drawerTitle={drawer ? 'Space Library' : 'Spaces'}
      isDrawer={drawer}
      onClose={drawer ? () => setIsSidebarOpen(false) : undefined}
      onCreateSpace={handleCreateSpace}
      onDeleteActiveSpace={handleDeleteActiveSpace}
      onExportSnapshot={handleExportSnapshot}
      onImportSnapshot={handleImportSnapshot}
      onResetPreviewData={handleResetPreviewData}
      onRenameActiveSpace={handleRenameActiveSpace}
      onSelectSpace={handleSelectSpace}
      onToggleTheme={handleToggleTheme}
      saveLabel={saveStatusLabel(saveStatus)}
      spaces={snapshot.spaces}
      theme={snapshot.theme}
    />
  );

  if (!hydrated || !activeSpace) {
    return (
      <main className="loading-shell">
        <div className="loading-card">
          <p className="eyebrow">Whybrary</p>
          <h1>Preparing your local space...</h1>
          <p>Booting the graph, loading the list, and opening the SQLite snapshot.</p>
        </div>
      </main>
    );
  }

  const showMap = !isMobile || mobileView === 'map';
  const showTodo = !isMobile || mobileView === 'todo';

  return (
    <div className={`app-shell app-shell--${layoutMode}`}>
      {!isMobile ? renderSidebar(false) : null}

      <main className="workspace">
        <header className="workspace__header">
          <div className="workspace__title">
            <div>
              <h2>{activeSpace.name || 'Untitled Space'}</h2>
              <p className="workspace__summary">
                <span className="summary-card">{activeSpace.nodes.length} points</span>
                <span className="summary-card">
                  {activeSpace.todos.filter((todo) => !todo.completed).length} open tasks
                </span>
              </p>
              {webPreview ? (
                <p className="workspace__subhead">
                  Web preview mode. Your data stays in this browser unless you export JSON.
                </p>
              ) : null}
            </div>

            {isMobile ? (
              <button className="button workspace__spaces-button" onClick={() => setIsSidebarOpen(true)} type="button">
                Spaces
              </button>
            ) : null}
          </div>
        </header>

        {bannerMessage ? <div className="workspace__banner">{bannerMessage}</div> : null}

        <div
          className={`workspace__grid ${showMap && showTodo ? '' : 'workspace__grid--single'}`}
        >
          {showTodo ? (
            <WhyTodoPanel
              isMobile={isMobile}
              onAddTodo={handleAddTodo}
              onChangeTodoText={handleChangeTodoText}
              onDeleteTodo={handleDeleteTodo}
              onToggleTodo={handleToggleTodo}
              space={activeSpace}
            />
          ) : null}

          {showMap ? (
            <BrainCanvas
              editingNodeId={editingNodeId}
              isEditMode={isMapEditing}
              isMobile={isMobile}
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
              }}
              onViewportChange={handleViewportChange}
              space={activeSpace}
            />
          ) : null}
        </div>

        {showWelcome ? (
          <section className="welcome-panel" role="region" aria-label="Whybrary web welcome">
            <div className="welcome-panel__card">
              <p className="eyebrow">Whybrary on the web</p>
              <h3>Try it in the browser, then carry your graph with you.</h3>
              <p>
                This Pages version is meant for quick use, easy sharing, and JSON import/export.
                Nothing is uploaded. Your preview data stays in this browser unless you export it.
              </p>

              <div className="welcome-panel__actions">
                <button className="button button--accent" onClick={() => setShowWelcome(false)} type="button">
                  Start Editing
                </button>
                <button className="button" onClick={handleImportSnapshot} type="button">
                  Import Existing JSON
                </button>
                <button className="button" onClick={handleExportSnapshot} type="button">
                  Export Current JSON
                </button>
              </div>

              <div className="welcome-panel__notes">
                <div className="welcome-note">
                  <strong>Fast to try</strong>
                  <span>Open the page and start editing immediately with no install step.</span>
                </div>
                <div className="welcome-note">
                  <strong>Portable content</strong>
                  <span>Export one JSON file and re-import it later on the web or desktop app.</span>
                </div>
                <div className="welcome-note">
                  <strong>Signing deferred</strong>
                  <span>Desktop signing stays intentionally deferred until broader distribution requires it.</span>
                </div>
              </div>

              <a
                className="welcome-panel__link"
                href="https://github.com/Zw-awa/whybrary/releases"
                rel="noreferrer"
                target="_blank"
              >
                Open desktop releases
              </a>
            </div>
          </section>
        ) : null}
      </main>

      {isMobile ? (
        <>
          <nav aria-label="Primary mobile navigation" className="mobile-nav">
            <button
              className={`mobile-nav__item ${mobileView === 'map' ? 'is-active' : ''}`}
              onClick={() => setMobileView('map')}
              type="button"
            >
              Map
            </button>
            <button
              className={`mobile-nav__item ${mobileView === 'todo' ? 'is-active' : ''}`}
              onClick={() => setMobileView('todo')}
              type="button"
            >
              To-Do
            </button>
            <button
              className={`mobile-nav__item ${isSidebarOpen ? 'is-active' : ''}`}
              onClick={() => setIsSidebarOpen(true)}
              type="button"
            >
              Spaces
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

      {dialogState ? (
        <AppDialog
          confirmLabel={dialogState.confirmLabel}
          message={dialogState.message}
          onCancel={closeDialog}
          onConfirm={dialogState.onConfirm}
          title={dialogState.title}
          tone={dialogState.tone}
          variant={dialogState.variant}
        />
      ) : null}
    </div>
  );
}
