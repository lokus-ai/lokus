/**
 * Template Filters
 *
 * Comprehensive collection of filters for transforming values in templates
 * Organized by category: String, Array, Number, Date, Object, and Utility filters
 */

import { format, formatDistance, formatRelative, parseISO } from 'date-fns';

/**
 * String Filters
 */

export const stringFilters = {
  /**
   * Convert string to uppercase
   */
  upper: (value) => String(value).toUpperCase(),

  /**
   * Convert string to lowercase
   */
  lower: (value) => String(value).toLowerCase(),

  /**
   * Capitalize first letter only
   */
  capitalize: (value) => {
    const str = String(value);
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  },

  /**
   * Title case - capitalize first letter of each word
   */
  capitalizeAll: (value) => {
    return String(value)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Trim whitespace from both ends
   */
  trim: (value) => String(value).trim(),

  /**
   * Truncate string to specified length with suffix
   * Usage: {{text | truncate(20, '...')}}
   */
  truncate: (value, args = {}) => {
    const str = String(value);
    const length = args.length || 50;
    const suffix = args.suffix || '...';

    if (str.length <= length) return str;
    return str.slice(0, length - suffix.length) + suffix;
  },

  /**
   * Convert string to URL-safe slug
   */
  slug: (value) => {
    return String(value)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  },

  /**
   * Replace all occurrences of a substring
   * Usage: {{text | replace('old', 'new')}}
   */
  replace: (value, args = {}) => {
    const str = String(value);
    const oldStr = args.old || args[0] || '';
    const newStr = args.new || args[1] || '';
    return str.split(oldStr).join(newStr);
  },

  /**
   * Pad start of string to specified length
   * Usage: {{text | padStart(10, '0')}}
   */
  padStart: (value, args = {}) => {
    const str = String(value);
    const length = args.length || args[0] || str.length;
    const char = args.char || args[1] || ' ';
    return str.padStart(length, char);
  },

  /**
   * Pad end of string to specified length
   * Usage: {{text | padEnd(10, '_')}}
   */
  padEnd: (value, args = {}) => {
    const str = String(value);
    const length = args.length || args[0] || str.length;
    const char = args.char || args[1] || ' ';
    return str.padEnd(length, char);
  },

  /**
   * Reverse string
   */
  reverse: (value) => {
    return String(value).split('').reverse().join('');
  },

  /**
   * Repeat string n times
   * Usage: {{text | repeat(3)}}
   */
  repeat: (value, args = {}) => {
    const str = String(value);
    const count = args.count || args[0] || 1;
    return str.repeat(Math.min(Math.max(count, 0), 100)); // Max 100 repeats
  },

  /**
   * Extract substring
   * Usage: {{text | substring(0, 10)}}
   */
  substring: (value, args = {}) => {
    const str = String(value);
    const start = args.start || args[0] || 0;
    const end = args.end || args[1] || str.length;
    return str.substring(start, end);
  },

  /**
   * Split string into array
   * Usage: {{text | split(',')}}
   */
  split: (value, args = {}) => {
    const str = String(value);
    const separator = args.separator || args[0] || ',';
    return str.split(separator);
  },

  /**
   * Remove HTML tags
   */
  stripTags: (value) => {
    return String(value).replace(/<[^>]*>/g, '');
  },

  /**
   * Escape HTML special characters
   */
  escape: (value) => {
    const str = String(value);
    const htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return str.replace(/[&<>"']/g, char => htmlEscapes[char]);
  },

  /**
   * Word count
   */
  wordCount: (value) => {
    const str = String(value).trim();
    if (!str) return 0;
    return str.split(/\s+/).length;
  }
};

/**
 * Array Filters
 */

export const arrayFilters = {
  /**
   * Join array elements with separator
   * Usage: {{items | join(', ')}}
   */
  join: (value, args = {}) => {
    if (!Array.isArray(value)) return String(value);
    const separator = args.separator || args[0] || ', ';
    return value.join(separator);
  },

  /**
   * Get first element
   */
  first: (value) => {
    if (!Array.isArray(value)) return value;
    return value.length > 0 ? value[0] : undefined;
  },

  /**
   * Get last element
   */
  last: (value) => {
    if (!Array.isArray(value)) return value;
    return value.length > 0 ? value[value.length - 1] : undefined;
  },

  /**
   * Get length of array or string
   */
  length: (value) => {
    if (Array.isArray(value) || typeof value === 'string') {
      return value.length;
    }
    if (typeof value === 'object' && value !== null) {
      return Object.keys(value).length;
    }
    return 0;
  },

  /**
   * Slice array
   * Usage: {{items | slice(0, 5)}}
   */
  slice: (value, args = {}) => {
    if (!Array.isArray(value)) return value;
    const start = args.start || args[0] || 0;
    const end = args.end || args[1];
    return value.slice(start, end);
  },

  /**
   * Reverse array
   */
  reverseArray: (value) => {
    if (!Array.isArray(value)) return value;
    return [...value].reverse();
  },

  /**
   * Sort array
   * Usage: {{items | sort()}}
   */
  sort: (value, args = {}) => {
    if (!Array.isArray(value)) return value;
    const sorted = [...value];

    if (args.reverse) {
      return sorted.sort().reverse();
    }

    return sorted.sort();
  },

  /**
   * Get unique values
   */
  unique: (value) => {
    if (!Array.isArray(value)) return value;
    return [...new Set(value)];
  },

  /**
   * Remove falsy values (null, undefined, false, 0, '', NaN)
   */
  compact: (value) => {
    if (!Array.isArray(value)) return value;
    return value.filter(item => !!item);
  },

  /**
   * Flatten nested array one level deep
   */
  flatten: (value) => {
    if (!Array.isArray(value)) return value;
    return value.flat();
  },

  /**
   * Get specific index
   * Usage: {{items | at(2)}}
   */
  at: (value, args = {}) => {
    if (!Array.isArray(value)) return value;
    const index = args.index || args[0] || 0;
    return value[index];
  },

  /**
   * Check if array includes value
   * Usage: {{items | includes('test')}}
   */
  includes: (value, args = {}) => {
    if (!Array.isArray(value)) return false;
    const searchValue = args.value || args[0];
    return value.includes(searchValue);
  }
};

/**
 * Number Filters
 */

export const numberFilters = {
  /**
   * Round to nearest integer or specified decimals
   * Usage: {{num | round(2)}}
   */
  round: (value, args = {}) => {
    const num = Number(value);
    const decimals = args.decimals || args[0] || 0;
    const multiplier = Math.pow(10, decimals);
    return Math.round(num * multiplier) / multiplier;
  },

  /**
   * Floor to integer
   */
  floor: (value) => Math.floor(Number(value)),

  /**
   * Ceil to integer
   */
  ceil: (value) => Math.ceil(Number(value)),

  /**
   * Absolute value
   */
  abs: (value) => Math.abs(Number(value)),

  /**
   * Format number with pattern
   * Usage: {{price | format('$0,0.00')}}
   * Simplified implementation - supports basic patterns
   */
  format: (value, args = {}) => {
    const num = Number(value);
    const pattern = args.pattern || args[0] || '0,0.00';

    // Extract currency symbol
    const currency = pattern.match(/[$€£¥]/)?.[0] || '';

    // Determine decimal places
    const decimalMatch = pattern.match(/\.(\d+)/);
    const decimals = decimalMatch ? decimalMatch[1].length : 0;

    // Format number
    let formatted = num.toFixed(decimals);

    // Add thousand separators if pattern includes comma
    if (pattern.includes(',')) {
      const parts = formatted.split('.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      formatted = parts.join('.');
    }

    // Add currency symbol
    if (currency) {
      formatted = currency + formatted;
    }

    return formatted;
  },

  /**
   * Convert to percentage
   * Usage: {{decimal | percentage(2)}}
   */
  percentage: (value, args = {}) => {
    const num = Number(value);
    const decimals = args.decimals || args[0] || 0;
    const percentage = num * 100;
    return percentage.toFixed(decimals) + '%';
  },

  /**
   * Clamp number between min and max
   * Usage: {{num | clamp(0, 100)}}
   */
  clamp: (value, args = {}) => {
    const num = Number(value);
    const min = args.min || args[0] || 0;
    const max = args.max || args[1] || 100;
    return Math.min(Math.max(num, min), max);
  },

  /**
   * Add to number
   * Usage: {{num | add(5)}}
   */
  add: (value, args = {}) => {
    const num = Number(value);
    const addend = Number(args.value || args[0] || 0);
    return num + addend;
  },

  /**
   * Subtract from number
   * Usage: {{num | subtract(5)}}
   */
  subtract: (value, args = {}) => {
    const num = Number(value);
    const subtrahend = Number(args.value || args[0] || 0);
    return num - subtrahend;
  },

  /**
   * Multiply number
   * Usage: {{num | multiply(2)}}
   */
  multiply: (value, args = {}) => {
    const num = Number(value);
    const multiplier = Number(args.value || args[0] || 1);
    return num * multiplier;
  },

  /**
   * Divide number
   * Usage: {{num | divide(2)}}
   */
  divide: (value, args = {}) => {
    const num = Number(value);
    const divisor = Number(args.value || args[0] || 1);
    return divisor !== 0 ? num / divisor : num;
  }
};

/**
 * Date Filters
 */

export const dateFilters = {
  /**
   * Format date with pattern using date-fns
   * Usage: {{date | dateFormat('yyyy-MM-dd')}}
   * Supports all date-fns format tokens
   */
  dateFormat: (value, args = {}) => {
    try {
      // Handle different input types
      let date;
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'string') {
        // Try to parse ISO string first
        date = value.includes('T') ? parseISO(value) : new Date(value);
      } else if (typeof value === 'object' && value !== null) {
        // Handle Proxy objects - call toString() to get date string
        const dateStr = value.toString();
        date = new Date(dateStr);
      } else {
        date = new Date(value);
      }

      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      const pattern = args.pattern || args[0] || 'yyyy-MM-dd';

      // Auto-correct common format token mistakes for better UX
      const correctedPattern = pattern
        .replace(/YYYY/g, 'yyyy')
        .replace(/DD/g, 'dd')
        .replace(/Do/g, 'do');

      return format(date, correctedPattern);
    } catch (error) {
      console.error('[dateFormat filter] Error:', error);
      return `[Date format error: ${error.message}]`;
    }
  },

  /**
   * Add time to date
   * Usage: {{date | dateAdd(7, 'days')}}
   */
  dateAdd: (value, args = {}) => {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    const amount = Number(args.amount || args[0] || 0);
    const unit = args.unit || args[1] || 'days';

    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }

    switch (unit.toLowerCase()) {
      case 'years':
      case 'year':
        date.setFullYear(date.getFullYear() + amount);
        break;
      case 'months':
      case 'month':
        date.setMonth(date.getMonth() + amount);
        break;
      case 'weeks':
      case 'week':
        date.setDate(date.getDate() + (amount * 7));
        break;
      case 'days':
      case 'day':
        date.setDate(date.getDate() + amount);
        break;
      case 'hours':
      case 'hour':
        date.setHours(date.getHours() + amount);
        break;
      case 'minutes':
      case 'minute':
        date.setMinutes(date.getMinutes() + amount);
        break;
      case 'seconds':
      case 'second':
        date.setSeconds(date.getSeconds() + amount);
        break;
    }

    return date;
  },

  /**
   * Subtract time from date
   * Usage: {{date | dateSubtract(7, 'days')}}
   */
  dateSubtract: (value, args = {}) => {
    const amount = Number(args.amount || args[0] || 0);
    return dateFilters.dateAdd(value, { amount: -amount, unit: args.unit || args[1] });
  },

  /**
   * Time ago relative format using date-fns
   * Usage: {{date | timeAgo()}}
   */
  timeAgo: (value) => {
    try {
      // Handle different input types
      let date;
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'object' && value !== null) {
        // Handle Proxy objects
        const dateStr = value.toString();
        date = new Date(dateStr);
      } else {
        date = new Date(value);
      }

      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (error) {
      console.error('[timeAgo filter] Error:', error);
      return `[Time ago error]`;
    }
  },

  /**
   * From now relative format using date-fns
   * Usage: {{date | fromNow()}}
   */
  fromNow: (value) => {
    try {
      // Handle different input types
      let date;
      if (value instanceof Date) {
        date = value;
      } else if (typeof value === 'object' && value !== null) {
        // Handle Proxy objects
        const dateStr = value.toString();
        date = new Date(dateStr);
      } else {
        date = new Date(value);
      }

      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return formatDistance(date, new Date(), { addSuffix: true });
    } catch (error) {
      console.error('[fromNow filter] Error:', error);
      return `[From now error]`;
    }
  },

  /**
   * Format as date string
   */
  date: (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleDateString();
  },

  /**
   * Format as time string
   */
  time: (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleTimeString();
  },

  /**
   * Format as datetime string
   */
  datetime: (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString();
  },

  /**
   * Format as ISO string
   */
  iso: (value) => {
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  }
};

/**
 * Object/JSON Filters
 */

export const objectFilters = {
  /**
   * Convert to JSON string
   */
  json: (value) => JSON.stringify(value),

  /**
   * Pretty print JSON with indentation
   */
  pretty: (value, args = {}) => {
    const indent = args.indent || args[0] || 2;
    return JSON.stringify(value, null, indent);
  },

  /**
   * Get object keys
   */
  keys: (value) => {
    if (typeof value !== 'object' || value === null) return [];
    return Object.keys(value);
  },

  /**
   * Get object values
   */
  values: (value) => {
    if (typeof value !== 'object' || value === null) return [];
    return Object.values(value);
  },

  /**
   * Get object entries as array of [key, value] pairs
   */
  entries: (value) => {
    if (typeof value !== 'object' || value === null) return [];
    return Object.entries(value);
  }
};

/**
 * Utility Filters
 */

export const utilityFilters = {
  /**
   * URL encode
   */
  encode: (value) => encodeURIComponent(String(value)),

  /**
   * URL decode
   */
  decode: (value) => decodeURIComponent(String(value)),

  /**
   * Default value if undefined or null
   * Usage: {{value | default('N/A')}}
   */
  default: (value, args = {}) => {
    const defaultValue = args.value || args[0] || '';
    return (value !== undefined && value !== null && value !== '') ? value : defaultValue;
  },

  /**
   * Get type of value
   */
  typeOf: (value) => {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  },

  /**
   * Convert to boolean
   */
  bool: (value) => !!value,

  /**
   * Convert to string
   */
  string: (value) => String(value),

  /**
   * Convert to number
   */
  number: (value) => Number(value),

  /**
   * Check if value is empty
   */
  isEmpty: (value) => {
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  },

  /**
   * Debug output - show value and type
   */
  debug: (value) => {
    const type = utilityFilters.typeOf(value);
    return `[${type}] ${JSON.stringify(value)}`;
  }
};

/**
 * All filters combined
 */

export const allFilters = {
  ...stringFilters,
  ...arrayFilters,
  ...numberFilters,
  ...dateFilters,
  ...objectFilters,
  ...utilityFilters
};

/**
 * Filter categories for documentation
 */

export const filterCategories = {
  string: Object.keys(stringFilters),
  array: Object.keys(arrayFilters),
  number: Object.keys(numberFilters),
  date: Object.keys(dateFilters),
  object: Object.keys(objectFilters),
  utility: Object.keys(utilityFilters)
};

/**
 * Get filter by name
 */

export function getFilter(name) {
  return allFilters[name];
}

/**
 * Check if filter exists
 */

export function hasFilter(name) {
  return name in allFilters;
}

/**
 * Get all filter names
 */

export function getFilterNames() {
  return Object.keys(allFilters);
}

/**
 * Get filters by category
 */

export function getFiltersByCategory(category) {
  switch (category) {
    case 'string':
      return stringFilters;
    case 'array':
      return arrayFilters;
    case 'number':
      return numberFilters;
    case 'date':
      return dateFilters;
    case 'object':
      return objectFilters;
    case 'utility':
      return utilityFilters;
    default:
      return {};
  }
}

export default allFilters;
