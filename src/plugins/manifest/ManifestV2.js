/**
 * Plugin Manifest v2 Implementation
 * Enhanced manifest system with VS Code-level capabilities
 */

import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import manifestV2Schema from '../schemas/manifest-v2.schema.json'

/**
 * Manifest v2 Constants
 */
export const MANIFEST_VERSION_2 = '2.0'

/**
 * Valid activation events for v2
 */
export const ACTIVATION_EVENTS_V2 = {
  // Global activation
  STAR: '*',
  STARTUP_FINISHED: 'onStartupFinished',
  
  // Command-based activation
  ON_COMMAND: 'onCommand:',
  
  // Language-based activation
  ON_LANGUAGE: 'onLanguage:',
  
  // Debug activation
  ON_DEBUG: 'onDebug:',
  ON_DEBUG_RESOLVE: 'onDebugResolve:',
  ON_DEBUG_INITIAL_CONFIGURATIONS: 'onDebugInitialConfigurations',
  ON_DEBUG_DYNAMIC_CONFIGURATIONS: 'onDebugDynamicConfigurations:',
  
  // Workspace activation
  WORKSPACE_CONTAINS: 'workspaceContains:',
  
  // File system activation
  ON_FILE_SYSTEM: 'onFileSystem:',
  
  // Search activation
  ON_SEARCH: 'onSearch:',
  
  // View activation
  ON_VIEW: 'onView:',
  
  // URI activation
  ON_URI: 'onUri',
  
  // Webview activation
  ON_WEBVIEW_PANEL: 'onWebviewPanel:',
  
  // Custom editor activation
  ON_CUSTOM_EDITOR: 'onCustomEditor:',
  
  // Authentication activation
  ON_AUTHENTICATION_REQUEST: 'onAuthenticationRequest:',
  
  // External URI activation
  ON_OPEN_EXTERNAL_URI: 'onOpenExternalUri:',
  
  // Terminal activation
  ON_TERMINAL_PROFILE: 'onTerminalProfile:'
}

/**
 * Valid categories for v2 (VS Code compatible)
 */
export const CATEGORIES_V2 = [
  'Programming Languages',
  'Snippets',
  'Linters', 
  'Themes',
  'Debuggers',
  'Formatters',
  'Keymaps',
  'SCM Providers',
  'Extension Packs',
  'Language Packs',
  'Data Science',
  'Machine Learning',
  'Visualization',
  'Notebooks',
  'Education',
  'Testing',
  'Other'
]

/**
 * Valid contribution points for v2
 */
export const CONTRIBUTION_POINTS_V2 = {
  COMMANDS: 'commands',
  MENUS: 'menus',
  KEYBINDINGS: 'keybindings',
  LANGUAGES: 'languages',
  GRAMMARS: 'grammars',
  THEMES: 'themes',
  ICON_THEMES: 'iconThemes',
  SNIPPETS: 'snippets',
  CONFIGURATION: 'configuration',
  CONFIGURATION_DEFAULTS: 'configurationDefaults',
  VIEWS: 'views',
  VIEWS_CONTAINERS: 'viewsContainers',
  PROBLEM_MATCHERS: 'problemMatchers',
  TASK_DEFINITIONS: 'taskDefinitions',
  DEBUGGERS: 'debuggers',
  BREAKPOINTS: 'breakpoints',
  COLORS: 'colors',
  AUTHENTICATION: 'authentication',
  RESOURCE_LABEL_FORMATTERS: 'resourceLabelFormatters',
  CUSTOM_EDITORS: 'customEditors',
  WEBVIEWS: 'webviews'
}

/**
 * Valid menu contexts for v2
 */
