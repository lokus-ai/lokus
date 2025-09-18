/**
 * Platform Detection and Utilities
 * 
 * Provides cross-platform utilities for detecting the current operating system
 * and handling platform-specific behaviors throughout the Lokus application.
 */

// Platform detection constants
export const PLATFORMS = {
  WINDOWS: 'windows',
  MACOS: 'macos', 
  LINUX: 'linux',
  UNKNOWN: 'unknown'
};

// Path separator constants
export const PATH_SEPARATORS = {
  [PLATFORMS.WINDOWS]: '\\',
  [PLATFORMS.MACOS]: '/',
  [PLATFORMS.LINUX]: '/',
  [PLATFORMS.UNKNOWN]: '/'
};

// Keyboard shortcut modifiers
export const MODIFIER_KEYS = {
  [PLATFORMS.WINDOWS]: {
    primary: 'Ctrl',
    secondary: 'Alt',
    symbol: 'Ctrl'
  },
  [PLATFORMS.MACOS]: {
    primary: 'Cmd',
    secondary: 'Option',
    symbol: '⌘'
  },
  [PLATFORMS.LINUX]: {
    primary: 'Ctrl',
    secondary: 'Alt', 
    symbol: 'Ctrl'
  }
};

/**
 * Detect the current platform based on user agent and available APIs
 * @returns {string} Platform constant from PLATFORMS
 */
export function detectPlatform() {
  // Check if we're in Tauri environment
  if (typeof window !== 'undefined' && window.__TAURI__) {
    // Use Tauri's platform detection
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('windows')) return PLATFORMS.WINDOWS;
    if (userAgent.includes('mac')) return PLATFORMS.MACOS;
    if (userAgent.includes('linux')) return PLATFORMS.LINUX;
  }
  
  // Fallback to browser-based detection
  if (typeof navigator !== 'undefined') {
    const platform = navigator.platform.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (platform.includes('win') || userAgent.includes('windows')) {
      return PLATFORMS.WINDOWS;
    }
    if (platform.includes('mac') || userAgent.includes('mac')) {
      return PLATFORMS.MACOS;
    }
    if (platform.includes('linux') || userAgent.includes('linux')) {
      return PLATFORMS.LINUX;
    }
  }
  
  return PLATFORMS.UNKNOWN;
}

// Cache the platform detection result
let detectedPlatform = null;

/**
 * Get the current platform (cached)
 * @returns {string} Platform constant
 */
export function getCurrentPlatform() {
  if (detectedPlatform === null) {
    detectedPlatform = detectPlatform();
  }
  return detectedPlatform;
}

/**
 * Check if current platform is Windows
 * @returns {boolean}
 */
export function isWindows() {
  return getCurrentPlatform() === PLATFORMS.WINDOWS;
}

/**
 * Check if current platform is macOS
 * @returns {boolean}
 */
export function isMacOS() {
  return getCurrentPlatform() === PLATFORMS.MACOS;
}

/**
 * Check if current platform is Linux
 * @returns {boolean}
 */
export function isLinux() {
  return getCurrentPlatform() === PLATFORMS.LINUX;
}

/**
 * Get the appropriate path separator for current platform
 * @returns {string} Path separator character
 */
export function getPathSeparator() {
  const platform = getCurrentPlatform();
  return PATH_SEPARATORS[platform] || PATH_SEPARATORS[PLATFORMS.UNKNOWN];
}

/**
 * Normalize path separators for current platform
 * @param {string} path - Path to normalize
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
  if (!path) return '';
  
  const separator = getPathSeparator();
  // Replace all separators with the platform-appropriate one
  return path.replace(/[/\\]/g, separator);
}

/**
 * Join path components with platform-appropriate separator
 * @param {...string} parts - Path components to join
 * @returns {string} Joined path
 */
export function joinPath(...parts) {
  const separator = getPathSeparator();
  return parts
    .filter(part => part && part.trim())
    .map(part => part.replace(/[/\\]+$/, '')) // Remove trailing separators
    .join(separator);
}

/**
 * Get platform-specific modifier key information
 * @returns {object} Modifier key info for current platform
 */
export function getModifierKeys() {
  const platform = getCurrentPlatform();
  return MODIFIER_KEYS[platform] || MODIFIER_KEYS[PLATFORMS.LINUX];
}

/**
 * Create platform-specific keyboard shortcut string
 * @param {string} key - The key (e.g., 'S', 'Enter')
 * @param {object} options - Modifier options
 * @param {boolean} options.primary - Use primary modifier (Cmd/Ctrl)
 * @param {boolean} options.secondary - Use secondary modifier (Option/Alt)
 * @param {boolean} options.shift - Use Shift
 * @returns {string} Formatted shortcut string
 */
