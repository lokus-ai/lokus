import type { LokusAPI } from './api.js';

/**
 * A v3 plugin module. The host runs `activate` inside a dedicated
 * Worker once the plugin's activation events fire.
 */
export interface PluginModule {
  activate(api: LokusAPI): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

/** Identity helper for typing and editor autocomplete. */
export function definePlugin(module: PluginModule): PluginModule {
  return module;
}
