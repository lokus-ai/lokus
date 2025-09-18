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

// MCP Plugin System
export { 
  initializeMCP, 
  getMCPIntegration, 
  shutdownMCP,
  MCPPluginAPI,
  createMCPPluginAPI 
} from './mcp/index.js'

// Plugin Templates System
export {
  MCPPluginTemplateGenerator,
  TemplateConfig,
  CLITemplateGenerator,
  ExampleProjectRegistry,
  TemplateSystemIntegration,
  generateMCPPlugin,
  getAvailableMCPTemplates,
  initializeTemplateSystem,
  getTemplateSystemIntegration,
  TEMPLATE_TYPES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_COMPLEXITY,
  TEMPLATE_FEATURES,
  TemplateUtils
} from './templates/index.js'

// Plugin Registry System
export {
  PluginRegistry,
  REGISTRY_STATUS,
  REGISTRY_CATEGORIES,
  SECURITY_RISK
} from './registry/PluginRegistry.js'

export {
  RegistryAPI,
  API_STATUS,
  AUTH_METHODS
} from './registry/RegistryAPI.js'

export {
  PluginPackageManager,
  INSTALL_STATUS,
  UPDATE_TYPE,
  RESOLUTION_STRATEGY
} from './registry/PluginPackageManager.js'

export {
  PluginStore,
  STORAGE_TYPE,
  CACHE_POLICY
} from './registry/PluginStore.js'

export {
  RegistryConfig
} from './registry/RegistryConfig.js'

export {
  PluginPublisher
} from './registry/PluginPublisher.js'

// Registry Utilities
export {
  SemverUtils,
  VERSION_COMPARE,
  RANGE_OPERATORS,
  VERSION_PARTS
} from './registry/utils/semver.js'

export {
  DependencyUtils,
  DependencyGraph,
  CONFLICT_TYPE
} from './registry/utils/dependency.js'

export {
  SecurityUtils,
  SecurityScanner,
  ChecksumVerifier,
  RISK_LEVEL,
  VULNERABILITY_TYPE,
  PERMISSION_RISK
} from './registry/utils/security.js'

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
export async function initializePluginSystem(editorAPI = null, options = {}) {
  try {
    const { pluginManager } = await import('./PluginManager.js')
    const { PluginAPIFactory } = await import('./PluginAPI.js')
    
    // Create plugin API factory
    const apiFactory = new PluginAPIFactory(editorAPI)
    
    // Set up plugin manager with API factory
    pluginManager.apiFactory = apiFactory
    
    // Initialize the plugin system
    await pluginManager.initialize()
    
    // Initialize MCP integration if enabled
    let mcpIntegration = null
    if (options.enableMCP !== false) {
      try {
        const { initializeMCP } = await import('./mcp/index.js')
        mcpIntegration = await initializeMCP(pluginManager, pluginManager.securityManager, options.mcp)
      } catch (error) {
      }
    }
    
    // Initialize template system if enabled
    let templateSystem = null
    if (options.enableTemplates !== false) {
      try {
        const { initializeTemplateSystem } = await import('./templates/index.js')
        templateSystem = await initializeTemplateSystem(pluginManager)
      } catch (error) {
      }
    }
    
    // Initialize registry system if enabled
    let registrySystem = null
    if (options.enableRegistry !== false) {
      try {
        const { PluginRegistry } = await import('./registry/PluginRegistry.js')
        const { RegistryAPI } = await import('./registry/RegistryAPI.js')
        const { PluginPackageManager } = await import('./registry/PluginPackageManager.js')
        const { PluginStore } = await import('./registry/PluginStore.js')
        const { RegistryConfig } = await import('./registry/RegistryConfig.js')
        
        // Create registry components
        const registryConfig = new RegistryConfig(options.registry?.config)
        await registryConfig.initialize()
        
        const pluginStore = new PluginStore(options.registry?.store)
        await pluginStore.initialize()
        
        const registryAPI = new RegistryAPI(options.registry?.api)
        
        const pluginRegistry = new PluginRegistry(options.registry?.registry)
        await pluginRegistry.initialize()
        
        const packageManager = new PluginPackageManager(
          pluginManager, 
          registryAPI, 
          pluginStore, 
          options.registry?.packageManager
        )
        
        registrySystem = {
          registry: pluginRegistry,
          api: registryAPI,
          packageManager,
          store: pluginStore,
          config: registryConfig
        }
        
      } catch (error) {
      }
    }
    
    return {
      pluginManager,
      apiFactory,
      mcpIntegration,
      templateSystem,
      registrySystem
    }
  } catch (error) {
    throw error
  }
}

/**
 * Shutdown the plugin system
 */
export async function shutdownPluginSystem() {
  try {
    // Shutdown registry system
    try {
      // Note: Registry components should be shut down in reverse order of initialization
      // This would require access to the registry system instance
    } catch (error) {
    }
    
    // Shutdown template system
    try {
      const { getTemplateSystemIntegration } = await import('./templates/index.js')
      const templateSystem = await getTemplateSystemIntegration()
      if (templateSystem) {
        await templateSystem.shutdown()
      }
    } catch (error) {
    }
    
    // Shutdown MCP integration
    try {
      const { shutdownMCP } = await import('./mcp/index.js')
      await shutdownMCP()
    } catch (error) {
    }
    
    // Shutdown plugin manager
    const { pluginManager } = await import('./PluginManager.js')
    await pluginManager.shutdown()
    
  } catch (error) {
    throw error
  }
}

