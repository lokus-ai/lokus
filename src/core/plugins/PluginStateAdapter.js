import { invoke } from "@tauri-apps/api/core";
import { PluginLoader } from "../../plugins/PluginLoader.js";

/**
 * PluginStateAdapter - UI State Management Facade for Plugin System
 *
 * This class is a specialized UI adapter that manages plugin display state
 * for React components. It is NOT a general plugin manager.
 *
 * Architecture:
 * - Main Plugin System: src/plugins/PluginManager.js (core lifecycle, dependencies, registry)
 * - UI State Adapter: src/core/plugins/PluginStateAdapter.js (THIS FILE - React state sync)
 * - Editor Plugin API: src/plugins/api/EditorAPI.js (TipTap editor extensions)
 *
 * Responsibilities:
 * - Manage plugin list UI state (loading, error states)
 * - Call Tauri backend commands for plugin operations
 * - Delegate plugin loading to PluginLoader
 * - Provide event-based state synchronization for React
 * - Cache plugin data for UI performance
 *
 * NOT Responsible For:
 * - Plugin dependency resolution (handled by main PluginManager)
 * - Plugin manifest validation (handled by main PluginManager)
 * - Plugin API provisioning (handled by LokusPluginAPI)
 * - Editor extension registration (handled by EditorAPI)
 *
 * @class PluginStateAdapter
 */
class PluginStateAdapter {
  constructor() {
    this.plugins = [];
    this.enabledPlugins = new Set();
    this.installingPlugins = new Set();
    this.loading = true;
    this.error = null;
    this.lastLoadTime = 0;
    this.loadInProgress = false;
    this.pluginLoader = new PluginLoader();
    this.listeners = new Set();

    // Cache duration for plugin data (5 minutes)
    this.CACHE_DURATION = 5 * 60 * 1000;

    // Initialize plugins
    this.initialize();
  }

  async initialize() {
    await this.loadPlugins();
  }

  async loadEnabledPlugins(allPlugins, enabledPluginNames) {
    for (const pluginInfo of allPlugins) {
      if (enabledPluginNames.includes(pluginInfo.id)) {
        try {
          await this.pluginLoader.loadPlugin(pluginInfo);
          await this.pluginLoader.activatePlugin(pluginInfo.id);
        } catch (error) {
          console.error('Failed to load plugin:', pluginInfo.id, error);
        }
      }
    }
  }

