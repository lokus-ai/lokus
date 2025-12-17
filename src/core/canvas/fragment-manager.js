import { invoke } from '@tauri-apps/api/core';
import { isValidFilePath } from '../security/index.js';

/**
 * Canvas Fragment Manager
 * Handles inline canvas fragments stored in .lokus/canvas-fragments/
 * Fragments are small TLDraw canvases embedded directly in markdown documents
 */

export class CanvasFragmentManager {
  constructor() {
    this.fragmentCache = new Map();
    this.saveQueue = new Map();
    this.loadQueue = new Map();
  }

  /**
   * Get the fragments directory path for a workspace
   * @param {string} workspacePath - Path to the workspace
   * @returns {string} - Path to fragments directory
   */
  getFragmentsDir(workspacePath) {
    return `${workspacePath}/.lokus/canvas-fragments`;
  }

  /**
   * Get the full path for a fragment file
   * @param {string} workspacePath - Path to the workspace
   * @param {string} fragmentId - UUID of the fragment
   * @returns {string} - Full path to fragment file
   */
  getFragmentPath(workspacePath, fragmentId) {
    return `${this.getFragmentsDir(workspacePath)}/${fragmentId}.json`;
  }

  /**
   * Ensure the fragments directory exists
   * @param {string} workspacePath - Path to the workspace
   * @returns {Promise<void>}
   */
  async ensureFragmentsDir(workspacePath) {
    try {
      const fragmentsDir = this.getFragmentsDir(workspacePath);

      // Create directories recursively (creates .lokus and canvas-fragments)
      try {
        await invoke('create_directory', { path: fragmentsDir, recursive: true });
      } catch {
        // Directory might already exist
      }
    } catch (error) {
      console.error('[Fragment Manager] Error creating directories:', error.message);
    }
  }

  /**
   * Generate a new UUID for a fragment
   * @returns {string} - UUID v4
   */
  generateFragmentId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Create a new empty fragment
   * @param {string} workspacePath - Path to the workspace
   * @param {number} width - Canvas width (default 600)
   * @param {number} height - Canvas height (default 400)
   * @returns {Promise<{fragmentId: string, data: Object}>} - New fragment info
   */
  async createFragment(workspacePath, width = 600, height = 400) {
    await this.ensureFragmentsDir(workspacePath);

    const fragmentId = this.generateFragmentId();
    const data = this.createEmptyFragmentData(width, height);

    await this.saveFragment(workspacePath, fragmentId, data);

    return { fragmentId, data };
  }

  /**
   * Create empty TLDraw fragment data
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   * @returns {Object} - Empty TLDraw snapshot
   */
  createEmptyFragmentData(width = 600, height = 400) {
    return {
      records: [],
      schema: {
        schemaVersion: 1,
        storeVersion: 4,
        recordVersions: {
          asset: { version: 1, subTypeKey: 'type', subTypeVersions: { image: 2, video: 2, bookmark: 0 } },
          camera: { version: 1 },
          document: { version: 2 },
          instance: { version: 22 },
          instance_page_state: { version: 5 },
          page: { version: 1 },
          shape: {
            version: 3,
            subTypeKey: 'type',
            subTypeVersions: {
              group: 0, geo: 1, arrow: 1, highlight: 0, embed: 4, image: 2, video: 1, text: 1, draw: 1
            }
          },
          instance_presence: { version: 5 },
          pointer: { version: 1 }
        }
      },
      metadata: {
        width,
        height,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      }
    };
  }

  /**
   * Load fragment data from file with queue management
   * @param {string} workspacePath - Path to the workspace
   * @param {string} fragmentId - UUID of the fragment
   * @returns {Promise<Object>} - Fragment data
   */
  async loadFragment(workspacePath, fragmentId) {
    const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);

    // Prevent concurrent loads of same fragment
    if (this.loadQueue.has(fragmentPath)) {
      return this.loadQueue.get(fragmentPath);
    }

    const loadPromise = this._loadFragmentInternal(workspacePath, fragmentId);
    this.loadQueue.set(fragmentPath, loadPromise);

