/**
 * MCP Plugin Templates Module
 * 
 * Main entry point for the MCP Plugin Template system
 * Provides template generation, CLI integration, and example projects
 */

// Core template system
export {
  MCPPluginTemplateGenerator,
  defaultTemplateGenerator,
  generateMCPPlugin,
  getAvailableMCPTemplates
} from './MCPPluginTemplate.js'

export {
  TemplateConfig,
  defaultTemplateConfig,
  TEMPLATE_TYPES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_COMPLEXITY,
  SUPPORTED_LANGUAGES,
  TEMPLATE_FEATURES,
  TEMPLATE_CONFIG_SCHEMA
} from './TemplateConfig.js'

// CLI integration
export {
  CLITemplateGenerator,
  CLICommands,
  CLITemplateIntegration,
  registerCLICommands,
  defaultCLIIntegration
} from './cli/index.js'

// Example projects
export {
  ExampleProjectRegistry,
  defaultExampleRegistry,
  initializeExampleRegistry
} from './examples/ExampleProjectRegistry.js'

// Type definitions
export * from './types/template.d.ts'

/**
 * Template System Integration
 * 
 * Provides high-level integration functions for the template system
 */
export class TemplateSystemIntegration {
  constructor(pluginManager) {
    this.pluginManager = pluginManager
    this.templateGenerator = null
    this.exampleRegistry = null
    this.cliIntegration = null
    this.isInitialized = false
  }

  /**
   * Initialize the template system
   */
  async initialize() {
    if (this.isInitialized) return

    try {
      // Initialize template generator
      const { defaultTemplateGenerator } = await import('./MCPPluginTemplate.js')
      this.templateGenerator = defaultTemplateGenerator

      // Initialize example registry
      const { defaultExampleRegistry } = await import('./examples/ExampleProjectRegistry.js')
      await defaultExampleRegistry.initialize()
      this.exampleRegistry = defaultExampleRegistry

      // Initialize CLI integration
      const { defaultCLIIntegration } = await import('./cli/index.js')
      this.cliIntegration = defaultCLIIntegration

      // Register with plugin manager
      this.registerWithPluginManager()

      this.isInitialized = true

    } catch (error) {
      throw error
    }
  }

  /**
   * Register template system with plugin manager
   */
  registerWithPluginManager() {
    if (!this.pluginManager) return

    // Add template generation API to plugin manager
    this.pluginManager.templateAPI = {
      // Template generation
      generatePlugin: (templateType, options) => 
        this.templateGenerator.generatePlugin(templateType, options),
      
      getAvailableTemplates: () => 
        this.templateGenerator.getAvailableTemplates(),
      
      getTemplate: (type) => 
        this.templateGenerator.getTemplate(type),
      
      // Example projects
      getExamples: () => 
        this.exampleRegistry.listExamples(),
      
      getExample: (id) => 
        this.exampleRegistry.getExample(id),
      
      downloadExample: (id, targetDir) => 
        this.exampleRegistry.downloadExample(id, targetDir),
      
      // CLI commands
      getCLICommands: () => 
        this.cliIntegration.getCommands(),
      
      executeCLICommand: (command, options) => 
        this.cliIntegration.executeCommand(command, options)
    }

    // Register template-related events
    this.pluginManager.on('template:generate', this.handleTemplateGenerate.bind(this))
    this.pluginManager.on('example:download', this.handleExampleDownload.bind(this))
  }

