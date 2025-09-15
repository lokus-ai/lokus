/**
 * @fileoverview Core plugin interface and base types
 */

import { Disposable } from './utilities.js'
import { PluginManifest } from './manifest.js'
import { LokusAPI } from './api/index.js'
import { PluginContext } from './lifecycle.js'

/**
 * Main plugin interface that all plugins must implement
 */
export interface Plugin {
  /**
   * Called when the plugin is activated
   * @param context - Plugin activation context
   */
  activate(context: PluginContext): void | Promise<void>

  /**
   * Called when the plugin is deactivated
   * Should clean up all resources
   */
  deactivate?(): void | Promise<void>
}

/**
 * Plugin class constructor interface
 */
export interface PluginConstructor {
  new (): Plugin
}

/**
 * Plugin metadata and runtime information
 */
export interface PluginInfo {
  /** Unique plugin identifier */
  readonly id: string
  
  /** Plugin manifest */
  readonly manifest: PluginManifest
  
  /** Plugin activation state */
  readonly isActive: boolean
  
  /** Plugin activation timestamp */
  readonly activatedAt?: Date
  
  /** Plugin version */
  readonly version: string
  
  /** Plugin display name */
  readonly displayName: string
  
  /** Plugin description */
  readonly description?: string
  
  /** Plugin author */
  readonly author?: string
  
  /** Plugin categories/tags */
  readonly categories?: string[]
  
  /** Plugin icon URL or data URI */
  readonly icon?: string
  
  /** Plugin homepage URL */
  readonly homepage?: string
  
  /** Plugin repository URL */
  readonly repository?: string
  
  /** Plugin license */
  readonly license?: string
  
  /** Plugin dependencies */
  readonly dependencies?: Record<string, string>
  
  /** Plugin peer dependencies */
  readonly peerDependencies?: Record<string, string>
  
  /** Plugin permissions */
  readonly permissions?: string[]
  
  /** Plugin contribution points */
  readonly contributes?: Record<string, unknown>
}

/**
 * Plugin runtime statistics
 */
export interface PluginStats {
  /** Memory usage in bytes */
  memoryUsage: number
  
  /** CPU time consumed in milliseconds */
  cpuTime: number
  
  /** Number of API calls made */
  apiCalls: number
  
  /** Number of events emitted */
  eventsEmitted: number
  
  /** Number of events received */
  eventsReceived: number
  
  /** Number of errors encountered */
  errors: number
  
  /** Plugin uptime in milliseconds */
  uptime: number
  
  /** Last activity timestamp */
  lastActivity: Date
  
  /** Performance metrics */
  performance: {
    averageResponseTime: number
    maxResponseTime: number
    minResponseTime: number
    totalRequests: number
  }
}

/**
 * Plugin health status
 */
export enum PluginStatus {
  /** Plugin is not loaded */
  Unloaded = 'unloaded',
  
  /** Plugin is loading */
  Loading = 'loading',
  
  /** Plugin is loaded but not active */
  Loaded = 'loaded',
  
  /** Plugin is activating */
  Activating = 'activating',
  
  /** Plugin is active and running */
  Active = 'active',
  
  /** Plugin is deactivating */
  Deactivating = 'deactivating',
  
  /** Plugin has encountered an error */
  Error = 'error',
  
  /** Plugin is disabled */
  Disabled = 'disabled'
}

/**
 * Plugin health information
 */
export interface PluginHealth {
  /** Current plugin status */
  status: PluginStatus
  
  /** Health message */
  message?: string
  
  /** Last error if any */
  lastError?: Error
  
  /** Health check timestamp */
  checkedAt: Date
  
  /** Whether plugin is responding */
  responsive: boolean
  
  /** Resource usage warnings */
  warnings: Array<{
    type: 'memory' | 'cpu' | 'api-calls' | 'errors'
    message: string
    severity: 'low' | 'medium' | 'high'
  }>
}

/**
 * Plugin development mode options
 */
export interface PluginDevOptions {
  /** Enable hot reload */
  hotReload?: boolean
  
  /** Enable debug mode */
  debug?: boolean
  
  /** Override permissions for development */
  overridePermissions?: boolean
  
  /** Disable security checks */
  disableSecurityChecks?: boolean
  
  /** Enable detailed logging */
  verboseLogging?: boolean
  
  /** Mock external dependencies */
  mockDependencies?: boolean
  
  /** Development server port */
  devServerPort?: number
  
  /** Source map support */
  sourceMaps?: boolean
}

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  /** Force installation even if incompatible */
  force?: boolean
  
  /** Skip dependency installation */
  skipDependencies?: boolean
  
  /** Install in development mode */
  development?: boolean
  
  /** Override existing plugin */
  override?: boolean
  
  /** Verify plugin signature */
  verifySignature?: boolean
  
  /** Installation directory */
  installDir?: string
  
  /** Enable after installation */
  enable?: boolean
}

/**
 * Plugin search criteria
 */
export interface PluginSearchCriteria {
  /** Search query */
  query?: string
  
  /** Plugin categories */
  categories?: string[]
  
  /** Plugin tags */
  tags?: string[]
  
  /** Plugin author */
  author?: string
  
  /** Minimum version */
  minVersion?: string
  
  /** Maximum version */
  maxVersion?: string
  
  /** Only include enabled plugins */
  enabledOnly?: boolean
  
  /** Only include active plugins */
  activeOnly?: boolean
  
  /** Sort order */
  sortBy?: 'name' | 'version' | 'rating' | 'downloads' | 'updated'
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
  
  /** Maximum results */
  limit?: number
  
  /** Offset for pagination */
  offset?: number
}

/**
 * Plugin update information
 */
export interface PluginUpdate {
  /** Plugin ID */
  pluginId: string
  
  /** Current version */
  currentVersion: string
  
  /** Available version */
  availableVersion: string
  
  /** Update description */
  description?: string
  
  /** Update type */
  type: 'major' | 'minor' | 'patch' | 'prerelease'
  
  /** Whether update is critical */
  critical?: boolean
  
  /** Changelog URL */
  changelogUrl?: string
  
  /** Release notes */
  releaseNotes?: string
  
  /** Update size in bytes */
  size?: number
  
  /** Dependencies that will be updated */
  dependencyUpdates?: Array<{
    name: string
    currentVersion: string
    newVersion: string
  }>
}

/**
 * Base plugin class with common functionality
 */
export abstract class BasePlugin implements Plugin {
  protected context?: PluginContext
  protected api?: LokusAPI
  private disposables: Disposable[] = []

  /**
   * Plugin activation method - must be implemented by subclasses
   */
  abstract activate(context: PluginContext): void | Promise<void>

  /**
   * Plugin deactivation - can be overridden by subclasses
   */
  deactivate(): void | Promise<void> {
    // Dispose all registered disposables
    for (const disposable of this.disposables) {
      try {
        disposable.dispose()
      } catch (error) {
        console.warn('Error disposing resource:', error)
      }
    }
    this.disposables.length = 0
  }

  /**
   * Register a disposable for automatic cleanup
   */
  protected addDisposable(disposable: Disposable): void {
    this.disposables.push(disposable)
  }

  /**
   * Get plugin context
   */
  protected getContext(): PluginContext {
    if (!this.context) {
      throw new Error('Plugin not activated')
    }
    return this.context
  }

  /**
   * Get Lokus API
   */
  protected getAPI(): LokusAPI {
    if (!this.api) {
      throw new Error('Plugin not activated')
    }
    return this.api
  }
}