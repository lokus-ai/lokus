/**
 * TypeScript definitions for Lokus Plugin Manifest v2
 * VS Code-compatible plugin manifest specification
 */

// ===== Basic Types =====

/**
 * Semantic version string (e.g., "1.0.0", "2.1.0-beta.1")
 */
export type SemanticVersion = string;

/**
 * Version range string (e.g., "^1.0.0", ">=1.0.0 <2.0.0")
 */
export type VersionRange = string;

/**
 * Plugin identifier in lowercase kebab-case (e.g., "my-plugin")
 */
export type PluginId = string;

/**
 * Publisher identifier in lowercase kebab-case (e.g., "my-publisher")
 */
export type PublisherId = string;

/**
 * Full plugin identifier (publisher.id format, e.g., "microsoft.vscode")
 */
export type FullPluginId = string;

/**
 * Command identifier (e.g., "extension.commandName")
 */
export type CommandId = string;

/**
 * Language identifier (e.g., "javascript", "typescript")
 */
export type LanguageId = string;

/**
 * View identifier (e.g., "explorer", "search")
 */
export type ViewId = string;

/**
 * URI scheme (e.g., "file", "http", "https")
 */
export type UriScheme = string;

// ===== Activation Events =====

/**
 * Plugin activation events
 */
export type ActivationEvent =
  | "*" // Activate immediately
  | "onStartupFinished" // Activate after startup
  | `onCommand:${CommandId}` // Activate on command
  | `onLanguage:${LanguageId}` // Activate for language
  | `onDebug:${string}` // Activate for debug session
  | "onDebugResolve:" // Activate for debug config resolution
  | "onDebugInitialConfigurations" // Activate for debug initial config
  | `onDebugDynamicConfigurations:${string}` // Activate for dynamic debug config
  | `workspaceContains:${string}` // Activate if workspace contains file pattern
  | `onFileSystem:${UriScheme}` // Activate for file system scheme
  | `onSearch:${string}` // Activate for search
  | `onView:${ViewId}` // Activate when view is opened
  | "onUri" // Activate on URI scheme
  | `onWebviewPanel:${string}` // Activate for webview panel
  | `onCustomEditor:${string}` // Activate for custom editor
  | `onAuthenticationRequest:${string}` // Activate for auth request
  | `onOpenExternalUri:${string}` // Activate for external URI
  | `onTerminalProfile:${string}`; // Activate for terminal profile

// ===== Plugin Categories =====

/**
 * Plugin marketplace categories
 */
export type PluginCategory =
  | "Programming Languages"
  | "Snippets"
  | "Linters"
  | "Themes"
  | "Debuggers"
  | "Formatters"
  | "Keymaps"
  | "SCM Providers"
  | "Extension Packs"
  | "Language Packs"
  | "Data Science"
  | "Machine Learning"
  | "Visualization"
  | "Notebooks"
  | "Education"
  | "Testing"
  | "Other";

// ===== Author Information =====

/**
 * Plugin author information
 */
