export type ThemeMode = 'light' | 'dark';

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
  type?: string;
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
  type?: string;
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
  theme: ThemeMode;
  spaces: Space[];
  activeSpaceId: string | null;
  lastOpenedAt: string;
};
