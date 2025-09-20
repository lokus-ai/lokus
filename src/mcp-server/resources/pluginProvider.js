/**
 * Plugin Resource Provider for Lokus
 * Integrates with Lokus's plugin system to provide access to:
 * - Installed plugins and their states
 * - Plugin manifests and metadata
 * - Plugin activation and configuration
 * - Plugin API usage and capabilities
 */

import { pluginManager } from '../../plugins/PluginManager.js';

export class PluginProvider {
  constructor() {
    this.pluginManager = pluginManager;
    this.subscribers = new Set();
    this.pluginStates = new Map();
    
    // Initialize plugin monitoring
    this.initializePluginMonitoring();
  }

  /**
   * Initialize plugin monitoring
   */
  async initializePluginMonitoring() {
    try {
      // Load current plugin states
      await this.loadPluginStates();
      
      // Setup plugin event listeners
      this.setupPluginListeners();
    } catch (error) {
      console.warn('[PluginProvider] Failed to initialize plugin monitoring:', error);
    }
  }

  /**
   * Load current plugin states
   */
  async loadPluginStates() {
    try {
      // Get all plugins from the plugin manager
      const allPlugins = this.pluginManager.getAllPlugins();
      
      for (const pluginInfo of allPlugins) {
        this.pluginStates.set(pluginInfo.id, {
          id: pluginInfo.id,
          manifest: pluginInfo.manifest,
          status: pluginInfo.status,
          isLoaded: this.pluginManager.isPluginLoaded(pluginInfo.id),
          isActive: this.pluginManager.isPluginActive(pluginInfo.id),
          instance: pluginInfo.instance,
          error: pluginInfo.error || null,
          lastUpdated: new Date().toISOString()
        });
      }
      
      this.notifySubscribers('plugins:loaded');
    } catch (error) {
      console.error('[PluginProvider] Failed to load plugin states:', error);
    }
  }

  /**
   * Setup plugin event listeners
   */
  setupPluginListeners() {
    try {
      // Listen to plugin manager events
      this.pluginManager.on('plugin_loaded', (data) => {
        this.updatePluginState(data.pluginId, { isLoaded: true, status: 'loaded' });
      });

      this.pluginManager.on('plugin_activated', (data) => {
        this.updatePluginState(data.pluginId, { isActive: true, status: 'active' });
      });

      this.pluginManager.on('plugin_deactivated', (data) => {
        this.updatePluginState(data.pluginId, { isActive: false, status: 'loaded' });
      });

      this.pluginManager.on('plugin_unloaded', (data) => {
        this.updatePluginState(data.pluginId, { isLoaded: false, isActive: false, status: 'discovered' });
      });

      this.pluginManager.on('initialized', () => {
        this.loadPluginStates();
      });
    } catch (error) {
      console.warn('[PluginProvider] Failed to setup plugin listeners:', error);
    }
  }

  /**
   * Update plugin state
   */
  updatePluginState(pluginId, updates) {
    const currentState = this.pluginStates.get(pluginId) || {};
    const updatedState = {
      ...currentState,
      ...updates,
      lastUpdated: new Date().toISOString()
    };
    
    this.pluginStates.set(pluginId, updatedState);
    this.notifySubscribers('plugin:state-changed', { pluginId, updates });
  }

  /**
   * Get all available resources
   */
  async listResources() {
    const resources = [
      {
        uri: 'lokus://plugins/all',
        name: 'All Plugins',
        description: 'Complete list of all discovered plugins',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/active',
        name: 'Active Plugins',
        description: 'Currently active and running plugins',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/loaded',
        name: 'Loaded Plugins',
        description: 'Currently loaded plugins (active and inactive)',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/registry',
        name: 'Plugin Registry',
        description: 'Plugin registry information and metadata',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/statistics',
        name: 'Plugin Statistics',
        description: 'Plugin system statistics and metrics',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/errors',
        name: 'Plugin Errors',
        description: 'Plugin loading and runtime errors',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://plugins/api-usage',
        name: 'Plugin API Usage',
        description: 'Plugin API usage statistics and capabilities',
        mimeType: 'application/json'
      }
    ];

    // Add individual plugin resources
    for (const [pluginId, pluginState] of this.pluginStates) {
      resources.push({
        uri: `lokus://plugins/plugin/${encodeURIComponent(pluginId)}`,
        name: `Plugin: ${pluginState.manifest?.name || pluginId}`,
        description: `Detailed information for plugin: ${pluginId}`,
        mimeType: 'application/json'
      });
    }

    return resources;
  }

