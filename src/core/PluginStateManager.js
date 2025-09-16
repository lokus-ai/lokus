/**
 * Unified Plugin State Manager
 * Provides centralized plugin state management with consistency guarantees
 * Fixes the critical "enabled: undefined" bug and prevents state synchronization issues
 */

import { invoke } from '@tauri-apps/api/core';
import { EventEmitter } from '../utils/EventEmitter.js';

export class PluginStateManager extends EventEmitter {
  constructor() {
    super();
    
    // State storage
    this.plugins = new Map(); // pluginId -> PluginState
    this.enabledPlugins = new Set(); // Set of enabled plugin IDs
    this.isInitialized = false;
    
    // Synchronization and locking
    this.syncLock = new Map(); // pluginId -> Promise for preventing race conditions
    this.pendingUpdates = new Map(); // pluginId -> pending update data
    
    // Configuration
    this.autoSave = true;
    this.syncInterval = 30000; // 30 seconds
    this.maxRetries = 3;
    
    this.logger = console;
    
    this.setupAutoSync();
  }

  /**
   * Initialize the state manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      this.logger.info('🔄 Initializing unified plugin state manager...');
      
      // Load current state from backend
      await this.loadFromBackend();
      
      this.isInitialized = true;
      this.emit('state_manager_initialized');
      this.logger.info('✅ Plugin state manager initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize plugin state manager:', error);
      throw error;
    }
  }

  /**
   * Load all plugin states from backend
   */
  async loadFromBackend() {
    try {
      let isTauri = false;
      try {
        const w = window;
        isTauri = !!(
          (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
          w.__TAURI_METADATA__ ||
          (navigator?.userAgent || '').includes('Tauri')
        );
      } catch {}

      if (!isTauri) {
        // Browser mode - set empty state
        this.logger.info('🌐 Browser mode detected - using empty plugin state');
        return;
      }

      this.logger.info('🔍 Loading plugin states from Tauri backend...');
      
      // Load plugin infos and enabled list in parallel
      const [pluginInfos, enabledPluginNames] = await Promise.all([
        invoke('list_plugins').catch(() => []),
        invoke('get_enabled_plugins').catch(() => [])
      ]);

      this.logger.info('📦 Raw backend data:', { pluginInfos, enabledPluginNames });

      // Clear current state
      this.plugins.clear();
      this.enabledPlugins.clear();

      // Convert and validate plugin data
      for (const pluginInfo of pluginInfos) {
        if (!pluginInfo?.manifest?.name) {
          this.logger.warn('⚠️ Skipping invalid plugin info:', pluginInfo);
          continue;
        }

        const pluginId = pluginInfo.manifest.name;
        const isEnabled = Array.isArray(enabledPluginNames) ? 
          enabledPluginNames.includes(pluginId) : false;

        // Create validated plugin state
        const pluginState = new PluginState({
          id: pluginId,
          name: pluginInfo.manifest.name,
          version: pluginInfo.manifest.version || '0.0.0',
          description: pluginInfo.manifest.description || 'No description',
          author: pluginInfo.manifest.author || 'Unknown',
          enabled: isEnabled, // Guarantee this is never undefined
          permissions: pluginInfo.manifest.permissions || [],
          dependencies: pluginInfo.manifest.dependencies || {},
          keywords: pluginInfo.manifest.keywords || [],
          repository: pluginInfo.manifest.repository,
          homepage: pluginInfo.manifest.homepage,
          license: pluginInfo.manifest.license,
          lastUpdated: pluginInfo.installed_at,
          path: pluginInfo.path,
          size: pluginInfo.size,
          main: pluginInfo.manifest.main,
          
          // Default UI properties
          rating: 0,
          downloads: 0,
          settings: {},
          conflicts: [],
          ui: {
            panels: []
          }
        });

        this.plugins.set(pluginId, pluginState);
        
        if (isEnabled) {
          this.enabledPlugins.add(pluginId);
        }

        this.logger.info(`✅ Loaded plugin: ${pluginId} (enabled: ${isEnabled})`);
      }

      this.logger.info(`🎯 Loaded ${this.plugins.size} plugins, ${this.enabledPlugins.size} enabled`);
      this.emit('plugins_loaded', {
        total: this.plugins.size,
        enabled: this.enabledPlugins.size
      });

    } catch (error) {
      this.logger.error('❌ Failed to load from backend:', error);
      throw error;
    }
  }

  /**
   * Get all plugins as array with guaranteed enabled property
   */
  getPlugins() {
    const pluginArray = Array.from(this.plugins.values()).map(pluginState => {
      const plugin = pluginState.getData();
      // Double-check enabled state is never undefined
      plugin.enabled = plugin.enabled === true;
      return plugin;
    });
    
    this.logger.debug('🔍 Returning plugins:', pluginArray.map(p => ({ id: p.id, enabled: p.enabled })));
    return pluginArray;
  }

  /**
   * Get enabled plugin IDs
   */
  getEnabledPlugins() {
    return new Set(this.enabledPlugins);
  }

  /**
   * Get a specific plugin by ID
   */
  getPlugin(pluginId) {
    const pluginState = this.plugins.get(pluginId);
    if (!pluginState) {
      return null;
    }
    
    const plugin = pluginState.getData();
    plugin.enabled = plugin.enabled === true; // Guarantee boolean
    return plugin;
  }

  /**
   * Toggle plugin enabled state with atomic operation and race condition protection
   */
  async togglePlugin(pluginId, enabled) {
    // Input validation
    if (!pluginId) {
      throw new Error('Plugin ID is required');
    }
    
    if (typeof enabled !== 'boolean') {
      throw new Error(`Invalid enabled state: ${enabled} (must be boolean)`);
    }

    // Prevent concurrent operations on the same plugin
    if (this.syncLock.has(pluginId)) {
      this.logger.warn(`⚠️ Plugin ${pluginId} is already being updated, waiting...`);
      await this.syncLock.get(pluginId);
    }

    const operationPromise = this._performToggleOperation(pluginId, enabled);
    this.syncLock.set(pluginId, operationPromise);

    try {
      return await operationPromise;
    } finally {
      this.syncLock.delete(pluginId);
    }
  }

  /**
   * Internal method to perform the actual toggle operation
   */
  async _performToggleOperation(pluginId, enabled) {
    try {
      this.logger.info(`🎛️ Toggling plugin ${pluginId}: ${enabled ? 'ENABLE' : 'DISABLE'}`);
      
      const pluginState = this.plugins.get(pluginId);
      if (!pluginState) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      const currentState = pluginState.getData().enabled;
      if (currentState === enabled) {
        this.logger.info(`ℹ️ Plugin ${pluginId} is already ${enabled ? 'enabled' : 'disabled'}`);
        return;
      }

      // Update backend first (fail fast if backend rejects)
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
        if (enabled) {
          const result = await invoke('enable_plugin', { name: pluginId });
          this.logger.info(`✅ Backend enable result for ${pluginId}:`, result);
        } else {
          const result = await invoke('disable_plugin', { name: pluginId });
          this.logger.info(`❌ Backend disable result for ${pluginId}:`, result);
        }
      }

      // Update local state atomically
      pluginState.setEnabled(enabled);
      
      if (enabled) {
        this.enabledPlugins.add(pluginId);
      } else {
        this.enabledPlugins.delete(pluginId);
      }

      // Emit state change event
      this.emit('plugin_toggled', {
        pluginId,
        enabled,
        timestamp: Date.now()
      });

      this.logger.info(`✅ Successfully toggled plugin ${pluginId} to ${enabled ? 'ENABLED' : 'DISABLED'}`);

      // Reload from backend to ensure consistency
      if (isTauri) {
        setTimeout(() => this.loadFromBackend(), 100);
      }

      return {
        success: true,
        pluginId,
        enabled,
        previousState: currentState
      };

    } catch (error) {
      this.logger.error(`❌ Failed to toggle plugin ${pluginId}:`, error);
      
      // Emit error event
      this.emit('plugin_toggle_error', {
        pluginId,
        enabled,
        error: error.message,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Install a plugin
   */
  async installPlugin(pluginId, pluginData) {
    try {
      this.logger.info(`📦 Installing plugin: ${pluginId}`);
      
      // Simulate installation for now (replace with real implementation)
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create new plugin state
      const pluginState = new PluginState({
        ...pluginData,
        id: pluginId,
        enabled: false // New plugins start disabled
      });

      this.plugins.set(pluginId, pluginState);
      
      this.emit('plugin_installed', { pluginId });
      this.logger.info(`✅ Plugin ${pluginId} installed successfully`);
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to install plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    try {
      this.logger.info(`🗑️ Uninstalling plugin: ${pluginId}`);
      
      // Remove from local state
      this.plugins.delete(pluginId);
      this.enabledPlugins.delete(pluginId);
      
      // Simulate backend removal
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.emit('plugin_uninstalled', { pluginId });
      this.logger.info(`✅ Plugin ${pluginId} uninstalled successfully`);
      
      return true;
    } catch (error) {
      this.logger.error(`❌ Failed to uninstall plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Update plugin settings
   */
  async updatePluginSettings(pluginId, settings) {
    try {
      const pluginState = this.plugins.get(pluginId);
      if (!pluginState) {
        throw new Error(`Plugin not found: ${pluginId}`);
      }

      pluginState.updateSettings(settings);
      
      this.emit('plugin_settings_updated', { pluginId, settings });
      return true;
    } catch (error) {
      this.logger.error(`Failed to update settings for plugin ${pluginId}:`, error);
      throw error;
    }
  }

  /**
   * Refresh plugin states from backend
   */
  async refresh() {
    this.logger.info('🔄 Refreshing plugin states...');
    await this.loadFromBackend();
    this.emit('plugins_refreshed');
  }

  /**
   * Setup automatic synchronization with backend
   */
  setupAutoSync() {
    if (!this.autoSave) {
      return;
    }

    setInterval(async () => {
      if (this.isInitialized && this.pendingUpdates.size === 0) {
        try {
          await this.refresh();
        } catch (error) {
          this.logger.error('Auto-sync failed:', error);
        }
      }
    }, this.syncInterval);
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    const plugins = Array.from(this.plugins.values());
    
    return {
      total: plugins.length,
      enabled: this.enabledPlugins.size,
      disabled: plugins.length - this.enabledPlugins.size,
      pendingUpdates: this.pendingUpdates.size,
      activeLocks: this.syncLock.size,
      plugins: plugins.map(pluginState => {
        const plugin = pluginState.getData();
        return {
          id: plugin.id,
          name: plugin.name,
          enabled: plugin.enabled,
          version: plugin.version,
          lastUpdated: plugin.lastUpdated
        };
      })
    };
  }

  /**
   * Shutdown the state manager
   */
  async shutdown() {
    this.logger.info('🔄 Shutting down plugin state manager...');
    
    // Wait for all pending operations to complete
    if (this.syncLock.size > 0) {
      this.logger.info('⏳ Waiting for pending operations to complete...');
      await Promise.all(this.syncLock.values());
    }
    
    // Clear state
    this.plugins.clear();
    this.enabledPlugins.clear();
    this.syncLock.clear();
    this.pendingUpdates.clear();
    
    this.isInitialized = false;
    this.removeAllListeners();
    
    this.logger.info('✅ Plugin state manager shutdown complete');
  }
}

/**
 * Individual Plugin State wrapper
 * Ensures each plugin has consistent state structure
 */
class PluginState {
  constructor(data) {
    this.data = {
      id: '',
      name: '',
      version: '0.0.0',
      description: '',
      author: '',
      enabled: false, // Always initialize as boolean
      permissions: [],
      dependencies: {},
      keywords: [],
      repository: null,
      homepage: null,
      license: null,
      lastUpdated: null,
      path: null,
      size: 0,
      main: null,
      rating: 0,
      downloads: 0,
      settings: {},
      conflicts: [],
      ui: { panels: [] },
      ...data
    };
    
    // Validate and fix enabled state
    this.data.enabled = Boolean(this.data.enabled);
    this.lastModified = Date.now();
  }

  getData() {
    return { ...this.data };
  }

  setEnabled(enabled) {
    if (typeof enabled !== 'boolean') {
      throw new Error(`Invalid enabled state: ${enabled}`);
    }
    
    this.data.enabled = enabled;
    this.lastModified = Date.now();
  }

  updateSettings(settings) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.lastModified = Date.now();
  }

  getLastModified() {
    return this.lastModified;
  }
}

// Create singleton instance
export const pluginStateManager = new PluginStateManager();

export default pluginStateManager;