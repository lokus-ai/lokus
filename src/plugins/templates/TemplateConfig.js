/**
 * Template Configuration
 * 
 * Defines template types, categories, and configuration options
 * for the MCP Plugin Template system
 */

/**
 * Available template types
 */
export const TEMPLATE_TYPES = {
  BASIC_MCP_SERVER: 'basic-mcp-server',
  AI_ASSISTANT: 'ai-assistant',
  DATA_PROVIDER: 'data-provider',
  TOOL_COLLECTION: 'tool-collection',
  MULTI_SERVER: 'multi-server'
}

/**
 * Template categories for organization
 */
export const TEMPLATE_CATEGORIES = {
  BASIC: 'basic',
  AI_INTEGRATION: 'ai-integration',
  DATA_ACCESS: 'data-access',
  UTILITIES: 'utilities',
  ADVANCED: 'advanced',
  CUSTOM: 'custom'
}

/**
 * Template complexity levels
 */
export const TEMPLATE_COMPLEXITY = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  EXPERT: 'expert'
}

/**
 * Supported programming languages
 */
export const SUPPORTED_LANGUAGES = {
  JAVASCRIPT: 'javascript',
  TYPESCRIPT: 'typescript'
}

/**
 * Template features
 */
export const TEMPLATE_FEATURES = {
  // Core features
  MCP_SERVER: 'mcp-server',
  MCP_CLIENT: 'mcp-client',
  RESOURCES: 'resources',
  TOOLS: 'tools',
  PROMPTS: 'prompts',
  
  // Integration features
  AI_INTEGRATION: 'ai-integration',
  DATABASE: 'database',
  API_CLIENT: 'api-client',
  FILE_SYSTEM: 'file-system',
  NETWORK: 'network',
  
  // UI features
  SETTINGS_UI: 'settings-ui',
  PANEL_UI: 'panel-ui',
  TOOLBAR: 'toolbar',
  COMMANDS: 'commands',
  
  // Development features
  TYPESCRIPT: 'typescript',
  TESTING: 'testing',
  DOCUMENTATION: 'documentation',
  BUILD_CONFIG: 'build-config',
  LINTING: 'linting',
  
  // Advanced features
  MULTI_SERVER: 'multi-server',
  STATE_MANAGEMENT: 'state-management',
  EVENT_BUS: 'event-bus',
  CACHING: 'caching',
  SECURITY: 'security',
  MONITORING: 'monitoring'
}

/**
 * Template configuration schema
 */
export const TEMPLATE_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    id: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      description: 'Unique template identifier'
    },
    name: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Human-readable template name'
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
      description: 'Template description'
    },
    category: {
      type: 'string',
      enum: Object.values(TEMPLATE_CATEGORIES),
      description: 'Template category'
    },
    complexity: {
      type: 'string',
      enum: Object.values(TEMPLATE_COMPLEXITY),
      description: 'Template complexity level'
    },
    features: {
      type: 'array',
      items: {
        type: 'string',
        enum: Object.values(TEMPLATE_FEATURES)
      },
      description: 'Template features'
    },
    language: {
      type: 'string',
      enum: Object.values(SUPPORTED_LANGUAGES),
      description: 'Primary programming language'
    },
    version: {
      type: 'string',
      pattern: '^\\d+\\.\\d+\\.\\d+$',
      description: 'Template version'
    },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'uri' }
      },
      required: ['name']
    },
    license: {
      type: 'string',
      description: 'Template license'
    },
    customization: {
      type: 'object',
      additionalProperties: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['string', 'number', 'boolean', 'enum', 'array', 'object']
          },
          required: { type: 'boolean', default: false },
          default: {},
          description: { type: 'string' },
          validation: {
            type: 'object',
            properties: {
              min: { type: 'number' },
              max: { type: 'number' },
              pattern: { type: 'string' },
              options: { type: 'array' }
            }
          }
        },
        required: ['type']
      },
      description: 'Template customization options'
    },
    files: {
      type: 'object',
      additionalProperties: {
        oneOf: [
          { type: 'string' },
          {
            type: 'object',
            properties: {
              content: { type: 'string' },
              template: { type: 'boolean', default: true },
              executable: { type: 'boolean', default: false },
              encoding: { type: 'string', default: 'utf8' }
            },
            required: ['content']
          }
        ]
      },
      description: 'Template file definitions'
    },
    dependencies: {
      type: 'object',
      properties: {
        runtime: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Runtime dependencies'
        },
        development: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Development dependencies'
        },
        peer: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Peer dependencies'
        },
        lokus: {
          type: 'object',
          additionalProperties: { type: 'string' },
          description: 'Lokus-specific dependencies'
        }
      }
    },
    scripts: {
      type: 'object',
      additionalProperties: { type: 'string' },
      description: 'Build and development scripts'
    },
    hooks: {
      type: 'object',
      properties: {
        preGenerate: { type: 'string' },
        postGenerate: { type: 'string' },
        preValidate: { type: 'string' },
        postValidate: { type: 'string' }
      },
      description: 'Template lifecycle hooks'
    },
    metadata: {
      type: 'object',
      properties: {
        tags: {
          type: 'array',
          items: { type: 'string' }
        },
        keywords: {
          type: 'array',
          items: { type: 'string' }
        },
        icon: { type: 'string' },
        gallery: {
          type: 'array',
          items: { type: 'string', format: 'uri' }
        },
        documentation: { type: 'string', format: 'uri' },
        repository: { type: 'string', format: 'uri' },
        homepage: { type: 'string', format: 'uri' },
        issues: { type: 'string', format: 'uri' }
      }
    }
  },
  required: ['id', 'name', 'description', 'category', 'version', 'files']
}

