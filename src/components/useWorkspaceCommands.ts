import { useMemo } from 'react';
import { createNeuronNode, createSpace, nowIso } from '../lib/defaults';
import { getCopy } from '../lib/i18n';
import type { WorkspaceAction } from '../lib/workspaceReducer';
import type {
  AppLocale,
  AppSnapshot,
  BrainNode,
  NodeCategory,
  NodeColor,
  Space,
  ThemeMode,
  TodoPriority,
} from '../types';

type UseWorkspaceCommandsArgs = {
  getSnapshot: () => AppSnapshot;
  dispatch: (action: WorkspaceAction) => void;
  replaceSnapshot: (snapshot: AppSnapshot) => void;
};

const activeSpaceId = (snapshot: AppSnapshot) =>
  snapshot.activeSpaceId ?? snapshot.spaces[0]?.id ?? null;

export function useWorkspaceCommands({
  dispatch,
  getSnapshot,
  replaceSnapshot,
}: UseWorkspaceCommandsArgs) {
  return useMemo(() => {
    const at = () => nowIso();
    const withActiveSpace = (callback: (spaceId: string) => void) => {
      const spaceId = activeSpaceId(getSnapshot());
      if (spaceId) callback(spaceId);
    };

    return {
      workspace: {
        replace: replaceSnapshot,
      },
      preferences: {
        setLocale: (locale: AppLocale) => dispatch({ type: 'locale.set', locale, at: at() }),
        setTheme: (theme: ThemeMode) => dispatch({ type: 'theme.set', theme, at: at() }),
        toggleTheme: () => {
          const snapshot = getSnapshot();
          const dark =
            snapshot.theme === 'dark' ||
            (snapshot.theme === 'system' &&
              window.matchMedia('(prefers-color-scheme: dark)').matches);
          dispatch({ type: 'theme.set', theme: dark ? 'light' : 'dark', at: at() });
        },
        markTutorialSeen: () => dispatch({ type: 'tutorial.seen', seen: true, at: at() }),
      },
      spaces: {
        select: (spaceId: string) => dispatch({ type: 'space.select', spaceId, at: at() }),
        create: () => {
          const snapshot = getSnapshot();
          const name = getCopy(snapshot.locale).sidebar.newSpaceName(snapshot.spaces.length + 1);
          const space = createSpace(name, snapshot.locale);
          dispatch({ type: 'space.create', space, at: at() });
          return space;
        },
        rename: (spaceId: string, name: string) =>
          dispatch({ type: 'space.rename', spaceId, name, at: at() }),
        delete: (spaceId: string, preferredSpaceId?: string | null) => {
          const snapshot = getSnapshot();
          const replacement =
            snapshot.spaces.length === 1
              ? createSpace(getCopy(snapshot.locale).sidebar.firstSpaceName, snapshot.locale)
              : undefined;
          dispatch({ type: 'space.delete', spaceId, replacement, preferredSpaceId, at: at() });
        },
        add: (space: Space) => dispatch({ type: 'space.create', space, at: at() }),
      },
      map: {
        setViewport: (viewport: Space['viewport']) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'viewport.set', spaceId, viewport, at: at() }),
          ),
        setNodePositions: (nodes: BrainNode[]) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'nodes.position', spaceId, nodes, at: at() }),
          ),
        addNode: (position?: BrainNode['position']) => {
          const node = createNeuronNode('', position?.x ?? 220, position?.y ?? 180);
          withActiveSpace((spaceId) => dispatch({ type: 'node.add', spaceId, node, at: at() }));
          return node;
        },
        renameNode: (nodeId: string, label: string) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'node.rename', spaceId, nodeId, label, at: at() }),
          ),
        updateNodeMetadata: (nodeId: string, category?: NodeCategory, color?: NodeColor) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'node.metadata', spaceId, nodeId, category, color, at: at() }),
          ),
        deleteNodes: (nodeIds: string[]) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'nodes.delete', spaceId, nodeIds, at: at() }),
          ),
        toggleConnection: (sourceId: string, targetId: string) => {
          if (sourceId === targetId) return;
          withActiveSpace((spaceId) =>
            dispatch({
              type: 'edge.toggle',
              spaceId,
              edge: { id: crypto.randomUUID(), source: sourceId, target: targetId },
              at: at(),
            }),
          );
        },
      },
      todos: {
        add: (text: string) => {
          if (!text.trim()) return;
          withActiveSpace((spaceId) => {
            const timestamp = at();
            dispatch({
              type: 'todo.add',
              spaceId,
              todo: {
                id: crypto.randomUUID(),
                text,
                completed: false,
                createdAt: timestamp,
                updatedAt: timestamp,
              },
              at: timestamp,
            });
          });
        },
        update: (todoId: string, text: string) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'todo.update', spaceId, todoId, text, at: at() }),
          ),
        updateMetadata: (todoId: string, priority?: TodoPriority, dueDate?: string | null) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'todo.metadata', spaceId, todoId, priority, dueDate, at: at() }),
          ),
        toggle: (todoId: string) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'todo.toggle', spaceId, todoId, at: at() }),
          ),
        delete: (todoId: string) =>
          withActiveSpace((spaceId) =>
            dispatch({ type: 'todo.delete', spaceId, todoId, at: at() }),
          ),
      },
    };
  }, [dispatch, getSnapshot, replaceSnapshot]);
}
