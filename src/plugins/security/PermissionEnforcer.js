/**
 * Permission Enforcer - Runtime permission enforcement for plugin APIs
 *
 * Provides:
 * - PermissionDeniedError for unauthorized access attempts
 * - requirePermission() to check permissions before API calls
 * - Path scoping to restrict filesystem access to workspace
 * - Audit logging for all permission checks
 */

import { EventEmitter } from '../../utils/EventEmitter.js';

/**
 * Error thrown when a plugin attempts to use an API without permission
 */
export class PermissionDeniedError extends Error {
  constructor(pluginId, requiredPermission, apiMethod) {
    const message = `Permission denied: Plugin '${pluginId}' requires '${requiredPermission}' permission to call '${apiMethod}'`;
    super(message);
    this.name = 'PermissionDeniedError';
    this.pluginId = pluginId;
    this.requiredPermission = requiredPermission;
    this.apiMethod = apiMethod;
    this.timestamp = Date.now();
  }
}

/**
 * Permission to API method mapping
 * Defines which permission is required for each API method
 */
export const PERMISSION_MAP = {
  // Editor permissions
  'editor.addExtension': 'editor:write',
  'editor.removeExtension': 'editor:write',
  'editor.addSlashCommand': 'editor:write',
  'editor.addContextMenuItem': 'editor:write',
  'editor.addDropHandler': 'editor:write',
  'editor.insertNode': 'editor:write',
  'editor.getSelection': 'editor:read',
  'editor.replaceSelection': 'editor:write',
  'editor.addKeyboardShortcut': 'editor:write',
  'editor.addToolbarItem': 'editor:write',
  'editor.getText': 'editor:read',
  'editor.onUpdate': 'editor:read',

  // UI permissions
  'ui.showNotification': 'ui:notifications',
  'ui.showInformationMessage': 'ui:notifications',
  'ui.showWarningMessage': 'ui:notifications',
  'ui.showErrorMessage': 'ui:notifications',
  'ui.createOutputChannel': 'ui:create',
  'ui.addPanel': 'ui:create',
  'ui.registerPanel': 'ui:create',
  'ui.showPrompt': 'ui:dialogs',
  'ui.showConfirm': 'ui:dialogs',
  'ui.showQuickPick': 'ui:dialogs',
  'ui.showInputBox': 'ui:dialogs',
  'ui.showDialog': 'ui:dialogs',
  'ui.showOpenDialog': 'ui:dialogs',
  'ui.showSaveDialog': 'ui:dialogs',
  'ui.withProgress': 'ui:create',
  'ui.registerTreeDataProvider': 'ui:create',
  'ui.registerStatusBarItem': 'ui:create',
  'ui.registerWebviewPanel': 'ui:create',
  'ui.registerMenu': 'ui:menus',
  'ui.registerToolbar': 'ui:toolbars',
  'ui.createTerminal': 'terminal:create',

  // Filesystem permissions
  'fs.readFile': 'filesystem:read',
  'fs.writeFile': 'filesystem:write',
  'fs.readdir': 'filesystem:read',
  'fs.mkdir': 'filesystem:write',
  'fs.delete': 'filesystem:write',
  'fs.rename': 'filesystem:write',
  'fs.copy': 'filesystem:write',
  'fs.exists': 'filesystem:read',
  'fs.stat': 'filesystem:read',
  'fs.ensureDir': 'filesystem:write',
  'fs.openFileDialog': 'filesystem:read',

  // Workspace permissions
  'workspace.readFile': 'workspace:read',
  'workspace.writeFile': 'workspace:write',
  'workspace.readDir': 'workspace:read',
  'workspace.createDir': 'workspace:write',
  'workspace.delete': 'workspace:write',
  'workspace.exists': 'workspace:read',
  'workspace.rootPath': 'workspace:read',
  'workspace.getConfig': 'workspace:read',

  // Storage permissions
  'storage.get': 'storage:read',
  'storage.set': 'storage:write',
  'storage.delete': 'storage:write',
  'storage.keys': 'storage:read',
  'storage.clear': 'storage:write',
  'storage.getDatabase': 'storage:read',

  // Commands permissions
  'commands.register': 'commands:register',
  'commands.execute': 'commands:execute',
  'commands.getAll': 'commands:list',

  // Network permissions
  'network.fetch': 'network:http',

  // Clipboard permissions
  'clipboard.read': 'clipboard:read',
  'clipboard.writeText': 'clipboard:write',

  // Terminal permissions
  'terminal.create': 'terminal:create',
  'terminal.sendText': 'terminal:write',
  'terminal.getActiveTerminal': 'terminal:read',
  'terminal.dispose': 'terminal:write',

  // Events permissions
  'events.on': 'events:listen',
  'events.emit': 'events:emit',

  // Languages API permissions
  'languages.registerCompletionProvider': 'languages:register',
  'languages.registerHoverProvider': 'languages:register',
  'languages.registerDefinitionProvider': 'languages:register',
  'languages.registerReferenceProvider': 'languages:register',
  'languages.registerDocumentSymbolProvider': 'languages:register',
  'languages.registerCodeActionProvider': 'languages:register',
  'languages.registerCodeLensProvider': 'languages:register',
  'languages.registerFormattingProvider': 'languages:register',
  'languages.registerSignatureHelpProvider': 'languages:register',
  'languages.registerDiagnosticProvider': 'languages:register',
  'languages.registerLanguage': 'languages:register',
  'languages.getLanguages': 'languages:read',
  'languages.setLanguageConfiguration': 'languages:register',

  // Configuration API permissions
  'config.get': 'config:read',
  'config.set': 'config:write',
  'config.update': 'config:write',
  'config.has': 'config:read',
  'config.inspect': 'config:read',
  'config.getConfiguration': 'config:read',

  // Theme API permissions
  'themes.registerTheme': 'themes:register',
  'themes.setActiveTheme': 'themes:set',
  'themes.getActiveTheme': 'themes:read',
  'themes.getThemes': 'themes:read',
  'themes.onDidChangeTheme': 'themes:read',

  // Debug API permissions
  'debug.startDebugging': 'debug:session',
  'debug.stopDebugging': 'debug:session',
  'debug.registerDebugAdapterProvider': 'debug:register',
  'debug.registerDebugConfigurationProvider': 'debug:register',
  'debug.addBreakpoints': 'debug:session',
  'debug.removeBreakpoints': 'debug:session',

  // Task API permissions
  'tasks.registerTaskProvider': 'tasks:register',
  'tasks.executeTask': 'tasks:execute',
  'tasks.fetchTasks': 'tasks:read',
  'tasks.onDidStartTask': 'tasks:read',
  'tasks.onDidEndTask': 'tasks:read'
};

