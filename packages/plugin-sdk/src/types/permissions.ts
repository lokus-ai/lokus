/**
 * @fileoverview Plugin permission types and security definitions
 */

/**
 * Standard plugin permissions
 */
export enum Permission {
  // Editor permissions
  EDITOR_READ = 'editor:read',
  EDITOR_WRITE = 'editor:write',
  EDITOR_EXECUTE = 'editor:execute',
  EDITOR_FORMATTERS = 'editor:formatters',
  EDITOR_COMPLETIONS = 'editor:completions',
  EDITOR_DIAGNOSTICS = 'editor:diagnostics',
  EDITOR_HOVER = 'editor:hover',
  EDITOR_SYMBOLS = 'editor:symbols',
  EDITOR_REFERENCES = 'editor:references',
  EDITOR_RENAME = 'editor:rename',
  EDITOR_FOLDING = 'editor:folding',
  EDITOR_SELECTION = 'editor:selection',

  // UI permissions
  UI_NOTIFICATIONS = 'ui:notifications',
  UI_DIALOGS = 'ui:dialogs',
  UI_PANELS = 'ui:panels',
  UI_MENUS = 'ui:menus',
  UI_TOOLBARS = 'ui:toolbars',
  UI_STATUSBAR = 'ui:statusbar',
  UI_SIDEBARS = 'ui:sidebars',
  UI_VIEWS = 'ui:views',
  UI_WEBVIEWS = 'ui:webviews',
  UI_THEMES = 'ui:themes',

  // Workspace permissions
  WORKSPACE_READ = 'workspace:read',
  WORKSPACE_WRITE = 'workspace:write',
  WORKSPACE_CONFIG = 'workspace:config',
  WORKSPACE_SEARCH = 'workspace:search',
  WORKSPACE_FOLDERS = 'workspace:folders',
  WORKSPACE_FILES = 'workspace:files',
  WORKSPACE_SYMBOLS = 'workspace:symbols',

  // File system permissions
  FS_READ = 'fs:read',
  FS_WRITE = 'fs:write',
  FS_EXECUTE = 'fs:execute',
  FS_DELETE = 'fs:delete',
  FS_CREATE = 'fs:create',
  FS_MOVE = 'fs:move',
  FS_COPY = 'fs:copy',
  FS_WATCH = 'fs:watch',
  FS_PROVIDERS = 'fs:providers',

  // Network permissions
  NETWORK_HTTP = 'network:http',
  NETWORK_HTTPS = 'network:https',
  NETWORK_WEBSOCKET = 'network:websocket',
  NETWORK_PROXY = 'network:proxy',
  NETWORK_LOCAL = 'network:local',

  // Storage permissions
  STORAGE_READ = 'storage:read',
  STORAGE_WRITE = 'storage:write',
  STORAGE_DELETE = 'storage:delete',
  STORAGE_GLOBAL = 'storage:global',
  STORAGE_WORKSPACE = 'storage:workspace',
  STORAGE_SECRETS = 'storage:secrets',

  // Command permissions
  COMMANDS_REGISTER = 'commands:register',
  COMMANDS_EXECUTE = 'commands:execute',
  COMMANDS_LIST = 'commands:list',

  // Event permissions
  EVENTS_LISTEN = 'events:listen',
  EVENTS_EMIT = 'events:emit',
  EVENTS_SYSTEM = 'events:system',

  // Task permissions
  TASKS_EXECUTE = 'tasks:execute',
  TASKS_PROVIDERS = 'tasks:providers',
  TASKS_DEFINITIONS = 'tasks:definitions',

  // Debug permissions
  DEBUG_START = 'debug:start',
  DEBUG_STOP = 'debug:stop',
  DEBUG_ADAPTERS = 'debug:adapters',
  DEBUG_BREAKPOINTS = 'debug:breakpoints',
  DEBUG_VARIABLES = 'debug:variables',

  // Language permissions
  LANGUAGES_REGISTER = 'languages:register',
  LANGUAGES_PROVIDERS = 'languages:providers',
  LANGUAGES_FEATURES = 'languages:features',

  // Terminal permissions
  TERMINAL_CREATE = 'terminal:create',
  TERMINAL_WRITE = 'terminal:write',
  TERMINAL_EXECUTE = 'terminal:execute',

  // System permissions
  SYSTEM_CLIPBOARD = 'system:clipboard',
  SYSTEM_PROCESSES = 'system:processes',
  SYSTEM_ENVIRONMENT = 'system:environment',
  SYSTEM_SHELL = 'system:shell',

  // Configuration permissions
  CONFIG_READ = 'config:read',
  CONFIG_WRITE = 'config:write',
  CONFIG_GLOBAL = 'config:global',
  CONFIG_WORKSPACE = 'config:workspace',

  // Extension permissions
  EXTENSIONS_INSTALL = 'extensions:install',
  EXTENSIONS_UNINSTALL = 'extensions:uninstall',
  EXTENSIONS_ENABLE = 'extensions:enable',
  EXTENSIONS_DISABLE = 'extensions:disable',
  EXTENSIONS_LIST = 'extensions:list',

