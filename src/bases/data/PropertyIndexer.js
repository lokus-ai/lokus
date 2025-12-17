// src/bases/data/PropertyIndexer.js
/**
 * PropertyIndexer - Index all properties found across the workspace
 * Provides fast filtering, search, autocomplete, and caching with incremental updates
 */

import { PropertyTypes, PropertyType } from './PropertyTypes.js';
import { PropertyScanner } from './PropertyScanner.js';

export class PropertyIndex {
  constructor() {
    this.propertyMap = new Map(); // propertyKey -> { type, values: Map(filePath -> value), stats }
    this.fileMap = new Map(); // filePath -> Set(propertyKeys)
    this.valueIndex = new Map(); // value -> Set(filePaths)
    this.searchIndex = new Map(); // normalized searchable values
    this.typeIndex = new Map(); // type -> Set(propertyKeys)
    this.scanner = new PropertyScanner();
    this.isIndexing = false;
    this.lastIndexTime = null;
    this.changeListeners = new Set();

    // Setup scanner change listener
    this.scanner.onChange(this.handleScannerChange.bind(this));
  }

  /**
   * Build or rebuild the complete property index
   * @param {string} workspacePath - Path to workspace directory
   * @param {Object} options - Indexing options
   * @returns {Promise<void>}
   */
  async buildIndex(workspacePath, options = {}) {
    if (this.isIndexing) {
      return;
    }

    this.isIndexing = true;
    this.emitChange({ type: 'index_start' });

    try {
      // Clear existing index
      this.clearIndex();

      // Scan workspace for properties
      const properties = await this.scanner.scanDirectory(workspacePath, options);

      // Build index from scanned properties
      for (const [filePath, fileProperties] of properties) {
        this.indexFileProperties(filePath, fileProperties);
      }

      this.lastIndexTime = Date.now();
      this.emitChange({
        type: 'index_complete',
        stats: this.getIndexStats()
      });

    } catch (error) {
      this.emitChange({ type: 'index_error', error });
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Index properties for a single file
   * @private
   */
  indexFileProperties(filePath, properties) {
    const propertyKeys = new Set();

    for (const [key, value] of Object.entries(properties)) {
      propertyKeys.add(key);
      this.indexProperty(key, value, filePath);
    }

    // Update file map
    this.fileMap.set(filePath, propertyKeys);
  }

  /**
   * Index a single property value
   * @private
   */
  indexProperty(key, value, filePath) {
    // Get or create property entry
    if (!this.propertyMap.has(key)) {
      this.propertyMap.set(key, {
        type: PropertyType.STRING,
        values: new Map(),
        stats: {
          count: 0,
          uniqueValues: 0,
          firstSeen: Date.now(),
          lastUpdated: Date.now()
        }
      });
    }

    const property = this.propertyMap.get(key);

    // Update property value
    const oldValue = property.values.get(filePath);
    property.values.set(filePath, value);
    property.stats.count = property.values.size;
    property.stats.lastUpdated = Date.now();

    // Update type detection
    const allValues = Array.from(property.values.values());
    property.type = PropertyTypes.inferCommonType(allValues);

    // Update type index
    this.updateTypeIndex(key, property.type);

    // Update value index
    this.updateValueIndex(value, filePath, oldValue);

    // Update search index
    this.updateSearchIndex(key, value, filePath);

    // Update unique values count
    const uniqueValues = new Set(allValues.map(v => JSON.stringify(v)));
    property.stats.uniqueValues = uniqueValues.size;
  }

  /**
   * Update type index
   * @private
   */
  updateTypeIndex(key, type) {
    // Remove from old type indexes
    for (const [existingType, keys] of this.typeIndex) {
      if (keys.has(key) && existingType !== type) {
        keys.delete(key);
        if (keys.size === 0) {
          this.typeIndex.delete(existingType);
        }
      }
    }

    // Add to new type index
    if (!this.typeIndex.has(type)) {
      this.typeIndex.set(type, new Set());
    }
    this.typeIndex.get(type).add(key);
  }

  /**
   * Update value index for fast value-based searches
   * @private
   */
  updateValueIndex(newValue, filePath, oldValue) {
    // Remove old value mapping
    if (oldValue !== undefined) {
      const oldKey = this.normalizeValueForIndex(oldValue);
      if (this.valueIndex.has(oldKey)) {
        this.valueIndex.get(oldKey).delete(filePath);
        if (this.valueIndex.get(oldKey).size === 0) {
          this.valueIndex.delete(oldKey);
        }
      }
    }

    // Add new value mapping
    const newKey = this.normalizeValueForIndex(newValue);
    if (!this.valueIndex.has(newKey)) {
      this.valueIndex.set(newKey, new Set());
    }
    this.valueIndex.get(newKey).add(filePath);
  }

  /**
   * Update search index for text-based searches
   * @private
   */
  updateSearchIndex(propertyKey, value, filePath) {
    const searchableValue = this.makeSearchable(value);
    const searchKey = `${propertyKey}:${searchableValue}`;

    if (!this.searchIndex.has(searchKey)) {
      this.searchIndex.set(searchKey, new Set());
    }
    this.searchIndex.get(searchKey).add(filePath);
  }

  /**
   * Normalize value for indexing
   * @private
   */
  normalizeValueForIndex(value) {
    if (value === null || value === undefined) {
      return '__null__';
    }

    if (Array.isArray(value)) {
      return `__array__${JSON.stringify(value.sort())}`;
    }

    if (value instanceof Date) {
      return `__date__${value.toISOString()}`;
    }

    if (typeof value === 'object') {
      return `__object__${JSON.stringify(value)}`;
    }

    return String(value).toLowerCase();
  }

  /**
   * Make value searchable (normalize for text search)
   * @private
   */
  makeSearchable(value) {
    if (value === null || value === undefined) {
      return '';
    }

    if (Array.isArray(value)) {
      return value.join(' ').toLowerCase();
    }

    return String(value).toLowerCase();
  }

  /**
   * Handle changes from property scanner
   * @private
   */
  handleScannerChange(event) {
    switch (event.type) {
      case 'file_changed':
        this.updateFileIndex(event.filePath, event.newProperties, event.oldProperties);
        break;
      case 'file_deleted':
        this.removeFileFromIndex(event.filePath);
        break;
    }
  }

  /**
   * Update index for a changed file
   * @private
   */
  updateFileIndex(filePath, newProperties, oldProperties) {
    // Remove old properties
    if (oldProperties) {
      this.removeFileProperties(filePath, oldProperties);
    }

    // Add new properties
    this.indexFileProperties(filePath, newProperties);

    this.emitChange({
      type: 'file_updated',
      filePath,
      oldProperties,
      newProperties
    });
  }

  /**
   * Remove file from index
   * @private
   */
  removeFileFromIndex(filePath) {
    const fileProperties = this.fileMap.get(filePath);
    if (fileProperties) {
      // Remove from property values
      for (const propertyKey of fileProperties) {
        const property = this.propertyMap.get(propertyKey);
        if (property) {
          const oldValue = property.values.get(filePath);
          property.values.delete(filePath);
          property.stats.count = property.values.size;

          // Update value index
          if (oldValue !== undefined) {
            this.updateValueIndex(undefined, filePath, oldValue);
          }

          // Remove empty properties
          if (property.values.size === 0) {
            this.propertyMap.delete(propertyKey);

            // Clean up type index
            for (const [type, keys] of this.typeIndex) {
              if (keys.has(propertyKey)) {
                keys.delete(propertyKey);
                if (keys.size === 0) {
                  this.typeIndex.delete(type);
                }
              }
            }
          }
        }
      }
    }

    // Remove from file map
    this.fileMap.delete(filePath);

    this.emitChange({
      type: 'file_removed',
      filePath
    });
  }

  /**
   * Remove specific properties for a file
   * @private
   */
  removeFileProperties(filePath, properties) {
    for (const key of Object.keys(properties)) {
      const property = this.propertyMap.get(key);
      if (property && property.values.has(filePath)) {
        const oldValue = property.values.get(filePath);
        property.values.delete(filePath);

        // Update value index
        this.updateValueIndex(undefined, filePath, oldValue);

        // Update stats
        property.stats.count = property.values.size;

        if (property.values.size === 0) {
          this.propertyMap.delete(key);
        }
      }
    }
  }

  /**
   * Get all property keys
   * @returns {Array} Sorted array of property keys
   */
  getAllPropertyKeys() {
    return Array.from(this.propertyMap.keys()).sort();
  }

  /**
   * Get property keys filtered by type
   * @param {string} type - Property type to filter by
   * @returns {Array} Array of property keys
   */
  getPropertyKeysByType(type) {
    const keys = this.typeIndex.get(type);
    return keys ? Array.from(keys).sort() : [];
  }

  /**
   * Get property information
   * @param {string} key - Property key
   * @returns {Object|null} Property information
   */
  getPropertyInfo(key) {
    const property = this.propertyMap.get(key);
    if (!property) return null;

    const allValues = Array.from(property.values.values());
    const uniqueValues = [...new Set(allValues.map(v => JSON.stringify(v)))];

    return {
      key,
      type: property.type,
      count: property.stats.count,
      uniqueValueCount: uniqueValues.length,
      uniqueValues: uniqueValues.slice(0, 10), // Limit for performance
      firstSeen: property.stats.firstSeen,
      lastUpdated: property.stats.lastUpdated,
      files: Array.from(property.values.keys())
    };
  }

  /**
   * Search for properties by key pattern
   * @param {string} pattern - Search pattern (can include wildcards)
   * @returns {Array} Array of matching property keys
   */
  searchPropertyKeys(pattern) {
    if (!pattern) return this.getAllPropertyKeys();

    const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
    return this.getAllPropertyKeys().filter(key => regex.test(key));
  }

  /**
   * Get autocomplete suggestions for property keys
   * @param {string} prefix - Partial property key
   * @param {number} limit - Maximum number of suggestions
   * @returns {Array} Array of suggestions with metadata
   */
  getPropertySuggestions(prefix, limit = 10) {
    const suggestions = [];
    const lowerPrefix = prefix.toLowerCase();

    for (const [key, property] of this.propertyMap) {
      if (key.toLowerCase().startsWith(lowerPrefix)) {
        suggestions.push({
          key,
          type: property.type,
          count: property.stats.count,
          priority: key.length - prefix.length // Prefer shorter matches
        });
      }
    }

    // Sort by priority and relevance
    suggestions.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return b.count - a.count; // More common properties first
    });

    return suggestions.slice(0, limit);
  }

