export type ThemeMode = 'light' | 'dark';
export type AppLocale = 'en' | 'zh';
export type DeviceLayoutMode = 'phone' | 'tablet' | 'desktop';
export type MobilePrimaryView = 'map' | 'todo' | 'spaces';

export type ViewportState = {
  x: number;
  y: number;
  zoom: number;
};

export type BrainNodeData = {
  label: string;
  onLabelChange?: (id: string, nextLabel: string) => void;
  onStartRename?: (id: string) => void;
  onFinishRename?: () => void;
  isEditing?: boolean;
};

export type BrainNode = {
  id: string;
  position: {
    x: number;
    y: number;
  };
  data: BrainNodeData;
};

export type BrainEdge = {
  id: string;
  source: string;
  target: string;
};

export type TodoItem = {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type Space = {
  id: string;
  name: string;
  nodes: BrainNode[];
  edges: BrainEdge[];
  todos: TodoItem[];
  viewport: ViewportState;
  createdAt: string;
  updatedAt: string;
};

export type AppSnapshot = {
  locale: AppLocale;
  theme: ThemeMode;
  spaces: Space[];
  activeSpaceId: string | null;
  lastOpenedAt: string;
  hasSeenTutorial: boolean;
};
// SPDX-FileCopyrightText: 2026 Zw-awa
// SPDX-License-Identifier: MIT
