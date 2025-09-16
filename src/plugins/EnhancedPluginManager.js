/**
 * Enhanced Plugin Manager
 * Integrates the runtime system with the existing plugin infrastructure
 * Provides comprehensive plugin lifecycle management with execution capabilities
 */

import { EventEmitter } from '../utils/EventEmitter.js'
import { PluginLifecycleManager } from './runtime/PluginLifecycleManager.js'
import { PluginEventSystem } from './runtime/PluginEventSystem.js'
import { PluginStateManager } from './runtime/PluginStateManager.js'
import { PluginRuntime } from './runtime/PluginRuntime.js'
import { ExtendedPluginAPI } from './PluginAPIExtended.js'
import { invoke } from '@tauri-apps/api/core'
import { join, homeDir } from '@tauri-apps/api/path'
import { readDir, exists, readTextFile } from '@tauri-apps/api/fs'

export class EnhancedPluginManager extends EventEmitter {
  constructor() {
    super()
    
    // Core systems
    this.lifecycleManager = new PluginLifecycleManager()
    this.eventSystem = new PluginEventSystem()
    this.stateManager = new PluginStateManager()
    
    // Plugin storage
    this.plugins = new Map() // pluginId -> plugin metadata
    this.registry = new Map() // pluginId -> plugin registry info
    this.loadOrder = []
    this.pluginDirs = new Set()
    
    // Runtime state
    this.isInitialized = false
    this.editorAPI = null
    this.logger = console // TODO: Replace with proper logger
    
    this.setupEventHandlers()
  }

  /**
   * Initialize the enhanced plugin manager
   */
  async initialize(editorAPI) {
    if (this.isInitialized) {
      return
    }

    try {
      this.editorAPI = editorAPI
      
      // Initialize core systems
      await this.lifecycleManager.initialize(editorAPI)
      await this.eventSystem.initialize()
      await this.stateManager.initialize()
      
      // Setup plugin directories
      await this.setupPluginDirectories()
      
      // Discover and load plugins
      await this.discoverPlugins()
      await this.loadAllPlugins()
      
      // Activate enabled plugins
      await this.activateEnabledPlugins()
      
      this.isInitialized = true
      this.emit('enhanced_manager_initialized')
      this.logger.info('Enhanced plugin manager initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize enhanced plugin manager:', error)
      throw error
    }
  }

  /**
   * Set up event handlers between systems
   */
  setupEventHandlers() {
    // Lifecycle events
    this.lifecycleManager.on('plugin_activated', (data) => {
      this.handlePluginActivated(data)
    })
    
    this.lifecycleManager.on('plugin_deactivated', (data) => {
      this.handlePluginDeactivated(data)
    })
    
    this.lifecycleManager.on('plugin_error', (data) => {
      this.handlePluginError(data)
    })
    
    // State events
    this.stateManager.on('state_changed', (data) => {
      this.eventSystem.publish('lifecycle', 'state_changed', data)
    })
    
    // Event system events
    this.eventSystem.on('handler_error', (data) => {
      this.logger.error('Event handler error:', data)
    })
  }

  /**
   * Setup plugin directories
   */
  async setupPluginDirectories() {
    try {
      const home = await homeDir()
      const pluginDir = await join(home, '.lokus', 'plugins')
      
      this.pluginDirs.add(pluginDir)
      
      // Ensure plugin directory exists
      if (!(await exists(pluginDir))) {
        await invoke('create_directory', { path: pluginDir })
      }
      
      this.logger.info(`Plugin directory: ${pluginDir}`)
    } catch (error) {
      this.logger.error('Failed to setup plugin directories:', error)
      throw error
    }
  }

