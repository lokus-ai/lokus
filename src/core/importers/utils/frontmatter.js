/**
 * Frontmatter Utilities
 *
 * Handles YAML frontmatter conversion and manipulation
 */

/**
 * Parse Logseq-style properties (property:: value)
 * @param {string} content - Markdown content
 * @returns {Object} {properties: Object, content: string}
 */
export function parseLogseqProperties(content) {
  const properties = {};
  const lines = content.split('\n');
  const contentLines = [];
  let inContent = false;

  for (const line of lines) {
    // Match property:: value format
    const propertyMatch = line.match(/^([a-zA-Z0-9_-]+)::\s*(.+)$/);

    if (propertyMatch && !inContent) {
      const [, key, value] = propertyMatch;
      // Parse value (could be array, boolean, number, or string)
      properties[key] = parsePropertyValue(value);
    } else {
      // Once we hit non-property content, everything else is content
      if (line.trim() !== '' || inContent) {
        inContent = true;
        contentLines.push(line);
      }
    }
  }

  return {
    properties,
    content: contentLines.join('\n').trim()
  };
}

/**
 * Parse property value to appropriate type
 */
function parsePropertyValue(value) {
  value = value.trim();

  // Boolean
  if (value === 'true') return true;
  if (value === 'false') return false;

  // Number
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return parseFloat(value);
  }

  // Array (comma-separated or [[page]] links)
  if (value.includes(',')) {
    return value.split(',').map(v => v.trim());
  }

  // Array of [[links]]
  const linkMatches = value.match(/\[\[([^\]]+)\]\]/g);
  if (linkMatches && linkMatches.length > 1) {
    return linkMatches.map(m => m.slice(2, -2));
  }

  // Single [[link]]
  if (value.startsWith('[[') && value.endsWith(']]')) {
    return value.slice(2, -2);
  }

  // String
  return value;
}

/**
 * Convert properties object to YAML frontmatter
 * @param {Object} properties
 * @returns {string} YAML frontmatter block
 */
export function propertiesToYAML(properties) {
  if (!properties || Object.keys(properties).length === 0) {
    return '';
  }

  const yamlLines = ['---'];

  for (const [key, value] of Object.entries(properties)) {
    yamlLines.push(formatYAMLLine(key, value));
  }

  yamlLines.push('---');
  return yamlLines.join('\n');
}

/**
 * Format a single YAML line
 */
function formatYAMLLine(key, value, indent = 0) {
  const spaces = '  '.repeat(indent);

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) return `${spaces}${key}: []`;
    const items = value.map(item => `${spaces}  - ${formatYAMLValue(item)}`).join('\n');
    return `${spaces}${key}:\n${items}`;
  }

  // Object
  if (typeof value === 'object' && value !== null) {
    const items = Object.entries(value)
      .map(([k, v]) => formatYAMLLine(k, v, indent + 1))
      .join('\n');
    return `${spaces}${key}:\n${items}`;
  }

  // Primitive
  return `${spaces}${key}: ${formatYAMLValue(value)}`;
}

/**
 * Format a YAML value
 */
function formatYAMLValue(value) {
  // Null/undefined
  if (value === null || value === undefined) return 'null';

  // Boolean
  if (typeof value === 'boolean') return value.toString();

  // Number
  if (typeof value === 'number') return value.toString();

  // String
  const str = String(value);

  // Quote strings that contain special characters
  if (str.includes(':') || str.includes('#') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '\\"')}"`;
  }

  return str;
}

/**
 * Add or update frontmatter in markdown content
 * @param {string} content - Existing markdown
 * @param {Object} properties - Properties to add
 * @returns {string} Content with frontmatter
 */
export function addFrontmatter(content, properties) {
  const existingFrontmatter = extractFrontmatter(content);

  // Merge properties
  const mergedProperties = {
    ...existingFrontmatter.data,
    ...properties
  };

  const yaml = propertiesToYAML(mergedProperties);
  if (!yaml) return content;

  // Remove existing frontmatter if present
  const contentWithoutFrontmatter = existingFrontmatter.content;

  return `${yaml}\n\n${contentWithoutFrontmatter}`;
}

/**
 * Extract existing YAML frontmatter from markdown
 * @param {string} content
 * @returns {Object} {data: Object, content: string}
 */
export function extractFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!match) {
    return { data: {}, content };
  }

  const yamlStr = match[1];
  const contentWithoutFrontmatter = content.slice(match[0].length);

  // Simple YAML parser (for basic key: value pairs)
  const data = {};
  const lines = yamlStr.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    if (key && value) {
      data[key] = parsePropertyValue(value);
    }
  }

  return { data, content: contentWithoutFrontmatter };
}

export default {
  parseLogseqProperties,
  propertiesToYAML,
  addFrontmatter,
  extractFrontmatter
};