export interface PluginAuthor {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Author can be string or object
 */
export type Author = string | PluginAuthor;

// ===== Repository Information =====

/**
 * Repository information
 */
export interface PluginRepository {
  type: string;
  url: string;
  directory?: string;
}

/**
 * Repository can be string URL or object
 */
export type Repository = string | PluginRepository;

// ===== Bug Reporting =====

/**
 * Bug reporting information
 */
export interface BugReporting {
  url?: string;
  email?: string;
}

/**
 * Bugs can be string URL or object
 */
export type Bugs = string | BugReporting;

// ===== Engine Compatibility =====

/**
 * Engine compatibility requirements
 */
export interface Engines {
  lokus: VersionRange;
  node?: VersionRange;
}

// ===== Workspace Capabilities =====

/**
 * Untrusted workspace support
 */
export interface UntrustedWorkspaceSupport {
  supported: boolean | "limited";
  restrictedConfigurations?: string[];
  description?: string;
}

/**
 * Virtual workspace support
 */
export interface VirtualWorkspaceSupport {
  supported: boolean | "limited";
  description?: string;
}

/**
 * Plugin workspace capabilities
 */
export interface PluginCapabilities {
  untrustedWorkspaces?: UntrustedWorkspaceSupport;
  virtualWorkspaces?: VirtualWorkspaceSupport;
}

// ===== Badge Information =====

/**
 * Marketplace badge
 */
export interface Badge {
  url: string;
  href: string;
  description: string;
}

// ===== Gallery Banner =====

/**
 * Marketplace gallery banner
 */
export interface GalleryBanner {
  color?: string;
  theme?: "dark" | "light";
}

// ===== Sponsorship =====

/**
 * Sponsorship information
 */
export interface Sponsor {
  url: string;
}

// ===== Contribution Points =====

/**
 * Icon specification
 */
export interface Icon {
  light: string;
  dark: string;
}

/**
 * Icon can be string path or theme-specific object
 */
export type IconValue = string | Icon;

/**
 * Command contribution
 */
export interface Command {
  command: CommandId;
  title: string;
  shortTitle?: string;
  category?: string;
  icon?: IconValue;
  enablement?: string;
  tooltip?: string;
  arguments?: CommandArgument[];
  metadata?: CommandMetadata;
}

/**
 * Command argument definition
 */
export interface CommandArgument {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  default?: any;
}

/**
 * Command metadata
 */
export interface CommandMetadata {
  keybinding?: string;
  group?: string;
  order?: number;
  deprecated?: boolean;
  experimental?: boolean;
}

/**
 * Menu contexts
 */
export type MenuContext =
  | "commandPalette"
  | "editor/context"
  | "editor/title"
  | "editor/title/context"
  | "explorer/context"
  | "scm/title"
  | "scm/resourceGroup/context"
  | "scm/resourceState/context"
  | "scm/change/title"
  | "view/title"
  | "view/item/context"
  | "menuBar"
  | "touchBar"
  | "webview/context"
  | "comments/commentThread/context"
  | "comments/comment/title"
  | "comments/comment/context"
  | "timeline/title"
  | "timeline/item/context"
  | "extension/context"
  | "file/newFile";

/**
 * Menu item contribution
 */
export interface MenuItem {
  command?: CommandId;
  alt?: CommandId;
  when?: string;
  group?: string;
  submenu?: string;
  title?: string;
  icon?: IconValue;
  enablement?: string;
  tooltip?: string;
  args?: any;
  metadata?: MenuItemMetadata;
}

/**
 * Menu item metadata
 */
export interface MenuItemMetadata {
  keybinding?: string;
  order?: number;
  separator?: boolean;
}

/**
 * Menu contributions (context -> items)
 */
export type Menus = Partial<Record<MenuContext, MenuItem[]>>;

/**
 * Keybinding contribution
 */
export interface Keybinding {
  command: CommandId;
  key: string;
  mac?: string;
  linux?: string;
  win?: string;
  when?: string;
  args?: any;
  metadata?: KeybindingMetadata;
}

/**
 * Keybinding metadata
 */
export interface KeybindingMetadata {
  title?: string;
  description?: string;
  category?: string;
  priority?: number;
  scope?: "global" | "editor" | "view" | "panel";
  experimental?: boolean;
}

/**
 * Language contribution
 */
export interface Language {
  id: LanguageId;
  aliases?: string[];
  extensions?: string[];
  filenames?: string[];
  filenamePatterns?: string[];
  firstLine?: string;
  configuration?: string;
  icon?: Icon;
  mimetypes?: string[];
  metadata?: LanguageMetadata;
}

/**
 * Language metadata
 */
export interface LanguageMetadata {
  displayName?: string;
  description?: string;
  homepage?: string;
  documentation?: string;
  category?: "Programming" | "Markup" | "Data" | "Configuration" | "Script" | "Query" | "Stylesheet" | "Documentation" | "Other";
  features?: LanguageFeatures;
  experimental?: boolean;
}

/**
 * Language feature support
 */
export interface LanguageFeatures {
  syntax?: boolean;
  completion?: boolean;
  diagnostics?: boolean;
  formatting?: boolean;
  folding?: boolean;
  outline?: boolean;
  hover?: boolean;
  definition?: boolean;
  references?: boolean;
  rename?: boolean;
}

/**
 * Grammar contribution
 */
export interface Grammar {
  language?: LanguageId;
  scopeName: string;
  path: string;
  embeddedLanguages?: Record<string, LanguageId>;
  tokenTypes?: Record<string, string>;
  injectTo?: string[];
}

/**
 * Theme contribution
 */
export interface Theme {
  id?: string;
  label: string;
  uiTheme: "vs" | "vs-dark" | "hc-black" | "hc-light";
  path: string;
  description?: string;
  metadata?: ThemeMetadata;
}

/**
 * Theme metadata
 */
export interface ThemeMetadata {
  category?: "Light" | "Dark" | "High Contrast" | "Color Blind Friendly" | "Minimal" | "Vibrant" | "Retro" | "Professional" | "Other";
  tags?: string[];
  author?: string;
  version?: string;
  homepage?: string;
  preview?: ThemePreview;
  compatibility?: ThemeCompatibility;
  accessibility?: ThemeAccessibility;
  experimental?: boolean;
}

/**
 * Theme preview information
 */
export interface ThemePreview {
  screenshot?: string;
  colors?: {
    primary?: string;
    secondary?: string;
    accent?: string;
    background?: string;
    foreground?: string;
  };
}

/**
 * Theme compatibility information
 */
export interface ThemeCompatibility {
  lokusVersion?: VersionRange;
  languages?: LanguageId[];
  features?: ThemeFeature[];
}

/**
 * Theme features
 */
export type ThemeFeature =
  | "syntax-highlighting"
  | "semantic-highlighting"
  | "bracket-matching"
  | "error-highlighting"
  | "search-highlighting"
  | "selection-highlighting"
  | "terminal-colors"
  | "git-decorations"
  | "minimap"
  | "peek-view"
  | "find-widget";

/**
 * Theme accessibility information
 */
export interface ThemeAccessibility {
  highContrast?: boolean;
  colorBlindFriendly?: boolean;
  wcagCompliant?: "AA" | "AAA";
}

/**
 * Icon theme contribution
 */
export interface IconTheme {
  id: string;
  label: string;
  path: string;
}

/**
 * Snippet contribution
 */
export interface Snippet {
  language: LanguageId;
  path: string;
}

/**
 * Configuration scope
 */
export type ConfigurationScope =
  | "application"
  | "machine"
  | "machine-overridable"
  | "window"
  | "resource"
  | "language-overridable";

/**
 * Configuration property type
 */
export type ConfigurationType = "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";

/**
 * Configuration property
 */
export interface ConfigurationProperty {
  type: ConfigurationType | ConfigurationType[];
  default?: any;
  description?: string;
  markdownDescription?: string;
  enum?: any[];
  enumDescriptions?: string[];
  enumItemLabels?: string[];
  scope?: ConfigurationScope;
  minimum?: number;
  maximum?: number;
  multipleOf?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternErrorMessage?: string;
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
  items?: ConfigurationProperty | ConfigurationProperty[];
  properties?: Record<string, ConfigurationProperty>;
  additionalProperties?: boolean | ConfigurationProperty;
  required?: string[];
  deprecationMessage?: string;
  markdownDeprecationMessage?: string;
  order?: number;
  tags?: ConfigurationTag[];
  editPresentation?: "multilineText" | "singlelineText" | "password";
  ignoreSync?: boolean;
  restricted?: boolean;
  when?: string;
  overrides?: Record<string, any>;
  examples?: any[];
  metadata?: ConfigurationPropertyMetadata;
}

/**
 * Configuration property tags
 */
export type ConfigurationTag =
  | "experimental"
  | "preview"
  | "deprecated"
  | "advanced"
  | "beginner"
  | "hidden"
  | "internal";

/**
 * Configuration property metadata
 */
export interface ConfigurationPropertyMetadata {
  category?: string;
  subcategory?: string;
  requiresRestart?: boolean;
  requiresReload?: boolean;
  affectsPerformance?: boolean;
  sensitive?: boolean;
}

/**
 * Configuration contribution
 */
export interface Configuration {
  title?: string;
  order?: number;
  properties: Record<string, ConfigurationProperty>;
}

/**
 * View contribution
 */
export interface View {
  id: ViewId;
  name: string;
  when?: string;
  icon?: string;
  contextualTitle?: string;
  type?: "tree" | "webview";
  visibility?: "visible" | "collapsed" | "hidden";
}

/**
 * View container contribution
 */
export interface ViewContainer {
  id: string;
  title: string;
  icon: string;
}

/**
 * View containers by location
 */
export interface ViewsContainers {
  activitybar?: ViewContainer[];
  panel?: ViewContainer[];
}

/**
 * Views by container
 */
export type Views = Record<string, View[]>;

/**
 * Problem matcher contribution
 */
export interface ProblemMatcher {
  name: string;
  label?: string;
  owner?: string;
  source?: string;
  applyTo?: "allDocuments" | "openDocuments" | "closedDocuments";
  severity?: "error" | "warning" | "info";
  fileLocation?: string | any[];
  pattern?: any;
  background?: ProblemMatcherBackground;
  watching?: ProblemMatcherWatching;
}

/**
 * Problem matcher background
 */
export interface ProblemMatcherBackground {
  activeOnStart?: boolean;
  beginsPattern?: string;
  endsPattern?: string;
}

/**
 * Problem matcher watching
 */
export interface ProblemMatcherWatching {
  activeOnStart?: boolean;
  beginsPattern?: string;
  endsPattern?: string;
}

/**
 * Task definition contribution
 */
export interface TaskDefinition {
  type: string;
  required?: string[];
  properties?: Record<string, TaskDefinitionProperty>;
}

/**
 * Task definition property
 */
export interface TaskDefinitionProperty {
  type?: string;
  description?: string;
}

/**
 * Debugger contribution
 */
export interface Debugger {
  type: string;
  label?: string;
  program?: string;
  runtime?: string;
  configurationAttributes?: any;
  initialConfigurations?: any;
  configurationSnippets?: any;
  variables?: any;
  languages?: LanguageId[];
}

/**
 * Breakpoint contribution
 */
export interface Breakpoint {
  language: LanguageId;
}

/**
 * Color contribution
 */
export interface ColorContribution {
  id: string;
  description: string;
  defaults?: {
    light?: string;
    dark?: string;
    highContrast?: string;
  };
}

/**
 * Authentication provider contribution
 */
export interface AuthenticationProvider {
  id: string;
  label: string;
}

/**
 * Resource label formatter contribution
 */
export interface ResourceLabelFormatter {
  scheme: string;
  authority?: string;
  formatting: {
    label?: string;
    separator?: string;
    tildify?: boolean;
    workspaceSuffix?: string;
  };
}

/**
 * Custom editor contribution
 */
export interface CustomEditor {
  viewType: string;
  displayName: string;
  selector?: Array<{
    filenamePattern?: string;
  }>;
  priority?: "default" | "builtin" | "option";
}

/**
 * Webview contribution
 */
export interface Webview {
  viewType: string;
  displayName: string;
}

/**
 * All contribution points
 */
export interface Contributes {
  commands?: Command[];
  menus?: Menus;
  keybindings?: Keybinding[];
  languages?: Language[];
  grammars?: Grammar[];
  themes?: Theme[];
  iconThemes?: IconTheme[];
  snippets?: Snippet[];
  configuration?: Configuration;
  configurationDefaults?: Record<string, any>;
  views?: Views;
  viewsContainers?: ViewsContainers;
  problemMatchers?: ProblemMatcher[];
  taskDefinitions?: TaskDefinition[];
  debuggers?: Debugger[];
  breakpoints?: Breakpoint[];
  colors?: ColorContribution[];
  authentication?: AuthenticationProvider[];
  resourceLabelFormatters?: ResourceLabelFormatter[];
  customEditors?: CustomEditor[];
  webviews?: Webview[];
}

// ===== Main Manifest Interface =====

/**
 * Plugin Manifest v2 - VS Code compatible
 */
export interface PluginManifestV2 {
  // Required fields
  manifest: "2.0";
  id: PluginId;
  name: string;
  version: SemanticVersion;
  engines: Engines;

