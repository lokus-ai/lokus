/**
 * TypeScript definitions for MCP Plugin Templates
 */

export type TemplateType = 
  | 'basic-mcp-server'
  | 'ai-assistant'
  | 'data-provider'
  | 'tool-collection'
  | 'multi-server'

export type TemplateCategory = 
  | 'basic'
  | 'ai-integration'
  | 'data-access'
  | 'utilities'
  | 'advanced'
  | 'custom'

export type TemplateComplexity = 
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'expert'

export type SupportedLanguage = 
  | 'javascript'
  | 'typescript'

export type TemplateFeature = 
  // Core features
  | 'mcp-server'
  | 'mcp-client'
  | 'resources'
  | 'tools'
  | 'prompts'
  // Integration features
  | 'ai-integration'
  | 'database'
  | 'api-client'
  | 'file-system'
  | 'network'
  // UI features
  | 'settings-ui'
  | 'panel-ui'
  | 'toolbar'
  | 'commands'
  // Development features
  | 'typescript'
  | 'testing'
  | 'documentation'
  | 'build-config'
  | 'linting'
  // Advanced features
  | 'multi-server'
  | 'state-management'
  | 'event-bus'
  | 'caching'
  | 'security'
  | 'monitoring'

export type CustomizationType = 
  | 'string'
  | 'number'
  | 'boolean'
  | 'enum'
  | 'array'
  | 'object'

export interface CustomizationValidation {
  min?: number
  max?: number
  pattern?: string
  options?: string[]
}

export interface CustomizationOption {
  type: CustomizationType
  required?: boolean
  default?: any
  description?: string
  validation?: CustomizationValidation
}

export interface TemplateAuthor {
  name: string
  email?: string
  url?: string
}

export interface TemplateDependencies {
  runtime?: Record<string, string>
  development?: Record<string, string>
  peer?: Record<string, string>
  lokus?: Record<string, string>
}

export interface TemplateFileConfig {
  content: string
  template?: boolean
  executable?: boolean
  encoding?: string
}

export type TemplateFile = string | TemplateFileConfig | ((options: TemplateGenerationOptions) => string | Promise<string>)

export interface TemplateHooks {
  preGenerate?: string
  postGenerate?: string
  preValidate?: string
  postValidate?: string
}

export interface TemplateMetadata {
  tags?: string[]
  keywords?: string[]
  icon?: string
  gallery?: string[]
  documentation?: string
  repository?: string
  homepage?: string
  issues?: string
}

export interface TemplateConfiguration {
  id: string
  name: string
  description: string
  category: TemplateCategory
  complexity?: TemplateComplexity
  features?: TemplateFeature[]
  language?: SupportedLanguage
  version: string
  author?: TemplateAuthor
  license?: string
  customization?: Record<string, CustomizationOption>
  files: Record<string, TemplateFile>
  dependencies?: TemplateDependencies
  scripts?: Record<string, string>
  hooks?: TemplateHooks
  metadata?: TemplateMetadata
  registeredAt?: string
}

export interface CategoryInfo {
  name: string
  description: string
  complexity: TemplateComplexity
  icon: string
  features: TemplateFeature[]
}

export interface ValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

export interface ValidatorFunction {
  (value: any): {
    valid: boolean
    message?: string
  }
}

export interface TemplateGenerationOptions {
  // Core plugin information
  pluginId: string
  pluginName: string
  displayName?: string
  version?: string
  description?: string
  publisher?: string
  author?: string
  email?: string
  license?: string
  
  // Template configuration
  useTypeScript?: boolean
  includeTests?: boolean
  includeDocumentation?: boolean
  includeBuildConfig?: boolean
  mcpVersion?: string
  manifestVersion?: string
  lokusVersion?: string
  
  // Template-specific customization options
  [key: string]: any
}

export interface GeneratedFile {
  path: string
  content: string
  encoding?: string
  executable?: boolean
}

export interface PluginMetadata {
  templateType: TemplateType
  templateName: string
  templateVersion: string
  generatedAt: string
  generatorVersion: string
  lokusVersion: string
  mcpVersion: string
  useTypeScript: boolean
  options: Record<string, any>
}

