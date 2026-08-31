import type { PluginCommand, PluginContext, PluginPanel, WhybraryPlugin } from './types';

export class PluginRegistry {
  private readonly plugins = new Map<string, WhybraryPlugin>();
  private readonly panels = new Map<string, PluginPanel>();
  private readonly commands = new Map<string, PluginCommand>();
  private disposers: (() => void)[] = [];

  add(plugin: WhybraryPlugin): () => void {
    if (this.plugins.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    this.plugins.set(plugin.id, plugin);
    return () => {
      this.disposePlugin(plugin.id);
      this.plugins.delete(plugin.id);
    };
  }

  activate(context: Omit<PluginContext, 'registerPanel' | 'registerCommand'>): () => void {
    const disposers: (() => void)[] = [];
    const registerPanel = (panel: PluginPanel) => {
      if (this.panels.has(panel.id)) throw new Error(`Duplicate plugin panel: ${panel.id}`);
      this.panels.set(panel.id, panel);
      const dispose = () => this.panels.delete(panel.id);
      disposers.push(dispose);
      return dispose;
    };
    const registerCommand = (command: PluginCommand) => {
      if (this.commands.has(command.id)) throw new Error(`Duplicate plugin command: ${command.id}`);
      this.commands.set(command.id, command);
      const dispose = () => this.commands.delete(command.id);
      disposers.push(dispose);
      return dispose;
    };
    const pluginContext = { ...context, registerPanel, registerCommand };
    for (const plugin of this.plugins.values()) {
      const dispose = plugin.activate(pluginContext);
      if (dispose) disposers.push(dispose);
    }
    this.disposers = disposers;
    return () => {
      for (const dispose of [...this.disposers].reverse()) dispose();
      this.disposers = [];
    };
  }

  disposePlugin(id: string) {
    const plugin = this.plugins.get(id);
    if (!plugin) return;
    for (const panelId of [...this.panels.keys()]) {
      if (panelId.startsWith(`${id}.`)) this.panels.delete(panelId);
    }
  }

  listPlugins(): WhybraryPlugin[] { return [...this.plugins.values()]; }
  listPanels(): PluginPanel[] { return [...this.panels.values()]; }
  listCommands(): PluginCommand[] { return [...this.commands.values()]; }
}
