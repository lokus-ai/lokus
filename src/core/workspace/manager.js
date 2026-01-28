// src/core/workspace/manager.js
import { invoke } from "@tauri-apps/api/core";

// Check if running in Tauri environment
function isTauriAvailable() {
  try {
    const w = typeof window !== 'undefined' ? window : globalThis;
    return !!(
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
    );
  } catch {
    return false;
  }
}

// Check if running in test mode
function isTestMode() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('testMode') === 'true';
  } catch {
    return false;
  }
}

// Check if running on mobile (iOS/Android)
function isMobilePlatform() {
  try {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = navigator.platform?.toLowerCase() || '';

    // iOS detection
    if (/iphone|ipad|ipod/.test(userAgent) || (platform === 'macintel' && navigator.maxTouchPoints > 1)) {
      return true;
    }
    // Android detection
    if (userAgent.includes('android')) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Workspace Manager - Handles workspace validation and management
 */
export class WorkspaceManager {
  /**
   * Validate if a path is a valid workspace
   * @param {string} path - Path to validate
   * @returns {Promise<boolean>} True if valid workspace
   */
  static async validatePath(path) {
    console.log('[WorkspaceManager] validatePath called:', path);

    // In browser/test mode without Tauri, accept any non-empty path
    // This enables E2E testing with Playwright
    if (!isTauriAvailable() && isTestMode()) {
      console.log('[WorkspaceManager] Test mode: accepting any non-empty path');
      return path && typeof path === 'string' && path.length > 0;
    }

    // On mobile, use filesystem plugin to validate instead of Rust command
    // The desktop validation uses macOS security-scoped bookmarks which don't exist on iOS
    if (isMobilePlatform()) {
      console.log('[WorkspaceManager] Mobile platform detected, using FS plugin');
      try {
        const { exists, stat } = await import("@tauri-apps/plugin-fs");
        const pathExists = await exists(path);
        console.log('[WorkspaceManager] Path exists:', pathExists);
        if (!pathExists) return false;

        const pathStat = await stat(path);
        console.log('[WorkspaceManager] Path stat:', pathStat);
        return pathStat.isDirectory;
      } catch (error) {
        console.error('[WorkspaceManager] Mobile workspace validation error:', error);
        // If we can't check the path, it's not valid - don't assume it exists
        return false;
      }
    }

    try {
      console.log('[WorkspaceManager] Desktop: invoking validate_workspace_path');
      const result = await invoke("validate_workspace_path", { path });
      console.log('[WorkspaceManager] Validation result:', result);
      return result;
    } catch (error) {
      console.error('[WorkspaceManager] Desktop validation error:', error);
      return false;
    }
  }

  /**
   * Get the last validated workspace path
   * @returns {Promise<string|null>} Valid workspace path or null
   */
  static async getValidatedWorkspacePath() {
    try {
      return await invoke("get_validated_workspace_path");
    } catch (error) {
      return null;
    }
  }

  /**
   * Save workspace path (with validation)
   * @param {string} path - Workspace path to save
   * @returns {Promise<boolean>} True if saved successfully
   */
  static async saveWorkspacePath(path) {
    console.log('[WorkspaceManager] saveWorkspacePath called:', path);
    try {
      // Validate before saving
      const isValid = await this.validatePath(path);
      if (!isValid) {
        console.error('[WorkspaceManager] Cannot save - invalid workspace path');
        throw new Error("Invalid workspace path");
      }

      // On mobile, we don't need to call the Rust save command
      // The recents list in localStorage is sufficient
      if (isMobilePlatform()) {
        console.log('[WorkspaceManager] Mobile: skipping Rust save, using localStorage');
        return true;
      }

      await invoke("save_last_workspace", { path });
      console.log('[WorkspaceManager] Workspace path saved successfully');
      return true;
    } catch (error) {
      console.error('[WorkspaceManager] Save workspace path error:', error);
      return false;
    }
  }

  /**
   * Clear saved workspace path
   * @returns {Promise<boolean>} True if cleared successfully
   */
  static async clearWorkspacePath() {
    try {
      await invoke("clear_last_workspace");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if app should show launcher or workspace
   * @returns {Promise<{showLauncher: boolean, workspacePath?: string}>}
   */
  static async getStartupState() {
    try {
      const validPath = await this.getValidatedWorkspacePath();
      if (validPath) {
        return { showLauncher: false, workspacePath: validPath };
      } else {
        return { showLauncher: true };
      }
    } catch (error) {
      return { showLauncher: true };
    }
  }

  /**
   * Clear all workspace data (useful for development)
   * @returns {Promise<boolean>} True if cleared successfully
   */
  static async clearAllWorkspaceData() {
    try {
      await invoke("clear_all_workspace_data");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if app is in development mode
   * @returns {Promise<boolean>} True if in development mode
   */
  static async isDevelopmentMode() {
    try {
      return await invoke("is_development_mode");
    } catch (error) {
      return false;
    }
  }

  /**
   * Force the app to launcher mode (clears all workspace data)
   * @returns {Promise<boolean>} True if forced successfully
   */
  static async forceLauncherMode() {
    try {
      await invoke("force_launcher_mode");
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if a workspace needs re-authorization
   * This happens after app updates/re-signing when security-scoped bookmarks become stale
   * @param {string} path - Path to check
   * @returns {Promise<boolean>} True if workspace needs re-authorization
   */
  static async checkNeedsReauth(path) {
    // In browser/test mode, never needs reauth
    if (!isTauriAvailable()) {
      return false;
    }

    // On mobile, we don't use security-scoped bookmarks, so never needs reauth
    if (isMobilePlatform()) {
      return false;
    }

    try {
      return await invoke("check_workspace_needs_reauth", { path });
    } catch (error) {
      return false;
    }
  }
}

/**
 * Legacy support - maintain backward compatibility
 */
export const getSavedWorkspacePath = () => {
  return WorkspaceManager.getValidatedWorkspacePath();
};

export const saveWorkspacePath = (path) => {
  return WorkspaceManager.saveWorkspacePath(path);
};

/**
 * Developer utility functions - expose on window for easy access
 */
if (typeof window !== 'undefined') {
  window.WorkspaceManager = WorkspaceManager;
  
  // Quick dev commands
  window.clearWorkspaceData = () => WorkspaceManager.clearAllWorkspaceData();
  window.forceLauncherMode = () => WorkspaceManager.forceLauncherMode();
  window.checkDevMode = () => WorkspaceManager.isDevelopmentMode();
}