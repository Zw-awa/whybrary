import { afterEach, describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from './registry';
import { ExternalPluginLoader } from './externalLoader';
import type { DiscoveredPlugin } from './platform';

const { loadPluginBundle } = vi.hoisted(() => ({ loadPluginBundle: vi.fn() }));
vi.mock('./platform', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./platform')>()),
  loadPluginBundle,
}));

const plugin: DiscoveredPlugin = {
  directory: 'plugins/example.plugin',
  entryPath: 'plugins/example.plugin/index.js',
  manifest: {
    schemaVersion: 1,
    id: 'example.plugin',
    name: 'Example',
    version: '1.0.0',
    engine: 'whybrary',
    entry: 'index.js',
    permissions: ['ui:panel'],
  },
  state: {
    id: 'example.plugin',
    version: '1.0.0',
    directory: 'plugins/example.plugin',
    source: 'local',
    enabled: true,
    approvedPermissions: ['ui:panel'],
    installedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

const context = { getSnapshot: vi.fn(), subscribe: () => () => undefined };

afterEach(() => vi.restoreAllMocks());

describe('ExternalPluginLoader', () => {
  it('loads a matching enabled bundle with its approved permissions', async () => {
    loadPluginBundle.mockResolvedValue({
      plugin,
      code: `export default { id: 'example.plugin', name: 'Example', version: '1.0.0', permissions: ['ui:panel'], activate(ctx) { return ctx.registerPanel({ id: 'example.panel', title: 'Example', description: 'Example', getItems: () => [] }); } };`,
    });
    const registry = new PluginRegistry();
    const loader = new ExternalPluginLoader(registry, async () => ({
      id: 'example.plugin',
      name: 'Example',
      version: '1.0.0',
      permissions: ['ui:panel'],
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'example.panel',
          title: 'Example',
          description: 'Example',
          getItems: () => [],
        }),
    }));

    await loader.sync([plugin], context, true);
    expect(registry.listPanels().map((panel) => panel.id)).toEqual(['example.panel']);
    loader.disposeAll();
    expect(registry.listPanels()).toEqual([]);
  });

  it('rejects a bundle whose export does not match its manifest', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    loadPluginBundle.mockResolvedValue({
      plugin,
      code: `export default { id: 'other.plugin', name: 'Other', version: '1.0.0', permissions: ['ui:panel'], activate() {} };`,
    });
    const registry = new PluginRegistry();
    const loader = new ExternalPluginLoader(registry, async () => ({
      id: 'other.plugin',
      name: 'Other',
      version: '1.0.0',
      permissions: ['ui:panel'],
      activate: () => undefined,
    }));

    await loader.sync([plugin], context, true);

    expect(registry.listRuntime()).toEqual([]);
    expect(error).toHaveBeenCalled();
  });
});
