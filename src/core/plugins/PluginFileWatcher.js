import { watch } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
import { logger } from '../../utils/logger.js';

/**
 * Watches the plugins directory for changes and triggers reloads.
 */
export class PluginFileWatcher {
    constructor(pluginStateAdapter) {
        this.adapter = pluginStateAdapter;
        this.unwatchFn = null;
        this.watching = false;
        this.debounceTimer = null;
        this.changedPlugins = new Set();
    }

    async start() {
        if (this.watching) return;

        try {
            const home = await homeDir();
            const pluginsDir = await join(home, '.lokus', 'plugins');

            logger.info(`[PluginFileWatcher] Starting watch on ${pluginsDir}`);

            // Watch recursively
            this.unwatchFn = await watch(
                pluginsDir,
                (event) => {
                    this.handleFileEvent(event);
                },
                { recursive: true }
            );

            this.watching = true;
        } catch (error) {
            logger.error('[PluginFileWatcher] Failed to start watcher:', error);
        }
    }

    async stop() {
        if (this.unwatchFn) {
            this.unwatchFn();
            this.unwatchFn = null;
        }
        this.watching = false;
    }

    handleFileEvent(event) {
        // event.paths is an array of modified paths
        if (!event.paths) return;

        for (const path of event.paths) {
            // Check if it's a relevant file
            if (path.endsWith('dist/index.js') || path.endsWith('plugin.json')) {
                // Extract plugin ID from path
                // Path format: .../plugins/<plugin-id>/...
                const parts = path.split(/[/\\]/);
                const pluginsIndex = parts.indexOf('plugins');

                if (pluginsIndex !== -1 && parts.length > pluginsIndex + 1) {
                    const pluginId = parts[pluginsIndex + 1];
                    this.changedPlugins.add(pluginId);
                }
            }
        }

        // Debounce reload
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => this.processChanges(), 500);
    }

    async processChanges() {
        for (const pluginId of this.changedPlugins) {
            logger.info(`[PluginFileWatcher] Detected change in ${pluginId}, reloading...`);
            try {
                await this.adapter.reloadPluginFromDisk(pluginId);
            } catch (error) {
                logger.error(`[PluginFileWatcher] Failed to reload ${pluginId}:`, error);
            }
        }
        this.changedPlugins.clear();
    }
}
