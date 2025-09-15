/**
 * @fileoverview Plugin template system
 */

export * from './basic-plugin.js'
export * from './ui-extension-plugin.js'
export * from './language-support-plugin.js'
export * from './task-provider-plugin.js'
export * from './debug-adapter-plugin.js'
export * from './theme-plugin.js'
export * from './command-plugin.js'

/**
 * Available plugin templates
 */
export enum PluginTemplate {
  BASIC = 'basic',
  UI_EXTENSION = 'ui-extension',
  LANGUAGE_SUPPORT = 'language-support',
  TASK_PROVIDER = 'task-provider',
  DEBUG_ADAPTER = 'debug-adapter',
  THEME = 'theme',
  COMMAND = 'command'
}

/**
 * Template configuration
 */
export interface TemplateConfig {
  /** Template type */
  template: PluginTemplate
  
  /** Plugin name */
  name: string
  
  /** Plugin ID */
  id: string
  
  /** Plugin description */
  description?: string
  
  /** Plugin author */
  author?: string
  
  /** Plugin version */
  version?: string
  
  /** Output directory */
  outputDir: string
  
  /** Template-specific options */
  options?: Record<string, unknown>
  
  /** TypeScript support */
  typescript?: boolean
  
  /** Include tests */
  includeTests?: boolean
  
  /** Include documentation */
  includeDocs?: boolean
  
  /** Include CI/CD configuration */
  includeCiCd?: boolean
  
  /** Git repository initialization */
  initGit?: boolean
  
  /** Package manager */
  packageManager?: 'npm' | 'yarn' | 'pnpm'
}

/**
 * Template generator interface
 */
export interface TemplateGenerator {
  /**
   * Generate plugin from template
   */
  generate(config: TemplateConfig): Promise<void>
  
  /**
   * Validate template configuration
   */
  validate(config: TemplateConfig): Promise<TemplateValidationResult>
  
  /**
   * Get template description
   */
  getDescription(): TemplateDescription
  
  /**
   * Get required template options
   */
  getRequiredOptions(): TemplateOption[]
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /** Whether configuration is valid */
  valid: boolean
  
  /** Validation errors */
  errors: string[]
  
  /** Validation warnings */
  warnings: string[]
}

/**
 * Template description
 */
export interface TemplateDescription {
  /** Template name */
  name: string
  
  /** Template display name */
  displayName: string
  
  /** Template description */
  description: string
  
  /** Template category */
  category: string
  
  /** Template tags */
  tags: string[]
  
  /** Complexity level */
  complexity: 'beginner' | 'intermediate' | 'advanced'
  
  /** Estimated setup time */
  setupTime: string
  
  /** Required skills */
  requiredSkills: string[]
  
  /** Template features */
  features: string[]
  
  /** Use cases */
  useCases: string[]
}

/**
 * Template option
 */
export interface TemplateOption {
  /** Option key */
  key: string
  
  /** Option name */
  name: string
  
  /** Option description */
  description: string
  
  /** Option type */
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  
  /** Whether option is required */
  required: boolean
  
  /** Default value */
  default?: unknown
  
  /** Possible values */
  choices?: string[]
  
  /** Validation pattern */
  pattern?: string
  
  /** Validation message */
  validationMessage?: string
}