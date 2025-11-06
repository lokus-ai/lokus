/**
 * Built-in Variables Registry
 *
 * Defines built-in template variables that are automatically available
 * in all templates without needing to be explicitly provided
 *
 * Enhanced with date-fns for powerful date manipulation
 */

import { dateHelpers } from './dates.js';
import { format } from 'date-fns';

export class BuiltinVariables {
  constructor() {
    this.variables = new Map();
    this.dateHelpers = dateHelpers;
    this.initializeBuiltins();
  }

  /**
   * Initialize built-in variables
   */
  initializeBuiltins() {
    // ========================================
    // Basic Date/Time variables (backward compatible)
    // ========================================
    this.register('date', () => new Date().toLocaleDateString());
    this.register('time', () => new Date().toLocaleTimeString());
    this.register('datetime', () => new Date().toLocaleString());
    this.register('timestamp', () => Date.now());
    this.register('isodate', () => format(new Date(), 'yyyy-MM-dd'));
    this.register('isotime', () => new Date().toISOString());

    // Date formatting variants
    this.register('date.short', () => format(new Date(), 'MMM d, yyyy'));
    this.register('date.long', () => format(new Date(), 'EEEE, MMMM d, yyyy'));
    this.register('date.year', () => format(new Date(), 'yyyy'));
    this.register('date.month', () => new Date().getMonth() + 1);
    this.register('date.day', () => format(new Date(), 'd'));
    this.register('date.weekday', () => format(new Date(), 'EEEE'));

    // ========================================
    // Enhanced Date/Time variables (date-fns powered)
    // ========================================

    // Relative dates
    this.register('date.tomorrow', () => format(dateHelpers.tomorrow(), 'yyyy-MM-dd'));
    this.register('date.yesterday', () => format(dateHelpers.yesterday(), 'yyyy-MM-dd'));
    this.register('date.nextWeek', () => format(dateHelpers.nextWeek(), 'yyyy-MM-dd'));
    this.register('date.lastWeek', () => format(dateHelpers.lastWeek(), 'yyyy-MM-dd'));
    this.register('date.nextMonth', () => format(dateHelpers.nextMonth(), 'yyyy-MM-dd'));
    this.register('date.lastMonth', () => format(dateHelpers.lastMonth(), 'yyyy-MM-dd'));

    // Start/End of periods
    this.register('date.startOfWeek', () => format(dateHelpers.startOfWeek(), 'yyyy-MM-dd'));
    this.register('date.endOfWeek', () => format(dateHelpers.endOfWeek(), 'yyyy-MM-dd'));
    this.register('date.startOfMonth', () => format(dateHelpers.startOfMonth(), 'yyyy-MM-dd'));
    this.register('date.endOfMonth', () => format(dateHelpers.endOfMonth(), 'yyyy-MM-dd'));
    this.register('date.startOfYear', () => format(dateHelpers.startOfYear(), 'yyyy-MM-dd'));
    this.register('date.endOfYear', () => format(dateHelpers.endOfYear(), 'yyyy-MM-dd'));

    // Weekday helpers
    this.register('date.nextMonday', () => format(dateHelpers.nextMonday(), 'yyyy-MM-dd'));
    this.register('date.nextFriday', () => format(dateHelpers.nextFriday(), 'yyyy-MM-dd'));
    this.register('date.previousMonday', () => format(dateHelpers.previousMonday(), 'yyyy-MM-dd'));

    // Common date formats
    this.register('date.iso', () => format(new Date(), 'yyyy-MM-dd'));
    this.register('date.us', () => format(new Date(), 'MM/dd/yyyy'));
    this.register('date.uk', () => format(new Date(), 'dd/MM/yyyy'));
    this.register('date.full', () => format(new Date(), 'EEEE, MMMM do, yyyy'));
    this.register('date.monthYear', () => format(new Date(), 'MMMM yyyy'));
    this.register('date.quarter', () => `Q${dateHelpers.getQuarter()}`);
    this.register('date.week', () => `Week ${dateHelpers.getWeek()}`);

    // Calendar utilities
    this.register('date.daysInMonth', () => dateHelpers.getDaysInMonth());
    this.register('date.isLeapYear', () => dateHelpers.isLeapYear());

    // User/System variables
    this.register('user', () => {
      try {
        return process.env.USER || process.env.USERNAME || 'User';
      } catch {
        return 'User';
      }
    });
    
    // Content placeholders
    this.register('cursor', () => '{{cursor}}'); // Special cursor placeholder
    this.register('selection', () => '{{selection}}'); // Selected text placeholder
    
    // Random/Utility variables
    this.register('uuid', () => this.generateUUID());
    this.register('random', () => Math.random());
    this.register('randomInt', () => Math.floor(Math.random() * 100));
    
    // Application variables
    this.register('app.name', () => 'Lokus');
    this.register('app.version', () => '1.0.0');
    
    // Document variables (these might be overridden by context)
    this.register('title', () => 'Untitled');
    this.register('filename', () => 'untitled.md');
    this.register('filepath', () => '/untitled.md');
  }

  /**
   * Register a new built-in variable
   */
  register(name, resolver) {
    if (typeof name !== 'string' || !name.trim()) {
      throw new Error('Variable name must be a non-empty string');
    }
    
    if (typeof resolver !== 'function') {
      throw new Error('Variable resolver must be a function');
    }

    this.variables.set(name, {
      name,
      resolver,
      type: 'builtin',
      description: this.getDefaultDescription(name),
      category: this.getCategoryFromName(name)
    });
  }

  /**
   * Unregister a built-in variable
   */
  unregister(name) {
    return this.variables.delete(name);
  }

