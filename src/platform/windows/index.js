/**
 * Windows-specific platform functionality
 * 
 * This module contains Windows-specific implementations and utilities
 */

import { fileOperations, keyboardUtils, uiUtils, validationUtils } from '../common/index.js';
import * as featuresModule from './features.js';

// Re-export common utilities
export { fileOperations, keyboardUtils, uiUtils, validationUtils };

// Export Windows-specific features from the features module
export { featuresModule as windowsFeaturesFromModule };

// Windows-specific keyboard shortcuts
export const windowsShortcuts = {
  // File operations
  newFile: 'Ctrl+N',
  newFolder: 'Ctrl+Shift+N',
  save: 'Ctrl+S',
  saveAs: 'Ctrl+Shift+S',
  close: 'Ctrl+W',
  closeAll: 'Ctrl+Shift+W',
  
  // Navigation
  find: 'Ctrl+F',
  findAndReplace: 'Ctrl+H',
  findInFiles: 'Ctrl+Shift+F',
  commandPalette: 'Ctrl+K',
  quickOpen: 'Ctrl+P',
  
  // Windows-specific
  properties: 'Alt+Enter',
  rename: 'F2',
  refresh: 'F5',
  fullscreen: 'F11',
  
  // Editing
  cut: 'Ctrl+X',
  copy: 'Ctrl+C',
  paste: 'Ctrl+V',
  selectAll: 'Ctrl+A',
  undo: 'Ctrl+Z',
  redo: 'Ctrl+Y',
  
  // Tab navigation
  nextTab: 'Ctrl+Tab',
  previousTab: 'Ctrl+Shift+Tab',
  closeTab: 'Ctrl+W',
  reopenTab: 'Ctrl+Shift+T',
  
  // View toggles
  toggleSidebar: 'Ctrl+B',
  togglePreview: 'Ctrl+Shift+V',
  zoomIn: 'Ctrl+Plus',
  zoomOut: 'Ctrl+Minus',
  resetZoom: 'Ctrl+0'
};

