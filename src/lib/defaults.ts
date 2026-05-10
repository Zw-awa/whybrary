import type {
  AppSnapshot,
  BrainEdge,
  BrainNode,
  Space,
  ThemeMode,
  ViewportState,
} from '../types';

function safeTheme(): ThemeMode {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark';
  }

  return 'light';
}

export function nowIso(): string {
  return new Date().toISOString();
}

function defaultViewport(): ViewportState {
  return { x: 0, y: 0, zoom: 0.9 };
}

function createNode(label: string, x: number, y: number): BrainNode {
  return {
    id: crypto.randomUUID(),
    type: 'neuron',
    position: { x, y },
    data: { label },
  };
}

function createEdge(source: string, target: string): BrainEdge {
  return {
    id: crypto.randomUUID(),
    source,
    target,
    type: 'smoothstep',
  };
}

function createTodo(text: string): Space['todos'][number] {
  const stamp = nowIso();

  return {
    id: crypto.randomUUID(),
    text,
    completed: false,
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function createSpace(name: string): Space {
  const stamp = nowIso();
  const root = createNode('Why', -180, -40);
  const branch = createNode('Because', 180, 110);

  return {
    id: crypto.randomUUID(),
    name,
    nodes: [root, branch],
    edges: [createEdge(root.id, branch.id)],
    todos: [
      createTodo('Write the reason in one short line.'),
      createTodo('Connect it to a supporting neuron.'),
      createTodo('Keep only what deserves focus today.'),
    ],
    viewport: defaultViewport(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function buildDefaultState(): AppSnapshot {
  const firstSpace = createSpace('My First Space');

  return {
    theme: safeTheme(),
    spaces: [firstSpace],
    activeSpaceId: firstSpace.id,
    lastOpenedAt: nowIso(),
  };
}

function normalizeSpace(space: Space): Space {
  return {
    ...space,
    name: space.name?.trim() || 'Untitled Space',
    nodes: (space.nodes ?? []).map((node) => ({
      ...node,
      type: node.type ?? 'neuron',
      data: {
        label: node.data?.label?.trim() || 'Untitled neuron',
      },
    })),
    edges: (space.edges ?? []).map((edge) => ({
      ...edge,
      type: edge.type ?? 'smoothstep',
    })),
    todos: (space.todos ?? []).map((todo) => ({
      ...todo,
      text: todo.text ?? '',
    })),
    viewport: space.viewport ?? defaultViewport(),
    createdAt: space.createdAt || nowIso(),
    updatedAt: space.updatedAt || nowIso(),
  };
}

export function normalizeSnapshot(
  snapshot: AppSnapshot | null | undefined,
): AppSnapshot {
  if (!snapshot || !snapshot.spaces || snapshot.spaces.length === 0) {
    return buildDefaultState();
  }

  const spaces = snapshot.spaces.map(normalizeSpace);
  const activeSpaceId = spaces.some((space) => space.id === snapshot.activeSpaceId)
    ? snapshot.activeSpaceId
    : spaces[0].id;

  return {
    theme: snapshot.theme === 'light' ? 'light' : 'dark',
    spaces,
    activeSpaceId,
    lastOpenedAt: snapshot.lastOpenedAt || nowIso(),
  };
}
