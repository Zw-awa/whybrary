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
import type { AppSnapshot, BrainEdge, BrainNode, Space } from './types';

function applyElasticNodeMotion(
  space: Space,
  nodeId: string,
  nextPosition: BrainNode['position'],
): BrainNode[] {
  const currentNode = space.nodes.find((node) => node.id === nodeId);
  if (!currentNode) {
    return space.nodes;
  }

  const dx = nextPosition.x - currentNode.position.x;
  const dy = nextPosition.y - currentNode.position.y;
  const nextNodes = space.nodes.map((node) =>
    node.id === nodeId
      ? {
          ...node,
          position: nextPosition,
        }
      : node,
  );

  if ((Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) || space.edges.length === 0) {
    return nextNodes;
  }

  const movedByDrag = new Map<string, { dx: number; dy: number }>([[nodeId, { dx, dy }]]);

  const adjacency = new Map<string, string[]>();
  for (const edge of space.edges) {
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
    adjacency.set(edge.target, [...(adjacency.get(edge.target) ?? []), edge.source]);
  }

  const pullByNode = new Map<string, { dx: number; dy: number }>();
  const draggedIds = new Set([nodeId]);

  for (const [startId, delta] of movedByDrag) {
    const queue: Array<{ id: string; depth: number }> = [{ id: startId, depth: 0 }];
    const visited = new Set([startId]);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current) {
        break;
      }

      if (current.depth >= 3) {
        continue;
      }

      for (const neighborId of adjacency.get(current.id) ?? []) {
        if (visited.has(neighborId) || draggedIds.has(neighborId)) {
          continue;
        }

        visited.add(neighborId);

        const strength = current.depth === 0 ? 0.34 : current.depth === 1 ? 0.16 : 0.08;
        const previousPull = pullByNode.get(neighborId) ?? { dx: 0, dy: 0 };

        pullByNode.set(neighborId, {
          dx: previousPull.dx + delta.dx * strength,
          dy: previousPull.dy + delta.dy * strength,
        });

        queue.push({ id: neighborId, depth: current.depth + 1 });
      }
    }
  }

  return nextNodes.map((node) => {
    const pull = pullByNode.get(node.id);
    if (!pull) {
      return node;
    }

    return {
      ...node,
      position: {
        x: node.position.x + pull.dx,
        y: node.position.y + pull.dy,
      },
    };
  });
}

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

  const handleMoveNode = (nodeId: string, nextPosition: BrainNode['position']) => {
    updateActiveSpace((space) => ({
      ...space,
      nodes: applyElasticNodeMotion(space, nodeId, nextPosition),
    }));
  };

  const handlePanViewport = (x: number, y: number) => {
    updateActiveSpace((space) => ({
      ...space,
      viewport: {
        ...space.viewport,
        x,
        y,
      },
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

  const handleAddNeuron = () => {
    const index = activeSpace.nodes.length;
    const column = index % 3;
    const row = Math.floor(index / 3);
    const centerX = (360 - activeSpace.viewport.x) / activeSpace.viewport.zoom;
    const centerY = (240 - activeSpace.viewport.y) / activeSpace.viewport.zoom;
    const nextNode = createNeuronNode('', centerX + column * 120 - 120, centerY + row * 96 - 48);
    setIsMapEditing(true);
    setEditingNodeId(nextNode.id);

    updateActiveSpace((space) => {
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
            isEditMode={isMapEditing}
            onAddNeuron={handleAddNeuron}
            onFinishRenameNode={handleFinishRenameNode}
            onMoveNode={handleMoveNode}
            onNodeLabelChange={handleNodeLabelChange}
            onPanViewport={handlePanViewport}
            onStartRenameNode={handleStartRenameNode}
            onToggleEditMode={() => {
              setEditingNodeId(null);
              setIsMapEditing((current) => !current);
            }}
            onViewportChange={handleViewportChange}
            space={activeSpace}
            onToggleConnection={handleToggleConnection}
          />
        </div>
      </main>
    </div>
  );
}
