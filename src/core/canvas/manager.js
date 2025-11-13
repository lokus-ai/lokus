import { invoke } from '@tauri-apps/api/core';
import { isValidCanvasData, isValidFilePath, sanitizeUserInput } from '../security/index.js';
import { joinPath, ensureExtension } from '../../utils/pathUtils.js';

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
      console.log(`[Canvas Manager] Loading canvas from: ${canvasPath}`);

      // Validate file path
      if (!isValidFilePath(canvasPath)) {
        console.error(`[Canvas Manager] Invalid file path: ${canvasPath}`);
        throw new Error('Invalid canvas path');
      }

      // Wait for any pending saves to complete
      if (this.saveQueue.has(canvasPath)) {
        console.log(`[Canvas Manager] Waiting for pending save to complete: ${canvasPath}`);
        await this.saveQueue.get(canvasPath);
      }

      // ALWAYS clear cache before loading to ensure fresh data after saves
      this.canvasCache.delete(canvasPath);
      console.log(`[Canvas Manager] Cache cleared for: ${canvasPath}`);

      const content = await invoke('read_file_content', { path: canvasPath });
      console.log(`[Canvas Manager] File read successfully, size: ${content.length} bytes`);

      let canvasData;
      try {
        canvasData = JSON.parse(content);
        console.log(`[Canvas Manager] JSON parsed successfully, nodes: ${canvasData.nodes?.length || 0}, edges: ${canvasData.edges?.length || 0}`);
      } catch (parseError) {
        console.error(`[Canvas Manager] JSON parse failed for ${canvasPath}:`, parseError.message);
        canvasData = this.createEmptyCanvasData();
      }

      // Security validation for canvas data
      if (!isValidCanvasData(canvasData)) {
        console.error(`[Canvas Manager] Canvas data failed security validation for ${canvasPath}`);
        canvasData = this.createEmptyCanvasData();
      }

      // Validate and normalize canvas data
      canvasData = this.validateCanvasData(canvasData);
      console.log(`[Canvas Manager] Canvas data validated and normalized`);

      // Cache the loaded data
      this.canvasCache.set(canvasPath, canvasData);
      console.log(`[Canvas Manager] Canvas cached for: ${canvasPath}`);

      return canvasData;
    } catch (error) {
      console.error(`[Canvas Manager] Failed to load canvas from ${canvasPath}:`, error.message);
      // Return empty canvas if file doesn't exist or can't be read
      return this.createEmptyCanvasData();
    }
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
  async _saveCanvasInternal(canvasPath, canvasData) {
    try {
      console.log(`[Canvas Manager] Saving canvas to: ${canvasPath}`);
      console.log(`[Canvas Manager] Canvas data nodes: ${canvasData.nodes?.length || 0}, edges: ${canvasData.edges?.length || 0}`);

      // Validate file path
      if (!isValidFilePath(canvasPath)) {
        console.error(`[Canvas Manager] Invalid file path for save: ${canvasPath}`);
        throw new Error('Invalid canvas path');
      }

      // Security validation for canvas data
      if (!isValidCanvasData(canvasData)) {
        console.error(`[Canvas Manager] Canvas data failed security validation before save: ${canvasPath}`);
        throw new Error('Invalid canvas data - security validation failed');
      }

      // Validate data before saving
      const validatedData = this.validateCanvasData(canvasData);
      console.log(`[Canvas Manager] Canvas data validated, nodes: ${validatedData.nodes?.length || 0}, edges: ${validatedData.edges?.length || 0}`);

      // Convert to JSON Canvas format if needed
      const jsonCanvasData = this.convertToJsonCanvas(validatedData);
      console.log(`[Canvas Manager] Converted to JSON Canvas format`);

      const content = JSON.stringify(jsonCanvasData, null, 2);
      console.log(`[Canvas Manager] Serialized to JSON, size: ${content.length} bytes`);

      await invoke('write_file_content', {
        path: canvasPath,
        content
      });
      console.log(`[Canvas Manager] File written successfully: ${canvasPath}`);

      // Clear cache to force fresh read next time
      this.canvasCache.delete(canvasPath);
      console.log(`[Canvas Manager] Cache cleared after save: ${canvasPath}`);

    } catch (error) {
      console.error(`[Canvas Manager] Failed to save canvas to ${canvasPath}:`, error.message);
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
      console.warn(`[Canvas Manager] Invalid canvas data type, creating empty canvas`);
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
        console.warn(`[Canvas Manager] Removed invalid node at index ${index}:`, node);
      }
      return isValid;
    });

    // Validate individual edges
    validated.edges = validated.edges.filter((edge, index) => {
      const isValid = this._validateEdge(edge);
      if (!isValid) {
        console.warn(`[Canvas Manager] Removed invalid edge at index ${index}:`, edge);
      }
      return isValid;
    });

    // Verify edge references
    const nodeIds = new Set(validated.nodes.map(n => n.id));
    validated.edges = validated.edges.filter((edge) => {
      const fromExists = nodeIds.has(edge.fromNode);
      const toExists = nodeIds.has(edge.toNode);
      if (!fromExists || !toExists) {
        console.warn(`[Canvas Manager] Removed edge with missing node references:`, edge);
        return false;
      }
      return true;
    });

    console.log(`[Canvas Manager] Validation complete: ${validated.nodes.length} nodes, ${validated.edges.length} edges`);

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
}

// Create singleton instance
export const canvasManager = new CanvasManager();