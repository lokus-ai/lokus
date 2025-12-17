import { invoke } from '@tauri-apps/api/core';
import { isValidCanvasData, isValidFilePath, sanitizeUserInput } from '../security/index.js';
import { joinPath, ensureExtension } from '../../utils/pathUtils.js';
import { invalidateCache } from './preview-generator.js';

/**
 * Canvas File Manager
 * Handles .canvas file operations and JSON Canvas format
 */

export class CanvasManager {
  constructor() {
    this.canvasCache = new Map();
    this.saveQueue = new Map(); // Track concurrent saves per file
    this.loadQueue = new Map(); // Track concurrent loads per file
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

      const fileName = ensureExtension(sanitizedName, '.canvas');
      const canvasPath = joinPath(workspacePath, fileName);

      // Validate final path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas path');
      }

      // Create empty canvas with JSON Canvas format
      const emptyCanvas = this.createEmptyCanvasData();
      const content = JSON.stringify(emptyCanvas, null, 2);

      await invoke('write_file_content', {
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
   * @returns {Promise<Object>} - Canvas data in JSON Canvas format
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
        const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
        if (isDev) {
        }
        throw new Error('Invalid canvas path');
      }

      // Wait for any pending saves to complete
      if (this.saveQueue.has(canvasPath)) {
        await this.saveQueue.get(canvasPath);
      }

      // ALWAYS clear cache before loading to ensure fresh data after saves
      this.canvasCache.delete(canvasPath);

      const content = await invoke('read_file_content', { path: canvasPath }); let tldrawSnapshot;
      try {
        tldrawSnapshot = JSON.parse(content);        // If snapshot is missing schema, add it (for backwards compatibility)
        if (!tldrawSnapshot.schema) {
          const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
          if (isDev) {
          }
          tldrawSnapshot.schema = this.createEmptyTldrawSnapshot().schema;
        }
      } catch (parseError) {
        tldrawSnapshot = this.createEmptyTldrawSnapshot();
      }

      // Cache the loaded snapshot
      this.canvasCache.set(canvasPath, tldrawSnapshot);

      return tldrawSnapshot;
    } catch (error) {
      return this.createEmptyTldrawSnapshot();
    }
  }

  /**
   * Create empty TLDraw snapshot
   * @returns {Object} - Empty TLDraw snapshot
   */
  createEmptyTldrawSnapshot() {
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
              group: 0, geo: 1, arrow: 1, highlight: 0, embed: 4, image: 2, video: 1, text: 1
            }
          },
          instance_presence: { version: 5 },
          pointer: { version: 1 }
        }
      }
    };
  }

  /**
   * Save canvas data to file with queue management
   * @param {string} canvasPath - Path to the canvas file
   * @param {Object} canvasData - Canvas data to save
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
  async _saveCanvasInternal(canvasPath, tldrawSnapshot) {
    try {
      // Validate file path
      if (!isValidFilePath(canvasPath)) {
        const isDev = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.DEV : process.env.NODE_ENV !== 'production';
        if (isDev) {
        }
        throw new Error('Invalid canvas path');
      }      // Save TLDraw snapshot directly - no conversion!
      const content = JSON.stringify(tldrawSnapshot, null, 2);

      await invoke('write_file_content', {
        path: canvasPath,
        content
      });      // Clear cache to force fresh read next time
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
      await invoke('delete_file', { path: canvasPath });
      this.canvasCache.delete(canvasPath);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Create empty canvas data in JSON Canvas format
   * @returns {Object} - Empty canvas data
   */
  createEmptyCanvasData() {
    return {
      // JSON Canvas format specification
      nodes: [],
      edges: [],

      // Canvas metadata
      metadata: {
        version: '1.0.0',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        createdWith: 'Lokus',
        viewport: {
          x: 0,
          y: 0,
          zoom: 1
        }
      }
    };
  }

  /**
   * Validate and normalize canvas data
   * @param {Object} data - Canvas data to validate
   * @returns {Object} - Validated canvas data
   */
  validateCanvasData(data) {
    if (!data || typeof data !== 'object') {
      return this.createEmptyCanvasData();
    }

    // Ensure required properties exist
    const validated = {
      nodes: Array.isArray(data.nodes) ? data.nodes : [],
      edges: Array.isArray(data.edges) ? data.edges : [],
      metadata: {
        version: data.metadata?.version || '1.0.0',
        created: data.metadata?.created || new Date().toISOString(),
        modified: new Date().toISOString(),
        createdWith: data.metadata?.createdWith || 'Lokus',
        viewport: {
          x: data.metadata?.viewport?.x || 0,
          y: data.metadata?.viewport?.y || 0,
          zoom: data.metadata?.viewport?.zoom || 1
        }
      }
    };

    // Validate individual nodes
    validated.nodes = validated.nodes.filter((node, index) => {
      const isValid = this._validateNode(node);
      if (!isValid) {
      }
      return isValid;
    });

    // Validate individual edges
    validated.edges = validated.edges.filter((edge, index) => {
      const isValid = this._validateEdge(edge);
      if (!isValid) {
      }
      return isValid;
    });

    // Verify edge references
    const nodeIds = new Set(validated.nodes.map(n => n.id));
    validated.edges = validated.edges.filter((edge) => {
      const fromExists = nodeIds.has(edge.fromNode);
      const toExists = nodeIds.has(edge.toNode);
      if (!fromExists || !toExists) {
        return false;
      }
      return true;
    });

    return validated;
  }

  /**
   * Validate individual node
   * @private
   */
  _validateNode(node) {
    if (!node || typeof node !== 'object') return false;
    if (!node.id || typeof node.id !== 'string') return false;
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return false;
    if (!Number.isFinite(node.width) || !Number.isFinite(node.height)) return false;
    if (node.width < 0 || node.height < 0) return false;
    if (!node.type || typeof node.type !== 'string') return false;
    return true;
  }

  /**
   * Validate individual edge
   * @private
   */
  _validateEdge(edge) {
    if (!edge || typeof edge !== 'object') return false;
    if (!edge.id || typeof edge.id !== 'string') return false;
    if (!edge.fromNode || typeof edge.fromNode !== 'string') return false;
    if (!edge.toNode || typeof edge.toNode !== 'string') return false;
    return true;
  }

  /**
   * Convert tldraw store data to JSON Canvas format
   * @param {Object} storeData - Tldraw store snapshot
   * @returns {Object} - JSON Canvas format data
   */
  convertToJsonCanvas(storeData) {
    // If already in JSON Canvas format, return as-is
    if (storeData.nodes && storeData.edges) {
      return storeData;
    }

    // Convert from tldraw format
    const nodes = [];
    const edges = [];

    if (storeData.records) {
      storeData.records.forEach(record => {
        switch (record.typeName) {
          case 'shape':
            nodes.push(this.convertShapeToNode(record));
            break;
          case 'arrow':
            edges.push(this.convertArrowToEdge(record));
            break;
        }
      });
    }

    return {
      nodes,
      edges,
      metadata: {
        version: '1.0.0',
        created: storeData.metadata?.created || new Date().toISOString(),
        modified: new Date().toISOString(),
        createdWith: 'Lokus'
      }
    };
  }

  /**
   * Convert tldraw shape to JSON Canvas node
   * @param {Object} shape - Tldraw shape record
   * @returns {Object} - JSON Canvas node
   */
  convertShapeToNode(shape) {
    const baseNode = {
      id: shape.id,
      x: shape.x || 0,
      y: shape.y || 0,
      width: shape.props?.w || 100,
      height: shape.props?.h || 50,
      color: shape.props?.color || 'black'
    };

    switch (shape.type) {
      case 'text':
        return {
          ...baseNode,
          type: 'text',
          text: shape.props?.text || ''
        };

      case 'note':
        return {
          ...baseNode,
          type: 'text',
          text: shape.props?.text || ''
        };

      case 'geo':
        return {
          ...baseNode,
          type: 'text',
          text: shape.props?.text || ''
        };

      default:
        return {
          ...baseNode,
          type: 'text',
          text: ''
        };
    }
  }

  /**
   * Convert tldraw arrow to JSON Canvas edge
   * @param {Object} arrow - Tldraw arrow record
   * @returns {Object} - JSON Canvas edge
   */
  convertArrowToEdge(arrow) {
    return {
      id: arrow.id,
      fromNode: arrow.props?.start?.boundShapeId || null,
      toNode: arrow.props?.end?.boundShapeId || null,
      color: arrow.props?.color || 'black',
      label: arrow.props?.text || ''
    };
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
    return fileIndex.filter(f => f.path.endsWith('.canvas'));
  }
}

// Create singleton instance
export const canvasManager = new CanvasManager();