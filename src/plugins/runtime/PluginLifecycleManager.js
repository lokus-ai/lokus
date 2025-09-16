/**
 * Plugin Lifecycle Manager
 * Handles the complete lifecycle of plugins including activation, deactivation, and resource management
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginRuntime } from './PluginRuntime.js'
import { ExtendedPluginAPI } from '../PluginAPIExtended.js'
import { PluginSecurityManager } from './PluginSecurityManager.js'

export class PluginLifecycleManager extends EventEmitter {
  constructor() {
    super()
    this.plugins = new Map() // pluginId -> PluginContext
    this.activationEvents = new Map() // event -> Set<pluginId>
    this.runtime = new PluginRuntime()
    this.securityManager = new PluginSecurityManager()
    this.editorAPI = null
    this.isInitialized = false
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Initialize the lifecycle manager
   */
  async initialize(editorAPI) {
    if (this.isInitialized) {
      return
    }

    try {
      this.editorAPI = editorAPI
      
      // Initialize runtime and security manager
      await this.runtime.initialize(editorAPI)
      await this.securityManager.initialize()
      
      // Set up event listeners
      this.setupEventListeners()
      
      this.isInitialized = true
      this.emit('lifecycle_manager_initialized')
      this.logger.info('Plugin lifecycle manager initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize lifecycle manager:', error)
      throw error
    }
  }

  /**
   * Set up event listeners for plugin runtime
   */
  setupEventListeners() {
    // Listen to runtime events
    this.runtime.on('plugin_executed', (data) => {
      this.handlePluginExecuted(data)
    })
    
    this.runtime.on('plugin_error', (data) => {
      this.handlePluginError(data)
    })
    
    // Listen to workspace events that might trigger plugin activation
    this.on('workspace_event', (event) => {
      this.handleWorkspaceEvent(event)
    })
  }

  /**
   * Register a plugin for lifecycle management
   */
  async registerPlugin(pluginId, manifest, pluginPath) {
    try {
      // Validate plugin manifest
      this.validatePluginManifest(manifest)
      
      // Create plugin context
      const context = await this.createPluginContext(pluginId, manifest, pluginPath)
      
      // Store plugin context
      this.plugins.set(pluginId, context)
      
      // Register activation events
      this.registerActivationEvents(pluginId, manifest.activationEvents || [])
      
      this.emit('plugin_registered', { pluginId, manifest })
      this.logger.info(`Plugin ${pluginId} registered successfully`)
      
      return context
    } catch (error) {
      this.logger.error(`Failed to register plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Create plugin context
   */
  async createPluginContext(pluginId, manifest, pluginPath) {
    // Create enhanced plugin API
    const api = new ExtendedPluginAPI(pluginId, this.editorAPI, this.securityManager)
    
    // Load plugin code
    let pluginCode = ''
    if (manifest.main) {
      try {
        const { readTextFile } = await import('@tauri-apps/api/fs')
        const { join } = await import('@tauri-apps/api/path')
        const mainPath = await join(pluginPath, manifest.main)
        pluginCode = await readTextFile(mainPath)
      } catch (error) {
        throw new Error(`Failed to load plugin main file: ${error.message}`)
      }
    }
    
    const context = {
      pluginId,
      manifest,
      pluginPath,
      pluginCode,
      api,
      state: 'registered',
      isActive: false,
      activationTime: null,
      deactivationTime: null,
      resourceUsage: {
        memoryUsage: 0,
        cpuUsage: 0,
        activationCount: 0,
        errorCount: 0
      },
      disposables: [],
      timers: new Set(),
      subscriptions: new Set()
    }
    
    // Set up API event handlers
    this.setupAPIEventHandlers(context)
    
    return context
  }

  /**
   * Set up API event handlers for a plugin context
   */
  setupAPIEventHandlers(context) {
    const { api } = context
    
    // Handle command registrations
    api.on('command_registered', (data) => {
      this.logger.info(`Plugin ${context.pluginId} registered command: ${data.commandId}`)
    })
    
    // Handle UI registrations
    api.on('statusbar_show', (data) => {
      this.emit('plugin_statusbar_update', { pluginId: context.pluginId, ...data })
    })
    
    api.on('webview_create', (data) => {
      this.emit('plugin_webview_create', { pluginId: context.pluginId, ...data })
    })
    
    // Handle notifications
    api.on('show_message', (data) => {
      this.emit('plugin_show_message', { pluginId: context.pluginId, ...data })
    })
    
    // Handle output channels
    api.on('output_create', (data) => {
      this.emit('plugin_output_create', { pluginId: context.pluginId, ...data })
    })
    
    // Handle settings changes
    api.on('setting_changed', (data) => {
      this.emit('plugin_setting_changed', { pluginId: context.pluginId, ...data })
    })
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId, reason = 'manual') {
    const context = this.plugins.get(pluginId)
    if (!context) {
      throw new Error(`Plugin ${pluginId} not registered`)
    }
    
    if (context.isActive) {
      this.logger.warn(`Plugin ${pluginId} is already active`)
      return
    }
    
    try {
      this.logger.info(`Activating plugin ${pluginId} (reason: ${reason})`)
      context.state = 'activating'
      
      // Check dependencies
      await this.checkDependencies(context)
      
      // Execute plugin in runtime
      await this.runtime.executePlugin(
        pluginId,
        context.pluginCode,
        context.manifest,
        context.api
      )
      
      // Activate plugin in runtime
      await this.runtime.activatePlugin(pluginId)
      
      // Update context state
      context.isActive = true
      context.state = 'active'
      context.activationTime = Date.now()
      context.resourceUsage.activationCount++
      
      this.emit('plugin_activated', { pluginId, reason })
      this.logger.info(`Plugin ${pluginId} activated successfully`)
      
    } catch (error) {
      context.state = 'error'
      context.resourceUsage.errorCount++
      this.logger.error(`Failed to activate plugin ${pluginId}:`, error)
      this.emit('plugin_activation_failed', { pluginId, error })
      throw error
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId, reason = 'manual') {
    const context = this.plugins.get(pluginId)
    if (!context) {
      throw new Error(`Plugin ${pluginId} not registered`)
    }
    
    if (!context.isActive) {
      this.logger.warn(`Plugin ${pluginId} is not active`)
      return
    }
    
    try {
      this.logger.info(`Deactivating plugin ${pluginId} (reason: ${reason})`)
      context.state = 'deactivating'
      
      // Deactivate plugin in runtime
      await this.runtime.deactivatePlugin(pluginId)
      
      // Cleanup plugin resources
      await this.cleanupPluginResources(context)
      
      // Update context state
      context.isActive = false
      context.state = 'inactive'
      context.deactivationTime = Date.now()
      
      this.emit('plugin_deactivated', { pluginId, reason })
      this.logger.info(`Plugin ${pluginId} deactivated successfully`)
      
    } catch (error) {
      context.state = 'error'
      context.resourceUsage.errorCount++
      this.logger.error(`Failed to deactivate plugin ${pluginId}:`, error)
      this.emit('plugin_deactivation_failed', { pluginId, error })
      throw error
    }
  }

  /**
   * Unregister a plugin
   */
  async unregisterPlugin(pluginId) {
    const context = this.plugins.get(pluginId)
    if (!context) {
      return
    }
    
    try {
      // Deactivate if active
      if (context.isActive) {
        await this.deactivatePlugin(pluginId, 'unregister')
      }
      
      // Cleanup runtime
      await this.runtime.cleanupPlugin(pluginId)
      
      // Cleanup API
      await context.api.cleanup()
      
      // Cleanup security context
      this.securityManager.cleanupSecurityContext(pluginId)
      
      // Remove activation event registrations
      this.unregisterActivationEvents(pluginId)
      
      // Remove from plugins map
      this.plugins.delete(pluginId)
      
      this.emit('plugin_unregistered', { pluginId })
      this.logger.info(`Plugin ${pluginId} unregistered successfully`)
      
    } catch (error) {
      this.logger.error(`Failed to unregister plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Register activation events for a plugin
   */
  registerActivationEvents(pluginId, activationEvents) {
    for (const event of activationEvents) {
      if (!this.activationEvents.has(event)) {
        this.activationEvents.set(event, new Set())
      }
      this.activationEvents.get(event).add(pluginId)
    }
  }

  /**
   * Unregister activation events for a plugin
   */
  unregisterActivationEvents(pluginId) {
    for (const [event, pluginIds] of this.activationEvents.entries()) {
      pluginIds.delete(pluginId)
      if (pluginIds.size === 0) {
        this.activationEvents.delete(event)
      }
    }
  }

  /**
   * Handle workspace events that might trigger plugin activation
   */
  async handleWorkspaceEvent(event) {
    const { type, data } = event
    
    // Check if any plugins should be activated by this event
    const pluginsToActivate = this.activationEvents.get(type) || new Set()
    
    for (const pluginId of pluginsToActivate) {
      const context = this.plugins.get(pluginId)
      if (context && !context.isActive) {
        try {
          await this.activatePlugin(pluginId, `event:${type}`)
        } catch (error) {
          this.logger.error(`Failed to activate plugin ${pluginId} on event ${type}:`, error)
        }
      }
    }
  }

  /**
   * Trigger workspace event
   */
  triggerWorkspaceEvent(type, data) {
    this.emit('workspace_event', { type, data })
  }

  /**
   * Check plugin dependencies
   */
  async checkDependencies(context) {
    const { manifest } = context
    
    if (!manifest.dependencies) {
      return
    }
    
    for (const [depId, depVersion] of Object.entries(manifest.dependencies)) {
      const depContext = this.plugins.get(depId)
      
      if (!depContext) {
        throw new Error(`Dependency not found: ${depId}`)
      }
      
      if (!depContext.isActive) {
        // Try to activate dependency
        await this.activatePlugin(depId, 'dependency')
      }
      
      // Check version compatibility (basic check)
      if (depContext.manifest.version !== depVersion) {
        this.logger.warn(`Version mismatch for dependency ${depId}: expected ${depVersion}, got ${depContext.manifest.version}`)
      }
    }
  }

  /**
   * Cleanup plugin resources
   */
  async cleanupPluginResources(context) {
    // Clear timers
    for (const timer of context.timers) {
      clearTimeout(timer)
      clearInterval(timer)
    }
    context.timers.clear()
    
    // Dispose of subscriptions
    for (const subscription of context.subscriptions) {
      try {
        if (typeof subscription.dispose === 'function') {
          subscription.dispose()
        } else if (typeof subscription === 'function') {
          subscription()
        }
      } catch (error) {
        this.logger.error('Error disposing subscription:', error)
      }
    }
    context.subscriptions.clear()
    
    // Dispose of disposables
    for (const disposable of context.disposables) {
      try {
        if (typeof disposable.dispose === 'function') {
          disposable.dispose()
        } else if (typeof disposable === 'function') {
          disposable()
        }
      } catch (error) {
        this.logger.error('Error disposing resource:', error)
      }
    }
    context.disposables = []
  }

  /**
   * Validate plugin manifest
   */
  validatePluginManifest(manifest) {
    const required = ['id', 'name', 'version', 'main']
    
    for (const field of required) {
      if (!manifest[field]) {
        throw new Error(`Missing required field in manifest: ${field}`)
      }
    }
    
    // Validate activation events
    if (manifest.activationEvents) {
      const validEvents = [
        'onStartup',
        'onCommand',
        'onLanguage',
        'onDebug',
        'onFileSystemChange',
        'onUri',
        'onWebviewPanel',
        'onCustomEditor',
        'onAuthenticationRequest',
        'onWorkspaceContainsFiles'
      ]
      
      for (const event of manifest.activationEvents) {
        if (!validEvents.some(validEvent => event.startsWith(validEvent))) {
          this.logger.warn(`Unknown activation event: ${event}`)
        }
      }
    }
  }

  /**
   * Handle plugin execution completion
   */
  handlePluginExecuted(data) {
    const { pluginId } = data
    const context = this.plugins.get(pluginId)
    
    if (context) {
      context.state = 'loaded'
      this.logger.info(`Plugin ${pluginId} executed successfully`)
    }
  }

  /**
   * Handle plugin runtime errors
   */
  handlePluginError(data) {
    const { pluginId, error } = data
    const context = this.plugins.get(pluginId)
    
    if (context) {
      context.state = 'error'
      context.resourceUsage.errorCount++
      this.logger.error(`Plugin ${pluginId} runtime error:`, error)
    }
  }

  /**
   * Get plugin context
   */
  getPluginContext(pluginId) {
    return this.plugins.get(pluginId)
  }

  /**
   * Get all plugin contexts
   */
  getAllPluginContexts() {
    return Array.from(this.plugins.values())
  }

  /**
   * Get active plugins
   */
  getActivePlugins() {
    return Array.from(this.plugins.values()).filter(context => context.isActive)
  }

  /**
   * Get plugin statistics
   */
  getPluginStats(pluginId) {
    const context = this.plugins.get(pluginId)
    if (!context) {
      return null
    }
    
    return {
      pluginId,
      state: context.state,
      isActive: context.isActive,
      activationTime: context.activationTime,
      deactivationTime: context.deactivationTime,
      resourceUsage: { ...context.resourceUsage },
      uptime: context.activationTime ? Date.now() - context.activationTime : 0
    }
  }

  /**
   * Get lifecycle manager statistics
   */
  getStats() {
    const contexts = Array.from(this.plugins.values())
    
    return {
      totalPlugins: contexts.length,
      activePlugins: contexts.filter(c => c.isActive).length,
      errorPlugins: contexts.filter(c => c.state === 'error').length,
      byState: {
        registered: contexts.filter(c => c.state === 'registered').length,
        activating: contexts.filter(c => c.state === 'activating').length,
        active: contexts.filter(c => c.state === 'active').length,
        deactivating: contexts.filter(c => c.state === 'deactivating').length,
        inactive: contexts.filter(c => c.state === 'inactive').length,
        error: contexts.filter(c => c.state === 'error').length
      },
      runtime: this.runtime.getStats(),
      activationEvents: Array.from(this.activationEvents.keys())
    }
  }

  /**
   * Shutdown lifecycle manager
   */
  async shutdown() {
    const pluginIds = Array.from(this.plugins.keys())
    
    // Deactivate all active plugins
    for (const pluginId of pluginIds) {
      try {
        await this.deactivatePlugin(pluginId, 'shutdown')
      } catch (error) {
        this.logger.error(`Error deactivating plugin ${pluginId} during shutdown:`, error)
      }
    }
    
    // Unregister all plugins
    for (const pluginId of pluginIds) {
      try {
        await this.unregisterPlugin(pluginId)
      } catch (error) {
        this.logger.error(`Error unregistering plugin ${pluginId} during shutdown:`, error)
      }
    }
    
    // Shutdown runtime and security manager
    await this.runtime.shutdown()
    this.securityManager.shutdown()
    
    this.plugins.clear()
    this.activationEvents.clear()
    this.isInitialized = false
    
    this.emit('lifecycle_manager_shutdown')
    this.removeAllListeners()
  }
}

export default PluginLifecycleManager