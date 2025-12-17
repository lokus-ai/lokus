/**
 * Windows-specific Platform Features
 * 
 * This module implements Windows-specific features like
 * file associations, jump lists, and shell integration
 */

import { invoke } from '@tauri-apps/api/core';
import { windowsConfig } from '../../config/platforms/windows.config.js';

/**
 * Windows File Association Manager
 */
export const fileAssociations = {
  /**
   * Register file associations for .md and .markdown files
   */
  async register() {
    try {
      // This would require Tauri command to modify Windows registry
      await invoke('windows_register_file_associations', {
        associations: windowsConfig.files.associations
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Check if file associations are registered
   */
  async check() {
    try {
      return await invoke('windows_check_file_associations');
    } catch (error) {
      return false;
    }
  }
};

/**
 * Windows Jump List Manager
 */
export const jumpList = {
  /**
   * Update Windows taskbar jump list with recent workspaces
   */
  async update(recentWorkspaces) {
    try {
      const items = recentWorkspaces.map(workspace => ({
        type: 'task',
        title: workspace.name || 'Untitled Workspace',
        description: workspace.path,
        program: 'lokus.exe',
        args: `"${workspace.path}"`,
        iconPath: workspace.path,
        iconIndex: 0
      }));

      await invoke('windows_update_jump_list', {
        items,
        maxItems: windowsConfig.shell.jumpList.maxItems
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Clear the jump list
   */
  async clear() {
    try {
      await invoke('windows_clear_jump_list');
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Windows Shell Context Menu Manager
 */
export const contextMenu = {
  /**
   * Register "Open with Lokus" in Windows Explorer context menu
   */
  async register() {
    try {
      await invoke('windows_register_context_menu', {
        entries: windowsConfig.shell.contextMenu.entries
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Unregister context menu entries
   */
  async unregister() {
    try {
      await invoke('windows_unregister_context_menu');
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Windows Taskbar Progress Manager
 */
export const taskbarProgress = {
  /**
   * Show progress on Windows taskbar
   * @param {number} progress - Progress value between 0 and 1
   * @param {string} state - 'normal', 'error', 'paused', 'indeterminate'
   */
  async setProgress(progress, state = 'normal') {
    try {
      await invoke('windows_set_taskbar_progress', {
        progress: Math.max(0, Math.min(1, progress)),
        state
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Clear taskbar progress
   */
  async clear() {
    try {
      await invoke('windows_clear_taskbar_progress');
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Windows Notification Manager
 */
export const notifications = {
  /**
   * Show Windows native notification
   */
  async show(options) {
    try {
      const notification = {
        title: options.title,
        body: options.body,
        icon: options.icon || 'lokus.ico',
        sound: options.sound !== false ? windowsConfig.notifications.defaultSound : null,
        actions: options.actions || [],
        silent: options.silent || false
      };

      const id = await invoke('windows_show_notification', notification);
      return id;
    } catch (error) {
      return null;
    }
  },

  /**
   * Clear specific notification
   */
  async clear(notificationId) {
    try {
      await invoke('windows_clear_notification', { id: notificationId });
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Windows Theme Integration
 */
export const themeIntegration = {
  /**
   * Sync with Windows dark mode settings
   */
  async syncDarkMode() {
    try {
      const isDarkMode = await invoke('windows_is_dark_mode');
      return isDarkMode;
    } catch (error) {
      // Fallback to media query
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
  },

  /**
   * Listen for Windows theme changes
   */
  async onThemeChange(callback) {
    try {
      // This would require a Tauri event listener
      await invoke('windows_watch_theme_changes');
      // Listen for theme change events
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen('windows-theme-changed', (event) => {
        callback(event.payload.isDarkMode);
      });
      return unlisten;
    } catch (error) {
      return null;
    }
  }
};

/**
 * Windows Search Integration
 */
export const searchIntegration = {
  /**
   * Index notes for Windows Search
   */
  async indexWorkspace(workspacePath) {
    try {
      await invoke('windows_index_workspace', {
        path: workspacePath
      });
      return true;
    } catch (error) {
      return false;
    }
  },

  /**
   * Remove workspace from Windows Search index
   */
  async removeFromIndex(workspacePath) {
    try {
      await invoke('windows_remove_from_index', {
        path: workspacePath
      });
      return true;
    } catch (error) {
      return false;
    }
  }
};

/**
 * Initialize all Windows features
 */
export async function initializeWindowsFeatures(options = {}) {
  const results = {
    fileAssociations: false,
    contextMenu: false,
    darkModeSync: false
  };

  // Register file associations
  if (options.fileAssociations !== false) {
    results.fileAssociations = await fileAssociations.register();
  }

  // Register context menu
  if (options.contextMenu !== false) {
    results.contextMenu = await contextMenu.register();
  }

  // Sync dark mode
  if (options.darkModeSync !== false) {
    results.darkModeSync = await themeIntegration.syncDarkMode();
  }

  return results;
}

/**
 * Cleanup Windows features
 */
export async function cleanupWindowsFeatures() {
  await contextMenu.unregister();
  await jumpList.clear();
  await taskbarProgress.clear();
}