import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { PluginLoader } from "../../plugins/core/PluginLoader.js";
import { LokusPluginAPI } from "../../plugins/api/LokusPluginAPI.js";
import { uiManager } from "../ui/UIManager.js";
import { configManager } from "../config/ConfigManager.js";
import { filesystemManager } from "../fs/FilesystemManager.js";

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
    this.pluginInstances = new Map(); // Store active plugin instances
    this.enabledPlugins = new Set();
    this.installingPlugins = new Set();
    this.loading = true;
    this.error = null;
    this.lastLoadTime = 0;
    this.loadInProgress = false;
    this.pluginLoader = new PluginLoader();
    this.listeners = new Set();
    this.workspacePath = null;
    this.workspacePath = null;

    // Cache duration for plugin data (5 minutes)
    this.CACHE_DURATION = 5 * 60 * 1000;

    // Initialize global lokus object for plugins
    if (typeof window !== 'undefined') {
      window.lokus = window.lokus || {};
      // Expose the actual instances map so plugins can register themselves
      window.lokus.plugins = this.pluginInstances;

      // Add helper methods that plugins might expect if they treat it as an object
      if (!window.lokus.plugins.getPlugin) {
        window.lokus.plugins.getPlugin = (id) => this.pluginInstances.get(id);
      }

      // Initialize Event Emitter for Plugins
      if (!window.lokus.plugins.emit) {
        window.lokus.plugins.events = new Map();

        window.lokus.plugins.emit = (event, data) => {
          const handlers = window.lokus.plugins.events.get(event) || [];
          handlers.forEach(h => {
            try { h(data); } catch (e) { console.error(`Error in plugin event handler for ${event}:`, e); }
          });
        };

        window.lokus.plugins.on = (event, handler) => {
          const handlers = window.lokus.plugins.events.get(event) || [];
          handlers.push(handler);
          window.lokus.plugins.events.set(event, handlers);
          return () => window.lokus.plugins.off(event, handler);
        };

        window.lokus.plugins.off = (event, handler) => {
          const handlers = window.lokus.plugins.events.get(event) || [];
          const filtered = handlers.filter(h => h !== handler);
          window.lokus.plugins.events.set(event, filtered);
        };
      }

      // Initialize Command Registry
      window.lokus.commands = window.lokus.commands || {
        registry: new Map(),
        registerCommand: (id, callback) => {
          window.lokus.commands.registry.set(id, callback);
          return { dispose: () => window.lokus.commands.registry.delete(id) };
        },
        executeCommand: (id, ...args) => {
          const callback = window.lokus.commands.registry.get(id);
          if (callback) {
            return callback(...args);
          } else {
            console.warn(`Command not found: ${id}`);
            return Promise.resolve();
          }
        }
      };
    }

    // Initialize plugins
    this.initialize();
  }

  setWorkspacePath(path) {
    this.workspacePath = path;
  }

  async initialize() {
    await this.loadPlugins();
  }

  async loadEnabledPlugins(allPlugins, enabledPluginNames) {
    for (const pluginInfo of allPlugins) {
      if (enabledPluginNames.includes(pluginInfo.id)) {
        try {
          // Check if already loaded
          if (this.pluginInstances.has(pluginInfo.id)) {
            continue;
          }

          // Create API for plugin
          // TODO: Pass editorAPI when available
          const managers = {
            commands: window.lokus?.commands,
            ui: uiManager,
            workspace: {
              getWorkspaceFolders: () => this.workspacePath ? [{ uri: { path: this.workspacePath, scheme: 'file' }, name: this.workspacePath.split('/').pop(), index: 0 }] : [],
              getRootPath: () => this.workspacePath
            },
            configuration: configManager,
            filesystem: filesystemManager
          };
          const pluginAPI = new LokusPluginAPI(managers);
          pluginAPI.setPluginContext(pluginInfo.id, null);

          // Listen for UI events
          // Note: LokusPluginAPI aggregates events or we listen to specific sub-APIs?
          // UIAPI emits 'panel-registered'. LokusPluginAPI might not bubble it up automatically.
          // We might need to listen to pluginAPI.ui
          if (pluginAPI.ui) {
            pluginAPI.ui.on('panel-registered', (event) => {
              this.handlePanelRegistered(event);
            });
          }

          // Load plugin
          const pluginInstance = await this.pluginLoader.loadPlugin(pluginInfo.path, pluginAPI);
          this.pluginInstances.set(pluginInfo.id, pluginInstance);

          // Activate plugin
          if (typeof pluginInstance.activate === 'function') {
            await pluginInstance.activate();

            // Emit activation event
            try {
              await emit('plugin-runtime-activated', { pluginId: pluginInfo.id });
            } catch (e) {
              console.warn('Failed to emit plugin activation event:', e);
            }
          }

        } catch (error) {
          console.error('Failed to load plugin:', pluginInfo.id, error);
        }
      }
    }
  }

  handlePanelRegistered(event) {
    const { pluginId, id, ...panelData } = event;

    // Update plugins list with new panel
    this.plugins = this.plugins.map(p => {
      if (p.id === pluginId) {
        const panels = p.ui?.panels || [];
        return {
          ...p,
          ui: {
            ...p.ui,
            panels: [...panels, { id, ...panelData }]
          }
        };
      }
      return p;
    });

    this.notifyListeners();
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
      } catch { }

      if (isTauri) {
        // Load real plugins from Tauri backend
        const [pluginInfos, enabledPluginNames] = await Promise.all([
          invoke('list_plugins'),
          invoke('get_enabled_plugins')
        ]);

        // Convert backend format to frontend format
        const convertedPlugins = pluginInfos.map(pluginInfo => {
          if (pluginInfo.manifest.id === 'pkmodoro') {
            console.log('[PluginStateAdapter] pkmodoro raw manifest:', pluginInfo.manifest);
          }
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
            manifest: pluginInfo.manifest, // Include full manifest
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

      // Check if this is a marketplace install
      if (pluginData.fromMarketplace) {
        await this.pluginLoader.installFromMarketplace(pluginId, pluginData.version);
      } else {
        // Call Tauri backend to install plugin from local path
        await invoke('install_plugin', { path: pluginData.path });
      }

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
      } catch { }

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

      // Handle runtime activation/deactivation
      if (enabled) {
        // Check if instance exists, if not load it
        if (!this.pluginInstances.has(pluginId)) {
          const pluginInfo = this.plugins.find(p => p.id === pluginId);
          if (pluginInfo) {
            // Create API for plugin
            // TODO: Pass editorAPI when available
            const managers = {
              commands: window.lokus?.commands,
              ui: uiManager,
              workspace: {
                getWorkspaceFolders: () => this.workspacePath ? [{ uri: { path: this.workspacePath, scheme: 'file' }, name: this.workspacePath.split('/').pop(), index: 0 }] : [],
                getRootPath: () => this.workspacePath
              }
            };
            const pluginAPI = new LokusPluginAPI(managers);
            pluginAPI.setPluginContext(pluginId, null);

            // Listen for UI events
            if (pluginAPI.ui) {
              pluginAPI.ui.on('panel-registered', (event) => {
                this.handlePanelRegistered(event);
              });
            }

            const pluginInstance = await this.pluginLoader.loadPlugin(pluginInfo.path, pluginAPI);
            this.pluginInstances.set(pluginId, pluginInstance);
          }
        }

        const instance = this.pluginInstances.get(pluginId);
        if (instance && typeof instance.activate === 'function') {
          await instance.activate();

          // Emit activation event for UI components (like StatusBar)
          try {
            await emit('plugin-runtime-activated', { pluginId });
          } catch (e) {
            console.warn('Failed to emit plugin activation event:', e);
          }
        }
      } else {
        const instance = this.pluginInstances.get(pluginId);
        if (instance && typeof instance.deactivate === 'function') {
          await instance.deactivate();
        }
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