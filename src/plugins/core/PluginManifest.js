/**
 * Plugin Manifest Schema and Validation
 * Defines the structure and validation rules for plugin.json files
 */

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
    'qna'           // Q&A support (string or boolean)
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
    qna: ['string', 'boolean']
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
  'workspaceContains:*' // Activate when workspace contains pattern
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
  'Other'
]

/**
 * Manifest Validator Class
 */
export class ManifestValidator {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  /**
   * Validate a complete plugin manifest
   */
  validate(manifest) {
    this.reset()

    if (!manifest || typeof manifest !== 'object') {
      this.addError('Manifest must be a valid JSON object')
      return this.getResult()
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

    return this.getResult()
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
        'taskDefinitions'
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
 * Validate plugin manifest (convenience function)
 */
export function validateManifest(manifest) {
  const validator = new ManifestValidator()
  return validator.validate(manifest)
}

/**
 * Create a minimal valid manifest template
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

export default ManifestValidator