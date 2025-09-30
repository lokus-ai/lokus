// src/bases/data/FrontmatterWriter.js
/**
 * FrontmatterWriter - Update YAML frontmatter in markdown files
 * Preserves formatting, comments, and handles various property types
 */

export class FrontmatterWriter {
  /**
   * Update a property in YAML frontmatter
   * @param {string} content - File content
   * @param {string} key - Property key to update
   * @param {any} value - New value
   * @returns {string} Updated content
   */
  static updateProperty(content, key, value) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    const lines = content.split('\n');

    // Check if frontmatter exists
    if (lines[0] !== '---') {
      // No frontmatter, add it with the property
      return this.ensureFrontmatter(content, { [key]: value });
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
      throw new Error('Invalid frontmatter: no closing delimiter');
    }

    // Find and update the property
    let propertyFound = false;
    const yamlLines = lines.slice(1, endIndex);

    for (let i = 0; i < yamlLines.length; i++) {
      const line = yamlLines[i];
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check if this line contains our property
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const lineKey = line.substring(0, colonIndex).trim();
        if (lineKey === key) {
          // Found the property, update it
          const indent = line.match(/^(\s*)/)[1];
          yamlLines[i] = `${indent}${key}: ${this.formatValue(value)}`;
          propertyFound = true;
          break;
        }
      }
    }

    // If property wasn't found, add it
    if (!propertyFound) {
      yamlLines.push(`${key}: ${this.formatValue(value)}`);
    }

    // Reconstruct the content
    const beforeFrontmatter = lines.slice(0, 1);
    const afterFrontmatter = lines.slice(endIndex);

    return [
      ...beforeFrontmatter,
      ...yamlLines,
      ...afterFrontmatter
    ].join('\n');
  }

  /**
   * Add a new property to YAML frontmatter
   * @param {string} content - File content
   * @param {string} key - Property key
   * @param {any} value - Property value
   * @returns {string} Updated content
   */
  static addProperty(content, key, value) {
    // For now, updateProperty handles both add and update
    return this.updateProperty(content, key, value);
  }

  /**
   * Ensure frontmatter exists, add if missing
   * @param {string} content - File content
   * @param {Object} properties - Properties to add
   * @returns {string} Content with frontmatter
   */
  static ensureFrontmatter(content, properties = {}) {
    if (!content || typeof content !== 'string') {
      content = '';
    }

    const lines = content.split('\n');

    // If frontmatter already exists, just return content
    if (lines[0] === '---') {
      return content;
    }

    // Create new frontmatter
    const frontmatterLines = ['---'];

    for (const [key, value] of Object.entries(properties)) {
      frontmatterLines.push(`${key}: ${this.formatValue(value)}`);
    }

    frontmatterLines.push('---');

    // Add blank line after frontmatter if content exists
    if (content.trim()) {
      frontmatterLines.push('');
    }

    return frontmatterLines.join('\n') + content;
  }

  /**
   * Format a value for YAML output
   * @param {any} value - Value to format
   * @returns {string} Formatted YAML value
   */
  static formatValue(value) {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return '';
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return '[]';
      }
      // Format as inline array for short lists
      if (value.length <= 5) {
        return `[${value.map(v => this.formatValue(v)).join(', ')}]`;
      }
      // For longer arrays, use multi-line format
      return '\n' + value.map(v => `  - ${this.formatValue(v)}`).join('\n');
    }

    // Handle dates
    if (value instanceof Date) {
      return value.toISOString();
    }

    // Handle strings
    if (typeof value === 'string') {
      // Quote strings with special characters
      if (value.includes(':') || value.includes('#') || value.includes('\n')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      // Quote strings that look like numbers or booleans
      if (value === 'true' || value === 'false' || value === 'null' || !isNaN(value)) {
        return `"${value}"`;
      }
      return value;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false';
    }

    // Handle numbers
    if (typeof value === 'number') {
      return String(value);
    }

    // Handle objects (simple key-value pairs)
    if (typeof value === 'object') {
      const entries = Object.entries(value);
      if (entries.length === 0) {
        return '{}';
      }
      return '\n' + entries.map(([k, v]) => `  ${k}: ${this.formatValue(v)}`).join('\n');
    }

    // Default: convert to string
    return String(value);
  }

  /**
   * Parse comma-separated string into array
   * @param {string} str - Comma-separated string
   * @returns {Array} Array of values
   */
  static parseCommaSeparated(str) {
    if (!str || typeof str !== 'string') {
      return [];
    }
    return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  /**
   * Remove a property from frontmatter
   * @param {string} content - File content
   * @param {string} key - Property key to remove
   * @returns {string} Updated content
   */
  static removeProperty(content, key) {
    if (!content || typeof content !== 'string') {
      return content;
    }

    const lines = content.split('\n');

    // Check if frontmatter exists
    if (lines[0] !== '---') {
      return content;
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
      return content;
    }

    // Filter out the property
    const yamlLines = lines.slice(1, endIndex);
    const filteredYamlLines = yamlLines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return true; // Keep comments and empty lines
      }
      const colonIndex = line.indexOf(':');
      if (colonIndex !== -1) {
        const lineKey = line.substring(0, colonIndex).trim();
        return lineKey !== key; // Remove if key matches
      }
      return true;
    });

    // Reconstruct the content
    const beforeFrontmatter = lines.slice(0, 1);
    const afterFrontmatter = lines.slice(endIndex);

    return [
      ...beforeFrontmatter,
      ...filteredYamlLines,
      ...afterFrontmatter
    ].join('\n');
  }

  /**
   * Get all properties from frontmatter
   * @param {string} content - File content
   * @returns {Object} Properties object
   */
  static getProperties(content) {
    if (!content || typeof content !== 'string') {
      return {};
    }

    const lines = content.split('\n');
    if (lines[0] !== '---') {
      return {};
    }

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

    const yamlContent = lines.slice(1, endIndex).join('\n');
    return this.parseSimpleYaml(yamlContent);
  }

  /**
   * Simple YAML parser (copied from PropertyScanner for consistency)
   * @private
   */
  static parseSimpleYaml(yaml) {
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
        continue;
      }

      const leadingSpaces = line.match(/^(\s*)/)[1].length;

      if (trimmedLine.startsWith('- ')) {
        if (!isArray) {
          isArray = true;
          arrayItems = [];
          indentLevel = leadingSpaces;
        }

        if (leadingSpaces === indentLevel) {
          const arrayValue = trimmedLine.substring(2).trim();
          arrayItems.push(this.parseYamlValue(arrayValue));
          continue;
        }
      }

      if (isArray && (leadingSpaces < indentLevel || !trimmedLine.startsWith('- '))) {
        if (currentKey) {
          result[currentKey] = arrayItems;
        }
        isArray = false;
        arrayItems = [];
        currentKey = null;
      }

      if (trimmedLine.includes(':')) {
        if (isMultilineValue && currentKey) {
          result[currentKey] = this.parseYamlValue(currentValue.trim());
          isMultilineValue = false;
          currentValue = '';
        }

        const colonIndex = trimmedLine.indexOf(':');
        const key = trimmedLine.substring(0, colonIndex).trim();
        const value = trimmedLine.substring(colonIndex + 1).trim();

        if (value) {
          result[key] = this.parseYamlValue(value);
          currentKey = null;
        } else {
          currentKey = key;
          isMultilineValue = true;
          currentValue = '';
        }
      } else if (isMultilineValue && currentKey) {
        currentValue += (currentValue ? '\n' : '') + trimmedLine;
      }
    }

    if (isArray && currentKey) {
      result[currentKey] = arrayItems;
    } else if (isMultilineValue && currentKey) {
      result[currentKey] = this.parseYamlValue(currentValue.trim());
    }

    return result;
  }

  /**
   * Parse YAML value
   * @private
   */
  static parseYamlValue(value) {
    if (!value || typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    // Handle quoted strings
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return trimmed.slice(1, -1);
    }

    // Handle arrays
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(s => this.parseYamlValue(s.trim()));
    }

    // Handle booleans
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

    return trimmed;
  }
}

export default FrontmatterWriter;