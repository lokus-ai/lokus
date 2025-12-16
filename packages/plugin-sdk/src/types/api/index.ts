/**
 * @fileoverview Main Lokus API interface types
 */

import type { CommandAPI } from './commands.js'
import type { EditorAPI } from './editor.js'
import type { UIAPI } from './ui.js'
import type { WorkspaceAPI } from './workspace.js'
import type { FileSystemAPI } from './filesystem.js'
import type { NetworkAPI } from './network.js'
import type { StorageAPI } from './storage.js'
// import type { EventAPI } from './events.js' // TODO: Create events.ts
import type { ConfigurationAPI } from './configuration.js'
import type { TaskAPI } from './tasks.js'
import type { DebugAPI } from './debug.js'
import type { LanguageAPI } from './languages.js'
import type { ThemeAPI } from './themes.js'
import type { TerminalAPI } from './terminal.js'
import type { Disposable, Event } from '../utilities.js'
import type { PluginManifest } from '../manifest.js'
import type { Permission } from '../permissions.js'

/**
 * Main Lokus API interface provided to plugins
 */
export interface LokusAPI {
  /** Commands API - Register and execute commands */
  readonly commands: CommandAPI

  /** Editor API - Text editor operations */
  readonly editor: EditorAPI

  /** UI API - User interface extensions */
  readonly ui: UIAPI

  /** Workspace API - Workspace and project operations */
  readonly workspace: WorkspaceAPI

  /** File System API - File operations */
  readonly fs: FileSystemAPI

  /** Network API - HTTP requests and networking */
  readonly network: NetworkAPI

  /** Storage API - Plugin-scoped storage */
  readonly storage: StorageAPI

  /** Event API - Plugin event system */
  // readonly events: EventAPI // TODO: Create events.ts

  /** Task API - Task and build systems */
  readonly tasks: TaskAPI

  /** Debug API - Debugging support */
  readonly debug: DebugAPI

  /** Language API - Language support */
  readonly languages: LanguageAPI

  /** Theme API - Theme registration */
  readonly themes: ThemeAPI

  /** Configuration API - Plugin configuration */
  readonly config: ConfigurationAPI

  /** Terminal API - Terminal operations */
  readonly terminal: TerminalAPI

  /** Plugin ID */
  readonly pluginId: string

  /** Plugin manifest */
  readonly manifest: PluginManifest

  /** Check if plugin has permission */
  hasPermission(permission: Permission): boolean

  /** Add disposable for cleanup */
  addDisposable(disposable: Disposable): void

  /** Get plugin context information */
  getContext(): PluginContext

  /** Log message */
  log(level: LogLevel, message: string, ...args: unknown[]): void
}

/**
 * Plugin context information
 */
export interface PluginContext {
  /** Plugin ID */
  pluginId: string

  /** Plugin version */
  version: string

  /** Whether plugin is active */
  isActive: boolean

  /** Granted permissions */
  permissions: string[]

  /** Plugin storage path */
  storagePath: string

  /** Plugin asset path */
  assetPath: string

  /** Development mode */
  isDevelopment: boolean
}

/**
 * Log levels
 */
export enum LogLevel {
  TRACE = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
  FATAL = 5
}

/**
 * API version information
 */
export interface APIVersion {
  /** Major version */
  major: number

  /** Minor version */
  minor: number

  /** Patch version */
  patch: number

  /** Pre-release tag */
  prerelease?: string

  /** Build metadata */
  build?: string

  /** Full version string */
  version: string
}

/**
 * API compatibility information
 */
export interface APICompatibility {
  /** Current API version */
  current: APIVersion

  /** Minimum supported version */
  minimum: APIVersion

  /** Deprecated features */
  deprecated: Array<{
    feature: string
    since: string
    replacedBy?: string
    willBeRemovedIn?: string
  }>

  /** Breaking changes */
  breakingChanges: Array<{
    version: string
    description: string
    migration?: string
  }>
}

