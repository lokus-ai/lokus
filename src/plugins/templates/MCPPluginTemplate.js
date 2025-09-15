/**
 * MCP Plugin Template Generator
 * 
 * Provides developer-friendly templates for creating MCP-enabled plugins
 * Supports multiple template types and customization options
 */

import { TemplateConfig, TEMPLATE_TYPES, TEMPLATE_CATEGORIES } from './TemplateConfig.js'
import { MANIFEST_VERSION_2 } from '../manifest/ManifestV2.js'
import { MCP_PROTOCOL_VERSION } from '../mcp/MCPProtocol.js'

/**
 * MCP Plugin Template Generator Class
 */
export class MCPPluginTemplateGenerator {
  constructor() {
    this.config = new TemplateConfig()
    this.templates = new Map()
    this.defaultOptions = {
      useTypeScript: false,
      includeTests: true,
      includeDocumentation: true,
      includeBuildConfig: true,
      mcpVersion: MCP_PROTOCOL_VERSION,
      manifestVersion: MANIFEST_VERSION_2,
      lokusVersion: '^1.0.0'
    }
    
    this.initializeBuiltInTemplates()
  }

  /**
   * Initialize built-in template definitions
   */
  initializeBuiltInTemplates() {
    // Basic MCP Server Template
    this.registerTemplate(TEMPLATE_TYPES.BASIC_MCP_SERVER, {
      name: 'Basic MCP Server',
      description: 'Simple MCP server plugin providing resources and tools',
      category: TEMPLATE_CATEGORIES.BASIC,
      files: this.getBasicMCPServerFiles(),
      customization: {
        serverName: { type: 'string', required: true, default: 'my-server' },
        includeResources: { type: 'boolean', default: true },
        includeTools: { type: 'boolean', default: true },
        includePrompts: { type: 'boolean', default: false }
      }
    })

    // AI Assistant Plugin Template
    this.registerTemplate(TEMPLATE_TYPES.AI_ASSISTANT, {
      name: 'AI Assistant Plugin',
      description: 'AI-powered assistant with chat interface and prompts',
      category: TEMPLATE_CATEGORIES.AI_INTEGRATION,
      files: this.getAIAssistantFiles(),
      customization: {
        assistantName: { type: 'string', required: true, default: 'AI Assistant' },
        includeChat: { type: 'boolean', default: true },
        includePromptLibrary: { type: 'boolean', default: true },
        includeKnowledgeBase: { type: 'boolean', default: false },
        aiProvider: { 
          type: 'enum', 
          options: ['openai', 'anthropic', 'local', 'custom'], 
          default: 'openai' 
        }
      }
    })

    // Data Provider Template
    this.registerTemplate(TEMPLATE_TYPES.DATA_PROVIDER, {
      name: 'Data Provider Plugin',
      description: 'Database and API resource provider with caching',
      category: TEMPLATE_CATEGORIES.DATA_ACCESS,
      files: this.getDataProviderFiles(),
      customization: {
        dataSource: { 
          type: 'enum', 
          options: ['database', 'api', 'file', 'memory'], 
          default: 'database' 
        },
        includeCache: { type: 'boolean', default: true },
        includeSync: { type: 'boolean', default: false },
        authRequired: { type: 'boolean', default: false }
      }
    })

    // Tool Collection Template
    this.registerTemplate(TEMPLATE_TYPES.TOOL_COLLECTION, {
      name: 'Tool Collection Plugin',
      description: 'Collection of utility tools and functions',
      category: TEMPLATE_CATEGORIES.UTILITIES,
      files: this.getToolCollectionFiles(),
      customization: {
        toolCategory: { 
          type: 'enum', 
          options: ['text', 'file', 'data', 'dev', 'system', 'misc'], 
          default: 'misc' 
        },
        includeAsync: { type: 'boolean', default: true },
        includeValidation: { type: 'boolean', default: true },
        includeErrorHandling: { type: 'boolean', default: true }
      }
    })

    // Multi-Server Plugin Template
    this.registerTemplate(TEMPLATE_TYPES.MULTI_SERVER, {
      name: 'Multi-Server Plugin',
      description: 'Complex plugin with multiple MCP servers and coordination',
      category: TEMPLATE_CATEGORIES.ADVANCED,
      files: this.getMultiServerFiles(),
      customization: {
        serverCount: { type: 'number', min: 2, max: 5, default: 2 },
        includeCoordination: { type: 'boolean', default: true },
        includeSharedState: { type: 'boolean', default: false },
        includeEventBus: { type: 'boolean', default: true }
      }
    })
  }

