/**
 * Example Project Registry
 * 
 * Manages and provides access to example MCP plugin projects
 * for different template types and use cases
 */

import fs from 'fs/promises'
import path from 'path'
import { TEMPLATE_TYPES, TEMPLATE_COMPLEXITY, TEMPLATE_FEATURES } from '../TemplateConfig.js'

/**
 * Example Project Registry Class
 */
export class ExampleProjectRegistry {
  constructor() {
    this.examples = new Map()
    this.categories = new Map()
    this.initialized = false
    this.baseDirectory = path.join(process.cwd(), 'src/plugins/templates/examples')
  }

  /**
   * Initialize the registry with built-in examples
   */
  async initialize() {
    if (this.initialized) return

    await this.loadBuiltInExamples()
    this.initialized = true
  }

  /**
   * Load built-in example projects
   */
  async loadBuiltInExamples() {
    // Basic MCP Server Example
    this.registerExample({
      id: 'basic-file-server',
      name: 'Basic File Server',
      description: 'A simple MCP server that provides file system access and basic file operations',
      templateType: TEMPLATE_TYPES.BASIC_MCP_SERVER,
      complexity: TEMPLATE_COMPLEXITY.BEGINNER,
      features: [
        TEMPLATE_FEATURES.MCP_SERVER,
        TEMPLATE_FEATURES.RESOURCES,
        TEMPLATE_FEATURES.TOOLS,
        TEMPLATE_FEATURES.FILE_SYSTEM,
        TEMPLATE_FEATURES.COMMANDS
      ],
      documentation: 'Demonstrates the fundamentals of creating an MCP server plugin with file system access. Perfect for beginners learning MCP plugin development.',
      metadata: {
        version: '1.0.0',
        author: 'Lokus Team',
        license: 'MIT',
        keywords: ['mcp', 'file', 'server', 'basic', 'beginner'],
        estimatedTime: '30 minutes',
        prerequisites: ['Basic JavaScript knowledge'],
        learningObjectives: [
          'Understanding MCP server basics',
          'Implementing file system resources',
          'Creating simple tools',
          'Basic plugin architecture'
        ]
      },
      sourceDirectory: 'basic-mcp-server'
    })

    // AI Assistant Example
    this.registerExample({
      id: 'smart-writing-assistant',
      name: 'Smart Writing Assistant',
      description: 'AI-powered writing assistant with chat interface, prompt templates, and intelligent text processing',
      templateType: TEMPLATE_TYPES.AI_ASSISTANT,
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      features: [
        TEMPLATE_FEATURES.MCP_SERVER,
        TEMPLATE_FEATURES.AI_INTEGRATION,
        TEMPLATE_FEATURES.PROMPTS,
        TEMPLATE_FEATURES.TOOLS,
        TEMPLATE_FEATURES.COMMANDS,
        TEMPLATE_FEATURES.PANEL_UI,
        TEMPLATE_FEATURES.SETTINGS_UI,
        TEMPLATE_FEATURES.NETWORK
      ],
      documentation: 'A comprehensive AI assistant plugin that showcases advanced MCP features including AI integration, custom UI panels, and sophisticated prompt handling.',
      metadata: {
        version: '1.0.0',
        author: 'Lokus Team',
        license: 'MIT',
        keywords: ['ai', 'assistant', 'writing', 'chat', 'prompts', 'gpt'],
        estimatedTime: '2-3 hours',
        prerequisites: [
          'JavaScript/TypeScript experience',
          'Understanding of AI APIs',
          'Basic React knowledge (for UI components)'
        ],
        learningObjectives: [
          'AI service integration',
          'Advanced prompt template usage',
          'Custom UI panel development',
          'Secure API key management',
          'Chat interface implementation'
        ],
        externalDependencies: [
          'AI service API (OpenAI/Anthropic)',
          'API key required'
        ]
      },
      sourceDirectory: 'ai-assistant'
    })

    // Data Provider Example
    this.registerExample({
      id: 'database-connector',
      name: 'Database Connector',
      description: 'Connect to databases and provide data access through MCP resources with caching and synchronization',
      templateType: TEMPLATE_TYPES.DATA_PROVIDER,
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      features: [
        TEMPLATE_FEATURES.MCP_SERVER,
        TEMPLATE_FEATURES.DATABASE,
        TEMPLATE_FEATURES.RESOURCES,
        TEMPLATE_FEATURES.TOOLS,
        TEMPLATE_FEATURES.CACHING,
        TEMPLATE_FEATURES.API_CLIENT,
        TEMPLATE_FEATURES.SECURITY
      ],
      documentation: 'Shows how to create a data provider plugin that connects to external databases and APIs, with proper caching and security considerations.',
      metadata: {
        version: '1.0.0',
        author: 'Lokus Team',
        license: 'MIT',
        keywords: ['database', 'data', 'provider', 'cache', 'api', 'sql'],
        estimatedTime: '2-4 hours',
        prerequisites: [
          'Database knowledge (SQL)',
          'Understanding of APIs',
          'Authentication concepts'
        ],
        learningObjectives: [
          'Database integration patterns',
          'Resource caching strategies',
          'Secure credential handling',
          'Data synchronization',
          'Error handling and recovery'
        ],
        externalDependencies: [
          'Database connection',
          'Database credentials'
        ]
      },
      sourceDirectory: 'data-provider',
      status: 'planned' // Not yet implemented
    })

    // Tool Collection Example
    this.registerExample({
      id: 'developer-tools',
      name: 'Developer Tools Collection',
      description: 'A collection of useful development tools including code formatters, validators, and utilities',
      templateType: TEMPLATE_TYPES.TOOL_COLLECTION,
      complexity: TEMPLATE_COMPLEXITY.BEGINNER,
      features: [
        TEMPLATE_FEATURES.MCP_SERVER,
        TEMPLATE_FEATURES.TOOLS,
        TEMPLATE_FEATURES.COMMANDS,
        TEMPLATE_FEATURES.FILE_SYSTEM,
        TEMPLATE_FEATURES.TESTING
      ],
      documentation: 'Demonstrates how to create a collection of utility tools packaged as a single MCP plugin. Great for learning tool development patterns.',
      metadata: {
        version: '1.0.0',
        author: 'Lokus Team',
        license: 'MIT',
        keywords: ['tools', 'utilities', 'development', 'formatter', 'validator'],
        estimatedTime: '1-2 hours',
        prerequisites: [
          'JavaScript knowledge',
          'Understanding of development tools'
        ],
        learningObjectives: [
          'Tool collection architecture',
          'Input validation patterns',
          'Error handling best practices',
          'Tool composition and reuse'
        ]
      },
      sourceDirectory: 'tool-collection',
      status: 'planned'
    })

    // Multi-Server Example
    this.registerExample({
      id: 'enterprise-workspace',
      name: 'Enterprise Workspace Manager',
      description: 'Complex multi-server plugin managing different aspects of an enterprise workspace with coordination and shared state',
      templateType: TEMPLATE_TYPES.MULTI_SERVER,
      complexity: TEMPLATE_COMPLEXITY.ADVANCED,
      features: [
        TEMPLATE_FEATURES.MULTI_SERVER,
        TEMPLATE_FEATURES.STATE_MANAGEMENT,
        TEMPLATE_FEATURES.EVENT_BUS,
        TEMPLATE_FEATURES.SECURITY,
        TEMPLATE_FEATURES.MONITORING,
        TEMPLATE_FEATURES.API_CLIENT,
        TEMPLATE_FEATURES.DATABASE,
        TEMPLATE_FEATURES.CACHING
      ],
      documentation: 'Advanced example showing how to coordinate multiple MCP servers within a single plugin, with shared state management and inter-server communication.',
      metadata: {
        version: '1.0.0',
        author: 'Lokus Team',
        license: 'MIT',
        keywords: ['enterprise', 'multi-server', 'coordination', 'advanced', 'architecture'],
        estimatedTime: '4-6 hours',
        prerequisites: [
          'Advanced JavaScript/TypeScript',
          'Microservices understanding',
          'Event-driven architecture',
          'Security concepts'
        ],
        learningObjectives: [
          'Multi-server coordination',
          'Shared state management',
          'Event bus implementation',
          'Service discovery patterns',
          'Advanced error handling',
          'Performance optimization'
        ]
      },
      sourceDirectory: 'multi-server',
      status: 'planned'
    })

    // Initialize categories
    this.initializeCategories()
  }

