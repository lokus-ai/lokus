/**
 * @fileoverview Plugin lifecycle types and event definitions
 */

import type { LokusAPI } from './api/index.js'
import type { PluginManifest } from './manifest.js'
import type { Permission } from './permissions.js'
import type { Disposable } from './utilities.js'

/**
 * Plugin context provided during activation
 */
export interface PluginContext {
  /** Plugin's unique identifier */
  readonly pluginId: string

  /** Plugin manifest */
  readonly manifest: PluginManifest

  /** Lokus API instance */
  readonly api: LokusAPI

  /** Plugin's storage directory */
  readonly storageUri: string

  /** Plugin's global storage directory */
  readonly globalStorageUri: string

  /** Plugin's asset URI */
  readonly assetUri: string

  /** Plugin's log output channel */
  readonly logPath: string

  /** Plugin's extension mode */
  readonly extensionMode: ExtensionMode

  /** Plugin's runtime environment */
  readonly environment: PluginEnvironment

  /** Granted permissions */
  readonly permissions: ReadonlySet<Permission>

  /** Plugin subscriptions for cleanup */
  readonly subscriptions: Disposable[]

  /** Global state accessor */
  readonly globalState: Memento

  /** Workspace state accessor */
  readonly workspaceState: Memento

  /** Secrets storage */
  readonly secrets: SecretStorage
}

/**
 * Plugin activation context
 */
export type PluginActivateContext = PluginContext

/**
 * Plugin deactivation context
 */
export type PluginDeactivateContext = PluginContext

/**
 * Extension mode
 */
export enum ExtensionMode {
  /** Production mode */
  Production = 1,

  /** Development mode */
  Development = 2,

  /** Test mode */
  Test = 3
}

/**
 * Plugin runtime environment
 */
export interface PluginEnvironment {
  /** Lokus version */
  lokusVersion: string

  /** Node.js version */
  nodeVersion: string

  /** Operating system */
  platform: 'win32' | 'darwin' | 'linux'

  /** Architecture */
  arch: 'x64' | 'arm64' | 'ia32'

  /** App name */
  appName: string

  /** App version */
  appVersion: string

  /** App root directory */
  appRoot: string

  /** User data directory */
  userDataDir: string

  /** Temporary directory */
  tmpDir: string

  /** Whether running in development mode */
  isDevelopment: boolean

  /** Whether running in test environment */
  isTesting: boolean

  /** Session ID */
  sessionId: string

  /** Machine ID (anonymized) */
  machineId: string

  /** Language/locale */
  language: string

  /** UI scale factor */
  uiScale: number

  /** Whether high contrast is enabled */
  highContrast: boolean

  /** Accessibility features enabled */
  accessibility: {
    screenReader: boolean
    reducedMotion: boolean
    highContrast: boolean
  }

  /** Performance hints */
  performance: {
    cpuCount: number
    memoryTotal: number
    memoryFree: number
  }
}

/**
 * Key-value storage interface
 */
export interface Memento {
  /**
   * Get a value
   */
  get<T>(key: string): T | undefined
  get<T>(key: string, defaultValue: T): T

  /**
   * Update a value
   */
  update(key: string, value: unknown): Promise<void>

  /**
   * Get all keys
   */
  keys(): readonly string[]

  /**
   * Set when clause contexts
   */
  setKeysForSync(keys: readonly string[]): void
}

/**
 * Secret storage interface
 */
export interface SecretStorage {
  /**
   * Store a secret
   */
  store(key: string, value: string): Promise<void>

  /**
   * Retrieve a secret
   */
  get(key: string): Promise<string | undefined>

  /**
   * Delete a secret
   */
  delete(key: string): Promise<void>

  /**
   * Event fired when a secret changes
   */
  onDidChange: Event<SecretStorageChangeEvent>
}

/**
 * Secret storage change event
 */
export interface SecretStorageChangeEvent {
  /** The key that changed */
  key: string
}

/**
 * Plugin lifecycle events
 */
