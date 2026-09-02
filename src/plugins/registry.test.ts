import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from './registry';

const context = { getSnapshot: vi.fn(), subscribe: () => () => undefined };

describe('PluginRegistry', () => {
  it('activates contributions and disposes them in reverse order', () => {
    const registry = new PluginRegistry();
    const cleanups: string[] = [];
    registry.add({
      id: 'test',
      name: 'Test',
      version: '1.0.0',
      activate(pluginContext) {
        const panel = pluginContext.registerPanel({
          id: 'test.panel',
          title: 'Test',
          description: 'Test',
          getItems: () => [],
        });
        return () => {
          panel();
          cleanups.push('plugin');
        };
      },
    });
    const dispose = registry.activate(context);
    expect(registry.listPanels()).toHaveLength(1);
    dispose();
    expect(registry.listPanels()).toHaveLength(0);
    expect(cleanups).toEqual(['plugin']);
  });

  it('disables one plugin without removing another plugin contributions', () => {
    const registry = new PluginRegistry();
    registry.add({
      id: 'first',
      name: 'First',
      version: '1',
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'first.panel',
          title: 'First',
          description: 'First',
          getItems: () => [],
        }),
    });
    registry.add({
      id: 'second',
      name: 'Second',
      version: '1',
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'second.panel',
          title: 'Second',
          description: 'Second',
          getItems: () => [],
        }),
    });
    registry.activate(context);
    registry.disable('first');
    expect(registry.listPanels().map((panel) => panel.id)).toEqual(['second.panel']);
    expect(registry.listRuntime()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'first', status: 'disabled' }),
        expect.objectContaining({ id: 'second', status: 'active' }),
      ]),
    );
  });

  it('isolates activation errors to the failed plugin', () => {
    const registry = new PluginRegistry();
    registry.add({
      id: 'broken',
      name: 'Broken',
      version: '1',
      activate: () => {
        throw new Error('broken plugin');
      },
    });
    registry.add({
      id: 'healthy',
      name: 'Healthy',
      version: '1',
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'healthy.panel',
          title: 'Healthy',
          description: 'Healthy',
          getItems: () => [],
        }),
    });
    registry.activate(context);
    expect(registry.listPanels().map((panel) => panel.id)).toEqual(['healthy.panel']);
    expect(registry.listRuntime()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'broken', status: 'failed', error: 'broken plugin' }),
      ]),
    );
  });

  it('rejects duplicate plugin ids', () => {
    const registry = new PluginRegistry();
    const plugin = { id: 'same', name: 'Same', version: '1', activate: () => undefined };
    registry.add(plugin);
    expect(() => registry.add(plugin)).toThrow('Duplicate plugin');
  });
});
