/**
 * TypeScript definitions for Plugin Registry System
 * Comprehensive type definitions for all registry components
 */

import { EventEmitter } from '../../../utils/EventEmitter.js'

// ==================== CORE TYPES ====================

export type PluginId = string
export type PublisherId = string
export type Version = string
export type Timestamp = string // ISO 8601
export type Checksum = string
export type FileSize = number
export type Url = string

// ==================== REGISTRY STATUS ====================

export const REGISTRY_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
  SUSPENDED: 'suspended',
  REMOVED: 'removed'
} as const

export type RegistryStatus = typeof REGISTRY_STATUS[keyof typeof REGISTRY_STATUS]

// ==================== CATEGORIES ====================

export const REGISTRY_CATEGORIES = {
  EDITOR: 'editor',
  FORMATTER: 'formatter',
  LANGUAGE: 'language',
  THEME: 'theme',
  SNIPPET: 'snippet',
  TOOL: 'tool',
  INTEGRATION: 'integration',
  PRODUCTIVITY: 'productivity',
  DEBUGGER: 'debugger',
  TESTING: 'testing',
  SCM: 'scm',
  EXTENSION_PACK: 'extension_pack',
  OTHER: 'other'
} as const

export type RegistryCategory = typeof REGISTRY_CATEGORIES[keyof typeof REGISTRY_CATEGORIES]

// ==================== SECURITY ====================

export const SECURITY_RISK = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
} as const

export type SecurityRiskLevel = typeof SECURITY_RISK[keyof typeof SECURITY_RISK]

export interface SecurityScanResult {
  riskLevel: SecurityRiskLevel
  scanDate: Timestamp
  vulnerabilities: SecurityVulnerability[]
  permissions: string[]
  malwareScore: number
  codeQualityScore: number
  dependencies: DependencySecurityInfo[]
}

export interface SecurityVulnerability {
  id: string
  severity: SecurityRiskLevel
  description: string
  cwe?: string
  cvss?: number
  fixAvailable: boolean
  affectedVersions: string[]
}

export interface DependencySecurityInfo {
  name: string
  version: string
  vulnerabilities: SecurityVulnerability[]
  license: string
  outdated: boolean
}

// ==================== PLUGIN METADATA ====================

export interface PluginManifest {
  manifest: string
  id: PluginId
  name: string
  displayName?: string
  version: Version
  description: string
  author: string | AuthorInfo
  publisher: PublisherId
  license: string
  homepage?: Url
  repository?: Url
  bugs?: Url
  icon?: string
  categories: RegistryCategory[]
  keywords: string[]
  engines: {
    lokus: string
    [key: string]: string
  }
  main: string
  browser?: string
  activationEvents: string[]
  contributes: ContributionPoints
  capabilities?: PluginCapabilities
  extensionDependencies?: PluginId[]
  extensionPack?: PluginId[]
  preview?: boolean
  permissions?: string[]
  [key: string]: any
}

export interface AuthorInfo {
  name: string
  email?: string
  url?: Url
}

export interface ContributionPoints {
  commands?: Command[]
  menus?: MenuContributions
  keybindings?: Keybinding[]
  languages?: LanguageContribution[]
  grammars?: GrammarContribution[]
  themes?: ThemeContribution[]
  iconThemes?: IconThemeContribution[]
  snippets?: SnippetContribution[]
  configuration?: ConfigurationContribution
  views?: ViewContributions
  viewsContainers?: ViewContainerContributions
  [key: string]: any
}

export interface Command {
  command: string
  title: string
  category?: string
  icon?: string | { light: string; dark: string }
  when?: string
}

export interface MenuContributions {
  [menuId: string]: MenuItem[]
}

export interface MenuItem {
  command?: string
  submenu?: string
  when?: string
  group?: string
  alt?: string
}

export interface Keybinding {
  command: string
  key: string
  mac?: string
  linux?: string
  win?: string
  when?: string
}

export interface LanguageContribution {
  id: string
  aliases?: string[]
  extensions?: string[]
  filenames?: string[]
  filenamePatterns?: string[]
  firstLine?: string
  configuration?: string
}

export interface GrammarContribution {
  language: string
  scopeName: string
  path: string
  embeddedLanguages?: { [scopeName: string]: string }
  tokenTypes?: { [scopeName: string]: string }
}

