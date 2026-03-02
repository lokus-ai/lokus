// NOTE: .canvas (TLDraw) format is DEPRECATED and unsupported. All new canvases use .excalidraw format.

import { invoke } from '@tauri-apps/api/core';
import { isValidFilePath, sanitizeUserInput } from '../security/index.js';
import { joinPath, ensureExtension } from '../../utils/pathUtils.js';
import { invalidateCache } from './preview-generator.js';

/**
 * Canvas File Manager
 * Handles .excalidraw file operations (Excalidraw format)
 */

export class CanvasManager {
  constructor() {
    this.canvasCache = new Map();
    this.saveQueue = new Map(); // Track concurrent saves per file
    this.loadQueue = new Map(); // Track concurrent loads per file
  }

  /**
   * Create an empty Excalidraw document
   * @returns {Object} - Empty Excalidraw JSON
   */
  createEmptyExcalidrawData() {
    return {
      type: 'excalidraw',
      version: 2,
      source: 'lokus',
      elements: [],
      appState: {
        viewBackgroundColor: 'transparent'
      },
      files: {}
    };
  }

  /**
   * Create a new canvas file
   * @param {string} workspacePath - Path to the workspace
   * @param {string} name - Name of the canvas (without extension)
   * @returns {Promise<string>} - Path to the created canvas file
   */
  async createCanvas(workspacePath, name) {
    try {
      // Validate inputs
      if (!isValidFilePath(workspacePath)) {
        throw new Error('Invalid workspace path');
      }

      const sanitizedName = sanitizeUserInput(name);
      if (!sanitizedName) {
        throw new Error('Invalid canvas name');
      }

      const fileName = ensureExtension(sanitizedName, '.excalidraw');
      const canvasPath = joinPath(workspacePath, fileName);

      // Validate final path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas path');
      }

      // Create empty canvas with Excalidraw format
      const emptyCanvas = this.createEmptyExcalidrawData();
      const content = JSON.stringify(emptyCanvas, null, 2);

      await invoke('write_file_content', {
        workspacePath: workspacePath,
        path: canvasPath,
        content
      });

      return canvasPath;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Load canvas data from file with queue management
   * @param {string} canvasPath - Path to the canvas file
   * @returns {Promise<Object>} - Canvas data (Excalidraw JSON)
   */
  async loadCanvas(canvasPath) {
    // Prevent concurrent loads of same file
    if (this.loadQueue.has(canvasPath)) {
      return this.loadQueue.get(canvasPath);
    }

    const loadPromise = this._loadCanvasInternal(canvasPath);
    this.loadQueue.set(canvasPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadQueue.delete(canvasPath);
    }
  }

  /**
   * Internal load implementation
   * @private
   */
  async _loadCanvasInternal(canvasPath) {
    try {
      // Validate file path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas path');
      }

      // Wait for any pending saves to complete
      if (this.saveQueue.has(canvasPath)) {
        await this.saveQueue.get(canvasPath);
      }

      // ALWAYS clear cache before loading to ensure fresh data after saves
      this.canvasCache.delete(canvasPath);

      const content = await invoke('read_file_content', {
        workspacePath: window.__WORKSPACE_PATH__,
        path: canvasPath
      });

      let canvasData;
      try {
        canvasData = JSON.parse(content);
      } catch (parseError) {
        canvasData = this.createEmptyExcalidrawData();
      }

      // Cache the loaded data
      this.canvasCache.set(canvasPath, canvasData);

      return canvasData;
    } catch (error) {
      return this.createEmptyExcalidrawData();
    }
  }

  /**
   * Save canvas data to file with queue management
   * @param {string} canvasPath - Path to the canvas file
   * @param {Object} canvasData - Canvas data to save (Excalidraw JSON)
   * @returns {Promise<void>}
   */
  async saveCanvas(canvasPath, canvasData) {
    // Prevent concurrent saves to same file
    if (this.saveQueue.has(canvasPath)) {
      await this.saveQueue.get(canvasPath);
    }

    const savePromise = this._saveCanvasInternal(canvasPath, canvasData);
    this.saveQueue.set(canvasPath, savePromise);

    try {
      await savePromise;
    } finally {
      this.saveQueue.delete(canvasPath);
    }
  }

  /**
   * Internal save implementation
   * @private
   */
  async _saveCanvasInternal(canvasPath, canvasData) {
    try {
      // Validate file path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas path');
      }

      const content = JSON.stringify(canvasData, null, 2);

      await invoke('write_file_content', {
        workspacePath: window.__WORKSPACE_PATH__,
        path: canvasPath,
        content
      });

      // Clear cache to force fresh read next time
      this.canvasCache.delete(canvasPath);
      invalidateCache(canvasPath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete canvas file
   * @param {string} canvasPath - Path to the canvas file
   * @returns {Promise<void>}
   */
  async deleteCanvas(canvasPath) {
    try {
      await invoke('delete_file', { workspacePath: window.__WORKSPACE_PATH__, path: canvasPath });
      this.canvasCache.delete(canvasPath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Export canvas to various formats
   * @param {string} canvasPath - Path to the canvas file
   * @param {string} format - Export format ('png', 'svg', 'pdf', 'json')
   * @returns {Promise<string>} - Path to exported file
   */
  async exportCanvas(canvasPath, format = 'png') {
    try {
      // This would need to be implemented with actual export functionality
      // For now, just return the canvas path
      return `${canvasPath}.${format}`;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Clear cache for a specific canvas or all canvases
   * @param {string} [canvasPath] - Specific canvas path to clear, or undefined for all
   */
  clearCache(canvasPath) {
    if (canvasPath) {
      this.canvasCache.delete(canvasPath);
    } else {
      this.canvasCache.clear();
    }
  }

  /**
   * Get current queue status for debugging
   * @returns {Object} - Queue status information
   */
  getQueueStatus() {
    return {
      activeLoads: Array.from(this.loadQueue.keys()),
      activeSaves: Array.from(this.saveQueue.keys()),
      cachedFiles: Array.from(this.canvasCache.keys())
    };
  }

  /**
   * Wait for all pending operations to complete
   * @returns {Promise<void>}
   */
  async waitForPendingOperations() {
    const allPromises = [
      ...Array.from(this.saveQueue.values()),
      ...Array.from(this.loadQueue.values())
    ];

    if (allPromises.length > 0) {
      await Promise.all(allPromises);
    }
  }

  /**
   * Get all canvas files from workspace
   * @returns {Array} - Array of canvas file paths
   */
  getAllCanvasFiles() {
    const fileIndex = globalThis.__LOKUS_FILE_INDEX__ || [];
    return fileIndex.filter(f => f.path.endsWith('.excalidraw'));
  }
}

// Create singleton instance
export const canvasManager = new CanvasManager();