/**
 * Permission metadata with risk levels and descriptions
 */
export const PERMISSION_METADATA = {
  // Editor
  'editor:read': {
    name: 'Read Editor Content',
    description: 'Access to read current document content and selection',
    riskLevel: 'medium',
    category: 'editor'
  },
  'editor:write': {
    name: 'Modify Editor',
    description: 'Ability to insert, modify, or delete document content',
    riskLevel: 'medium',
    category: 'editor'
  },

  // UI
  'ui:notifications': {
    name: 'Show Notifications',
    description: 'Display toast notifications to the user',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:dialogs': {
    name: 'Show Dialogs',
    description: 'Display dialog boxes and prompts',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:create': {
    name: 'Create UI Elements',
    description: 'Create panels, status bar items, and other UI components',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:menus': {
    name: 'Register Menus',
    description: 'Add items to context menus',
    riskLevel: 'low',
    category: 'ui'
  },
  'ui:toolbars': {
    name: 'Register Toolbars',
    description: 'Add items to toolbars',
    riskLevel: 'low',
    category: 'ui'
  },

  // Filesystem
  'filesystem:read': {
    name: 'Read Files',
    description: 'Read files and folders within the workspace',
    riskLevel: 'medium',
    category: 'filesystem'
  },
  'filesystem:write': {
    name: 'Write Files',
    description: 'Create, modify, and delete files within the workspace',
    riskLevel: 'high',
    category: 'filesystem'
  },

  // Workspace
  'workspace:read': {
    name: 'Read Workspace',
    description: 'Access workspace path and configuration',
    riskLevel: 'low',
    category: 'workspace'
  },
  'workspace:write': {
    name: 'Modify Workspace',
    description: 'Modify workspace files and settings',
    riskLevel: 'high',
    category: 'workspace'
  },

  // Storage
  'storage:read': {
    name: 'Read Storage',
    description: 'Read plugin-specific stored data',
    riskLevel: 'low',
    category: 'storage'
  },
  'storage:write': {
    name: 'Write Storage',
    description: 'Store plugin-specific data',
    riskLevel: 'low',
    category: 'storage'
  },

  // Commands
  'commands:register': {
    name: 'Register Commands',
    description: 'Register new commands in the command palette',
    riskLevel: 'low',
    category: 'commands'
  },
  'commands:execute': {
    name: 'Execute Commands',
    description: 'Execute registered commands',
    riskLevel: 'medium',
    category: 'commands'
  },
  'commands:list': {
    name: 'List Commands',
    description: 'View all registered commands',
    riskLevel: 'low',
    category: 'commands'
  },

  // Network
  'network:http': {
    name: 'Network Access',
    description: 'Make HTTP/HTTPS requests to external servers',
    riskLevel: 'high',
    category: 'network'
  },

  // Clipboard
  'clipboard:read': {
    name: 'Read Clipboard',
    description: 'Access clipboard contents',
    riskLevel: 'high',
    category: 'clipboard'
  },
  'clipboard:write': {
    name: 'Write Clipboard',
    description: 'Modify clipboard contents',
    riskLevel: 'medium',
    category: 'clipboard'
  },

  // Terminal
  'terminal:create': {
    name: 'Create Terminal',
    description: 'Create and manage terminal instances',
    riskLevel: 'high',
    category: 'terminal'
  },
  'terminal:write': {
    name: 'Write to Terminal',
    description: 'Send commands to terminal',
    riskLevel: 'high',
    category: 'terminal'
  },

  // Events
  'events:listen': {
    name: 'Listen to Events',
    description: 'Subscribe to system events',
    riskLevel: 'low',
    category: 'events'
  },
  'events:emit': {
    name: 'Emit Events',
    description: 'Emit custom events',
    riskLevel: 'medium',
    category: 'events'
  },

  // Terminal - additional
  'terminal:read': {
    name: 'Read Terminal',
    description: 'Access terminal state and output',
    riskLevel: 'medium',
    category: 'terminal'
  },

  // Languages API
  'languages:register': {
    name: 'Register Language Features',
    description: 'Register completion, hover, and other language providers',
    riskLevel: 'medium',
    category: 'languages'
  },
  'languages:read': {
    name: 'Read Language Info',
    description: 'Access registered language information',
    riskLevel: 'low',
    category: 'languages'
  },

  // Configuration API
  'config:read': {
    name: 'Read Configuration',
    description: 'Access application and workspace configuration values',
    riskLevel: 'low',
    category: 'config'
  },
  'config:write': {
    name: 'Write Configuration',
    description: 'Modify application and workspace configuration values',
    riskLevel: 'medium',
    category: 'config'
  },

  // Theme API
  'themes:register': {
    name: 'Register Themes',
    description: 'Register custom color themes',
    riskLevel: 'low',
    category: 'themes'
  },
  'themes:set': {
    name: 'Set Active Theme',
    description: 'Change the active color theme',
    riskLevel: 'low',
    category: 'themes'
  },
  'themes:read': {
    name: 'Read Theme Info',
    description: 'Access theme information and current theme',
    riskLevel: 'low',
    category: 'themes'
  },

  // Debug API
  'debug:session': {
    name: 'Debug Session',
    description: 'Start, stop, and control debugging sessions',
    riskLevel: 'high',
    category: 'debug'
  },
  'debug:register': {
    name: 'Register Debug Providers',
    description: 'Register debug adapters and configuration providers',
    riskLevel: 'medium',
    category: 'debug'
  },

  // Task API
  'tasks:register': {
    name: 'Register Task Providers',
    description: 'Register custom task providers',
    riskLevel: 'low',
    category: 'tasks'
  },
  'tasks:execute': {
    name: 'Execute Tasks',
    description: 'Run registered tasks',
    riskLevel: 'medium',
    category: 'tasks'
  },
  'tasks:read': {
    name: 'Read Tasks',
    description: 'Access task definitions and execution status',
    riskLevel: 'low',
    category: 'tasks'
  }
};