  /**
   * Register a new template
   */
  registerTemplate(type, template) {
    this.templates.set(type, {
      ...template,
      type,
      id: `template-${type}`,
      createdAt: new Date().toISOString()
    })
  }

  /**
   * Get available templates
   */
  getAvailableTemplates() {
    return Array.from(this.templates.values())
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return this.getAvailableTemplates().filter(template => template.category === category)
  }

  /**
   * Get template by type
   */
  getTemplate(type) {
    return this.templates.get(type)
  }

  /**
   * Generate plugin from template
   */
  async generatePlugin(templateType, options = {}) {
    const template = this.getTemplate(templateType)
    if (!template) {
      throw new Error(`Template type "${templateType}" not found`)
    }

    const finalOptions = {
      ...this.defaultOptions,
      ...options
    }

    // Validate required customization options
    this.validateCustomizationOptions(template, finalOptions)

    // Generate plugin structure
    const pluginStructure = {
      metadata: this.generateMetadata(template, finalOptions),
      files: await this.generateFiles(template, finalOptions),
      manifest: this.generateManifest(template, finalOptions),
      documentation: this.generateDocumentation(template, finalOptions),
      buildConfig: finalOptions.includeBuildConfig ? this.generateBuildConfig(template, finalOptions) : null
    }

    return pluginStructure
  }

  /**
   * Validate customization options
   */
  validateCustomizationOptions(template, options) {
    if (!template.customization) return

    for (const [key, config] of Object.entries(template.customization)) {
      const value = options[key]
      
      if (config.required && (value === undefined || value === null)) {
        throw new Error(`Required customization option "${key}" is missing`)
      }

      if (value !== undefined) {
        if (config.type === 'number') {
          if (typeof value !== 'number') {
            throw new Error(`Customization option "${key}" must be a number`)
          }
          if (config.min !== undefined && value < config.min) {
            throw new Error(`Customization option "${key}" must be >= ${config.min}`)
          }
          if (config.max !== undefined && value > config.max) {
            throw new Error(`Customization option "${key}" must be <= ${config.max}`)
          }
        } else if (config.type === 'enum') {
          if (!config.options.includes(value)) {
            throw new Error(`Customization option "${key}" must be one of: ${config.options.join(', ')}`)
          }
        } else if (config.type === 'boolean') {
          if (typeof value !== 'boolean') {
            throw new Error(`Customization option "${key}" must be a boolean`)
          }
        }
      }
    }
  }

  /**
   * Generate plugin metadata
   */
  generateMetadata(template, options) {
    return {
      templateType: template.type,
      templateName: template.name,
      templateVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      generatorVersion: '1.0.0',
      lokusVersion: options.lokusVersion,
      mcpVersion: options.mcpVersion,
      useTypeScript: options.useTypeScript,
      options: this.extractCustomizationOptions(template, options)
    }
  }

  /**
   * Extract customization options from full options
   */
  extractCustomizationOptions(template, options) {
    if (!template.customization) return {}

    const customOptions = {}
    for (const key of Object.keys(template.customization)) {
      if (options[key] !== undefined) {
        customOptions[key] = options[key]
      }
    }
    return customOptions
  }

  /**
   * Generate files for the plugin
   */
  async generateFiles(template, options) {
    const files = new Map()
    
    for (const [path, fileTemplate] of Object.entries(template.files)) {
      const content = await this.generateFileContent(fileTemplate, options)
      const finalPath = this.processTemplatePath(path, options)
      files.set(finalPath, content)
    }

    // Add common files
    if (options.includeTests) {
      const testFiles = this.generateTestFiles(template, options)
      for (const [path, content] of Object.entries(testFiles)) {
        files.set(path, content)
      }
    }

    if (options.includeDocumentation) {
      files.set('README.md', this.generateReadme(template, options))
      files.set('CHANGELOG.md', this.generateChangelog(template, options))
    }

    return files
  }

