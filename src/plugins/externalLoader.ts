import type { PluginContext, PluginPermission, WhybraryPlugin } from './types';
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

export class ExternalPluginLoader {
  private readonly removers = new Map<string, () => void>();

  constructor(
    private readonly registry: PluginRegistry,
    private readonly bundleImporter: (
      code: string,
      pluginId: string,
    ) => Promise<WhybraryPlugin> = importBundle,
  ) {}

  async sync(
    plugins: DiscoveredPlugin[],
    context: Omit<PluginContext, 'registerPanel' | 'registerCommand'>,
    enabled: boolean,
  ): Promise<void> {
    this.disposeAll();
    if (!enabled) return;
    for (const discovered of plugins) {
      const state = discovered.state;
      if (!state?.enabled) continue;
      try {
        const bundle = await loadPluginBundle(discovered.manifest.id);
        const plugin = await this.bundleImporter(bundle.code, bundle.plugin.manifest.id);
        if (!matchesManifest(plugin, bundle.plugin)) {
          throw new Error(
            `Plugin ${bundle.plugin.manifest.id} export does not match its manifest.`,
          );
        }
        const remove = this.registry.add(plugin, 'local');
        this.removers.set(plugin.id, remove);
        this.registry.enable(plugin.id, context, state.approvedPermissions as PluginPermission[]);
      } catch (error) {
        console.error(`Unable to load plugin ${discovered.manifest.id}:`, error);
      }
    }
  }

  disposeAll(): void {
    for (const remove of this.removers.values()) remove();
    this.removers.clear();
  }
}
