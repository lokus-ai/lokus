/**
 * @fileoverview Plugin manifest types and schema definitions
 */

/**
 * Plugin manifest schema - defines plugin metadata and capabilities
 */
export interface PluginManifest {
  /** Plugin identifier (must be unique) */
  readonly id: string

  /** Plugin version (semver) */
  readonly version: string

  /** Plugin display name */
  readonly name: string

  /** Plugin description */
  readonly description?: string

  /** Plugin author information */
  readonly author?: string | PluginAuthor

  /** Plugin license */
  readonly license?: string

  /** Plugin homepage URL */
  readonly homepage?: string

  /** Plugin repository information */
  readonly repository?: string | PluginRepository

  /** Plugin icon (URL or data URI) */
  readonly icon?: string

  /** Plugin categories */
  readonly categories?: string[]

  /** Plugin keywords/tags */
  readonly keywords?: string[]

  /** Minimum Lokus version required */
  readonly lokusVersion?: string

  /** Plugin entry point */
  readonly main?: string

  /** Plugin TypeScript entry point */
  readonly types?: string

  /** Plugin activation events */
  readonly activationEvents?: string[]

  /** Plugin contributions */
  readonly contributes?: PluginContributions

  /** Plugin dependencies */
  readonly dependencies?: Record<string, string>

  /** Plugin peer dependencies */
  readonly peerDependencies?: Record<string, string>

  /** Plugin development dependencies */
  readonly devDependencies?: Record<string, string>

  /** Required permissions */
  readonly permissions?: string[]

  /** Plugin configuration schema */
  readonly configuration?: ConfigurationSchema

  /** Plugin commands */
  readonly commands?: Command[]

  /** Plugin keybindings */
  readonly keybindings?: Keybinding[]

  /** Plugin menus */
  readonly menus?: Record<string, MenuItem[]>

  /** Plugin themes */
  readonly themes?: Theme[]

  /** Plugin languages */
  readonly languages?: Language[]

  /** Plugin snippets */
  readonly snippets?: Snippet[]

  /** Plugin file associations */
  readonly fileAssociations?: FileAssociation[]

  /** Plugin views */
  readonly views?: Record<string, View[]>

  /** Plugin view containers */
  readonly viewsContainers?: Record<string, ViewContainer[]>

  /** Plugin problem matchers */
  readonly problemMatchers?: ProblemMatcher[]

  /** Plugin task definitions */
  readonly taskDefinitions?: TaskDefinition[]

  /** Plugin debug adapters */
  readonly debuggers?: Debugger[]

  /** Plugin grammars */
  readonly grammars?: Grammar[]

  /** Plugin web resources */
  readonly web?: WebResources

  /** Plugin scripts */
  readonly scripts?: Record<string, string>

  /** Plugin files to include in package */
  readonly files?: string[]

  /** Plugin engines compatibility */
  readonly engines?: Record<string, string>

  /** Plugin publishing configuration */
  readonly publishConfig?: PublishConfig

  /** Plugin metadata */
  readonly metadata?: Record<string, unknown>
}

/**
 * Plugin author information
 */
export interface PluginAuthor {
  name: string
  email?: string
  url?: string
}

/**
 * Plugin repository information
 */
export interface PluginRepository {
  type: 'git' | 'svn' | 'mercurial'
  url: string
  directory?: string
}

/**
 * Plugin contributions - defines what the plugin contributes to Lokus
 */
export interface PluginContributions {
  commands?: Command[]
  keybindings?: Keybinding[]
  languages?: Language[]
  grammars?: Grammar[]
  themes?: Theme[]
  snippets?: Snippet[]
  configuration?: ConfigurationSchema
  configurationDefaults?: Record<string, unknown>
  views?: Record<string, View[]>
  viewsContainers?: Record<string, ViewContainer[]>
  menus?: Record<string, MenuItem[]>
  problemMatchers?: ProblemMatcher[]
  taskDefinitions?: TaskDefinition[]
  debuggers?: Debugger[]
  breakpoints?: Breakpoint[]
  fileAssociations?: FileAssociation[]
  folding?: Folding[]
  semanticTokenTypes?: SemanticTokenType[]
  semanticTokenModifiers?: SemanticTokenModifier[]
  semanticTokenScopes?: SemanticTokenScope[]
}

