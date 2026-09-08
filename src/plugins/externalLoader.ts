import type {
  PluginContext,
  PluginPermission,
  PluginRuntimeInfo,
  PluginRuntimeStatus,
  WhybraryPlugin,
} from './types';
import { PluginRegistry } from './registry';
import { loadPluginBundle, type DiscoveredPlugin } from './platform';

function matchesManifest(plugin: WhybraryPlugin, discovered: DiscoveredPlugin): boolean {
  const manifest = discovered.manifest;
  const permissions = plugin.permissions ?? [];
  return (
    plugin.id === manifest.id &&
    plugin.version === manifest.version &&
    permissions.length === manifest.permissions.length &&
    permissions.every((permission) => manifest.permissions.includes(permission))
  );
}

function isPlugin(value: unknown): value is WhybraryPlugin {
  if (!value || typeof value !== 'object') return false;
  const plugin = value as Partial<WhybraryPlugin>;
  return (
    typeof plugin.id === 'string' &&
    typeof plugin.name === 'string' &&
    typeof plugin.version === 'string' &&
    typeof plugin.activate === 'function' &&
    (!plugin.permissions || Array.isArray(plugin.permissions))
  );
}

async function importBundle(code: string, pluginId: string): Promise<WhybraryPlugin> {
  const blob = new Blob([`${code}\n//# sourceURL=whybrary-plugin-${pluginId}.mjs`], {
    type: 'text/javascript',
  });
  const url = URL.createObjectURL(blob);
  try {
    const module = await import(/* @vite-ignore */ url);
    if (!isPlugin(module.default))
      throw new Error(`Plugin ${pluginId} entry must export a default plugin object.`);
    return module.default;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ExternalPluginRuntime = PluginRuntimeInfo & { status: PluginRuntimeStatus };
export type ExternalPluginStatusListener = (statuses: ExternalPluginRuntime[]) => void;
export const PLUGIN_RUNTIME_STATUS_EVENT = 'whybrary:plugin-runtime-status';

export class ExternalPluginLoader {
  private readonly removers = new Map<string, () => void>();
  private syncGeneration = 0;
  private statuses: ExternalPluginRuntime[] = [];

  constructor(
    private readonly registry: PluginRegistry,
    private readonly bundleImporter: (
      code: string,
      pluginId: string,
    ) => Promise<WhybraryPlugin> = importBundle,
  ) {}

  getRuntime(): ExternalPluginRuntime[] {
    return this.statuses;
  }

  async sync(
    plugins: DiscoveredPlugin[],
    context: Omit<PluginContext, 'registerPanel' | 'registerCommand'>,
    enabled: boolean,
    onStatus?: ExternalPluginStatusListener,
  ): Promise<void> {
    this.disposeAll();
    const generation = this.syncGeneration;
    this.statuses = plugins.map((plugin) => ({
      id: plugin.manifest.id,
      name: plugin.manifest.name,
      version: plugin.manifest.version,
      source: 'local',
      permissions: plugin.manifest.permissions,
      status: !enabled || !plugin.state?.enabled ? 'disabled' : 'activating',
    }));
    onStatus?.(this.statuses);
    if (!enabled) return;
    for (const discovered of plugins) {
      const state = discovered.state;
      if (!state?.enabled) continue;
      try {
        const bundle = await loadPluginBundle(discovered.manifest.id);
        const plugin = await this.bundleImporter(bundle.code, bundle.plugin.manifest.id);
        if (generation !== this.syncGeneration) return;
        if (!matchesManifest(plugin, bundle.plugin)) {
          throw new Error(
            `Plugin ${bundle.plugin.manifest.id} export does not match its manifest.`,
          );
        }
        const remove = this.registry.add(plugin, 'local');
        this.removers.set(plugin.id, remove);
        await this.registry.preloadSettings(plugin.id);
        this.registry.enable(plugin.id, context, state.approvedPermissions as PluginPermission[]);
        const runtime = this.registry.listRuntime().find((entry) => entry.id === plugin.id);
        if (runtime?.status === 'failed') {
          this.updateStatus(
            plugin.id,
            { status: 'failed', error: runtime.error ?? 'Plugin activation failed.' },
            onStatus,
          );
        } else {
          this.updateStatus(plugin.id, { status: 'active' }, onStatus);
        }
      } catch (error) {
        if (generation !== this.syncGeneration) return;
        this.updateStatus(
          discovered.manifest.id,
          { status: 'failed', error: error instanceof Error ? error.message : String(error) },
          onStatus,
        );
      }
    }
  }

  disposeAll(): void {
    this.syncGeneration += 1;
    for (const remove of this.removers.values()) remove();
    this.removers.clear();
  }

  private updateStatus(
    id: string,
    update: Partial<ExternalPluginRuntime>,
    onStatus?: ExternalPluginStatusListener,
  ): void {
    this.statuses = this.statuses.map((status) =>
      status.id === id ? { ...status, ...update } : status,
    );
    onStatus?.(this.statuses);
  }
}
