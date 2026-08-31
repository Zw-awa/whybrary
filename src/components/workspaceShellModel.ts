import type {
  AppLocale,
  AppSnapshot,
  BrainNode,
  NodeCategory,
  NodeColor,
  Space,
  TodoPriority,
} from '../types';
import type { PluginPanel, PluginViewItem } from '../plugins/types';
import type { TutorialStep } from './GuidedTutorial';

export type WorkspaceShellModel = {
  data: {
    activeSpace: Space;
    snapshot: AppSnapshot;
  };
  plugins: {
    panels: { panel: PluginPanel; items: PluginViewItem[] }[];
  };
  ui: {
    advancedEnabled: boolean;
    bannerMessage: string | null;
    editingNodeId: string | null;
    isMapEditing: boolean;
    saveLabel: string;
  };
  spaces: {
    create: () => void;
    deleteActive: () => void;
    renameActive: (name: string) => void;
    select: (id: string) => void;
  };
  history: {
    canRedo: boolean;
    canUndo: boolean;
    redo: () => void;
    undo: () => void;
  };
  workspace: {
    exportSnapshot: () => void;
    importSnapshot: () => void;
    openSettings: () => void;
    resetPreview: () => void;
  };
  preferences: {
    changeLocale: (locale: AppLocale) => void;
    toggleTheme: () => void;
  };
  map: {
    addNode: (position?: BrainNode['position']) => BrainNode;
    deleteNodes: (ids: string[]) => void;
    finishRenameNode: () => void;
    persistNodePositions: (nodes: BrainNode[]) => void;
    renameNode: (id: string, label: string) => void;
    requestDeleteNodes: (ids: string[], labels: string[]) => void;
    startRenameNode: (id: string) => void;
    toggleConnection: (source: string, target: string) => void;
    toggleEditing: () => void;
    updateNodeMetadata: (id: string, category?: NodeCategory, color?: NodeColor) => void;
    updateViewport: (viewport: Space['viewport']) => void;
  };
  todos: {
    add: (text: string) => void;
    delete: (id: string) => void;
    toggle: (id: string) => void;
    update: (id: string, text: string) => void;
    updateMetadata: (id: string, priority?: TodoPriority, dueDate?: string | null) => void;
  };
  tutorial: {
    back: () => void;
    exit: () => void;
    next: () => void;
    step: TutorialStep;
    visible: boolean;
  };
  persistence: {
    discardPreviewFallback: () => void;
    error: unknown;
    previewFallback: AppSnapshot | null;
    recoverPreviewFallback: () => void;
    retry: () => void;
  };
};