  /**
   * Initialize example categories
   */
  initializeCategories() {
    this.categories.set('getting-started', {
      name: 'Getting Started',
      description: 'Simple examples perfect for beginners',
      examples: ['basic-file-server', 'developer-tools'],
      difficulty: TEMPLATE_COMPLEXITY.BEGINNER
    })

    this.categories.set('ai-integration', {
      name: 'AI Integration',
      description: 'Examples showing AI service integration',
      examples: ['smart-writing-assistant'],
      difficulty: TEMPLATE_COMPLEXITY.INTERMEDIATE
    })

    this.categories.set('data-access', {
      name: 'Data Access',
      description: 'Database and API integration examples',
      examples: ['database-connector'],
      difficulty: TEMPLATE_COMPLEXITY.INTERMEDIATE
    })

    this.categories.set('advanced-patterns', {
      name: 'Advanced Patterns',
      description: 'Complex examples for experienced developers',
      examples: ['enterprise-workspace'],
      difficulty: TEMPLATE_COMPLEXITY.ADVANCED
    })
  }

  /**
   * Register a new example project
   */
  registerExample(example) {
    // Validate example structure
    this.validateExample(example)
    
    this.examples.set(example.id, {
      ...example,
      registeredAt: new Date().toISOString()
    })
  }

