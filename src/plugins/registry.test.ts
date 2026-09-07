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
      permissions: ['ui:panel'],
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
    const dispose = registry.activate(context, { test: ['ui:panel'] });
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
      permissions: ['ui:panel'],
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
      permissions: ['ui:panel'],
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'second.panel',
          title: 'Second',
          description: 'Second',
          getItems: () => [],
        }),
    });
    registry.activate(context, { first: ['ui:panel'], second: ['ui:panel'] });
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
      permissions: ['ui:panel'],
      activate: (ctx) =>
        ctx.registerPanel({
          id: 'healthy.panel',
          title: 'Healthy',
          description: 'Healthy',
          getItems: () => [],
        }),
    });
    registry.activate(context, { healthy: ['ui:panel'] });
    expect(registry.listPanels().map((panel) => panel.id)).toEqual(['healthy.panel']);
    expect(registry.listRuntime()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'broken', status: 'failed', error: 'broken plugin' }),
      ]),
    );
  });

  it('denies capabilities that are not approved', () => {
    const registry = new PluginRegistry();
    registry.add({
      id: 'restricted',
      name: 'Restricted',
      version: '1',
      permissions: ['workspace:read', 'ui:panel'],
      activate: (ctx) => {
        expect(() => ctx.getSnapshot()).toThrow('workspace:read');
        expect(() =>
          ctx.registerPanel({
            id: 'restricted.panel',
            title: 'x',
            description: 'x',
            getItems: () => [],
          }),
        ).toThrow('ui:panel');
      },
    });
    registry.activate(context, { restricted: [] });
    expect(registry.listRuntime()[0]).toMatchObject({ id: 'restricted', status: 'active' });
  });
  it('isolates plugin settings and enforces settings permissions', () => {
    const registry = new PluginRegistry();
    registry.add({
      id: 'settings-plugin',
      name: 'Settings',
      version: '1',
      permissions: ['settings:read', 'settings:write'],
      activate: (ctx) => {
        ctx.settings?.set('view.mode', 'compact');
        expect(ctx.settings?.get('view.mode')).toBe('compact');
      },
    });
    registry.add({
      id: 'no-settings',
      name: 'No settings',
      version: '1',
      permissions: ['settings:read'],
      activate: (ctx) => expect(() => ctx.settings?.set('x', true)).toThrow('settings:write'),
    });

    registry.activate(context, {
      'settings-plugin': ['settings:read', 'settings:write'],
      'no-settings': ['settings:read'],
    });
    expect(registry.listRuntime()).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'no-settings', status: 'active' })]),
    );
  });

  it('rejects duplicate plugin ids', () => {
    const registry = new PluginRegistry();
    const plugin = { id: 'same', name: 'Same', version: '1', activate: () => undefined };
    registry.add(plugin);
    expect(() => registry.add(plugin)).toThrow('Duplicate plugin');
  });
});