/**
 * Command contribution
 */
export interface Command {
  command: string
  title: string
  category?: string
  icon?: string | ThemeIcon
  when?: string
  enablement?: string
  tooltip?: string
  shortTitle?: string
}

/**
 * Keybinding contribution
 */
export interface Keybinding {
  command: string
  key: string
  mac?: string
  linux?: string
  win?: string
  when?: string
  args?: unknown
}

/**
 * Menu item contribution
 */
export interface MenuItem {
  command?: string
  submenu?: string
  title?: string
  group?: string
  when?: string
  order?: number
}

/**
 * Theme contribution
 */
export interface Theme {
  id: string
  label: string
  uiTheme: 'vs' | 'vs-dark' | 'hc-black' | 'hc-light'
  path: string
}

/**
 * Language contribution
 */
export interface Language {
  id: string
  aliases?: string[]
  extensions?: string[]
  filenames?: string[]
  filenamePatterns?: string[]
  firstLine?: string
  configuration?: string
  icon?: string | ThemeIcon
}

/**
 * Grammar contribution
 */
export interface Grammar {
  language?: string
  scopeName: string
  path: string
  embeddedLanguages?: Record<string, string>
  tokenTypes?: Record<string, string>
  injectTo?: string[]
}

/**
 * Snippet contribution
 */
export interface Snippet {
  language: string
  path: string
}

/**
 * File association
 */
export interface FileAssociation {
  filePattern: string
  language: string
}

/**
 * View contribution
 */
export interface View {
  id: string
  name: string
  when?: string
  icon?: string | ThemeIcon
  contextualTitle?: string
  visibility?: 'visible' | 'hidden' | 'collapsed'
}

/**
 * View container contribution
 */
export interface ViewContainer {
  id: string
  title: string
  icon: string | ThemeIcon
}

/**
 * Problem matcher contribution
 */
export interface ProblemMatcher {
  name: string
  label?: string
  owner: string
  source?: string
  fileLocation: string[] | string
  pattern: ProblemPattern | ProblemPattern[]
  severity?: string
  watching?: WatchingMatcher
}

/**
 * Problem pattern
 */
export interface ProblemPattern {
  name?: string
  regexp: string
  file?: number
  location?: number
  line?: number
  column?: number
  endLine?: number
  endColumn?: number
  severity?: number
  code?: number
  message: number
  loop?: boolean
}

/**
 * Watching matcher
 */
export interface WatchingMatcher {
  activeOnStart?: boolean
  beginsPattern?: string | BeginPattern
  endsPattern?: string | EndPattern
}

/**
 * Begin pattern
 */
export interface BeginPattern {
  regexp: string
}

/**
 * End pattern
 */
export interface EndPattern {
  regexp: string
}

/**
 * Task definition contribution
 */
export interface TaskDefinition {
  type: string
  required?: string[]
  properties?: Record<string, unknown>
  when?: string
}

/**
 * Debugger contribution
 */
export interface Debugger {
  type: string
  label?: string
  program?: string
  runtime?: string
  variables?: Record<string, string>
  initialConfigurations?: unknown[]
  configurationSnippets?: ConfigurationSnippet[]
  configurationAttributes?: unknown
  languages?: string[]
  enableBreakpointsFor?: BreakpointLanguage
  when?: string
}

/**
 * Configuration snippet
 */
export interface ConfigurationSnippet {
  label: string
  description?: string
  body: unknown
}

/**
 * Breakpoint language configuration
 */
export interface BreakpointLanguage {
  languageIds: string[]
}

/**
 * Breakpoint contribution
 */
export interface Breakpoint {
  language: string
}

/**
 * Folding contribution
 */
export interface Folding {
  language: string
  markers?: FoldingMarkers
}

/**
 * Folding markers
 */
export interface FoldingMarkers {
  start: string
  end: string
}

/**
 * Semantic token type
 */
export interface SemanticTokenType {
  id: string
  description: string
}

/**
 * Semantic token modifier
 */