/**
 * Template Configuration Class
 */
export class TemplateConfig {
  constructor() {
    this.templates = new Map()
    this.categories = new Map()
    this.validators = new Map()
    
    this.initializeCategories()
    this.initializeValidators()
  }

  /**
   * Initialize template categories
   */
  initializeCategories() {
    this.categories.set(TEMPLATE_CATEGORIES.BASIC, {
      name: 'Basic Templates',
      description: 'Simple templates for getting started',
      complexity: TEMPLATE_COMPLEXITY.BEGINNER,
      icon: 'basic',
      features: [TEMPLATE_FEATURES.MCP_SERVER, TEMPLATE_FEATURES.RESOURCES, TEMPLATE_FEATURES.TOOLS]
    })

    this.categories.set(TEMPLATE_CATEGORIES.AI_INTEGRATION, {
      name: 'AI Integration',
      description: 'Templates for AI-powered plugins',
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      icon: 'ai',
      features: [TEMPLATE_FEATURES.AI_INTEGRATION, TEMPLATE_FEATURES.PROMPTS, TEMPLATE_FEATURES.API_CLIENT]
    })

    this.categories.set(TEMPLATE_CATEGORIES.DATA_ACCESS, {
      name: 'Data Access',
      description: 'Templates for data providers and integrations',
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      icon: 'database',
      features: [TEMPLATE_FEATURES.DATABASE, TEMPLATE_FEATURES.API_CLIENT, TEMPLATE_FEATURES.CACHING]
    })

    this.categories.set(TEMPLATE_CATEGORIES.UTILITIES, {
      name: 'Utilities',
      description: 'Tool collections and utility plugins',
      complexity: TEMPLATE_COMPLEXITY.BEGINNER,
      icon: 'tools',
      features: [TEMPLATE_FEATURES.TOOLS, TEMPLATE_FEATURES.COMMANDS, TEMPLATE_FEATURES.FILE_SYSTEM]
    })

    this.categories.set(TEMPLATE_CATEGORIES.ADVANCED, {
      name: 'Advanced',
      description: 'Complex multi-server and framework plugins',
      complexity: TEMPLATE_COMPLEXITY.ADVANCED,
      icon: 'advanced',
      features: [TEMPLATE_FEATURES.MULTI_SERVER, TEMPLATE_FEATURES.STATE_MANAGEMENT, TEMPLATE_FEATURES.EVENT_BUS]
    })

    this.categories.set(TEMPLATE_CATEGORIES.CUSTOM, {
      name: 'Custom',
      description: 'User-defined custom templates',
      complexity: TEMPLATE_COMPLEXITY.EXPERT,
      icon: 'custom',
      features: []
    })
  }

  /**
   * Initialize validators
   */
  initializeValidators() {
    this.validators.set('pluginId', (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Plugin ID is required and must be a string' }
      }
      if (!/^[a-z0-9-]+$/.test(value)) {
        return { valid: false, message: 'Plugin ID must contain only lowercase letters, numbers, and hyphens' }
      }
      if (value.length < 3 || value.length > 50) {
        return { valid: false, message: 'Plugin ID must be between 3 and 50 characters' }
      }
      return { valid: true }
    })

