/**
 * Template Processor
 * 
 * Processes templates by substituting variables and executing JavaScript blocks
 */

import { TemplateSandbox } from './sandbox.js';

export class TemplateProcessor {
  constructor(options = {}) {
    this.sandbox = new TemplateSandbox(options.sandbox);
    this.filters = new Map();
    this.strictMode = options.strictMode !== false;
    this.maxIterations = options.maxIterations || 100;
    
    this.initializeBuiltinFilters();
  }

  /**
   * Process template with given variables
   */
  async process(template, variables = {}, options = {}) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }

    const context = {
      variables: { ...variables },
      options: { ...options },
      strictMode: this.strictMode,
      iteration: 0
    };

    try {
      // First pass: remove comments
      let processed = this.removeComments(template);
      
      // Process JavaScript blocks first (they might generate variables)
      processed = await this.processJavaScriptBlocks(processed, context);
      
      // Then process variables
      processed = await this.processVariables(processed, context);
      
      // Validate final result
      this.validateResult(processed, template);
      
      return {
        result: processed,
        variables: context.variables,
        metadata: {
          iterations: context.iteration,
          hasUnresolvedVariables: this.hasUnresolvedVariables(processed),
          performance: context.performance || {}
        }
      };
    } catch (error) {
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Remove comment blocks from template
   */
  removeComments(template) {
    return template.replace(/<%#[\s\S]*?%>/g, '');
  }

  /**
   * Process JavaScript execution blocks
   */
  async processJavaScriptBlocks(template, context) {
    const jsBlockPattern = /<%\s*([\s\S]*?)\s*%>/g;
    let result = template;
    let match;
    
    const replacements = [];
    
    while ((match = jsBlockPattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const code = match[1].trim();
      
      try {
        const output = await this.sandbox.execute(code, context.variables);
        replacements.push({
          fullMatch,
          replacement: output !== undefined ? String(output) : ''
        });
      } catch (error) {
        if (this.strictMode) {
          throw new Error(`JavaScript execution failed: ${error.message}`);
        }
        // In non-strict mode, leave the block as-is
        replacements.push({
          fullMatch,
          replacement: fullMatch
        });
      }
    }
    
    // Apply replacements
    for (const { fullMatch, replacement } of replacements) {
      result = result.replace(fullMatch, replacement);
    }
    
    return result;
  }

  /**
   * Process variable substitutions
   */
  async processVariables(template, context) {
    const variablePattern = /\{\{([^}]+)\}\}/g;
    let result = template;
    let hasChanges = true;
    
    while (hasChanges && context.iteration < this.maxIterations) {
      hasChanges = false;
      context.iteration++;
      
      const replacements = [];
      let match;
      
      while ((match = variablePattern.exec(result)) !== null) {
        const fullMatch = match[0];
        const rawExpression = match[1];
        const variableExpression = rawExpression.trim() || rawExpression; // Preserve whitespace if trim results in empty string
        
        try {
          const value = await this.resolveVariable(variableExpression, context);
          if (value !== fullMatch) {
            replacements.push({
              fullMatch,
              replacement: String(value)
            });
            hasChanges = true;
          }
        } catch (error) {
          if (this.strictMode) {
            throw new Error(`Variable resolution failed for '${variableExpression}': ${error.message}`);
          }
          // In non-strict mode, leave unresolved variables as-is
        }
      }
      
      // Reset regex
      variablePattern.lastIndex = 0;
      
      // Apply replacements
      for (const { fullMatch, replacement } of replacements) {
        result = result.replace(fullMatch, replacement);
      }
    }
    
    if (context.iteration >= this.maxIterations) {
      throw new Error('Maximum template processing iterations exceeded - possible circular reference');
    }
    
    return result;
  }

  /**
   * Resolve a single variable expression
   */
  async resolveVariable(expression, context) {
    // Parse variable expression: name || 'default' | filter1 | filter2
    // First check for default value syntax: variable || 'default'
    const defaultMatch = expression.match(/^([^|]+)\s*\|\|\s*([^|]+)(.*)$/);
    let variableName, defaultValue, filterPart;

    if (defaultMatch) {
      variableName = defaultMatch[1].trim();
      defaultValue = defaultMatch[2].trim().replace(/^['"]|['"]$/g, '');
      filterPart = defaultMatch[3]; // Remaining filters after default value
    } else {
      // No default value, split by single |
      const parts = expression.split('|');
      variableName = parts[0].trim();
      defaultValue = null;
      filterPart = parts.slice(1).join('|'); // Join remaining parts for filters
    }

    // Parse filters from the filter part
    const filters = filterPart 
      ? filterPart.split('|').map(f => f.trim()).filter(f => f.length > 0)
      : [];
    
    // Get variable value
    let value = this.getVariableValue(variableName, context.variables);
    
    // Use default if variable is undefined/null
    if (value === undefined || value === null) {
      if (defaultValue !== null) {
        value = defaultValue;
      } else if (this.strictMode) {
        throw new Error(`Variable '${variableName}' is not defined`);
      } else {
        return `{{${expression}}}`;
      }
    }
    
    // Apply filters
    for (const filterName of filters) {
      value = await this.applyFilter(filterName, value, context);
    }
    
    return value;
  }

  /**
   * Get variable value (supports dot notation)
   */
  getVariableValue(path, variables) {
    if (!path) return undefined;
    
    const keys = path.split('.');
    let value = variables;
    
    for (const key of keys) {
      if (value === null || value === undefined) {
        return undefined;
      }
      value = value[key];
    }
    
    return value;
  }

  /**
   * Apply filter to value
   */
  async applyFilter(filterName, value, context) {
    const filter = this.filters.get(filterName);
    if (!filter) {
      if (this.strictMode) {
        throw new Error(`Unknown filter: ${filterName}`);
      }
      return value;
    }
    
    try {
      return await filter(value, context);
    } catch (error) {
      if (this.strictMode) {
        throw new Error(`Filter '${filterName}' failed: ${error.message}`);
      }
      return value;
    }
  }

  /**
   * Initialize built-in filters
   */
  initializeBuiltinFilters() {
    // String filters
    this.filters.set('upper', (value) => String(value).toUpperCase());
    this.filters.set('lower', (value) => String(value).toLowerCase());
    this.filters.set('trim', (value) => String(value).trim());
    this.filters.set('capitalize', (value) => {
      const str = String(value);
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });
    
    // Number filters
    this.filters.set('round', (value) => Math.round(Number(value)));
    this.filters.set('floor', (value) => Math.floor(Number(value)));
    this.filters.set('ceil', (value) => Math.ceil(Number(value)));
    
    // Date filters
    this.filters.set('date', (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleDateString();
    });
    this.filters.set('time', (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleTimeString();
    });
    this.filters.set('datetime', (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return date.toLocaleString();
    });
    this.filters.set('iso', (value) => {
      const date = value instanceof Date ? value : new Date(value);
      return date.toISOString();
    });
    
    // Array filters
    this.filters.set('join', (value, context) => {
      const separator = context.options.separator || ', ';
      return Array.isArray(value) ? value.join(separator) : String(value);
    });
    this.filters.set('length', (value) => {
      if (Array.isArray(value) || typeof value === 'string') {
        return value.length;
      }
      return 0;
    });
    
    // JSON filters
    this.filters.set('json', (value) => JSON.stringify(value));
    this.filters.set('pretty', (value) => JSON.stringify(value, null, 2));
    
    // Encoding filters
    this.filters.set('encode', (value) => encodeURIComponent(String(value)));
    this.filters.set('decode', (value) => decodeURIComponent(String(value)));
    
    // Default filter
    this.filters.set('default', (value, context) => {
      return value !== undefined && value !== null ? value : context.options.defaultValue || '';
    });
  }

  /**
   * Register custom filter
   */
  registerFilter(name, filterFunction) {
    if (typeof filterFunction !== 'function') {
      throw new Error('Filter must be a function');
    }
    this.filters.set(name, filterFunction);
  }

  /**
   * Remove filter
   */
  removeFilter(name) {
    return this.filters.delete(name);
  }

  /**
   * Get all registered filters
   */
  getFilters() {
    return Array.from(this.filters.keys());
  }

  /**
   * Check if template has unresolved variables
   */
  hasUnresolvedVariables(template) {
    return /\{\{[^}]+\}\}/.test(template);
  }

  /**
   * Validate processing result
   */
  validateResult(result, original) {
    if (typeof result !== 'string') {
      throw new Error('Processing result must be a string');
    }
    
    // Check for circular references in output
    const unresolvedCount = (result.match(/\{\{[^}]+\}\}/g) || []).length;
    const originalUnresolvedCount = (original.match(/\{\{[^}]+\}\}/g) || []).length;
    
    if (this.strictMode && unresolvedCount > 0 && unresolvedCount === originalUnresolvedCount) {
      // If in strict mode and we still have the same number of unresolved variables,
      // it might indicate an issue
      const unresolved = result.match(/\{\{[^}]+\}\}/g);
      throw new Error(`Unresolved variables: ${unresolved.join(', ')}`);
    }
  }

  /**
   * Preview template processing (dry run)
   */
  async preview(template, variables = {}) {
    const processor = new TemplateProcessor({
      strictMode: false,
      sandbox: { dryRun: true }
    });
    
    try {
      const result = await processor.process(template, variables);
      return {
        ...result,
        preview: true
      };
    } catch (error) {
      return {
        error: error.message,
        preview: true
      };
    }
  }

  /**
   * Get processing statistics
   */
  async analyze(template, variables = {}) {
    const startTime = Date.now();
    
    try {
      const result = await this.process(template, variables);
      const endTime = Date.now();
      
      return {
        success: true,
        processingTime: endTime - startTime,
        originalLength: template.length,
        processedLength: result.result.length,
        variablesUsed: Object.keys(variables).length,
        iterations: result.metadata.iterations,
        hasUnresolved: result.metadata.hasUnresolvedVariables
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        error: error.message,
        processingTime: endTime - startTime
      };
    }
  }
}

export default TemplateProcessor;