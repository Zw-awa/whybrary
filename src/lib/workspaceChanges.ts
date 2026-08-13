import type { AppSnapshot, BrainEdge, BrainNode, Space, TodoItem } from '../types';

export type PersistedSettings = Pick<
  AppSnapshot,
  'locale' | 'theme' | 'activeSpaceId' | 'lastOpenedAt' | 'hasSeenTutorial'
>;

export type SpaceRecord = Omit<Space, 'nodes' | 'edges' | 'todos'>;

export type WorkspaceMutation =
  | { kind: 'settings.patch'; settings: PersistedSettings }
  | { kind: 'space.upsert'; space: SpaceRecord; orderIndex: number }
  | { kind: 'space.delete'; spaceId: string }
  | { kind: 'node.upsert'; spaceId: string; node: BrainNode; orderIndex: number }
  | { kind: 'node.delete'; nodeId: string }
  | { kind: 'edge.upsert'; spaceId: string; edge: BrainEdge; orderIndex: number }
  | { kind: 'edge.delete'; edgeId: string }
  | { kind: 'todo.upsert'; spaceId: string; todo: TodoItem; orderIndex: number }
  | { kind: 'todo.delete'; todoId: string };

export type MutationBatch = {
  expectedRevision: number;
  nextRevision: number;
  mutations: WorkspaceMutation[];
};

export type LoadedWorkspace = {
  snapshot: AppSnapshot;
  revision: number;
};

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function settingsOf(snapshot: AppSnapshot): PersistedSettings {
  return {
    locale: snapshot.locale,
    theme: snapshot.theme,
    activeSpaceId: snapshot.activeSpaceId,
    lastOpenedAt: snapshot.lastOpenedAt,
    hasSeenTutorial: snapshot.hasSeenTutorial,
  };
}

function spaceRecord(space: Space): SpaceRecord {
  return {
    id: space.id,
    name: space.name,
    viewport: space.viewport,
    createdAt: space.createdAt,
    updatedAt: space.updatedAt,
  };
}

function indexById<T extends { id: string }>(items: T[]): Map<string, { item: T; index: number }> {
  return new Map(items.map((item, index) => [item.id, { item, index }]));
}

export function diffSnapshots(previous: AppSnapshot, current: AppSnapshot): WorkspaceMutation[] {
  const edgeDeletes: WorkspaceMutation[] = [];
  const nodeDeletes: WorkspaceMutation[] = [];
  const todoDeletes: WorkspaceMutation[] = [];
  const spaceDeletes: WorkspaceMutation[] = [];
  const spaceUpserts: WorkspaceMutation[] = [];
  const nodeUpserts: WorkspaceMutation[] = [];
  const edgeUpserts: WorkspaceMutation[] = [];
  const todoUpserts: WorkspaceMutation[] = [];

  const previousSpaces = indexById(previous.spaces);
  const currentSpaces = indexById(current.spaces);

  for (const oldSpace of previous.spaces) {
    if (!currentSpaces.has(oldSpace.id)) {
      spaceDeletes.push({ kind: 'space.delete', spaceId: oldSpace.id });
    }
  }

  for (const [spaceId, currentEntry] of currentSpaces) {
    const previousEntry = previousSpaces.get(spaceId);
    const currentSpace = currentEntry.item;
    const previousSpace = previousEntry?.item;

    if (
      !previousSpace ||
      currentEntry.index !== previousEntry.index ||
      !same(spaceRecord(previousSpace), spaceRecord(currentSpace))
    ) {
      spaceUpserts.push({
        kind: 'space.upsert',
        space: spaceRecord(currentSpace),
        orderIndex: currentEntry.index,
      });
    }

    const previousNodes = indexById(previousSpace?.nodes ?? []);
    const currentNodes = indexById(currentSpace.nodes);
    const previousEdges = indexById(previousSpace?.edges ?? []);
    const currentEdges = indexById(currentSpace.edges);
    const previousTodos = indexById(previousSpace?.todos ?? []);
    const currentTodos = indexById(currentSpace.todos);

    for (const oldEdge of previousSpace?.edges ?? []) {
      if (!currentEdges.has(oldEdge.id))
        edgeDeletes.push({ kind: 'edge.delete', edgeId: oldEdge.id });
    }
    for (const oldNode of previousSpace?.nodes ?? []) {
      if (!currentNodes.has(oldNode.id))
        nodeDeletes.push({ kind: 'node.delete', nodeId: oldNode.id });
    }
    for (const oldTodo of previousSpace?.todos ?? []) {
      if (!currentTodos.has(oldTodo.id))
        todoDeletes.push({ kind: 'todo.delete', todoId: oldTodo.id });
    }

    for (const [id, entry] of currentNodes) {
      const old = previousNodes.get(id);
      if (!old || old.index !== entry.index || !same(old.item, entry.item)) {
        nodeUpserts.push({
          kind: 'node.upsert',
          spaceId,
          node: entry.item,
          orderIndex: entry.index,
        });
      }
    }
    for (const [id, entry] of currentEdges) {
      const old = previousEdges.get(id);
      if (!old || old.index !== entry.index || !same(old.item, entry.item)) {
        edgeUpserts.push({
          kind: 'edge.upsert',
          spaceId,
          edge: entry.item,
          orderIndex: entry.index,
        });
      }
    }
    for (const [id, entry] of currentTodos) {
      const old = previousTodos.get(id);
      if (!old || old.index !== entry.index || !same(old.item, entry.item)) {
        todoUpserts.push({
          kind: 'todo.upsert',
          spaceId,
          todo: entry.item,
          orderIndex: entry.index,
        });
      }
    }
  }

  const settings = same(settingsOf(previous), settingsOf(current))
    ? []
    : [{ kind: 'settings.patch', settings: settingsOf(current) } as WorkspaceMutation];

  return [
    ...edgeDeletes,
    ...nodeDeletes,
    ...todoDeletes,
    ...spaceDeletes,
    ...spaceUpserts,
    ...nodeUpserts,
    ...edgeUpserts,
    ...todoUpserts,
    ...settings,
  ];
}
