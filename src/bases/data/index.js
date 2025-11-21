// src/bases/data/index.js
/**
 * Lokus Bases Data System - Main entry point
 * Provides a unified interface to the property and file data system
 */

import { normalizePath } from '../../utils/pathUtils.js';


export { PropertyTypes, PropertyType } from './PropertyTypes.js';
export { PropertyScanner } from './PropertyScanner.js';

// Import these individually to avoid any circular dependency issues
import { FileMetadata as FileMetadataClass } from './FileMetadata.js';
import { PropertyIndexer as PropertyIndexerClass } from './PropertyIndexer.js';
import { FrontmatterParser } from './FrontmatterParser.js';
export { PropertyIndex } from './PropertyIndexer.js';
export const PropertyIndexer = PropertyIndexerClass;
export const FileMetadata = FileMetadataClass;

/**
 * BasesDataManager - Orchestrates all data components
 */
export class BasesDataManager {
  constructor(options = {}) {
    this.options = {
      enableFileWatching: true,
      cacheTimeout: 5 * 60 * 1000, // 5 minutes
      maxCacheSize: 10000, // Maximum number of cached items
      ...options
    };

    this.propertyIndexer = null;
    this.fileMetadata = null;
    this.frontmatterParser = null;
    this.frontmatterCache = new Map(); // Cache for parsed frontmatter
    this.isInitialized = false;
    this.workspacePath = null;
  }

  /**
   * Initialize the data system
   * @param {string} workspacePath - Path to the workspace
   * @param {Object} options - Initialization options
   * @returns {Promise<void>}
   */
  async initialize(workspacePath, options = {}) {
    if (this.isInitialized) {
      return;
    }

    this.workspacePath = normalizePath(workspacePath);

    try {
      // Initialize components
      this.propertyIndexer = new PropertyIndexerClass();
      this.fileMetadata = new FileMetadataClass();
      this.frontmatterParser = new FrontmatterParser();

      // Build initial indexes
      await this.propertyIndexer.initialize(workspacePath, {
        recursive: true,
        includeExtensions: ['.md', '.markdown'],
        excludePatterns: ['.lokus', 'node_modules', '.git', '.DS_Store'],
        ...options.scanOptions
      });

      this.isInitialized = true;

    } catch (error) {
      console.error('Failed to initialize BasesDataManager:', error);
      throw error;
    }
  }

  /**
   * Get the property indexer instance
   * @returns {PropertyIndexer|null}
   */
  getPropertyIndexer() {
    return this.propertyIndexer;
  }

  /**
   * Get the file metadata instance
   * @returns {FileMetadata|null}
   */
  getFileMetadata() {
    return this.fileMetadata;
  }

  /**
   * Search for files based on property criteria
   * @param {Array} filters - Array of filter objects
   * @returns {Promise<Array>} Array of matching file paths with metadata
   */
  async searchFiles(filters = []) {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }

    const index = this.propertyIndexer.getIndex();
    const matchingFiles = index.filterFiles(filters);

    // Enrich results with file metadata
    const results = [];
    for (const filePath of matchingFiles) {
      const properties = index.getFileProperties(filePath);
      const metadata = await this.fileMetadata.getMetadata(filePath);
      const fileProperties = this.fileMetadata.getFileProperties(filePath);

      results.push({
        path: filePath,
        properties,
        metadata,
        fileProperties
      });
    }

