import { invoke } from '@tauri-apps/api/core';

/**
 * Canvas File Manager
 * Handles .canvas file operations and JSON Canvas format
 */

export class CanvasManager {
  constructor() {
    this.canvasCache = new Map();
  }

  /**
   * Create a new canvas file
   * @param {string} workspacePath - Path to the workspace
   * @param {string} name - Name of the canvas (without extension)
   * @returns {Promise<string>} - Path to the created canvas file
   */
  async createCanvas(workspacePath, name) {
    try {
      const fileName = name.endsWith('.canvas') ? name : `${name}.canvas`;
      const canvasPath = `${workspacePath}/${fileName}`;
      
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
   * Load canvas data from file
   * @param {string} canvasPath - Path to the canvas file
   * @returns {Promise<Object>} - Canvas data in JSON Canvas format
   */
  async loadCanvas(canvasPath) {
    try {
      // Check cache first
      if (this.canvasCache.has(canvasPath)) {
        return this.canvasCache.get(canvasPath);
      }

      const content = await invoke('read_file_content', { path: canvasPath });
      
      let canvasData;
      try {
        canvasData = JSON.parse(content);
      } catch (parseError) {
        console.warn('Invalid JSON in canvas file, creating new canvas:', parseError);
        canvasData = this.createEmptyCanvasData();
      }

      // Validate and normalize canvas data
      canvasData = this.validateCanvasData(canvasData);
      
      // Cache the loaded data
      this.canvasCache.set(canvasPath, canvasData);
      
      return canvasData;
    } catch (error) {
      console.error('Failed to load canvas:', error);
      // Return empty canvas if file doesn't exist or can't be read
      return this.createEmptyCanvasData();
    }
  }

  /**
   * Save canvas data to file
   * @param {string} canvasPath - Path to the canvas file
   * @param {Object} canvasData - Canvas data to save
   * @returns {Promise<void>}
   */
  async saveCanvas(canvasPath, canvasData) {
    try {
      // Validate data before saving
      const validatedData = this.validateCanvasData(canvasData);
      
      // Convert to JSON Canvas format if needed
      const jsonCanvasData = this.convertToJsonCanvas(validatedData);
      
      const content = JSON.stringify(jsonCanvasData, null, 2);
      
      await invoke('write_file_content', {
        path: canvasPath,
        content
      });
      
      // Update cache
      this.canvasCache.set(canvasPath, jsonCanvasData);
      
      console.log('Canvas saved successfully:', canvasPath);
    } catch (error) {
      console.error('Failed to save canvas:', error);
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
}

// Create singleton instance
export const canvasManager = new CanvasManager();