export interface ThemeContribution {
  label: string
  uiTheme: 'vs' | 'vs-dark' | 'hc-black'
  path: string
}

export interface IconThemeContribution {
  id: string
  label: string
  path: string
}

export interface SnippetContribution {
  language: string
  path: string
}

export interface ConfigurationContribution {
  title?: string
  properties: { [key: string]: ConfigurationProperty }
}

export interface ConfigurationProperty {
  type: string | string[]
  default?: any
  description: string
  enum?: any[]
  enumDescriptions?: string[]
  minimum?: number
  maximum?: number
  pattern?: string
  format?: string
  items?: ConfigurationProperty
  properties?: { [key: string]: ConfigurationProperty }
  additionalProperties?: boolean | ConfigurationProperty
  scope?: 'application' | 'machine' | 'window' | 'resource'
  deprecationMessage?: string
  markdownDescription?: string
}

export interface ViewContributions {
  [containerId: string]: View[]
}

export interface ViewContainerContributions {
  activitybar?: ViewContainer[]
  panel?: ViewContainer[]
}

export interface View {
  id: string
  name: string
  when?: string
  icon?: string
  contextualTitle?: string
  visibility?: 'visible' | 'hidden' | 'collapsed'
}

export interface ViewContainer {
  id: string
  title: string
  icon: string
}

export interface PluginCapabilities {
  untrustedWorkspaces?: {
    supported: boolean
    description?: string
  }
  virtualWorkspaces?: {
    supported: boolean
    description?: string
  }
}

// ==================== REGISTRY ENTRIES ====================

export interface PluginRegistryEntry {
  id: PluginId
  publisherId: PublisherId
  manifest: PluginManifest
  status: RegistryStatus
  metadata: PluginMetadata
  versions: Map<Version, VersionMetadata>
  securityInfo: SecurityInfo
  stats: PluginStats
}

export interface PluginMetadata {
  createdAt: Timestamp
  updatedAt: Timestamp
  version: Version
  description: string
  categories: RegistryCategory[]
  keywords: string[]
  license: string
  homepage?: Url
  repository?: Url
  icon?: string
  preview: boolean
  verified: boolean
}

export interface VersionMetadata {
  version: Version
  manifest: PluginManifest
  publishedAt: Timestamp
  status: RegistryStatus
  size: FileSize
  checksum: Checksum
  downloadUrl?: Url
  changelog?: string
  readme?: string
  deprecationMessage?: string
}

export interface SecurityInfo {
  riskLevel: SecurityRiskLevel
  scanDate?: Timestamp
  permissions: string[]
  capabilities: PluginCapabilities
  signatureValid?: boolean
  trustedPublisher: boolean
}

export interface PluginStats {
  downloads: number
  rating: number
  reviewCount: number
  lastDownload?: Timestamp
  trending: boolean
  popularityScore: number
}

// ==================== PUBLISHER INFO ====================

export interface PublisherInfo {
  id: PublisherId
  name: string
  displayName?: string
  email?: string
  website?: Url
  avatar?: string
  bio?: string
  verified: boolean
  joinedAt: Timestamp
  pluginCount: number
  totalDownloads: number
  averageRating: number
  socialLinks?: SocialLinks
}

export interface SocialLinks {
  twitter?: string
  github?: string
  linkedin?: string
  website?: string
  [platform: string]: string | undefined
}

// ==================== REVIEWS AND RATINGS ====================

export interface Review {
  id: string
  userId: string
  pluginId: PluginId
  rating: number // 1-5
  review: string
  helpful: number
  reported: boolean
  createdAt: Timestamp
  updatedAt?: Timestamp
  metadata: ReviewMetadata
}

export interface ReviewMetadata {
  version: Version
  platform: string
  verified: boolean
  [key: string]: any
}

export interface RatingStats {
  average: number
  distribution: { [rating: number]: number }
  total: number
}

// ==================== SEARCH AND DISCOVERY ====================

export interface SearchOptions {
  category?: RegistryCategory
  tag?: string
  publisher?: PublisherId
  sortBy?: 'popularity' | 'downloads' | 'rating' | 'recent' | 'name'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
  includePreview?: boolean
  minRating?: number
  verified?: boolean
  riskLevel?: SecurityRiskLevel
}