export function createShortcut(key, options = {}) {
  const modifiers = getModifierKeys();
  const parts = [];
  
  if (options.primary) parts.push(modifiers.primary);
  if (options.secondary) parts.push(modifiers.secondary);
  if (options.shift) parts.push('Shift');
  
  parts.push(key);
  
  return parts.join('+');
}

/**
 * Get platform-specific file dialog filters
 * @param {object} filters - Filter definitions
 * @returns {object} Platform-appropriate filters
 */
export function getFileDialogFilters(filters) {
  // Tauri handles cross-platform file dialogs automatically
  // but we can customize based on platform if needed
  return filters;
}

/**
 * Get platform-specific default directories
 * @returns {object} Default directory paths
 */
export function getDefaultDirectories() {
  const platform = getCurrentPlatform();
  
  switch (platform) {
    case PLATFORMS.WINDOWS:
      return {
        documents: '%USERPROFILE%\\Documents',
        desktop: '%USERPROFILE%\\Desktop',
        downloads: '%USERPROFILE%\\Downloads'
      };
    case PLATFORMS.MACOS:
      return {
        documents: '~/Documents',
        desktop: '~/Desktop', 
        downloads: '~/Downloads'
      };
    case PLATFORMS.LINUX:
      return {
        documents: '~/Documents',
        desktop: '~/Desktop',
        downloads: '~/Downloads'
      };
    default:
      return {
        documents: '~/Documents',
        desktop: '~/Desktop',
        downloads: '~/Downloads'
      };
  }
}

/**
 * Get platform-specific UI preferences
 * @returns {object} UI preference settings
 */
export function getPlatformUIPreferences() {
  const platform = getCurrentPlatform();
  
  return {
    showScrollbars: platform !== PLATFORMS.MACOS,
    useNativeContextMenus: platform === PLATFORMS.MACOS,
    windowControlsPosition: platform === PLATFORMS.MACOS ? 'left' : 'right',
    titleBarStyle: platform === PLATFORMS.MACOS ? 'transparent' : 'default',
    animationDuration: platform === PLATFORMS.MACOS ? 300 : 200
  };
}

/**
 * Check if a feature is available on current platform
 * @param {string} feature - Feature name to check
 * @returns {boolean} Whether feature is available
 */
export function isPlatformFeatureAvailable(feature) {
  const platform = getCurrentPlatform();
  
  const platformFeatures = {
    [PLATFORMS.WINDOWS]: [
      'nativeNotifications',
      'globalShortcuts',
      'systemTray',
      'windowsRegistry'
    ],
    [PLATFORMS.MACOS]: [
      'nativeNotifications',
      'globalShortcuts',
      'systemTray',
      'touchBar',
      'appMenu'
    ],
    [PLATFORMS.LINUX]: [
      'nativeNotifications',
      'globalShortcuts',
      'systemTray'
    ]
  };
  
  return platformFeatures[platform]?.includes(feature) || false;
}

/**
 * Execute platform-specific code
 * @param {object} handlers - Platform-specific handlers
 * @param {function} handlers.windows - Windows handler
 * @param {function} handlers.macos - macOS handler  
 * @param {function} handlers.linux - Linux handler
 * @param {function} handlers.default - Default handler
 * @returns {any} Result of executed handler
 */
export function platformSwitch(handlers) {
  const platform = getCurrentPlatform();
  
  if (handlers[platform]) {
    return handlers[platform]();
  }
  
  if (handlers.default) {
    return handlers.default();
  }
  
  return null;
}

// Export platform information object
export const platformInfo = {
  current: getCurrentPlatform(),
  isWindows: isWindows(),
  isMacOS: isMacOS(), 
  isLinux: isLinux(),
  pathSeparator: getPathSeparator(),
  modifierKeys: getModifierKeys(),
  uiPreferences: getPlatformUIPreferences()
};

// Re-export constants for convenience
export default {
  PLATFORMS,
  PATH_SEPARATORS,
  MODIFIER_KEYS,
  detectPlatform,
  getCurrentPlatform,
  isWindows,
  isMacOS,
  isLinux,
  getPathSeparator,
  normalizePath,
  joinPath,
  getModifierKeys,
  createShortcut,
  getFileDialogFilters,
  getDefaultDirectories,
  getPlatformUIPreferences,
  isPlatformFeatureAvailable,
  platformSwitch,
  platformInfo
};