    this.validators.set('pluginName', (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Plugin name is required and must be a string' }
      }
      if (value.length < 3 || value.length > 100) {
        return { valid: false, message: 'Plugin name must be between 3 and 100 characters' }
      }
      return { valid: true }
    })

    this.validators.set('version', (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Version is required and must be a string' }
      }
      if (!/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(value)) {
        return { valid: false, message: 'Version must follow semantic versioning (e.g., 1.0.0)' }
      }
      return { valid: true }
    })

    this.validators.set('publisher', (value) => {
      if (!value || typeof value !== 'string') {
        return { valid: false, message: 'Publisher is required and must be a string' }
      }
      if (!/^[a-zA-Z0-9-_]+$/.test(value)) {
        return { valid: false, message: 'Publisher must contain only letters, numbers, hyphens, and underscores' }
      }
      return { valid: true }
    })

    this.validators.set('email', (value) => {
      if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, message: 'Email must be a valid email address' }
      }
      return { valid: true }
    })
  }

  /**
   * Register a template
   */
  registerTemplate(id, config) {
    const validation = this.validateTemplateConfig(config)
    if (!validation.valid) {
      throw new Error(`Invalid template config: ${validation.errors.join(', ')}`)
    }

    this.templates.set(id, {
      ...config,
      id,
      registeredAt: new Date().toISOString()
    })
  }

  /**
   * Get template by ID
   */
  getTemplate(id) {
    return this.templates.get(id)
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values())
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return this.getAllTemplates().filter(template => template.category === category)
  }

  /**
   * Get templates by complexity
   */
  getTemplatesByComplexity(complexity) {
    return this.getAllTemplates().filter(template => template.complexity === complexity)
  }

  /**
   * Get templates by feature
   */
  getTemplatesByFeature(feature) {
    return this.getAllTemplates().filter(template => 
      template.features && template.features.includes(feature)
    )
  }

  /**
   * Search templates
   */
  searchTemplates(query) {
    const lowerQuery = query.toLowerCase()
    return this.getAllTemplates().filter(template => 
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      (template.keywords && template.keywords.some(keyword => 
        keyword.toLowerCase().includes(lowerQuery)
      ))
    )
  }

  /**
   * Get category info
   */
  getCategoryInfo(category) {
    return this.categories.get(category)
  }

  /**
   * Get all categories
   */
  getAllCategories() {
    return Array.from(this.categories.entries()).map(([id, info]) => ({
      id,
      ...info
    }))
  }

  /**
   * Validate template configuration
   */
  validateTemplateConfig(config) {
    const errors = []
    const warnings = []

    // Required fields
    if (!config.id) errors.push('Template ID is required')
    if (!config.name) errors.push('Template name is required')
    if (!config.description) errors.push('Template description is required')
    if (!config.category) errors.push('Template category is required')
    if (!config.version) errors.push('Template version is required')
    if (!config.files) errors.push('Template files are required')

    // Validate category
    if (config.category && !Object.values(TEMPLATE_CATEGORIES).includes(config.category)) {
      errors.push(`Invalid category: ${config.category}`)
    }

    // Validate complexity
    if (config.complexity && !Object.values(TEMPLATE_COMPLEXITY).includes(config.complexity)) {
      errors.push(`Invalid complexity: ${config.complexity}`)
    }

    // Validate features
    if (config.features) {
      const invalidFeatures = config.features.filter(feature => 
        !Object.values(TEMPLATE_FEATURES).includes(feature)
      )
      if (invalidFeatures.length > 0) {
        errors.push(`Invalid features: ${invalidFeatures.join(', ')}`)
      }
    }

    // Validate version format
    if (config.version && !/^\d+\.\d+\.\d+(-[a-zA-Z0-9-]+)?$/.test(config.version)) {
      errors.push('Template version must follow semantic versioning')
    }

    // Validate customization options
    if (config.customization) {
      for (const [key, option] of Object.entries(config.customization)) {
        if (!option.type) {
          errors.push(`Customization option '${key}' is missing type`)
        } else if (!['string', 'number', 'boolean', 'enum', 'array', 'object'].includes(option.type)) {
          errors.push(`Customization option '${key}' has invalid type: ${option.type}`)
        }

        if (option.type === 'enum' && !option.validation?.options) {
          errors.push(`Customization option '${key}' of type 'enum' must have validation.options`)
        }
      }
    }

    // Performance warnings
    if (config.files && Object.keys(config.files).length > 50) {
      warnings.push('Template has a large number of files, consider splitting into multiple templates')
    }

    if (config.features && config.features.length > 10) {
      warnings.push('Template has many features, consider focusing on fewer core features')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate template generation options
   */
  validateGenerationOptions(templateId, options) {
    const template = this.getTemplate(templateId)
    if (!template) {
      return { valid: false, errors: [`Template '${templateId}' not found`] }
    }

    const errors = []
    const warnings = []

    // Common validations
    const commonValidations = [
      { key: 'pluginId', required: true },
      { key: 'pluginName', required: true },
      { key: 'version', required: false },
      { key: 'publisher', required: false },
      { key: 'author', required: false }
    ]

    for (const validation of commonValidations) {
      const value = options[validation.key]
      if (validation.required && !value) {
        errors.push(`${validation.key} is required`)
        continue
      }

      if (value && this.validators.has(validation.key)) {
        const result = this.validators.get(validation.key)(value)
        if (!result.valid) {
          errors.push(result.message)
        }
      }
    }

    // Template-specific customization validation
    if (template.customization) {
      for (const [key, config] of Object.entries(template.customization)) {
        const value = options[key]
        
        if (config.required && (value === undefined || value === null)) {
          errors.push(`Required option '${key}' is missing`)
          continue
        }

        if (value !== undefined) {
          const validation = this.validateCustomizationValue(key, value, config)
          if (!validation.valid) {
            errors.push(validation.message)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Validate customization value
   */
  validateCustomizationValue(key, value, config) {
    switch (config.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, message: `Option '${key}' must be a string` }
        }
        if (config.validation?.pattern && !new RegExp(config.validation.pattern).test(value)) {
          return { valid: false, message: `Option '${key}' does not match required pattern` }
        }
        break

      case 'number':
        if (typeof value !== 'number') {
          return { valid: false, message: `Option '${key}' must be a number` }
        }
        if (config.validation?.min !== undefined && value < config.validation.min) {
          return { valid: false, message: `Option '${key}' must be >= ${config.validation.min}` }
        }
        if (config.validation?.max !== undefined && value > config.validation.max) {
          return { valid: false, message: `Option '${key}' must be <= ${config.validation.max}` }
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          return { valid: false, message: `Option '${key}' must be a boolean` }
        }
        break

      case 'enum':
        if (!config.validation?.options || !config.validation.options.includes(value)) {
          return { valid: false, message: `Option '${key}' must be one of: ${config.validation?.options?.join(', ') || 'none'}` }
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          return { valid: false, message: `Option '${key}' must be an array` }
        }
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          return { valid: false, message: `Option '${key}' must be an object` }
        }
        break
    }

    return { valid: true }
  }

  /**
   * Get template statistics
   */
  getStatistics() {
    const templates = this.getAllTemplates()
    const categories = {}
    const complexities = {}
    const features = {}

    for (const template of templates) {
      // Count by category
      categories[template.category] = (categories[template.category] || 0) + 1

      // Count by complexity
      if (template.complexity) {
        complexities[template.complexity] = (complexities[template.complexity] || 0) + 1
      }

      // Count by features
      if (template.features) {
        for (const feature of template.features) {
          features[feature] = (features[feature] || 0) + 1
        }
      }
    }

    return {
      total: templates.length,
      categories,
      complexities,
      features,
      popularFeatures: Object.entries(features)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([feature, count]) => ({ feature, count }))
    }
  }

  /**
   * Export template configuration
   */
  exportTemplate(templateId) {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`Template '${templateId}' not found`)
    }

    return {
      ...template,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0'
    }
  }

  /**
   * Import template configuration
   */
  importTemplate(templateData) {
    const validation = this.validateTemplateConfig(templateData)
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`)
    }

    this.registerTemplate(templateData.id, templateData)
    return templateData.id
  }
}

/**
 * Default template configuration instance
 */
export const defaultTemplateConfig = new TemplateConfig()

export default TemplateConfig