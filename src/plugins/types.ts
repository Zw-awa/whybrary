import type { AppLocale, AppSnapshot } from '../types';

export type PluginPermission =
  'workspace:read' | 'ui:panel' | 'commands:register' | 'settings:read' | 'settings:write';

type Localized = string | ((locale: AppLocale) => string);

export type PluginViewItem = {
  id: string;
  label: string;
  detail?: string;
  tone?: 'neutral' | 'warning' | 'success';
};

export type PluginPanel = {
  id: string;
  title: Localized;
  description: Localized;
  getItems: (snapshot: AppSnapshot, locale: AppLocale) => PluginViewItem[];
};

export type PluginCommand = {
  id: string;
  label: Localized;
  run: (context: PluginContext) => void;
};

export type PluginContext = {
  getSnapshot: () => AppSnapshot;
  subscribe: (listener: () => void) => () => void;
  registerPanel: (panel: PluginPanel) => () => void;
  registerCommand: (command: PluginCommand) => () => void;
};

export type WhybraryPlugin = {
  id: string;
  name: Localized;
  version: string;
  permissions?: PluginPermission[];
  activate: (context: PluginContext) => void | (() => void);
};

export type PluginRuntimeStatus = 'disabled' | 'activating' | 'active' | 'failed';

export type PluginRuntimeInfo = {
  id: string;
  name: string;
  version: string;
  source: 'built-in' | 'local';
  permissions: PluginPermission[];
  status: PluginRuntimeStatus;
  error?: string;
};