export enum PluginLifecycleEvent {
  /** Plugin is being loaded */
  LOADING = 'loading',

  /** Plugin has been loaded */
  LOADED = 'loaded',

  /** Plugin is being activated */
  ACTIVATING = 'activating',

  /** Plugin has been activated */
  ACTIVATED = 'activated',

  /** Plugin is being deactivated */
  DEACTIVATING = 'deactivating',

  /** Plugin has been deactivated */
  DEACTIVATED = 'deactivated',

  /** Plugin is being unloaded */
  UNLOADING = 'unloading',

  /** Plugin has been unloaded */
  UNLOADED = 'unloaded',

  /** Plugin encountered an error */
  ERROR = 'error',

  /** Plugin configuration changed */
  CONFIG_CHANGED = 'config-changed',

  /** Plugin permissions changed */
  PERMISSIONS_CHANGED = 'permissions-changed'
}

/**
 * Plugin lifecycle state
 */
export enum PluginLifecycleState {
  /** Plugin is not loaded */
  NOT_LOADED = 'not-loaded',

  /** Plugin is loading */
  LOADING = 'loading',

  /** Plugin is loaded but not active */
  LOADED = 'loaded',

  /** Plugin is activating */
  ACTIVATING = 'activating',

  /** Plugin is active */
  ACTIVE = 'active',

  /** Plugin is deactivating */
  DEACTIVATING = 'deactivating',

  /** Plugin is in error state */
  ERROR = 'error',

  /** Plugin is disabled */
  DISABLED = 'disabled'
}

/**
 * Plugin lifecycle event data
 */
export interface PluginLifecycleEventData {
  /** Plugin ID */
  pluginId: string

  /** Event type */
  event: PluginLifecycleEvent

  /** Previous state */
  previousState?: PluginLifecycleState

  /** Current state */
  currentState: PluginLifecycleState

  /** Event timestamp */
  timestamp: Date

  /** Error if event was caused by an error */
  error?: Error

  /** Additional event data */
  data?: Record<string, unknown>
}

/**
 * Plugin activation trigger
 */
export enum ActivationTrigger {
  /** Activate immediately on startup */
  STARTUP = 'startup',

  /** Activate when workspace contains specific files */
  WORKSPACE_CONTAINS = 'workspaceContains',

  /** Activate when specific file type is opened */
  ON_LANGUAGE = 'onLanguage',

  /** Activate when specific command is executed */
  ON_COMMAND = 'onCommand',

  /** Activate when specific view is opened */
  ON_VIEW = 'onView',

  /** Activate when specific file pattern matches */
  ON_FILE_SYSTEM = 'onFileSystem',

  /** Activate when debug session starts */
  ON_DEBUG = 'onDebug',

  /** Activate when task runs */
  ON_TASK = 'onTask',

  /** Activate when specific setting changes */
  ON_SETTING_CHANGED = 'onSettingChanged',

  /** Activate when URI scheme is opened */
  ON_URI = 'onUri',

  /** Activate when web view panel opens */
  ON_WEBVIEW_PANEL = 'onWebviewPanel',

  /** Activate when custom event occurs */
  ON_CUSTOM_EVENT = 'onCustomEvent',

  /** Manual activation only */
  MANUAL = 'manual'
}

/**
 * Activation event specification
 */
export interface ActivationEvent {
  /** Activation trigger type */
  trigger: ActivationTrigger

  /** Pattern or value for the trigger */
  pattern?: string

  /** Additional conditions */
  when?: string

  /** Event priority */
  priority?: number

  /** Whether activation is lazy */
  lazy?: boolean
}

/**
 * Plugin deactivation reason
 */
export enum DeactivationReason {
  /** User manually disabled plugin */
  USER_DISABLED = 'user-disabled',

  /** Plugin was uninstalled */
  UNINSTALLED = 'uninstalled',

  /** Plugin encountered an error */
  ERROR = 'error',

  /** Plugin dependencies missing */
  MISSING_DEPENDENCIES = 'missing-dependencies',

