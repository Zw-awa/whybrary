import type { AppLocale } from '../types';
import type { PluginPanel, PluginViewItem } from '../plugins/types';

type PluginPanelHostProps = {
  locale: AppLocale;
  panels: { panel: PluginPanel; items: PluginViewItem[] }[];
};

export function PluginPanelHost({ locale, panels }: PluginPanelHostProps) {
  if (panels.length === 0) return null;
  return (
    <section className="plugin-panels" aria-label={locale === 'zh' ? '插件面板' : 'Plugin panels'}>
      {panels.map(({ panel, items }) => {
        const title = typeof panel.title === 'function' ? panel.title(locale) : panel.title;
        const description = typeof panel.description === 'function' ? panel.description(locale) : panel.description;
        return (
          <div className="plugin-panel" key={panel.id}>
            <div className="plugin-panel__header">
              <div><h2>{title}</h2><p>{description}</p></div>
              <span>{items.length}</span>
            </div>
            <ul className="plugin-panel__items">
              {items.map((item) => <li className={`plugin-panel__item plugin-panel__item--${item.tone ?? 'neutral'}`} key={item.id}><strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}</li>)}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
