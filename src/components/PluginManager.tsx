import { useEffect, useState } from 'react';
import {
  discoverPlugins,
  getPluginDirectory,
  installPlugin,
  setPluginDirectory,
  setPluginState,
  uninstallPlugin,
  type DiscoveredPlugin,
  type PluginDirectoryConfig,
} from '../plugins/platform';
import type { AppLocale } from '../types';

type PluginManagerProps = { enabled: boolean; locale: AppLocale };

export function PluginManager({ enabled, locale }: PluginManagerProps) {
  const [directory, setDirectory] = useState<PluginDirectoryConfig | null>(null);
  const [plugins, setPlugins] = useState<DiscoveredPlugin[]>([]);
  const [sourcePath, setSourcePath] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    try {
      const [nextDirectory, response] = await Promise.all([
        getPluginDirectory(),
        discoverPlugins(),
      ]);
      setDirectory(nextDirectory);
      setDraft(nextDirectory.path);
      setPlugins(response.plugins);
      setError(
        response.diagnostics.map((item) => `${item.code}: ${item.message}`).join('\n') || null,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const words =
    locale === 'zh'
      ? {
          title: '插件目录',
          body: '插件仅从此目录发现。导入的工作区和项目文件不会自动提供或执行插件。',
          save: '保存目录',
          reset: '恢复默认目录',
          scan: '重新扫描',
          empty: '没有发现插件',
          off: '启用插件功能后，才能运行已发现的插件。',
          install: '安装插件',
          source: '插件源目录',
          uninstall: '卸载',
          installed: '已安装',
          enable: '启用',
          disable: '禁用',
          permissions: '已授权权限',
          savePermissions: '保存权限',
        }
      : {
          title: 'Plugin directory',
          body: 'Plugins are discovered only from this directory. Imported workspaces and project files never provide or run plugins automatically.',
          save: 'Save directory',
          reset: 'Use default directory',
          scan: 'Rescan',
          empty: 'No plugins found',
          off: 'Enable plugin support before any discovered plugin can run.',
          install: 'Install plugin',
          source: 'Source plugin folder',
          uninstall: 'Uninstall',
          installed: 'Installed',
          enable: 'Enable',
          disable: 'Disable',
          permissions: 'Approved permissions',
          savePermissions: 'Save permissions',
        };
  const handle = async (operation: () => Promise<unknown>) => {
    try {
      await operation();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  const stateFor = (plugin: DiscoveredPlugin) => plugin.state;
  return (
    <section className="settings-card__section plugin-manager">
      <div>
        <strong>{words.title}</strong>
        <p>{words.body}</p>
      </div>
      <div className="plugin-manager__directory">
        <input
          aria-label={words.title}
          onChange={(event) => setDraft(event.target.value)}
          value={draft}
        />
        <button
          className="button"
          onClick={() => void handle(() => setPluginDirectory(draft.trim() || null))}
          type="button"
        >
          {words.save}
        </button>
        {!directory?.isDefault ? (
          <button
            className="button button--ghost"
            onClick={() => void handle(() => setPluginDirectory(null))}
            type="button"
          >
            {words.reset}
          </button>
        ) : null}
      </div>
      <div className="plugin-manager__directory">
        <input
          aria-label={words.source}
          onChange={(event) => setSourcePath(event.target.value)}
          placeholder={words.source}
          value={sourcePath}
        />
        <button
          className="button"
          disabled={!sourcePath.trim()}
          onClick={() =>
            void handle(async () => {
              await installPlugin(sourcePath.trim());
              setSourcePath('');
            })
          }
          type="button"
        >
          {words.install}
        </button>
      </div>
      <div className="plugin-manager__actions">
        <button className="button button--ghost" onClick={() => void refresh()} type="button">
          {words.scan}
        </button>
        {!enabled ? <small>{words.off}</small> : null}
      </div>
      {error ? <p className="plugin-manager__error">{error}</p> : null}
      <ul className="plugin-manager__list">
        {plugins.length === 0 ? (
          <li>{words.empty}</li>
        ) : (
          plugins.map((plugin) => {
            const state = stateFor(plugin);
            const granted = new Set(state?.approvedPermissions ?? []);
            return (
              <li key={plugin.directory}>
                <strong>{plugin.manifest.name}</strong>
                <span>
                  {plugin.manifest.version} · {plugin.manifest.id}
                  {state ? ` · ${words.installed}` : ''}
                </span>
                <small>{plugin.manifest.permissions.join(', ') || 'No permissions'}</small>
                {state ? (
                  <>
                    <label className="plugin-manager__toggle">
                      <input
                        checked={state.enabled}
                        disabled={!enabled}
                        onChange={(event) =>
                          void handle(() =>
                            setPluginState(
                              state.id,
                              event.target.checked,
                              state.approvedPermissions,
                            ),
                          )
                        }
                        type="checkbox"
                      />
                      {state.enabled ? words.disable : words.enable}
                    </label>
                    <fieldset>
                      <legend>{words.permissions}</legend>
                      {plugin.manifest.permissions.map((permission) => (
                        <label key={permission}>
                          <input
                            checked={granted.has(permission)}
                            onChange={(event) => {
                              const next = event.target.checked
                                ? [...granted, permission]
                                : [...granted].filter((value) => value !== permission);
                              void handle(() => setPluginState(state.id, state.enabled, next));
                            }}
                            type="checkbox"
                          />
                          {permission}
                        </label>
                      ))}
                    </fieldset>
                    <button
                      className="button button--ghost"
                      onClick={() => void handle(() => uninstallPlugin(state.id))}
                      type="button"
                    >
                      {words.uninstall}
                    </button>
                  </>
                ) : null}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
