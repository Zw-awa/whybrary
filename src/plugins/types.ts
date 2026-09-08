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

export type PluginSettings = {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => Promise<void>;
};

/**
 * Host-side storage abstraction for plugin settings. `PluginRegistry` depends
 * only on this interface; concrete implementations may persist to SQLite
 * (Tauri), an in-memory map (tests/browser preview), or a future remote store.
 */
export type PluginSettingsStore = {
  /** Load every stored value for one plugin into a plain record. */
  load: (pluginId: string) => Promise<Record<string, unknown>>;
  /** Persist one value; rejects on storage failure. */
  set: (pluginId: string, key: string, value: unknown) => Promise<void>;
  /** Remove every stored value for one plugin (used on uninstall). */
  clear: (pluginId: string) => Promise<void>;
};
export type PluginContext = {
  getSnapshot: () => AppSnapshot;
  subscribe: (listener: () => void) => () => void;
  settings?: PluginSettings;
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
