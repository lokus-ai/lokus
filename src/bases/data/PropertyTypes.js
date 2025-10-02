// src/bases/data/PropertyTypes.js
/**
 * PropertyTypes - Auto-detect property types from values, handle type conversion and validation
 * Supports tags, dates, numbers, lists, boolean values and handles edge cases
 */

export const PropertyType = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  ARRAY: 'array',
  TAGS: 'tags',
  MIXED: 'mixed',
  NULL: 'null'
};

export class PropertyTypes {
  /**
   * Auto-detect the type of a property value
   * @param {any} value - The value to analyze
   * @returns {string} The detected type
   */
  static detectType(value) {
    if (value === null || value === undefined) {
      return PropertyType.NULL;
    }

    // Handle arrays
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return PropertyType.ARRAY;
      }

      // Check if it's a tags array (all strings, short values)
      if (this.isTagsArray(value)) {
        return PropertyType.TAGS;
      }

      // Check array consistency
      const types = value.map(v => this.detectType(v));
      const uniqueTypes = [...new Set(types)];

      if (uniqueTypes.length === 1) {
        return uniqueTypes[0] === PropertyType.STRING ? PropertyType.ARRAY : PropertyType.MIXED;
      }

      return PropertyType.MIXED;
    }

    // Handle strings
    if (typeof value === 'string') {
      // Check for boolean strings
      if (this.isBooleanString(value)) {
        return PropertyType.BOOLEAN;
      }

      // Check for date strings
      if (this.isDateString(value)) {
        return PropertyType.DATE;
      }

      // Check for number strings
      if (this.isNumberString(value)) {
        return PropertyType.NUMBER;
      }

      // Check for comma-separated tags
      if (this.isCommaSeparatedTags(value)) {
        return PropertyType.TAGS;
      }

      return PropertyType.STRING;
    }

    // Handle numbers
    if (typeof value === 'number' && !isNaN(value)) {
      return PropertyType.NUMBER;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      return PropertyType.BOOLEAN;
    }

    // Handle dates
    if (value instanceof Date && !isNaN(value.getTime())) {
      return PropertyType.DATE;
    }

    return PropertyType.STRING; // fallback
  }

  /**
   * Check if array should be treated as tags
   */
  static isTagsArray(arr) {
    return arr.every(item =>
      typeof item === 'string' &&
      item.length < 50 && // reasonable tag length
      !item.includes('\n') && // no multiline tags
      item.trim() === item // no leading/trailing spaces
    );
  }

  /**
   * Check if string represents a boolean
   */
  static isBooleanString(str) {
    const lower = str.toLowerCase().trim();
    return ['true', 'false', 'yes', 'no', '1', '0'].includes(lower);
  }

  /**
   * Check if string represents a date
   */
  static isDateString(str) {
    if (typeof str !== 'string') return false;

    // Common date patterns
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO datetime
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY or M/D/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // MM-DD-YYYY
    ];

    if (datePatterns.some(pattern => pattern.test(str))) {
      const date = new Date(str);
      return !isNaN(date.getTime());
    }

    return false;
  }

  /**
   * Check if string represents a number
   */
  static isNumberString(str) {
    if (typeof str !== 'string') return false;

    const trimmed = str.trim();
    if (trimmed === '') return false;

    // Check for valid number patterns
    const numberPattern = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;
    return numberPattern.test(trimmed) && !isNaN(parseFloat(trimmed));
  }

  /**
   * Check if string is comma-separated tags
   */
  static isCommaSeparatedTags(str) {
    if (typeof str !== 'string' || !str.includes(',')) return false;

    const parts = str.split(',').map(s => s.trim());
    return parts.length > 1 &&
           parts.length <= 10 && // reasonable number of tags
           parts.every(part => part.length > 0 && part.length < 50);
  }

  /**
   * Convert value to specified type
   * @param {any} value - Value to convert
   * @param {string} targetType - Target type
   * @returns {any} Converted value
   */
  static convertValue(value, targetType) {
    if (value === null || value === undefined) {
      return this.getDefaultValue(targetType);
    }

    try {
      switch (targetType) {
        case PropertyType.STRING:
          return this.toString(value);

        case PropertyType.NUMBER:
          return this.toNumber(value);

        case PropertyType.BOOLEAN:
          return this.toBoolean(value);

        case PropertyType.DATE:
          return this.toDate(value);

        case PropertyType.ARRAY:
          return this.toArray(value);

        case PropertyType.TAGS:
          return this.toTags(value);

        default:
          return value;
      }
    } catch (error) {
      return this.getDefaultValue(targetType);
    }
  }

  /**
   * Convert to string
   */
  static toString(value) {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return String(value);
  }

  /**
   * Convert to number
   */
  static toNumber(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value.trim());
      if (!isNaN(num)) return num;
    }
    if (typeof value === 'boolean') return value ? 1 : 0;
    throw new Error('Cannot convert to number');
  }

  /**
   * Convert to boolean
   */
  static toBoolean(value) {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const lower = value.toLowerCase().trim();
      if (['true', 'yes', '1'].includes(lower)) return true;
      if (['false', 'no', '0'].includes(lower)) return false;
    }
    return Boolean(value);
  }

  /**
   * Convert to date
   */
  static toDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      const date = new Date(value);
      if (!isNaN(date.getTime())) return date;
    }
    throw new Error('Cannot convert to date');
  }

  /**
   * Convert to array
   */
  static toArray(value) {
    if (Array.isArray(value)) return [...value];
    if (typeof value === 'string') {
      // Try comma-separated values
      if (value.includes(',')) {
        return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
      }
      // Single value array
      return [value];
    }
    return [value];
  }

  /**
   * Convert to tags array
   */
  static toTags(value) {
    const arr = this.toArray(value);
    return arr.map(item => this.toString(item).trim())
              .filter(tag => tag.length > 0 && tag.length < 50);
  }

  /**
   * Get default value for type
   */
  static getDefaultValue(type) {
    switch (type) {
      case PropertyType.STRING: return '';
      case PropertyType.NUMBER: return 0;
      case PropertyType.BOOLEAN: return false;
      case PropertyType.DATE: return new Date();
      case PropertyType.ARRAY: return [];
      case PropertyType.TAGS: return [];
      case PropertyType.NULL: return null;
      default: return null;
    }
  }

  /**
   * Validate value against type
   * @param {any} value - Value to validate
   * @param {string} type - Expected type
   * @returns {boolean} Whether value is valid for type
   */
  static validateValue(value, type) {
    if (value === null || value === undefined) {
      return type === PropertyType.NULL;
    }

    const detectedType = this.detectType(value);

    // Direct match
    if (detectedType === type) return true;

    // Compatible types
    const compatibleTypes = {
      [PropertyType.STRING]: [PropertyType.TAGS],
      [PropertyType.ARRAY]: [PropertyType.TAGS],
      [PropertyType.TAGS]: [PropertyType.ARRAY, PropertyType.STRING],
      [PropertyType.NUMBER]: [PropertyType.STRING],
      [PropertyType.BOOLEAN]: [PropertyType.STRING],
      [PropertyType.DATE]: [PropertyType.STRING]
    };

    return compatibleTypes[type]?.includes(detectedType) || false;
  }

  /**
   * Analyze multiple values to determine best common type
   * @param {Array} values - Array of values to analyze
   * @returns {string} Best common type
   */
  static inferCommonType(values) {
    if (!values || values.length === 0) {
      return PropertyType.STRING;
    }

    // Filter out null/undefined values for analysis
    const definedValues = values.filter(v => v !== null && v !== undefined);
    if (definedValues.length === 0) {
      return PropertyType.NULL;
    }

    const types = definedValues.map(v => this.detectType(v));
    const typeCounts = {};

    types.forEach(type => {
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // If all values are the same type
    const uniqueTypes = Object.keys(typeCounts);
    if (uniqueTypes.length === 1) {
      return uniqueTypes[0];
    }

    // Handle mixed types - prefer more specific types
    const typeHierarchy = [
      PropertyType.TAGS,
      PropertyType.ARRAY,
      PropertyType.DATE,
      PropertyType.BOOLEAN,
      PropertyType.NUMBER,
      PropertyType.STRING,
      PropertyType.MIXED
    ];

    // Return the most specific type that appears
    for (const type of typeHierarchy) {
      if (typeCounts[type]) {
        return type;
      }
    }

    return PropertyType.MIXED;
  }

  /**
   * Format value for display based on type
   * @param {any} value - Value to format
   * @param {string} type - Property type
   * @returns {string} Formatted display value
   */
  static formatForDisplay(value, type) {
    if (value === null || value === undefined) {
      return '';
    }

    switch (type) {
      case PropertyType.DATE:
        if (value instanceof Date) {
          return value.toLocaleDateString();
        }
        return String(value);

      case PropertyType.BOOLEAN:
        return value ? 'Yes' : 'No';

      case PropertyType.TAGS:
      case PropertyType.ARRAY:
        if (Array.isArray(value)) {
          return value.join(', ');
        }
        return String(value);

      case PropertyType.NUMBER:
        if (typeof value === 'number') {
          return Number.isInteger(value) ? value.toString() : value.toFixed(2);
        }
        return String(value);

      default:
        return String(value);
    }
  }

  /**
   * Get type-specific sorting function
   * @param {string} type - Property type
   * @returns {Function} Sort comparison function
   */
  static getSortComparator(type) {
    switch (type) {
      case PropertyType.NUMBER:
        return (a, b) => {
          const numA = typeof a === 'number' ? a : parseFloat(a) || 0;
          const numB = typeof b === 'number' ? b : parseFloat(b) || 0;
          return numA - numB;
        };

      case PropertyType.DATE:
        return (a, b) => {
          const dateA = a instanceof Date ? a : new Date(a);
          const dateB = b instanceof Date ? b : new Date(b);
          return dateA.getTime() - dateB.getTime();
        };

      case PropertyType.BOOLEAN:
        return (a, b) => {
          const boolA = typeof a === 'boolean' ? a : this.toBoolean(a);
          const boolB = typeof b === 'boolean' ? b : this.toBoolean(b);
          return boolA === boolB ? 0 : boolA ? -1 : 1;
        };

      default:
        return (a, b) => {
          const strA = String(a).toLowerCase();
          const strB = String(b).toLowerCase();
          return strA.localeCompare(strB);
        };
    }
  }
}

export default PropertyTypes;