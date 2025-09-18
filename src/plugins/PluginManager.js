import { EventEmitter } from '../utils/EventEmitter.js'
import LokusPluginAPI from './api/LokusPluginAPI.js'

// Browser compatibility utilities
function detectTauriEnvironment() {
  try {
    const w = window;
    return !!(
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (navigator?.userAgent || '').includes('Tauri')
    );
  } catch {
    return false;
  }
}

// Async initialization of Tauri APIs
async function initializeTauriAPIs() {
  const isTauri = detectTauriEnvironment();
  
  if (!isTauri) {
    return { isTauri: false };
  }
  
  // Only try to import Tauri APIs if we're actually in a Tauri environment
  try {
    // Use eval to prevent Vite from analyzing these imports
    const importCore = new Function('return import("@tauri-apps/api/core")');
    const importPath = new Function('return import("@tauri-apps/api/path")');
    const importFs = new Function('return import("@tauri-apps/api/fs")');
    
    const [tauriCore, tauriPath, tauriFs] = await Promise.all([
      importCore(),
      importPath(),
      importFs()
    ]);
    
    return {
      isTauri: true,
      invoke: tauriCore.invoke,
      join: tauriPath.join,
      homeDir: tauriPath.homeDir,
      readDir: tauriFs.readDir,
      exists: tauriFs.exists,
      readTextFile: tauriFs.readTextFile
    };
  } catch (error) {
    console.warn('Failed to load Tauri APIs, running in browser mode:', error);
    return { isTauri: false };
  }
}

/**
 * Plugin Management System
 * Provides plugin loading, lifecycle management, dependency resolution, and error handling
 */

export class PluginManager extends EventEmitter {
  constructor(managers = {}) {
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
    
    // Tauri API references (will be initialized in initialize())
    this.tauri = null
    
    // Create the Plugin API instance that will be passed to plugins
    this.pluginAPI = new LokusPluginAPI(managers)
  }

