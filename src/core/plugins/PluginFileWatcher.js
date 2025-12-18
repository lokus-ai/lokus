import { watch, readDir, lstat } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { logger } from '../../utils/logger.js';

/**
 * Watches the plugins directory for changes and triggers reloads.
 * Handles both regular plugins and symlinked dev plugins.
 */
export class PluginFileWatcher {
    constructor(pluginStateAdapter) {
        this.adapter = pluginStateAdapter;
        this.watchers = new Map(); // path -> unwatchFn
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

            // 1. Watch the main plugins directory (for adds/removes)
            await this.addWatcher(pluginsDir, 'main');

            // 2. Scan for symlinks and watch their targets
            await this.scanAndWatchSymlinks(pluginsDir);

            this.watching = true;
        } catch (error) {
            logger.error('[PluginFileWatcher] Failed to start watcher:', error);
        }
    }

    async stop() {
        // Stop all watchers
        for (const [path, unwatch] of this.watchers) {
            try {
                unwatch();
            } catch (e) {
                logger.warn(`[PluginFileWatcher] Failed to unwatch ${path}:`, e);
            }
        }
        this.watchers.clear();
        this.watching = false;
    }

    async addWatcher(path, id) {
        if (this.watchers.has(path)) return;

        try {
            const unwatch = await watch(
                path,
                (event) => {
                    this.handleFileEvent(event, id);
                },
                { recursive: true }
            );
            this.watchers.set(path, unwatch);
            logger.debug(`[PluginFileWatcher] Watching ${path} (${id})`);
        } catch (error) {
            logger.warn(`[PluginFileWatcher] Failed to watch ${path}:`, error);
        }
    }

    /**
     * Try to read a symlink target using Tauri command.
     * Returns null if the command doesn't exist or fails.
     */
    async readSymlinkTarget(path) {
        try {
            // Try using the Tauri fs read_link command
            const target = await invoke('plugin:fs|read_link', { path });
            return target;
        } catch (e) {
            // readLink may not be available in all Tauri FS plugin versions
            // Fall back gracefully
            logger.debug(`[PluginFileWatcher] Could not read symlink target for ${path}:`, e);
            return null;
        }
    }

    async scanAndWatchSymlinks(pluginsDir) {
        try {
            const entries = await readDir(pluginsDir);
            for (const entry of entries) {
                try {
                    const entryPath = await join(pluginsDir, entry.name);
                    const metadata = await lstat(entryPath);

                    if (metadata.isSymlink) {
                        // It's a symlink! Try to find the target.
                        const target = await this.readSymlinkTarget(entryPath);
                        if (target) {
                            logger.info(`[PluginFileWatcher] Found symlink for ${entry.name} -> ${target}`);
                            // Watch the target directory
                            await this.addWatcher(target, entry.name);
                        } else {
                            // Can't resolve symlink, but the main watcher will still work
                            logger.debug(`[PluginFileWatcher] Symlink ${entry.name} target unknown, relying on main watcher`);
                        }
                    }
                } catch (e) {
                    // Ignore errors for individual files
                    logger.debug(`[PluginFileWatcher] Error checking ${entry.name}:`, e);
                }
            }
        } catch (error) {
            logger.warn('[PluginFileWatcher] Failed to scan plugins dir for symlinks:', error);
        }
    }

    handleFileEvent(event, sourceId) {
        // event.paths is an array of modified paths
        if (!event.paths) return;

        for (const path of event.paths) {
            // Check if it's a relevant file
            if (path.endsWith('dist/index.js') || path.endsWith('plugin.json')) {
                // If sourceId is 'main', we need to extract plugin ID from path
                // If sourceId is a plugin ID (from symlink), use that
                let pluginId = sourceId;

                if (sourceId === 'main') {
                     const parts = path.split(/[/\\]/);
                     const pluginsIndex = parts.indexOf('plugins');
                     if (pluginsIndex !== -1 && parts.length > pluginsIndex + 1) {
                         pluginId = parts[pluginsIndex + 1];
                     }
                }

                if (pluginId && pluginId !== 'main') {
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
