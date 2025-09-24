/**
 * Platform Service
 * 
 * Centralized service for handling platform-specific operations
 * This ensures clean separation between platforms and provides a unified API
 */

import { 
  getPlatform, 
  isWindows, 
  isMacOS, 
  isLinux,
  getPlatformModule,
  hasCapability,
  getModifierKey,
  getPathSeparator
} from '../../platform/index.js';

class PlatformService {
  constructor() {
    this.platform = getPlatform();
    this.platformModule = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      this.platformModule = await getPlatformModule();
      this.initialized = true;
      console.log(`Platform Service initialized for ${this.platform}`);
    } catch (error) {
      console.error('Failed to initialize platform service:', error);
    }
  }

  // Platform detection
  getPlatform() {
    return this.platform;
  }

  isWindows() {
    return isWindows();
  }

  isMacOS() {
    return isMacOS();
  }

  isLinux() {
    return isLinux();
  }

  // Platform capabilities
  hasCapability(capability) {
    return hasCapability(capability);
  }

  // Keyboard shortcuts
  async getShortcuts() {
    await this.initialize();
    
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return {};
    }
    
    if (isWindows()) {
      return this.platformModule.windowsShortcuts || {};
    } else if (isMacOS()) {
      return this.platformModule.macosShortcuts || {};
    }
    
    // Default shortcuts for other platforms
    return this.platformModule.windowsShortcuts || {};
  }

  async getShortcut(action) {
    const shortcuts = await this.getShortcuts();
    return shortcuts[action] || null;
  }

  // Format shortcut for display
  formatShortcut(shortcut) {
    if (!shortcut) return '';
    
    // Replace Cmd/Ctrl with appropriate symbol
    let formatted = shortcut;
    if (isMacOS()) {
      formatted = formatted.replace(/Cmd/g, '⌘');
      formatted = formatted.replace(/Option/g, '⌥');
      formatted = formatted.replace(/Shift/g, '⇧');
      formatted = formatted.replace(/Control/g, '⌃');
    }
    
    return formatted;
  }

  // Path utilities
  async getPathUtils() {
    await this.initialize();
    
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return {};
    }
    
    if (isWindows()) {
      return this.platformModule.windowsPathUtils || {};
    } else if (isMacOS()) {
      return this.platformModule.macosPathUtils || {};
    }
    
    return this.platformModule || {};
  }

  async normalizePath(path) {
    const utils = await this.getPathUtils();
    if (isWindows() && utils.normalizePath) {
      return utils.normalizePath(path);
    }
    return path;
  }

  getPathSeparator() {
    return getPathSeparator();
  }

  // File validation
  async getValidation() {
    await this.initialize();
    
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return { isValidFilename: () => true };
    }
    
    if (isWindows()) {
      return this.platformModule.windowsValidation || { isValidFilename: () => true };
    } else if (isMacOS()) {
      return this.platformModule.macosValidation || { isValidFilename: () => true };
    }
    
    return this.platformModule.validationUtils || { isValidFilename: () => true };
  }

  async isValidFilename(filename) {
    const validation = await this.getValidation();
    return validation.isValidFilename(filename);
  }

  // UI adaptations
  async getUIUtils() {
    await this.initialize();
    
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return {
        isDarkModeEnabled: () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      };
    }
    
    if (isWindows()) {
      return this.platformModule.windowsUI || {
        isDarkModeEnabled: () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      };
    } else if (isMacOS()) {
      return this.platformModule.macosUI || {
        isDarkModeEnabled: () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      };
    }
    
    return {
      isDarkModeEnabled: () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    };
  }

  async getPlatformStyles() {
    const ui = await this.getUIUtils();
    
    if (isWindows() && ui.getWindowsStyles) {
      return ui.getWindowsStyles();
    } else if (isMacOS() && ui.getMacStyles) {
      return ui.getMacStyles();
    }
    
    return {};
  }

  // Shell/Finder integration
  async getShellIntegration() {
    await this.initialize();
    
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return null;
    }
    
    if (isWindows()) {
      return this.platformModule.windowsShell || null;
    } else if (isMacOS()) {
      return this.platformModule.finderIntegration || null;
    }
    
    return null;
  }

  async getContextMenuItems() {
    const shell = await this.getShellIntegration();
    return shell?.getContextMenuItems?.() || [];
  }

  // Platform-specific features
  async getPlatformFeatures() {
    await this.initialize();
    
    if (isWindows()) {
      return this.platformModule.windowsFeatureHelpers || this.platformModule.windowsFeaturesFromModule;
    } else if (isMacOS()) {
      return this.platformModule.macosFeatures;
    }
    
    return {};
  }

  // Modifier key helpers
  getModifierKey() {
    return getModifierKey();
  }

  getModifierSymbol() {
    return isMacOS() ? '⌘' : 'Ctrl';
  }

  // Convert generic shortcut to platform-specific
  convertShortcut(genericShortcut) {
    let converted = genericShortcut;
    
    if (isMacOS()) {
      converted = converted.replace(/Ctrl/g, 'Cmd');
      converted = converted.replace(/Alt/g, 'Option');
    } else {
      converted = converted.replace(/Cmd/g, 'Ctrl');
      converted = converted.replace(/Option/g, 'Alt');
    }
    
    return converted;
  }

  // Check if event matches a shortcut
  matchesShortcut(event, shortcut) {
    if (!this.platformModule) {
      console.warn('Platform module not initialized');
      return false;
    }
    
    const normalized = this.platformModule?.keyboardUtils?.getNormalizedKey?.(event);
    if (!normalized) return false;
    
    const platformShortcut = this.convertShortcut(shortcut);
    return normalized === platformShortcut.replace(/\+/g, '+');
  }
}

// Export singleton instance
const platformService = new PlatformService();
export default platformService;