/**
 * High-risk permissions that require explicit user consent
 */
export const HIGH_RISK_PERMISSIONS = [
  'filesystem:write',
  'workspace:write',
  'network:http',
  'clipboard:read',
  'terminal:create',
  'terminal:write',
  'debug:session'  // Can access sensitive debug information
];

/**
 * Valid permissions list for validation
 */
export const VALID_PERMISSIONS = [
  // Editor
  'editor:read', 'editor:write',
  // UI
  'ui:notifications', 'ui:dialogs', 'ui:create', 'ui:menus', 'ui:toolbars',
  // Filesystem
  'filesystem:read', 'filesystem:write',
  // Workspace
  'workspace:read', 'workspace:write',
  // Storage
  'storage:read', 'storage:write',
  // Commands
  'commands:register', 'commands:execute', 'commands:list',
  // Network
  'network:http',
  // Clipboard
  'clipboard:read', 'clipboard:write',
  // Terminal
  'terminal:create', 'terminal:write', 'terminal:read',
  // Events
  'events:listen', 'events:emit',
  // Languages
  'languages:register', 'languages:read',
  // Configuration
  'config:read', 'config:write',
  // Themes
  'themes:register', 'themes:set', 'themes:read',
  // Debug
  'debug:session', 'debug:register',
  // Tasks
  'tasks:register', 'tasks:execute', 'tasks:read'
];

