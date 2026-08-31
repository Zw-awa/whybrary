import { PluginRegistry } from './registry';
import { whyReviewPlugin } from './whyReview';
import type { WhybraryPlugin } from './types';

export const officialPlugins: readonly WhybraryPlugin[] = [whyReviewPlugin];

export function createOfficialPluginRegistry() {
  const registry = new PluginRegistry();
  for (const plugin of officialPlugins) registry.add(plugin);
  return registry;
}

export type { PluginCommand, PluginContext, PluginPanel, PluginViewItem, WhybraryPlugin } from './types';
export { PluginRegistry } from './registry';
export { reviewSpace, whyReviewPlugin } from './whyReview';
