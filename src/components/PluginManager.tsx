import { useEffect, useState } from 'react';
import {
  discoverPlugins,
  getPluginDirectory,
  setPluginDirectory,
  type DiscoveredPlugin,
  type PluginDirectoryConfig,
} from '../plugins/platform';
import type { AppLocale } from '../types';

type PluginManagerProps = {
  enabled: boolean;
  locale: AppLocale;
};

export function PluginManager({ enabled, locale }: PluginManagerProps) {
  const [directory, setDirectory] = useState<PluginDirectoryConfig | null>(null);
  const [plugins, setPlugins] = useState<DiscoveredPlugin[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      const [nextDirectory, nextPlugins] = await Promise.all([
        getPluginDirectory(),
        discoverPlugins(),
      ]);
      setDirectory(nextDirectory);
      setDraft(nextDirectory.path);
      setPlugins(nextPlugins.plugins);
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

  const saveDirectory = async () => {
    try {
      await setPluginDirectory(draft.trim() || null);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };

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
        <button className="button" onClick={() => void saveDirectory()} type="button">
          {strings.save}
        </button>
        {!directory?.isDefault ? (
          <button
            className="button button--ghost"
            onClick={() => {
              setDraft('');
              void setPluginDirectory(null).then(refresh);
            }}
            type="button"
          >
            {strings.reset}
          </button>
        ) : null}
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
          plugins.map((plugin) => (
            <li key={plugin.directory}>
              {plugin.manifest ? (
                <>
                  <strong>{plugin.manifest.name}</strong>
                  <span>
                    {plugin.manifest.version} · {plugin.manifest.id}
                  </span>
                  <small>{plugin.manifest.permissions.join(', ') || 'No permissions'}</small>
                </>
              ) : (
                <>
                  <strong>{strings.invalid}</strong>
                  <small>{plugin.diagnostic}</small>
                </>
              )}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