/**
 * Permission Enforcer - Centralized permission checking and auditing
 */
export class PermissionEnforcer extends EventEmitter {
  constructor() {
    super();
    this.auditLog = [];
    this.maxAuditLogSize = 10000;
  }

  /**
   * Check if a plugin has a specific permission
   * @param {string} pluginId - Plugin identifier
   * @param {Set<string>} grantedPermissions - Set of permissions the plugin has
   * @param {string} requiredPermission - Permission to check
   * @returns {boolean}
   */
  hasPermission(pluginId, grantedPermissions, requiredPermission) {
    if (!grantedPermissions) return false;

    // Check for exact match
    if (grantedPermissions.has(requiredPermission)) return true;

    // Check for 'all' permission (grants everything)
    if (grantedPermissions.has('all')) return true;

    // Check for legacy permission formats
    // e.g., 'filesystem:read' might be declared as 'fs:read' in older plugins
    const legacyMappings = {
      'filesystem:read': ['fs:read'],
      'filesystem:write': ['fs:write'],
      'commands:register': ['commands:register'],
      'ui:notifications': ['ui:notifications'],
      'ui:create': ['ui:panels', 'ui:statusbar', 'ui:views'],
      'ui:dialogs': ['ui:dialogs'],
      'network:http': ['network', 'network:https'],
      'clipboard:read': ['system:clipboard'],
      'clipboard:write': ['system:clipboard']
    };

    const alternatives = legacyMappings[requiredPermission];
    if (alternatives) {
      for (const alt of alternatives) {
        if (grantedPermissions.has(alt)) return true;
      }
    }

    return false;
  }

  /**
   * Require a permission - throws PermissionDeniedError if not granted
   * @param {string} pluginId - Plugin identifier
   * @param {Set<string>} grantedPermissions - Set of granted permissions
   * @param {string} requiredPermission - Permission required
   * @param {string} apiMethod - API method being called (for logging)
   * @throws {PermissionDeniedError}
   */
  requirePermission(pluginId, grantedPermissions, requiredPermission, apiMethod) {
    const granted = this.hasPermission(pluginId, grantedPermissions, requiredPermission);

    // Log the attempt
    this.logPermissionCheck(pluginId, requiredPermission, apiMethod, granted);

    if (!granted) {
      const error = new PermissionDeniedError(pluginId, requiredPermission, apiMethod);
      this.emit('permission-denied', {
        pluginId,
        permission: requiredPermission,
        apiMethod,
        timestamp: error.timestamp
      });
      throw error;
    }

    return true;
  }

  /**
   * Check if a path is within the allowed workspace
   * @param {string} path - Path to check
   * @param {string} workspacePath - Allowed workspace path
   * @returns {boolean}
   */
  isPathInWorkspace(path, workspacePath) {
    if (!path || !workspacePath) return false;

    // Normalize paths
    const normalizedPath = path.replace(/\\/g, '/').toLowerCase();
    const normalizedWorkspace = workspacePath.replace(/\\/g, '/').toLowerCase();

    // Check if path starts with workspace
    return normalizedPath.startsWith(normalizedWorkspace);
  }