  /**
   * Validate example project structure
   */
  validateExample(example) {
    const required = ['id', 'name', 'description', 'templateType', 'complexity']
    
    for (const field of required) {
      if (!example[field]) {
        throw new Error(`Example missing required field: ${field}`)
      }
    }

    if (!Object.values(TEMPLATE_TYPES).includes(example.templateType)) {
      throw new Error(`Invalid template type: ${example.templateType}`)
    }

    if (!Object.values(TEMPLATE_COMPLEXITY).includes(example.complexity)) {
      throw new Error(`Invalid complexity: ${example.complexity}`)
    }
  }

  /**
   * Get example by ID
   */
  getExample(id) {
    return this.examples.get(id)
  }

  /**
   * Get examples by template type
   */
  getExamplesByTemplate(templateType) {
    return Array.from(this.examples.values())
      .filter(example => example.templateType === templateType)
  }

  /**
   * Get examples by complexity
   */
  getExamplesByComplexity(complexity) {
    return Array.from(this.examples.values())
      .filter(example => example.complexity === complexity)
  }

  /**
   * Get examples by feature
   */
  getExamplesByFeature(feature) {
    return Array.from(this.examples.values())
      .filter(example => example.features?.includes(feature))
  }

  /**
   * Search examples
   */
  searchExamples(query) {
    const lowerQuery = query.toLowerCase()
    return Array.from(this.examples.values())
      .filter(example => 
        example.name.toLowerCase().includes(lowerQuery) ||
        example.description.toLowerCase().includes(lowerQuery) ||
        example.metadata?.keywords?.some(keyword => 
          keyword.toLowerCase().includes(lowerQuery)
        )
      )
  }