export interface SearchResult {
  plugins: PluginSummary[]
  total: number
  page: number
  limit: number
  totalPages: number
  hasMore: boolean
  facets?: SearchFacets
}

export interface PluginSummary {
  id: PluginId
  name: string
  displayName: string
  description: string
  version: Version
  author: string | AuthorInfo
  publisher: PublisherId
  license: string
  categories: RegistryCategory[]
  keywords: string[]
  icon?: string
  verified: boolean
  featured: boolean
  preview: boolean
  downloads: number
  rating: number
  reviewCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
  status: RegistryStatus
  securityInfo: {
    riskLevel: SecurityRiskLevel
    scanDate?: Timestamp
  }
}

export interface SearchFacets {
  categories: { [category: string]: number }
  publishers: { [publisher: string]: number }
  licenses: { [license: string]: number }
  ratings: { [rating: number]: number }
}

// ==================== API RESPONSES ====================

export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  SERVER_ERROR: 'server_error'
} as const

export type ApiStatus = typeof API_STATUS[keyof typeof API_STATUS]

export interface ApiResponse<T = any> {
  status: ApiStatus
  statusCode: number
  data?: T
  message?: string
  errors?: ApiError[]
  pagination?: PaginationInfo
  headers: Record<string, string>
  cached?: boolean
  stale?: boolean
}

