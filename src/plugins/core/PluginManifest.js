/**
 * Plugin Manifest Schema and Validation
 * Defines the structure and validation rules for plugin.json files
 * Enhanced to support both v1 and v2 manifest formats
 */

import { validateManifest, canUpgradeManifest } from '../manifest/ManifestValidator.js'
import { migrateManifest } from '../manifest/ManifestMigrator.js'
import { PluginManifestV2 } from '../manifest/ManifestV2.js'

/**
 * Plugin Manifest Schema Definition
 */
export const PLUGIN_MANIFEST_SCHEMA = {
  // Required fields
  required: [
    'id',           // Unique plugin identifier (string)
    'name',         // Human-readable plugin name (string)
    'version',      // Semantic version (string)
    'main',         // Main entry file (string)
    'lokusVersion'  // Compatible Lokus version range (string)
  ],

  // Optional fields
  optional: [
    'description',    // Plugin description (string)
    'author',         // Author information (string or object)
    'license',        // License identifier (string)
    'homepage',       // Plugin homepage URL (string)
    'repository',     // Repository information (string or object)
    'keywords',       // Search keywords (array of strings)
    'dependencies',   // Plugin dependencies (object)
    'permissions',    // Required permissions (array of strings)
    'contributes',    // What the plugin contributes (object)
    'activationEvents', // When to activate plugin (array of strings)
    'engines',        // Engine compatibility (object)
    'icon',          // Plugin icon path (string)
    'galleryBanner', // Marketplace banner config (object)
    'categories',    // Plugin categories (array of strings)
    'preview',       // Preview flag (boolean)
    'qna',           // Q&A support (string or boolean)
    // MCP-specific fields
    'mcp',           // MCP configuration (object)
    'type'           // Plugin type including MCP types (string)
  ],

  // Field type definitions
  types: {
    id: 'string',
    name: 'string',
    version: 'string',
    main: 'string',
    lokusVersion: 'string',
    description: 'string',
    author: ['string', 'object'],
    license: 'string',
    homepage: 'string',
    repository: ['string', 'object'],
    keywords: 'array',
    dependencies: 'object',
    permissions: 'array',
    contributes: 'object',
    activationEvents: 'array',
    engines: 'object',
    icon: 'string',
    galleryBanner: 'object',
    categories: 'array',
    preview: 'boolean',
    qna: ['string', 'boolean'],
    // MCP-specific types
    mcp: 'object',
    type: 'string'
  }
}

/**
 * Valid permission types
 */
export const VALID_PERMISSIONS = [
  'read_files',        // Read files from filesystem
  'write_files',       // Write files to filesystem
  'execute_commands',  // Execute system commands
  'access_network',    // Make network requests
  'modify_ui',         // Modify application UI
  'access_settings',   // Access application settings
  'access_vault',      // Access vault/workspace
  // MCP-specific permissions
  'mcp:serve',         // Host MCP servers
  'mcp:connect',       // Connect to MCP servers
  'mcp:resources',     // Access MCP resources
  'mcp:tools',         // Execute MCP tools
  'mcp:prompts',       // Access MCP prompts
  'storage',           // Access storage
  'notifications',     // Show notifications
  'statusBar',         // Access status bar
  'all'               // All permissions (dangerous)
]

/**
 * Valid activation events
 */
export const VALID_ACTIVATION_EVENTS = [
  'onStartup',           // Activate on app startup
  'onCommand:*',         // Activate on specific command
  'onLanguage:*',        // Activate for specific language
  'onFileType:*',        // Activate for specific file type
  'onView:*',           // Activate when view is opened
  'onUri:*',            // Activate on URI scheme
  'onWebviewPanel:*',   // Activate on webview panel
  'workspaceContains:*', // Activate when workspace contains pattern
  // MCP-specific activation events
  'onMCPServer:*',      // Activate when MCP server is needed
  'onMCPResource:*',    // Activate when MCP resource is accessed
  'onMCPTool:*'         // Activate when MCP tool is called
]

/**
 * Valid plugin categories
 */
export const VALID_CATEGORIES = [
  'Editor',
  'Formatter',
  'Linter',
  'Debugger',
  'Language',
  'Theme',
  'Snippet',
  'Keybinding',
  'Extension Pack',
  // MCP-specific categories
  'MCP Server',
  'MCP Client',
  'AI Assistant',
  'Data Provider',
  'Tool Provider',
  'Productivity',
  'Other'
]