  // Identification
  publisher?: PublisherId;
  displayName?: string;
  description?: string;

  // Categorization
  categories?: PluginCategory[];
  keywords?: string[];

  // Entry points
  main?: string;
  browser?: string;

  // Activation
  activationEvents?: ActivationEvent[];

  // Contributions
  contributes?: Contributes;

  // Capabilities
  capabilities?: PluginCapabilities;

  // Metadata
  author?: Author;
  license?: string;
  homepage?: string;
  repository?: Repository;
  bugs?: Bugs;
  qna?: boolean | "marketplace" | string;
  badges?: Badge[];
  markdown?: "github" | "standard";
  galleryBanner?: GalleryBanner;
  preview?: boolean;
  enabledApiProposals?: string[];
  api?: "none";

  // Dependencies
  extensionDependencies?: FullPluginId[];
  extensionPack?: FullPluginId[];

  // Assets
  icon?: string;

  // Build
  scripts?: Record<string, string>;

  // Marketplace
  pricing?: "Free" | "Trial" | "Paid";
  sponsor?: Sponsor;
}

/**
 * Plugin Manifest v1 (legacy)
 */
export interface PluginManifestV1 {
  // Required fields
  id: PluginId;
  name: string;
  version: SemanticVersion;
  main: string;
  lokusVersion: VersionRange;