// Windows-specific path utilities
export const windowsPathUtils = {
  // Convert Unix-style path to Windows
  toWindowsPath: (path) => {
    if (!path) return path;
    // Handle UNC paths
    if (path.startsWith('//')) {
      return '\\\\' + path.slice(2).replace(/\//g, '\\');
    }
    return path.replace(/\//g, '\\');
  },
  
  // Convert Windows path to Unix-style (for internal use)
  toUnixPath: (path) => {
    if (!path) return path;
    // Handle UNC paths
    if (path.startsWith('\\\\')) {
      return '//' + path.slice(2).replace(/\\/g, '/');
    }
    return path.replace(/\\/g, '/');
  },
  
  // Get drive letter from path
  getDriveLetter: (path) => {
    const match = path.match(/^([A-Za-z]):/);
    return match ? match[1].toUpperCase() : null;
  },
  
  // Check if path is absolute
  isAbsolutePath: (path) => {
    // Drive letter or UNC path
    return /^[A-Za-z]:/.test(path) || path.startsWith('\\\\');
  },
  
  // Check if path is UNC
  isUNCPath: (path) => {
    return path.startsWith('\\\\') || path.startsWith('//');
  },
  
  // Normalize Windows path
  normalizePath: (path) => {
    if (!path) return path;
    
    // Handle UNC paths carefully
    if (path.startsWith('\\\\')) {
      const uncPrefix = '\\\\';
      const rest = path.slice(2).replace(/\\+/g, '\\').replace(/\\$/, '');
      return uncPrefix + rest;
    }
    
    // Regular paths
    return path.replace(/\\+/g, '\\')
               .replace(/\\$/, ''); // Remove trailing backslash except for root
  },
  
  // Join paths properly for Windows
  joinPath: (...parts) => {
    const joined = parts
      .filter(Boolean)
      .join('\\')
      .replace(/\\+/g, '\\');
    
    // Preserve UNC prefix
    if (parts[0] && parts[0].startsWith('\\\\')) {
      return '\\\\' + joined.slice(2);
    }
    
    return joined;
  },
  
  // Get parent directory
  getParentDirectory: (path) => {
    if (!path) return path;
    const normalized = windowsPathUtils.normalizePath(path);
    const parts = normalized.split('\\');
    
    // Handle root paths
    if (parts.length <= 1) return null;
    if (parts.length === 2 && parts[1] === '') return null; // C:\
    
    parts.pop();
    return parts.join('\\');
  },
  
  // Extract filename from path
  getFilename: (path) => {
    if (!path) return '';
    const normalized = windowsPathUtils.normalizePath(path);
    const parts = normalized.split('\\');
    return parts[parts.length - 1];
  },
  
  // Check if path exceeds Windows MAX_PATH limit
  isPathTooLong: (path) => {
    // Windows MAX_PATH is 260, but with \\?\ prefix can be up to 32,767
    return path.length >= 260 && !path.startsWith('\\\\?\\');
  },
  
  // Convert to long path format if needed
  toLongPath: (path) => {
    if (!path || path.startsWith('\\\\?\\')) return path;
    if (windowsPathUtils.isUNCPath(path)) {
      // UNC paths become \\?\UNC\server\share
      return '\\\\?\\UNC\\' + path.slice(2);
    }
    if (windowsPathUtils.isAbsolutePath(path) && path.length >= 260) {
      return '\\\\?\\' + path;
    }
    return path;
  }
};

// Windows-specific file validation
export const windowsValidation = {
  ...validationUtils,
  
  // Check for Windows reserved filenames
  isReservedFilename: (filename) => {
    const reserved = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    const baseName = filename.split('.')[0].toUpperCase();
    return reserved.includes(baseName);
  },
  
  // Validate Windows filename
  isValidFilename: (filename) => {
    const invalidChars = /[<>:"|?*\x00-\x1f]/;
    return !invalidChars.test(filename) && 
           !windowsValidation.isReservedFilename(filename) &&
           !filename.endsWith('.') &&
           !filename.endsWith(' ') &&
           filename.trim().length > 0;
  },
  
  // Check if path length is within Windows limits
  isPathLengthValid: (path) => {
    // Windows MAX_PATH is 260 characters
    return path.length < 260;
  }
};

// Windows-specific UI adaptations
export const windowsUI = {
  // Get Windows accent color (would need Tauri command to actually read from registry)
  getAccentColor: () => {
    // Default Windows 11 accent color
    return '#0078D4';
  },
  
  // Check if Windows dark mode is enabled (would need Tauri command)
  isDarkModeEnabled: () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },
  
  // Windows 11 specific styles
  getWindowsStyles: () => ({
    borderRadius: '8px',
    backdropFilter: 'blur(20px)',
    boxShadow: '0 2px 20px rgba(0, 0, 0, 0.1)'
  })
};

// Windows shell integration utilities
export const windowsShell = {
  // Generate context menu items
  getContextMenuItems: () => [
    {
      id: 'open-with-lokus',
      label: 'Open with Lokus',
      icon: 'file-text'
    },
    {
      id: 'reveal-in-explorer',
      label: 'Reveal in Explorer',
      icon: 'folder-open'
    }
  ],
  
  // File association info
  getFileAssociations: () => ({
    '.md': {
      description: 'Markdown Document',
      icon: 'markdown-icon',
      progId: 'Lokus.Markdown'
    },
    '.markdown': {
      description: 'Markdown Document',
      icon: 'markdown-icon',
      progId: 'Lokus.Markdown'
    }
  })
};

// Windows-specific feature helpers
export const windowsFeatureHelpers = {
  // Jump list items for taskbar
  getJumpListItems: (recentWorkspaces) => {
    return recentWorkspaces.map(workspace => ({
      type: 'task',
      title: workspace.name,
      description: workspace.path,
      program: 'lokus.exe',
      args: `--workspace "${workspace.path}"`,
      iconPath: workspace.path,
      iconIndex: 0
    }));
  },
  
  // Windows notification options
  getNotificationOptions: () => ({
    badge: true,
    sound: true,
    actions: true,
    inline: true,
    persistent: false
  })
};