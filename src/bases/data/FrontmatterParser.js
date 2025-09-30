/**
 * FrontmatterParser.js
 * Parses YAML frontmatter from markdown files
 */

import * as yaml from 'js-yaml';

/**
 * Parse YAML frontmatter from markdown content
 * @param {string} content - Full markdown file content
 * @returns {Object|null} Parsed frontmatter object or null if no frontmatter
 */
export function parseFile(content) {
  if (!content || typeof content !== 'string') {
    return null;
  }

  // Check if file starts with frontmatter delimiter
  const trimmed = content.trim();
  if (!trimmed.startsWith('---')) {
    return null;
  }

  // Find the closing delimiter
  const lines = trimmed.split('\n');
  let endIndex = -1;

  // Start from line 1 (skip the opening ---)
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---' || lines[i].trim() === '...') {
      endIndex = i;
      break;
    }
  }

  // No closing delimiter found
  if (endIndex === -1) {
    return null;
  }

  // Extract frontmatter content (between the delimiters)
  const frontmatterContent = lines.slice(1, endIndex).join('\n');

  if (!frontmatterContent.trim()) {
    return {};
  }

  try {
    // Parse YAML
    const parsed = yaml.load(frontmatterContent);
    return parsed || {};
  } catch (error) {
    console.warn('Failed to parse YAML frontmatter:', error.message);
    return null;
  }
}

/**
 * Extract all properties from parsed frontmatter
 * @param {Object} frontmatter - Parsed frontmatter object
 * @returns {Object} Flattened properties object
 */
export function extractProperties(frontmatter) {
  if (!frontmatter || typeof frontmatter !== 'object') {
    return {};
  }

  const properties = {};

  for (const [key, value] of Object.entries(frontmatter)) {
    // Skip null/undefined values
    if (value === null || value === undefined) {
      continue;
    }

    properties[key] = value;
  }

  return properties;
}

/**
 * Format a property value for display
 * @param {*} value - Property value
 * @param {string} type - Optional type hint (date, array, number, etc.)
 * @returns {string} Formatted value
 */
export function formatProperty(value, type = null) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return '—';
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return '—';
    }
    return value.map(item => formatProperty(item)).join(', ');
  }

  // Handle dates
  if (type === 'date' || value instanceof Date) {
    try {
      const date = value instanceof Date ? value : new Date(value);
      if (isNaN(date.getTime())) {
        return String(value);
      }
      return date.toLocaleDateString();
    } catch (error) {
      return String(value);
    }
  }

  // Try to detect if string is a date
  if (typeof value === 'string') {
    // Check if it looks like an ISO date or common date format
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString();
        }
      } catch (error) {
        // Not a date, continue
      }
    }
  }

  // Handle objects
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch (error) {
      return '[Object]';
    }
  }

  // Handle booleans
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  // Handle numbers
  if (typeof value === 'number') {
    return String(value);
  }

  // Default: convert to string
  return String(value);
}

/**
 * Parse frontmatter from file content and return formatted properties
 * @param {string} content - Markdown file content
 * @returns {Object} Object with raw and formatted properties
 */
export function parseFrontmatter(content) {
  const raw = parseFile(content);

  if (!raw) {
    return {
      raw: null,
      properties: {},
      hasError: false
    };
  }

  const properties = extractProperties(raw);

  return {
    raw,
    properties,
    hasError: false
  };
}

/**
 * FrontmatterParser class for instance-based usage
 */
export class FrontmatterParser {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 1000;
  }

  /**
   * Parse file with caching
   * @param {string} filePath - Path to the file (used as cache key)
   * @param {string} content - File content
   * @returns {Object} Parsed frontmatter with properties
   */
  parseFile(filePath, content) {
    // Check cache
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath);
    }

    // Parse frontmatter
    const result = parseFrontmatter(content);

    // Cache the result
    this.setCache(filePath, result);

    return result;
  }

  /**
   * Set cache with size management
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  setCache(key, value) {
    // If cache is full, remove oldest entry
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, value);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Invalidate specific file in cache
   * @param {string} filePath - Path to file
   */
  invalidate(filePath) {
    this.cache.delete(filePath);
  }
}

// Export default instance
export const frontmatterParser = new FrontmatterParser();

export default FrontmatterParser;