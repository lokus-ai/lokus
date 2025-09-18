/**
 * Built-in Variables Registry
 * 
 * Defines built-in template variables that are automatically available
 * in all templates without needing to be explicitly provided
 */

export class BuiltinVariables {
  constructor() {
    this.variables = new Map();
    this.initializeBuiltins();
  }

  /**
   * Initialize built-in variables
   */
  initializeBuiltins() {
    // Date/Time variables
    this.register('date', () => new Date().toLocaleDateString());
    this.register('time', () => new Date().toLocaleTimeString());
    this.register('datetime', () => new Date().toLocaleString());
    this.register('timestamp', () => Date.now());
    this.register('isodate', () => new Date().toISOString().split('T')[0]);
    this.register('isotime', () => new Date().toISOString());
    
    // Date formatting variants
    this.register('date.short', () => new Date().toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric' 
    }));
    this.register('date.long', () => new Date().toLocaleDateString('en-US', { 
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
    }));
    this.register('date.year', () => new Date().getFullYear());
    this.register('date.month', () => new Date().getMonth() + 1);
    this.register('date.day', () => new Date().getDate());
    this.register('date.weekday', () => new Date().toLocaleDateString('en-US', { weekday: 'long' }));
    
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
      'date': 'Current date in local format',
      'time': 'Current time in local format',
      'datetime': 'Current date and time in local format',
      'timestamp': 'Current Unix timestamp',
      'isodate': 'Current date in ISO format (YYYY-MM-DD)',
      'isotime': 'Current date and time in ISO format',
      'date.short': 'Current date in short format (e.g., Jan 1, 2023)',
      'date.long': 'Current date in long format (e.g., Monday, January 1, 2023)',
      'date.year': 'Current year',
      'date.month': 'Current month (1-12)',
      'date.day': 'Current day of month',
      'date.weekday': 'Current day of the week',
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