  // Development permissions
  DEV_CONSOLE = 'dev:console',
  DEV_INSPECT = 'dev:inspect',
  DEV_HOT_RELOAD = 'dev:hot-reload',
  DEV_SOURCE_MAPS = 'dev:source-maps'
}

/**
 * Permission categories for grouping related permissions
 */
export enum PermissionCategory {
  EDITOR = 'editor',
  UI = 'ui',
  WORKSPACE = 'workspace',
  FILE_SYSTEM = 'file-system',
  NETWORK = 'network',
  STORAGE = 'storage',
  COMMANDS = 'commands',
  EVENTS = 'events',
  TASKS = 'tasks',
  DEBUG = 'debug',
  LANGUAGES = 'languages',
  TERMINAL = 'terminal',
  SYSTEM = 'system',
  CONFIGURATION = 'configuration',
  EXTENSIONS = 'extensions',
  DEVELOPMENT = 'development'
}

/**
 * Permission severity levels
 */
export enum PermissionSeverity {
  /** Low risk permissions */
  LOW = 'low',
  
  /** Medium risk permissions */
  MEDIUM = 'medium',
  
  /** High risk permissions */
  HIGH = 'high',
  
  /** Critical permissions that require special approval */
  CRITICAL = 'critical'
}

/**
 * Permission metadata
 */
export interface PermissionMetadata {
  /** Permission identifier */
  permission: Permission
  
  /** Human-readable name */
  name: string
  
  /** Permission description */
  description: string
  
  /** Permission category */
  category: PermissionCategory
  
  /** Risk severity */
  severity: PermissionSeverity
  
  /** Whether this permission is dangerous */
  dangerous?: boolean
  
  /** Rationale for why this permission is needed */
  rationale?: string
  
  /** Examples of what this permission allows */
  examples?: string[]
  
  /** Permissions that this one implies */
  implies?: Permission[]
  
  /** Permissions that conflict with this one */
  conflicts?: Permission[]
  
  /** Minimum Lokus version required */
  minVersion?: string
  
  /** Whether this permission is deprecated */
  deprecated?: boolean
  
  /** Deprecation message */
  deprecationMessage?: string
  
  /** Replacement permission */
  replacement?: Permission
}

/**
 * Permission request context
 */
export interface PermissionRequest {
  /** Plugin requesting the permission */
  pluginId: string
  
  /** Requested permission */
  permission: Permission
  
  /** Reason for requesting this permission */
  reason?: string
  
  /** Whether this is a runtime request */
  runtime?: boolean
  
  /** Request timestamp */
  timestamp: Date
  
  /** Optional context data */
  context?: Record<string, unknown>
}

/**
 * Permission grant result
 */
export interface PermissionGrantResult {
  /** Whether permission was granted */
  granted: boolean
  
  /** Reason for denial (if not granted) */
  reason?: string
  
  /** Whether grant is temporary */
  temporary?: boolean
  
  /** Expiration time for temporary grants */
  expiresAt?: Date
  
  /** Conditions for the grant */
  conditions?: PermissionCondition[]
}

/**
 * Permission condition
 */
export interface PermissionCondition {
  /** Condition type */
  type: 'time' | 'context' | 'user' | 'api-limit' | 'scope'
  
  /** Condition parameters */
  parameters: Record<string, unknown>
  
  /** Human-readable description */
  description: string
}

/**
 * Permission policy
 */
export interface PermissionPolicy {
  /** Plugin ID this policy applies to */
  pluginId: string
  
  /** Granted permissions */
  granted: Set<Permission>
  
  /** Denied permissions */
  denied: Set<Permission>
  
  /** Temporary grants */
  temporary: Map<Permission, Date>
  
  /** Permission conditions */
  conditions: Map<Permission, PermissionCondition[]>
  
  /** Policy version */
  version: number
  
  /** Last updated timestamp */
  updatedAt: Date
  
  /** Policy creator */
  createdBy?: 'user' | 'admin' | 'system'
  
  /** Whether policy is readonly */
  readonly?: boolean
}

/**
 * Permission audit log entry
 */
export interface PermissionAuditEntry {
  /** Unique entry ID */
  id: string
  
  /** Plugin ID */
  pluginId: string
  
  /** Permission involved */
  permission: Permission
  
  /** Action taken */
  action: 'granted' | 'denied' | 'revoked' | 'requested' | 'used'
  
  /** Timestamp */
  timestamp: Date
  
  /** User or system that performed the action */
  actor: string
  
  /** Reason for the action */
  reason?: string
  
  /** Additional context */
  context?: Record<string, unknown>
  
  /** Client information */
  client?: {
    userAgent?: string
    ip?: string
    location?: string
  }
}

/**
 * Permission validator
 */
export interface PermissionValidator {
  /**
   * Validate if a plugin has a specific permission
   */
  hasPermission(pluginId: string, permission: Permission): boolean
  
