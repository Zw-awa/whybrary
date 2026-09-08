import { invoke } from '@tauri-apps/api/core';
import type { PluginSettingsStore } from './types';

/** In-memory settings store used by tests, browser preview, and built-in plugins. */
export function createInMemoryPluginSettingsStore(): PluginSettingsStore {
  const records = new Map<string, Record<string, unknown>>();
  return {
    load: async (pluginId) => ({ ...(records.get(pluginId) ?? {}) }),
    set: async (pluginId, key, value) => {
      const current = records.get(pluginId) ?? {};
      current[key] = value;
      records.set(pluginId, current);
    },
    clear: async (pluginId) => {
      records.delete(pluginId);
    },
  };
}

function hasTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

/** SQLite-backed settings store used in the desktop app. */
export function createTauriPluginSettingsStore(): PluginSettingsStore {
  return {
    load: async (pluginId) => invoke<Record<string, unknown>>('list_plugin_settings', { pluginId }),
    set: async (pluginId, key, value) => {
      await invoke('set_plugin_setting', { pluginId, key, value });
    },
    clear: async (pluginId) => {
      await invoke('delete_plugin_settings', { pluginId });
    },
  };
}

/**
 * Returns the appropriate store for the current host: SQLite on desktop,
 * in-memory in browser preview or tests.
 */
export function createPluginSettingsStore(): PluginSettingsStore {
  return hasTauriRuntime() ? createTauriPluginSettingsStore() : createInMemoryPluginSettingsStore();
}