  /**
   * Get a variable definition
   */
  get(name) {
    return this.variables.get(name);
  }

  /**
   * Check if a variable exists
   */
  has(name) {
    return this.variables.has(name);
  }

  /**
   * Resolve a variable value
   */
  resolve(name, context = {}) {
    const variable = this.variables.get(name);
    if (!variable) {
      return undefined;
    }

    try {
      return variable.resolver(context);
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Resolve all built-in variables
   */
  resolveAll(context = {}) {
    const resolved = {};

    for (const [name, variable] of this.variables) {
      try {
        resolved[name] = variable.resolver(context);
      } catch (error) {
        resolved[name] = undefined;
      }
    }

    return resolved;
  }

  /**
   * Get date helpers for advanced date manipulation
   * This allows templates to access all date-fns functionality
   */
  getDateHelpers() {
    return this.dateHelpers;
  }

  /**
   * List all built-in variables
   */
  list() {
    return Array.from(this.variables.values());
  }

  /**
   * List variables by category
   */
  listByCategory() {
    const categories = {};
    
    for (const variable of this.variables.values()) {
      const category = variable.category;
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(variable);
    }
    
    return categories;
  }

  /**
   * Search variables by name or description
   */
  search(query) {
    const lowerQuery = query.toLowerCase();
    
    return Array.from(this.variables.values()).filter(variable => 
      variable.name.toLowerCase().includes(lowerQuery) ||
      variable.description.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Get variable statistics
   */
  getStatistics() {
    const categories = this.listByCategory();
    
    return {
      total: this.variables.size,
      categories: Object.keys(categories).length,
      byCategory: Object.fromEntries(
        Object.entries(categories).map(([cat, vars]) => [cat, vars.length])
      )
    };
  }

  // Private helper methods

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  getDefaultDescription(name) {
    const descriptions = {
      // Basic date/time
      'date': 'Current date in local format',
      'time': 'Current time in local format',
      'datetime': 'Current date and time in local format',
      'timestamp': 'Current Unix timestamp',
      'isodate': 'Current date in ISO format (YYYY-MM-DD)',
      'isotime': 'Current date and time in ISO format',

      // Date formatting
      'date.short': 'Current date in short format (e.g., Jan 1, 2023)',
      'date.long': 'Current date in long format (e.g., Monday, January 1, 2023)',
      'date.year': 'Current year',
      'date.month': 'Current month (1-12)',
      'date.day': 'Current day of month',
      'date.weekday': 'Current day of the week',

      // Relative dates
      'date.tomorrow': 'Tomorrow\'s date (YYYY-MM-DD)',
      'date.yesterday': 'Yesterday\'s date (YYYY-MM-DD)',
      'date.nextWeek': 'Date one week from now (YYYY-MM-DD)',
      'date.lastWeek': 'Date one week ago (YYYY-MM-DD)',
      'date.nextMonth': 'Date one month from now (YYYY-MM-DD)',
      'date.lastMonth': 'Date one month ago (YYYY-MM-DD)',

      // Period boundaries
      'date.startOfWeek': 'First day of current week (YYYY-MM-DD)',
      'date.endOfWeek': 'Last day of current week (YYYY-MM-DD)',
      'date.startOfMonth': 'First day of current month (YYYY-MM-DD)',
      'date.endOfMonth': 'Last day of current month (YYYY-MM-DD)',
      'date.startOfYear': 'First day of current year (YYYY-MM-DD)',
      'date.endOfYear': 'Last day of current year (YYYY-MM-DD)',

      // Weekday helpers
      'date.nextMonday': 'Date of next Monday (YYYY-MM-DD)',
      'date.nextFriday': 'Date of next Friday (YYYY-MM-DD)',
      'date.previousMonday': 'Date of previous Monday (YYYY-MM-DD)',

      // Common formats
      'date.iso': 'Current date in ISO format (YYYY-MM-DD)',
      'date.us': 'Current date in US format (MM/DD/YYYY)',
      'date.uk': 'Current date in UK format (DD/MM/YYYY)',
      'date.full': 'Current date in full format (e.g., Monday, January 1st, 2023)',
      'date.monthYear': 'Current month and year (e.g., January 2023)',
      'date.quarter': 'Current quarter (e.g., Q1)',
      'date.week': 'Current week number (e.g., Week 15)',

      // Calendar utilities
      'date.daysInMonth': 'Number of days in current month',
      'date.isLeapYear': 'Whether current year is a leap year',

      // Other variables
      'user': 'Current username',
      'cursor': 'Cursor position placeholder',
      'selection': 'Selected text placeholder',
      'uuid': 'Random UUID',
      'random': 'Random number between 0 and 1',
      'randomInt': 'Random integer between 0 and 99',
      'app.name': 'Application name',
      'app.version': 'Application version',
      'title': 'Document title',
      'filename': 'Document filename',
      'filepath': 'Document file path'
    };

    return descriptions[name] || `Built-in variable: ${name}`;
  }

  getCategoryFromName(name) {
    if (name.startsWith('date')) return 'date';
    if (name.startsWith('app.')) return 'application';
    if (name === 'user') return 'system';
    if (['cursor', 'selection'].includes(name)) return 'content';
    if (['title', 'filename', 'filepath'].includes(name)) return 'document';
    if (['uuid', 'random', 'randomInt'].includes(name)) return 'utility';
    if (['time', 'datetime', 'timestamp', 'isotime'].includes(name)) return 'date';
    
    return 'general';
  }
}

// Export a singleton instance
export const builtinVariables = new BuiltinVariables();

export default builtinVariables;