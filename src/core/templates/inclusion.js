/**
 * Template Inclusion System
 *
 * Handles template inclusion with variable passing and circular dependency prevention
 * Syntax: {{include:template-name}} or {{include:template-name:var1=value1,var2=value2}}
 */

export class TemplateInclusion {
  constructor(options = {}) {
    this.templateManager = options.templateManager;
    this.maxDepth = options.maxDepth || 10;
    this.maxInclusions = options.maxInclusions || 50;
    this.strictMode = options.strictMode !== false;

    // Pattern to match include syntax
    // Matches: {{include:template-name}} or {{include:template-name:var1=value1,var2=value2}}
    this.includePattern = /\{\{include:([^:}]+)(?::([^}]+))?\}\}/g;
  }

  /**
   * Process all template inclusions in content
   */
  async process(content, variables = {}, context = {}) {
    if (!content || typeof content !== 'string') {
      throw new Error('Content must be a non-empty string');
    }

    if (!this.templateManager) {
      throw new Error('Template manager not configured');
    }

    const processingContext = {
      ...context,
      depth: (context.depth || 0) + 1,
      stats: context.stats || { inclusionCount: 0 },
      includeChain: context.includeChain || [],
      variables: { ...variables }
    };

    // Check recursion depth
    if (processingContext.depth > this.maxDepth) {
      throw new Error(`Maximum inclusion depth (${this.maxDepth}) exceeded`);
    }

    // Check total inclusions
    if (processingContext.stats.inclusionCount >= this.maxInclusions) {
      throw new Error(`Maximum number of inclusions (${this.maxInclusions}) exceeded`);
    }

    // Process all includes
    let result = content;
    let hasIncludes = true;
    let iterations = 0;
    const maxIterations = this.maxInclusions;

    while (hasIncludes && iterations < maxIterations) {
      hasIncludes = false;
      iterations++;

      // Find all includes in current content
      const includes = this.extractIncludes(result);

      if (includes.length === 0) {
        break;
      }

      let madeProgress = false;

      // Process each include
      for (const include of includes) {
        try {
          // Check for circular dependency
          if (processingContext.includeChain.includes(include.templateId)) {
            const chain = [...processingContext.includeChain, include.templateId].join(' -> ');
            throw new Error(`Circular include detected: ${chain}`);
          }

          // Resolve the included template
          const included = await this.resolveInclude(include, processingContext);

          // Replace include with resolved content
          if (included !== include.fullMatch) {
            if (processingContext.stats.inclusionCount >= this.maxInclusions) {
              throw new Error(`Maximum number of inclusions (${this.maxInclusions}) exceeded`);
            }

            result = result.replace(include.fullMatch, included);
            hasIncludes = true;
            madeProgress = true;
            processingContext.stats.inclusionCount++;
          }
        } catch (error) {
          if (this.strictMode) {
            throw new Error(`Include failed for '${include.templateId}': ${error.message}`);
          }
          // In non-strict mode, leave the include as-is
        }
      }

      // If no progress was made (e.g., all includes failed in non-strict mode), break the loop
      if (!madeProgress) {
        break;
      }

      // Reset regex state
      this.includePattern.lastIndex = 0;
    }

    if (iterations >= maxIterations && hasIncludes) {
      throw new Error('Maximum include processing iterations exceeded - possible circular reference');
    }

    return result;
  }

  /**
   * Extract all include directives from content
   */
  extractIncludes(content) {
    const includes = [];
    let match;

    this.includePattern.lastIndex = 0;

    while ((match = this.includePattern.exec(content)) !== null) {
      const fullMatch = match[0];
      const templateId = match[1].trim();
      const variablesString = match[2] ? match[2].trim() : '';

      includes.push({
        fullMatch,
        templateId,
        variablesString,
        variables: this.parseVariables(variablesString),
        position: match.index
      });
    }

    return includes;
  }

  /**
   * Parse variable assignments from include directive
   * Format: var1=value1,var2=value2,var3="quoted value"
   */
  parseVariables(variablesString) {
    if (!variablesString) {
      return {};
    }

    const variables = {};

    // Split by comma, but respect quoted values
    const pairs = this.splitVariables(variablesString);

    for (const pair of pairs) {
      const equalIndex = pair.indexOf('=');
      if (equalIndex === -1) continue;

      const key = pair.substring(0, equalIndex).trim();
      let value = pair.substring(equalIndex + 1).trim();

      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      // Try to parse as number or boolean
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else if (!isNaN(value) && value !== '') {
        value = Number(value);
      }

      variables[key] = value;
    }

    return variables;
  }

  /**
   * Split variables string by comma, respecting quotes
   */
  splitVariables(str) {
    const parts = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = null;

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
        current += char;
      } else if (char === ',' && !inQuotes) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
      } else {
        current += char;
      }
    }

    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts;
  }

  /**
   * Resolve a single include directive
   */
  async resolveInclude(include, context) {
    // Get the template
    const template = this.templateManager.read(include.templateId);

    if (!template) {
      if (this.strictMode) {
        throw new Error(`Template '${include.templateId}' not found`);
      }
      return include.fullMatch; // Leave as-is in non-strict mode
    }

    // Merge variables: context variables + include-specific variables
    const mergedVariables = {
      ...context.variables,
      ...include.variables
    };

    // Create new context for recursive processing - don't increment depth here
    // as it was already incremented in the main process function
    const newContext = {
      depth: context.depth + 1,
      includeChain: [...context.includeChain, include.templateId],
      stats: context.stats,
      variables: mergedVariables
    };

    // Check depth before recursing
    if (newContext.depth > this.maxDepth) {
      throw new Error(`Maximum inclusion depth (${this.maxDepth}) exceeded`);
    }

    let processed = template.content;

    // 1. Process variables first if template manager has process method
    // This ensures variables are resolved before we look for nested includes
    if (this.templateManager.process) {
      try {
        const result = await this.templateManager.process(include.templateId, mergedVariables, {
          processIncludes: false // Don't reprocess includes yet
        });
        processed = result.result || processed;
      } catch (error) {
        // If processing fails, continue with raw content
      }
    }

    // 2. Process nested includes (recursively)
    if (this.hasIncludes(processed)) {
      processed = await this.process(processed, mergedVariables, {
        ...newContext,
        depth: newContext.depth - 1 // Don't double-count depth
      });
    }

    return processed;
  }

  /**
   * Check if content has any include directives
   */
  hasIncludes(content) {
    this.includePattern.lastIndex = 0;
    return this.includePattern.test(content);
  }

  /**
   * Validate include syntax in content
   */
  validate(content) {
    const errors = [];
    const warnings = [];

    try {
      const includes = this.extractIncludes(content);

      // Check for malformed includes
      const malformedPattern = /\{\{include:[^}]*$/g;
      if (malformedPattern.test(content)) {
        errors.push('Malformed include directives detected');
      }

      // Check for duplicate includes
      const templateIds = includes.map(inc => inc.templateId);
      const duplicates = templateIds.filter((id, index) => templateIds.indexOf(id) !== index);
      if (duplicates.length > 0) {
        warnings.push(`Duplicate includes detected: ${[...new Set(duplicates)].join(', ')}`);
      }

      // Check for potentially circular references (same template included)
      const uniqueIds = new Set(templateIds);
      if (uniqueIds.size !== templateIds.length) {
        warnings.push('Multiple includes of the same template may cause performance issues');
      }

      // Warn if too many includes
      if (includes.length > 20) {
        warnings.push(`Template contains many includes (${includes.length}), consider simplifying`);
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        includes: includes.length
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return {
        valid: false,
        errors,
        warnings
      };
    }
  }

  /**
   * Preview include resolution (dry run)
   */
  async preview(content, variables = {}) {
    try {
      const includes = this.extractIncludes(content);
      const previews = [];

      for (const include of includes) {
        const template = this.templateManager.read(include.templateId);

        previews.push({
          include: include.fullMatch,
          templateId: include.templateId,
          variables: include.variables,
          found: !!template,
          templateContent: template ? template.content.substring(0, 200) + '...' : null
        });
      }

      return {
        hasIncludes: includes.length > 0,
        includeCount: includes.length,
        includes: previews
      };
    } catch (error) {
      return {
        error: error.message,
        preview: true
      };
    }
  }

  /**
   * Get statistics about includes in content
   */
  getStatistics(content) {
    const includes = this.extractIncludes(content);
    const templateIds = includes.map(inc => inc.templateId);

    return {
      total: includes.length,
      unique: new Set(templateIds).size,
      withVariables: includes.filter(inc => Object.keys(inc.variables).length > 0).length,
      templates: Array.from(new Set(templateIds))
    };
  }
}

export default TemplateInclusion;
