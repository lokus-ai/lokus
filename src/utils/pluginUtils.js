/**
 * Plugin utility functions for Lokus
 */

/**
 * Validate plugin manifest structure
 * @param {Object} manifest - Plugin manifest object
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePluginManifest(manifest) {
  const errors = [];
  const requiredFields = ['id', 'name', 'version', 'description', 'author'];
  
  // Check required fields
  for (const field of requiredFields) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate ID format (alphanumeric with hyphens)
  if (manifest.id && !/^[a-z0-9-]+$/.test(manifest.id)) {
    errors.push('Plugin ID must contain only lowercase letters, numbers, and hyphens');
  }
  
  // Validate version format (semver)
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('Version must follow semantic versioning (x.y.z)');
  }
  
  // Validate permissions array
  if (manifest.permissions && !Array.isArray(manifest.permissions)) {
    errors.push('Permissions must be an array');
  }
  
  // Validate dependencies array
  if (manifest.dependencies && !Array.isArray(manifest.dependencies)) {
    errors.push('Dependencies must be an array');
  }
  
  // Validate UI configuration
  if (manifest.ui) {
    if (manifest.ui.panels && !Array.isArray(manifest.ui.panels)) {
      errors.push('UI panels must be an array');
    }
    
    if (manifest.ui.panels) {
      manifest.ui.panels.forEach((panel, index) => {
        if (!panel.id) {
          errors.push(`Panel ${index} is missing required field: id`);
        }
        if (!panel.title) {
          errors.push(`Panel ${index} is missing required field: title`);
        }
        if (!panel.type) {
          errors.push(`Panel ${index} is missing required field: type`);
        }
        if (!['react-component', 'iframe', 'webview'].includes(panel.type)) {
          errors.push(`Panel ${index} has invalid type: ${panel.type}`);
        }
      });
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a plugin has conflicts with installed plugins
 * @param {Object} plugin - Plugin to check
 * @param {Array} installedPlugins - Array of installed plugins
 * @returns {Array} - Array of conflicting plugin IDs
 */
export function checkPluginConflicts(plugin, installedPlugins) {
  const conflicts = [];
  
  if (!plugin.conflicts || !Array.isArray(plugin.conflicts)) {
    return conflicts;
  }
  
  for (const conflictId of plugin.conflicts) {
    const conflictingPlugin = installedPlugins.find(p => p.id === conflictId && p.enabled);
    if (conflictingPlugin) {
      conflicts.push(conflictingPlugin);
    }
  }
  
  return conflicts;
}

/**
 * Check if all plugin dependencies are satisfied
 * @param {Object} plugin - Plugin to check
 * @param {Array} installedPlugins - Array of installed plugins
 * @returns {Object} - { satisfied: boolean, missing: string[] }
 */
export function checkPluginDependencies(plugin, installedPlugins) {
  const missing = [];
  
  if (!plugin.dependencies || !Array.isArray(plugin.dependencies)) {
    return { satisfied: true, missing: [] };
  }
  
  for (const depId of plugin.dependencies) {
    const dependency = installedPlugins.find(p => p.id === depId && p.enabled);
    if (!dependency) {
      missing.push(depId);
    }
  }
  
  return {
    satisfied: missing.length === 0,
    missing
  };
}

/**
 * Sort plugins by various criteria
 * @param {Array} plugins - Array of plugins to sort
 * @param {string} sortBy - Sort criteria ('name', 'downloads', 'rating', 'updated')
 * @param {string} order - Sort order ('asc' or 'desc')
 * @returns {Array} - Sorted plugins array
 */
export function sortPlugins(plugins, sortBy = 'name', order = 'asc') {
  const sorted = [...plugins].sort((a, b) => {
    let aVal, bVal;
    
    switch (sortBy) {
      case 'name':
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case 'downloads':
        aVal = a.downloads || 0;
        bVal = b.downloads || 0;
        break;
      case 'rating':
        aVal = a.rating || 0;
        bVal = b.rating || 0;
        break;
      case 'updated':
        aVal = new Date(a.lastUpdated || 0);
        bVal = new Date(b.lastUpdated || 0);
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }
    
    if (aVal < bVal) return order === 'asc' ? -1 : 1;
    if (aVal > bVal) return order === 'asc' ? 1 : -1;
    return 0;
  });
  
  return sorted;
}

/**
 * Filter plugins by search query and criteria
 * @param {Array} plugins - Array of plugins to filter
 * @param {string} searchQuery - Search query string
 * @param {Object} filters - Filter criteria
 * @returns {Array} - Filtered plugins array
 */