    return results;
  }

  /**
   * Get comprehensive file information
   * @param {string} filePath - Path to the file
   * @returns {Promise<Object>} Complete file information
   */
  async getFileInfo(filePath) {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }

    const [properties, metadata] = await Promise.all([
      this.propertyIndexer.getIndex().getFileProperties(filePath),
      this.fileMetadata.getMetadata(filePath, { includeLinks: true })
    ]);

    const fileProperties = this.fileMetadata.getFileProperties(filePath);
    const relatedFiles = this.fileMetadata.getRelatedFiles(filePath);

    return {
      path: filePath,
      properties,
      metadata,
      fileProperties,
      relatedFiles
    };
  }

  /**
   * Get all available property keys with metadata
   * @returns {Array} Array of property information
   */
  getAvailableProperties() {
    if (!this.isInitialized) {
      return [];
    }

    const index = this.propertyIndexer.getIndex();
    const keys = index.getAllPropertyKeys();

    return keys.map(key => index.getPropertyInfo(key));
  }

  /**
   * Get property suggestions for autocomplete
   * @param {string} prefix - Partial property name
   * @param {number} limit - Maximum suggestions
   * @returns {Array} Array of suggestions
   */
  getPropertySuggestions(prefix, limit = 10) {
    if (!this.isInitialized) {
      return [];
    }

    return this.propertyIndexer.getIndex().getPropertySuggestions(prefix, limit);
  }

  /**
   * Get unique values for a property
   * @param {string} propertyKey - Property key
   * @returns {Array} Array of unique values
   */
  getPropertyValues(propertyKey) {
    if (!this.isInitialized) {
      return [];
    }

    return this.propertyIndexer.getIndex().getUniqueValues(propertyKey);
  }

  /**
   * Get all files in the workspace using Tauri backend
   * @returns {Promise<Array>} Array of file paths with basic metadata
   */
  async getAllFiles() {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }

    try {
      // Use Tauri backend to get workspace files
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke('read_workspace_files', {
        workspacePath: this.workspacePath
      });


      // Flatten nested file structure (backend returns nested children)
      const flattenFiles = (fileList) => {
        const result = [];
        for (const file of fileList) {
          // Add the file/folder itself if it's not a directory or if you want to include directories
          if (!file.is_directory) {
            result.push(file);
          }
          // Recursively add children
          if (file.children && file.children.length > 0) {
            result.push(...flattenFiles(file.children));
          }
        }
        return result;
      };

      const flatFiles = flattenFiles(files);

      if (!flatFiles || flatFiles.length === 0) {
        return [
          {
            path: `${this.workspacePath}/Test File 1.md`,
            properties: { status: 'published', priority: 'high' },
            name: 'Test File 1.md',
            title: 'Test File 1',
            created: new Date(),
            modified: new Date()
          },
          {
            path: `${this.workspacePath}/Test File 2.md`,
            properties: { status: 'draft', priority: 'medium' },
            name: 'Test File 2.md',
            title: 'Test File 2',
            created: new Date(),
            modified: new Date()
          }
        ];
      }

      // Convert backend format to our format
      const mdFiles = flatFiles.filter(file => file.name.endsWith('.md') || file.name.endsWith('.markdown'));

      // DON'T parse frontmatter for each file - too slow!
      // Just use basic metadata for listing
      const results = mdFiles.map((file) => {
          const filename = file.name;
          const filePath = normalizePath(file.path || `${this.workspacePath}/${filename}`);
          // Remove .md or .markdown extension to get title
          const title = filename.replace(/\.md$/, '').replace(/\.markdown$/, '');

          // Don't load file content here - only on demand
          // This was the performance killer!
          let frontmatterProperties = {};

          // Only check cache, don't load new files
          if (this.frontmatterCache.has(filePath)) {
            const cached = this.frontmatterCache.get(filePath);
            frontmatterProperties = cached.properties || {};
          }

          // Convert timestamps to milliseconds if needed (backend might return seconds)
          const parseTimestamp = (timestamp) => {
            if (!timestamp) return new Date();
            // If timestamp is in seconds (less than a reasonable millisecond timestamp)
            // multiply by 1000 to convert to milliseconds
            const ts = typeof timestamp === 'number' ? timestamp : timestamp.secs || timestamp;
            const multiplier = ts < 10000000000 ? 1000 : 1;
            return new Date(ts * multiplier);
          };

          return {
            path: filePath,
            properties: frontmatterProperties,
            name: filename,
            title: title,
            created: parseTimestamp(file.created),
            modified: parseTimestamp(file.modified),
            size: file.size || 0,
            isDirectory: file.is_directory || false
          };
        });

      // Enrich files with properties from PropertyIndexer
      // This connects the pre-indexed frontmatter data without re-parsing files
      if (this.propertyIndexer) {
        results.forEach(file => {
          const indexedProperties = this.propertyIndexer.getIndex().getFileProperties(file.path);
          // Merge indexed properties with cached properties (cached takes precedence)
          file.properties = { ...indexedProperties, ...file.properties };
        });
      }

      return results;
    } catch (error) {
      console.error('❌ BasesDataManager: Failed to get files from backend:', error);

      // Fallback to test data
      return [
        {
          path: `${this.workspacePath}/Fallback File 1.md`,
          properties: { status: 'published', priority: 'high' },
          name: 'Fallback File 1.md',
          title: 'Fallback File 1',
          created: new Date(),
          modified: new Date()
        },
        {
          path: `${this.workspacePath}/Fallback File 2.md`,
          properties: { status: 'draft', priority: 'medium' },
          name: 'Fallback File 2.md',
          title: 'Fallback File 2',
          created: new Date(),
          modified: new Date()
        }
      ];
    }
  }

  /**
   * Execute a query with view configuration
   * @param {Object} viewConfig - View configuration with filters, sorting, etc.
   * @param {Array} files - Optional pre-filtered file list
   * @returns {Promise<Object>} Query results with data, counts, etc.
   */
  async executeQuery(viewConfig = {}, files = null) {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }


    try {
      // Get base file list
      let fileList = files;
      if (!fileList) {
        fileList = await this.getAllFiles();
      }


      // Apply filters if specified
      let filteredFiles = fileList;
      if (viewConfig.filters && viewConfig.filters.length > 0) {
        filteredFiles = this.applyFilters(fileList, viewConfig.filters);
      }

      // Apply sorting if specified
      if (viewConfig.sortBy) {
        filteredFiles = this.applySorting(filteredFiles, viewConfig.sortBy, viewConfig.sortOrder);
      }

      // Apply limit if specified
      if (viewConfig.limit) {
        filteredFiles = filteredFiles.slice(0, viewConfig.limit);
      }

      const result = {
        data: filteredFiles,
        totalCount: fileList.length,
        filteredCount: filteredFiles.length,
        viewConfig: viewConfig
      };

      return result;
    } catch (error) {
      console.error('❌ BasesDataManager: Query execution failed:', error);
      throw error;
    }
  }

  /**
   * Apply filters to a file list
   * @param {Array} files - Files to filter
   * @param {Array} filters - Filter configurations
   * @returns {Array} Filtered files
   */
  applyFilters(files, filters) {
    return files.filter(file => {
      return filters.every(filter => {
        const value = this.getFilePropertyValue(file, filter.field);
        return this.evaluateFilter(value, filter);
      });
    });
  }

  /**
   * Apply sorting to a file list
   * @param {Array} files - Files to sort
   * @param {string} sortBy - Field to sort by
   * @param {string} sortOrder - 'asc' or 'desc'
   * @returns {Array} Sorted files
   */
  applySorting(files, sortBy, sortOrder = 'asc') {
    return [...files].sort((a, b) => {
      const valueA = this.getFilePropertyValue(a, sortBy);
      const valueB = this.getFilePropertyValue(b, sortBy);

      let comparison = 0;
      if (valueA < valueB) comparison = -1;
      else if (valueA > valueB) comparison = 1;

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get a property value from a file object
   * @param {Object} file - File object
   * @param {string} field - Field name
   * @returns {*} Property value
   */
  getFilePropertyValue(file, field) {
    if (file.properties && file.properties[field] !== undefined) {
      return file.properties[field];
    }
    return file[field];
  }

  /**
   * Evaluate a single filter against a value
   * @param {*} value - Value to test
   * @param {Object} filter - Filter configuration
   * @returns {boolean} Whether the value passes the filter
   */
  evaluateFilter(value, filter) {
    const { operator, value: filterValue } = filter;

    switch (operator) {
      case 'equals':
        return value === filterValue;
      case 'not_equals':
        return value !== filterValue;
      case 'contains':
        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'not_contains':
        return !String(value).toLowerCase().includes(String(filterValue).toLowerCase());
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'not_in':
        return Array.isArray(filterValue) && !filterValue.includes(value);
      case 'greater_than':
        return value > filterValue;
      case 'less_than':
        return value < filterValue;
      case 'greater_than_or_equal':
        return value >= filterValue;
      case 'less_than_or_equal':
        return value <= filterValue;
      default:
        return true;
    }
  }

  /**
   * Rebuild all indexes (useful for development/debugging)
   * @returns {Promise<void>}
   */
  async rebuildIndexes() {
    if (!this.isInitialized || !this.workspacePath) {
      throw new Error('BasesDataManager not properly initialized');
    }


    // Clear existing data
    this.propertyIndexer.getIndex().clearIndex();
    this.fileMetadata.clearCache();

    // Rebuild
    await this.propertyIndexer.initialize(this.workspacePath);

  }

  /**
   * Get system statistics
   * @returns {Object} Statistics about the data system
   */
  getStats() {
    if (!this.isInitialized) {
      return {};
    }

    const indexStats = this.propertyIndexer.getIndex().getIndexStats();
    const metadataStats = this.fileMetadata.getStats();

    return {
      index: indexStats,
      metadata: metadataStats,
      isInitialized: this.isInitialized,
      workspacePath: this.workspacePath
    };
  }

  /**
   * Export all data (for backup/transfer)
   * @returns {Object} Exportable data
   */
  export() {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }

    return {
      version: '1.0.0',
      timestamp: Date.now(),
      workspacePath: this.workspacePath,
      propertyIndex: this.propertyIndexer.getIndex().export(),
      // File metadata is not exported as it's regenerated on startup
    };
  }

  /**
   * Import data (for backup/transfer)
   * @param {Object} data - Data to import
   * @returns {boolean} Success status
   */
  import(data) {
    if (!this.isInitialized) {
      throw new Error('BasesDataManager not initialized');
    }

    try {
      this.propertyIndexer.getIndex().import(data.propertyIndex);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }

  /**
   * Dispose of all resources
   */
  dispose() {
    if (this.propertyIndexer) {
      this.propertyIndexer.dispose();
      this.propertyIndexer = null;
    }

    if (this.fileMetadata) {
      this.fileMetadata.dispose();
      this.fileMetadata = null;
    }

    if (this.frontmatterParser) {
      this.frontmatterParser.clearCache();
      this.frontmatterParser = null;
    }

    if (this.frontmatterCache) {
      this.frontmatterCache.clear();
    }

    this.isInitialized = false;
    this.workspacePath = null;
  }
}

/**
 * Create a new BasesDataManager instance (convenience function)
 * @param {Object} options - Manager options
 * @returns {BasesDataManager} New manager instance
 */
export function createBasesDataManager(options = {}) {
  return new BasesDataManager(options);
}

/**
 * Example usage and API demonstration
 */
export const examples = {
  /**
   * Basic initialization
   */
  async basicUsage() {
    const manager = createBasesDataManager();

    try {
      // Initialize with workspace
      await manager.initialize('/path/to/workspace');

      // Search for files with specific properties
      const _results = await manager.searchFiles([
        { key: 'status', operator: 'equals', value: 'published' },
        { key: 'tags', operator: 'contains', value: 'important' }
      ]);


      // Get comprehensive info for a specific file
      const _fileInfo = await manager.getFileInfo('/path/to/file.md');

      // Get available properties
      const _properties = manager.getAvailableProperties();

    } finally {
      manager.dispose();
    }
  },

  /**
   * Advanced filtering
   */
  async advancedFiltering() {
    const manager = createBasesDataManager();
    await manager.initialize('/path/to/workspace');

    try {
      // Complex search with multiple criteria
      const _results = await manager.searchFiles([
        { key: 'created', operator: 'greater_than', value: '2024-01-01', type: 'date' },
        { key: 'wordCount', operator: 'greater_than', value: 1000, type: 'number' },
        { key: 'tags', operator: 'in', value: ['research', 'analysis'], type: 'tags' },
        { key: 'hasYamlFrontmatter', operator: 'equals', value: true, type: 'boolean' }
      ]);

    } finally {
      manager.dispose();
    }
  },

  /**
   * Property analysis
   */
  async propertyAnalysis() {
    const manager = createBasesDataManager();
    await manager.initialize('/path/to/workspace');

    try {
      // Analyze property usage
      const properties = manager.getAvailableProperties();

      for (const _prop of properties) {
      }

      // Get statistics
      const _stats = manager.getStats();

    } finally {
      manager.dispose();
    }
  }
};

export default BasesDataManager;