  /**
   * Initialize the plugin system
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Initialize Tauri APIs (if available)
      this.tauri = await initializeTauriAPIs()
      this.logger.info(`Plugin system running in ${this.tauri.isTauri ? 'Tauri' : 'browser'} mode`)
      
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
      if (this.tauri.isTauri) {
        const home = await this.tauri.homeDir()
        const pluginDir = await this.tauri.join(home, '.lokus', 'plugins')
        
        // Add default plugin directories
        this.pluginDirs.add(pluginDir)
        
        // Ensure plugin directory exists
        if (!(await this.tauri.exists(pluginDir))) {
          await this.tauri.invoke('create_directory', { path: pluginDir })
        }
        
        this.logger.info(`Plugin directory: ${pluginDir}`)
      } else {
        // Browser mode - use test plugin directory
        this.pluginDirs.add('./test-plugins')
        this.logger.info('Plugin directory: ./test-plugins (browser mode)')
      }
    } catch (error) {
      this.logger.error('Failed to setup plugin directories:', error)
      // Don't throw in browser mode, just continue
      if (this.tauri.isTauri) {
        throw error
      }
    }
  }

  /**
   * Discover all available plugins
   */
  async discoverPlugins() {
    const discovered = []
    
    if (!this.tauri.isTauri) {
      // Browser mode - simulate mock plugins for now
      this.logger.info('Running in browser mode - creating mock plugin for testing')
      discovered.push({
        path: './test-plugins/simple-test',
        manifest: {
          id: 'simple-test',
          name: 'Simple Test Plugin',
          version: '1.0.0',
          description: 'A simple test plugin for demonstration',
          author: 'Lokus Team',
          main: 'index.js',
          permissions: ['editor', 'ui']
        },
        id: 'simple-test'
      })
    } else {
      // Tauri mode - read actual filesystem
      for (const pluginDir of this.pluginDirs) {
        try {
          if (!(await this.tauri.exists(pluginDir))) {
            continue
          }
          
          const entries = await this.tauri.readDir(pluginDir, { recursive: false })
          
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
   * Supports both plugin.json (legacy) and manifest.json (new CLI format)
   */
  async loadPluginManifest(pluginPath) {
    if (!this.tauri.isTauri) {
      // Browser mode - return mock manifest for now
      return {
        id: 'simple-test',
        name: 'Simple Test Plugin',
        version: '1.0.0',
        description: 'A simple test plugin for demonstration',
        author: 'Lokus Team',
        main: 'index.js',
        permissions: ['editor', 'ui']
      }
    }
    
    try {
      // Tauri mode - read actual files
      // Try new manifest.json first, then fall back to plugin.json
      let manifestPath = await this.tauri.join(pluginPath, 'manifest.json')
      
      if (!(await this.tauri.exists(manifestPath))) {
        manifestPath = await this.tauri.join(pluginPath, 'plugin.json')
        
        if (!(await this.tauri.exists(manifestPath))) {
          throw new Error('Neither manifest.json nor plugin.json found')
        }
      }
      
      const manifestContent = await this.tauri.readTextFile(manifestPath)
      const manifest = JSON.parse(manifestContent)
      
      return manifest
    } catch (error) {
      throw new Error(`Failed to load manifest: ${error.message}`)
    }
  }

  /**
   * Validate plugin manifest schema
   * Supports both old and new manifest formats
   */
  async validatePluginManifest(manifest) {
    // Required fields for new format
    const newRequired = ['id', 'name', 'version', 'main']
    // Required fields for old format (fallback)
    const oldRequired = ['id', 'name', 'version', 'main', 'lokusVersion']
    
    let required = newRequired
    
    // Check if this is old format (has lokusVersion)
    if (manifest.lokusVersion) {
      required = oldRequired
      
      // Validate Lokus compatibility for old format
      if (!this.isVersionCompatible(manifest.lokusVersion)) {
        throw new Error(`Incompatible Lokus version: ${manifest.lokusVersion}`)
      }
    }
    
    // Check required fields
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field: ${field}`)
      }
    }
    
    // Validate version format
    if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Invalid version format (expected: x.y.z)')
    }
    
    // Validate permissions array (new format)
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        throw new Error('Permissions must be an array')
      }
      
      // Validate each permission
      const validPermissions = [
        'editor', 'ui', 'filesystem', 'network', 
        'clipboard', 'notifications', 'commands', 'data'
      ]
      
      for (const permission of manifest.permissions) {
        if (!validPermissions.includes(permission)) {
          this.logger.warn(`Unknown permission: ${permission}`)
        }
      }
    }
    
    // Validate dependencies
    if (manifest.dependencies) {
      if (typeof manifest.dependencies !== 'object') {
        throw new Error('Dependencies must be an object')
      }
    }
    
    // Validate plugin type
    if (manifest.type) {
      const validTypes = ['editor', 'panel', 'data', 'theme', 'integration']
      if (!validTypes.includes(manifest.type)) {
        this.logger.warn(`Unknown plugin type: ${manifest.type}`)
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
      let mainPath
      if (this.tauri.isTauri) {
        mainPath = await this.tauri.join(pluginInfo.path, pluginInfo.manifest.main)
        
        if (!(await this.tauri.exists(mainPath))) {
          throw new Error(`Main file not found: ${pluginInfo.manifest.main}`)
        }
      } else {
        // Browser mode - use relative path for mock plugin
        mainPath = `${pluginInfo.path}/${pluginInfo.manifest.main}`
      }
      
      // Dynamic import the plugin
      let PluginClass
      if (this.tauri.isTauri) {
        const pluginModule = await import(/* @vite-ignore */ mainPath)
        PluginClass = pluginModule.default || pluginModule.Plugin
        
        if (!PluginClass) {
          throw new Error('Plugin must export a default class or Plugin class')
        }
      } else {
        // Browser mode - create mock plugin class
        PluginClass = class MockTestPlugin {
          constructor(api) {
            this.api = api
            this.id = pluginId
            this.name = pluginInfo.manifest.name
          }
          
          async activate() {
            this.api.logger.info(`Mock plugin ${this.name} activated`)
            // Mock adding a slash command
            await this.api.EditorAPI.addSlashCommand({
              name: 'test',
              description: 'Test command from mock plugin',
              icon: '🧪',
              execute: () => {
                this.api.logger.info('Test command executed!')
              }
            })
          }
          
          async deactivate() {
            this.api.logger.info(`Mock plugin ${this.name} deactivated`)
          }
        }
      }
      
      // Create plugin instance with our API
      const plugin = new PluginClass(this.pluginAPI)
      
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
      
      // Set plugin context in API
      this.pluginAPI.setPluginContext(pluginId, plugin)
      
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
      
      // Clean up plugin resources
      await this.pluginAPI.cleanup(pluginId)
      
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