  /**
   * Validate multiple permissions
   */
  hasPermissions(pluginId: string, permissions: Permission[]): boolean
  
  /**
   * Check if permission is available for request
   */
  canRequest(pluginId: string, permission: Permission): boolean
  
  /**
   * Get effective permissions for a plugin
   */
  getEffectivePermissions(pluginId: string): Permission[]
  
  /**
   * Check permission conditions
   */
  checkConditions(pluginId: string, permission: Permission, context?: Record<string, unknown>): boolean
}

/**
 * Permission manager interface
 */
export interface PermissionManager extends PermissionValidator {
  /**
   * Request permission for a plugin
   */
  requestPermission(request: PermissionRequest): Promise<PermissionGrantResult>
  
  /**
   * Grant permission to a plugin
   */
  grantPermission(pluginId: string, permission: Permission, conditions?: PermissionCondition[]): Promise<void>
  
  /**
   * Revoke permission from a plugin
   */
  revokePermission(pluginId: string, permission: Permission): Promise<void>
  
  /**
   * Update permission policy
   */
  updatePolicy(pluginId: string, policy: Partial<PermissionPolicy>): Promise<void>
  
  /**
   * Get permission policy for a plugin
   */
  getPolicy(pluginId: string): PermissionPolicy | undefined
  
  /**
   * Get all permission policies
   */
  getAllPolicies(): Map<string, PermissionPolicy>
  
  /**
   * Get permission audit log
   */
  getAuditLog(filters?: {
    pluginId?: string
    permission?: Permission
    action?: string
    startDate?: Date
    endDate?: Date
    limit?: number
  }): Promise<PermissionAuditEntry[]>
  
  /**
   * Clear expired temporary permissions
   */
  cleanupExpiredPermissions(): Promise<void>
  
  /**
   * Export permissions for backup
   */
  exportPermissions(): Promise<string>
  
  /**
   * Import permissions from backup
   */
  importPermissions(data: string, merge?: boolean): Promise<void>
}

/**
 * Security context for permission evaluation
 */
export interface SecurityContext {
  /** Current user */
  user?: {
    id: string
    role: string
    permissions: string[]
  }
  
  /** Current workspace */
  workspace?: {
    id: string
    type: 'local' | 'remote' | 'cloud'
    trusted: boolean
  }
  
  /** Environment information */
  environment: {
    development: boolean
    testing: boolean
    production: boolean
  }
  
  /** Network context */
  network?: {
    online: boolean
    restricted: boolean
    vpn: boolean
  }
  
  /** Additional context data */
  metadata?: Record<string, unknown>
}

/**
 * Permission scope definition
 */
export interface PermissionScope {
  /** Scope identifier */
  id: string
  
  /** Scope name */
  name: string
  
  /** Scope description */
  description: string
  
  /** Permissions included in this scope */
  permissions: Permission[]
  
  /** Whether scope is expandable */
  expandable?: boolean
  
  /** Child scopes */
  children?: PermissionScope[]
  
  /** Parent scope */
  parent?: string
}

/**
 * Predefined permission scopes
 */
export const PermissionScopes = {
  /** Basic read-only access */
  READONLY: {
    id: 'readonly',
    name: 'Read-only Access',
    description: 'Safe read-only operations',
    permissions: [
      Permission.EDITOR_READ,
      Permission.WORKSPACE_READ,
      Permission.FS_READ,
      Permission.CONFIG_READ
    ]
  },
  
  /** Basic editor functionality */
  EDITOR_BASIC: {
    id: 'editor-basic',
    name: 'Basic Editor',
    description: 'Basic text editing capabilities',
    permissions: [
      Permission.EDITOR_READ,
      Permission.EDITOR_WRITE,
      Permission.EDITOR_SELECTION,
      Permission.EDITOR_FORMATTERS
    ]
  },
  
  /** UI customization */
  UI_BASIC: {
    id: 'ui-basic',
    name: 'Basic UI',
    description: 'Basic UI customization',
    permissions: [
      Permission.UI_NOTIFICATIONS,
      Permission.UI_PANELS,
      Permission.UI_STATUSBAR
    ]
  },
  
  /** File system access */
  FILESYSTEM: {
    id: 'filesystem',
    name: 'File System',
    description: 'File system read/write access',
    permissions: [
      Permission.FS_READ,
      Permission.FS_WRITE,
      Permission.FS_CREATE,
      Permission.FS_DELETE
    ]
  },
  
  /** Network access */
  NETWORK: {
    id: 'network',
    name: 'Network Access',
    description: 'Network communication capabilities',
    permissions: [
      Permission.NETWORK_HTTP,
      Permission.NETWORK_HTTPS
    ]
  },
  
  /** Full access (dangerous) */
  FULL_ACCESS: {
    id: 'full-access',
    name: 'Full Access',
    description: 'Complete system access (use with caution)',
    permissions: Object.values(Permission)
  }
} as const