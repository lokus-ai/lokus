/**
 * Integrated Template Processor
 *
 * Combines all template system components:
 * - Agent 1: SecureTemplateSandbox (sandbox.js)
 * - Agent 2: TemplatePrompts (prompts.js)
 * - Agent 3: Enhanced dates (dates.js)
 * - Agent 4: Conditionals and loops (conditionals.js, loops.js)
 * - Agent 5: Template inclusion (inclusion.js)
 * - Agent 6: Extended filters (filters.js)
 *
 * Processing order:
 * 1. Parse and show prompts (Agent 2)
 * 2. Collect user input
 * 3. Process includes (Agent 5)
 * 4. Process conditionals (Agent 4)
 * 5. Process loops (Agent 4)
 * 6. Process variables with filters
 * 7. Execute JavaScript blocks in sandbox (Agent 1)
 * 8. Final cleanup
 */

import { format } from 'date-fns';
import { TemplateSandbox } from './sandbox.js';
import { TemplatePrompts } from './prompts.js';
import { TemplateConditionals } from './conditionals.js';
import { TemplateLoops } from './loops.js';
import { TemplateInclusion } from './inclusion.js';
import { allFilters, getFilter, hasFilter } from './filters.js';
import { dateHelpers } from './dates.js';

export class IntegratedTemplateProcessor {
  constructor(options = {}) {
    // Initialize all subsystems
    this.sandbox = options.sandbox || new TemplateSandbox(options.sandboxOptions);
    this.prompts = new TemplatePrompts();
    this.conditionals = new TemplateConditionals(options.conditionalsOptions);
    this.loops = new TemplateLoops(options.loopsOptions);
    this.inclusion = options.inclusion; // Set from manager

    // Configuration
    this.strictMode = options.strictMode !== false;
    this.maxIterations = options.maxIterations || 100;
    this.enablePrompts = options.enablePrompts !== false;
    this.enableIncludes = options.enableIncludes !== false;
    this.enableConditionals = options.enableConditionals !== false;
    this.enableLoops = options.enableLoops !== false;
    this.enableFilters = options.enableFilters !== false;

    // Filter system
    this.filters = new Map();
    this.initializeFilters();

    // Performance tracking
    this.performanceTracking = options.performanceTracking || false;
  }

  /**
   * Initialize filter system with all built-in filters
   */
  initializeFilters() {
    // Register all filters from filters.js
    Object.entries(allFilters).forEach(([name, filterFn]) => {
      this.filters.set(name, filterFn);
    });

    // Add backward compatibility filters if not already present
    if (!this.filters.has('upper')) {
      this.filters.set('upper', (value) => String(value).toUpperCase());
    }
    if (!this.filters.has('lower')) {
      this.filters.set('lower', (value) => String(value).toLowerCase());
    }
  }