export function filterPlugins(plugins, searchQuery = '', filters = {}) {
  let filtered = [...plugins];
  
  // Search filter
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(plugin => 
      plugin.name.toLowerCase().includes(query) ||
      plugin.description.toLowerCase().includes(query) ||
      plugin.author.toLowerCase().includes(query) ||
      (plugin.tags && plugin.tags.some(tag => tag.toLowerCase().includes(query)))
    );
  }
  
  // Category filter
  if (filters.category && filters.category !== 'all') {
    filtered = filtered.filter(plugin => plugin.category === filters.category);
  }
  
  // Status filter
  if (filters.status) {
    switch (filters.status) {
      case 'enabled':
        filtered = filtered.filter(plugin => plugin.enabled);
        break;
      case 'disabled':
        filtered = filtered.filter(plugin => !plugin.enabled);
        break;
      case 'installed':
        // This would be used in marketplace to filter out already installed plugins
        break;
    }
  }
  
  // Rating filter
  if (filters.minRating) {
    filtered = filtered.filter(plugin => (plugin.rating || 0) >= filters.minRating);
  }
  
  return filtered;
}

/**
 * Format plugin permissions for display
 * @param {Array} permissions - Array of permission strings
 * @returns {Array} - Array of formatted permission objects
 */
export function formatPluginPermissions(permissions = []) {
  const permissionMap = {
    'file-system': {
      label: 'File System Access',
      description: 'Read and write files in your workspace',
      risk: 'medium'
    },
    'network': {
      label: 'Network Access',
      description: 'Make requests to external services',
      risk: 'medium'
    },
    'shell-commands': {
      label: 'Shell Commands',
      description: 'Execute system commands',
      risk: 'high'
    },
    'editor-extensions': {
      label: 'Editor Extensions',
      description: 'Extend editor functionality',
      risk: 'low'
    },
    'user-data': {
      label: 'User Data Access',
      description: 'Access your notes and personal data',
      risk: 'high'
    },
    'settings': {
      label: 'Settings Access',
      description: 'Modify application settings',
      risk: 'low'
    },
    'themes': {
      label: 'Theme System',
      description: 'Modify appearance and themes',
      risk: 'low'
    },
    'notifications': {
      label: 'Notifications',
      description: 'Show system notifications',
      risk: 'low'
    },
    'analytics': {
      label: 'Analytics',
      description: 'Collect usage statistics',
      risk: 'medium'
    }
  };
  
  return permissions.map(permission => ({
    id: permission,
    ...permissionMap[permission] || {
      label: permission.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: 'Unknown permission',
      risk: 'unknown'
    }
  }));
}

/**
 * Generate plugin component ID for safe rendering
 * @param {string} pluginId - Plugin ID
 * @param {string} componentName - Component name
 * @returns {string} - Safe component ID
 */
export function generatePluginComponentId(pluginId, componentName) {
  return `plugin-${pluginId}-${componentName}`.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Validate plugin settings schema
 * @param {Object} settings - Plugin settings object
 * @param {Object} schema - Settings schema
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
export function validatePluginSettings(settings, schema) {
  const errors = [];
  
  if (!schema || typeof schema !== 'object') {
    return { valid: true, errors: [] };
  }
  
  for (const [key, definition] of Object.entries(schema)) {
    const value = settings[key];
    
    // Check required fields
    if (definition.required && (value === undefined || value === null)) {
      errors.push(`Setting '${key}' is required`);
      continue;
    }
    
    if (value !== undefined && value !== null) {
      // Type validation
      if (definition.type) {
        const expectedType = definition.type;
        const actualType = typeof value;
        
        if (expectedType === 'array' && !Array.isArray(value)) {
          errors.push(`Setting '${key}' must be an array`);
        } else if (expectedType !== 'array' && actualType !== expectedType) {
          errors.push(`Setting '${key}' must be of type ${expectedType}, got ${actualType}`);
        }
      }
      
      // Range validation for numbers
      if (typeof value === 'number' && definition.range) {
        const [min, max] = definition.range;
        if (value < min || value > max) {
          errors.push(`Setting '${key}' must be between ${min} and ${max}`);
        }
      }
      
      // Options validation
      if (definition.options && !definition.options.includes(value)) {
        errors.push(`Setting '${key}' must be one of: ${definition.options.join(', ')}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create a safe sandbox environment for plugin execution
 * @param {Object} plugin - Plugin object
 * @returns {Object} - Sandbox context
 */
export function createPluginSandbox(plugin) {
  // This would create a secure execution environment for plugins
  // For now, return a mock sandbox
  return {
    pluginId: plugin.id,
    api: {
      // Lokus API methods would be exposed here based on permissions
      fileSystem: plugin.permissions?.includes('file-system') ? {} : null,
      network: plugin.permissions?.includes('network') ? {} : null,
      editor: plugin.permissions?.includes('editor-extensions') ? {} : null,
    },
    // Restricted global access
    console: {
      log: (...args) => console.log(`[${plugin.id}]`, ...args),
      warn: (...args) => console.warn(`[${plugin.id}]`, ...args),
      error: (...args) => console.error(`[${plugin.id}]`, ...args)
    }
  };
}