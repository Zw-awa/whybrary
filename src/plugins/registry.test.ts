import { describe, expect, it, vi } from 'vitest';
import { PluginRegistry } from './registry';

describe('PluginRegistry', () => {
  it('activates contributions and disposes them in reverse order', () => {
    const registry = new PluginRegistry();
    const cleanups: string[] = [];
    registry.add({
      id: 'test', name: 'Test', version: '1.0.0',
      activate(context) {
        const panel = context.registerPanel({ id: 'test.panel', title: 'Test', description: 'Test', getItems: () => [] });
        return () => { panel(); cleanups.push('plugin'); };
      },
    });
    const dispose = registry.activate({ getSnapshot: vi.fn(), subscribe: () => () => undefined });
    expect(registry.listPanels()).toHaveLength(1);
    dispose();
    expect(registry.listPanels()).toHaveLength(0);
    expect(cleanups).toEqual(['plugin']);
  });

  it('rejects duplicate plugin and contribution ids', () => {
    const registry = new PluginRegistry();
    const plugin = { id: 'same', name: 'Same', version: '1', activate: () => undefined };
    registry.add(plugin);
    expect(() => registry.add(plugin)).toThrow('Duplicate plugin');
  });
});
