import { join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/api/fs'
import { validateManifest } from './PluginManifest.js'

/**
 * Plugin Loading Utilities
 * Handles the secure loading and instantiation of plugins
 */

/**
 * Plugin loading errors
 */
export class PluginLoadError extends Error {
  constructor(message, pluginId, cause) {
    super(message)
    this.name = 'PluginLoadError'
    this.pluginId = pluginId
    this.cause = cause
  }
}

export class PluginValidationError extends Error {
  constructor(message, pluginId, validationResult) {
    super(message)
    this.name = 'PluginValidationError'
    this.pluginId = pluginId
    this.validationResult = validationResult
  }
}

export class PluginDependencyError extends Error {
  constructor(message, pluginId, missingDeps) {
    super(message)
    this.name = 'PluginDependencyError'
    this.pluginId = pluginId
    this.missingDeps = missingDeps
  }
}

/**
 * Plugin Security Sandbox
 * Provides a secure environment for plugin execution
 */
export class PluginSandbox {
  constructor(pluginId, api) {
    this.pluginId = pluginId
    this.api = api
    this.globals = new Map()
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Create a secure execution context for the plugin
   */
  createContext() {
    // Create a restricted global context
    const restrictedGlobals = {
      console: this.createRestrictedConsole(),
      setTimeout: this.createRestrictedTimeout(),
      setInterval: this.createRestrictedInterval(),
      clearTimeout: clearTimeout,
      clearInterval: clearInterval,
      Promise: Promise,
      JSON: JSON,
      Date: Date,
      Math: Math,
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      RegExp: RegExp,
      Error: Error,
      TypeError: TypeError,
      ReferenceError: ReferenceError,
      SyntaxError: SyntaxError,
      // Plugin API
      lokusAPI: this.api
    }

    return restrictedGlobals
  }

  /**
   * Create restricted console for plugin
   */
  createRestrictedConsole() {
    return {
      log: (...args) => this.logger.log(`[${this.pluginId}]`, ...args),
      info: (...args) => this.logger.info(`[${this.pluginId}]`, ...args),
      warn: (...args) => this.logger.warn(`[${this.pluginId}]`, ...args),
      error: (...args) => this.logger.error(`[${this.pluginId}]`, ...args),
      debug: (...args) => this.logger.debug(`[${this.pluginId}]`, ...args)
    }
  }

  /**
   * Create restricted setTimeout for plugin
   */
  createRestrictedTimeout() {
    return (callback, delay, ...args) => {
      // Limit maximum delay to prevent abuse
      const maxDelay = 60000 // 1 minute
      const actualDelay = Math.min(delay, maxDelay)
      
      return setTimeout(callback, actualDelay, ...args)
    }
  }

  /**
   * Create restricted setInterval for plugin
   */
  createRestrictedInterval() {
    return (callback, delay, ...args) => {
      // Limit minimum interval to prevent abuse
      const minDelay = 100 // 100ms
      const actualDelay = Math.max(delay, minDelay)
      
      return setInterval(callback, actualDelay, ...args)
    }
  }
}

/**
 * Plugin Loader Class
 * Handles the loading, validation, and instantiation of plugins
 */
export class PluginLoader {
  constructor() {
    this.loadedModules = new Map()
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Load a plugin from a directory
   */
  async loadPlugin(pluginPath, pluginAPI) {
    let manifest = null
    let pluginId = null

    try {
      // Load and validate manifest
      manifest = await this.loadManifest(pluginPath)
      pluginId = manifest.id
      
      const validation = validateManifest(manifest)
      if (!validation.valid) {
        throw new PluginValidationError(
          `Invalid plugin manifest: ${validation.errors.join(', ')}`,
          pluginId,
          validation
        )
      }

      // Log validation warnings
      if (validation.warnings.length > 0) {
        this.logger.warn(`Plugin ${pluginId} validation warnings:`, validation.warnings)
      }

      // Load plugin main file
      const pluginModule = await this.loadPluginModule(pluginPath, manifest.main, pluginId)
      
      // Validate plugin class
      const PluginClass = this.validatePluginClass(pluginModule, pluginId)
      
      // Create plugin instance with API
      const plugin = await this.instantiatePlugin(PluginClass, manifest, pluginAPI)
      
      this.logger.info(`Successfully loaded plugin: ${pluginId}`)
      return plugin

    } catch (error) {
      this.logger.error(`Failed to load plugin ${pluginId || 'unknown'}:`, error)
      
      // Re-throw with proper error type
      if (error instanceof PluginLoadError || 
          error instanceof PluginValidationError || 
          error instanceof PluginDependencyError) {
        throw error
      }
      
      throw new PluginLoadError(
        `Failed to load plugin: ${error.message}`,
        pluginId,
        error
      )
    }
  }

  /**
   * Load plugin manifest
   */
  async loadManifest(pluginPath) {
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
   * Load plugin main module
   */
  async loadPluginModule(pluginPath, mainFile, pluginId) {
    try {
      const mainPath = await join(pluginPath, mainFile)
      
      if (!(await exists(mainPath))) {
        throw new Error(`Main file not found: ${mainFile}`)
      }

      // Check if already loaded (for reloading)
      const moduleId = `${pluginId}:${mainPath}`
      if (this.loadedModules.has(moduleId)) {
        // TODO: Implement proper module reloading
        this.logger.warn(`Module ${moduleId} already loaded, using cached version`)
        return this.loadedModules.get(moduleId)
      }

      // Dynamic import with timestamp to bust cache
      const timestamp = Date.now()
      const modulePath = `${mainPath}?t=${timestamp}`
      
      const pluginModule = await import(modulePath)
      
      // Cache the module
      this.loadedModules.set(moduleId, pluginModule)
      
      return pluginModule
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`)
    }
  }

  /**
   * Validate plugin class structure
   */
  validatePluginClass(pluginModule, pluginId) {
    const PluginClass = pluginModule.default || pluginModule.Plugin
    
    if (!PluginClass) {
      throw new Error('Plugin must export a default class or Plugin class')
    }
    
    if (typeof PluginClass !== 'function') {
      throw new Error('Plugin export must be a class constructor')
    }

    // Check required methods (optional)
    const prototype = PluginClass.prototype
    if (prototype) {
      const recommendedMethods = ['activate', 'deactivate', 'cleanup']
      const missingMethods = recommendedMethods.filter(method => 
        typeof prototype[method] !== 'function'
      )
      
      if (missingMethods.length > 0) {
        this.logger.warn(`Plugin ${pluginId} missing recommended methods: ${missingMethods.join(', ')}`)
      }
    }
    
    return PluginClass
  }

  /**
   * Instantiate plugin with security context
   */
  async instantiatePlugin(PluginClass, manifest, pluginAPI) {
    try {
      // Create security sandbox
      const sandbox = new PluginSandbox(manifest.id, pluginAPI)
      const context = sandbox.createContext()
      
      // Create plugin instance
      const plugin = new PluginClass()
      
      // Set plugin metadata
      plugin.id = manifest.id
      plugin.manifest = manifest
      plugin.api = pluginAPI
      plugin.context = context
      
      // Call initialization if available
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize(pluginAPI)
      }
      
      return plugin
    } catch (error) {
      throw new Error(`Failed to instantiate plugin: ${error.message}`)
    }
  }

  /**
   * Validate plugin dependencies
   */
  validateDependencies(manifest, availablePlugins) {
    if (!manifest.dependencies) {
      return []
    }

    const missingDeps = []
    
    for (const [depId, depVersion] of Object.entries(manifest.dependencies)) {
      const dep = availablePlugins.get(depId)
      
      if (!dep) {
        missingDeps.push({ id: depId, version: depVersion, reason: 'not_found' })
        continue
      }
      
      // TODO: Implement proper semantic version checking
      if (dep.manifest.version !== depVersion && !this.isVersionCompatible(dep.manifest.version, depVersion)) {
        missingDeps.push({ 
          id: depId, 
          version: depVersion, 
          actualVersion: dep.manifest.version,
          reason: 'version_mismatch' 
        })
      }
    }
    
    return missingDeps
  }

  /**
   * Check if versions are compatible
   */
  isVersionCompatible(actualVersion, requiredVersion) {
    // TODO: Implement proper semver compatibility checking
    // For now, just do exact match for simplicity
    return actualVersion === requiredVersion
  }

  /**
   * Reload plugin module (clear cache)
   */
  clearModuleCache(pluginId) {
    const keysToDelete = []
    for (const key of this.loadedModules.keys()) {
      if (key.startsWith(`${pluginId}:`)) {
        keysToDelete.push(key)
      }
    }
    
    keysToDelete.forEach(key => this.loadedModules.delete(key))
  }

  /**
   * Get loading statistics
   */
  getStats() {
    return {
      cachedModules: this.loadedModules.size,
      loadedModules: Array.from(this.loadedModules.keys())
    }
  }
}

/**
 * Plugin Installation Utilities
 */
export class PluginInstaller {
  constructor(pluginManager) {
    this.pluginManager = pluginManager
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Install plugin from archive
   */
  async installFromArchive(archivePath, targetDir) {
    // TODO: Implement plugin installation from zip/tar archives
    throw new Error('Plugin installation from archive not yet implemented')
  }

  /**
   * Install plugin from Git repository
   */
  async installFromGit(repoUrl, targetDir) {
    // TODO: Implement plugin installation from Git
    throw new Error('Plugin installation from Git not yet implemented')
  }

  /**
   * Install plugin from marketplace
   */
  async installFromMarketplace(pluginId, version) {
    // TODO: Implement plugin installation from marketplace
    throw new Error('Plugin installation from marketplace not yet implemented')
  }

  /**
   * Uninstall plugin
   */
  async uninstall(pluginId) {
    try {
      // Deactivate and unload plugin first
      if (this.pluginManager.isPluginActive(pluginId)) {
        await this.pluginManager.deactivatePlugin(pluginId)
      }
      
      if (this.pluginManager.isPluginLoaded(pluginId)) {
        await this.pluginManager.unloadPlugin(pluginId)
      }
      
      // TODO: Remove plugin files from filesystem
      this.logger.info(`Uninstalled plugin: ${pluginId}`)
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Update plugin to latest version
   */
  async updatePlugin(pluginId) {
    // TODO: Implement plugin updates
    throw new Error('Plugin updates not yet implemented')
  }
}

/**
 * Plugin Development Utilities
 */
export class PluginDeveloper {
  constructor() {
    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Create a new plugin template
   */
  async createPlugin(options) {
    // TODO: Implement plugin template creation
    throw new Error('Plugin template creation not yet implemented')
  }

  /**
   * Validate plugin in development
   */
  async validatePlugin(pluginPath) {
    try {
      const loader = new PluginLoader()
      const manifest = await loader.loadManifest(pluginPath)
      const validation = validateManifest(manifest)
      
      return {
        valid: validation.valid,
        errors: validation.errors,
        warnings: validation.warnings,
        manifest
      }
    } catch (error) {
      return {
        valid: false,
        errors: [error.message],
        warnings: [],
        manifest: null
      }
    }
  }

  /**
   * Package plugin for distribution
   */
  async packagePlugin(pluginPath, outputPath) {
    // TODO: Implement plugin packaging
    throw new Error('Plugin packaging not yet implemented')
  }
}

export default PluginLoader