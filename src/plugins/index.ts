import { PluginRegistry } from './registry';
import { whyReviewPlugin } from './whyReview';
import type { WhybraryPlugin } from './types';

export const officialPlugins: readonly WhybraryPlugin[] = [whyReviewPlugin];

export function createOfficialPluginRegistry() {
  const registry = new PluginRegistry();
  for (const plugin of officialPlugins) registry.add(plugin);
  return registry;
}

export type {
  PluginCommand,
  PluginContext,
  PluginPanel,
  PluginViewItem,
  WhybraryPlugin,
} from './types';
export { PluginRegistry } from './registry';
export { ExternalPluginLoader } from './externalLoader';
export { validatePluginManifest, PLUGIN_MANIFEST_FILE, PLUGIN_MANIFEST_VERSION } from './manifest';
export type { PluginManifest, ManifestValidation } from './manifest';
export { discoverPlugins, getPluginDirectory, setPluginDirectory, parseManifest } from './platform';
export type { DiscoveredPlugin, PluginDirectoryConfig, PluginDiscoveryResponse } from './platform';
export { reviewSpace, whyReviewPlugin } from './whyReview';
