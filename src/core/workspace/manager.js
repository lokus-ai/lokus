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
    // In browser/test mode without Tauri, accept any non-empty path
    // This enables E2E testing with Playwright
    if (!isTauriAvailable() && isTestMode()) {
      return path && typeof path === 'string' && path.length > 0;
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
      
      await invoke("save_last_workspace", { path });
      return true;
    } catch (error) {
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