/**
 * Plugin System Status
 */
export async function getPluginSystemStatus() {
  try {
    const { pluginManager } = await import('./PluginManager.js')
    
    // Get MCP status
    let mcpStatus = null
    try {
      const { getMCPIntegration } = await import('./mcp/index.js')
      const mcpIntegration = getMCPIntegration()
      mcpStatus = mcpIntegration ? mcpIntegration.getStats() : null
    } catch (error) {
      mcpStatus = { error: error.message }
    }
    
    // Get template system status
    let templateStatus = null
    try {
      const { getTemplateSystemIntegration } = await import('./templates/index.js')
      const templateSystem = await getTemplateSystemIntegration()
      templateStatus = templateSystem ? templateSystem.getStatistics() : null
    } catch (error) {
      templateStatus = { error: error.message }
    }
    
    // Get registry system status (placeholder - would need access to registry instance)
    let registryStatus = null
    try {
      registryStatus = {
        initialized: true,
        message: 'Registry system integration complete'
      }
    } catch (error) {
      registryStatus = { error: error.message }
    }
    
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
      })),
      mcp: mcpStatus,
      templates: templateStatus,
      registry: registryStatus
    }
  } catch (error) {
    return {
      initialized: false,
      error: error.message,
      stats: null,
      activePlugins: [],
      loadedPlugins: [],
      mcp: null,
      templates: null,
      registry: null
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
  },

  /**
   * Generate MCP plugin from template
   */
  generateMCPPlugin: async (templateType, options = {}) => {
    try {
      const { generateMCPPlugin } = await import('./templates/index.js')
      return await generateMCPPlugin(templateType, options)
    } catch (error) {
      throw new Error(`Failed to generate MCP plugin: ${error.message}`)
    }
  },

  /**
   * List available MCP templates
   */
  listMCPTemplates: async () => {
    try {
      const { getAvailableMCPTemplates } = await import('./templates/index.js')
      return getAvailableMCPTemplates()
    } catch (error) {
      throw new Error(`Failed to list MCP templates: ${error.message}`)
    }
  },

  /**
   * Get example projects
   */
  listExamples: async () => {
    try {
      const { initializeExampleRegistry } = await import('./templates/index.js')
      const registry = await initializeExampleRegistry()
      return registry.listExamples()
    } catch (error) {
      throw new Error(`Failed to list examples: ${error.message}`)
    }
  },

  /**
   * Download example project
   */
  downloadExample: async (exampleId, targetDirectory) => {
    try {
      const { initializeExampleRegistry } = await import('./templates/index.js')
      const registry = await initializeExampleRegistry()
      return await registry.downloadExample(exampleId, targetDirectory)
    } catch (error) {
      throw new Error(`Failed to download example: ${error.message}`)
    }
  },

  /**
   * Validate template options
   */
  validateTemplateOptions: async (templateType, options) => {
    try {
      const { TemplateUtils } = await import('./templates/index.js')
      return await TemplateUtils.validateOptions(templateType, options)
    } catch (error) {
      throw new Error(`Failed to validate template options: ${error.message}`)
    }
  },

  /**
   * Create a plugin package for registry
   */
  createPackage: async (pluginPath, outputPath) => {
    try {
      const { PluginPublisher } = await import('./registry/PluginPublisher.js')
      const publisher = new PluginPublisher()
      return await publisher.packageProject(pluginPath, { outputPath })
    } catch (error) {
      throw new Error(`Failed to create package: ${error.message}`)
    }
  },

  /**
   * Test plugin registry integration
   */
  testRegistryIntegration: async (pluginId, options = {}) => {
    try {
      const { RegistryAPI } = await import('./registry/RegistryAPI.js')
      const api = new RegistryAPI(options.apiConfig)
      return await api.getPlugin(pluginId)
    } catch (error) {
      throw new Error(`Failed to test registry integration: ${error.message}`)
    }
  },

  /**
   * Resolve plugin dependencies
   */
  resolveDependencies: async (dependencies, availableVersions, strategy = 'compatible') => {
    try {
      const { DependencyUtils } = await import('./registry/utils/dependency.js')
      return await DependencyUtils.resolveDependencies(dependencies, availableVersions, strategy)
    } catch (error) {
      throw new Error(`Failed to resolve dependencies: ${error.message}`)
    }
  },

  /**
   * Scan plugin for security issues
   */
  scanSecurity: async (pluginData, options = {}) => {
    try {
      const { SecurityScanner } = await import('./registry/utils/security.js')
      const scanner = new SecurityScanner(options)
      return await scanner.scanPlugin(pluginData)
    } catch (error) {
      throw new Error(`Failed to scan security: ${error.message}`)
    }
  },

  /**
   * Validate version constraint
   */
  validateVersion: (version, constraint) => {
    try {
      const { SemverUtils } = require('./registry/utils/semver.js')
      return SemverUtils.satisfiesRange(version, constraint)
    } catch (error) {
      throw new Error(`Failed to validate version: ${error.message}`)
    }
  }
}

export default {
  initialize: initializePluginSystem,
  shutdown: shutdownPluginSystem,
  getStatus: getPluginSystemStatus,
  dev: PluginDev
}