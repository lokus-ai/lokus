/**
 * macOS-specific platform functionality
 * 
 * This module contains macOS-specific implementations and utilities
 */

import { fileOperations, keyboardUtils, uiUtils, validationUtils } from '../common/index.js';

// Re-export common utilities
export { fileOperations, keyboardUtils, uiUtils, validationUtils };

// macOS-specific keyboard shortcuts
export const macosShortcuts = {
  // File operations
  newFile: 'Cmd+N',
  newFolder: 'Cmd+Shift+N',
  save: 'Cmd+S',
  saveAs: 'Cmd+Shift+S',
  close: 'Cmd+W',
  closeAll: 'Cmd+Option+W',
  
  // Navigation
  find: 'Cmd+F',
  findAndReplace: 'Cmd+Option+F',
  findInFiles: 'Cmd+Shift+F',
  commandPalette: 'Cmd+K',
  quickOpen: 'Cmd+P',
  
  // macOS-specific
  spotlight: 'Cmd+Space',
  quickLook: 'Space',
  getInfo: 'Cmd+I',
  showInFinder: 'Cmd+Option+R',
  
  // Editing
  cut: 'Cmd+X',
  copy: 'Cmd+C',
  paste: 'Cmd+V',
  selectAll: 'Cmd+A',
  undo: 'Cmd+Z',
  redo: 'Cmd+Shift+Z',
  
  // Tab navigation
  nextTab: 'Cmd+Option+Right',
  previousTab: 'Cmd+Option+Left',
  closeTab: 'Cmd+W',
  reopenTab: 'Cmd+Shift+T',
  
  // View toggles
  toggleSidebar: 'Cmd+B',
  togglePreview: 'Cmd+Shift+V',
  zoomIn: 'Cmd+Plus',
  zoomOut: 'Cmd+Minus',
  resetZoom: 'Cmd+0',
  
  // macOS window management
  minimize: 'Cmd+M',
  hideWindow: 'Cmd+H',
  hideOthers: 'Cmd+Option+H',
  fullscreen: 'Cmd+Control+F'
};

// macOS-specific path utilities
export const macosPathUtils = {
  // Expand tilde to home directory
  expandTilde: (path) => {
    if (path.startsWith('~/')) {
      // Would need to get actual home directory from Tauri
      return path.replace('~/', '/Users/username/');
    }
    return path;
  },
  
  // Check if path is in iCloud
  isICloudPath: (path) => {
    return path.includes('/Library/Mobile Documents/com~apple~CloudDocs/');
  },
  
  // Get iCloud relative path
  getICloudRelativePath: (path) => {
    const iCloudBase = '/Library/Mobile Documents/com~apple~CloudDocs/';
    const index = path.indexOf(iCloudBase);
    if (index !== -1) {
      return path.substring(index + iCloudBase.length);
    }
    return path;
  },
  
  // Check if path is absolute
  isAbsolutePath: (path) => {
    return path.startsWith('/') || path.startsWith('~');
  }
};

// macOS-specific file validation
export const macosValidation = {
  ...validationUtils,
  
  // Check for macOS invalid characters
  isValidFilename: (filename) => {
    // macOS forbids : and /
    const invalidChars = /[:/]/;
    return !invalidChars.test(filename) && 
           !filename.startsWith('.') && // Hidden files
           filename.trim().length > 0;
  },
  
  // Check if filename is too long
  isFilenameLengthValid: (filename) => {
    // macOS HFS+ limit is 255 UTF-16 characters
    return filename.length <= 255;
  }
};

// macOS-specific UI adaptations
export const macosUI = {
  // Get macOS accent color
  getAccentColor: () => {
    // Would need Tauri command to read from system preferences
    return '#007AFF'; // Default blue
  },
  
  // Check if dark mode is enabled
  isDarkModeEnabled: () => {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  },
  
  // macOS specific styles
  getMacStyles: () => ({
    borderRadius: '10px',
    backdropFilter: 'blur(50px)',
    WebkitBackdropFilter: 'blur(50px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
  }),
  
  // Traffic light button positions
  getTrafficLightInset: () => ({
    left: '12px',
    top: '12px'
  })
};

// macOS Finder integration utilities
export const finderIntegration = {
  // Generate Finder context menu items
  getContextMenuItems: () => [
    {
      id: 'open-with-lokus',
      label: 'Open with Lokus',
      icon: 'file-text'
    },
    {
      id: 'quick-look',
      label: 'Quick Look',
      icon: 'eye',
      shortcut: 'Space'
    },
    {
      id: 'reveal-in-finder',
      label: 'Reveal in Finder',
      icon: 'folder-open',
      shortcut: 'Cmd+R'
    }
  ],
  
  // Finder tags
  getFinderTags: () => [
    { name: 'Red', color: '#FF3B30' },
    { name: 'Orange', color: '#FF9500' },
    { name: 'Yellow', color: '#FFCC00' },
    { name: 'Green', color: '#34C759' },
    { name: 'Blue', color: '#007AFF' },
    { name: 'Purple', color: '#5856D6' },
    { name: 'Gray', color: '#8E8E93' }
  ]
};

// macOS-specific features
export const macosFeatures = {
  // Touch Bar support
  getTouchBarItems: () => [
    {
      type: 'button',
      label: 'New Note',
      icon: 'plus',
      action: 'new-file'
    },
    {
      type: 'button',
      label: 'Search',
      icon: 'search',
      action: 'search'
    },
    {
      type: 'colorPicker',
      action: 'text-highlight'
    }
  ],
  
  // Continuity features
  getContinuityOptions: () => ({
    handoff: true,
    universalClipboard: true,
    airdrop: true
  }),
  
  // macOS notification options
  getNotificationOptions: () => ({
    sound: 'default',
    badge: true,
    banner: true,
    alert: false
  })
};