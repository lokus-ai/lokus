/**
 * Extension Manager - Handles plugin extension lifecycle and registration
 * 
 * This manager coordinates between the plugin system and the editor,
 * providing lifecycle management, validation, and hot-reloading support
 * for TipTap extensions provided by plugins.
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { editorAPI } from './EditorAPI.js'
import { pluginAPI } from './PluginAPI.js'
import { errorHandler } from './ErrorHandler.js'

export class ExtensionManager extends EventEmitter {
  constructor() {
    super()
    
    // Extension state tracking
    this.loadedExtensions = new Map() // pluginId -> Set of extension IDs
    this.extensionDependencies = new Map() // extensionId -> Set of dependency IDs
    this.loadOrder = [] // Array of plugin IDs in load order
    
    // Performance tracking
    this.loadTimes = new Map()
    this.errorCounts = new Map()
    
    // Hot reload state
    this.isHotReloading = false
    this.hotReloadQueue = []
    
    // Initialize event listeners
    this.setupEventListeners()
    
    // Setup error handler integration
    this.setupErrorHandlerIntegration()
  }

  /**
   * Setup event listeners for plugin lifecycle
   */
  setupEventListeners() {
    // Listen for plugin enable/disable events
    pluginAPI.on?.('plugin-enabled', this.handlePluginEnabled.bind(this))
    pluginAPI.on?.('plugin-disabled', this.handlePluginDisabled.bind(this))
    
    // Listen for editor API events
    editorAPI.on('extension-registered', this.handleExtensionRegistered.bind(this))
    editorAPI.on('extension-error', this.handleExtensionError.bind(this))
    editorAPI.on('hot-reload-error', this.handleHotReloadError.bind(this))
  }
  
  /**
   * Setup error handler integration
   */
  setupErrorHandlerIntegration() {
    // Listen for error handler events
    errorHandler.on('disable-plugin-request', this.handleDisablePluginRequest.bind(this))
    errorHandler.on('quarantine-plugin-request', this.handleQuarantinePluginRequest.bind(this))
    errorHandler.on('reload-plugin-request', this.handleReloadPluginRequest.bind(this))
    errorHandler.on('clear-plugin-caches-request', this.handleClearPluginCachesRequest.bind(this))
    errorHandler.on('optimize-plugin-request', this.handleOptimizePluginRequest.bind(this))
  }

  /**
   * Load all extensions from enabled plugins
   */
  async loadAllExtensions() {
    const startTime = performance.now()
    
    try {
      console.log('[ExtensionManager] Loading extensions from all enabled plugins...')
      
      // Get enabled plugins
      const enabledPlugins = await this.getEnabledPlugins()
      console.log(`[ExtensionManager] Found ${enabledPlugins.length} enabled plugins`)
      
      // Load extensions from each plugin
      const loadPromises = enabledPlugins.map(plugin => this.loadPluginExtensions(plugin))
      const results = await Promise.allSettled(loadPromises)
      
      // Process results
      let successCount = 0
      let errorCount = 0
      
      results.forEach((result, index) => {
        const pluginId = enabledPlugins[index].id || enabledPlugins[index]
        if (result.status === 'fulfilled') {
          successCount++
          console.log(`[ExtensionManager] ✅ Successfully loaded extensions for ${pluginId}`)
        } else {
          errorCount++
          console.error(`[ExtensionManager] ❌ Failed to load extensions for ${pluginId}:`, result.reason)
        }
      })
      
      const loadTime = performance.now() - startTime
      console.log(`[ExtensionManager] Extension loading completed in ${loadTime.toFixed(2)}ms - ${successCount} success, ${errorCount} errors`)
      
      this.emit('extensions-loaded', {
        successCount,
        errorCount,
        loadTime,
        totalPlugins: enabledPlugins.length
      })
      
      return {
        success: true,
        successCount,
        errorCount,
        loadTime
      }
      
    } catch (error) {
      console.error('[ExtensionManager] Failed to load extensions:', error)
      this.emit('load-error', { error })
      throw error
    }
  }

  /**
   * Load extensions from a specific plugin
   */
  async loadPluginExtensions(plugin) {
    const pluginId = plugin.id || plugin.name || plugin
    const startTime = performance.now()
    
    try {
      console.log(`[ExtensionManager] Loading extensions for plugin: ${pluginId}`)
      
      // Check if plugin is quarantined
      if (errorHandler.quarantinedPlugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is quarantined and cannot be loaded`)
      }
      
      // Clear any existing extensions for this plugin
      await this.unloadPluginExtensions(pluginId)
      
      // Get plugin instance or load it
      const pluginInstance = await this.getPluginInstance(pluginId)
      if (!pluginInstance) {
        throw new Error(`Plugin ${pluginId} not found or not properly loaded`)
      }
      
      // Check if plugin has editor extensions
      if (!pluginInstance.editorExtensions && !pluginInstance.registerEditorExtensions) {
        console.log(`[ExtensionManager] Plugin ${pluginId} has no editor extensions`)
        return { extensionCount: 0 }
      }
      
      // Register extensions
      const extensionIds = new Set()
      
      // Call plugin's extension registration method
      if (typeof pluginInstance.registerEditorExtensions === 'function') {
        console.log(`[ExtensionManager] Calling registerEditorExtensions for ${pluginId}`)
        await pluginInstance.registerEditorExtensions(editorAPI)
      }
      
      // Process static extensions if available
      if (pluginInstance.editorExtensions) {
        console.log(`[ExtensionManager] Processing static extensions for ${pluginId}`)
        await this.processStaticExtensions(pluginId, pluginInstance.editorExtensions, extensionIds)
      }
      
      // Track loaded extensions
      this.loadedExtensions.set(pluginId, extensionIds)
      
      const loadTime = performance.now() - startTime
      this.loadTimes.set(pluginId, loadTime)
      
      // Monitor performance
      errorHandler.monitorPerformance(pluginId, 'extensionLoad', loadTime, {
        extensionCount: extensionIds.size
      })
      
      console.log(`[ExtensionManager] ✅ Loaded ${extensionIds.size} extensions for ${pluginId} in ${loadTime.toFixed(2)}ms`)
      
      this.emit('plugin-extensions-loaded', {
        pluginId,
        extensionCount: extensionIds.size,
        loadTime
      })
      
      return {
        pluginId,
        extensionCount: extensionIds.size,
        loadTime,
        extensionIds: Array.from(extensionIds)
      }
      
    } catch (error) {
      const loadTime = performance.now() - startTime
      
      // Handle error with context
      const errorInfo = errorHandler.handleError(pluginId, error, {
        operation: 'extension-loading',
        loadTime,
        plugin
      })
      
      console.error(`[ExtensionManager] Failed to load extensions for ${pluginId}:`, error)
      
      // Track error
      const currentErrors = this.errorCounts.get(pluginId) || 0
      this.errorCounts.set(pluginId, currentErrors + 1)
      
      this.emit('plugin-extensions-error', {
        pluginId,
        error,
        errorInfo,
        loadTime
      })
      
      throw new Error(`Failed to load extensions for ${pluginId}: ${error.message}`)
    }
  }

  /**
   * Process static extension definitions
   */
  async processStaticExtensions(pluginId, extensions, extensionIds) {
    if (!Array.isArray(extensions)) {
      extensions = [extensions]
    }
    
    for (const extension of extensions) {
      try {
        let extensionId
        const extensionStartTime = performance.now()
        
        // Validate security for extension
        const securityViolations = errorHandler.validateSecurity(pluginId, `register-${extension.type}`, {
          extension,
          extensionName: extension.name || extension.id
        })
        
        if (securityViolations.length > 0) {
          console.warn(`[ExtensionManager] Security violations for ${extension.type} in ${pluginId}:`, securityViolations)
        }
        
        if (extension.type === 'node') {
          extensionId = editorAPI.registerNode(pluginId, extension)
        } else if (extension.type === 'mark') {
          extensionId = editorAPI.registerMark(pluginId, extension)
        } else if (extension.type === 'extension') {
          extensionId = editorAPI.registerExtension(pluginId, extension)
        } else if (extension.type === 'slash-command') {
          extensionId = editorAPI.registerSlashCommand(pluginId, extension)
        } else if (extension.type === 'toolbar-item') {
          extensionId = editorAPI.registerToolbarItem(pluginId, extension)
        } else if (extension.type === 'input-rule') {
          extensionId = editorAPI.registerInputRule(pluginId, extension)
        } else if (extension.type === 'keyboard-shortcut') {
          extensionId = editorAPI.registerKeyboardShortcut(pluginId, extension)
        } else {
          console.warn(`[ExtensionManager] Unknown extension type: ${extension.type} for plugin ${pluginId}`)
          continue
        }
        
        // Monitor extension registration performance
        const extensionLoadTime = performance.now() - extensionStartTime
        errorHandler.monitorPerformance(pluginId, 'extensionRegistration', extensionLoadTime, {
          extensionType: extension.type,
          extensionName: extension.name || extension.id
        })
        
        if (extensionId) {
          extensionIds.add(extensionId)
        }
        
      } catch (error) {
        // Handle error with context
        const errorInfo = errorHandler.handleError(pluginId, error, {
          operation: 'extension-registration',
          extensionType: extension.type,
          extensionName: extension.name || extension.id,
          extension
        })
        
        console.error(`[ExtensionManager] Failed to register extension for ${pluginId}:`, error)
        // Continue with other extensions even if one fails
      }
    }
  }

  /**
   * Unload extensions from a specific plugin
   */
  async unloadPluginExtensions(pluginId) {
    console.log(`[ExtensionManager] Unloading extensions for plugin: ${pluginId}`)
    
    // Remove from editor API
    editorAPI.unregisterPlugin(pluginId)
    
    // Clear tracking
    this.loadedExtensions.delete(pluginId)
    this.loadTimes.delete(pluginId)
    this.errorCounts.delete(pluginId)
    
    // Remove from load order
    const index = this.loadOrder.indexOf(pluginId)
    if (index !== -1) {
      this.loadOrder.splice(index, 1)
    }
    
    this.emit('plugin-extensions-unloaded', { pluginId })
  }

  /**
   * Hot reload extensions for a specific plugin
   */
  async hotReloadPlugin(pluginId) {
    if (this.isHotReloading) {
      console.log(`[ExtensionManager] Hot reload already in progress, queueing ${pluginId}`)
      this.hotReloadQueue.push(pluginId)
      return
    }
    
    this.isHotReloading = true
    
    try {
      console.log(`[ExtensionManager] Hot reloading plugin: ${pluginId}`)
      
      // Unload current extensions
      await this.unloadPluginExtensions(pluginId)
      
      // Reload extensions
      await this.loadPluginExtensions(pluginId)
      
      console.log(`[ExtensionManager] ✅ Hot reload completed for ${pluginId}`)
      
      this.emit('hot-reload-completed', { pluginId })
      
    } catch (error) {
      console.error(`[ExtensionManager] Hot reload failed for ${pluginId}:`, error)
      this.emit('hot-reload-failed', { pluginId, error })
    } finally {
      this.isHotReloading = false
      
      // Process queued hot reloads
      if (this.hotReloadQueue.length > 0) {
        const nextPlugin = this.hotReloadQueue.shift()
        setTimeout(() => this.hotReloadPlugin(nextPlugin), 100)
      }
    }
  }

  /**
   * Hot reload all extensions
   */
  async hotReloadAll() {
    console.log('[ExtensionManager] Hot reloading all extensions...')
    
    try {
      // Get all loaded plugins
      const loadedPlugins = Array.from(this.loadedExtensions.keys())
      
      // Reload each plugin
      for (const pluginId of loadedPlugins) {
        await this.hotReloadPlugin(pluginId)
      }
      
      console.log('[ExtensionManager] ✅ Hot reload completed for all plugins')
      this.emit('hot-reload-all-completed')
      
    } catch (error) {
      console.error('[ExtensionManager] Hot reload all failed:', error)
      this.emit('hot-reload-all-failed', { error })
    }
  }

  /**
   * Get plugin instance
   */
  async getPluginInstance(pluginId) {
    try {
      // Try to get from plugin API if available
      if (pluginAPI.getPlugin) {
        return await pluginAPI.getPlugin(pluginId)
      }
      
      // Fallback: try to import directly
      const pluginPath = `/plugins/${pluginId}/index.js`
      const module = await import(pluginPath)
      return module.default || module
      
    } catch (error) {
      console.warn(`[ExtensionManager] Could not get plugin instance for ${pluginId}:`, error)
      return null
    }
  }

  /**
   * Get enabled plugins
   */
  async getEnabledPlugins() {
    try {
      if (pluginAPI.getEnabledPlugins) {
        return await pluginAPI.getEnabledPlugins()
      }
      
      // Fallback to empty array if plugin API not available
      return []
      
    } catch (error) {
      console.warn('[ExtensionManager] Could not get enabled plugins:', error)
      return []
    }
  }

  // === EVENT HANDLERS ===

  /**
   * Handle plugin enabled event
   */
  async handlePluginEnabled({ pluginId }) {
    console.log(`[ExtensionManager] Plugin enabled: ${pluginId}`)
    
    try {
      await this.loadPluginExtensions(pluginId)
    } catch (error) {
      // Error is already handled in loadPluginExtensions
      console.error(`[ExtensionManager] Failed to load extensions for enabled plugin ${pluginId}:`, error)
    }
  }
  
  /**
   * Handle disable plugin request from error handler
   */
  async handleDisablePluginRequest({ pluginId, reason }) {
    console.warn(`[ExtensionManager] Disabling plugin ${pluginId} due to: ${reason}`)
    
    try {
      // Unload extensions
      await this.unloadPluginExtensions(pluginId)
      
      // Notify plugin API to disable the plugin
      if (pluginAPI.disablePlugin) {
        await pluginAPI.disablePlugin(pluginId)
      }
      
      this.emit('plugin-auto-disabled', { pluginId, reason })
      
    } catch (error) {
      console.error(`[ExtensionManager] Failed to disable plugin ${pluginId}:`, error)
    }
  }
  
  /**
   * Handle quarantine plugin request from error handler
   */
  async handleQuarantinePluginRequest({ pluginId, reason }) {
    console.error(`[ExtensionManager] Quarantining plugin ${pluginId} due to: ${reason}`)
    
    try {
      // Unload extensions immediately
      await this.unloadPluginExtensions(pluginId)
      
      // Notify plugin API to quarantine the plugin
      if (pluginAPI.uninstallPlugin) {
        await pluginAPI.uninstallPlugin(pluginId)
      }
      
      this.emit('plugin-quarantined', { pluginId, reason })
      
    } catch (error) {
      console.error(`[ExtensionManager] Failed to quarantine plugin ${pluginId}:`, error)
    }
  }
  
  /**
   * Handle reload plugin request from error handler
   */
  async handleReloadPluginRequest({ pluginId, useFallback }) {
    console.log(`[ExtensionManager] Reloading plugin ${pluginId} (fallback: ${useFallback})`)
    
    try {
      // Hot reload the specific plugin
      await this.hotReloadPlugin(pluginId)
      
      this.emit('plugin-reloaded', { pluginId, useFallback })
      
    } catch (error) {
      console.error(`[ExtensionManager] Failed to reload plugin ${pluginId}:`, error)
    }
  }
  
  /**
   * Handle clear plugin caches request from error handler
   */
  async handleClearPluginCachesRequest({ pluginId }) {
    console.log(`[ExtensionManager] Clearing caches for plugin ${pluginId}`)
    
    try {
      // Get plugin instance and clear its caches if possible
      const pluginInstance = await this.getPluginInstance(pluginId)
      
      if (pluginInstance && typeof pluginInstance.clearCaches === 'function') {
        await pluginInstance.clearCaches()
      }
      
      // Clear our own caches
      this.loadTimes.delete(pluginId)
      
      this.emit('plugin-caches-cleared', { pluginId })
      
    } catch (error) {
      console.error(`[ExtensionManager] Failed to clear caches for plugin ${pluginId}:`, error)
    }
  }
  
  /**
   * Handle optimize plugin request from error handler
   */
  async handleOptimizePluginRequest({ pluginId }) {
    console.log(`[ExtensionManager] Optimizing plugin ${pluginId}`)
    
    try {
      // Get plugin instance and optimize if possible
      const pluginInstance = await this.getPluginInstance(pluginId)
      
      if (pluginInstance && typeof pluginInstance.optimize === 'function') {
        await pluginInstance.optimize()
      }
      
      this.emit('plugin-optimized', { pluginId })
      
    } catch (error) {
      console.error(`[ExtensionManager] Failed to optimize plugin ${pluginId}:`, error)
    }
  }

  /**
   * Handle plugin disabled event
   */
  async handlePluginDisabled({ pluginId }) {
    console.log(`[ExtensionManager] Plugin disabled: ${pluginId}`)
    
    try {
      await this.unloadPluginExtensions(pluginId)
    } catch (error) {
      console.error(`[ExtensionManager] Failed to unload extensions for disabled plugin ${pluginId}:`, error)
    }
  }

  /**
   * Handle extension registered event
   */
  handleExtensionRegistered({ pluginId, extensionId }) {
    console.log(`[ExtensionManager] Extension registered: ${extensionId} (plugin: ${pluginId})`)
    
    // Track in load order
    if (!this.loadOrder.includes(pluginId)) {
      this.loadOrder.push(pluginId)
    }
  }

  /**
   * Handle extension error event
   */
  handleExtensionError({ pluginId, error }) {
    console.error(`[ExtensionManager] Extension error for plugin ${pluginId}:`, error)
    
    // Track error count
    const currentErrors = this.errorCounts.get(pluginId) || 0
    this.errorCounts.set(pluginId, currentErrors + 1)
    
    // Emit aggregated error event
    this.emit('extension-error', { pluginId, error })
  }

  /**
   * Handle hot reload error event
   */
  handleHotReloadError({ error }) {
    console.error('[ExtensionManager] Hot reload error:', error)
    this.emit('hot-reload-error', { error })
  }

  // === UTILITY METHODS ===

  /**
   * Get statistics about loaded extensions
   */
  getStats() {
    const stats = {
      totalPlugins: this.loadedExtensions.size,
      totalExtensions: 0,
      averageLoadTime: 0,
      totalErrors: 0,
      pluginStats: {},
      healthReport: {}
    }
    
    let totalLoadTime = 0
    let pluginCount = 0
    
    for (const [pluginId, extensionIds] of this.loadedExtensions) {
      const loadTime = this.loadTimes.get(pluginId) || 0
      const errorCount = this.errorCounts.get(pluginId) || 0
      const healthReport = errorHandler.getHealthReport(pluginId)
      
      stats.totalExtensions += extensionIds.size
      stats.totalErrors += errorCount
      totalLoadTime += loadTime
      pluginCount++
      
      stats.pluginStats[pluginId] = {
        extensionCount: extensionIds.size,
        loadTime,
        errorCount,
        extensions: Array.from(extensionIds),
        health: healthReport.overall
      }
      
      stats.healthReport[pluginId] = healthReport
    }
    
    if (pluginCount > 0) {
      stats.averageLoadTime = totalLoadTime / pluginCount
    }
    
    // Add system-wide health stats
    stats.systemHealth = errorHandler.getSystemStats()
    
    return stats
  }

  /**
   * Check if a plugin has loaded extensions
   */
  hasLoadedExtensions(pluginId) {
    return this.loadedExtensions.has(pluginId) && 
           this.loadedExtensions.get(pluginId).size > 0
  }

  /**
   * Get loaded extensions for a plugin
   */
  getPluginExtensions(pluginId) {
    return this.loadedExtensions.get(pluginId) || new Set()
  }

  /**
   * Clear all extension data
   */
  clearAll() {
    this.loadedExtensions.clear()
    this.extensionDependencies.clear()
    this.loadOrder = []
    this.loadTimes.clear()
    this.errorCounts.clear()
    this.hotReloadQueue = []
    this.isHotReloading = false
    
    this.emit('cleared')
  }

  /**
   * Validate extension health
   */
  validateExtensions() {
    const issues = []
    
    for (const [pluginId, extensionIds] of this.loadedExtensions) {
      const errorCount = this.errorCounts.get(pluginId) || 0
      
      if (errorCount > 0) {
        issues.push({
          type: 'errors',
          pluginId,
          errorCount,
          severity: errorCount > 5 ? 'high' : 'medium'
        })
      }
      
      if (extensionIds.size === 0) {
        issues.push({
          type: 'no-extensions',
          pluginId,
          severity: 'low'
        })
      }
    }
    
    return {
      healthy: issues.length === 0,
      issues
    }
  }
}

// Export singleton instance
export const extensionManager = new ExtensionManager()

export default {
  ExtensionManager,
  extensionManager
}