export const MENU_CONTEXTS_V2 = [
  'commandPalette',
  'editor/context',
  'editor/title', 
  'editor/title/context',
  'explorer/context',
  'scm/title',
  'scm/resourceGroup/context',
  'scm/resourceState/context',
  'scm/change/title',
  'view/title',
  'view/item/context',
  'menuBar',
  'touchBar',
  'webview/context',
  'comments/commentThread/context',
  'comments/comment/title',
  'comments/comment/context',
  'timeline/title',
  'timeline/item/context',
  'extension/context',
  'file/newFile'
]

/**
 * Plugin Manifest v2 Class
 */
export class PluginManifestV2 {
  constructor() {
    this.ajv = new Ajv({ 
      allErrors: true,
      verbose: true,
      strict: false,
      addUsedSchema: false,
      allowUnionTypes: true
    })
    addFormats(this.ajv)
    
    this.validateSchema = this.ajv.compile(manifestV2Schema)
    this.manifest = null
    this.validationResult = null
  }

  /**
   * Load and validate a manifest v2 from JSON string or object
   */
  load(manifestData) {
    try {
      // Parse if string
      if (typeof manifestData === 'string') {
        this.manifest = JSON.parse(manifestData)
      } else {
        this.manifest = manifestData
      }

      // Validate against schema
      this.validationResult = this.validate()
      
      return this.validationResult
    } catch (error) {
      this.validationResult = {
        valid: false,
        errors: [{
          field: 'json',
          message: `Invalid JSON: ${error.message}`,
          severity: 'error'
        }],
        warnings: []
      }
      return this.validationResult
    }
  }