  /**
   * Handle template generation event
   */
  async handleTemplateGenerate(event) {
    try {
      const { templateType, options, targetDirectory } = event
      
      // Generate plugin structure
      const structure = await this.templateGenerator.generatePlugin(templateType, options)
      
      // Create files if target directory is specified
      if (targetDirectory) {
        await this.createProjectFiles(targetDirectory, structure)
      }

      // Emit completion event
      this.pluginManager.emit('template:generated', {
        templateType,
        options,
        targetDirectory,
        structure
      })

      return structure

    } catch (error) {
      this.pluginManager.emit('template:error', {
        templateType: event.templateType,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Handle example download event
   */
  async handleExampleDownload(event) {
    try {
      const { exampleId, targetDirectory } = event
      
      await this.exampleRegistry.downloadExample(exampleId, targetDirectory)
      
      this.pluginManager.emit('example:downloaded', {
        exampleId,
        targetDirectory
      })

    } catch (error) {
      this.pluginManager.emit('example:error', {
        exampleId: event.exampleId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * Create project files from generated structure
   */
  async createProjectFiles(targetDirectory, structure) {
    const fs = await import('fs/promises')
    const path = await import('path')

    // Ensure target directory exists
    await fs.mkdir(targetDirectory, { recursive: true })

    // Create manifest file
    const manifestPath = path.join(targetDirectory, 'plugin.json')
    await fs.writeFile(manifestPath, JSON.stringify(structure.manifest, null, 2))

    // Create source files
    for (const [filePath, content] of structure.files) {
      const fullPath = path.join(targetDirectory, filePath)
      const dir = path.dirname(fullPath)
      
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(fullPath, content)
    }

    // Create documentation files
    if (structure.documentation) {
      for (const [fileName, content] of Object.entries(structure.documentation)) {
        const fullPath = path.join(targetDirectory, fileName)
        const dir = path.dirname(fullPath)
        
        await fs.mkdir(dir, { recursive: true })
        await fs.writeFile(fullPath, content)
      }
    }

    // Create build configuration files
    if (structure.buildConfig) {
      for (const [fileName, content] of Object.entries(structure.buildConfig)) {
        const fullPath = path.join(targetDirectory, fileName)
        await fs.writeFile(fullPath, content)
      }
    }

    // Create metadata file
    const metadataPath = path.join(targetDirectory, '.lokus-template.json')
    await fs.writeFile(metadataPath, JSON.stringify(structure.metadata, null, 2))
  }

  /**
   * Get template system statistics
   */
  getStatistics() {
    return {
      templates: {
        total: this.templateGenerator?.getAvailableTemplates().length || 0,
        byCategory: this.getTemplatesByCategory()
      },
      examples: this.exampleRegistry?.getStatistics() || {},
      cliCommands: this.cliIntegration?.getCommands().length || 0,
      isInitialized: this.isInitialized
    }
  }

  /**
   * Get templates grouped by category
   */
  getTemplatesByCategory() {
    if (!this.templateGenerator) return {}

    const templates = this.templateGenerator.getAvailableTemplates()
    const byCategory = {}

    for (const template of templates) {
      if (!byCategory[template.category]) {
        byCategory[template.category] = 0
      }
      byCategory[template.category]++
    }

    return byCategory
  }

  /**
   * Validate template system health
   */
  async validateSystem() {
    const issues = []
    const warnings = []

    // Check template generator
    if (!this.templateGenerator) {
      issues.push('Template generator not initialized')
    } else {
      const templates = this.templateGenerator.getAvailableTemplates()
      if (templates.length === 0) {
        warnings.push('No templates available')
      }
    }

    // Check example registry
    if (!this.exampleRegistry) {
      issues.push('Example registry not initialized')
    } else {
      const examples = this.exampleRegistry.getAvailableExamples()
      if (examples.length === 0) {
        warnings.push('No examples available')
      }

      // Validate example files
      for (const example of examples) {
        try {
          const validation = await this.exampleRegistry.validateExampleFiles(example.id)
          if (!validation.valid) {
            issues.push(`Example '${example.id}' has issues: ${validation.errors.join(', ')}`)
          }
        } catch (error) {
          issues.push(`Failed to validate example '${example.id}': ${error.message}`)
        }
      }
    }

    // Check CLI integration
    if (!this.cliIntegration) {
      issues.push('CLI integration not initialized')
    }

    return {
      healthy: issues.length === 0,
      issues,
      warnings
    }
  }

  /**
   * Shutdown template system
   */
  async shutdown() {
    if (this.pluginManager?.templateAPI) {
      delete this.pluginManager.templateAPI
    }

    this.templateGenerator = null
    this.exampleRegistry = null
    this.cliIntegration = null
    this.isInitialized = false

  }
}

/**
 * Initialize template system for plugin manager
 */
export async function initializeTemplateSystem(pluginManager) {
  const integration = new TemplateSystemIntegration(pluginManager)
  await integration.initialize()
  return integration
}

/**
 * Default template system integration
 */
let defaultIntegration = null

/**
 * Get or create default template integration
 */
export async function getTemplateSystemIntegration(pluginManager = null) {
  if (!defaultIntegration && pluginManager) {
    defaultIntegration = await initializeTemplateSystem(pluginManager)
  }
  return defaultIntegration
}

/**
 * Template system utilities
 */
export const TemplateUtils = {
  /**
   * Quick template generation
   */
  async quickGenerate(templateType, pluginId, pluginName) {
    const { generateMCPPlugin } = await import('./MCPPluginTemplate.js')
    
    return await generateMCPPlugin(templateType, {
      pluginId,
      pluginName,
      description: `${pluginName} plugin generated from ${templateType} template`,
      useTypeScript: false,
      includeTests: true,
      includeDocumentation: true
    })
  },

  /**
   * List templates by complexity
   */
  async getTemplatesByComplexity(complexity) {
    const { defaultTemplateConfig } = await import('./TemplateConfig.js')
    return defaultTemplateConfig.getTemplatesByComplexity(complexity)
  },

  /**
   * Get beginner-friendly templates
   */
  async getBeginnerTemplates() {
    const { TEMPLATE_COMPLEXITY } = await import('./TemplateConfig.js')
    return await this.getTemplatesByComplexity(TEMPLATE_COMPLEXITY.BEGINNER)
  },

  /**
   * Search templates and examples
   */
  async search(query) {
    const { defaultTemplateConfig } = await import('./TemplateConfig.js')
    const { defaultExampleRegistry } = await import('./examples/ExampleProjectRegistry.js')
    
    return {
      templates: defaultTemplateConfig.searchTemplates(query),
      examples: defaultExampleRegistry.searchExamples(query)
    }
  },

  /**
   * Validate template options
   */
  async validateOptions(templateType, options) {
    const { defaultTemplateConfig } = await import('./TemplateConfig.js')
    return defaultTemplateConfig.validateGenerationOptions(templateType, options)
  }
}

export default {
  // Classes
  MCPPluginTemplateGenerator,
  TemplateConfig,
  CLITemplateGenerator,
  ExampleProjectRegistry,
  TemplateSystemIntegration,
  
  // Functions
  generateMCPPlugin,
  getAvailableMCPTemplates,
  initializeTemplateSystem,
  getTemplateSystemIntegration,
  initializeExampleRegistry,
  registerCLICommands,
  
  // Constants
  TEMPLATE_TYPES,
  TEMPLATE_CATEGORIES,
  TEMPLATE_COMPLEXITY,
  SUPPORTED_LANGUAGES,
  TEMPLATE_FEATURES,
  
  // Utilities
  TemplateUtils
}