/**
 * Valid MCP plugin types
 */
export const VALID_MCP_PLUGIN_TYPES = [
  'mcp-server',
  'mcp-client',
  'mcp-hybrid'
]

/**
 * Valid MCP resource types
 */
export const VALID_MCP_RESOURCE_TYPES = [
  'file',
  'directory',
  'database',
  'api',
  'memory',
  'web',
  'custom'
]

/**
 * Manifest Validator Class (Legacy v1 support)
 * Note: For comprehensive validation, use EnhancedManifestValidator which supports both v1 and v2
 */
export class ManifestValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  /**
   * Validate a complete plugin manifest (v1 legacy method)
   * For v2 support, use the enhanced validator
   */
  validate(manifest) {
    this.reset()

    if (!manifest || typeof manifest !== 'object') {
      this.addError('Manifest must be a valid JSON object')
      return this.getResult()
    }

    // Check if this might be a v2 manifest and suggest upgrade
    if (this.isLikelyV2Manifest(manifest)) {
      this.addWarning('This appears to be a v2 manifest. Consider using the enhanced validator for full v2 support.')
    }

    // Validate required fields
    this.validateRequiredFields(manifest)

    // Validate field types
    this.validateFieldTypes(manifest)

    // Validate specific field formats
    this.validateFieldFormats(manifest)

    // Validate dependencies
    this.validateDependencies(manifest)

    // Validate permissions
    this.validatePermissions(manifest)

    // Validate activation events
    this.validateActivationEvents(manifest)

    // Validate contributes section
    this.validateContributes(manifest)

    // Validate categories
    this.validateCategories(manifest)

    // Validate MCP-specific fields
    this.validateMCPFields(manifest)

    return this.getResult()
  }

  /**
   * Check if manifest appears to be v2 format
   */
  isLikelyV2Manifest(manifest) {
    return !!(manifest.manifest === '2.0' || manifest.engines || manifest.publisher)
  }

  /**
   * Enhanced validation using new validator (recommended)
   */
  validateEnhanced(manifest) {
    return validateManifest(manifest)
  }

  /**
   * Check if manifest can be upgraded to v2
   */
  canUpgrade(manifest) {
    return canUpgradeManifest(manifest)
  }

  /**
   * Migrate manifest to v2
   */
  migrateToV2(manifest) {
    return migrateManifest(manifest)
  }

  /**
   * Reset validator state
   */
  reset() {
    this.errors = []
    this.warnings = []
  }

  /**
   * Validate required fields are present
   */
  validateRequiredFields(manifest) {
    for (const field of PLUGIN_MANIFEST_SCHEMA.required) {
      if (!(field in manifest) || manifest[field] === null || manifest[field] === undefined) {
        this.addError(`Missing required field: ${field}`)
      }
    }
  }

  /**
   * Validate field types match schema
   */
  validateFieldTypes(manifest) {
    const types = PLUGIN_MANIFEST_SCHEMA.types

    for (const [field, value] of Object.entries(manifest)) {
      if (field in types) {
        const expectedTypes = Array.isArray(types[field]) ? types[field] : [types[field]]
        const actualType = this.getValueType(value)

        if (!expectedTypes.includes(actualType)) {
          this.addError(`Field '${field}' has invalid type. Expected: ${expectedTypes.join(' or ')}, got: ${actualType}`)
        }
      }
    }
  }

  /**
   * Validate specific field formats
   */
  validateFieldFormats(manifest) {
    // Validate plugin ID format
    if (manifest.id) {
      if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(manifest.id)) {
        this.addError('Plugin ID must be lowercase, start with a letter, and contain only letters, numbers, and hyphens')
      }
    }

    // Validate version format (semantic versioning)
    if (manifest.version) {
      if (!/^\d+\.\d+\.\d+(-[\w\.-]+)?(\+[\w\.-]+)?$/.test(manifest.version)) {
        this.addError('Version must follow semantic versioning format (e.g., 1.0.0)')
      }
    }

    // Validate Lokus version format
    if (manifest.lokusVersion) {
      // Allow version ranges like "^1.0.0", ">=1.0.0", "1.0.0", etc.
      if (!/^[\^~>=<]*\d+\.\d+\.\d+/.test(manifest.lokusVersion)) {
        this.addError('lokusVersion must be a valid version range')
      }
    }

    // Validate main file extension
    if (manifest.main) {
      if (!/\.(js|mjs|ts)$/.test(manifest.main)) {
        this.addError('Main file must have .js, .mjs, or .ts extension')
      }
    }

    // Validate URLs
    if (manifest.homepage) {
      if (!this.isValidUrl(manifest.homepage)) {
        this.addError('Homepage must be a valid URL')
      }
    }

    // Validate author format
    if (manifest.author) {
      if (typeof manifest.author === 'object') {
        if (!manifest.author.name) {
          this.addError('Author object must have a name field')
        }
        if (manifest.author.email && !this.isValidEmail(manifest.author.email)) {
          this.addError('Author email must be a valid email address')
        }
        if (manifest.author.url && !this.isValidUrl(manifest.author.url)) {
          this.addError('Author URL must be a valid URL')
        }
      }
    }

    // Validate repository format
    if (manifest.repository) {
      if (typeof manifest.repository === 'object') {
        if (!manifest.repository.type || !manifest.repository.url) {
          this.addError('Repository object must have type and url fields')
        }
      }
    }
  }

  /**
   * Validate dependencies
   */
  validateDependencies(manifest) {
    if (manifest.dependencies) {
      if (typeof manifest.dependencies !== 'object') {
        this.addError('Dependencies must be an object')
        return
      }

      for (const [depId, depVersion] of Object.entries(manifest.dependencies)) {
        if (typeof depId !== 'string' || !depId.trim()) {
          this.addError(`Invalid dependency ID: ${depId}`)
        }

        if (typeof depVersion !== 'string' || !depVersion.trim()) {
          this.addError(`Invalid dependency version for ${depId}: ${depVersion}`)
        }

        // Check for circular dependency (basic check)
        if (depId === manifest.id) {
          this.addError('Plugin cannot depend on itself')
        }
      }
    }
  }

  /**
   * Validate permissions
   */
  validatePermissions(manifest) {
    if (manifest.permissions) {
      if (!Array.isArray(manifest.permissions)) {
        this.addError('Permissions must be an array')
        return
      }

      for (const permission of manifest.permissions) {
        if (typeof permission !== 'string') {
          this.addError('Each permission must be a string')
          continue
        }

        // Check against valid permissions (allow wildcards)
        const isValid = VALID_PERMISSIONS.some(validPerm => {
          if (validPerm.endsWith('*')) {
            return permission.startsWith(validPerm.slice(0, -1))
          }
          return permission === validPerm
        })

        if (!isValid) {
          this.addWarning(`Unknown permission: ${permission}`)
        }

        // Warn about dangerous permissions
        if (permission === 'all' || permission === 'execute_commands') {
          this.addWarning(`Potentially dangerous permission: ${permission}`)
        }
      }
    }
  }

  /**
   * Validate activation events
   */
  validateActivationEvents(manifest) {
    if (manifest.activationEvents) {
      if (!Array.isArray(manifest.activationEvents)) {
        this.addError('ActivationEvents must be an array')
        return
      }

      for (const event of manifest.activationEvents) {
        if (typeof event !== 'string') {
          this.addError('Each activation event must be a string')
          continue
        }

        const isValid = VALID_ACTIVATION_EVENTS.some(validEvent => {
          if (validEvent.endsWith('*')) {
            return event.startsWith(validEvent.slice(0, -1))
          }
          return event === validEvent
        })

        if (!isValid) {
          this.addWarning(`Unknown activation event: ${event}`)
        }
      }
    }
  }

  /**
   * Validate contributes section
   */
  validateContributes(manifest) {
    if (manifest.contributes) {
      if (typeof manifest.contributes !== 'object') {
        this.addError('Contributes must be an object')
        return
      }

      const validContributions = [
        'commands',
        'menus',
        'keybindings',
        'languages',
        'grammars',
        'themes',
        'snippets',
        'configuration',
        'views',
        'viewsContainers',
        'problemMatchers',
        'taskDefinitions',
        'statusBar'
      ]

      for (const [contribution, value] of Object.entries(manifest.contributes)) {
        if (!validContributions.includes(contribution)) {
          this.addWarning(`Unknown contribution: ${contribution}`)
        }

        // Basic validation for common contribution types
        if (contribution === 'commands' && !Array.isArray(value)) {
          this.addError('contributes.commands must be an array')
        }

        if (contribution === 'menus' && typeof value !== 'object') {
          this.addError('contributes.menus must be an object')
        }

        if (contribution === 'keybindings' && !Array.isArray(value)) {
          this.addError('contributes.keybindings must be an array')
        }
      }
    }
  }

  /**
   * Validate categories
   */
  validateCategories(manifest) {
    if (manifest.categories) {
      if (!Array.isArray(manifest.categories)) {
        this.addError('Categories must be an array')
        return
      }

      for (const category of manifest.categories) {
        if (typeof category !== 'string') {
          this.addError('Each category must be a string')
          continue
        }

        if (!VALID_CATEGORIES.includes(category)) {
          this.addWarning(`Unknown category: ${category}. Valid categories: ${VALID_CATEGORIES.join(', ')}`)
        }
      }
    }
  }

  /**
   * Validate MCP-specific fields
   */
  validateMCPFields(manifest) {
    // Validate plugin type
    if (manifest.type) {
      if (typeof manifest.type !== 'string') {
        this.addError('Plugin type must be a string')
        return
      }

      if (VALID_MCP_PLUGIN_TYPES.includes(manifest.type)) {
        // This is an MCP plugin, validate MCP configuration
        this.validateMCPConfiguration(manifest)
      }
    }

    // Validate MCP configuration if present
    if (manifest.mcp) {
      this.validateMCPConfiguration(manifest)
    }
  }

  /**
   * Validate MCP configuration
   */
  validateMCPConfiguration(manifest) {
    const mcpConfig = manifest.mcp

    if (!mcpConfig || typeof mcpConfig !== 'object') {
      if (manifest.type && VALID_MCP_PLUGIN_TYPES.includes(manifest.type)) {
        this.addError('MCP plugins must have an mcp configuration object')
      }
      return
    }

    // Validate MCP type
    if (mcpConfig.type) {
      if (!VALID_MCP_PLUGIN_TYPES.includes(mcpConfig.type)) {
        this.addError(`Invalid MCP plugin type: ${mcpConfig.type}. Valid types: ${VALID_MCP_PLUGIN_TYPES.join(', ')}`)
      }
    }

    // Validate capabilities
    if (mcpConfig.capabilities) {
      this.validateMCPCapabilities(mcpConfig.capabilities)
    }

    // Validate resource limits
    if (mcpConfig.memoryLimit && typeof mcpConfig.memoryLimit !== 'number') {
      this.addError('MCP memoryLimit must be a number')
    }

    if (mcpConfig.cpuTimeLimit && typeof mcpConfig.cpuTimeLimit !== 'number') {
      this.addError('MCP cpuTimeLimit must be a number')
    }

    if (mcpConfig.maxApiCalls && typeof mcpConfig.maxApiCalls !== 'number') {
      this.addError('MCP maxApiCalls must be a number')
    }

    // Validate boolean flags
    const booleanFields = ['enableResourceSubscriptions', 'enableToolExecution', 'enablePromptTemplates', 'requireSignature']
    for (const field of booleanFields) {
      if (mcpConfig[field] !== undefined && typeof mcpConfig[field] !== 'boolean') {
        this.addError(`MCP ${field} must be a boolean`)
      }
    }

    // Validate contributes section for MCP-specific contributions
    if (manifest.contributes && manifest.contributes.mcp) {
      this.validateMCPContributions(manifest.contributes.mcp)
    }
  }

  /**
   * Validate MCP capabilities
   */
  validateMCPCapabilities(capabilities) {
    if (typeof capabilities !== 'object') {
      this.addError('MCP capabilities must be an object')
      return
    }

    // Validate resources capabilities
    if (capabilities.resources) {
      if (typeof capabilities.resources !== 'object') {
        this.addError('MCP capabilities.resources must be an object')
      } else {
        if (capabilities.resources.subscribe !== undefined && typeof capabilities.resources.subscribe !== 'boolean') {
          this.addError('MCP capabilities.resources.subscribe must be a boolean')
        }
        if (capabilities.resources.listChanged !== undefined && typeof capabilities.resources.listChanged !== 'boolean') {
          this.addError('MCP capabilities.resources.listChanged must be a boolean')
        }
      }
    }

    // Validate tools capabilities
    if (capabilities.tools) {
      if (typeof capabilities.tools !== 'object') {
        this.addError('MCP capabilities.tools must be an object')
      } else {
        if (capabilities.tools.listChanged !== undefined && typeof capabilities.tools.listChanged !== 'boolean') {
          this.addError('MCP capabilities.tools.listChanged must be a boolean')
        }
      }
    }

    // Validate prompts capabilities
    if (capabilities.prompts) {
      if (typeof capabilities.prompts !== 'object') {
        this.addError('MCP capabilities.prompts must be an object')
      } else {
        if (capabilities.prompts.listChanged !== undefined && typeof capabilities.prompts.listChanged !== 'boolean') {
          this.addError('MCP capabilities.prompts.listChanged must be a boolean')
        }
      }
    }

    // Validate logging capabilities
    if (capabilities.logging) {
      if (typeof capabilities.logging !== 'object') {
        this.addError('MCP capabilities.logging must be an object')
      } else {
        if (capabilities.logging.enabled !== undefined && typeof capabilities.logging.enabled !== 'boolean') {
          this.addError('MCP capabilities.logging.enabled must be a boolean')
        }
      }
    }
  }

  /**
   * Validate MCP contributions
   */
  validateMCPContributions(mcpContributions) {
    if (typeof mcpContributions !== 'object') {
      this.addError('MCP contributions must be an object')
      return
    }

    // Validate servers
    if (mcpContributions.servers) {
      if (!Array.isArray(mcpContributions.servers)) {
        this.addError('MCP contributes.servers must be an array')
      } else {
        for (const [index, server] of mcpContributions.servers.entries()) {
          this.validateMCPServerContribution(server, index)
        }
      }
    }

    // Validate resources
    if (mcpContributions.resources) {
      if (!Array.isArray(mcpContributions.resources)) {
        this.addError('MCP contributes.resources must be an array')
      } else {
        for (const [index, resource] of mcpContributions.resources.entries()) {
          this.validateMCPResourceContribution(resource, index)
        }
      }
    }

    // Validate tools
    if (mcpContributions.tools) {
      if (!Array.isArray(mcpContributions.tools)) {
        this.addError('MCP contributes.tools must be an array')
      } else {
        for (const [index, tool] of mcpContributions.tools.entries()) {
          this.validateMCPToolContribution(tool, index)
        }
      }
    }

    // Validate prompts
    if (mcpContributions.prompts) {
      if (!Array.isArray(mcpContributions.prompts)) {
        this.addError('MCP contributes.prompts must be an array')
      } else {
        for (const [index, prompt] of mcpContributions.prompts.entries()) {
          this.validateMCPPromptContribution(prompt, index)
        }
      }
    }
  }

  /**
   * Validate MCP server contribution
   */
  validateMCPServerContribution(server, index) {
    if (!server.id) {
      this.addError(`MCP server contribution ${index} must have an id`)
    }

    if (!server.name) {
      this.addError(`MCP server contribution ${index} must have a name`)
    }

    if (server.transport && !['stdio', 'tcp', 'websocket'].includes(server.transport)) {
      this.addError(`MCP server contribution ${index} has invalid transport: ${server.transport}`)
    }

    if (server.args && !Array.isArray(server.args)) {
      this.addError(`MCP server contribution ${index} args must be an array`)
    }

    if (server.env && typeof server.env !== 'object') {
      this.addError(`MCP server contribution ${index} env must be an object`)
    }
  }

  /**
   * Validate MCP resource contribution
   */
  validateMCPResourceContribution(resource, index) {
    if (!resource.name) {
      this.addError(`MCP resource contribution ${index} must have a name`)
    }

    if (!resource.pattern) {
      this.addError(`MCP resource contribution ${index} must have a pattern`)
    }

    if (!resource.type) {
      this.addError(`MCP resource contribution ${index} must have a type`)
    } else if (!VALID_MCP_RESOURCE_TYPES.includes(resource.type)) {
      this.addError(`MCP resource contribution ${index} has invalid type: ${resource.type}`)
    }
  }

  /**
   * Validate MCP tool contribution
   */
  validateMCPToolContribution(tool, index) {
    if (!tool.name) {
      this.addError(`MCP tool contribution ${index} must have a name`)
    }

    if (!tool.description) {
      this.addError(`MCP tool contribution ${index} must have a description`)
    }

    if (!tool.inputSchema) {
      this.addError(`MCP tool contribution ${index} must have an inputSchema`)
    } else if (typeof tool.inputSchema !== 'object') {
      this.addError(`MCP tool contribution ${index} inputSchema must be an object`)
    }

    if (!tool.handler) {
      this.addError(`MCP tool contribution ${index} must have a handler`)
    }
  }

  /**
   * Validate MCP prompt contribution
   */
  validateMCPPromptContribution(prompt, index) {
    if (!prompt.name) {
      this.addError(`MCP prompt contribution ${index} must have a name`)
    }

    if (!prompt.description) {
      this.addError(`MCP prompt contribution ${index} must have a description`)
    }

    if (!prompt.template) {
      this.addError(`MCP prompt contribution ${index} must have a template`)
    }

    if (prompt.arguments && !Array.isArray(prompt.arguments)) {
      this.addError(`MCP prompt contribution ${index} arguments must be an array`)
    }
  }

  /**
   * Get value type for validation
   */
  getValueType(value) {
    if (Array.isArray(value)) return 'array'
    if (value === null) return 'null'
    return typeof value
  }

  /**
   * Validate URL format
   */
  isValidUrl(url) {
    try {
      new URL(url)
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate email format
   */
  isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  /**
   * Add validation error
   */
  addError(message) {
    this.errors.push(message)
  }

  /**
   * Add validation warning
   */
  addWarning(message) {
    this.warnings.push(message)
  }

  /**
   * Get validation result
   */
  getResult() {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings]
    }
  }
}