  /**
   * Main processing method - integrates all template features
   */
  async process(template, variables = {}, options = {}) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }

    const startTime = this.performanceTracking ? Date.now() : 0;
    const performanceMetrics = {};

    // Create a chainable date wrapper that allows method chaining
    const createChainableDate = (baseDate = new Date()) => {
      const chainedDate = baseDate instanceof Date ? baseDate : new Date(baseDate);

      return new Proxy(dateHelpers, {
        get(target, prop) {
          if (prop === 'toString' || prop === Symbol.toPrimitive || prop === 'valueOf') {
            // Return formatted date string instead of ISO
            return () => format(chainedDate, 'yyyy-MM-dd');
          }

          // If it's a function in dateHelpers
          if (typeof target[prop] === 'function') {
            const fn = target[prop];

            // Check if it's a zero-argument function (like tomorrow, yesterday, etc.)
            // These should be called immediately and return chainable dates
            if (fn.length === 0 && ['tomorrow', 'yesterday', 'today', 'now', 'nextWeek',
              'nextMonth', 'nextYear', 'lastWeek', 'lastMonth', 'lastYear'].includes(prop)) {
              const result = fn();
              return result instanceof Date ? createChainableDate(result) : result;
            }

            // For functions that need arguments, return a wrapper
            return function (...args) {
              // Special handling for format - use chainedDate as first arg
              if (prop === 'format') {
                const pattern = args.length === 0 ? 'yyyy-MM-dd' : args[0];
                try {
                  return fn(chainedDate, pattern);
                } catch (err) {
                  // Auto-correct common format token mistakes
                  const correctedPattern = pattern
                    .replace(/YYYY/g, 'yyyy')
                    .replace(/DD/g, 'dd')
                    .replace(/Do/g, 'do');
                  try {
                    return fn(chainedDate, correctedPattern);
                  } catch (retryErr) {
                    console.warn('Date format failed:', retryErr.message);
                    return `[Invalid date format: ${pattern}]`;
                  }
                }
              }

              // For methods that return dates (add, subtract, etc.), return chainable wrapper
              if (['add', 'subtract', 'addDays', 'addWeeks', 'addMonths', 'addYears',
                'subDays', 'subWeeks', 'subMonths', 'subYears',
                'startOfDay', 'startOfWeek', 'startOfMonth', 'startOfYear',
                'endOfDay', 'endOfWeek', 'endOfMonth', 'endOfYear',
                'nextMonday', 'nextTuesday', 'nextWednesday', 'nextThursday',
                'nextFriday', 'nextSaturday', 'nextSunday',
                'previousMonday', 'previousTuesday', 'previousWednesday',
                'previousThursday', 'previousFriday', 'previousSaturday', 'previousSunday'
              ].includes(prop)) {
                // These methods need the base date as first arg
                const result = fn(chainedDate, ...args);
                // Return chainable wrapper if result is a Date
                return result instanceof Date ? createChainableDate(result) : result;
              }

              // For other methods, call with chainedDate as context
              return fn(chainedDate, ...args);
            };
          }

          // For non-function properties, return as-is
          return target[prop];
        }
      });
    };

    // Create the main date proxy using current time
    const dateProxy = createChainableDate(new Date());

    const context = {
      variables: {
        ...variables,
        // Add date proxy to context if not provided
        date: variables.date || dateProxy
      },
      options: { ...options },
      strictMode: this.strictMode,
      iteration: 0
    };


    try {
      let processed = template;

      // Step 1: Handle prompts (if enabled and prompts exist)

      if (this.enablePrompts && this.prompts.hasPrompts(processed)) {
        const promptResults = await this.processPrompts(processed, context, options);
        processed = promptResults.template;

        // Preserve the date proxy when merging prompt results
        // Spreading destroys Proxy objects, so we extract it first
        const { date: dateProxyOriginal, ...otherVars } = context.variables;
        context.variables = {
          ...otherVars,
          ...promptResults.variables,
          date: dateProxyOriginal // Preserve the original proxy
        };

        performanceMetrics.prompts = promptResults.timing;
      } else {
      }

      // Step 2: Remove comments
      const commentsStart = Date.now();
      const beforeComments = processed;
      processed = this.removeComments(processed);
      performanceMetrics.comments = Date.now() - commentsStart;

      // Step 3: Process includes (if enabled)
      if (this.enableIncludes && this.inclusion && this.inclusion.hasIncludes(processed)) {
        const includesStart = Date.now();
        processed = await this.inclusion.process(processed, context.variables, {
          depth: 0,
          includeChain: []
        });
        performanceMetrics.includes = Date.now() - includesStart;
      }

      // Step 4: Process conditionals (if enabled)
      if (this.enableConditionals) {
        const conditionalsStart = Date.now();
        processed = this.conditionals.processTemplate(processed, context.variables);
        performanceMetrics.conditionals = Date.now() - conditionalsStart;
      }

      // Step 5: Process loops (if enabled)
      if (this.enableLoops) {
        const loopsStart = Date.now();
        processed = this.loops.processTemplate(processed, context.variables);
        performanceMetrics.loops = Date.now() - loopsStart;
      }

      // Step 6: Process JavaScript blocks
      const jsStart = Date.now();
      processed = await this.processJavaScriptBlocks(processed, context);
      performanceMetrics.javascript = Date.now() - jsStart;

      // Step 7: Process variables with filters
      const variablesStart = Date.now();
      processed = await this.processVariables(processed, context);
      performanceMetrics.variables = Date.now() - variablesStart;

      // Step 8: Validate final result
      this.validateResult(processed, template);

      const totalTime = this.performanceTracking ? Date.now() - startTime : 0;


      return {
        result: processed,
        variables: context.variables,
        metadata: {
          iterations: context.iteration,
          hasUnresolvedVariables: this.hasUnresolvedVariables(processed),
          performance: {
            ...performanceMetrics,
            total: totalTime
          }
        }
      };
    } catch (error) {
      throw new Error(`Template processing failed: ${error.message}`);
    }
  }

  /**
   * Process prompts and collect user input
   */
  async processPrompts(template, context, options) {
    const startTime = Date.now();


    // Extract prompts
    const prompts = this.prompts.parsePrompts(template);

    if (prompts.length === 0) {
      return { template, variables: {}, timing: Date.now() - startTime };
    }

    // Get values from options or use defaults
    let values = {};
    if (options.promptValues) {
      values = options.promptValues;
    } else if (options.promptHandler) {
      // Allow custom prompt handler
      values = await options.promptHandler(prompts);
    } else {
      // Use default values from prompts
      for (const prompt of prompts) {
        values[prompt.varName] = prompt.defaultValue;
      }
    }

    // Replace prompts in template
    const processedTemplate = this.prompts.replacePrompts(template, values);

    return {
      template: processedTemplate,
      variables: values,
      timing: Date.now() - startTime
    };
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
   * Process variable substitutions with filter support
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
        const variableExpression = rawExpression.trim() || rawExpression;

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
   * Resolve a single variable expression with filters
   */
  async resolveVariable(expression, context) {
    // Parse: variable || 'default' | filter1(args) | filter2(args)
    const defaultMatch = expression.match(/^([^|]+)\s*\|\|\s*([^|]+)(.*)$/);
    let variableName, defaultValue, filterPart;

    if (defaultMatch) {
      variableName = defaultMatch[1].trim();
      defaultValue = defaultMatch[2].trim().replace(/^['"]|['"]$/g, '');
      filterPart = defaultMatch[3];
    } else {
      const parts = expression.split('|');
      variableName = parts[0].trim();
      defaultValue = null;
      filterPart = parts.slice(1).join('|');
    }

    // Parse filters
    const filters = filterPart
      ? this.parseFilters(filterPart)
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
    for (const filterInfo of filters) {
      value = await this.applyFilter(filterInfo.name, filterInfo.args, value, context);
    }

    return value;
  }

  /**
   * Parse filters with arguments
   * Examples:
   *   - "upper" -> { name: "upper", args: {} }
   *   - "truncate(20)" -> { name: "truncate", args: { 0: 20 } }
   *   - "format('$0,0.00')" -> { name: "format", args: { 0: "$0,0.00" } }
   */
  parseFilters(filterPart) {
    const filters = [];
    const filterStrings = filterPart.split('|').map(f => f.trim()).filter(f => f.length > 0);

    for (const filterStr of filterStrings) {
      // Check for arguments: filterName(arg1, arg2, ...)
      const match = filterStr.match(/^(\w+)(?:\(([^)]*)\))?$/);

      if (!match) {
        filters.push({ name: filterStr, args: {} });
        continue;
      }

      const name = match[1];
      const argsStr = match[2];
      const args = {};

      if (argsStr) {
        // Parse arguments
        const argList = this.parseFilterArguments(argsStr);
        argList.forEach((arg, index) => {
          args[index] = arg;
          // Also support named access for common parameters
          if (index === 0) args.value = arg;
          if (index === 0) args.length = arg;
          if (index === 0) args.pattern = arg;
          if (index === 0) args.count = arg;
          if (index === 0) args.decimals = arg;
          if (index === 0) args.separator = arg;
          if (index === 0) args.start = arg;
          if (index === 1) args.end = arg;
          if (index === 1) args.char = arg;
          if (index === 1) args.suffix = arg;
        });
      }

      filters.push({ name, args });
    }

    return filters;
  }

  /**
   * Parse filter arguments from string
   */
  parseFilterArguments(argsStr) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < argsStr.length; i++) {
      const char = argsStr[i];

      if ((char === '"' || char === "'") && (i === 0 || argsStr[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        current += char;
      } else if (char === ',' && !inQuotes) {
        args.push(this.parseArgValue(current.trim()));
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      args.push(this.parseArgValue(current.trim()));
    }

    return args;
  }

  /**
   * Parse a single argument value
   */
  parseArgValue(value) {
    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
      return value.slice(1, -1);
    }

    // Parse numbers
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return parseFloat(value);
    }

    // Parse booleans
    if (value === 'true') return true;
    if (value === 'false') return false;
    if (value === 'null') return null;
    if (value === 'undefined') return undefined;

    return value;
  }

  /**
   * Apply filter to value
   */
  async applyFilter(filterName, args, value, context) {
    const filter = this.filters.get(filterName);
    if (!filter) {
      if (this.strictMode) {
        throw new Error(`Unknown filter: ${filterName}`);
      }
      return value;
    }

    try {
      // Call filter with value and args
      return await filter(value, args);
    } catch (error) {
      if (this.strictMode) {
        throw new Error(`Filter '${filterName}' failed: ${error.message}`);
      }
      return value;
    }
  }

  /**
   * Get variable value (supports dot notation)
   */
  getVariableValue(path, variables) {
    if (!path) return undefined;

    console.log('[getVariableValue] Resolving path:', path);
    console.log('[getVariableValue] Variables keys:', Object.keys(variables));

    const keys = path.split('.');
    let value = variables;

    console.log('[getVariableValue] Split into keys:', keys);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      console.log(`[getVariableValue] Processing key [${i}]:`, key);
      console.log(`[getVariableValue] Current value type:`, typeof value);
      console.log(`[getVariableValue] Current value:`, value);

      if (value === null || value === undefined) {
        console.log('[getVariableValue] Value is null/undefined, returning undefined');
        return undefined;
      }

      // Check if this is a method call: format('YYYY-MM-DD')
      const methodMatch = key.match(/^(\w+)\((.*)\)$/);

      if (methodMatch) {
        const methodName = methodMatch[1];
        const argsString = methodMatch[2];
        console.log(`[getVariableValue] Detected method call: ${methodName}(${argsString})`);

        // Parse arguments
        const args = [];
        if (argsString.trim()) {
          // Simple argument parsing - handles strings and numbers
          const argMatches = argsString.match(/(?:[^,'"]+|'[^']*'|"[^"]*")+/g) || [];
          for (const arg of argMatches) {
            const trimmed = arg.trim();
            // Remove quotes from string arguments
            if ((trimmed.startsWith("'") && trimmed.endsWith("'")) ||
              (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
              args.push(trimmed.slice(1, -1));
            } else if (!isNaN(trimmed)) {
              args.push(Number(trimmed));
            } else {
              args.push(trimmed);
            }
          }
        }
        console.log(`[getVariableValue] Parsed args:`, args);

        // Call the method
        console.log(`[getVariableValue] Checking if value[${methodName}] is a function:`, typeof value[methodName]);
        if (typeof value[methodName] === 'function') {
          console.log(`[getVariableValue] Calling ${methodName} with args:`, args);
          value = value[methodName](...args);
          console.log(`[getVariableValue] Method returned:`, value);
        } else {
          console.log(`[getVariableValue] Method ${methodName} not found, returning undefined`);
          return undefined;
        }
      } else {
        // Regular property access
        console.log(`[getVariableValue] Regular property access: ${key}`);
        value = value[key];
        console.log(`[getVariableValue] Property value:`, value);
      }
    }

    console.log('[getVariableValue] Final value:', value);
    return value;
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

    const unresolvedCount = (result.match(/\{\{[^}]+\}\}/g) || []).length;
    const originalUnresolvedCount = (original.match(/\{\{[^}]+\}\}/g) || []).length;

    if (this.strictMode && unresolvedCount > 0 && unresolvedCount === originalUnresolvedCount) {
      const unresolved = result.match(/\{\{[^}]+\}\}/g);
      throw new Error(`Unresolved variables: ${unresolved.join(', ')}`);
    }
  }

  /**
   * Preview template processing (dry run)
   */
  async preview(template, variables = {}) {
    const processor = new IntegratedTemplateProcessor({
      strictMode: false,
      sandbox: { dryRun: true },
      performanceTracking: true
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
   * Analyze template complexity and features
   */
  async analyze(template, variables = {}) {
    const startTime = Date.now();

    try {
      // Analyze features used
      const features = {
        prompts: this.prompts.hasPrompts(template),
        includes: this.inclusion ? this.inclusion.hasIncludes(template) : false,
        conditionals: /\{\{#if\s+/.test(template),
        loops: /\{\{#each\s+/.test(template),
        javascript: /<%\s*[\s\S]*?\s*%>/.test(template),
        variables: /\{\{[^#/][^}]*\}\}/.test(template)
      };

      // Get statistics from subsystems
      const conditionalsStats = this.conditionals.getStatistics(template);
      const loopsStats = this.loops.getStatistics(template);
      const promptsStats = this.prompts.getStatistics(template);

      // Process template
      const result = await this.process(template, variables);
      const endTime = Date.now();

      return {
        success: true,
        processingTime: endTime - startTime,
        originalLength: template.length,
        processedLength: result.result.length,
        variablesUsed: Object.keys(variables).length,
        iterations: result.metadata.iterations,
        hasUnresolved: result.metadata.hasUnresolvedVariables,
        features,
        statistics: {
          conditionals: conditionalsStats,
          loops: loopsStats,
          prompts: promptsStats
        }
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

  /**
   * Validate template syntax
   */
  validate(template) {
    const errors = [];
    const warnings = [];

    // Validate each subsystem
    if (this.enableConditionals) {
      const conditionalsValidation = this.conditionals.validate(template);
      errors.push(...conditionalsValidation.errors);
      warnings.push(...conditionalsValidation.warnings);
    }

    if (this.enableLoops) {
      const loopsValidation = this.loops.validate(template);
      errors.push(...loopsValidation.errors);
      warnings.push(...loopsValidation.warnings);
    }

    if (this.enablePrompts) {
      const promptsValidation = this.prompts.validate(template);
      errors.push(...promptsValidation.errors);
      warnings.push(...promptsValidation.warnings);
    }

    if (this.enableIncludes && this.inclusion) {
      const includesValidation = this.inclusion.validate(template);
      errors.push(...includesValidation.errors);
      warnings.push(...includesValidation.warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export for backward compatibility with existing processor
export class TemplateProcessor extends IntegratedTemplateProcessor {
  constructor(options = {}) {
    super(options);
  }
}

export default IntegratedTemplateProcessor;
