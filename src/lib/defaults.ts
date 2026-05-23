import type {
  AppLocale,
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

function safeLocale(): AppLocale {
  if (typeof navigator !== 'undefined') {
    const preferred = navigator.language?.toLowerCase() ?? '';
    if (preferred.startsWith('zh')) {
      return 'zh';
    }
  }

  return 'en';
}

function defaultSpaceName(locale: AppLocale): string {
  return locale === 'zh' ? '我的第一个空间' : 'My First Space';
}

function fallbackSpaceName(locale: AppLocale): string {
  return locale === 'zh' ? '未命名空间' : 'Untitled Space';
}

function fallbackNodeLabel(locale: AppLocale): string {
  return locale === 'zh' ? '未命名' : 'Untitled';
}

function defaultRootLabel(locale: AppLocale): string {
  return locale === 'zh' ? '为什么' : 'Why';
}

function defaultBranchLabel(locale: AppLocale): string {
  return locale === 'zh' ? '因为' : 'Because';
}

function defaultTodos(locale: AppLocale): string[] {
  if (locale === 'zh') {
    return [
      '用一句简短的话写下这个原因。',
      '把它连接到一个支撑它的节点。',
      '只保留今天真正值得关注的内容。',
    ];
  }

  return [
    'Write the reason in one short line.',
    'Connect it to a supporting neuron.',
    'Keep only what deserves focus today.',
  ];
}

export function nowIso(): string {
  return new Date().toISOString();
}

function defaultViewport(): ViewportState {
  return { x: 0, y: 0, zoom: 0.9 };
}

function normalizeViewport(viewport: ViewportState | null | undefined): ViewportState {
  if (!viewport) {
    return defaultViewport();
  }

  const finite =
    Number.isFinite(viewport.x) &&
    Number.isFinite(viewport.y) &&
    Number.isFinite(viewport.zoom);

  if (!finite) {
    return defaultViewport();
  }

  if (
    Math.abs(viewport.x) > 50000 ||
    Math.abs(viewport.y) > 50000 ||
    viewport.zoom < 0.1 ||
    viewport.zoom > 10
  ) {
    return defaultViewport();
  }

  return viewport;
}

export function createNeuronNode(label: string, x: number, y: number): BrainNode {
  return {
    id: crypto.randomUUID(),
    position: { x, y },
    data: { label },
  };
}

function createEdge(source: string, target: string): BrainEdge {
  return {
    id: crypto.randomUUID(),
    source,
    target,
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

export function createSpace(name: string, locale: AppLocale = 'en'): Space {
  const stamp = nowIso();
  const root = createNeuronNode(defaultRootLabel(locale), 220, 180);
  const branch = createNeuronNode(defaultBranchLabel(locale), 420, 240);

  return {
    id: crypto.randomUUID(),
    name,
    nodes: [root, branch],
    edges: [createEdge(root.id, branch.id)],
    todos: defaultTodos(locale).map(createTodo),
    viewport: defaultViewport(),
    createdAt: stamp,
    updatedAt: stamp,
  };
}

export function buildDefaultState(locale = safeLocale()): AppSnapshot {
  const firstSpace = createSpace(defaultSpaceName(locale), locale);

  return {
    locale,
    theme: safeTheme(),
    spaces: [firstSpace],
    activeSpaceId: firstSpace.id,
    lastOpenedAt: nowIso(),
  };
}

function normalizeSpace(space: Space): Space {
  const locale = (space as Space & { locale?: AppLocale }).locale === 'zh' ? 'zh' : 'en';
  const rawNodes = (space.nodes ?? []).map((node) => ({
    id: node.id,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
    data: {
      label: node.data?.label?.trim() || fallbackNodeLabel(locale),
    },
  }));

  const minX = rawNodes.length > 0 ? Math.min(...rawNodes.map((node) => node.position.x)) : 0;
  const minY = rawNodes.length > 0 ? Math.min(...rawNodes.map((node) => node.position.y)) : 0;
  const offsetX = minX < 80 ? 120 - minX : 0;
  const offsetY = minY < 80 ? 120 - minY : 0;

  return {
    ...space,
    name: space.name?.trim() || fallbackSpaceName(locale),
    nodes: rawNodes.map((node) => ({
      ...node,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
    })),
    edges: (space.edges ?? []).map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
    todos: (space.todos ?? []).map((todo) => ({
      ...todo,
      text: todo.text ?? '',
    })),
    viewport: normalizeViewport(space.viewport),
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

  const locale = snapshot.locale === 'zh' ? 'zh' : 'en';
  const spaces = snapshot.spaces.map(normalizeSpace);
  const activeSpaceId = spaces.some((space) => space.id === snapshot.activeSpaceId)
    ? snapshot.activeSpaceId
    : spaces[0].id;

  return {
    locale,
    theme: snapshot.theme === 'light' ? 'light' : 'dark',
    spaces: spaces.map((space) => ({
      ...space,
      name: space.name?.trim() || fallbackSpaceName(locale),
      nodes: space.nodes.map((node) => ({
        ...node,
        data: {
          ...node.data,
          label: node.data.label?.trim() || fallbackNodeLabel(locale),
        },
      })),
    })),
    activeSpaceId,
    lastOpenedAt: snapshot.lastOpenedAt || nowIso(),
  };
}
