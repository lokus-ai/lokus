import { invoke } from '@tauri-apps/api/core'
import { join, homeDir } from '@tauri-apps/api/path'
import { readDir, exists, readTextFile } from '@tauri-apps/api/fs'
import { EventEmitter } from '../utils/EventEmitter.js'

/**
 * Plugin Management System
 * Provides plugin loading, lifecycle management, dependency resolution, and error handling
 */

export class PluginManager extends EventEmitter {
  constructor() {
    super()
    this.plugins = new Map() // pluginId -> plugin instance
    this.registry = new Map() // pluginId -> plugin metadata
    this.loadedPlugins = new Set()
    this.activePlugins = new Set()
    this.dependencies = new Map() // pluginId -> Set of dependency pluginIds
    this.dependents = new Map() // pluginId -> Set of dependent pluginIds
    this.loadOrder = []
    this.pluginDirs = new Set()
    this.isInitialized = false
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Initialize the plugin system
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Setup plugin directories
      await this.setupPluginDirectories()
      
      // Discover available plugins
      await this.discoverPlugins()
      
      // Load all discovered plugins
      await this.loadAllPlugins()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('Plugin system initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize plugin system:', error)
      throw error
    }
  }

  /**
   * Setup plugin directories
   */
  async setupPluginDirectories() {
    try {
      const home = await homeDir()
      const pluginDir = await join(home, '.lokus', 'plugins')
      
      // Add default plugin directories
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
    
    // Validate and register discovered plugins
    for (const plugin of discovered) {
      try {
        await this.validatePluginManifest(plugin.manifest)
        this.registry.set(plugin.id, {
          ...plugin,
          status: 'discovered'
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
   * Validate plugin manifest schema
   */
  async validatePluginManifest(manifest) {
    const required = ['id', 'name', 'version', 'main', 'lokusVersion']
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Invalid version format (expected: x.y.z)')
    }
    
    // Validate Lokus compatibility
    if (!this.isVersionCompatible(manifest.lokusVersion)) {
      throw new Error(`Incompatible Lokus version: ${manifest.lokusVersion}`)
    }
    
    // Validate dependencies
    if (manifest.dependencies) {
      if (typeof manifest.dependencies !== 'object') {
        throw new Error('Dependencies must be an object')
      }
    }
    
    return true
  }

  /**
   * Check if plugin is compatible with current Lokus version
   */
  isVersionCompatible(requiredVersion) {
    // TODO: Implement proper semver compatibility checking
    // For now, just return true
    return true
  }

  /**
   * Load all discovered plugins
   */
  async loadAllPlugins() {
    // Build dependency graph
    this.buildDependencyGraph()
    
    // Resolve load order
    this.resolveLoadOrder()
    
    // Load plugins in dependency order
    for (const pluginId of this.loadOrder) {
      try {
        await this.loadPlugin(pluginId)
      } catch (error) {
        this.logger.error(`Failed to load plugin ${pluginId}:`, error)
      }
    }
  }

  /**
   * Build dependency graph
   */
  buildDependencyGraph() {
    this.dependencies.clear()
    this.dependents.clear()
    
    for (const [pluginId, plugin] of this.registry) {
      const deps = plugin.manifest.dependencies || {}
      const depIds = Object.keys(deps)
      
      this.dependencies.set(pluginId, new Set(depIds))
      
      // Build reverse dependency graph
      for (const depId of depIds) {
        if (!this.dependents.has(depId)) {
          this.dependents.set(depId, new Set())
        }
        this.dependents.get(depId).add(pluginId)
      }
    }
  }

  /**
   * Resolve plugin load order using topological sort
   */
  resolveLoadOrder() {
    const visited = new Set()
    const temp = new Set()
    const order = []
    
    const visit = (pluginId) => {
      if (temp.has(pluginId)) {
        throw new Error(`Circular dependency detected: ${pluginId}`)
      }
      
      if (visited.has(pluginId)) {
        return
      }
      
      temp.add(pluginId)
      
      const deps = this.dependencies.get(pluginId) || new Set()
      for (const depId of deps) {
        if (!this.registry.has(depId)) {
          throw new Error(`Missing dependency: ${depId} required by ${pluginId}`)
        }
        visit(depId)
      }
      
      temp.delete(pluginId)
      visited.add(pluginId)
      order.push(pluginId)
    }
    
    for (const pluginId of this.registry.keys()) {
      if (!visited.has(pluginId)) {
        visit(pluginId)
      }
    }
    
    this.loadOrder = order
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginId) {
    if (this.loadedPlugins.has(pluginId)) {
      return this.plugins.get(pluginId)
    }
    
    const pluginInfo = this.registry.get(pluginId)
    if (!pluginInfo) {
      throw new Error(`Plugin not found: ${pluginId}`)
    }
    
    try {
      // Load dependencies first
      const deps = this.dependencies.get(pluginId) || new Set()
      for (const depId of deps) {
        if (!this.loadedPlugins.has(depId)) {
          await this.loadPlugin(depId)
        }
      }
      
      // Load plugin main file
      const mainPath = await join(pluginInfo.path, pluginInfo.manifest.main)
      
      if (!(await exists(mainPath))) {
        throw new Error(`Main file not found: ${pluginInfo.manifest.main}`)
      }
      
      // Dynamic import the plugin
      const pluginModule = await import(mainPath)
      const PluginClass = pluginModule.default || pluginModule.Plugin
      
      if (!PluginClass) {
        throw new Error('Plugin must export a default class or Plugin class')
      }
      
      // Create plugin instance
      const plugin = new PluginClass()
      
      // Set plugin metadata
      plugin.id = pluginId
      plugin.manifest = pluginInfo.manifest
      plugin.path = pluginInfo.path
      
      // Store plugin
      this.plugins.set(pluginId, plugin)
      this.loadedPlugins.add(pluginId)
      
      // Update registry status
      this.registry.get(pluginId).status = 'loaded'
      
      this.emit('plugin_loaded', { pluginId, plugin })
      this.logger.info(`Loaded plugin: ${pluginId}`)
      
      return plugin
    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId}:`, error)
      this.registry.get(pluginId).status = 'error'
      this.registry.get(pluginId).error = error.message
      throw error
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId) {
    if (this.activePlugins.has(pluginId)) {
      return
    }
    
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${pluginId}`)
    }
    
    try {
      // Activate dependencies first
      const deps = this.dependencies.get(pluginId) || new Set()
      for (const depId of deps) {
        if (!this.activePlugins.has(depId)) {
          await this.activatePlugin(depId)
        }
      }
      
      // Call plugin activate method
      if (typeof plugin.activate === 'function') {
        await plugin.activate()
      }
      
      this.activePlugins.add(pluginId)
      this.registry.get(pluginId).status = 'active'
      
      this.emit('plugin_activated', { pluginId, plugin })
      this.logger.info(`Activated plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to activate plugin ${pluginId}:`, error)
      this.registry.get(pluginId).status = 'error'
      this.registry.get(pluginId).error = error.message
      throw error
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId) {
    if (!this.activePlugins.has(pluginId)) {
      return
    }
    
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      throw new Error(`Plugin not loaded: ${pluginId}`)
    }
    
    try {
      // Deactivate dependents first
      const dependents = this.dependents.get(pluginId) || new Set()
      for (const depId of dependents) {
        if (this.activePlugins.has(depId)) {
          await this.deactivatePlugin(depId)
        }
      }
      
      // Call plugin deactivate method
      if (typeof plugin.deactivate === 'function') {
        await plugin.deactivate()
      }
      
      this.activePlugins.delete(pluginId)
      this.registry.get(pluginId).status = 'loaded'
      
      this.emit('plugin_deactivated', { pluginId, plugin })
      this.logger.info(`Deactivated plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to deactivate plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId) {
    if (!this.loadedPlugins.has(pluginId)) {
      return
    }
    
    // Deactivate first
    if (this.activePlugins.has(pluginId)) {
      await this.deactivatePlugin(pluginId)
    }
    
    const plugin = this.plugins.get(pluginId)
    
    try {
      // Call plugin cleanup method
      if (plugin && typeof plugin.cleanup === 'function') {
        await plugin.cleanup()
      }
      
      // Remove from collections
      this.plugins.delete(pluginId)
      this.loadedPlugins.delete(pluginId)
      this.registry.get(pluginId).status = 'discovered'
      
      this.emit('plugin_unloaded', { pluginId })
      this.logger.info(`Unloaded plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to unload plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Reload a plugin
   */
  async reloadPlugin(pluginId) {
    const wasActive = this.activePlugins.has(pluginId)
    
    await this.unloadPlugin(pluginId)
    await this.loadPlugin(pluginId)
    
    if (wasActive) {
      await this.activatePlugin(pluginId)
    }
  }

  /**
   * Get plugin instance
   */
  getPlugin(pluginId) {
    return this.plugins.get(pluginId)
  }

  /**
   * Get plugin registry entry
   */
  getPluginInfo(pluginId) {
    return this.registry.get(pluginId)
  }

  /**
   * Get all plugins
   */
  getAllPlugins() {
    return Array.from(this.registry.entries()).map(([id, info]) => ({
      id,
      ...info,
      instance: this.plugins.get(id)
    }))
  }

  /**
   * Get active plugins
   */
  getActivePlugins() {
    return Array.from(this.activePlugins)
      .map(id => ({
        id,
        plugin: this.plugins.get(id),
        info: this.registry.get(id)
      }))
  }

  /**
   * Check if plugin is loaded
   */
  isPluginLoaded(pluginId) {
    return this.loadedPlugins.has(pluginId)
  }

  /**
   * Check if plugin is active
   */
  isPluginActive(pluginId) {
    return this.activePlugins.has(pluginId)
  }

  /**
   * Install plugin from package
   */
  async installPlugin(packagePath) {
    // TODO: Implement plugin installation from zip/tar
    throw new Error('Plugin installation not yet implemented')
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId) {
    // TODO: Implement plugin uninstallation
    throw new Error('Plugin uninstallation not yet implemented')
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    const stats = {
      total: this.registry.size,
      loaded: this.loadedPlugins.size,
      active: this.activePlugins.size,
      byStatus: {},
      errors: []
    }
    
    for (const [id, info] of this.registry) {
      const status = info.status || 'discovered'
      stats.byStatus[status] = (stats.byStatus[status] || 0) + 1
      
      if (info.error) {
        stats.errors.push({
          pluginId: id,
          error: info.error
        })
      }
    }
    
    return stats
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    const activePlugins = Array.from(this.activePlugins)
    
    for (const pluginId of activePlugins) {
      try {
        await this.deactivatePlugin(pluginId)
      } catch (error) {
        this.logger.error(`Error deactivating plugin ${pluginId} during shutdown:`, error)
      }
    }
    
    this.emit('shutdown')
    this.removeAllListeners()
  }
}

// Create singleton instance
export const pluginManager = new PluginManager()

export default pluginManager