  /**
   * Filter files by property criteria
   * @param {Array} filters - Array of filter objects
   * @returns {Set} Set of file paths matching all filters
   */
  filterFiles(filters) {
    if (!filters || filters.length === 0) {
      return new Set(this.fileMap.keys());
    }

    let resultSet = null;

    for (const filter of filters) {
      const matchingFiles = this.applyFilter(filter);

      if (resultSet === null) {
        resultSet = matchingFiles;
      } else {
        // Intersection of results
        resultSet = new Set([...resultSet].filter(file => matchingFiles.has(file)));
      }
    }

    return resultSet || new Set();
  }

  /**
   * Apply a single filter
   * @private
   */
  applyFilter(filter) {
    const { key, operator, value, type } = filter;
    const property = this.propertyMap.get(key);

    if (!property) {
      return new Set();
    }

    const matchingFiles = new Set();

    for (const [filePath, propertyValue] of property.values) {
      if (this.evaluateCondition(propertyValue, operator, value, type)) {
        matchingFiles.add(filePath);
      }
    }

    return matchingFiles;
  }

  /**
   * Evaluate filter condition
   * @private
   */
  evaluateCondition(actualValue, operator, expectedValue, type) {
    try {
      switch (operator) {
        case 'equals':
          return this.valuesEqual(actualValue, expectedValue);

        case 'not_equals':
          return !this.valuesEqual(actualValue, expectedValue);

        case 'contains':
          if (Array.isArray(actualValue)) {
            return actualValue.some(item =>
              String(item).toLowerCase().includes(String(expectedValue).toLowerCase())
            );
          }
          return String(actualValue).toLowerCase().includes(String(expectedValue).toLowerCase());

        case 'starts_with':
          return String(actualValue).toLowerCase().startsWith(String(expectedValue).toLowerCase());

        case 'ends_with':
          return String(actualValue).toLowerCase().endsWith(String(expectedValue).toLowerCase());

        case 'greater_than':
          if (type === PropertyType.NUMBER) {
            return Number(actualValue) > Number(expectedValue);
          }
          if (type === PropertyType.DATE) {
            return new Date(actualValue) > new Date(expectedValue);
          }
          return String(actualValue) > String(expectedValue);

        case 'less_than':
          if (type === PropertyType.NUMBER) {
            return Number(actualValue) < Number(expectedValue);
          }
          if (type === PropertyType.DATE) {
            return new Date(actualValue) < new Date(expectedValue);
          }
          return String(actualValue) < String(expectedValue);

        case 'exists':
          return actualValue !== null && actualValue !== undefined;

        case 'not_exists':
          return actualValue === null || actualValue === undefined;

        case 'in':
          if (Array.isArray(expectedValue)) {
            return expectedValue.some(val => this.valuesEqual(actualValue, val));
          }
          return false;

        case 'regex':
          const regex = new RegExp(expectedValue, 'i');
          return regex.test(String(actualValue));

        default:
          return false;
      }
    } catch (error) {
      return false;
    }
  }

