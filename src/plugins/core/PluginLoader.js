import { join } from '@tauri-apps/api/path'
import { exists, readTextFile } from '@tauri-apps/plugin-fs'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { validateManifest } from './PluginManifest.js'
import { logger } from '../../utils/logger.js'
import { isVersionCompatible } from '../../utils/semver.js'
import { RegistryAPI } from '../registry/RegistryAPI.js'
// Import SDK to expose to plugins
import * as PluginSDK from '../../../packages/plugin-sdk/src/index.ts'
// Security - Plugin Security Manager for monitoring and enforcement
import { PluginSecurityManager } from '../security/PluginSecurityManager.js'

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

// Singleton security manager instance for monitoring all plugins
let securityManagerInstance = null

/**
 * Get or create the shared PluginSecurityManager instance
 */
export function getSecurityManager() {
  if (!securityManagerInstance) {
    securityManagerInstance = new PluginSecurityManager({
      auditingEnabled: true,
      quarantineEnabled: true,
      maxSandboxes: 50
    })
  }
  return securityManagerInstance
}

/**
 * Plugin Loader Class
 * Handles the loading, validation, and instantiation of plugins
 */
export class PluginLoader {
  constructor() {
    this.loadedModules = new Map()
    this.logger = logger.createScoped('PluginLoader')
    this.securityManager = getSecurityManager()

    // Listen for security events
    this.securityManager.on('security-violation', (event) => {
      this.logger.error(`SECURITY VIOLATION [${event.pluginId}]:`, event.violationType, event.details)
    })

    this.securityManager.on('plugin-quarantined', (event) => {
      this.logger.error(`PLUGIN QUARANTINED [${event.pluginId}]:`, event.reason)
    })
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

      // Load plugin styles
      await this.loadPluginStyles(pluginPath, pluginId)

      // Create plugin instance with API
      const assetUri = convertFileSrc(pluginPath);
      const plugin = await this.instantiatePlugin(pluginModule, manifest, pluginAPI, pluginPath, assetUri)

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
            return PluginSDK;
          }
          if (id === 'react') {
            return window.React || { createElement: () => {} };
          }
          if (id === 'react-dom') {
            return window.ReactDOM || { render: () => {} };
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
        const pluginModule = await import(/* @vite-ignore */ blobUrl);
        return pluginModule.default || pluginModule;
      } finally {
        URL.revokeObjectURL(blobUrl); // Cleanup
      }
    } catch (error) {
      throw new Error(`Failed to load plugin module: ${error.message}`)
    }
  }

  /**
   * Load plugin styles
   */
  async loadPluginStyles(pluginPath, pluginId) {
    try {
      // Try to find style.css or index.css
      const styleFiles = ['style.css', 'index.css', 'styles.css'];
      let styleContent = null;

      for (const file of styleFiles) {
        const stylePath = await join(pluginPath, file);
        if (await exists(stylePath)) {
          styleContent = await readTextFile(stylePath);
          break;
        }
      }

      if (styleContent) {
        const styleId = `plugin-style-${pluginId}`;

        // Remove existing style if present (reloading)
        const existingStyle = document.getElementById(styleId);
        if (existingStyle) {
          existingStyle.remove();
        }

        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = styleContent;
        document.head.appendChild(style);

        this.logger.info(`Loaded styles for ${pluginId}`);
      }
    } catch (error) {
      this.logger.warn(`Failed to load styles for ${pluginId}:`, error);
    }
  }

  /**
   * Transform plugin code to handle imports
   * Rewrites 'lokus-plugin-sdk' and '@lokus/plugin-sdk' imports to use global window.LokusSDK
   */
  transformPluginCode(code, pluginId, mainPath) {
    // Support both 'lokus-plugin-sdk' and '@lokus/plugin-sdk' package names
    const sdkPatterns = ['lokus-plugin-sdk', '@lokus/plugin-sdk'];
    let transformed = code;

    for (const sdkName of sdkPatterns) {
      const escapedName = sdkName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // 1. Handle "import { ... } from 'sdk-name'"
      transformed = transformed.replace(
        new RegExp(`import\\s+\\{\\s*([^}]+)\\s*\\}\\s+from\\s+['"]${escapedName}['"];?`, 'g'),
        'const { $1 } = window.LokusSDK;'
      );

      // 2. Handle "import * as SDK from 'sdk-name'"
      transformed = transformed.replace(
        new RegExp(`import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+['"]${escapedName}['"];?`, 'g'),
        'const $1 = window.LokusSDK;'
      );

      // 3. Handle "import SDK from 'sdk-name'" (default import)
      transformed = transformed.replace(
        new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]${escapedName}['"];?`, 'g'),
        'const $1 = window.LokusSDK;'
      );

      // 4. Handle side-effect import "import 'sdk-name'"
      transformed = transformed.replace(
        new RegExp(`import\\s+['"]${escapedName}['"];?`, 'g'),
        ''
      );
    }

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
  async instantiatePlugin(pluginModule, manifest, pluginAPI, pluginPath) {
    const pluginId = manifest.id

    try {
      // SECURITY: Register with security manager BEFORE plugin executes
      // This validates the plugin, checks quarantine status, and sets up monitoring
      let securitySandbox = null
      try {
        securitySandbox = await this.securityManager.createSandbox(pluginId, manifest, {
          workspacePath: pluginPath
        })
        this.logger.info(`Security sandbox created for plugin: ${pluginId}`)
      } catch (securityError) {
        // Security validation failed - do not proceed with loading
        this.logger.error(`Security validation failed for ${pluginId}:`, securityError.message)
        throw new PluginLoadError(
          `Plugin security validation failed: ${securityError.message}`,
          pluginId,
          securityError
        )
      }

      // Create execution sandbox (separate from security monitoring sandbox)
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
        permissions: new Set(manifest.permissions || []),
        subscriptions: [],
        globalState: { get: () => undefined, update: async () => { }, keys: () => [], setKeysForSync: () => { } },
        workspaceState: { get: () => undefined, update: async () => { }, keys: () => [], setKeysForSync: () => { } },
        secrets: { store: async () => { }, get: async () => undefined, delete: async () => { }, onDidChange: () => ({ dispose: () => { } }) }
      };

      // Set Asset URI
      if (pluginPath) {
        // If it's a URL (dev mode), use it directly
        if (pluginPath.startsWith('http')) {
          contextData.assetUri = pluginPath;
        } else {
          // If it's a file path, convert to asset protocol
          contextData.assetUri = convertFileSrc(pluginPath);
        }
      }

      // Fix Asset URI
      if (pluginModule) {
        // We can't easily get the path from the module, but we have the manifest
        // Assuming we are in a Tauri environment where we can access files
        // We need to construct a file URL or use convertFileSrc
        try {
          // This is a bit hacky, we need the plugin path. 
          // But instantiatePlugin doesn't take pluginPath.
          // However, we can guess it from the manifest location if we had it, 
          // or we can pass it in.
          // For now, let's use a placeholder or try to get it from the loader state if possible.
          // Better: Update instantiatePlugin signature to take pluginPath?
          // Or just rely on the fact that we are in a browser context and might not need it 
          // if we use relative paths? No, relative paths fail in Blob.

          // Let's use a safe fallback
          contextData.assetUri = '';
        } catch (e) {
          console.warn('Failed to set assetUri', e);
        }
      }

      const context = sandbox.createContext(contextData)

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
      plugin.securitySandbox = securitySandbox // Store for cleanup

      // Call initialization if available
      if (typeof plugin.initialize === 'function') {
        await plugin.initialize(pluginAPI)
      }

      this.logger.info(`Plugin ${pluginId} instantiated successfully with security monitoring`)
      return plugin
    } catch (error) {
      // Clean up security sandbox if it was created but instantiation failed
      if (this.securityManager && this.securityManager.getSandbox(pluginId)) {
        try {
          const sandbox = this.securityManager.getSandbox(pluginId)
          if (sandbox && typeof sandbox.terminate === 'function') {
            await sandbox.terminate()
          }
          this.securityManager.sandboxes?.delete(pluginId)
          this.securityManager.securityPolicies?.delete(pluginId)
          this.logger.info(`Cleaned up security sandbox for failed plugin: ${pluginId}`)
        } catch (cleanupError) {
          this.logger.warn(`Failed to cleanup security sandbox for ${pluginId}:`, cleanupError)
        }
      }
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
   * Cleanup security resources for a plugin
   * Call this when unloading/uninstalling a plugin
   */
  async cleanupPluginSecurity(pluginId) {
    if (!this.securityManager) {
      return
    }

    try {
      const sandbox = this.securityManager.getSandbox(pluginId)
      if (sandbox) {
        await sandbox.terminate()
        this.securityManager.sandboxes?.delete(pluginId)
        this.securityManager.securityPolicies?.delete(pluginId)
        this.logger.info(`Security cleanup completed for plugin: ${pluginId}`)
      }
    } catch (error) {
      this.logger.warn(`Failed to cleanup security for ${pluginId}:`, error)
    }
  }

  /**
   * Get security statistics for monitoring
   */
  getSecurityStats() {
    if (!this.securityManager) {
      return null
    }
    return this.securityManager.getSecurityStats()
  }

  /**
   * Check if a plugin is quarantined
   */
  isPluginQuarantined(pluginId) {
    if (!this.securityManager) {
      return false
    }
    return this.securityManager.quarantinedPlugins?.has(pluginId) || false
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
      this.logger.info(`Successfully installed plugin: ${pluginId}`)
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

      // 1. Get plugin details (for icon URL and metadata)
      const pluginDetails = await registry.getPlugin(pluginId)
      const pluginData = pluginDetails.data

      // 2. Download the plugin blob
      const response = await registry.downloadPlugin(pluginId, version)
      const blob = response.data

      // 3. Save to temporary file
      const arrayBuffer = await blob.arrayBuffer()
      const uint8Array = new Uint8Array(arrayBuffer)

      const { writeFile } = await import('@tauri-apps/plugin-fs')
      const { tempDir, join, homeDir } = await import('@tauri-apps/api/path')

      const tempDirectory = await tempDir()
      const fileName = `${pluginId}-${version || 'latest'}.lokus`
      const filePath = await join(tempDirectory, fileName)

      this.logger.info(`Downloading to temp path: ${filePath}`)

      await writeFile(filePath, uint8Array)

      // 4. Install from the local temp file
      const installedName = await this.installFromArchive(filePath)

      // 5. Download and save icon if available
      if (pluginData?.icon_url) {
        try {
          const home = await homeDir()
          // Use the installed plugin name (folder name)
          const pluginName = installedName || pluginData.name || pluginId
          const pluginPath = await join(home, '.lokus', 'plugins', pluginName)

          // Determine icon extension from URL
          const iconUrl = pluginData.icon_url
          const ext = iconUrl.includes('.svg') ? 'svg' : 'png'
          const iconPath = await join(pluginPath, `icon.${ext}`)

          this.logger.info(`Downloading icon from: ${iconUrl}`)

          const iconResponse = await fetch(iconUrl)
          if (iconResponse.ok) {
            const iconBlob = await iconResponse.blob()
            const iconBuffer = await iconBlob.arrayBuffer()
            await writeFile(iconPath, new Uint8Array(iconBuffer))
            this.logger.info(`Saved icon to: ${iconPath}`)
          }
        } catch (iconError) {
          // Icon download is optional, don't fail installation
          this.logger.warn(`Failed to download icon: ${iconError.message}`)
        }
      }

      this.logger.info(`Successfully installed ${pluginId} from marketplace`)

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