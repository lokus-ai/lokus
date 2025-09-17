import { invoke } from '@tauri-apps/api/core';
import { isValidCanvasData, isValidFilePath, sanitizeUserInput } from '../security/index.js';

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
      
      const fileName = sanitizedName.endsWith('.canvas') ? sanitizedName : `${sanitizedName}.canvas`;
      const canvasPath = `${workspacePath}/${fileName}`;
      
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
      console.error('Failed to create canvas:', error);
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
      console.log('🔄 Load already in progress, waiting...', canvasPath);
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
        console.log('⏳ Waiting for save to complete before loading...', canvasPath);
        await this.saveQueue.get(canvasPath);
      }
      
      // Check cache first (but clear it if there was a recent save)
      if (this.canvasCache.has(canvasPath)) {
        const cached = this.canvasCache.get(canvasPath);
        console.log('📋 Using cached canvas data');
        return cached;
      }

      console.log('📖 Reading canvas file:', canvasPath);
      const content = await invoke('read_file_content', { path: canvasPath });
      
      let canvasData;
      try {
        canvasData = JSON.parse(content);
      } catch (parseError) {
        console.warn('Invalid JSON in canvas file, creating new canvas:', parseError);
        canvasData = this.createEmptyCanvasData();
      }

      // Security validation for canvas data
      if (!isValidCanvasData(canvasData)) {
        console.warn('Invalid canvas data detected, using empty canvas');
        canvasData = this.createEmptyCanvasData();
      }

      // Validate and normalize canvas data
      canvasData = this.validateCanvasData(canvasData);
      
      // Cache the loaded data
      this.canvasCache.set(canvasPath, canvasData);
      
      console.log('✅ Canvas loaded successfully:', {
        nodes: canvasData.nodes?.length || 0,
        edges: canvasData.edges?.length || 0
      });
      
      return canvasData;
    } catch (error) {
      console.error('Failed to load canvas:', error);
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
      console.log('💾 Save already in progress, waiting...', canvasPath);
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
      
      // Security validation for canvas data
      if (!isValidCanvasData(canvasData)) {
        throw new Error('Invalid canvas data - security validation failed');
      }
      
      // Validate data before saving
      const validatedData = this.validateCanvasData(canvasData);
      
      // Convert to JSON Canvas format if needed
      const jsonCanvasData = this.convertToJsonCanvas(validatedData);
      
      const content = JSON.stringify(jsonCanvasData, null, 2);
      
      console.log('💾 Writing canvas file:', canvasPath, {
        nodes: jsonCanvasData.nodes?.length || 0,
        edges: jsonCanvasData.edges?.length || 0,
        contentLength: content.length
      });
      
      await invoke('write_file_content', {
        path: canvasPath,
        content
      });
      
      // Clear cache to force fresh read next time
      this.canvasCache.delete(canvasPath);
      
      console.log('✅ Canvas saved successfully:', canvasPath);
    } catch (error) {
      console.error('❌ Failed to save canvas:', error);
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
      console.error('Failed to delete canvas:', error);
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

    return validated;
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
      console.log(`Exporting canvas ${canvasPath} to ${format}`);
      return `${canvasPath}.${format}`;
    } catch (error) {
      console.error('Failed to export canvas:', error);
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
      console.log('⏳ Waiting for', allPromises.length, 'pending operations...');
      await Promise.all(allPromises);
    }
  }
}

// Create singleton instance
export const canvasManager = new CanvasManager();