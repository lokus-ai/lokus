// src/bases/data/PropertyScanner.js
/**
 * PropertyScanner - Efficiently scan markdown files for YAML frontmatter and extract properties
 * Supports file watching, change detection, and handles various property formats
 */

import { readTextFile, readDir, exists } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { PropertyTypes } from './PropertyTypes.js';

export class PropertyScanner {
  constructor() {
    this.cache = new Map(); // filepath -> { properties, lastModified, content }
    this.watchers = new Map(); // filepath -> watcher info
    this.listeners = new Set(); // change event listeners
    this.isScanning = false;
    this.scanQueue = [];
  }

  /**
   * Parse YAML frontmatter from markdown content
   * @param {string} content - Markdown file content
   * @returns {Object} Parsed frontmatter object
   */
  parseFrontmatter(content) {
    if (!content || typeof content !== 'string') {
      return {};
    }

    // Check for YAML frontmatter delimiter
    const lines = content.split('\n');
    if (lines[0] !== '---') {
      return {};
    }

    // Find closing delimiter
    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] === '---') {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      return {};
    }

    // Extract YAML content
    const yamlContent = lines.slice(1, endIndex).join('\n');
    if (!yamlContent.trim()) {
      return {};
    }

    try {
      return this.parseSimpleYaml(yamlContent);
    } catch (error) {
      return {};
    }
  }

  /**
   * Simple YAML parser for frontmatter (supports basic key-value pairs, lists, and nested objects)
   * @param {string} yaml - YAML content to parse
   * @returns {Object} Parsed object
   */
  parseSimpleYaml(yaml) {
    const result = {};
    const lines = yaml.split('\n');
    let currentKey = null;
    let currentValue = '';
    let isMultilineValue = false;
    let arrayItems = [];
    let isArray = false;
    let indentLevel = 0;

    for (let line of lines) {
      const trimmedLine = line.trim();

      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue; // Skip empty lines and comments
      }

      const leadingSpaces = line.match(/^(\s*)/)[1].length;

      // Handle array items
      if (trimmedLine.startsWith('- ')) {
        if (!isArray) {
          isArray = true;
          arrayItems = [];
          indentLevel = leadingSpaces;
        }

        if (leadingSpaces === indentLevel) {
          const arrayValue = trimmedLine.substring(2).trim();
          arrayItems.push(this.parseValue(arrayValue));
          continue;
        }
      }

      // If we were processing an array, save it
      if (isArray && (leadingSpaces < indentLevel || !trimmedLine.startsWith('- '))) {
        if (currentKey) {
          result[currentKey] = arrayItems;
        }
        isArray = false;
        arrayItems = [];
        currentKey = null;
      }

      // Handle key-value pairs
      if (trimmedLine.includes(':')) {
        // Save previous multiline value
        if (isMultilineValue && currentKey) {
          result[currentKey] = this.parseValue(currentValue.trim());
          isMultilineValue = false;
          currentValue = '';
        }

        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();

        if (value) {
          // Single line value
          result[key] = this.parseValue(value);
          currentKey = null;
        } else {
          // Possible multiline value or array
          currentKey = key;
          isMultilineValue = true;
          currentValue = '';
        }
      } else if (isMultilineValue && currentKey) {
        // Continue multiline value
        currentValue += (currentValue ? '\n' : '') + trimmedLine;
      }
    }

    // Handle final array or multiline value
    if (isArray && currentKey) {
      result[currentKey] = arrayItems;
    } else if (isMultilineValue && currentKey) {
      result[currentKey] = this.parseValue(currentValue.trim());
    }

    return result;
  }

  /**
   * Parse and convert a value to appropriate type
   * @param {string} value - String value to parse
   * @returns {any} Parsed value with appropriate type
   */
  parseValue(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Handle boolean values
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;

    // Handle numbers
    if (/^-?\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    if (/^-?\d*\.\d+$/.test(trimmed)) {
      return parseFloat(trimmed);
    }

    // Handle dates (ISO format)
    if (PropertyTypes.isDateString(trimmed)) {
      return new Date(trimmed);
    }

    // Handle comma-separated values as arrays
    if (trimmed.includes(',') && !trimmed.includes('\n')) {
      const items = trimmed.split(',').map(item => item.trim());
      if (items.length > 1) {
        return items.map(item => this.parseValue(item));
      }
    }

    return trimmed;
  }

  /**
   * Scan a single markdown file for properties
   * @param {string} filePath - Path to the markdown file
   * @returns {Promise<Object>} Extracted properties
   */
  async scanFile(filePath) {
    try {
      if (!(await exists(filePath))) {
        return {};
      }

      // Check if file is cached and up-to-date
      const cached = this.cache.get(filePath);
      if (cached) {
        // In a real implementation, you'd check file modification time
        // For now, we'll use the cached version
        return cached.properties;
      }

      const content = await readTextFile(filePath);
      const properties = this.parseFrontmatter(content);

      // Cache the result
      this.cache.set(filePath, {
        properties,
        lastModified: Date.now(),
        content: content.substring(0, 500) // Store a preview
      });

      return properties;
    } catch (error) {
      return {};
    }
  }

  /**
   * Recursively scan a directory for markdown files
   * @param {string} dirPath - Directory path to scan
   * @param {Object} options - Scan options
   * @returns {Promise<Map>} Map of filepath -> properties
   */
  async scanDirectory(dirPath, options = {}) {
    const {
      recursive = true,
      includeExtensions = ['.md', '.markdown'],
      excludePatterns = ['.lokus', 'node_modules', '.git'],
      maxFiles = 1000
    } = options;

    const results = new Map();
    const filesToScan = [];

    try {
      await this.collectFiles(dirPath, filesToScan, {
        recursive,
        includeExtensions,
        excludePatterns,
        maxFiles
      });

      // Process files in batches for better performance
      const batchSize = 10;
      for (let i = 0; i < filesToScan.length; i += batchSize) {
        const batch = filesToScan.slice(i, i + batchSize);
        const batchPromises = batch.map(async filePath => {
          const properties = await this.scanFile(filePath);
          return { filePath, properties };
        });

        const batchResults = await Promise.all(batchPromises);
        batchResults.forEach(({ filePath, properties }) => {
          if (Object.keys(properties).length > 0) {
            results.set(filePath, properties);
          }
        });

        // Emit progress for large scans
        if (filesToScan.length > 50) {
          this.emitChange({
            type: 'scan_progress',
            progress: Math.min(i + batchSize, filesToScan.length),
            total: filesToScan.length
          });
        }
      }

      return results;
    } catch (error) {
      return results;
    }
  }

  /**
   * Recursively collect files to scan
   * @private
   */
  async collectFiles(dirPath, filesToScan, options) {
    try {
      const entries = await readDir(dirPath);

      for (const entry of entries) {
        const fullPath = await join(dirPath, entry.name);

        // Skip excluded patterns
        if (options.excludePatterns.some(pattern => entry.name.includes(pattern))) {
          continue;
        }

        if (entry.isDirectory && options.recursive) {
          await this.collectFiles(fullPath, filesToScan, options);
        } else if (entry.isFile) {
          // Check file extension
          const hasValidExtension = options.includeExtensions.some(ext =>
            entry.name.toLowerCase().endsWith(ext.toLowerCase())
          );

          if (hasValidExtension && filesToScan.length < options.maxFiles) {
            filesToScan.push(fullPath);
          }
        }
      }
    } catch { }
  }

  /**
   * Add a file watcher for real-time updates
   * @param {string} filePath - File to watch
   * @returns {Promise<void>}
   */
  async watchFile(filePath) {
    if (this.watchers.has(filePath)) {
      return; // Already watching
    }

    // Store watcher info (in a real implementation, you'd use filesystem watchers)
    this.watchers.set(filePath, {
      path: filePath,
      lastCheck: Date.now()
    });
  }

  /**
   * Remove file watcher
   * @param {string} filePath - File to stop watching
   */
  unwatchFile(filePath) {
    this.watchers.delete(filePath);
  }

  /**
   * Check for file changes and update cache
   * @param {string} filePath - File to check
   * @returns {Promise<boolean>} True if file changed
   */
  async checkFileChanges(filePath) {
    try {
      if (!(await exists(filePath))) {
        // File was deleted
        if (this.cache.has(filePath)) {
          this.cache.delete(filePath);
          this.emitChange({
            type: 'file_deleted',
            filePath,
            properties: {}
          });
          return true;
        }
        return false;
      }

      // For real implementation, check file modification time
      // For now, we'll re-scan the file periodically
      const cached = this.cache.get(filePath);
      if (!cached || (Date.now() - cached.lastModified > 5000)) {
        const oldProperties = cached ? cached.properties : {};
        const newProperties = await this.scanFile(filePath);

        if (this.hasPropertiesChanged(oldProperties, newProperties)) {
          this.emitChange({
            type: 'file_changed',
            filePath,
            oldProperties,
            newProperties
          });
          return true;
        }
      }

      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if properties have changed between two objects
   * @private
   */
  hasPropertiesChanged(oldProps, newProps) {
    const oldKeys = Object.keys(oldProps);
    const newKeys = Object.keys(newProps);

    if (oldKeys.length !== newKeys.length) {
      return true;
    }

    for (const key of newKeys) {
      if (!oldKeys.includes(key)) {
        return true;
      }

      const oldValue = JSON.stringify(oldProps[key]);
      const newValue = JSON.stringify(newProps[key]);
      if (oldValue !== newValue) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get all properties from cache
   * @returns {Map} Map of filepath -> properties
   */
  getCachedProperties() {
    const result = new Map();
    for (const [filePath, cached] of this.cache.entries()) {
      result.set(filePath, cached.properties);
    }
    return result;
  }

  /**
   * Get properties for a specific file from cache
   * @param {string} filePath - File path
   * @returns {Object} Properties object
   */
  getCachedFileProperties(filePath) {
    const cached = this.cache.get(filePath);
    return cached ? cached.properties : {};
  }

  /**
   * Clear cache for specific file or all files
   * @param {string} [filePath] - Specific file to clear, or all if not provided
   */
  clearCache(filePath) {
    if (filePath) {
      this.cache.delete(filePath);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Add change event listener
   * @param {Function} callback - Callback function
   */
  onChange(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove change event listener
   * @param {Function} callback - Callback function to remove
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Emit change event to all listeners
   * @private
   */
  emitChange(event) {
    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch { }
    }
  }

  /**
   * Get scanning statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const totalFiles = this.cache.size;
    let totalProperties = 0;
    const propertyTypes = {};

    for (const [filePath, cached] of this.cache.entries()) {
      const props = cached.properties;
      totalProperties += Object.keys(props).length;

      for (const [key, value] of Object.entries(props)) {
        const type = PropertyTypes.detectType(value);
        propertyTypes[type] = (propertyTypes[type] || 0) + 1;
      }
    }

    return {
      totalFiles,
      totalProperties,
      propertyTypes,
      cacheSize: this.cache.size,
      watchedFiles: this.watchers.size
    };
  }

  /**
   * Extract property values by key across all files
   * @param {string} propertyKey - Property key to extract
   * @returns {Array} Array of {filePath, value} objects
   */
  getPropertyValues(propertyKey) {
    const results = [];

    for (const [filePath, cached] of this.cache.entries()) {
      const properties = cached.properties;
      if (properties.hasOwnProperty(propertyKey)) {
        results.push({
          filePath,
          value: properties[propertyKey]
        });
      }
    }

    return results;
  }

  /**
   * Get all unique property keys across all files
   * @returns {Array} Array of unique property keys
   */
  getAllPropertyKeys() {
    const keys = new Set();

    for (const [filePath, cached] of this.cache.entries()) {
      Object.keys(cached.properties).forEach(key => keys.add(key));
    }

    return Array.from(keys).sort();
  }

  /**
   * Validate all cached properties
   * @returns {Array} Array of validation errors
   */
  validateProperties() {
    const errors = [];

    for (const [filePath, cached] of this.cache.entries()) {
      const properties = cached.properties;

      for (const [key, value] of Object.entries(properties)) {
        try {
          PropertyTypes.detectType(value);
        } catch (error) {
          errors.push({
            filePath,
            property: key,
            value,
            error: error.message
          });
        }
      }
    }

    return errors;
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.cache.clear();
    this.watchers.clear();
    this.listeners.clear();
    this.scanQueue = [];
  }
}

export default PropertyScanner;