import { startTransition, useEffect, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type Viewport,
} from '@xyflow/react';
import { BrainCanvas } from './components/BrainCanvas';
import { SpaceSidebar } from './components/SpaceSidebar';
import { WhyTodoPanel } from './components/WhyTodoPanel';
import { buildDefaultState, createSpace, normalizeSnapshot, nowIso } from './lib/defaults';
import { loadSnapshot, saveSnapshot } from './lib/persistence';
import type { AppSnapshot, BrainEdge, BrainNode, Space } from './types';

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

  const activeSpace =
    snapshot.spaces.find((space) => space.id === snapshot.activeSpaceId) ?? snapshot.spaces[0];

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
    updateSnapshot((current) => ({
      ...current,
      activeSpaceId: spaceId,
    }));
  };

  const handleCreateSpace = () => {
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

  const handleNodesChange = (changes: NodeChange<BrainNode>[]) => {
    updateActiveSpace((space) => ({
      ...space,
      nodes: applyNodeChanges(changes, space.nodes),
    }));
  };

  const handleEdgesChange = (changes: EdgeChange<BrainEdge>[]) => {
    updateActiveSpace((space) => ({
      ...space,
      edges: applyEdgeChanges(changes, space.edges),
    }));
  };

  const handleConnect = (connection: Connection) => {
    updateActiveSpace((space) => ({
      ...space,
      edges: addEdge(
        {
          ...connection,
          id: crypto.randomUUID(),
          type: 'smoothstep',
        },
        space.edges,
      ),
    }));
  };

  const handleAddNeuron = () => {
    updateActiveSpace((space) => {
      const index = space.nodes.length;
      const column = index % 3;
      const row = Math.floor(index / 3);
      const nextNode: BrainNode = {
        id: crypto.randomUUID(),
        type: 'neuron',
        position: {
          x: column * 220 - 220,
          y: row * 160 - 60,
        },
        data: {
          label: `Neuron ${index + 1}`,
        },
      };

      return {
        ...space,
        nodes: [...space.nodes, nextNode],
      };
    });
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

  const handleViewportChange = (viewport: Viewport) => {
    updateActiveSpace((space) => ({
      ...space,
      viewport: {
        x: viewport.x,
        y: viewport.y,
        zoom: viewport.zoom,
      },
    }));
  };

  const handleAddTodo = (text: string) => {
    updateActiveSpace((space) => ({
      ...space,
      todos: [
        ...space.todos,
        {
          id: crypto.randomUUID(),
          text,
          completed: false,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        },
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

  const openTodos = activeSpace.todos.filter((todo) => !todo.completed).length;

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
            <p className="eyebrow">Current space</p>
            <h2>{activeSpace.name || 'Untitled Space'}</h2>
          </div>

          <div className="workspace__summary">
            <div className="summary-card">
              <strong>{activeSpace.nodes.length}</strong>
              <span>neurons</span>
            </div>
            <div className="summary-card">
              <strong>{activeSpace.edges.length}</strong>
              <span>links</span>
            </div>
            <div className="summary-card">
              <strong>{openTodos}</strong>
              <span>open todos</span>
            </div>
          </div>
        </header>

        <div className="workspace__grid">
          <BrainCanvas
            onAddNeuron={handleAddNeuron}
            onConnect={handleConnect}
            onEdgesChange={handleEdgesChange}
            onNodeLabelChange={handleNodeLabelChange}
            onNodesChange={handleNodesChange}
            onViewportChange={handleViewportChange}
            space={activeSpace}
          />

          <WhyTodoPanel
            onAddTodo={handleAddTodo}
            onChangeTodoText={handleChangeTodoText}
            onDeleteTodo={handleDeleteTodo}
            onToggleTodo={handleToggleTodo}
            space={activeSpace}
          />
        </div>
      </main>
    </div>
  );
}