  /**
   * Get examples by category
   */
  getExamplesByCategory(categoryId) {
    const category = this.categories.get(categoryId)
    if (!category) return []

    return category.examples
      .map(id => this.getExample(id))
      .filter(Boolean)
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories.entries())
      .map(([id, info]) => ({ id, ...info }))
  }

  /**
   * List all examples
   */
  listExamples() {
    return Array.from(this.examples.values())
      .sort((a, b) => {
        // Sort by complexity first, then by name
        const complexityOrder = {
          [TEMPLATE_COMPLEXITY.BEGINNER]: 1,
          [TEMPLATE_COMPLEXITY.INTERMEDIATE]: 2,
          [TEMPLATE_COMPLEXITY.ADVANCED]: 3,
          [TEMPLATE_COMPLEXITY.EXPERT]: 4
        }
        
        const complexityDiff = complexityOrder[a.complexity] - complexityOrder[b.complexity]
        if (complexityDiff !== 0) return complexityDiff
        
        return a.name.localeCompare(b.name)
      })
  }

  /**
   * Get available examples (excluding planned ones)
   */
  getAvailableExamples() {
    return this.listExamples()
      .filter(example => example.status !== 'planned')
  }

  /**
   * Download example project to target directory
   */
  async downloadExample(id, targetDirectory) {
    const example = this.getExample(id)
    if (!example) {
      throw new Error(`Example '${id}' not found`)
    }

    if (example.status === 'planned') {
      throw new Error(`Example '${id}' is not yet available`)
    }

    const sourceDirectory = path.join(this.baseDirectory, example.sourceDirectory)
    
    // Check if source directory exists
    try {
      await fs.access(sourceDirectory)
    } catch (error) {
      throw new Error(`Example source directory not found: ${sourceDirectory}`)
    }

    // Copy example files to target directory
    await this.copyDirectory(sourceDirectory, targetDirectory)
    
    // Create example metadata file
    const metadataPath = path.join(targetDirectory, '.lokus-example.json')
    await fs.writeFile(metadataPath, JSON.stringify({
      ...example,
      downloadedAt: new Date().toISOString(),
      sourceDirectory: undefined // Remove internal path
    }, null, 2))
  }

  /**
   * Copy directory recursively
   */
  async copyDirectory(source, target) {
    await fs.mkdir(target, { recursive: true })
    
    const entries = await fs.readdir(source, { withFileTypes: true })
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name)
      const targetPath = path.join(target, entry.name)
      
      if (entry.isDirectory()) {
        await this.copyDirectory(sourcePath, targetPath)
      } else {
        await fs.copyFile(sourcePath, targetPath)
      }
    }
  }

  /**
   * Get example statistics
   */
  getStatistics() {
    const examples = this.listExamples()
    
    const byTemplate = {}
    const byComplexity = {}
    const byFeature = {}
    const byStatus = {}
    
    for (const example of examples) {
      // Count by template type
      byTemplate[example.templateType] = (byTemplate[example.templateType] || 0) + 1
      
      // Count by complexity
      byComplexity[example.complexity] = (byComplexity[example.complexity] || 0) + 1
      
      // Count by status
      byStatus[example.status || 'available'] = (byStatus[example.status || 'available'] || 0) + 1
      
      // Count by features
      if (example.features) {
        for (const feature of example.features) {
          byFeature[feature] = (byFeature[feature] || 0) + 1
        }
      }
    }
    
    return {
      total: examples.length,
      available: examples.filter(e => e.status !== 'planned').length,
      planned: examples.filter(e => e.status === 'planned').length,
      byTemplate,
      byComplexity,
      byFeature,
      byStatus,
      popularFeatures: Object.entries(byFeature)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([feature, count]) => ({ feature, count }))
    }
  }

  /**
   * Validate example project files
   */
  async validateExampleFiles(exampleId) {
    const example = this.getExample(exampleId)
    if (!example) {
      throw new Error(`Example '${exampleId}' not found`)
    }

    const sourceDirectory = path.join(this.baseDirectory, example.sourceDirectory)
    const errors = []
    const warnings = []

    try {
      // Check if directory exists
      await fs.access(sourceDirectory)

      // Check for required files
      const requiredFiles = ['plugin.json', 'README.md']
      
      for (const file of requiredFiles) {
        const filePath = path.join(sourceDirectory, file)
        try {
          await fs.access(filePath)
        } catch (error) {
          errors.push(`Missing required file: ${file}`)
        }
      }

      // Validate plugin.json if it exists
      const manifestPath = path.join(sourceDirectory, 'plugin.json')
      try {
        const manifestContent = await fs.readFile(manifestPath, 'utf8')
        const manifest = JSON.parse(manifestContent)
        
        if (!manifest.id) errors.push('plugin.json missing id field')
        if (!manifest.name) errors.push('plugin.json missing name field')
        if (!manifest.version) errors.push('plugin.json missing version field')
        
      } catch (error) {
        errors.push(`Invalid plugin.json: ${error.message}`)
      }

    } catch (error) {
      errors.push(`Example directory not accessible: ${error.message}`)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }
}

/**
 * Default example registry instance
 */
export const defaultExampleRegistry = new ExampleProjectRegistry()

/**
 * Initialize default registry
 */
export async function initializeExampleRegistry() {
  await defaultExampleRegistry.initialize()
  return defaultExampleRegistry
}

export default ExampleProjectRegistry