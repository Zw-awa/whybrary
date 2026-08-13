import type {
  AppLocale,
  AppSnapshot,
  BrainEdge,
  BrainNode,
  Space,
  ThemeMode,
  TodoItem,
  NodeCategory,
  NodeColor,
  TodoPriority,
  ViewportState,
} from '../types';

export type WorkspaceAction =
  | { type: 'snapshot.replace'; snapshot: AppSnapshot }
  | { type: 'locale.set'; locale: AppLocale; at: string }
  | { type: 'theme.set'; theme: ThemeMode; at: string }
  | { type: 'space.select'; spaceId: string; at: string }
  | { type: 'tutorial.seen'; seen: boolean; at: string }
  | { type: 'space.create'; space: Space; at: string }
  | { type: 'space.rename'; spaceId: string; name: string; at: string }
  | {
      type: 'space.delete';
      spaceId: string;
      replacement?: Space;
      preferredSpaceId?: string | null;
      at: string;
    }
  | { type: 'viewport.set'; spaceId: string; viewport: ViewportState; at: string }
  | {
      type: 'nodes.position';
      spaceId: string;
      nodes: Pick<BrainNode, 'id' | 'position'>[];
      at: string;
    }
  | { type: 'node.add'; spaceId: string; node: BrainNode; at: string }
  | { type: 'node.rename'; spaceId: string; nodeId: string; label: string; at: string }
  | {
      type: 'node.metadata';
      spaceId: string;
      nodeId: string;
      category?: NodeCategory;
      color?: NodeColor;
      at: string;
    }
  | { type: 'nodes.delete'; spaceId: string; nodeIds: string[]; at: string }
  | { type: 'edge.toggle'; spaceId: string; edge: BrainEdge; at: string }
  | { type: 'todo.add'; spaceId: string; todo: TodoItem; at: string }
  | { type: 'todo.update'; spaceId: string; todoId: string; text: string; at: string }
  | {
      type: 'todo.metadata';
      spaceId: string;
      todoId: string;
      priority?: TodoPriority;
      dueDate?: string | null;
      at: string;
    }
  | { type: 'todo.toggle'; spaceId: string; todoId: string; at: string }
  | { type: 'todo.delete'; spaceId: string; todoId: string; at: string };

function updateSpace(
  state: AppSnapshot,
  spaceId: string,
  at: string,
  updater: (space: Space) => Space,
): AppSnapshot {
  if (!state.spaces.some((space) => space.id === spaceId)) {
    return state;
  }

  return {
    ...state,
    lastOpenedAt: at,
    spaces: state.spaces.map((space) =>
      space.id === spaceId ? { ...updater(space), updatedAt: at } : space,
    ),
  };
}

export function workspaceReducer(state: AppSnapshot, action: WorkspaceAction): AppSnapshot {
  switch (action.type) {
    case 'snapshot.replace':
      return action.snapshot;
    case 'locale.set':
      return { ...state, locale: action.locale, lastOpenedAt: action.at };
    case 'theme.set':
      return { ...state, theme: action.theme, lastOpenedAt: action.at };
    case 'space.select':
      return state.spaces.some((space) => space.id === action.spaceId)
        ? { ...state, activeSpaceId: action.spaceId, lastOpenedAt: action.at }
        : state;
    case 'tutorial.seen':
      return { ...state, hasSeenTutorial: action.seen, lastOpenedAt: action.at };
    case 'space.create':
      return {
        ...state,
        spaces: [...state.spaces, action.space],
        activeSpaceId: action.space.id,
        lastOpenedAt: action.at,
      };
    case 'space.rename':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        name: action.name,
      }));
    case 'space.delete': {
      const remaining = state.spaces.filter((space) => space.id !== action.spaceId);
      const spaces =
        remaining.length > 0 ? remaining : action.replacement ? [action.replacement] : state.spaces;
      const preferredExists = action.preferredSpaceId
        ? spaces.some((space) => space.id === action.preferredSpaceId)
        : false;
      const activeStillExists =
        state.activeSpaceId !== action.spaceId &&
        spaces.some((space) => space.id === state.activeSpaceId);

      return {
        ...state,
        spaces,
        activeSpaceId: preferredExists
          ? (action.preferredSpaceId ?? null)
          : activeStillExists
            ? state.activeSpaceId
            : (spaces[0]?.id ?? null),
        lastOpenedAt: action.at,
      };
    }
    case 'viewport.set':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        viewport: action.viewport,
      }));
    case 'nodes.position': {
      const positions = new Map(action.nodes.map((node) => [node.id, node.position]));
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        nodes: space.nodes.map((node) => {
          const position = positions.get(node.id);
          return position ? { ...node, position } : node;
        }),
      }));
    }
    case 'node.add':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        nodes: [...space.nodes, action.node],
      }));
    case 'node.rename':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        nodes: space.nodes.map((node) =>
          node.id === action.nodeId
            ? { ...node, data: { ...node.data, label: action.label } }
            : node,
        ),
      }));
    case 'node.metadata':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        nodes: space.nodes.map((node) =>
          node.id === action.nodeId
            ? {
                ...node,
                data: { ...node.data, category: action.category, color: action.color },
              }
            : node,
        ),
      }));
    case 'nodes.delete': {
      const ids = new Set(action.nodeIds);
      if (ids.size === 0) return state;
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        nodes: space.nodes.filter((node) => !ids.has(node.id)),
        edges: space.edges.filter((edge) => !ids.has(edge.source) && !ids.has(edge.target)),
      }));
    }
    case 'edge.toggle':
      return updateSpace(state, action.spaceId, action.at, (space) => {
        if (action.edge.source === action.edge.target) return space;
        const existing = space.edges.find(
          (edge) =>
            (edge.source === action.edge.source && edge.target === action.edge.target) ||
            (edge.source === action.edge.target && edge.target === action.edge.source),
        );
        return {
          ...space,
          edges: existing
            ? space.edges.filter((edge) => edge.id !== existing.id)
            : [...space.edges, action.edge],
        };
      });
    case 'todo.add': {
      const text = action.todo.text.trim();
      if (!text) return state;
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        todos: [{ ...action.todo, text }, ...space.todos],
      }));
    }
    case 'todo.update':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        todos: space.todos.map((todo) =>
          todo.id === action.todoId ? { ...todo, text: action.text, updatedAt: action.at } : todo,
        ),
      }));
    case 'todo.metadata':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        todos: space.todos.map((todo) =>
          todo.id === action.todoId
            ? {
                ...todo,
                priority: action.priority,
                dueDate: action.dueDate || undefined,
                updatedAt: action.at,
              }
            : todo,
        ),
      }));
    case 'todo.toggle':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        todos: space.todos.map((todo) =>
          todo.id === action.todoId
            ? { ...todo, completed: !todo.completed, updatedAt: action.at }
            : todo,
        ),
      }));
    case 'todo.delete':
      return updateSpace(state, action.spaceId, action.at, (space) => ({
        ...space,
        todos: space.todos.filter((todo) => todo.id !== action.todoId),
      }));
    default:
      return state;
  }
}