/**
 * Validate plugin manifest (convenience function for v1 legacy)
 * For comprehensive validation, use validateManifestEnhanced
 */
export function validateManifestLegacy(manifest) {
  const validator = new ManifestValidator()
  return validator.validate(manifest)
}

/**
 * Enhanced manifest validation (recommended - supports v1 and v2)
 */
export function validateManifestEnhanced(manifest) {
  return validateManifest(manifest)
}

/**
 * Backward compatibility alias
 */
export { validateManifestLegacy as validateManifest }

/**
 * Create a minimal valid manifest template (v1 legacy)
 */
export function createManifestTemplate(options = {}) {
  return {
    id: options.id || 'my-plugin',
    name: options.name || 'My Plugin',
    version: options.version || '1.0.0',
    description: options.description || 'A Lokus plugin',
    main: options.main || 'index.js',
    lokusVersion: options.lokusVersion || '^1.0.0',
    author: options.author || 'Plugin Developer',
    license: options.license || 'MIT',
    keywords: options.keywords || [],
    permissions: options.permissions || [],
    activationEvents: options.activationEvents || ['onStartup'],
    categories: options.categories || ['Other'],
    contributes: options.contributes || {}
  }
}

/**
 * Create a v2 manifest template (recommended)
 */
export function createManifestV2Template(options = {}) {
  return {
    manifest: '2.0',
    id: options.id || 'my-plugin',
    name: options.name || 'My Plugin',
    displayName: options.displayName || options.name || 'My Plugin',
    version: options.version || '1.0.0',
    publisher: options.publisher || 'my-publisher',
    description: options.description || 'A Lokus plugin',
    engines: {
      lokus: options.lokusVersion || '^1.0.0',
      ...(options.nodeVersion && { node: options.nodeVersion })
    },
    categories: options.categories || ['Other'],
    keywords: options.keywords || [],
    main: options.main || 'index.js',
    activationEvents: options.activationEvents || ['onStartupFinished'],
    contributes: options.contributes || {},
    capabilities: {
      untrustedWorkspaces: { supported: true },
      virtualWorkspaces: { supported: true }
    },
    author: options.author || 'Plugin Developer',
    license: options.license || 'MIT',
    pricing: 'Free'
  }
}

// ===== Enhanced API Exports =====

/**
 * Re-export enhanced validation and migration tools
 */
export {
  // Enhanced validation
  EnhancedManifestValidator,
  BatchManifestValidator,
  validateManifest as validateManifestV2,
  validateManifestFormat,
  getManifestCompatibility,
  validateManifestBatch
} from '../manifest/ManifestValidator.js'

export {
  // V2 Manifest support
  PluginManifestV2,
  createManifestV2,
  validateManifestV2 as validateV2,
  MANIFEST_VERSION_2,
  ACTIVATION_EVENTS_V2,
  CATEGORIES_V2,
  CONTRIBUTION_POINTS_V2,
  MENU_CONTEXTS_V2
} from '../manifest/ManifestV2.js'

export {
  // Migration support
  ManifestMigrator,
  migrateManifest,
  previewMigration,
  canMigrateManifest,
  batchMigrateManifests
} from '../manifest/ManifestMigrator.js'

export {
  // Activation system
  ActivationEventManager,
  ActivationContext,
  ActivationEventMatcher,
  PluginActivationRegistry,
  ACTIVATION_EVENT_TYPES
} from '../activation/ActivationEventManager.js'

export default ManifestValidator