export interface SemanticTokenModifier {
  id: string
  description: string
}

/**
 * Semantic token scope
 */
export interface SemanticTokenScope {
  language?: string
  scopes: Record<string, string[]>
}

/**
 * Theme icon reference
 */
export interface ThemeIcon {
  light?: string
  dark?: string
}

/**
 * Configuration schema
 */
export interface ConfigurationSchema {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  title?: string
  description?: string
  properties?: Record<string, ConfigurationProperty>
  additionalProperties?: boolean | ConfigurationProperty
  patternProperties?: Record<string, ConfigurationProperty>
  required?: string[]
  default?: unknown
  examples?: unknown[]
  enum?: unknown[]
  enumDescriptions?: string[]
  deprecationMessage?: string
  markdownDescription?: string
  order?: number
  scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable'
}

/**
 * Configuration property
 */
export interface ConfigurationProperty {
  type?: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null' | string[]
  title?: string
  description?: string
  markdownDescription?: string
  default?: unknown
  examples?: unknown[]
  enum?: unknown[]
  enumDescriptions?: string[]
  deprecationMessage?: string
  markdownDeprecationMessage?: string
  pattern?: string
  patternErrorMessage?: string
  format?: string
  minimum?: number
  maximum?: number
  multipleOf?: number
  minLength?: number
  maxLength?: number
  items?: ConfigurationProperty | ConfigurationProperty[]
  additionalItems?: boolean | ConfigurationProperty
  minItems?: number
  maxItems?: number
  uniqueItems?: boolean
  contains?: ConfigurationProperty
  properties?: Record<string, ConfigurationProperty>
  additionalProperties?: boolean | ConfigurationProperty
  patternProperties?: Record<string, ConfigurationProperty>
  required?: string[]
  dependencies?: Record<string, ConfigurationProperty | string[]>
  const?: unknown
  if?: ConfigurationProperty
  then?: ConfigurationProperty
  else?: ConfigurationProperty
  allOf?: ConfigurationProperty[]
  anyOf?: ConfigurationProperty[]
  oneOf?: ConfigurationProperty[]
  not?: ConfigurationProperty
  scope?: 'application' | 'machine' | 'window' | 'resource' | 'language-overridable' | 'machine-overridable'
  restricted?: boolean
  tags?: string[]
  order?: number
  editPresentation?: 'singlelineText' | 'multilineText'
}

/**
 * Web resources configuration
 */
export interface WebResources {
  /** Local web assets directory */
  localResourceRoots?: string[]
  
  /** Content Security Policy */
  csp?: {
    /** CSP directives */
    directives?: Record<string, string[]>
    
    /** Allow unsafe eval */
    'unsafe-eval'?: boolean
    
    /** Allow unsafe inline */
    'unsafe-inline'?: boolean
  }
  
  /** Port mapping for local development */
  portMapping?: Record<string, number>
  
  /** Additional HTTP headers */
  headers?: Record<string, string>
}

/**
 * Publishing configuration
 */
export interface PublishConfig {
  /** Registry URL */
  registry?: string
  
  /** Access level */
  access?: 'public' | 'restricted'
  
  /** Tag */
  tag?: string
  
  /** Directory to publish */
  directory?: string
}

/**
 * Manifest validation result
 */
export interface ManifestValidationResult {
  /** Whether manifest is valid */
  valid: boolean
  
  /** Validation errors */
  errors: Array<{
    path: string
    message: string
    severity: 'error' | 'warning'
  }>
  
  /** Validation warnings */
  warnings: Array<{
    path: string
    message: string
    suggestion?: string
  }>
}

/**
 * Manifest validator options
 */
export interface ManifestValidatorOptions {
  /** Strict validation mode */
  strict?: boolean
  
  /** Allow unknown properties */
  allowUnknownProperties?: boolean
  
  /** Validate semantic versioning */
  validateSemver?: boolean
  
  /** Check for required fields */
  checkRequired?: boolean
  
  /** Validate URLs */
  validateUrls?: boolean
  
  /** Custom validation rules */
  customRules?: Array<(manifest: PluginManifest) => ManifestValidationResult>
}