  // Optional fields
  description?: string;
  author?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  keywords?: string[];
  dependencies?: Record<string, VersionRange>;
  permissions?: string[];
  contributes?: any;
  activationEvents?: string[];
  engines?: any;
  icon?: string;
  galleryBanner?: any;
  categories?: string[];
  preview?: boolean;
  qna?: boolean | string;
}

/**
 * Union type for all manifest versions
 */
export type PluginManifest = PluginManifestV1 | PluginManifestV2;

// ===== Validation Types =====

/**
 * Validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: "error";
  data?: any;
  timestamp?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  field: string;
  message: string;
  severity: "warning";
  data?: any;
  timestamp?: string;
}

/**
 * Validation info
 */
export interface ValidationInfo {
  message: string;
  severity: "info";
  data?: any;
  timestamp?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  info?: ValidationInfo[];
  stats?: ValidationStats;
}

/**
 * Validation statistics
 */
export interface ValidationStats {
  errors: number;
  warnings: number;
  info?: number;
  total: number;
  errorsByField: Record<string, ValidationError[]>;
  warningsByField: Record<string, ValidationWarning[]>;
}

// ===== Migration Types =====

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  v2Manifest?: PluginManifestV2;
  validation?: ValidationResult;
  log: MigrationLogEntry[];
  warnings: MigrationLogEntry[];
  errors: MigrationLogEntry[];
  stats: MigrationStats;
}

/**
 * Migration log entry
 */
export interface MigrationLogEntry {
  type: "info" | "warning" | "error";
  message: string;
  field?: string;
  timestamp: string;
}

/**
 * Migration statistics
 */
export interface MigrationStats {
  logEntries: number;
  warnings: number;
  errors: number;
}

/**
 * Migration preview
 */
export interface MigrationPreview {
  canMigrate: boolean;
  reason?: string;
  changes?: string[];
  estimatedComplexity?: "low" | "medium" | "high";
}

// ===== Utility Types =====

/**
 * Extract manifest version
 */
export type ManifestVersion<T> = T extends { manifest: infer V } ? V : T extends { lokusVersion: any } ? "1.0" : unknown;

/**
 * Check if manifest is v2
 */
export type IsManifestV2<T> = ManifestVersion<T> extends "2.0" ? true : false;

/**
 * Get manifest type by version
 */
export type ManifestByVersion<V> = V extends "2.0" ? PluginManifestV2 : V extends "1.0" ? PluginManifestV1 : never;

/**
 * Extract contribution types
 */
export type ContributionType = keyof Required<Contributes>;

/**
 * Get contribution by type
 */
export type ContributionByType<T extends ContributionType> = Required<Contributes>[T];