  async loadPlugins(forceReload = false) {
    const now = Date.now();

    // Check cache unless forced reload
    if (!forceReload && this.loadInProgress) {
      return this.plugins;
    }

    if (!forceReload && this.plugins.length > 0 && (now - this.lastLoadTime) < this.CACHE_DURATION) {
      return this.plugins;
    }

    this.loadInProgress = true;

    try {
      this.loading = true;
      this.error = null;
      this.notifyListeners();

      let isTauri = false;
      try {
        const w = window;
        isTauri = !!(
          (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
          w.__TAURI_METADATA__ ||
          (navigator?.userAgent || '').includes('Tauri')
        );
      } catch {}

      if (isTauri) {
        // Load real plugins from Tauri backend
        const [pluginInfos, enabledPluginNames] = await Promise.all([
          invoke('list_plugins'),
          invoke('get_enabled_plugins')
        ]);

        // Convert backend format to frontend format
        const convertedPlugins = pluginInfos.map(pluginInfo => {
          const pluginId = pluginInfo.manifest.id || pluginInfo.path.split('/').pop();
          const pluginName = pluginInfo.manifest.name;
          const isEnabled = enabledPluginNames.includes(pluginId);

          return {
            id: pluginId,
            name: pluginName,
            version: pluginInfo.manifest.version,
            description: pluginInfo.manifest.description,
            author: pluginInfo.manifest.author,
            enabled: isEnabled,
            permissions: pluginInfo.manifest.permissions,
            lastUpdated: pluginInfo.installed_at,
            path: pluginInfo.path,
            size: pluginInfo.size,
            main: pluginInfo.manifest.main,
            dependencies: pluginInfo.manifest.dependencies || {},
            keywords: pluginInfo.manifest.keywords || [],
            repository: pluginInfo.manifest.repository,
            homepage: pluginInfo.manifest.homepage,
            license: pluginInfo.manifest.license,
            // Default UI properties
            rating: 0,
            downloads: 0,
            settings: {},
            conflicts: [],
            ui: {
              panels: []
            }
          };
        });

        this.plugins = convertedPlugins;
        this.enabledPlugins = new Set(enabledPluginNames);

        // Load and activate enabled plugins
        await this.loadEnabledPlugins(convertedPlugins, enabledPluginNames);

        // Update cache time
        this.lastLoadTime = now;
      } else {
        // Browser mode - empty list
        this.plugins = [];
        this.enabledPlugins = new Set();
        this.lastLoadTime = now;
      }
    } catch (err) {
      this.error = err.message;
      console.error('Failed to load plugins:', err);
    } finally {
      this.loading = false;
      this.loadInProgress = false;
      this.notifyListeners();
    }

    return this.plugins;
  }

  async installPlugin(pluginId, pluginData) {
    try {
      this.installingPlugins.add(pluginId);
      this.notifyListeners();

      // Call Tauri backend to install plugin
      await invoke('install_plugin', { path: pluginData.path });

      // Reload plugins to get updated state (force reload)
      await this.loadPlugins(true);

      return true;
    } catch (err) {
      throw err;
    } finally {
      this.installingPlugins.delete(pluginId);
      this.notifyListeners();
    }
  }

  async uninstallPlugin(pluginId) {
    try {
      // Call Tauri backend to uninstall plugin
      await invoke('uninstall_plugin', { name: pluginId });

      // Reload plugins to get updated state (force reload)
      await this.loadPlugins(true);

      return true;
    } catch (err) {
      throw err;
    }
  }

  async togglePlugin(pluginId, enabled) {
    try {
      // CRITICAL FIX: Validate input parameters
      if (!pluginId || typeof pluginId !== 'string') {
        throw new Error(`Invalid pluginId: ${pluginId} (type: ${typeof pluginId})`);
      }

      if (typeof enabled !== 'boolean') {
        throw new Error(`Invalid enabled parameter: ${enabled} (type: ${typeof enabled}) - must be boolean`);
      }

      let isTauri = false;
      try {
        const w = window;
        isTauri = !!(
          (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
          w.__TAURI_METADATA__ ||
          (navigator?.userAgent || '').includes('Tauri')
        );
      } catch {}

      if (isTauri) {
        // Use real Tauri commands
        if (enabled) {
          await invoke('enable_plugin', { name: pluginId });
        } else {
          await invoke('disable_plugin', { name: pluginId });
        }

        // Reload plugins from backend to get the correct state
        await this.loadPlugins();
      } else {
        // Browser mode fallback
        await new Promise(resolve => setTimeout(resolve, 500));

        this.plugins = this.plugins.map(plugin =>
          plugin.id === pluginId ? { ...plugin, enabled } : plugin
        );

        if (enabled) {
          this.enabledPlugins.add(pluginId);
        } else {
          this.enabledPlugins.delete(pluginId);
        }

        this.notifyListeners();
      }

      return true;
    } catch (err) {
      throw err;
    }
  }

  async updatePluginSettings(pluginId, settings) {
    try {
      // In a real implementation, this would call the Tauri backend
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate save

      // Update plugin settings
      this.plugins = this.plugins.map(plugin =>
        plugin.id === pluginId ? { ...plugin, settings: { ...plugin.settings, ...settings } } : plugin
      );

      this.notifyListeners();
      return true;
    } catch (err) {
      throw err;
    }
  }

  getPlugin(pluginId) {
    return this.plugins.find(p => p.id === pluginId);
  }

  getEnabledPlugins() {
    return this.plugins.filter(p => p.enabled);
  }

  getPluginPanels() {
    return this.plugins
      .filter(p => p.enabled && p.ui?.panels?.length > 0)
      .flatMap(p => p.ui.panels.map(panel => ({ ...panel, pluginId: p.id, pluginName: p.name })));
  }

  // Event system for plugin state changes
  onPluginStateChange(callback) {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback({
          plugins: this.plugins,
          loading: this.loading,
          error: this.error,
          installingPlugins: this.installingPlugins,
          enabledPlugins: this.enabledPlugins
        });
      } catch (error) {
        console.error('Error in plugin state listener:', error);
      }
    });
  }

  // Getters for current state
  get allPlugins() {
    return this.plugins;
  }

  get isLoading() {
    return this.loading;
  }

  get currentError() {
    return this.error;
  }

  get installingPluginIds() {
    return this.installingPlugins;
  }

  get enabledPluginIds() {
    return this.enabledPlugins;
  }
}

// Create singleton instance
const pluginStateAdapter = new PluginStateAdapter();

export default pluginStateAdapter;