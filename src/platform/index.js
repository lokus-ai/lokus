/**
 * Platform detection and exports
 * 
 * This module provides platform-specific functionality while maintaining
 * a clean separation between different operating systems.
 */

// Platform detection utilities
export const getPlatform = () => {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  
  const platform = window.navigator.platform?.toLowerCase() || '';
  const userAgent = window.navigator.userAgent?.toLowerCase() || '';
  
  if (platform.includes('win') || userAgent.includes('windows')) {
    return 'windows';
  }
  if (platform.includes('mac') || userAgent.includes('mac')) {
    return 'macos';
  }
  if (platform.includes('linux') || userAgent.includes('linux')) {
    return 'linux';
  }
  
  return 'unknown';
};

export const isWindows = () => getPlatform() === 'windows';
export const isMacOS = () => getPlatform() === 'macos';
export const isLinux = () => getPlatform() === 'linux';

// Platform-specific key modifiers
export const getModifierKey = () => isMacOS() ? 'Cmd' : 'Ctrl';
export const getModifierSymbol = () => isMacOS() ? '⌘' : 'Ctrl';

// Platform-specific path handling
export const getPathSeparator = () => isWindows() ? '\\' : '/';
export const normalizePath = (path) => {
  if (isWindows()) {
    return path.replace(/\//g, '\\');
  }
  return path.replace(/\\/g, '/');
};

// Platform capabilities
export const platformCapabilities = {
  windows: {
    shellIntegration: true,
    jumpList: true,
    snapLayouts: true,
    contextMenus: true,
    registryAccess: true,
    windowsNotifications: true,
    darkModeSync: true
  },
  macos: {
    quickLook: true,
    touchBar: true,
    continuity: true,
    spotlight: true,
    finderIntegration: true,
    darkModeSync: true
  },
  linux: {
    desktopIntegration: true,
    contextMenus: true,
    darkModeSync: false
  }
};

export const hasCapability = (capability) => {
  const platform = getPlatform();
  return platformCapabilities[platform]?.[capability] || false;
};

// Export platform-specific modules
export * from './common/index.js';

// Conditionally load platform-specific modules
const loadPlatformModule = async () => {
  const platform = getPlatform();
  
  switch (platform) {
    case 'windows':
      return import('./windows/index.js');
    case 'macos':
      return import('./macos/index.js');
    default:
      return import('./common/index.js');
  }
};

// Lazy-loaded platform-specific exports
let platformModule = null;
export const getPlatformModule = async () => {
  if (!platformModule) {
    platformModule = await loadPlatformModule();
  }
  return platformModule;
};