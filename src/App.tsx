import { startTransition, useEffect, useState } from 'react';
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
import { loadSnapshot, saveSnapshot } from './lib/persistence';
import type { AppSnapshot, BrainNode, Space } from './types';

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

export default function App() {
  const [snapshot, setSnapshot] = useState<AppSnapshot>(() => buildDefaultState());
  const [hydrated, setHydrated] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'booting' | 'saving' | 'saved' | 'error'>('booting');
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [isMapEditing, setIsMapEditing] = useState(false);

  const activeSpace =
    snapshot.spaces.find((space) => space.id === snapshot.activeSpaceId) ?? snapshot.spaces[0];

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

  const handleToggleTheme = () => {
    updateSnapshot((current) => ({
      ...current,
      theme: current.theme === 'dark' ? 'light' : 'dark',
    }));
  };

  const handleSelectSpace = (spaceId: string) => {
    setIsMapEditing(false);
    setEditingNodeId(null);
    updateSnapshot((current) => ({
      ...current,
      activeSpaceId: spaceId,
    }));
  };

  const handleCreateSpace = () => {
    setIsMapEditing(false);
    setEditingNodeId(null);
    updateSnapshot((current) => {
      const nextSpace = createSpace(`Space ${current.spaces.length + 1}`);

      return {
        ...current,
        spaces: [...current.spaces, nextSpace],
        activeSpaceId: nextSpace.id,
      };
    });
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

    const confirmed = window.confirm(`Delete "${activeSpace.name || 'Untitled Space'}"?`);
    if (!confirmed) {
      return;
    }

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
            type: 'default',
          },
        ];
      })(),
    }));
  };

  const handleDeleteNodes = (nodeIds: string[]) => {
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

  const handleAddNeuron = (position?: BrainNode['position']) => {
    const nextNode = createNeuronNode('', position?.x ?? 220, position?.y ?? 180);
    setIsMapEditing(true);
    setEditingNodeId(nextNode.id);

    updateActiveSpace((space) => ({
      ...space,
      nodes: [...space.nodes, nextNode],
    }));

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

  return (
    <div className="app-shell">
      <SpaceSidebar
        activeSpaceId={snapshot.activeSpaceId}
        activeSpaceName={activeSpace.name}
        onCreateSpace={handleCreateSpace}
        onDeleteActiveSpace={handleDeleteActiveSpace}
        onRenameActiveSpace={handleRenameActiveSpace}
        onSelectSpace={handleSelectSpace}
        onToggleTheme={handleToggleTheme}
        saveLabel={saveStatusLabel(saveStatus)}
        spaces={snapshot.spaces}
        theme={snapshot.theme}
      />

      <main className="workspace">
        <header className="workspace__header">
          <div>
            <h2>{activeSpace.name || 'Untitled Space'}</h2>
          </div>
        </header>

        <div className="workspace__grid">
          <WhyTodoPanel
            onAddTodo={handleAddTodo}
            onChangeTodoText={handleChangeTodoText}
            onDeleteTodo={handleDeleteTodo}
            onToggleTodo={handleToggleTodo}
            space={activeSpace}
          />

          <BrainCanvas
            editingNodeId={editingNodeId}
            onDeleteNodes={handleDeleteNodes}
            isEditMode={isMapEditing}
            onAddNeuron={handleAddNeuron}
            onFinishRenameNode={handleFinishRenameNode}
            onNodeLabelChange={handleNodeLabelChange}
            onPersistNodePositions={handlePersistNodePositions}
            onStartRenameNode={handleStartRenameNode}
            onToggleEditMode={() => {
              setEditingNodeId(null);
              setIsMapEditing((current) => !current);
            }}
            onToggleConnection={handleToggleConnection}
            onViewportChange={handleViewportChange}
            space={activeSpace}
          />
        </div>
      </main>
    </div>
  );
}