  /**
   * Generate file content from template
   */
  async generateFileContent(fileTemplate, options) {
    if (typeof fileTemplate === 'string') {
      return this.processTemplate(fileTemplate, options)
    }

    if (typeof fileTemplate === 'function') {
      return await fileTemplate(options)
    }

    if (fileTemplate.content) {
      const content = typeof fileTemplate.content === 'function' 
        ? await fileTemplate.content(options)
        : fileTemplate.content
      
      return this.processTemplate(content, options)
    }

    throw new Error('Invalid file template format')
  }

  /**
   * Process template string with variable substitution
   */
  processTemplate(template, options) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedProperty(options, key)
      return value !== undefined ? String(value) : match
    })
  }

  /**
   * Process template path with variable substitution
   */
  processTemplatePath(path, options) {
    let processedPath = this.processTemplate(path, options)
    
    // Handle TypeScript/JavaScript file extensions
    if (options.useTypeScript) {
      processedPath = processedPath.replace(/\.js$/, '.ts')
      processedPath = processedPath.replace(/\.jsx$/, '.tsx')
    }
    
    return processedPath
  }

  /**
   * Get nested property from object using dot notation
   */
  getNestedProperty(obj, path) {
    return path.split('.').reduce((current, prop) => current?.[prop], obj)
  }

  /**
   * Generate plugin manifest
   */
  generateManifest(template, options) {
    const customOptions = this.extractCustomizationOptions(template, options)
    
    const manifest = {
      manifest: options.manifestVersion,
      id: options.pluginId || 'my-mcp-plugin',
      name: options.pluginName || 'My MCP Plugin',
      displayName: options.displayName || options.pluginName || 'My MCP Plugin',
      version: options.version || '1.0.0',
      description: options.description || template.description,
      publisher: options.publisher || 'your-publisher',
      author: options.author || 'Your Name',
      license: options.license || 'MIT',
      engines: {
        lokus: options.lokusVersion
      },
      main: options.useTypeScript ? './dist/index.js' : './src/index.js',
      activationEvents: this.generateActivationEvents(template, customOptions),
      contributes: this.generateContributions(template, customOptions),
      capabilities: this.generateCapabilities(template, customOptions),
      permissions: this.generatePermissions(template, customOptions),
      categories: this.generateCategories(template, customOptions),
      keywords: this.generateKeywords(template, customOptions),
      mcp: this.generateMCPConfig(template, customOptions)
    }

    return manifest
  }

  /**
   * Generate activation events for manifest
   */
  generateActivationEvents(template, options) {
    const events = ['onStartup']
    
    switch (template.type) {
      case TEMPLATE_TYPES.BASIC_MCP_SERVER:
        events.push(`onMCPServer:${options.serverName || 'my-server'}`)
        break
      case TEMPLATE_TYPES.AI_ASSISTANT:
        events.push('onCommand:ai.chat', 'onCommand:ai.help')
        break
      case TEMPLATE_TYPES.DATA_PROVIDER:
        events.push('onCommand:data.refresh', 'onFileSystem:')
        break
      case TEMPLATE_TYPES.TOOL_COLLECTION:
        events.push('onCommand:tools.list', 'onLanguage:')
        break
      case TEMPLATE_TYPES.MULTI_SERVER:
        events.push('onCommand:multi.status', 'onMCPServer:*')
        break
    }
    
    return events
  }

  /**
   * Generate contributions for manifest
   */
  generateContributions(template, options) {
    const contributions = {
      commands: [],
      mcp: {
        servers: [],
        resources: [],
        tools: [],
        prompts: []
      }
    }

    switch (template.type) {
      case TEMPLATE_TYPES.BASIC_MCP_SERVER:
        contributions.commands.push({
          command: 'basicMcp.status',
          title: 'Show MCP Server Status'
        })
        
        contributions.mcp.servers.push({
          id: options.serverName || 'my-server',
          name: options.serverName || 'My Server',
          description: 'Basic MCP server'
        })
        
        if (options.includeResources) {
          contributions.mcp.resources.push({
            name: 'basic-resource',
            description: 'Basic resource',
            pattern: 'basic://**',
            type: 'text'
          })
        }
        
        if (options.includeTools) {
          contributions.mcp.tools.push({
            name: 'basic_tool',
            description: 'Basic tool',
            inputSchema: {
              type: 'object',
              properties: {
                input: { type: 'string' }
              }
            }
          })
        }
        break

      case TEMPLATE_TYPES.AI_ASSISTANT:
        contributions.commands.push({
          command: 'ai.chat',
          title: 'Start AI Chat'
        }, {
          command: 'ai.help',
          title: 'AI Help'
        })
        
        contributions.mcp.prompts.push({
          name: 'ai_chat',
          description: 'AI chat prompt',
          template: 'Chat with AI assistant: {{message}}',
          arguments: [
            { name: 'message', required: true, type: 'string' }
          ]
        })
        break

      case TEMPLATE_TYPES.DATA_PROVIDER:
        contributions.commands.push({
          command: 'data.refresh',
          title: 'Refresh Data'
        })
        
        contributions.mcp.resources.push({
          name: 'data-source',
          description: 'Data source',
          pattern: 'data://**',
          type: 'data'
        })
        break

      case TEMPLATE_TYPES.TOOL_COLLECTION:
        contributions.commands.push({
          command: 'tools.list',
          title: 'List Available Tools'
        })
        
        contributions.mcp.tools.push({
          name: 'utility_tool',
          description: 'Utility tool',
          inputSchema: {
            type: 'object',
            properties: {
              operation: { type: 'string' },
              input: { type: 'string' }
            }
          }
        })
        break
    }

    return contributions
  }

  /**
   * Generate capabilities for manifest
   */
  generateCapabilities(template, options) {
    return {
      untrustedWorkspaces: {
        supported: false
      },
      virtualWorkspaces: {
        supported: true
      }
    }
  }

  /**
   * Generate permissions for manifest
   */
  generatePermissions(template, options) {
    const permissions = ['mcp:serve', 'mcp:client']
    
    switch (template.type) {
      case TEMPLATE_TYPES.DATA_PROVIDER:
        permissions.push('read_files', 'network_access')
        if (options.authRequired) {
          permissions.push('secure_storage')
        }
        break
      case TEMPLATE_TYPES.AI_ASSISTANT:
        permissions.push('network_access', 'secure_storage')
        break
      case TEMPLATE_TYPES.TOOL_COLLECTION:
        permissions.push('read_files', 'write_files')
        break
    }
    
    return permissions
  }

  /**
   * Generate categories for manifest
   */
  generateCategories(template, options) {
    const categories = ['MCP Plugin']
    
    switch (template.type) {
      case TEMPLATE_TYPES.AI_ASSISTANT:
        categories.push('AI & ML', 'Assistant')
        break
      case TEMPLATE_TYPES.DATA_PROVIDER:
        categories.push('Data Provider', 'Integration')
        break
      case TEMPLATE_TYPES.TOOL_COLLECTION:
        categories.push('Tools', 'Utilities')
        break
      case TEMPLATE_TYPES.MULTI_SERVER:
        categories.push('Advanced', 'Framework')
        break
    }
    
    return categories
  }

  /**
   * Generate keywords for manifest
   */
  generateKeywords(template, options) {
    const keywords = ['mcp', 'plugin', 'lokus']
    
    switch (template.type) {
      case TEMPLATE_TYPES.AI_ASSISTANT:
        keywords.push('ai', 'assistant', 'chat', 'llm')
        break
      case TEMPLATE_TYPES.DATA_PROVIDER:
        keywords.push('data', 'api', 'database', 'provider')
        break
      case TEMPLATE_TYPES.TOOL_COLLECTION:
        keywords.push('tools', 'utilities', 'functions')
        break
    }
    
    return keywords
  }

  /**
   * Generate MCP configuration for manifest
   */
  generateMCPConfig(template, options) {
    return {
      type: 'mcp-server',
      version: options.mcpVersion,
      capabilities: {
        resources: {
          subscribe: true,
          listChanged: true
        },
        tools: {
          listChanged: true
        },
        prompts: {
          listChanged: true
        },
        logging: {
          enabled: true
        }
      },
      enableResourceSubscriptions: true,
      enableToolExecution: true,
      enablePromptTemplates: true,
      memoryLimit: 50 * 1024 * 1024, // 50MB
      cpuTimeLimit: 5000, // 5 seconds
      maxApiCalls: 1000
    }
  }

  /**
   * Generate test files
   */
  generateTestFiles(template, options) {
    const testFiles = {}
    const ext = options.useTypeScript ? 'ts' : 'js'
    
    testFiles[`tests/unit/plugin.test.${ext}`] = this.generateUnitTestContent(template, options)
    testFiles[`tests/integration/mcp.test.${ext}`] = this.generateIntegrationTestContent(template, options)
    testFiles[`tests/setup.${ext}`] = this.generateTestSetupContent(template, options)
    
    return testFiles
  }

  /**
   * Generate build configuration
   */
  generateBuildConfig(template, options) {
    const configs = {}
    
    if (options.useTypeScript) {
      configs['tsconfig.json'] = this.generateTSConfig(template, options)
      configs['tsconfig.build.json'] = this.generateTSBuildConfig(template, options)
    }
    
    configs['package.json'] = this.generatePackageJson(template, options)
    configs['.gitignore'] = this.generateGitignore(template, options)
    configs['.eslintrc.json'] = this.generateESLintConfig(template, options)
    
    return configs
  }

  /**
   * Generate documentation
   */
  generateDocumentation(template, options) {
    return {
      'README.md': this.generateReadme(template, options),
      'CHANGELOG.md': this.generateChangelog(template, options),
      'docs/API.md': this.generateAPIDocumentation(template, options),
      'docs/DEVELOPMENT.md': this.generateDevelopmentGuide(template, options),
      'docs/DEPLOYMENT.md': this.generateDeploymentGuide(template, options)
    }
  }

  // File template definitions for different plugin types
  getBasicMCPServerFiles() {
    return {
      'src/index.{{useTypeScript ? "ts" : "js"}}': this.getBasicMCPServerMainFile(),
      'src/server.{{useTypeScript ? "ts" : "js"}}': this.getBasicMCPServerFile(),
      'src/resources.{{useTypeScript ? "ts" : "js"}}': this.getBasicResourcesFile(),
      'src/tools.{{useTypeScript ? "ts" : "js"}}': this.getBasicToolsFile()
    }
  }

  getAIAssistantFiles() {
    return {
      'src/index.{{useTypeScript ? "ts" : "js"}}': this.getAIAssistantMainFile(),
      'src/assistant.{{useTypeScript ? "ts" : "js"}}': this.getAIAssistantFile(),
      'src/chat.{{useTypeScript ? "ts" : "js"}}': this.getChatHandlerFile(),
      'src/prompts.{{useTypeScript ? "ts" : "js"}}': this.getPromptsFile()
    }
  }

  getDataProviderFiles() {
    return {
      'src/index.{{useTypeScript ? "ts" : "js"}}': this.getDataProviderMainFile(),
      'src/provider.{{useTypeScript ? "ts" : "js"}}': this.getDataProviderFile(),
      'src/cache.{{useTypeScript ? "ts" : "js"}}': this.getCacheFile(),
      'src/resources.{{useTypeScript ? "ts" : "js"}}': this.getDataResourcesFile()
    }
  }

  getToolCollectionFiles() {
    return {
      'src/index.{{useTypeScript ? "ts" : "js"}}': this.getToolCollectionMainFile(),
      'src/tools/{{toolCategory}}.{{useTypeScript ? "ts" : "js"}}': this.getToolCategoryFile(),
      'src/utils.{{useTypeScript ? "ts" : "js"}}': this.getUtilsFile(),
      'src/validators.{{useTypeScript ? "ts" : "js"}}': this.getValidatorsFile()
    }
  }

  getMultiServerFiles() {
    return {
      'src/index.{{useTypeScript ? "ts" : "js"}}': this.getMultiServerMainFile(),
      'src/coordinator.{{useTypeScript ? "ts" : "js"}}': this.getCoordinatorFile(),
      'src/servers/server1.{{useTypeScript ? "ts" : "js"}}': this.getServer1File(),
      'src/servers/server2.{{useTypeScript ? "ts" : "js"}}': this.getServer2File(),
      'src/shared/state.{{useTypeScript ? "ts" : "js"}}': this.getSharedStateFile()
    }
  }

  // File content generators (basic implementations)
  getBasicMCPServerMainFile() {
    return `/**
 * Basic MCP Server Plugin - Main Entry Point
 */

import { BasePlugin } from '@lokus/plugin-core'
import { MCPResourceBuilder, MCPToolBuilder } from '@lokus/mcp'
import { BasicMCPServer } from './server.js'

export class {{pluginName || 'BasicMCPPlugin'}} extends BasePlugin {
  constructor() {
    super()
    this.server = null
  }

  async activate() {
    await super.activate()
    
    this.server = new BasicMCPServer()
    await this.server.initialize(this.api)
    
    this.logger.info('{{pluginName || "BasicMCPPlugin"}} activated')
  }

  async deactivate() {
    if (this.server) {
      await this.server.shutdown()
      this.server = null
    }
    
    await super.deactivate()
  }
}

export default {{pluginName || 'BasicMCPPlugin'}}`
  }

  getBasicMCPServerFile() {
    return `/**
 * Basic MCP Server Implementation
 */

import { MCPResourceBuilder, MCPToolBuilder } from '@lokus/mcp'

export class BasicMCPServer {
  constructor() {
    this.api = null
    this.resources = new Map()
    this.tools = new Map()
  }

  async initialize(api) {
    this.api = api
    
    {{#if includeResources}}
    await this.registerResources()
    {{/if}}
    
    {{#if includeTools}}
    await this.registerTools()
    {{/if}}
  }

  {{#if includeResources}}
  async registerResources() {
    const resource = new MCPResourceBuilder()
      .setUri('{{serverName || "my-server"}}://example')
      .setName('Example Resource')
      .setDescription('Example resource from {{serverName || "my-server"}}')
      .setType('text')
      .setContent('Hello from {{serverName || "my-server"}}!')
      .build()
    
    this.api.registerResource(resource)
    this.resources.set(resource.uri, resource)
  }
  {{/if}}

  {{#if includeTools}}
  async registerTools() {
    const tool = new MCPToolBuilder()
      .setName('{{serverName || "my_server"}}_echo')
      .setDescription('Echo input text')
      .setInputSchema({
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Text to echo' }
        },
        required: ['text']
      })
      .setExecutor(async (args) => {
        return { output: \`Echo: \${args.text}\` }
      })
      .build()
    
    this.api.registerTool(tool)
    this.tools.set(tool.name, tool)
  }
  {{/if}}

  async shutdown() {
    this.resources.clear()
    this.tools.clear()
    this.api = null
  }
}`
  }

  getBasicResourcesFile() {
    return `/**
 * Resource definitions for Basic MCP Server
 */

export const resourceDefinitions = {
  // Add your resource definitions here
}`
  }

  getBasicToolsFile() {
    return `/**
 * Tool definitions for Basic MCP Server
 */

export const toolDefinitions = {
  // Add your tool definitions here
}`
  }

  // Additional file content generators would be implemented here...
  // For brevity, I'm including placeholders for the remaining methods

  getAIAssistantMainFile() {
    return `// AI Assistant main file content...`
  }

  getAIAssistantFile() {
    return `// AI Assistant implementation...`
  }

  getChatHandlerFile() {
    return `// Chat handler implementation...`
  }

  getPromptsFile() {
    return `// Prompts implementation...`
  }

  getDataProviderMainFile() {
    return `// Data Provider main file...`
  }

  getDataProviderFile() {
    return `// Data Provider implementation...`
  }

  getCacheFile() {
    return `// Cache implementation...`
  }

  getDataResourcesFile() {
    return `// Data resources implementation...`
  }

  getToolCollectionMainFile() {
    return `// Tool Collection main file...`
  }

  getToolCategoryFile() {
    return `// Tool category implementation...`
  }

  getUtilsFile() {
    return `// Utilities implementation...`
  }

  getValidatorsFile() {
    return `// Validators implementation...`
  }

  getMultiServerMainFile() {
    return `// Multi-Server main file...`
  }

  getCoordinatorFile() {
    return `// Coordinator implementation...`
  }

  getServer1File() {
    return `// Server 1 implementation...`
  }

  getServer2File() {
    return `// Server 2 implementation...`
  }

  getSharedStateFile() {
    return `// Shared state implementation...`
  }

  generateUnitTestContent(template, options) {
    return `// Unit test content for ${template.name}...`
  }

  generateIntegrationTestContent(template, options) {
    return `// Integration test content for ${template.name}...`
  }

  generateTestSetupContent(template, options) {
    return `// Test setup content...`
  }

  generateTSConfig(template, options) {
    return JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        module: "ESNext",
        moduleResolution: "node",
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        outDir: "./dist",
        rootDir: "./src"
      },
      include: ["src/**/*"],
      exclude: ["node_modules", "dist", "tests"]
    }, null, 2)
  }

  generateTSBuildConfig(template, options) {
    return JSON.stringify({
      extends: "./tsconfig.json",
      exclude: ["**/*.test.ts", "**/*.spec.ts", "tests/**/*"]
    }, null, 2)
  }

  generatePackageJson(template, options) {
    return JSON.stringify({
      name: options.pluginId || 'my-mcp-plugin',
      version: options.version || '1.0.0',
      description: options.description || template.description,
      main: options.useTypeScript ? './dist/index.js' : './src/index.js',
      scripts: {
        build: options.useTypeScript ? 'tsc -p tsconfig.build.json' : 'echo "No build step required"',
        test: 'jest',
        lint: 'eslint src/',
        dev: 'npm run build && lokus-plugin dev'
      },
      dependencies: {
        '@lokus/plugin-core': '^1.0.0',
        '@lokus/mcp': '^1.0.0'
      },
      devDependencies: options.useTypeScript ? {
        typescript: '^5.0.0',
        '@types/node': '^20.0.0',
        jest: '^29.0.0',
        eslint: '^8.0.0'
      } : {
        jest: '^29.0.0',
        eslint: '^8.0.0'
      }
    }, null, 2)
  }

  generateGitignore(template, options) {
    return `node_modules/
dist/
*.log
.env
.env.local
.DS_Store
coverage/
.nyc_output/`
  }

  generateESLintConfig(template, options) {
    return JSON.stringify({
      extends: ['eslint:recommended'],
      env: {
        node: true,
        es2022: true
      },
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module'
      }
    }, null, 2)
  }

  generateReadme(template, options) {
    return `# ${options.pluginName || 'My MCP Plugin'}

${options.description || template.description}

## Generated from Template

This plugin was generated using the **${template.name}** template.

## Installation

\`\`\`bash
npm install
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm test
\`\`\`

## Build

\`\`\`bash
npm run build
\`\`\``
  }

  generateChangelog(template, options) {
    return `# Changelog

## [1.0.0] - ${new Date().toISOString().split('T')[0]}

### Added
- Initial plugin implementation
- Generated from ${template.name} template`
  }

  generateAPIDocumentation(template, options) {
    return `# API Documentation

Documentation for ${options.pluginName || 'My MCP Plugin'}.

## Overview

This plugin provides...

## Resources

## Tools

## Prompts`
  }

  generateDevelopmentGuide(template, options) {
    return `# Development Guide

Guide for developing and extending this plugin.

## Setup

## Architecture

## Testing

## Deployment`
  }

  generateDeploymentGuide(template, options) {
    return `# Deployment Guide

Instructions for deploying this plugin.

## Prerequisites

## Installation

## Configuration`
  }
}

/**
 * Default template generator instance
 */
export const defaultTemplateGenerator = new MCPPluginTemplateGenerator()

/**
 * Generate plugin from template (convenience function)
 */
export async function generateMCPPlugin(templateType, options = {}) {
  return await defaultTemplateGenerator.generatePlugin(templateType, options)
}

/**
 * Get available templates (convenience function)
 */
export function getAvailableMCPTemplates() {
  return defaultTemplateGenerator.getAvailableTemplates()
}

export default MCPPluginTemplateGenerator