  /**
   * Require path to be within workspace - throws error if outside
   * @param {string} pluginId - Plugin identifier
   * @param {string} path - Path being accessed
   * @param {string} workspacePath - Allowed workspace path
   * @param {string} apiMethod - API method being called
   * @throws {PermissionDeniedError}
   */
  requirePathInWorkspace(pluginId, path, workspacePath, apiMethod) {
    if (!this.isPathInWorkspace(path, workspacePath)) {
      const error = new PermissionDeniedError(
        pluginId,
        'workspace:scoped',
        `${apiMethod} (path outside workspace: ${path})`
      );

      this.logPermissionCheck(pluginId, 'workspace:scoped', `${apiMethod}:${path}`, false);

      this.emit('permission-denied', {
        pluginId,
        permission: 'workspace:scoped',
        apiMethod,
        path,
        workspacePath,
        reason: 'Path is outside workspace',
        timestamp: error.timestamp
      });

      throw error;
    }

    return true;
  }

  /**
   * Log a permission check
   * @param {string} pluginId - Plugin identifier
   * @param {string} permission - Permission checked
   * @param {string} apiMethod - API method
   * @param {boolean} granted - Whether access was granted
   */
  logPermissionCheck(pluginId, permission, apiMethod, granted) {
    const entry = {
      timestamp: Date.now(),
      pluginId,
      permission,
      apiMethod,
      granted,
      action: granted ? 'allowed' : 'denied'
    };

    this.auditLog.push(entry);

    // Trim log if too large
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize / 2);
    }

    this.emit('permission-check', entry);
  }

  /**
   * Get audit log entries
   * @param {Object} filter - Optional filters
   * @returns {Array}
   */
  getAuditLog(filter = {}) {
    let logs = [...this.auditLog];

    if (filter.pluginId) {
      logs = logs.filter(l => l.pluginId === filter.pluginId);
    }
    if (filter.permission) {
      logs = logs.filter(l => l.permission === filter.permission);
    }
    if (filter.granted !== undefined) {
      logs = logs.filter(l => l.granted === filter.granted);
    }
    if (filter.since) {
      logs = logs.filter(l => l.timestamp >= filter.since);
    }
    if (filter.limit) {
      logs = logs.slice(-filter.limit);
    }

    return logs;
  }

  /**
   * Get permission metadata
   * @param {string} permission - Permission identifier
   * @returns {Object|undefined}
   */
  getPermissionMetadata(permission) {
    return PERMISSION_METADATA[permission];
  }

  /**
   * Get required permission for an API method
   * @param {string} apiMethod - API method name (e.g., 'fs.readFile')
   * @returns {string|undefined}
   */
  getRequiredPermission(apiMethod) {
    return PERMISSION_MAP[apiMethod];
  }

  /**
   * Check if a permission is high-risk
   * @param {string} permission - Permission to check
   * @returns {boolean}
   */
  isHighRiskPermission(permission) {
    return HIGH_RISK_PERMISSIONS.includes(permission);
  }

  /**
   * Get all high-risk permissions from a list
   * @param {Array|Set} permissions - Permissions to check
   * @returns {Array}
   */
  getHighRiskPermissions(permissions) {
    const permArray = Array.isArray(permissions) ? permissions : [...permissions];
    return permArray.filter(p => this.isHighRiskPermission(p));
  }

  /**
   * Clear audit log
   */
  clearAuditLog() {
    this.auditLog = [];
  }

  /**
   * Validate an array of permissions
   * @param {Array} permissions - Permissions to validate
   * @returns {{ valid: boolean, errors: string[] }}
   */
  validatePermissions(permissions) {
    const errors = [];

    if (!Array.isArray(permissions)) {
      return { valid: false, errors: ['Permissions must be an array'] };
    }

    for (const perm of permissions) {
      if (typeof perm !== 'string') {
        errors.push(`Invalid permission type: ${typeof perm}, expected string`);
        continue;
      }

      if (!VALID_PERMISSIONS.includes(perm)) {
        errors.push(`Unknown permission: '${perm}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get all valid permissions
   * @returns {string[]}
   */
  getValidPermissions() {
    return [...VALID_PERMISSIONS];
  }
}

// Singleton instance
export const permissionEnforcer = new PermissionEnforcer();

export default PermissionEnforcer;
