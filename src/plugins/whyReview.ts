import type { AppLocale, AppSnapshot, Space } from '../types';
import type { PluginPanel, PluginViewItem, WhybraryPlugin } from './types';

function text(locale: AppLocale, zh: string, en: string) { return locale === 'zh' ? zh : en; }

export const whyReviewPanel: PluginPanel = {
  id: 'why-review.review',
  title: 'Why Review',
  description: 'A quick check of the current thinking space.',
  getItems(snapshot: AppSnapshot, locale: AppLocale): PluginViewItem[] {
    const space = snapshot.spaces.find((item) => item.id === snapshot.activeSpaceId) ?? snapshot.spaces[0];
    if (!space) return [];
    return reviewSpace(space, locale);
  },
};

export function reviewSpace(space: Space, locale: AppLocale): PluginViewItem[] {
  const items: PluginViewItem[] = [];
  const nodeIds = new Set(space.nodes.map((node) => node.id));
  const connected = new Set<string>();
  const seenEdges = new Set<string>();

  for (const edge of space.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      items.push({ id: `edge.missing.${edge.id}`, label: text(locale, '存在指向不存在节点的连接', 'A connection points to a missing node.'), detail: edge.id, tone: 'warning' });
      continue;
    }
    connected.add(edge.source); connected.add(edge.target);
    if (edge.source === edge.target) items.push({ id: `edge.self.${edge.id}`, label: text(locale, '存在自连接', 'A node is connected to itself.'), detail: edge.id, tone: 'warning' });
    const key = [edge.source, edge.target].sort().join('|');
    if (seenEdges.has(key)) items.push({ id: `edge.duplicate.${edge.id}`, label: text(locale, '存在重复连接', 'Duplicate connections exist.'), detail: edge.id, tone: 'warning' });
    seenEdges.add(key);
  }

  for (const node of space.nodes) {
    if (!node.data.label.trim()) items.push({ id: `node.empty.${node.id}`, label: text(locale, '有一个节点还没有写下内容', 'A node is still empty.'), detail: node.id, tone: 'warning' });
    if (space.nodes.length > 1 && !connected.has(node.id)) items.push({ id: `node.orphan.${node.id}`, label: text(locale, '有一个节点尚未连接到思考图谱', 'A node is disconnected from the graph.'), detail: node.data.label || node.id, tone: 'warning' });
  }

  const openTodos = space.todos.filter((todo) => !todo.completed);
  if (openTodos.length === 0) items.push({ id: 'todo.none-open', label: text(locale, '当前没有待推进的行动', 'There are no open actions.'), tone: 'neutral' });
  for (const todo of openTodos) {
    if (!todo.text.trim()) items.push({ id: `todo.empty.${todo.id}`, label: text(locale, '有一个行动还没有写清楚', 'An action is still empty.'), detail: todo.id, tone: 'warning' });
  }
  if (items.length === 0) items.push({ id: 'review.clear', label: text(locale, '这个空间目前没有明显问题', 'No obvious issues in this space.'), tone: 'success' });
  return items;
}

export const whyReviewPlugin: WhybraryPlugin = {
  id: 'why-review',
  name: 'Why Review',
  version: '0.1.0',
  activate(context) {
    const disposePanel = context.registerPanel(whyReviewPanel);
    return disposePanel;
  },
};