    try {
      const result = await loadPromise;
      return result;
    } finally {
      this.loadQueue.delete(fragmentPath);
    }
  }

  /**
   * Internal load implementation
   * @private
   */
  async _loadFragmentInternal(workspacePath, fragmentId) {
    try {
      const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);

      // Validate path
      if (!isValidFilePath(fragmentPath)) {
        throw new Error('Invalid fragment path');
      }

      // Wait for any pending saves
      if (this.saveQueue.has(fragmentPath)) {
        await this.saveQueue.get(fragmentPath);
      }

      // Clear cache before loading
      this.fragmentCache.delete(fragmentPath);

      const content = await invoke('read_file_content', { path: fragmentPath });
      let fragmentData;

      try {
        fragmentData = JSON.parse(content);

        // Ensure schema exists
        if (!fragmentData.schema) {
          fragmentData.schema = this.createEmptyFragmentData().schema;
        }
      } catch (parseError) {
        console.error('[Fragment Manager] Parse error:', parseError.message);
        fragmentData = this.createEmptyFragmentData();
      }

      // Cache the loaded data
      this.fragmentCache.set(fragmentPath, fragmentData);

      return fragmentData;
    } catch (error) {
      console.error('[Fragment Manager] Load error:', error.message);
      // Return empty fragment data on error
      return this.createEmptyFragmentData();
    }
  }

  /**
   * Save fragment data to file with queue management
   * @param {string} workspacePath - Path to the workspace
   * @param {string} fragmentId - UUID of the fragment
   * @param {Object} data - Fragment data to save
   * @returns {Promise<void>}
   */
  async saveFragment(workspacePath, fragmentId, data) {
    const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);

    // Prevent concurrent saves
    if (this.saveQueue.has(fragmentPath)) {
      await this.saveQueue.get(fragmentPath);
    }

    const savePromise = this._saveFragmentInternal(workspacePath, fragmentId, data);
    this.saveQueue.set(fragmentPath, savePromise);

    try {
      await savePromise;
    } finally {
      this.saveQueue.delete(fragmentPath);
    }
  }

  /**
   * Internal save implementation
   * @private
   */
  async _saveFragmentInternal(workspacePath, fragmentId, data) {
    try {
      await this.ensureFragmentsDir(workspacePath);

      const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);

      // Validate path
      if (!isValidFilePath(fragmentPath)) {
        throw new Error('Invalid fragment path');
      }

      // Update modified timestamp
      if (data.metadata) {
        data.metadata.modified = new Date().toISOString();
      }

      const content = JSON.stringify(data, null, 2);

      await invoke('write_file_content', {
        path: fragmentPath,
        content
      });

      // Clear cache
      this.fragmentCache.delete(fragmentPath);
    } catch (error) {
      console.error('[Fragment Manager] Save error:', error.message);
      throw error;
    }
  }

  /**
   * Delete a fragment file
   * @param {string} workspacePath - Path to the workspace
   * @param {string} fragmentId - UUID of the fragment
   * @returns {Promise<boolean>} - True if deleted successfully
   */
  async deleteFragment(workspacePath, fragmentId) {
    try {
      const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);

      await invoke('delete_file', { path: fragmentPath });
      this.fragmentCache.delete(fragmentPath);

      return true;
    } catch (error) {
      console.error('[Fragment Manager] Delete error:', error.message);
      return false;
    }
  }

  /**
   * Check if a fragment exists
   * @param {string} workspacePath - Path to the workspace
   * @param {string} fragmentId - UUID of the fragment
   * @returns {Promise<boolean>}
   */
  async fragmentExists(workspacePath, fragmentId) {
    try {
      const fragmentPath = this.getFragmentPath(workspacePath, fragmentId);
      await invoke('read_file_content', { path: fragmentPath });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * List all fragment IDs in a workspace
   * @param {string} workspacePath - Path to the workspace
   * @returns {Promise<string[]>} - Array of fragment IDs
   */
  async listFragments(workspacePath) {
    try {
      const fragmentsDir = this.getFragmentsDir(workspacePath);
      const files = await invoke('list_directory', { path: fragmentsDir });

      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /**
   * Clear all cached fragments
   */
  clearCache() {
    this.fragmentCache.clear();
  }

  /**
   * Get queue status for debugging
   * @returns {Object}
   */
  getQueueStatus() {
    return {
      activeLoads: Array.from(this.loadQueue.keys()),
      activeSaves: Array.from(this.saveQueue.keys()),
      cachedFragments: Array.from(this.fragmentCache.keys())
    };
  }

  /**
   * Wait for all pending operations
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
}

// Create singleton instance
export const fragmentManager = new CanvasFragmentManager();
