import { invoke } from '@tauri-apps/api/core';
import type { PluginPermission, PluginRuntimeInfo } from './types';
import { validatePluginManifest, type PluginManifest } from './manifest';

export type PluginDirectoryConfig = { path: string; isDefault: boolean };
export type InstalledPlugin = {
  id: string;
  version: string;
  directory: string;
  source: string;
  enabled: boolean;
  approvedPermissions: PluginPermission[];
  installedAt: string;
  updatedAt: string;
  lastError?: string;
};
export type DiscoveredPlugin = {
  manifest: PluginManifest;
  directory: string;
  entryPath: string;
  state?: InstalledPlugin;
};
export type PluginDiscoveryResponse = {
  plugins: DiscoveredPlugin[];
  diagnostics: { path: string; code: string; message: string }[];
};
type RawPlugin = PluginManifest & {
  directory: string;
  entryPath: string;
  state?: RawInstalledPlugin;
};
type RawInstalledPlugin = Omit<InstalledPlugin, 'id'> & { pluginId: string };
const DIRECTORY_KEY = 'whybrary.plugins.directory';
export const PLUGIN_STATE_CHANGED_EVENT = 'whybrary:plugin-state-changed';

function notifyPluginStateChanged(): void {
  window.dispatchEvent(new Event(PLUGIN_STATE_CHANGED_EVENT));
}
function inTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}
function browserDirectory(): PluginDirectoryConfig {
  return {
    path: window.localStorage.getItem(DIRECTORY_KEY) ?? 'Whybrary/plugins',
    isDefault: !window.localStorage.getItem(DIRECTORY_KEY),
  };
}
function normalizeState(state: RawInstalledPlugin): InstalledPlugin {
  const { pluginId: id, ...rest } = state;
  return { id, ...rest };
}
function normalizePlugin(plugin: RawPlugin): DiscoveredPlugin {
  const {
    directory,
    entryPath,
    state,
    schemaVersion,
    id,
    name,
    version,
    engine,
    entry,
    permissions,
  } = plugin;
  return {
    directory,
    entryPath,
    manifest: { schemaVersion, id, name, version, engine, entry, permissions },
    ...(state ? { state: normalizeState(state) } : {}),
  };
}
export async function getPluginDirectory(): Promise<PluginDirectoryConfig> {
  return inTauri() ? invoke('get_plugin_directory') : browserDirectory();
}
export async function setPluginDirectory(path: string | null): Promise<PluginDirectoryConfig> {
  if (inTauri()) return invoke('set_plugin_directory', { path });
  if (path?.trim()) window.localStorage.setItem(DIRECTORY_KEY, path.trim());
  else window.localStorage.removeItem(DIRECTORY_KEY);
  return browserDirectory();
}
export async function discoverPlugins(): Promise<PluginDiscoveryResponse> {
  if (!inTauri()) return { plugins: [], diagnostics: [] };
  const response = await invoke<{
    plugins: RawPlugin[];
    diagnostics: PluginDiscoveryResponse['diagnostics'];
  }>('discover_plugins');
  return { plugins: response.plugins.map(normalizePlugin), diagnostics: response.diagnostics };
}
export async function installPlugin(sourcePath: string): Promise<InstalledPlugin> {
  const result = await invoke<{ state: RawInstalledPlugin }>('install_plugin', { sourcePath });
  const state = normalizeState(result.state);
  notifyPluginStateChanged();
  return state;
}
export async function uninstallPlugin(pluginId: string): Promise<void> {
  await invoke('uninstall_plugin', { pluginId });
  notifyPluginStateChanged();
}
export async function listInstalledPlugins(): Promise<InstalledPlugin[]> {
  if (!inTauri()) return [];
  return (await invoke<RawInstalledPlugin[]>('list_installed_plugins')).map(normalizeState);
}
export async function setPluginState(
  pluginId: string,
  enabled: boolean,
  approvedPermissions: PluginPermission[],
): Promise<InstalledPlugin> {
  const state = normalizeState(
    await invoke<RawInstalledPlugin>('set_plugin_state', {
      pluginId,
      enabled,
      approvedPermissions,
    }),
  );
  notifyPluginStateChanged();
  return state;
}
export type PluginBundle = {
  plugin: DiscoveredPlugin;
  code: string;
};

export async function loadPluginBundle(pluginId: string): Promise<PluginBundle> {
  const response = await invoke<{ plugin: RawPlugin; code: string }>('load_plugin_bundle', {
    pluginId,
  });
  return { plugin: normalizePlugin(response.plugin), code: response.code };
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
    permissions: manifest.permissions,
    status: 'disabled',
  };
}
export function parseManifest(value: unknown) {
  return validatePluginManifest(value);
}