  /**
   * Read a specific resource
   */
  async readResource(uri) {
    try {
      const url = new URL(uri);
      const path = url.pathname;

      switch (path) {
        case '/all':
          return this.getAllPlugins();
        
        case '/active':
          return this.getActivePlugins();
        
        case '/loaded':
          return this.getLoadedPlugins();
        
        case '/registry':
          return this.getPluginRegistry();
        
        case '/statistics':
          return this.getPluginStatistics();
        
        case '/errors':
          return this.getPluginErrors();
        
        case '/api-usage':
          return this.getPluginAPIUsage();
        
        default:
          if (path.startsWith('/plugin/')) {
            const pluginId = decodeURIComponent(path.substring(8));
            return this.getPluginDetails(pluginId);
          }
          throw new Error(`Unknown resource path: ${path}`);
      }
    } catch (error) {
      console.error('[PluginProvider] Error reading resource:', error);
      return {
        contents: [{
          type: 'text',
          text: `Error reading resource: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get all plugins
   */
  async getAllPlugins() {
    const allPlugins = Array.from(this.pluginStates.values()).map(state => ({
      id: state.id,
      name: state.manifest?.name || state.id,
      version: state.manifest?.version,
      description: state.manifest?.description,
      author: state.manifest?.author,
      status: state.status,
      isLoaded: state.isLoaded,
      isActive: state.isActive,
      hasError: !!state.error,
      lastUpdated: state.lastUpdated
    }));

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalPlugins: allPlugins.length,
          plugins: allPlugins,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get active plugins
   */
  async getActivePlugins() {
    const activePlugins = this.pluginManager.getActivePlugins().map(p => ({
      id: p.id,
      name: p.info?.manifest?.name || p.id,
      version: p.info?.manifest?.version,
      description: p.info?.manifest?.description,
      status: p.info?.status,
      capabilities: p.info?.manifest?.permissions || [],
      lastActivated: this.pluginStates.get(p.id)?.lastUpdated
    }));

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          activeCount: activePlugins.length,
          activePlugins,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get loaded plugins
   */
  async getLoadedPlugins() {
    const loadedPlugins = Array.from(this.pluginStates.values())
      .filter(state => state.isLoaded)
      .map(state => ({
        id: state.id,
        name: state.manifest?.name || state.id,
        version: state.manifest?.version,
        status: state.status,
        isActive: state.isActive,
        loadOrder: this.pluginManager.loadOrder.indexOf(state.id)
      }));

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          loadedCount: loadedPlugins.length,
          loadedPlugins,
          loadOrder: this.pluginManager.loadOrder,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get plugin registry information
   */
  async getPluginRegistry() {
    const registryInfo = {
      totalRegistered: this.pluginManager.registry.size,
      pluginDirectories: Array.from(this.pluginManager.pluginDirs),
      isInitialized: this.pluginManager.isInitialized,
      loadOrder: this.pluginManager.loadOrder,
      dependencyGraph: this.getDependencyGraph(),
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(registryInfo, null, 2)
      }]
    };
  }

  /**
   * Get plugin statistics
   */
  async getPluginStatistics() {
    const stats = this.pluginManager.getStats();
    
    const enhancedStats = {
      ...stats,
      pluginTypes: this.getPluginTypes(),
      capabilities: this.getPluginCapabilities(),
      dependencyCount: this.pluginManager.dependencies.size,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(enhancedStats, null, 2)
      }]
    };
  }

  /**
   * Get plugin errors
   */
  async getPluginErrors() {
    const errors = [];
    
    for (const [pluginId, state] of this.pluginStates) {
      if (state.error) {
        errors.push({
          pluginId,
          pluginName: state.manifest?.name || pluginId,
          error: state.error,
          status: state.status,
          lastUpdated: state.lastUpdated
        });
      }
    }

    // Also get errors from plugin manager stats
    const managerStats = this.pluginManager.getStats();
    if (managerStats.errors) {
      errors.push(...managerStats.errors);
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          errorCount: errors.length,
          errors,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get plugin API usage statistics
   */
  async getPluginAPIUsage() {
    const apiUsage = {
      totalPluginsWithAPI: 0,
      apiMethods: {},
      capabilities: {},
      extensions: {},
      lastUpdated: new Date().toISOString()
    };

    // Analyze plugin API usage
    for (const [pluginId, state] of this.pluginStates) {
      if (state.isActive && state.instance) {
        apiUsage.totalPluginsWithAPI++;
        
        // Check plugin capabilities
        if (state.manifest?.permissions) {
          for (const permission of state.manifest.permissions) {
            apiUsage.capabilities[permission] = (apiUsage.capabilities[permission] || 0) + 1;
          }
        }

        // Check plugin type
        if (state.manifest?.type) {
          apiUsage.extensions[state.manifest.type] = (apiUsage.extensions[state.manifest.type] || 0) + 1;
        }
      }
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(apiUsage, null, 2)
      }]
    };
  }

  /**
   * Get detailed information for a specific plugin
   */
  async getPluginDetails(pluginId) {
    const state = this.pluginStates.get(pluginId);
    
    if (!state) {
      return {
        contents: [{
          type: 'text',
          text: `Plugin not found: ${pluginId}`
        }]
      };
    }

    const details = {
      id: pluginId,
      state,
      manifest: state.manifest,
      dependencies: this.getPluginDependencies(pluginId),
      dependents: this.getPluginDependents(pluginId),
      apiAccess: this.getPluginAPIAccess(pluginId),
      runtime: {
        isLoaded: state.isLoaded,
        isActive: state.isActive,
        loadOrder: this.pluginManager.loadOrder.indexOf(pluginId),
        hasInstance: !!state.instance
      },
      lastUpdated: state.lastUpdated
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(details, null, 2)
      }]
    };
  }

  /**
   * Get dependency graph representation
   */
  getDependencyGraph() {
    const graph = {
      dependencies: {},
      dependents: {}
    };

    for (const [pluginId, deps] of this.pluginManager.dependencies) {
      graph.dependencies[pluginId] = Array.from(deps);
    }

    for (const [pluginId, dependents] of this.pluginManager.dependents) {
      graph.dependents[pluginId] = Array.from(dependents);
    }

    return graph;
  }

  /**
   * Get plugin types distribution
   */
  getPluginTypes() {
    const types = {};
    
    for (const state of this.pluginStates.values()) {
      const type = state.manifest?.type || 'unknown';
      types[type] = (types[type] || 0) + 1;
    }

    return types;
  }

  /**
   * Get plugin capabilities distribution
   */
  getPluginCapabilities() {
    const capabilities = {};
    
    for (const state of this.pluginStates.values()) {
      if (state.manifest?.permissions) {
        for (const permission of state.manifest.permissions) {
          capabilities[permission] = (capabilities[permission] || 0) + 1;
        }
      }
    }

    return capabilities;
  }

  /**
   * Get plugin dependencies
   */
  getPluginDependencies(pluginId) {
    const deps = this.pluginManager.dependencies.get(pluginId);
    return deps ? Array.from(deps) : [];
  }

  /**
   * Get plugin dependents
   */
  getPluginDependents(pluginId) {
    const dependents = this.pluginManager.dependents.get(pluginId);
    return dependents ? Array.from(dependents) : [];
  }

  /**
   * Get plugin API access information
   */
  getPluginAPIAccess(pluginId) {
    const state = this.pluginStates.get(pluginId);
    
    if (!state || !state.manifest) {
      return { hasAccess: false };
    }

    return {
      hasAccess: state.isActive,
      permissions: state.manifest.permissions || [],
      apiVersion: state.manifest.apiVersion || 'unknown',
      capabilities: state.manifest.type ? [state.manifest.type] : []
    };
  }

  /**
   * Subscribe to plugin changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  notifySubscribers(event, data = null) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[PluginProvider] Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Refresh plugin data
   */
  async refresh() {
    await this.loadPluginStates();
    this.notifySubscribers('plugins:refreshed');
  }

  /**
   * Get plugin provider metadata
   */
  getMetadata() {
    return {
      name: 'Lokus Plugin Provider',
      description: 'Provides access to Lokus plugin system state and information',
      version: '1.0.0',
      capabilities: [
        'plugin-listing',
        'plugin-states',
        'plugin-registry',
        'dependency-graph',
        'plugin-statistics',
        'error-reporting',
        'api-usage-tracking',
        'real-time-updates'
      ]
    };
  }

  /**
   * Get plugin system health information
   */
  getSystemHealth() {
    const stats = this.pluginManager.getStats();
    const errorRate = stats.errors.length / Math.max(stats.total, 1);
    
    return {
      isHealthy: errorRate < 0.1 && stats.loaded > 0,
      errorRate,
      totalPlugins: stats.total,
      loadedPlugins: stats.loaded,
      activePlugins: stats.active,
      errors: stats.errors.length,
      isInitialized: this.pluginManager.isInitialized,
      lastCheck: new Date().toISOString()
    };
  }
}