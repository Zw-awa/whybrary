import type {
  PluginCommand,
  PluginContext,
  PluginPanel,
  PluginRuntimeInfo,
  PluginRuntimeStatus,
  WhybraryPlugin,
} from './types';

type PluginRecord = {
  plugin: WhybraryPlugin;
  source: 'built-in' | 'local';
  status: PluginRuntimeStatus;
  error?: string;
  disposers: (() => void)[];
};

export class PluginRegistry {
  private readonly records = new Map<string, PluginRecord>();
  private readonly panels = new Map<string, { owner: string; panel: PluginPanel }>();
  private readonly commands = new Map<string, { owner: string; command: PluginCommand }>();

  add(plugin: WhybraryPlugin, source: 'built-in' | 'local' = 'built-in'): () => void {
    if (this.records.has(plugin.id)) throw new Error(`Duplicate plugin: ${plugin.id}`);
    this.records.set(plugin.id, { plugin, source, status: 'disabled', disposers: [] });
    return () => {
      this.disable(plugin.id);
      this.records.delete(plugin.id);
    };
  }

  enable(id: string, context: Omit<PluginContext, 'registerPanel' | 'registerCommand'>): void {
    const record = this.records.get(id);
    if (!record || record.status === 'active' || record.status === 'activating') return;
    record.status = 'activating';
    record.error = undefined;
    const registerPanel = (panel: PluginPanel) => {
      if (this.panels.has(panel.id)) throw new Error(`Duplicate plugin panel: ${panel.id}`);
      this.panels.set(panel.id, { owner: id, panel });
      const dispose = () => this.panels.delete(panel.id);
      record.disposers.push(dispose);
      return dispose;
    };
    const registerCommand = (command: PluginCommand) => {
      if (this.commands.has(command.id)) throw new Error(`Duplicate plugin command: ${command.id}`);
      this.commands.set(command.id, { owner: id, command });
      const dispose = () => this.commands.delete(command.id);
      record.disposers.push(dispose);
      return dispose;
    };
    try {
      const dispose = record.plugin.activate({ ...context, registerPanel, registerCommand });
      if (dispose) record.disposers.push(dispose);
      record.status = 'active';
    } catch (error) {
      for (const dispose of [...record.disposers].reverse()) dispose();
      record.disposers = [];
      record.status = 'failed';
      record.error = error instanceof Error ? error.message : String(error);
    }
  }

  disable(id: string): void {
    const record = this.records.get(id);
    if (!record) return;
    for (const dispose of [...record.disposers].reverse()) dispose();
    record.disposers = [];
    for (const [panelId, entry] of this.panels) if (entry.owner === id) this.panels.delete(panelId);
    for (const [commandId, entry] of this.commands)
      if (entry.owner === id) this.commands.delete(commandId);
    record.status = 'disabled';
    record.error = undefined;
  }

  activate(context: Omit<PluginContext, 'registerPanel' | 'registerCommand'>): () => void {
    for (const id of this.records.keys()) this.enable(id, context);
    return () => this.disposeAll();
  }

  disposeAll(): void {
    for (const id of this.records.keys()) this.disable(id);
  }

  listPlugins(): WhybraryPlugin[] {
    return [...this.records.values()].map(({ plugin }) => plugin);
  }
  listPanels(): PluginPanel[] {
    return [...this.panels.values()].map(({ panel }) => panel);
  }
  listCommands(): PluginCommand[] {
    return [...this.commands.values()].map(({ command }) => command);
  }
  listRuntime(): PluginRuntimeInfo[] {
    return [...this.records.entries()].map(([id, record]) => ({
      id,
      name: typeof record.plugin.name === 'string' ? record.plugin.name : id,
      version: record.plugin.version,
      source: record.source,
      permissions: record.plugin.permissions ?? [],
      status: record.status,
      error: record.error,
    }));
  }
}