  /** Lokus is shutting down */
  SHUTDOWN = 'shutdown',

  /** Plugin update requires restart */
  UPDATE = 'update',

  /** Permission revoked */
  PERMISSION_REVOKED = 'permission-revoked',

  /** Resource limits exceeded */
  RESOURCE_LIMITS = 'resource-limits',

  /** Security violation */
  SECURITY_VIOLATION = 'security-violation'
}

/**
 * Plugin deactivation event data
 */
export interface PluginDeactivationEvent {
  /** Plugin ID */
  pluginId: string

  /** Deactivation reason */
  reason: DeactivationReason

  /** Error that caused deactivation (if any) */
  error?: Error

  /** Whether deactivation was forced */
  forced?: boolean

  /** Additional context */
  context?: Record<string, unknown>
}

/**
 * Plugin dependency information
 */
export interface PluginDependency {
  /** Dependency plugin ID */
  pluginId: string

  /** Version requirement */
  version: string

  /** Whether dependency is optional */
  optional?: boolean

  /** Dependency type */
  type: 'runtime' | 'development' | 'peer'

  /** Minimum Lokus version required */
  lokusVersion?: string

  /** Platform requirements */
  platforms?: Array<'win32' | 'darwin' | 'linux'>

  /** Architecture requirements */
  architectures?: Array<'x64' | 'arm64' | 'ia32'>
}

/**
 * Plugin compatibility information
 */
export interface PluginCompatibility {
  /** Minimum Lokus version */
  minLokusVersion?: string

  /** Maximum Lokus version */
  maxLokusVersion?: string

  /** Supported platforms */
  platforms?: Array<'win32' | 'darwin' | 'linux'>

  /** Supported architectures */
  architectures?: Array<'x64' | 'arm64' | 'ia32'>

  /** Required Node.js version */
  nodeVersion?: string

  /** Required features */
  features?: string[]

  /** Conflicting plugins */
  conflicts?: string[]
}

/**
 * Plugin lifecycle manager interface
 */
export interface PluginLifecycleManager {
  /**
   * Load a plugin
   */
  loadPlugin(pluginId: string): Promise<void>

  /**
   * Unload a plugin
   */
  unloadPlugin(pluginId: string): Promise<void>

  /**
   * Activate a plugin
   */
  activatePlugin(pluginId: string): Promise<void>

  /**
   * Deactivate a plugin
   */
  deactivatePlugin(pluginId: string, reason?: DeactivationReason): Promise<void>

  /**
   * Get plugin lifecycle state
   */
  getPluginState(pluginId: string): PluginLifecycleState

  /**
   * Check if plugin is active
   */
  isPluginActive(pluginId: string): boolean

  /**
   * Get active plugins
   */
  getActivePlugins(): string[]

  /**
   * Get all plugins
   */
  getAllPlugins(): string[]

  /**
   * Listen to lifecycle events
   */
  onLifecycleEvent(callback: (event: PluginLifecycleEventData) => void): Disposable

  /**
   * Check plugin dependencies
   */
  checkDependencies(pluginId: string): Promise<PluginDependency[]>

  /**
   * Check plugin compatibility
   */
  checkCompatibility(pluginId: string): Promise<PluginCompatibility>

  /**
   * Restart a plugin
   */
  restartPlugin(pluginId: string): Promise<void>

  /**
   * Enable a plugin
   */
  enablePlugin(pluginId: string): Promise<void>

  /**
   * Disable a plugin
   */
  disablePlugin(pluginId: string): Promise<void>
}

/**
 * Event emitter interface
 */
export interface Event<T> {
  /**
   * Subscribe to event
   */
  (listener: (e: T) => unknown, thisArgs?: unknown, disposables?: Disposable[]): Disposable
}

/**
 * Event emitter
 */
export interface EventEmitter<T> {
  /**
   * The event
   */
  event: Event<T>

  /**
   * Fire the event
   */
  fire(data: T): void

  /**
   * Dispose the event emitter
   */
  dispose(): void
}