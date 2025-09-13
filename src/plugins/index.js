/**
 * Lokus Plugin System
 * Main entry point for the plugin architecture
 */

// Core plugin system
export { PluginManager, pluginManager } from './PluginManager.js'
export { PluginAPI, PluginAPIFactory } from './PluginAPI.js'

// Plugin loading and validation
export { PluginLoader, PluginSandbox, PluginInstaller, PluginDeveloper } from './core/PluginLoader.js'
export { 
  ManifestValidator, 
  validateManifest, 
  createManifestTemplate,
  PLUGIN_MANIFEST_SCHEMA,
  VALID_PERMISSIONS,
  VALID_ACTIVATION_EVENTS,
  VALID_CATEGORIES
} from './core/PluginManifest.js'

// Plugin system errors
export {
  PluginLoadError,
  PluginValidationError, 
  PluginDependencyError
} from './core/PluginLoader.js'

// Utility
export { EventEmitter } from '../utils/EventEmitter.js'

/**
 * Initialize the plugin system
 * This function sets up the plugin system and integrates it with Lokus
 */
export async function initializePluginSystem(editorAPI = null) {
  try {
    const { pluginManager } = await import('./PluginManager.js')
    const { PluginAPIFactory } = await import('./PluginAPI.js')
    
    // Create plugin API factory
    const apiFactory = new PluginAPIFactory(editorAPI)
    
    // Set up plugin manager with API factory
    pluginManager.apiFactory = apiFactory
    
    // Initialize the plugin system
    await pluginManager.initialize()
    
    console.info('Plugin system initialized successfully')
    return {
      pluginManager,
      apiFactory
    }
  } catch (error) {
    console.error('Failed to initialize plugin system:', error)
    throw error
  }
}

/**
 * Shutdown the plugin system
 */
export async function shutdownPluginSystem() {
  try {
    const { pluginManager } = await import('./PluginManager.js')
    await pluginManager.shutdown()
    console.info('Plugin system shutdown complete')
  } catch (error) {
    console.error('Error during plugin system shutdown:', error)
    throw error
  }
}

/**
 * Plugin System Status
 */
export async function getPluginSystemStatus() {
  try {
    const { pluginManager } = await import('./PluginManager.js')
    
    return {
      initialized: pluginManager.isInitialized,
      stats: pluginManager.getStats(),
      activePlugins: pluginManager.getActivePlugins().map(p => ({
        id: p.id,
        name: p.info?.manifest?.name || p.id,
        version: p.info?.manifest?.version || 'unknown'
      })),
      loadedPlugins: pluginManager.getAllPlugins().map(p => ({
        id: p.id,
        name: p.manifest?.name || p.id,
        version: p.manifest?.version || 'unknown',
        status: p.status
      }))
    }
  } catch (error) {
    return {
      initialized: false,
      error: error.message,
      stats: null,
      activePlugins: [],
      loadedPlugins: []
    }
  }
}

/**
 * Development utilities
 */
export const PluginDev = {
  /**
   * Create a minimal plugin template
   */
  createTemplate: (options = {}) => {
    const { createManifestTemplate } = require('./core/PluginManifest.js')
    return createManifestTemplate(options)
  },

  /**
   * Validate a plugin manifest
   */
  validateManifest: (manifest) => {
    const { validateManifest } = require('./core/PluginManifest.js')
    return validateManifest(manifest)
  },

  /**
   * Load and validate a plugin (for development)
   */
  validatePlugin: async (pluginPath) => {
    const { PluginDeveloper } = await import('./core/PluginLoader.js')
    const dev = new PluginDeveloper()
    return await dev.validatePlugin(pluginPath)
  }
}

export default {
  initialize: initializePluginSystem,
  shutdown: shutdownPluginSystem,
  getStatus: getPluginSystemStatus,
  dev: PluginDev
}