export interface PluginManifest {
  manifest: string
  id: string
  name: string
  displayName: string
  version: string
  description: string
  publisher: string
  author: string
  license: string
  engines: {
    lokus: string
  }
  main: string
  activationEvents: string[]
  contributes: {
    commands?: Array<{
      command: string
      title: string
      category?: string
      icon?: string
    }>
    mcp?: {
      servers?: Array<{
        id: string
        name: string
        description: string
      }>
      resources?: Array<{
        name: string
        description: string
        pattern: string
        type: string
        mimeType?: string
      }>
      tools?: Array<{
        name: string
        description: string
        inputSchema: any
        handler?: string
      }>
      prompts?: Array<{
        name: string
        description: string
        template: string
        arguments: Array<{
          name: string
          required: boolean
          type: string
          default?: any
        }>
      }>
    }
    [key: string]: any
  }
  capabilities: {
    untrustedWorkspaces?: {
      supported: boolean
    }
    virtualWorkspaces?: {
      supported: boolean
    }
  }
  permissions: string[]
  categories: string[]
  keywords: string[]
  mcp: {
    type: string
    version: string
    capabilities: {
      resources: {
        subscribe: boolean
        listChanged: boolean
      }
      tools: {
        listChanged: boolean
      }
      prompts: {
        listChanged: boolean
      }
      logging: {
        enabled: boolean
      }
    }
    enableResourceSubscriptions: boolean
    enableToolExecution: boolean
    enablePromptTemplates: boolean
    memoryLimit: number
    cpuTimeLimit: number
    maxApiCalls: number
  }
}

export interface PluginDocumentation {
  'README.md': string
  'CHANGELOG.md': string
  'docs/API.md': string
  'docs/DEVELOPMENT.md': string
  'docs/DEPLOYMENT.md': string
}

export interface BuildConfiguration {
  'package.json': string
  'tsconfig.json'?: string
  'tsconfig.build.json'?: string
  '.gitignore': string
  '.eslintrc.json': string
}

export interface GeneratedPluginStructure {
  metadata: PluginMetadata
  files: Map<string, string>
  manifest: PluginManifest
  documentation: PluginDocumentation
  buildConfig?: BuildConfiguration
}

export interface TemplateStatistics {
  total: number
  categories: Record<string, number>
  complexities: Record<string, number>
  features: Record<string, number>
  popularFeatures: Array<{
    feature: string
    count: number
  }>
}

export interface SearchFilter {
  category?: TemplateCategory
  complexity?: TemplateComplexity
  features?: TemplateFeature[]
  language?: SupportedLanguage
}

export interface MCPPluginTemplateGenerator {
  /**
   * Register a new template
   */
  registerTemplate(type: TemplateType, template: TemplateConfiguration): void
  
  /**
   * Get available templates
   */
  getAvailableTemplates(): TemplateConfiguration[]
  
  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): TemplateConfiguration[]
  
  /**
   * Get template by type
   */
  getTemplate(type: TemplateType): TemplateConfiguration | undefined
  
  /**
   * Generate plugin from template
   */
  generatePlugin(templateType: TemplateType, options: TemplateGenerationOptions): Promise<GeneratedPluginStructure>
  
  /**
   * Validate customization options
   */
  validateCustomizationOptions(template: TemplateConfiguration, options: TemplateGenerationOptions): void
  
  /**
   * Generate plugin metadata
   */
  generateMetadata(template: TemplateConfiguration, options: TemplateGenerationOptions): PluginMetadata
  
  /**
   * Generate files for the plugin
   */
  generateFiles(template: TemplateConfiguration, options: TemplateGenerationOptions): Promise<Map<string, string>>
  
  /**
   * Generate plugin manifest
   */
  generateManifest(template: TemplateConfiguration, options: TemplateGenerationOptions): PluginManifest
  
  /**
   * Generate documentation
   */
  generateDocumentation(template: TemplateConfiguration, options: TemplateGenerationOptions): PluginDocumentation
  
  /**
   * Generate build configuration
   */
  generateBuildConfig(template: TemplateConfiguration, options: TemplateGenerationOptions): BuildConfiguration
}

export interface TemplateConfig {
  /**
   * Register a template
   */
  registerTemplate(id: string, config: TemplateConfiguration): void
  
  /**
   * Get template by ID
   */
  getTemplate(id: string): TemplateConfiguration | undefined
  