  /**
   * Validate the loaded manifest
   */
  validate() {
    if (!this.manifest) {
      return {
        valid: false,
        errors: [{
          field: 'manifest',
          message: 'No manifest loaded',
          severity: 'error'
        }],
        warnings: []
      }
    }

    const errors = []
    const warnings = []

    // Schema validation
    const valid = this.validateSchema(this.manifest)
    
    if (!valid && this.validateSchema.errors) {
      for (const error of this.validateSchema.errors) {
        errors.push({
          field: error.instancePath || error.schemaPath || 'unknown',
          message: this.formatSchemaError(error),
          severity: 'error',
          data: error
        })
      }
    }

    // Additional semantic validation
    this.validateSemantic(errors, warnings)

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Format schema validation error messages
   */
  formatSchemaError(error) {
    const { keyword, instancePath, message, params } = error
    
    switch (keyword) {
      case 'required':
        return `Missing required property: ${params.missingProperty}`
      case 'additionalProperties':
        return `Unknown property: ${params.additionalProperty}`
      case 'pattern':
        return `${instancePath || 'Value'} does not match required pattern: ${message}`
      case 'enum':
        return `${instancePath || 'Value'} must be one of: ${params.allowedValues?.join(', ')}`
      case 'type':
        return `${instancePath || 'Value'} must be of type ${params.type}`
      case 'format':
        return `${instancePath || 'Value'} must be a valid ${params.format}`
      case 'minLength':
        return `${instancePath || 'Value'} must be at least ${params.limit} characters long`
      case 'maxLength':
        return `${instancePath || 'Value'} must be at most ${params.limit} characters long`
      case 'minimum':
        return `${instancePath || 'Value'} must be >= ${params.limit}`
      case 'maximum':
        return `${instancePath || 'Value'} must be <= ${params.limit}`
      default:
        return message || 'Validation error'
    }
  }

  /**
   * Additional semantic validation beyond schema
   */
  validateSemantic(errors, warnings) {
    if (!this.manifest) return

    // Validate activation events
    this.validateActivationEvents(errors, warnings)
    
    // Validate contributions
    this.validateContributions(errors, warnings)
    
    // Validate capabilities
    this.validateCapabilities(errors, warnings)
    
    // Validate dependencies
    this.validateDependencies(errors, warnings)
    
    // Cross-reference validation
    this.validateCrossReferences(errors, warnings)
    
    // Performance warnings
    this.validatePerformance(warnings)
  }

  /**
   * Validate activation events
   */
  validateActivationEvents(errors, warnings) {
    const { activationEvents } = this.manifest
    
    if (!activationEvents) return

    // Check for wildcard activation
    if (activationEvents.includes('*')) {
      warnings.push({
        field: 'activationEvents',
        message: 'Wildcard activation (*) may impact performance. Consider specific activation events.',
        severity: 'warning'
      })
    }

    // Check for conflicting activation events
    const hasStartup = activationEvents.some(event => 
      event === '*' || event === 'onStartupFinished'
    )
    
    if (hasStartup && activationEvents.length > 1) {
      warnings.push({
        field: 'activationEvents',
        message: 'Plugin activates on startup and has additional activation events. Startup activation may make other events redundant.',
        severity: 'warning'
      })
    }

    // Validate command references
    activationEvents
      .filter(event => event.startsWith('onCommand:'))
      .forEach(event => {
        const commandId = event.replace('onCommand:', '')
        if (!this.hasContributedCommand(commandId)) {
          warnings.push({
            field: 'activationEvents',
            message: `Activation event references command '${commandId}' which is not contributed by this plugin`,
            severity: 'warning'
          })
        }
      })

    // Validate language references
    activationEvents
      .filter(event => event.startsWith('onLanguage:'))
      .forEach(event => {
        const languageId = event.replace('onLanguage:', '')
        if (!this.hasContributedLanguage(languageId)) {
          warnings.push({
            field: 'activationEvents',
            message: `Activation event references language '${languageId}' which is not contributed by this plugin`,
            severity: 'warning'
          })
        }
      })
  }

  /**
   * Validate contributions
   */
  validateContributions(errors, warnings) {
    const { contributes } = this.manifest
    
    if (!contributes) return

    // Validate command contributions
    if (contributes.commands) {
      this.validateCommands(contributes.commands, errors, warnings)
    }

    // Validate menu contributions
    if (contributes.menus) {
      this.validateMenus(contributes.menus, errors, warnings)
    }

    // Validate keybinding contributions
    if (contributes.keybindings) {
      this.validateKeybindings(contributes.keybindings, errors, warnings)
    }

    // Validate language contributions
    if (contributes.languages) {
      this.validateLanguages(contributes.languages, errors, warnings)
    }

    // Validate theme contributions
    if (contributes.themes) {
      this.validateThemes(contributes.themes, errors, warnings)
    }

    // Validate configuration contributions
    if (contributes.configuration) {
      this.validateConfiguration(contributes.configuration, errors, warnings)
    }

    // Validate view contributions
    if (contributes.views) {
      this.validateViews(contributes.views, errors, warnings)
    }
  }

  /**
   * Validate command contributions
   */
  validateCommands(commands, errors, warnings) {
    const commandIds = new Set()
    
    commands.forEach((command, index) => {
      // Check for duplicate command IDs
      if (commandIds.has(command.command)) {
        errors.push({
          field: `contributes.commands[${index}]`,
          message: `Duplicate command ID: ${command.command}`,
          severity: 'error'
        })
      }
      commandIds.add(command.command)

      // Check command naming convention
      if (!command.command.includes('.')) {
        warnings.push({
          field: `contributes.commands[${index}]`,
          message: `Command ID '${command.command}' should follow the convention 'extension.commandName'`,
          severity: 'warning'
        })
      }
    })
  }

  /**
   * Validate menu contributions
   */
  validateMenus(menus, errors, warnings) {
    Object.entries(menus).forEach(([context, items]) => {
      if (!MENU_CONTEXTS_V2.includes(context)) {
        warnings.push({
          field: `contributes.menus.${context}`,
          message: `Unknown menu context: ${context}`,
          severity: 'warning'
        })
      }

      items.forEach((item, index) => {
        if (item.command && !this.hasContributedCommand(item.command)) {
          warnings.push({
            field: `contributes.menus.${context}[${index}]`,
            message: `Menu item references command '${item.command}' which is not contributed by this plugin`,
            severity: 'warning'
          })
        }
      })
    })
  }

  /**
   * Validate keybinding contributions
   */
  validateKeybindings(keybindings, errors, warnings) {
    keybindings.forEach((binding, index) => {
      if (!this.hasContributedCommand(binding.command)) {
        warnings.push({
          field: `contributes.keybindings[${index}]`,
          message: `Keybinding references command '${binding.command}' which is not contributed by this plugin`,
          severity: 'warning'
        })
      }
    })
  }

  /**
   * Validate language contributions
   */
  validateLanguages(languages, errors, warnings) {
    const languageIds = new Set()
    
    languages.forEach((language, index) => {
      if (languageIds.has(language.id)) {
        errors.push({
          field: `contributes.languages[${index}]`,
          message: `Duplicate language ID: ${language.id}`,
          severity: 'error'
        })
      }
      languageIds.add(language.id)
    })
  }

  /**
   * Validate theme contributions
   */
  validateThemes(themes, errors, warnings) {
    themes.forEach((theme, index) => {
      // Check if theme path exists would require filesystem access
      // This is a placeholder for future implementation
    })
  }

  /**
   * Validate configuration contributions
   */
  validateConfiguration(configuration, errors, warnings) {
    if (configuration.properties) {
      Object.entries(configuration.properties).forEach(([key, config]) => {
        // Validate configuration key naming
        if (!key.includes('.')) {
          warnings.push({
            field: `contributes.configuration.properties.${key}`,
            message: `Configuration key '${key}' should follow the convention 'extension.settingName'`,
            severity: 'warning'
          })
        }
      })
    }
  }

  /**
   * Validate view contributions
   */
  validateViews(views, errors, warnings) {
    Object.entries(views).forEach(([containerId, viewList]) => {
      viewList.forEach((view, index) => {
        // Check if view container is contributed
        if (!this.hasContributedViewContainer(containerId)) {
          warnings.push({
            field: `contributes.views.${containerId}[${index}]`,
            message: `View references container '${containerId}' which is not contributed by this plugin`,
            severity: 'warning'
          })
        }
      })
    })
  }

  /**
   * Validate capabilities
   */
  validateCapabilities(errors, warnings) {
    const { capabilities } = this.manifest
    
    if (!capabilities) return

    // Check for conflicting capability declarations
    if (capabilities.untrustedWorkspaces?.supported === false && 
        capabilities.virtualWorkspaces?.supported === true) {
      warnings.push({
        field: 'capabilities',
        message: 'Plugin supports virtual workspaces but not untrusted workspaces. This may limit functionality.',
        severity: 'warning'
      })
    }
  }

  /**
   * Validate dependencies
   */
  validateDependencies(errors, warnings) {
    const { extensionDependencies, extensionPack } = this.manifest
    
    // Check for circular dependencies in extension pack
    if (extensionPack && extensionDependencies) {
      const overlap = extensionDependencies.filter(dep => extensionPack.includes(dep))
      if (overlap.length > 0) {
        warnings.push({
          field: 'extensionPack',
          message: `Extensions listed in both dependencies and extension pack: ${overlap.join(', ')}`,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Cross-reference validation
   */
  validateCrossReferences(errors, warnings) {
    // This would implement complex cross-reference validation
    // between different contribution points
  }

  /**
   * Performance validation
   */
  validatePerformance(warnings) {
    const { activationEvents, contributes } = this.manifest
    
    // Large number of contributions warning
    if (contributes) {
      const totalContributions = Object.values(contributes)
        .reduce((total, contrib) => {
          if (Array.isArray(contrib)) return total + contrib.length
          if (typeof contrib === 'object') return total + Object.keys(contrib).length
          return total + 1
        }, 0)
      
      if (totalContributions > 50) {
        warnings.push({
          field: 'contributes',
          message: `Large number of contributions (${totalContributions}). Consider splitting into multiple plugins.`,
          severity: 'warning'
        })
      }
    }
  }

  /**
   * Helper methods
   */
  hasContributedCommand(commandId) {
    return this.manifest?.contributes?.commands?.some(cmd => cmd.command === commandId) || false
  }

  hasContributedLanguage(languageId) {
    return this.manifest?.contributes?.languages?.some(lang => lang.id === languageId) || false
  }

  hasContributedViewContainer(containerId) {
    const containers = this.manifest?.contributes?.viewsContainers
    if (!containers) return false
    
    return Object.values(containers)
      .flat()
      .some(container => container.id === containerId)
  }

  /**
   * Get manifest data
   */
  getManifest() {
    return this.manifest
  }

  /**
   * Get validation result
   */
  getValidationResult() {
    return this.validationResult
  }

  /**
   * Check if manifest is valid
   */
  isValid() {
    return this.validationResult?.valid || false
  }

  /**
   * Get manifest version
   */
  getVersion() {
    return this.manifest?.manifest || null
  }

  /**
   * Check if this is a v2 manifest
   */
  isV2() {
    return this.getVersion() === MANIFEST_VERSION_2
  }

  /**
   * Get plugin ID
   */
  getId() {
    return this.manifest?.id || null
  }

  /**
   * Get plugin name
   */
  getName() {
    return this.manifest?.name || null
  }

  /**
   * Get plugin display name
   */
  getDisplayName() {
    return this.manifest?.displayName || this.getName()
  }

  /**
   * Get plugin publisher
   */
  getPublisher() {
    return this.manifest?.publisher || null
  }

  /**
   * Get full plugin identifier (publisher.id)
   */
  getFullId() {
    const publisher = this.getPublisher()
    const id = this.getId()
    return publisher && id ? `${publisher}.${id}` : id
  }

  /**
   * Get activation events
   */
  getActivationEvents() {
    return this.manifest?.activationEvents || []
  }

  /**
   * Get contributions
   */
  getContributions() {
    return this.manifest?.contributes || {}
  }

  /**
   * Get specific contribution type
   */
  getContribution(type) {
    return this.getContributions()[type] || null
  }

  /**
   * Get capabilities
   */
  getCapabilities() {
    return this.manifest?.capabilities || {}
  }

  /**
   * Check if plugin supports untrusted workspaces
   */
  supportsUntrustedWorkspaces() {
    return this.getCapabilities().untrustedWorkspaces?.supported !== false
  }

  /**
   * Check if plugin supports virtual workspaces
   */
  supportsVirtualWorkspaces() {
    return this.getCapabilities().virtualWorkspaces?.supported !== false
  }

  /**
   * Get Lokus engine compatibility
   */
  getLokusEngineRange() {
    return this.manifest?.engines?.lokus || null
  }

  /**
   * Get main entry point
   */
  getMain() {
    return this.manifest?.main || null
  }

  /**
   * Get browser entry point
   */
  getBrowser() {
    return this.manifest?.browser || null
  }

  /**
   * Get categories
   */
  getCategories() {
    return this.manifest?.categories || []
  }

  /**
   * Get keywords
   */
  getKeywords() {
    return this.manifest?.keywords || []
  }

  /**
   * Check if plugin is preview/experimental
   */
  isPreview() {
    return this.manifest?.preview === true
  }

  /**
   * Get extension dependencies
   */
  getExtensionDependencies() {
    return this.manifest?.extensionDependencies || []
  }

  /**
   * Get extension pack
   */
  getExtensionPack() {
    return this.manifest?.extensionPack || []
  }
}

/**
 * Factory function to create and load a manifest v2
 */
export function createManifestV2(manifestData) {
  const manifest = new PluginManifestV2()
  manifest.load(manifestData)
  return manifest
}

/**
 * Validate manifest v2 (convenience function)
 */
export function validateManifestV2(manifestData) {
  const manifest = createManifestV2(manifestData)
  return manifest.getValidationResult()
}

export default PluginManifestV2