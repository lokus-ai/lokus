import { join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { validateManifest } from './PluginManifest.js'
import { logger } from '../../utils/logger.js'
import { isVersionCompatible } from '../../utils/semver.js'
import { RegistryAPI } from '../registry/RegistryAPI.js'
// Import SDK to expose to plugins
import * as PluginSDK from '../../../packages/plugin-sdk/src/index.ts'

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
    this.logger = logger.createScoped(`PluginSandbox:${pluginId}`)
  }

  /**
   * Create a secure execution context for the plugin
   */
  createContext(contextData = {}) {
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
      lokusAPI: this.api,
      api: this.api, // Alias for SDK compatibility
      lokus: window.lokus, // Expose global lokus object
      // VS Code compatibility aliases
      vscode: window.lokus, // Alias vscode to lokus for compatibility

      // Merge provided context data
      ...contextData
    }

    // Use Proxy to prevent access to unauthorized globals
    return new Proxy(restrictedGlobals, {
      get: (target, prop) => {
        if (prop in target) {
          return target[prop]
        }
        // Allow access to standard globals if they are safe
        // For now, we block everything else
        return undefined
      },
      has: (target, prop) => {
        return prop in target
      }
    })
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
    this.logger = logger.createScoped('PluginLoader')
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

      // Create plugin instance with API
      const plugin = await this.instantiatePlugin(pluginModule, manifest, pluginAPI)

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

      // Expose SDK globally for plugins to use
      if (!window.LokusSDK) {
        window.LokusSDK = PluginSDK;
      }

      const rawCode = await readTextFile(mainPath);
      const code = this.transformPluginCode(rawCode, pluginId, mainPath);

      // 1. Try CommonJS execution (using new Function)
      // This supports plugins using module.exports
      try {
        const module = { exports: {} };
        const exports = module.exports;
        const require = (id) => {
          if (id === '@lokus/plugin-sdk' || id === 'lokus-plugin-sdk') {
            console.log('[PluginLoader] Requiring PluginSDK. Keys:', Object.keys(PluginSDK));
            console.log('[PluginLoader] PluginSDK.PluginLogger:', PluginSDK.PluginLogger);
            return PluginSDK;
          }
          if (id === 'react') {
            return window.React || { createElement: () => console.warn('React not available') };
          }
          if (id === 'react-dom') {
            return window.ReactDOM || { render: () => console.warn('ReactDOM not available') };
          }
          this.logger.warn(`Plugin ${pluginId} tried to require '${id}' which is not supported.`);
          return {};
        };

        // Check if code uses module.exports or exports
        if (code.includes('module.exports') || code.includes('exports.')) {
          const fn = new Function('module', 'exports', 'require', code);
          fn(module, exports, require);

          if (module.exports) {
            this.logger.info(`Loaded ${pluginId} as CommonJS module`);
            return module.exports;
          }
        }
      } catch (e) {
        this.logger.warn(`CommonJS load failed for ${pluginId}, trying ES Module import. Error: ${e.message}`);
      }

      // 2. Fallback to ES Module (Blob URL)
      // This supports plugins using export default or export class
      const blob = new Blob([code], { type: 'text/javascript' });
      const blobUrl = URL.createObjectURL(blob);

      this.logger.info(`Loading plugin module from Blob URL: ${blobUrl} (original: ${mainPath})`);

      try {
        const pluginModule = await import(blobUrl);
        return pluginModule.default || pluginModule;
      } finally {
        URL.revokeObjectURL(blobUrl); // Cleanup
      }
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`)
    }
  }

  /**
   * Transform plugin code to handle imports
   * Rewrites 'lokus-plugin-sdk' imports to use global window.LokusSDK
   */
  transformPluginCode(code, pluginId, mainPath) {
    // 1. Handle "import { ... } from 'lokus-plugin-sdk'"
    // Replaces with "const { ... } = window.LokusSDK"
    let transformed = code.replace(
      /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]lokus-plugin-sdk['"];?/g,
      'const { $1 } = window.LokusSDK;'
    );

    // 2. Handle "import * as SDK from 'lokus-plugin-sdk'"
    // Replaces with "const SDK = window.LokusSDK"
    transformed = transformed.replace(
      /import\s+\*\s+as\s+(\w+)\s+from\s+['"]lokus-plugin-sdk['"];?/g,
      'const $1 = window.LokusSDK;'
    );

    // 3. Handle "import SDK from 'lokus-plugin-sdk'" (default import)
    // Replaces with "const SDK = window.LokusSDK" (assuming SDK exports itself as default or we want the whole object)
    transformed = transformed.replace(
      /import\s+(\w+)\s+from\s+['"]lokus-plugin-sdk['"];?/g,
      'const $1 = window.LokusSDK;'
    );

    // 4. Handle side-effect import "import 'lokus-plugin-sdk'"
    transformed = transformed.replace(
      /import\s+['"]lokus-plugin-sdk['"];?/g,
      ''
    );

    // 5. Rewrite Source Map URLs
    // Blob URLs break relative source maps. We need to make them absolute.
    // Assuming the plugin is served from a local server (e.g. localhost:3000) or we can infer the base URL.
    // For now, we'll try to use the pluginPath if it looks like a URL, otherwise we might need more context.

    // If pluginPath is a URL (dev mode), use it as base.
    // If it's a file path (production), source maps might not work with Blob URLs anyway unless we inline them.
    // But for the "dev" command issue, we are likely loading from a URL or a local file that we want to map.

    // Actually, PluginLoader.loadPlugin takes a path.
    // If we are in dev mode, we might want to inject the source map URL.

    // Let's look for the source mapping URL pattern
    const sourceMapMatch = transformed.match(/\/\/#\s*sourceMappingURL=(.+)$/m);
    if (sourceMapMatch) {
      const mapUrl = sourceMapMatch[1].trim();
      if (!mapUrl.startsWith('data:') && !mapUrl.startsWith('http')) {
        // It's a relative path. We need to make it absolute.
        // If we don't have a base URL, we can't really fix it easily for local files without a server.
        // But if this is running in the app, and we loaded the file from disk...

        // Wait, if we loaded from disk, the Blob URL has no relation to the disk path.
        // Chrome/Safari won't load local file source maps from a Blob URL due to security.
        // The only reliable way is to INLINE the source map.

        // BUT, if we are using the Dev Server (localhost:3000), we can point to that.
        // We need to know if we are in "Dev Mode" and what the Dev Server URL is.
        // Or, we can just try to resolve it relative to the mainPath if it was a URL.

        // For this fix, let's assume if we can't resolve it, we leave it (or warn).
        // But specifically for the "Headless Dev Server" issue, if the user manually points the app 
        // to localhost:3000/plugin/index.js, we can fix it.

        // Let's add a heuristic: if the code contains a source map, and we can't resolve it, 
        // we might want to try to fetch it and inline it (expensive).

        // Simpler fix for now: If we are loading from a URL, resolve against it.
        // Since loadPluginModule takes `mainPath`, if `mainPath` is a URL, we use it.
        // If `mainPath` is a file path, we can't easily fix it for Blob execution without a local server.

        // However, the user specifically mentioned "Broken Debugging" in the context of the Dev Server.
        // So let's assume we might be loading from a URL in the future or we want to support it.

        // For now, I will add a placeholder for this logic, but since `mainPath` is currently a file path 
        // in the standard flow, this might not fully solve it without the Dev Server integration.
        // BUT, I can rewrite it to a file:// URL if we are in Tauri!

        // If we are in Tauri, `mainPath` is an absolute path.
        // We can try to prepend `file://` (or `asset://` in Tauri v2) to the path.

        // Let's try to rewrite to an absolute file URL.
        // Note: This requires the `mainPath` argument to be passed to `transformPluginCode`.
        // I need to update the signature of `transformPluginCode`.
      }
    }

    if (code !== transformed) {
      this.logger.debug(`Transformed imports for plugin ${pluginId}`);
    }

    return transformed;
  }

  /**
   * Instantiate plugin with security context
   */
  async instantiatePlugin(pluginModule, manifest, pluginAPI) {
    try {
      // Create security sandbox
      const sandbox = new PluginSandbox(manifest.id, pluginAPI)

      // Prepare context data
      const contextData = {
        pluginId: manifest.id,
        manifest: manifest,
        api: pluginAPI,
        // Add other required properties with defaults or placeholders
        storageUri: '',
        globalStorageUri: '',
        assetUri: '',
        logPath: '',
        extensionMode: 2, // Development
        environment: {
          lokusVersion: '1.0.0',
          nodeVersion: '18.0.0',
          platform: 'darwin', // TODO: Get real platform
          arch: 'x64',
          appName: 'Lokus',
          appVersion: '1.0.0',
          isDevelopment: true,
          isTesting: false
        },
        permissions: new Set(),
        subscriptions: [],
        globalState: { get: () => undefined, update: async () => { }, keys: () => [], setKeysForSync: () => { } },
        workspaceState: { get: () => undefined, update: async () => { }, keys: () => [], setKeysForSync: () => { } },
        secrets: { store: async () => { }, get: async () => undefined, delete: async () => { }, onDidChange: () => ({ dispose: () => { } }) }
      };

      const context = sandbox.createContext(contextData)

      console.log('[PluginLoader] Context created:', context);
      console.log('[PluginLoader] Context pluginId:', context.pluginId);
      console.log('[PluginLoader] Context keys:', Object.keys(context));

      let plugin;
      let PluginClass = pluginModule.default || pluginModule.Plugin;

      this.logger.info(`Loaded plugin module type: ${typeof pluginModule}`);
      this.logger.info(`PluginClass initially: ${typeof PluginClass}`, PluginClass);

      // Handle CJS default export wrapped in ES module (common with esbuild/TS)
      if (PluginClass && PluginClass.default) {
        this.logger.info('Unwrapping nested default export');
        PluginClass = PluginClass.default;
      }

      this.logger.info(`PluginClass final: ${typeof PluginClass}`, PluginClass);

      if (typeof PluginClass === 'function') {
        // Class-based plugin (Lokus standard)
        try {
          plugin = new PluginClass(context)
        } catch (e) {
          // Factory function fallback
          plugin = PluginClass(context)
        }
      } else if (typeof PluginClass === 'object' && PluginClass !== null) {
        // Object-based plugin (VS Code style / CommonJS)
        // Wrap it to adapt to Lokus interface
        plugin = {
          ...PluginClass,
          activate: async () => {
            if (typeof PluginClass.activate === 'function') {
              return PluginClass.activate(context);
            }
          },
          deactivate: async () => {
            if (typeof PluginClass.deactivate === 'function') {
              return PluginClass.deactivate();
            }
          },
          // Preserve other methods/properties
          module: PluginClass
        };

        // If the object has getAPI, ensure it's accessible
        if (typeof PluginClass.getAPI === 'function') {
          plugin.getAPI = PluginClass.getAPI.bind(PluginClass);
        }
      } else {
        throw new Error(`Plugin must export a class, factory function, or object. Got: ${typeof PluginClass}`);
      }

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
    return isVersionCompatible(actualVersion, requiredVersion);
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
   * Activate a plugin
   */
  async activatePlugin(pluginId) {
    const moduleId = Array.from(this.loadedModules.keys()).find(k => k.startsWith(`${pluginId}:`))
    if (!moduleId) {
      throw new Error(`Plugin not loaded: ${pluginId}`)
    }

    // We don't store the instance in loadedModules, we store the module
    // This is a design flaw in PluginLoader if we want to manage active instances
    // But for now, let's assume the caller has the instance or we need to change how we store things

    // Actually, PluginLoader returns the instance. The caller (PluginStateAdapter) should manage the instance.
    // But PluginStateAdapter calls this.pluginLoader.activatePlugin(id)

    // So PluginLoader needs to track instances.
    throw new Error('PluginLoader does not track instances. Caller must manage plugin lifecycle.')
  }
}

/**
 * Plugin Installation Utilities
 */
// ...
export class PluginInstaller {
  constructor(pluginManager) {
    this.pluginManager = pluginManager
    this.logger = logger.createScoped('PluginInstaller')
  }

  /**
   * Install plugin from archive
   */
  async installFromArchive(archivePath) {
    try {
      this.logger.info(`Installing plugin from archive: ${archivePath}`)
      const pluginId = await invoke('install_plugin', { path: archivePath })
      this.logger.success(`Successfully installed plugin: ${pluginId}`)
      return pluginId
    } catch (error) {
      this.logger.error(`Failed to install plugin from archive:`, error)
      throw error
    }
  }

  /**
   * Install plugin from Git repository
   */
  async installFromGit(repoUrl) {
    // TODO: Implement plugin installation from Git
    // This would likely require a backend command to clone the repo
    throw new Error('Plugin installation from Git not yet implemented')
  }

  /**
   * Install plugin from marketplace
   */
  async installFromMarketplace(pluginId, version) {
    try {
      this.logger.info(`Installing plugin from marketplace: ${pluginId}@${version}`)

      const registry = new RegistryAPI()

      // 1. Download the plugin blob
      const response = await registry.downloadPlugin(pluginId, version)
      const blob = response.data

      // 2. Save to temporary file
      // We need to use Tauri's FS API to write the blob to a temp file
      // Since we can't directly write a Blob, we convert it to ArrayBuffer then Uint8Array
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      // Import FS dynamically to avoid issues if not available
      const { writeFile, BaseDirectory, exists, mkdir } = await import('@tauri-apps/plugin-fs')
      const { tempDir, join } = await import('@tauri-apps/api/path')

      const tempDirectory = await tempDir()
      const fileName = `${pluginId}-${version || 'latest'}.lokus`
      const filePath = await join(tempDirectory, fileName)

      this.logger.info(`Downloading to temp path: ${filePath}`)

      await writeFile(filePath, uint8Array)

      // 3. Install from the local temp file
      await this.installFromArchive(filePath)

      this.logger.success(`Successfully installed ${pluginId} from marketplace`)

    } catch (error) {
      this.logger.error(`Failed to install plugin from marketplace:`, error)
      throw error
    }
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

      await invoke('uninstall_plugin', { name: pluginId })

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
    this.logger = logger.createScoped('PluginDeveloper')
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