  /**
   * Discover all available plugins
   */
  async discoverPlugins() {
    const discovered = []
    
    for (const pluginDir of this.pluginDirs) {
      try {
        if (!(await exists(pluginDir))) {
          continue
        }
        
        const entries = await readDir(pluginDir, { recursive: false })
        
        for (const entry of entries) {
          if (entry.children && entry.name) {
            try {
              const manifest = await this.loadPluginManifest(entry.path)
              if (manifest) {
                discovered.push({
                  path: entry.path,
                  manifest,
                  id: manifest.id || entry.name
                })
              }
            } catch (error) {
              this.logger.warn(`Failed to load manifest for ${entry.name}:`, error)
            }
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to scan plugin directory ${pluginDir}:`, error)
      }
    }
    
    // Register discovered plugins
    for (const plugin of discovered) {
      try {
        await this.validatePluginManifest(plugin.manifest)
        this.registry.set(plugin.id, {
          ...plugin,
          status: 'discovered',
          discoveredAt: Date.now()
        })
        this.logger.info(`Discovered plugin: ${plugin.id} (${plugin.manifest.version})`)
      } catch (error) {
        this.logger.error(`Invalid plugin manifest for ${plugin.id}:`, error)
      }
    }
  }

  /**
   * Load plugin manifest from directory
   */
  async loadPluginManifest(pluginPath) {
    try {
      const manifestPath = await join(pluginPath, 'plugin.json')
      
      if (!(await exists(manifestPath))) {
        throw new Error('plugin.json not found')
      }
      
      const manifestContent = await readTextFile(manifestPath)
      const manifest = JSON.parse(manifestContent)
      
      return manifest
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`)
    }
  }

  /**
   * Validate plugin manifest
   */
  async validatePluginManifest(manifest) {
    const required = ['id', 'name', 'version', 'main']
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Invalid version format (expected: x.y.z)')
    }
    
    return true
  }

  /**
   * Load all discovered plugins
   */
  async loadAllPlugins() {
    // Build dependency graph and resolve load order
    this.buildDependencyGraph()
    this.resolveLoadOrder()
    
    // Register plugins with lifecycle manager
    for (const pluginId of this.loadOrder) {
      try {
        await this.registerPlugin(pluginId)
      } catch (error) {
        this.logger.error(`Failed to register plugin ${pluginId}:`, error)
      }
    }
  }

  /**
   * Register a plugin with the lifecycle manager
   */
  async registerPlugin(pluginId) {
    const pluginInfo = this.registry.get(pluginId)
    if (!pluginInfo) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }

    try {
      // Register with lifecycle manager
      const context = await this.lifecycleManager.registerPlugin(
        pluginId,
        pluginInfo.manifest,
        pluginInfo.path
      )
      
      // Create plugin state
      await this.stateManager.createPluginState(pluginId, pluginInfo.manifest)
      
      // Update registry status
      this.registry.get(pluginId).status = 'registered'
      
      // Store plugin reference
      this.plugins.set(pluginId, {
        id: pluginId,
        manifest: pluginInfo.manifest,
        path: pluginInfo.path,
        context,
        registeredAt: Date.now()
      })
      
      this.emit('plugin_registered', { pluginId })
      this.logger.info(`Registered plugin: ${pluginId}`)
      
      return context
    } catch (error) {
      this.logger.error(`Failed to register plugin ${pluginId}:`, error)
      this.registry.get(pluginId).status = 'error'
      this.registry.get(pluginId).error = error.message
      throw error
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId, reason = 'manual') {
    try {
      await this.lifecycleManager.activatePlugin(pluginId, reason)
      
      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        plugin.isActive = true
        plugin.activatedAt = Date.now()
      }
      
      // Publish activation event
      await this.eventSystem.publish('lifecycle', 'plugin_activated', {
        pluginId,
        reason,
        timestamp: Date.now()
      })
      
      this.emit('plugin_activated', { pluginId, reason })
    } catch (error) {
      this.logger.error(`Failed to activate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId, reason = 'manual') {
    try {
      await this.lifecycleManager.deactivatePlugin(pluginId, reason)
      
      const plugin = this.plugins.get(pluginId)
      if (plugin) {
        plugin.isActive = false
        plugin.deactivatedAt = Date.now()
      }
      
      // Publish deactivation event
      await this.eventSystem.publish('lifecycle', 'plugin_deactivated', {
        pluginId,
        reason,
        timestamp: Date.now()
      })
      
      this.emit('plugin_deactivated', { pluginId, reason })
    } catch (error) {
      this.logger.error(`Failed to deactivate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId) {
    try {
      // Unregister from lifecycle manager
      await this.lifecycleManager.unregisterPlugin(pluginId)
      
      // Cleanup state
      await this.stateManager.cleanupPluginState(pluginId)
      
      // Cleanup event subscriptions
      this.eventSystem.cleanupPluginSubscriptions(pluginId)
      
      // Remove from local storage
      this.plugins.delete(pluginId)
      this.registry.delete(pluginId)
      
      // Remove from backend
      await invoke('uninstall_plugin', { name: pluginId })
      
      this.emit('plugin_uninstalled', { pluginId })
      this.logger.info(`Uninstalled plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Install a plugin from path
   */
  async installPlugin(pluginPath) {
    try {
      // Use backend installation
      const result = await invoke('install_plugin_from_path', { path: pluginPath })
      
      if (!result.success) {
        throw new Error(result.error || 'Installation failed')
      }
      
      // Rediscover plugins to pick up the new one
      await this.discoverPlugins()
      
      const pluginId = result.plugin_name
      if (pluginId) {
        // Register the new plugin
        await this.registerPlugin(pluginId)
        
        this.emit('plugin_installed', { pluginId })
        this.logger.info(`Installed plugin: ${pluginId}`)
        
        return pluginId
      }
    } catch (error) {
      this.logger.error(`Failed to install plugin from ${pluginPath}:`, error)
      throw error
    }
  }

  /**
   * Enable a plugin (activate it and mark as enabled)
   */
  async enablePlugin(pluginId) {
    try {
      // Mark as enabled in backend
      await invoke('enable_plugin', { name: pluginId })
      
      // Activate the plugin
      await this.activatePlugin(pluginId, 'enabled')
      
      this.emit('plugin_enabled', { pluginId })
    } catch (error) {
      this.logger.error(`Failed to enable plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Disable a plugin (deactivate it and mark as disabled)
   */
  async disablePlugin(pluginId) {
    try {
      // Deactivate the plugin
      await this.deactivatePlugin(pluginId, 'disabled')
      
      // Mark as disabled in backend
      await invoke('disable_plugin', { name: pluginId })
      
      this.emit('plugin_disabled', { pluginId })
    } catch (error) {
      this.logger.error(`Failed to disable plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Activate enabled plugins on startup
   */
  async activateEnabledPlugins() {
    try {
      const enabledPlugins = await invoke('get_enabled_plugins')
      
      for (const pluginId of enabledPlugins) {
        if (this.plugins.has(pluginId)) {
          try {
            await this.activatePlugin(pluginId, 'startup')
          } catch (error) {
            this.logger.error(`Failed to activate enabled plugin ${pluginId}:`, error)
          }
        }
      }
    } catch (error) {
      this.logger.error('Failed to get enabled plugins:', error)
    }
  }

  /**
   * Handle plugin activation events
   */
  handlePluginActivated(data) {
    const { pluginId } = data
    this.logger.info(`Plugin ${pluginId} activated successfully`)
    
    // Trigger workspace events for newly activated plugins
    this.lifecycleManager.triggerWorkspaceEvent('plugin_activated', { pluginId })
  }

  /**
   * Handle plugin deactivation events
   */
  handlePluginDeactivated(data) {
    const { pluginId } = data
    this.logger.info(`Plugin ${pluginId} deactivated successfully`)
  }

  /**
   * Handle plugin errors
   */
  handlePluginError(data) {
    const { pluginId, error } = data
    this.logger.error(`Plugin ${pluginId} error:`, error)
    
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      plugin.lastError = error
      plugin.errorCount = (plugin.errorCount || 0) + 1
    }
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    // Implementation similar to original PluginManager
    // This would build the dependency relationships between plugins
  }

  /**
   * Resolve plugin load order
   */
  resolveLoadOrder() {
    // Implementation similar to original PluginManager
    // This would determine the order in which plugins should be loaded
    this.loadOrder = Array.from(this.registry.keys())
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all plugins
   */
  getAllPlugins() {
    return Array.from(this.plugins.values())
  }

  /**
   * Get active plugins
   */
  getActivePlugins() {
    return Array.from(this.plugins.values()).filter(plugin => plugin.isActive)
  }

  /**
   * Get plugin API for a specific plugin
   */
  getPluginAPI(pluginId) {
    const context = this.lifecycleManager.getPluginContext(pluginId)
    return context?.api || null
  }

  /**
   * Get plugin state for a specific plugin
   */
  getPluginState(pluginId) {
    return this.stateManager.getPluginState(pluginId)
  }

  /**
   * Subscribe to plugin events
   */
  subscribeToPluginEvents(pluginId, channelName, eventType, handler, options) {
    return this.eventSystem.subscribe(pluginId, channelName, eventType, handler, options)
  }

  /**
   * Publish plugin event
   */
  async publishPluginEvent(channelName, eventType, data, metadata) {
    return await this.eventSystem.publish(channelName, eventType, data, metadata)
  }

  /**
   * Get comprehensive plugin statistics
   */
  getStats() {
    const plugins = Array.from(this.plugins.values())
    
    return {
      overview: {
        totalPlugins: plugins.length,
        activePlugins: plugins.filter(p => p.isActive).length,
        errorPlugins: plugins.filter(p => p.lastError).length,
        registeredPlugins: this.registry.size
      },
      lifecycle: this.lifecycleManager.getStats(),
      events: this.eventSystem.getStats(),
      state: this.stateManager.getStats(),
      plugins: plugins.map(plugin => ({
        id: plugin.id,
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        isActive: plugin.isActive,
        registeredAt: plugin.registeredAt,
        activatedAt: plugin.activatedAt,
        errorCount: plugin.errorCount || 0,
        lastError: plugin.lastError
      }))
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId) {
    try {
      const wasActive = this.plugins.get(pluginId)?.isActive || false
      
      // Unregister plugin
      await this.lifecycleManager.unregisterPlugin(pluginId)
      
      // Re-register plugin
      await this.registerPlugin(pluginId)
      
      // Reactivate if it was active
      if (wasActive) {
        await this.activatePlugin(pluginId, 'reload')
      }
      
      this.emit('plugin_reloaded', { pluginId })
      this.logger.info(`Reloaded plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to reload plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Get plugin logs
   */
  getPluginLogs(pluginId, limit = 100) {
    // This would retrieve logs specific to a plugin
    // Implementation depends on logging system
    return []
  }

  /**
   * Export plugin configuration
   */
  async exportPluginConfiguration(pluginId) {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }
    
    const state = await this.stateManager.exportPluginState(pluginId)
    const subscriptions = this.eventSystem.getPluginSubscriptions(pluginId)
    
    return {
      plugin: {
        id: plugin.id,
        manifest: plugin.manifest,
        isActive: plugin.isActive
      },
      state,
      subscriptions,
      exportedAt: Date.now()
    }
  }

  /**
   * Import plugin configuration
   */
  async importPluginConfiguration(configData) {
    const { plugin, state } = configData
    
    if (state) {
      await this.stateManager.importPluginState(state)
    }
    
    this.emit('plugin_configuration_imported', { pluginId: plugin.id })
  }

  /**
   * Shutdown the enhanced plugin manager
   */
  async shutdown() {
    try {
      // Shutdown all core systems
      await this.lifecycleManager.shutdown()
      await this.eventSystem.shutdown()
      await this.stateManager.shutdown()
      
      // Clear local storage
      this.plugins.clear()
      this.registry.clear()
      this.loadOrder = []
      this.pluginDirs.clear()
      
      this.isInitialized = false
      this.emit('enhanced_manager_shutdown')
      this.removeAllListeners()
      
      this.logger.info('Enhanced plugin manager shutdown complete')
    } catch (error) {
      this.logger.error('Error during enhanced plugin manager shutdown:', error)
      throw error
    }
  }
}

// Create singleton instance
export const enhancedPluginManager = new EnhancedPluginManager()

export default enhancedPluginManager