import { useEffect, useState } from 'react';
import {
  discoverPlugins,
  getPluginDirectory,
  installPlugin,
  listInstalledPlugins,
  setPluginDirectory,
  uninstallPlugin,
  type DiscoveredPlugin,
  type InstalledPlugin,
  type PluginDirectoryConfig,
} from '../plugins/platform';
import type { AppLocale } from '../types';

type PluginManagerProps = { enabled: boolean; locale: AppLocale };

export function PluginManager({ enabled, locale }: PluginManagerProps) {
  const [directory, setDirectory] = useState<PluginDirectoryConfig | null>(null);
  const [plugins, setPlugins] = useState<DiscoveredPlugin[]>([]);
  const [installed, setInstalled] = useState<InstalledPlugin[]>([]);
  const [sourcePath, setSourcePath] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [nextDirectory, nextPlugins, nextInstalled] = await Promise.all([
        getPluginDirectory(),
        discoverPlugins(),
        listInstalledPlugins(),
      ]);
      setDirectory(nextDirectory);
      setDraft(nextDirectory.path);
      setPlugins(nextPlugins.plugins);
      setInstalled(nextInstalled);
      setError(
        nextPlugins.diagnostics
          .map((diagnostic) => `${diagnostic.code}: ${diagnostic.message}`)
          .join('\n') || null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const strings =
    locale === 'zh'
      ? {
          title: '插件目录',
          body: '插件仅从此目录发现。导入的工作区和项目文件不会自动提供或执行插件。',
          save: '保存目录',
          reset: '恢复默认目录',
          refresh: '重新扫描',
          empty: '没有发现插件',
          disabled: '启用插件功能后，才能运行已发现的插件。',
          invalid: '无效插件',
          install: '安装插件',
          source: '插件源目录',
          uninstall: '卸载',
          installed: '已安装',
        }
      : {
          title: 'Plugin directory',
          body: 'Plugins are discovered only from this directory. Imported workspaces and project files never provide or run plugins automatically.',
          save: 'Save directory',
          reset: 'Use default directory',
          refresh: 'Rescan',
          empty: 'No plugins found',
          disabled: 'Enable plugin support before any discovered plugin can run.',
          invalid: 'Invalid plugin',
          install: 'Install plugin',
          source: 'Source plugin folder',
          uninstall: 'Uninstall',
          installed: 'Installed',
        };

  const install = async () => {
    if (!sourcePath.trim()) return;
    try {
      await installPlugin(sourcePath.trim());
      setSourcePath('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const uninstall = async (id: string) => {
    try {
      await uninstallPlugin(id);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <section className="settings-card__section plugin-manager">
      <div>
        <strong>{strings.title}</strong>
        <p>{strings.body}</p>
      </div>
      <div className="plugin-manager__directory">
        <input
          aria-label={strings.title}
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <button
          className="button"
          onClick={() => void setPluginDirectory(draft.trim() || null).then(refresh)}
          type="button"
        >
          {strings.save}
        </button>
        {!directory?.isDefault ? (
          <button
            className="button button--ghost"
            onClick={() => void setPluginDirectory(null).then(refresh)}
            type="button"
          >
            {strings.reset}
          </button>
        ) : null}
      </div>
      <div className="plugin-manager__directory">
        <input
          aria-label={strings.source}
          onChange={(event) => setSourcePath(event.target.value)}
          placeholder={strings.source}
          value={sourcePath}
        />
        <button
          className="button"
          disabled={!sourcePath.trim()}
          onClick={() => void install()}
          type="button"
        >
          {strings.install}
        </button>
      </div>
      <div className="plugin-manager__actions">
        <button className="button button--ghost" onClick={() => void refresh()} type="button">
          {strings.refresh}
        </button>
        {!enabled ? <small>{strings.disabled}</small> : null}
      </div>
      {error ? <p className="plugin-manager__error">{error}</p> : null}
      <ul className="plugin-manager__list">
        {plugins.length === 0 ? (
          <li>{strings.empty}</li>
        ) : (
          plugins.map((plugin) => {
            const state = plugin.manifest
              ? installed.find((item) => item.id === plugin.manifest?.id)
              : undefined;
            return (
              <li key={plugin.directory}>
                {plugin.manifest ? (
                  <>
                    <strong>{plugin.manifest.name}</strong>
                    <span>
                      {plugin.manifest.version} · {plugin.manifest.id}
                      {state ? ` · ${strings.installed}` : ''}
                    </span>
                    <small>{plugin.manifest.permissions.join(', ') || 'No permissions'}</small>
                    {state ? (
                      <button
                        className="button button--ghost"
                        onClick={() => void uninstall(plugin.manifest!.id)}
                        type="button"
                      >
                        {strings.uninstall}
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <strong>{strings.invalid}</strong>
                    <small>{plugin.diagnostic}</small>
                  </>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
