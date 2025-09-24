/**
 * Platform Configuration Loader
 * 
 * Loads the appropriate configuration based on the current platform
 */

import { getPlatform, isWindows, isMacOS } from '../../platform/index.js';
import { windowsConfig } from './windows.config.js';
import { macosConfig } from './macos.config.js';

// Default configuration for unsupported platforms
const defaultConfig = {
  app: {
    name: 'Lokus',
    defaultInstallPath: '/opt/lokus',
    userDataPath: '~/.config/lokus',
    tempPath: '/tmp/lokus'
  },
  files: {
    defaultWorkspacePath: '~/Documents/Lokus',
    maxPathLength: 4096,
    invalidChars: '\0'
  },
  terminal: {
    preferences: [
      {
        name: 'Default Terminal',
        command: 'xterm',
        args: ['-e', 'cd "{path}" && $SHELL'],
        available: true
      }
    ]
  },
  shortcuts: {
    global: {},
    editor: {}
  },
  ui: {
    borderRadius: '4px',
    contextMenu: {
      style: 'default',
      animations: true
    }
  },
  notifications: {
    provider: 'web-api',
    badgeSupport: false
  },
  performance: {
    hardwareAcceleration: true
  },
  features: {
    darkModeSync: false
  }
};

// Platform configuration cache
let cachedConfig = null;

/**
 * Get platform-specific configuration
 * @returns {Object} Platform configuration
 */
export function getPlatformConfig() {
  if (cachedConfig) {
    return cachedConfig;
  }

  const platform = getPlatform();
  let config;

  switch (platform) {
    case 'windows':
      config = windowsConfig;
      break;
    case 'macos':
      config = macosConfig;
      break;
    default:
      config = defaultConfig;
      break;
  }

  // Add platform identifier
  config.platform = platform;

  // Cache the configuration
  cachedConfig = config;
  return config;
}

/**
 * Get a specific configuration value
 * @param {string} path - Dot-separated path (e.g., 'ui.borderRadius')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
export function getConfigValue(path, defaultValue = null) {
  const config = getPlatformConfig();
  
  return path.split('.').reduce((obj, key) => {
    return obj?.[key] ?? defaultValue;
  }, config);
}

/**
 * Check if a feature is enabled
 * @param {string} feature - Feature name
 * @returns {boolean} Whether the feature is enabled
 */
export function isFeatureEnabled(feature) {
  return getConfigValue(`features.${feature}`, false) === true;
}

/**
 * Get platform-specific shortcuts
 * @param {string} category - Shortcut category (global, editor, etc.)
 * @returns {Object} Shortcuts for the category
 */
export function getPlatformShortcuts(category) {
  return getConfigValue(`shortcuts.${category}`, {});
}

/**
 * Get terminal preferences for the current platform
 * @returns {Array} Terminal preferences
 */
export function getTerminalPreferences() {
  return getConfigValue('terminal.preferences', []);
}

/**
 * Get file associations for the current platform
 * @returns {Object} File associations
 */
export function getFileAssociations() {
  return getConfigValue('files.associations', {});
}

/**
 * Merge user configuration with platform defaults
 * @param {Object} userConfig - User configuration
 * @returns {Object} Merged configuration
 */
export function mergeWithUserConfig(userConfig) {
  const platformConfig = getPlatformConfig();
  
  // Deep merge function
  const deepMerge = (target, source) => {
    const output = { ...target };
    
    if (isObject(target) && isObject(source)) {
      Object.keys(source).forEach(key => {
        if (isObject(source[key])) {
          if (!(key in target)) {
            Object.assign(output, { [key]: source[key] });
          } else {
            output[key] = deepMerge(target[key], source[key]);
          }
        } else {
          Object.assign(output, { [key]: source[key] });
        }
      });
    }
    
    return output;
  };
  
  const isObject = (item) => {
    return item && typeof item === 'object' && !Array.isArray(item);
  };
  
  return deepMerge(platformConfig, userConfig);
}

// Export individual configs for direct access if needed
export { windowsConfig, macosConfig, defaultConfig };