  /**
   * Get all templates
   */
  getAllTemplates(): TemplateConfiguration[]
  
  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: TemplateCategory): TemplateConfiguration[]
  
  /**
   * Get templates by complexity
   */
  getTemplatesByComplexity(complexity: TemplateComplexity): TemplateConfiguration[]
  
  /**
   * Get templates by feature
   */
  getTemplatesByFeature(feature: TemplateFeature): TemplateConfiguration[]
  
  /**
   * Search templates
   */
  searchTemplates(query: string): TemplateConfiguration[]
  
  /**
   * Get category info
   */
  getCategoryInfo(category: TemplateCategory): CategoryInfo | undefined
  
  /**
   * Get all categories
   */
  getAllCategories(): Array<CategoryInfo & { id: TemplateCategory }>
  
  /**
   * Validate template configuration
   */
  validateTemplateConfig(config: Partial<TemplateConfiguration>): ValidationResult
  
  /**
   * Validate template generation options
   */
  validateGenerationOptions(templateId: string, options: TemplateGenerationOptions): ValidationResult
  
  /**
   * Get template statistics
   */
  getStatistics(): TemplateStatistics
  
  /**
   * Export template configuration
   */
  exportTemplate(templateId: string): TemplateConfiguration & {
    exportedAt: string
    exportVersion: string
  }
  
  /**
   * Import template configuration
   */
  importTemplate(templateData: TemplateConfiguration): string
}

// CLI Integration Types

export interface CLITemplateCommand {
  name: string
  description: string
  options: CLIOption[]
  action: (options: any) => Promise<void>
}

export interface CLIOption {
  name: string
  description: string
  type: 'string' | 'number' | 'boolean' | 'choice'
  required?: boolean
  default?: any
  choices?: string[]
  alias?: string
}

export interface CLITemplateGenerator {
  /**
   * Generate project from template
   */
  generateProject(templateType: TemplateType, options: TemplateGenerationOptions): Promise<void>
  
  /**
   * List available templates
   */
  listTemplates(filter?: SearchFilter): void
  
  /**
   * Show template details
   */
  showTemplate(templateType: TemplateType): void
  
  /**
   * Interactive template selection
   */
  interactiveGeneration(): Promise<void>
  
  /**
   * Validate project directory
   */
  validateProjectDirectory(directory: string): ValidationResult
  
  /**
   * Create project directory structure
   */
  createProjectStructure(directory: string, structure: GeneratedPluginStructure): Promise<void>
}

// Example Project Types

export interface ExampleProject {
  id: string
  name: string
  description: string
  templateType: TemplateType
  complexity: TemplateComplexity
  features: TemplateFeature[]
  sourceUrl?: string
  demoUrl?: string
  documentation: string
  files: Record<string, string>
  metadata: {
    version: string
    author: string
    license: string
    keywords: string[]
    screenshots?: string[]
  }
}

export interface ExampleProjectRegistry {
  /**
   * Register an example project
   */
  registerExample(example: ExampleProject): void
  
  /**
   * Get example by ID
   */
  getExample(id: string): ExampleProject | undefined
  
  /**
   * Get examples by template type
   */
  getExamplesByTemplate(templateType: TemplateType): ExampleProject[]
  
  /**
   * Get examples by complexity
   */
  getExamplesByComplexity(complexity: TemplateComplexity): ExampleProject[]
  
  /**
   * Get examples by feature
   */
  getExamplesByFeature(feature: TemplateFeature): ExampleProject[]
  
  /**
   * Search examples
   */
  searchExamples(query: string): ExampleProject[]
  
  /**
   * Download example project
   */
  downloadExample(id: string, targetDirectory: string): Promise<void>
  
  /**
   * List all examples
   */
  listExamples(): ExampleProject[]
}

// Utility Types

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Factory Functions

export declare function createMCPPluginTemplate(config: TemplateConfiguration): TemplateConfiguration

export declare function generateMCPPlugin(templateType: TemplateType, options: TemplateGenerationOptions): Promise<GeneratedPluginStructure>

export declare function getAvailableMCPTemplates(): TemplateConfiguration[]

export declare function validateTemplateOptions(templateType: TemplateType, options: TemplateGenerationOptions): ValidationResult

export declare function createTemplateFromExample(exampleId: string): TemplateConfiguration

// Default Exports

export declare const defaultTemplateGenerator: MCPPluginTemplateGenerator
export declare const defaultTemplateConfig: TemplateConfig
export declare const defaultExampleRegistry: ExampleProjectRegistry

// Constants

export declare const TEMPLATE_TYPES: Record<string, TemplateType>
export declare const TEMPLATE_CATEGORIES: Record<string, TemplateCategory>
export declare const TEMPLATE_COMPLEXITY: Record<string, TemplateComplexity>
export declare const SUPPORTED_LANGUAGES: Record<string, SupportedLanguage>
export declare const TEMPLATE_FEATURES: Record<string, TemplateFeature>
export declare const TEMPLATE_CONFIG_SCHEMA: object