  /**
   * Compare two values for equality
   * @private
   */
  valuesEqual(a, b) {
    if (a === b) return true;

    // Handle null/undefined
    if ((a === null || a === undefined) && (b === null || b === undefined)) {
      return true;
    }

    // Handle arrays
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length === b.length && a.every((val, i) => this.valuesEqual(val, b[i]));
    }

    // Handle objects
    if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    // String comparison (case-insensitive)
    return String(a).toLowerCase() === String(b).toLowerCase();
  }

  /**
   * Get property values for a specific key
   * @param {string} key - Property key
   * @returns {Array} Array of {filePath, value} objects
   */
  getPropertyValues(key) {
    const property = this.propertyMap.get(key);
    if (!property) return [];

    return Array.from(property.values.entries()).map(([filePath, value]) => ({
      filePath,
      value
    }));
  }

  /**
   * Get unique values for a property key
   * @param {string} key - Property key
   * @returns {Array} Array of unique values
   */
  getUniqueValues(key) {
    const property = this.propertyMap.get(key);
    if (!property) return [];

    const uniqueValues = new Set();
    for (const value of property.values.values()) {
      uniqueValues.add(JSON.stringify(value));
    }

    return Array.from(uniqueValues).map(json => JSON.parse(json));
  }

  /**
   * Get files that have a specific property
   * @param {string} key - Property key
   * @returns {Array} Array of file paths
   */
  getFilesWithProperty(key) {
    const property = this.propertyMap.get(key);
    return property ? Array.from(property.values.keys()) : [];
  }

  /**
   * Get all properties for a specific file
   * @param {string} filePath - File path
   * @returns {Object} Properties object
   */
  getFileProperties(filePath) {
    const properties = {};
    const filePropertyKeys = this.fileMap.get(filePath);

    if (filePropertyKeys) {
      for (const key of filePropertyKeys) {
        const property = this.propertyMap.get(key);
        if (property && property.values.has(filePath)) {
          properties[key] = property.values.get(filePath);
        }
      }
    }

    return properties;
  }

  /**
   * Get index statistics
   * @returns {Object} Statistics object
   */
  getIndexStats() {
    const stats = {
      totalProperties: this.propertyMap.size,
      totalFiles: this.fileMap.size,
      totalValues: 0,
      typeDistribution: {},
      averagePropertiesPerFile: 0,
      lastIndexTime: this.lastIndexTime,
      memoryUsage: {
        propertyMap: this.propertyMap.size,
        fileMap: this.fileMap.size,
        valueIndex: this.valueIndex.size,
        searchIndex: this.searchIndex.size,
        typeIndex: this.typeIndex.size
      }
    };

    // Calculate total values and type distribution
    for (const [key, property] of this.propertyMap) {
      stats.totalValues += property.values.size;
      stats.typeDistribution[property.type] = (stats.typeDistribution[property.type] || 0) + 1;
    }

    // Calculate average properties per file
    if (stats.totalFiles > 0) {
      let totalPropertiesInFiles = 0;
      for (const propertyKeys of this.fileMap.values()) {
        totalPropertiesInFiles += propertyKeys.size;
      }
      stats.averagePropertiesPerFile = totalPropertiesInFiles / stats.totalFiles;
    }

    return stats;
  }

  /**
   * Clear the entire index
   */
  clearIndex() {
    this.propertyMap.clear();
    this.fileMap.clear();
    this.valueIndex.clear();
    this.searchIndex.clear();
    this.typeIndex.clear();
    this.lastIndexTime = null;

    this.emitChange({ type: 'index_cleared' });
  }

  /**
   * Add change event listener
   * @param {Function} callback - Callback function
   */
  onChange(callback) {
    this.changeListeners.add(callback);
  }

  /**
   * Remove change event listener
   * @param {Function} callback - Callback function
   */
  removeListener(callback) {
    this.changeListeners.delete(callback);
  }

  /**
   * Emit change event
   * @private
   */
  emitChange(event) {
    for (const callback of this.changeListeners) {
      try {
        callback(event);
      } catch { }
    }
  }

  /**
   * Export index data
   * @returns {Object} Serializable index data
   */
  export() {
    const exported = {
      version: '1.0.0',
      timestamp: Date.now(),
      properties: {},
      files: {},
      stats: this.getIndexStats()
    };

    // Export properties
    for (const [key, property] of this.propertyMap) {
      exported.properties[key] = {
        type: property.type,
        values: Object.fromEntries(property.values),
        stats: property.stats
      };
    }

    // Export file mappings
    for (const [filePath, propertyKeys] of this.fileMap) {
      exported.files[filePath] = Array.from(propertyKeys);
    }

    return exported;
  }

  /**
   * Import index data
   * @param {Object} data - Exported index data
   * @returns {boolean} Success status
   */
  import(data) {
    try {
      this.clearIndex();

      // Import properties
      for (const [key, propData] of Object.entries(data.properties)) {
        this.propertyMap.set(key, {
          type: propData.type,
          values: new Map(Object.entries(propData.values)),
          stats: propData.stats
        });

        // Rebuild type index
        this.updateTypeIndex(key, propData.type);
      }

      // Import file mappings
      for (const [filePath, propertyKeys] of Object.entries(data.files)) {
        this.fileMap.set(filePath, new Set(propertyKeys));
      }

      // Rebuild other indexes
      this.rebuildIndexes();

      this.lastIndexTime = data.timestamp || Date.now();
      this.emitChange({ type: 'index_imported' });

      return true;
    } catch (error) {
      this.clearIndex();
      return false;
    }
  }

  /**
   * Rebuild secondary indexes
   * @private
   */
  rebuildIndexes() {
    this.valueIndex.clear();
    this.searchIndex.clear();

    for (const [key, property] of this.propertyMap) {
      for (const [filePath, value] of property.values) {
        this.updateValueIndex(value, filePath);
        this.updateSearchIndex(key, value, filePath);
      }
    }
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.clearIndex();
    this.changeListeners.clear();
    this.scanner.dispose();
  }
}

export class PropertyIndexer {
  constructor() {
    this.index = new PropertyIndex();
  }

  /**
   * Get the property index instance
   * @returns {PropertyIndex} The index instance
   */
  getIndex() {
    return this.index;
  }

  /**
   * Initialize indexer with workspace
   * @param {string} workspacePath - Workspace path
   * @param {Object} options - Indexing options
   * @returns {Promise<void>}
   */
  async initialize(workspacePath, options = {}) {
    return this.index.buildIndex(workspacePath, options);
  }

  /**
   * Get file count from index
   * @returns {number} Number of indexed files
   */
  getFileCount() {
    return this.index.fileMap.size;
  }

  /**
   * Dispose of indexer resources
   */
  dispose() {
    this.index.dispose();
  }
}

export default PropertyIndexer;