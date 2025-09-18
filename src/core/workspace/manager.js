// src/core/workspace/manager.js
import { invoke } from "@tauri-apps/api/core";

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
    try {
      return await invoke("validate_workspace_path", { path });
    } catch (error) {
      console.error("Failed to validate workspace path:", error);
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
      console.error("Failed to get validated workspace path:", error);
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
      console.error("Failed to save workspace path:", error);
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
      console.error("Failed to clear workspace path:", error);
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
      console.error("Failed to get startup state:", error);
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
      console.log("Cleared all workspace data");
      return true;
    } catch (error) {
      console.error("Failed to clear workspace data:", error);
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
      console.error("Failed to check development mode:", error);
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
      console.log("Forced launcher mode - all workspace data cleared");
      return true;
    } catch (error) {
      console.error("Failed to force launcher mode:", error);
      return false;
    }
  }
}

/**
 * Legacy support - maintain backward compatibility
 */
export const getSavedWorkspacePath = () => {
  console.warn("getSavedWorkspacePath is deprecated, use WorkspaceManager.getValidatedWorkspacePath()");
  return WorkspaceManager.getValidatedWorkspacePath();
};

export const saveWorkspacePath = (path) => {
  console.warn("saveWorkspacePath is deprecated, use WorkspaceManager.saveWorkspacePath()");
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
  
  console.log('🛠️ Developer workspace utilities available:');
  console.log('- window.clearWorkspaceData() - Clear all workspace data');
  console.log('- window.forceLauncherMode() - Force launcher mode');
  console.log('- window.checkDevMode() - Check if in development mode');
  console.log('- window.WorkspaceManager - Full workspace manager class');
}