/**
 * API error types
 */
export enum APIErrorCode {
  /** Permission denied */
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  /** Invalid parameters */
  INVALID_PARAMS = 'INVALID_PARAMS',

  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',

  /** Operation not supported */
  NOT_SUPPORTED = 'NOT_SUPPORTED',

  /** Rate limit exceeded */
  RATE_LIMITED = 'RATE_LIMITED',

  /** Resource exhausted */
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',

  /** Internal error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /** Network error */
  NETWORK_ERROR = 'NETWORK_ERROR',

  /** Timeout */
  TIMEOUT = 'TIMEOUT',

  /** Cancelled */
  CANCELLED = 'CANCELLED'
}

/**
 * API error class
 */
export class APIError extends Error {
  constructor(
    public readonly code: APIErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'APIError'
  }
}

/**
 * API request options
 */
export interface APIRequestOptions {
  /** Request timeout in milliseconds */
  timeout?: number

  /** Whether to retry on failure */
  retry?: boolean

  /** Number of retry attempts */
  retries?: number

  /** Retry delay in milliseconds */
  retryDelay?: number

  /** Abort signal */
  signal?: AbortSignal

  /** Request priority */
  priority?: 'low' | 'normal' | 'high'

  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * API response wrapper
 */
export interface APIResponse<T = unknown> {
  /** Response data */
  data: T

  /** Response metadata */
  metadata?: {
    /** Request ID */
    requestId: string

    /** Response time in milliseconds */
    responseTime: number

    /** API version used */
    apiVersion: string

    /** Additional metadata */
    [key: string]: unknown
  }

  /** Pagination info (if applicable) */
  pagination?: {
    /** Current page */
    page: number

    /** Items per page */
    pageSize: number

    /** Total items */
    total: number

    /** Total pages */
    totalPages: number

    /** Has next page */
    hasNext: boolean

    /** Has previous page */
    hasPrevious: boolean
  }
}

/**
 * Paginated request options
 */
export interface PaginatedRequestOptions extends APIRequestOptions {
  /** Page number (1-based) */
  page?: number

  /** Items per page */
  pageSize?: number

  /** Sort field */
  sortBy?: string

  /** Sort order */
  sortOrder?: 'asc' | 'desc'

  /** Filter criteria */
  filter?: Record<string, unknown>
}

/**
 * Progress callback
 */
export interface ProgressCallback {
  (progress: {
    /** Current progress (0-100) */
    percentage: number

    /** Progress message */
    message?: string

    /** Whether operation can be cancelled */
    cancellable?: boolean

    /** Additional progress data */
    data?: Record<string, unknown>
  }): void
}

/**
 * Cancellation token
 */
import type { CancellationToken } from '../models.js'

/**
 * Progress reporter
 */
export interface ProgressReporter {
  /** Report progress */
  report(progress: {
    /** Progress increment */
    increment?: number

    /** Progress message */
    message?: string
  }): void
}

/**
 * Long-running operation options
 */
export interface LongRunningOperationOptions extends APIRequestOptions {
  /** Progress callback */
  onProgress?: ProgressCallback

  /** Cancellation token */
  cancellationToken?: CancellationToken

  /** Operation title */
  title?: string

  /** Whether operation can be cancelled */
  cancellable?: boolean

  /** Whether to show progress in UI */
  showProgress?: boolean

  /** Location to show progress */
  location?: 'notification' | 'window' | 'source-control'
}

// Re-export all API modules
export * from './commands.js'
export * from './editor.js'
export * from './ui.js'
export * from './workspace.js'
export * from './filesystem.js'
export * from './network.js'
export * from './storage.js'
// export * from './events.js' // TODO: Create events.ts
export * from './configuration.js'
export * from './tasks.js'
export * from './debug.js'
export * from './languages.js'
export * from './themes.js'
export * from './terminal.js'