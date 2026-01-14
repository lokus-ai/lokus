// src/core/workspace/manager.js
import { invoke } from "@tauri-apps/api/core";

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

// Check if Tauri APIs are available
function isTauriAvailable() {
  try {
    const w = window;
    return !!(
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (navigator?.userAgent || '').includes('Tauri')
    );
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
    // On mobile, use filesystem plugin to validate instead of Rust command
    // The desktop validation uses macOS security-scoped bookmarks which don't exist on iOS
    if (isMobilePlatform()) {
      try {
        const { exists, stat } = await import("@tauri-apps/plugin-fs");
        const pathExists = await exists(path);
        if (!pathExists) return false;

        const pathStat = await stat(path);
        return pathStat.isDirectory;
      } catch (error) {
        console.error("Mobile workspace validation error:", error);
        // If we can't check, assume it's valid (we created it)
        return path && typeof path === 'string' && path.length > 0;
      }
    }

    try {
      return await invoke("validate_workspace_path", { path });
    } catch (error) {
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
    try {
      // Validate before saving
      const isValid = await this.validatePath(path);
      if (!isValid) {
        throw new Error("Invalid workspace path");
      }

      // On mobile, we don't need to call the Rust save command
      // The recents list in localStorage is sufficient
      if (isMobilePlatform()) {
        return true;
      }

      await invoke("save_last_workspace", { path });
      return true;
    } catch (error) {
      console.error("Save workspace path error:", error);
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