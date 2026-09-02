import { invoke } from '@tauri-apps/api/core';
import type { PluginPermission, PluginRuntimeInfo } from './types';
import { validatePluginManifest, type PluginManifest } from './manifest';

export type PluginDirectoryConfig = {
  path: string;
  isDefault: boolean;
};

export type DiscoveredPlugin = {
  manifest?: PluginManifest;
  directory: string;
  entryPath?: string;
  diagnostic?: string;
};

const DIRECTORY_KEY = 'whybrary.plugins.directory';

function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function browserDirectory(): PluginDirectoryConfig {
  return {
    path: window.localStorage.getItem(DIRECTORY_KEY) ?? 'Whybrary/plugins',
    isDefault: !window.localStorage.getItem(DIRECTORY_KEY),
  };
}

export async function getPluginDirectory(): Promise<PluginDirectoryConfig> {
  if (inTauri()) return invoke<PluginDirectoryConfig>('get_plugin_directory');
  return browserDirectory();
}

export async function setPluginDirectory(path: string | null): Promise<PluginDirectoryConfig> {
  if (inTauri()) return invoke<PluginDirectoryConfig>('set_plugin_directory', { path });
  if (path?.trim()) window.localStorage.setItem(DIRECTORY_KEY, path.trim());
  else window.localStorage.removeItem(DIRECTORY_KEY);
  return browserDirectory();
}

export type PluginDiscoveryResponse = {
  plugins: DiscoveredPlugin[];
  diagnostics: { path: string; code: string; message: string }[];
};

export async function discoverPlugins(): Promise<PluginDiscoveryResponse> {
  if (inTauri()) return invoke<PluginDiscoveryResponse>('discover_plugins');
  return { plugins: [], diagnostics: [] };
}

export function fromManifest(
  manifest: PluginManifest,
  source: 'built-in' | 'local' = 'local',
): PluginRuntimeInfo {
  return {
    id: manifest.id,
    name: manifest.name,
    version: manifest.version,
    source,
    permissions: manifest.permissions as PluginPermission[],
    status: 'disabled',
  };
}

export function parseManifest(value: unknown) {
  return validatePluginManifest(value);
}