export interface ApiError {
  code: string
  message: string
  field?: string
  details?: any
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

// ==================== INSTALLATION ====================

export const INSTALL_STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  EXTRACTING: 'extracting',
  INSTALLING: 'installing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export type InstallStatus = typeof INSTALL_STATUS[keyof typeof INSTALL_STATUS]

export const INSTALL_TYPE = {
  NEW: 'new',
  UPDATE: 'update',
  ROLLBACK: 'rollback',
  REINSTALL: 'reinstall'
} as const

export type InstallType = typeof INSTALL_TYPE[keyof typeof INSTALL_TYPE]

export interface InstallationInfo {
  id: string
  pluginId: PluginId
  version: Version
  type: InstallType
  status: InstallStatus
  progress: number // 0-100
  startTime: Timestamp
  endTime?: Timestamp
  dependencies: DependencyInfo[]
  rollbackData?: any
  error?: string
  manifest?: PluginManifest
  size?: FileSize
  packagePath?: string
  checksum?: Checksum
}

export interface DependencyInfo {
  id: PluginId
  version: Version
  required: boolean
  source: 'registry' | 'local' | 'git'
  resolved?: boolean
}

export interface InstallationRecord {
  pluginId: PluginId
  version: Version
  installDate: Timestamp
  installId: string
  type: InstallType
  manifest: PluginManifest
  dependencies: PluginId[]
  size: FileSize
  checksum: Checksum
}

// ==================== PUBLISHING ====================

export const PUBLISH_STATUS = {
  PREPARING: 'preparing',
  VALIDATING: 'validating',
  PACKAGING: 'packaging',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const

export type PublishStatus = typeof PUBLISH_STATUS[keyof typeof PUBLISH_STATUS]

export const VALIDATION_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
} as const

export type ValidationSeverity = typeof VALIDATION_SEVERITY[keyof typeof VALIDATION_SEVERITY]

export interface PublishInfo {
  id: string
  pluginId?: PluginId
  projectPath?: string
  packagePath?: string
  status: PublishStatus
  progress: number // 0-100
  startTime: Timestamp
  endTime?: Timestamp
  manifest?: PluginManifest
  size?: FileSize
  checksum?: Checksum
  remoteId?: string
  publishUrl?: Url
  error?: string
  validationResults?: ValidationResult[]
}

export interface ValidationResult {
  valid: boolean
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  info: ValidationIssue[]
  fixableIssues: ValidationIssue[]
}

export interface ValidationIssue {
  severity: ValidationSeverity
  message: string
  file?: string
  field?: string
  line?: number
  column?: number
  fixable: boolean
  suggestion?: string
}

// ==================== CONFIGURATION ====================

export const UPDATE_POLICY = {
  AUTOMATIC: 'automatic',
  NOTIFY_ONLY: 'notify_only',
  MANUAL: 'manual',
  DISABLED: 'disabled'
} as const

export type UpdatePolicy = typeof UPDATE_POLICY[keyof typeof UPDATE_POLICY]

export const SECURITY_LEVEL = {
  STRICT: 'strict',
  STANDARD: 'standard',
  PERMISSIVE: 'permissive'
} as const

export type SecurityLevel = typeof SECURITY_LEVEL[keyof typeof SECURITY_LEVEL]

export interface RegistryConfiguration {
  version: string
  registries: { [id: string]: RegistryEndpoint }
  authentication: AuthenticationConfig
  updates: UpdateConfig
  security: SecurityConfig
  network: NetworkConfig
  cache: CacheConfig
  installation: InstallationConfig
  analytics: AnalyticsConfig
  ui: UIConfig
  developer: DeveloperConfig
}

export interface RegistryEndpoint {
  name: string
  url: Url
  enabled: boolean
  priority: number
  verified: boolean
  mirrors: Url[]
  auth?: AuthConfig
}

export interface AuthConfig {
  type: 'none' | 'api_key' | 'oauth' | 'jwt'
  token?: string
  username?: string
  password?: string
  clientId?: string
  clientSecret?: string
}

export interface AuthenticationConfig {
  method: 'api_key' | 'oauth' | 'jwt'
  autoRefresh: boolean
  sessionTimeout: number
  rememberCredentials: boolean
}

export interface UpdateConfig {
  policy: UpdatePolicy
  checkInterval: number
  autoInstallSecurity: boolean
  preReleaseChannels: boolean
  notificationSettings: {
    major: boolean
    minor: boolean
    patch: boolean
    security: boolean
  }
}

export interface SecurityConfig {
  level: SecurityLevel
  verifySignatures: boolean
  allowUntrustedPublishers: boolean
  sandboxMode: boolean
  permissionPrompts: boolean
  trustedPublishers: PublisherId[]
  blockedPublishers: PublisherId[]
  maxPackageSize: FileSize
  allowedFileTypes: string[]
}

export interface NetworkConfig {
  timeout: number
  retryAttempts: number
  retryDelay: number
  maxConcurrentDownloads: number
  useProxy: boolean
  proxyUrl?: Url
  userAgent: string
}

export interface CacheConfig {
  enabled: boolean
  maxSize: FileSize
  maxAge: number
  compressionEnabled: boolean
  persistOffline: boolean
}

export interface InstallationConfig {
  autoResolveDependencies: boolean
  dependencyStrategy: 'auto' | 'prompt' | 'strict' | 'ignore'
  backupBeforeUpdate: boolean
  cleanupOnFailure: boolean
  parallelInstalls: boolean
  installLocation?: string
}

export interface AnalyticsConfig {
  enabled: boolean
  collectUsageStats: boolean
  collectErrorReports: boolean
  collectPerformanceMetrics: boolean
  shareWithPublishers: boolean
}

export interface UIConfig {
  theme: 'auto' | 'light' | 'dark'
  showPreviewPlugins: boolean
  defaultSortBy: string
  itemsPerPage: number
  showDetailedProgress: boolean
  confirmBeforeInstall: boolean
}

export interface DeveloperConfig {
  enableDeveloperMode: boolean
  showDebugInfo: boolean
  allowLocalPackages: boolean
  localRegistryPath?: string
  publishSettings: {
    autoPublish: boolean
    defaultLicense: string
    includeSourceMaps: boolean
    minifyCode: boolean
  }
}

// ==================== STORAGE ====================

export const STORAGE_TYPE = {
  CACHE: 'cache',
  METADATA: 'metadata',
  INSTALLATION: 'installation',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics'
} as const

export type StorageType = typeof STORAGE_TYPE[keyof typeof STORAGE_TYPE]

export const CACHE_POLICY = {
  NO_CACHE: 'no_cache',
  CACHE_FIRST: 'cache_first',
  NETWORK_FIRST: 'network_first',
  STALE_WHILE_REVALIDATE: 'stale_while_revalidate'
} as const

export type CachePolicy = typeof CACHE_POLICY[keyof typeof CACHE_POLICY]

export interface StorageEntry {
  key: string
  data: any
  type: StorageType
  timestamp: number
  ttl: number
  size: number
  compressed: boolean
  encrypted: boolean
  persistedAt?: number
}

export interface StorageStats {
  totalSize: number
  cacheSize: number
  metadataSize: number
  lastCleanup?: number
  cacheEntries: number
  metadataEntries: number
}

// ==================== ANALYTICS ====================

export interface AnalyticsEvent {
  event: string
  data: any
  timestamp: Timestamp
  userId?: string
  sessionId?: string
  pluginId?: PluginId
  version?: Version
}

export interface DownloadStats {
  total: number
  daily: { [date: string]: number }
  weekly: { [date: string]: number }
  monthly: { [date: string]: number }
  versions: { [version: string]: number }
}

export interface UsageMetrics {
  activeUsers: number
  sessionsPerUser: number
  averageSessionDuration: number
  retentionRate: number
  crashRate: number
  performanceMetrics: PerformanceMetrics
}

export interface PerformanceMetrics {
  loadTime: number
  activationTime: number
  memoryUsage: number
  cpuUsage: number
  networkRequests: number
}

// ==================== CLASS INTERFACES ====================

export interface IPluginRegistry extends EventEmitter {
  initialize(): Promise<void>
  registerPlugin(manifest: PluginManifest, publisherInfo: PublisherInfo): Promise<any>
  addPluginVersion(pluginId: PluginId, manifest: PluginManifest, packageInfo: any): Promise<any>
  searchPlugins(query: string, options?: SearchOptions): Promise<SearchResult>
  getPluginDetails(pluginId: PluginId, version?: Version): Promise<any>
  getFeaturedPlugins(limit?: number): Promise<PluginSummary[]>
  getPluginStats(pluginId: PluginId): Promise<any>
  addReview(pluginId: PluginId, userId: string, rating: number, review: string, metadata?: any): Promise<any>
  trackDownload(pluginId: PluginId, version: Version, metadata?: any): Promise<any>
}

export interface IRegistryAPI extends EventEmitter {
  authenticate(method: string, credentials: any): Promise<any>
  searchPlugins(query: string, options?: SearchOptions): Promise<ApiResponse<SearchResult>>
  getPlugin(pluginId: PluginId, version?: Version): Promise<ApiResponse>
  downloadPlugin(pluginId: PluginId, version?: Version): Promise<ApiResponse>
  publishPlugin(pluginData: any, packageFile: File | Blob): Promise<ApiResponse>
  submitReview(pluginId: PluginId, rating: number, review: string, metadata?: any): Promise<ApiResponse>
}

export interface IPluginInstaller extends EventEmitter {
  initialize(): Promise<void>
  installPlugin(pluginId: PluginId, version?: Version, options?: any): Promise<any>
  uninstallPlugin(pluginId: PluginId, options?: any): Promise<any>
  updatePlugin(pluginId: PluginId, options?: any): Promise<any>
  rollbackPlugin(pluginId: PluginId, targetVersion?: Version): Promise<any>
  checkUpdates(pluginIds?: PluginId[]): Promise<any[]>
}

export interface IRegistryStorage extends EventEmitter {
  initialize(): Promise<void>
  set(key: string, data: any, options?: any): Promise<boolean>
  get(key: string, options?: any): Promise<any>
  delete(key: string): Promise<boolean>
  has(key: string): Promise<boolean>
  clear(type?: StorageType): Promise<number>
}

export interface IRegistryConfig extends EventEmitter {
  initialize(): Promise<void>
  get(key: string, defaultValue?: any): any
  set(key: string, value: any, save?: boolean): Promise<boolean>
  update(updates: Record<string, any>, save?: boolean): Promise<any[]>
  loadConfig(): Promise<void>
  saveConfig(): Promise<void>
}

export interface IPluginPublisher extends EventEmitter {
  initialize(): Promise<void>
  createProject(name: string, options?: any): Promise<any>
  validateProject(projectPath: string, options?: any): Promise<ValidationResult>
  packageProject(projectPath: string, options?: any): Promise<any>
  publishPlugin(packagePath: string, options?: any): Promise<any>
  updatePlugin(pluginId: PluginId, packagePath: string, options?: any): Promise<any>
}

// ==================== UTILITY TYPES ====================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>

export type OptionalBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type EventMap = {
  [event: string]: (...args: any[]) => void
}

// ==================== EVENT TYPES ====================

export interface RegistryEventMap extends EventMap {
  initialized: () => void
  plugin_registered: (data: { pluginId: PluginId; registryEntry: PluginRegistryEntry }) => void
  plugin_version_added: (data: { pluginId: PluginId; version: Version; versionInfo: VersionMetadata }) => void
  review_added: (data: { pluginId: PluginId; userId: string; reviewEntry: Review }) => void
  download_tracked: (data: { pluginId: PluginId; version: Version; metadata: any }) => void
  publisher_verified: (data: { publisherId: PublisherId }) => void
}

export interface InstallerEventMap extends EventMap {
  initialized: () => void
  install_started: (installation: InstallationInfo) => void
  install_progress: (installation: InstallationInfo) => void
  install_completed: (installation: InstallationInfo) => void
  install_failed: (data: { installation: InstallationInfo; error: Error }) => void
  uninstall_started: (data: { pluginId: PluginId }) => void
  uninstall_completed: (data: { pluginId: PluginId }) => void
  download_started: (download: any) => void
  download_progress: (data: { download: any; progress: any }) => void
  download_completed: (download: any) => void
}

export interface PublisherEventMap extends EventMap {
  initialized: () => void
  project_creation_started: (publication: PublishInfo) => void
  project_created: (publication: PublishInfo) => void
  project_creation_failed: (data: { publication: PublishInfo; error: Error }) => void
  validation_started: (data: { projectPath: string }) => void
  validation_completed: (data: { projectPath: string; validationResults: ValidationResult }) => void
  packaging_started: (publication: PublishInfo) => void
  packaging_completed: (publication: PublishInfo) => void
  packaging_failed: (data: { publication: PublishInfo; error: Error }) => void
  publishing_started: (publication: PublishInfo) => void
  publishing_progress: (publication: PublishInfo) => void
  publishing_completed: (publication: PublishInfo) => void
  publishing_failed: (data: { publication: PublishInfo; error: Error }) => void
}

export interface StorageEventMap extends EventMap {
  initialized: () => void
  entry_stored: (data: { key: string; type: StorageType; size: number }) => void
  entry_accessed: (data: { key: string; type: StorageType; stale: boolean }) => void
  entry_deleted: (data: { key: string }) => void
  storage_cleared: (data: { type?: StorageType; count: number }) => void
  cleanup_completed: (data: { cleanedCount: number; reclaimedSpace: number; totalSize: number }) => void
  backup_created: (data: { backupId: string; path: string }) => void
  backup_restored: (data: { backupId: string }) => void
}

export interface ConfigEventMap extends EventMap {
  initialized: (config: RegistryConfiguration) => void
  config_loaded: (config: RegistryConfiguration) => void
  config_saved: (config: RegistryConfiguration) => void
  config_changed: (data: { key: string; oldValue: any; newValue: any }) => void
  config_updated: (changes: Array<{ key: string; oldValue: any; newValue: any }>) => void
  config_migrated: (data: { from: string; to: string }) => void
  config_imported: (data: { merge: boolean; version: string }) => void
  config_reset: () => void
  registry_added: (data: { id: string; registry: RegistryEndpoint }) => void
  registry_removed: (data: { id: string }) => void
  registry_updated: (data: { id: string; registry: RegistryEndpoint }) => void
  publisher_trusted: (data: { publisherId: PublisherId }) => void
  publisher_untrusted: (data: { publisherId: PublisherId }) => void
  publisher_blocked: (data: { publisherId: PublisherId }) => void
  publisher_unblocked: (data: { publisherId: PublisherId }) => void
  environment_changed: (data: { environment: string }) => void
  preset_applied: (data: { preset: string }) => void
}

export interface APIEventMap extends EventMap {
  authenticated: (data: { method: string; token: string }) => void
  token_refreshed: (data: { token: string }) => void
  logged_out: () => void
  online: () => void
  offline: () => void
  synced: () => void
}

// ==================== EXPORTS ====================

export * from './api.d.ts'
export * from './installer.d.ts'
export * from './publisher.d.ts'
export * from './storage.d.ts'
export * from './config.d.ts'