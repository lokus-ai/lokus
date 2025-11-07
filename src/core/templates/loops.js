/**
 * Template Loops
 *
 * Handles loop logic in templates for iterating over arrays and objects
 * Syntax: {{#each array}}...{{/each}}
 * Special variables: {{@index}}, {{@key}}, {{@first}}, {{@last}}
 */

export class TemplateLoops {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.maxNestingDepth = options.maxNestingDepth || 10;
    this.maxIterations = options.maxIterations || 10000;
  }

  /**
   * Find all loop blocks in template
   * Returns array of loop blocks with their positions and content
   */
  findLoopBlocks(template) {
    const blocks = [];
    const stack = [];

    // Pattern to match: {{#each variable}}, {{/each}}
    const pattern = /\{\{#each\s+([^}]+)\}\}|\{\{\/each\}\}/g;
    let match;

    while ((match = pattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const position = match.index;

      if (fullMatch.startsWith('{{#each')) {
        // Start of new loop block
        const arrayPath = match[1].trim();
        stack.push({
          type: 'each',
          arrayPath,
          startPos: position,
          endPos: position + fullMatch.length,
          depth: stack.length
        });
      } else if (fullMatch === '{{/each}}') {
        // End of loop block
        if (stack.length === 0) {
          throw new Error(`Unexpected {{/each}} at position ${position}`);
        }

        const currentBlock = stack.pop();
        currentBlock.closePos = position;
        currentBlock.closeEndPos = position + fullMatch.length;
        currentBlock.content = template.substring(currentBlock.endPos, position);
        currentBlock.fullContent = template.substring(currentBlock.startPos, currentBlock.closeEndPos);

        // If this is a top-level block, add to results
        if (stack.length === 0) {
          blocks.push(currentBlock);
        }
      }
    }

    if (stack.length > 0) {
      throw new Error(`Unclosed loop block starting at position ${stack[0].startPos}`);
    }

    return blocks;
  }

  /**
   * Parse a loop declaration
   * Supports: {{#each items}}, {{#each items as item}}
   */
  parseLoop(loopString) {
    if (!loopString || typeof loopString !== 'string') {
      throw new Error('Loop declaration must be a non-empty string');
    }

    const trimmed = loopString.trim();

    // Check for 'as' syntax: items as item
    const asMatch = trimmed.match(/^(.+?)\s+as\s+(\w+)$/);
    if (asMatch) {
      return {
        arrayPath: asMatch[1].trim(),
        itemAlias: asMatch[2].trim()
      };
    }

    // Simple syntax: just the array path
    return {
      arrayPath: trimmed,
      itemAlias: null
    };
  }

  /**
   * Get variable value with dot notation support
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
   * Process loop variables in content
   * Handles {{this}}, {{this.property}}, {{@index}}, {{@key}}, etc.
   */
  processLoopContent(content, item, index, array, itemAlias = null) {
    let result = content;

    // Create loop context
    const loopContext = {
      '@index': index,
      '@first': index === 0,
      '@last': index === array.length - 1,
      '@length': array.length
    };

    // For object iteration, add @key
    if (typeof item === 'object' && !Array.isArray(item) && item !== null) {
      loopContext['@key'] = index;
    }

    // Replace special loop variables first
    result = result.replace(/\{\{(@\w+)\}\}/g, (match, varName) => {
      if (varName in loopContext) {
        return String(loopContext[varName]);
      }
      return match;
    });

    // Handle {{@index + 1}} and similar expressions
    result = result.replace(/\{\{(@\w+)\s*([+\-*/])\s*(\d+)\}\}/g, (match, varName, operator, operand) => {
      if (varName in loopContext) {
        const value = loopContext[varName];
        const num = Number(operand);

        if (typeof value === 'number') {
          switch (operator) {
            case '+': return String(value + num);
            case '-': return String(value - num);
            case '*': return String(value * num);
            case '/': return String(value / num);
            default: return match;
          }
        }
      }
      return match;
    });

    // Replace {{this}} with the entire item
    if (typeof item === 'object' && item !== null) {
      // Don't replace {{this.property}} yet, just {{this}}
      result = result.replace(/\{\{this\}\}/g, JSON.stringify(item));
    } else {
      result = result.replace(/\{\{this\}\}/g, String(item));
    }

    // Replace {{this.property}} with item properties
    result = result.replace(/\{\{this\.([^}]+)\}\}/g, (match, property) => {
      if (typeof item === 'object' && item !== null) {
        const value = this.getVariableValue(property, item);
        if (value !== undefined && value !== null) {
          return String(value);
        }
      }
      return match;
    });

    // If an alias was specified, replace {{alias}} and {{alias.property}}
    if (itemAlias) {
      // Replace {{alias.property}}
      const aliasPattern = new RegExp(`\\{\\{${itemAlias}\\.([^}]+)\\}\\}`, 'g');
      result = result.replace(aliasPattern, (match, property) => {
        if (typeof item === 'object' && item !== null) {
          const value = this.getVariableValue(property, item);
          if (value !== undefined && value !== null) {
            return String(value);
          }
        }
        return match;
      });

      // Replace {{alias}}
      const aliasSinglePattern = new RegExp(`\\{\\{${itemAlias}\\}\\}`, 'g');
      if (typeof item === 'object' && item !== null) {
        result = result.replace(aliasSinglePattern, JSON.stringify(item));
      } else {
        result = result.replace(aliasSinglePattern, String(item));
      }
    }

    return result;
  }

  /**
   * Process a single loop block
   */
  processLoop(block, variables) {
    // Parse the loop declaration
    const loopInfo = this.parseLoop(block.arrayPath);

    // Get the array to iterate over
    const array = this.getVariableValue(loopInfo.arrayPath, variables);

    // Handle non-array values
    if (array === undefined || array === null) {
      if (this.strictMode) {
        throw new Error(`Variable '${loopInfo.arrayPath}' is not defined`);
      }
      return ''; // Return empty string in non-strict mode
    }

    // Convert to array if needed
    let iterableArray;
    if (Array.isArray(array)) {
      iterableArray = array;
    } else if (typeof array === 'object') {
      // Convert object to array of [key, value] pairs
      iterableArray = Object.entries(array).map(([key, value]) => ({
        key,
        value,
        ...value
      }));
    } else {
      // Single value, treat as array of one
      iterableArray = [array];
    }

    // Check max iterations
    if (iterableArray.length > this.maxIterations) {
      throw new Error(`Loop iteration count (${iterableArray.length}) exceeds maximum (${this.maxIterations})`);
    }

    // Handle empty array
    if (iterableArray.length === 0) {
      return '';
    }

    // Process each iteration
    const results = [];
    for (let i = 0; i < iterableArray.length; i++) {
      const item = iterableArray[i];
      const processed = this.processLoopContent(
        block.content,
        item,
        i,
        iterableArray,
        loopInfo.itemAlias
      );
      results.push(processed);
    }

    return results.join('');
  }

  /**
   * Process all loop blocks in a template
   */
  processTemplate(template, variables) {
    if (typeof template !== 'string') {
      throw new Error('Template must be a string');
    }

    // Allow empty templates
    if (template === '') {
      return '';
    }

    try {
      // Process recursively to handle nested loops
      let result = template;
      let hasChanges = true;
      let iterations = 0;
      const maxIterations = 50; // Prevent infinite loops

      while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;

        // Find all loop blocks (outermost first)
        const blocks = this.findLoopBlocks(result);

        if (blocks.length === 0) {
          break;
        }

        // Process from end to start to maintain positions
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i];

          // Check nesting depth
          if (block.depth >= this.maxNestingDepth) {
            throw new Error(`Loop nesting depth exceeds maximum (${this.maxNestingDepth})`);
          }

          const replacement = this.processLoop(block, variables);

          result = result.substring(0, block.startPos) +
                  replacement +
                  result.substring(block.closeEndPos);
          hasChanges = true;
        }
      }

      if (iterations >= maxIterations) {
        throw new Error('Maximum loop processing iterations exceeded');
      }

      return result;
    } catch (error) {
      if (this.strictMode) {
        throw new Error(`Loop processing failed: ${error.message}`);
      }
      return template; // Return original template on error in non-strict mode
    }
  }

  /**
   * Process nested loops recursively
   * This is called internally when processing loops that contain other loops
   */
  processNestedTemplate(template, variables, currentDepth = 0) {
    if (currentDepth >= this.maxNestingDepth) {
      throw new Error('Maximum loop nesting depth exceeded');
    }

    // Check if there are any loops in this template
    const blocks = this.findLoopBlocks(template);
    if (blocks.length === 0) {
      return template;
    }

    // Process each block
    let result = template;
    for (let i = blocks.length - 1; i >= 0; i--) {
      const block = blocks[i];
      const replacement = this.processLoop(block, variables);
      result = result.substring(0, block.startPos) +
              replacement +
              result.substring(block.closeEndPos);
    }

    return result;
  }

  /**
   * Validate loop syntax in template
   */
  validate(template) {
    const errors = [];
    const warnings = [];

    try {
      const blocks = this.findLoopBlocks(template);

      // Check nesting depth
      for (const block of blocks) {
        if (block.depth >= this.maxNestingDepth) {
          warnings.push(`Loop nesting depth (${block.depth}) exceeds recommended maximum`);
        }

        // Check for empty array path
        if (!block.arrayPath || block.arrayPath.trim() === '') {
          errors.push(`Empty array path at position ${block.startPos}`);
        }

        // Try to parse the loop declaration
        try {
          this.parseLoop(block.arrayPath);
        } catch (error) {
          errors.push(`Invalid loop declaration "${block.arrayPath}": ${error.message}`);
        }

        // Check for empty content
        if (!block.content || block.content.trim() === '') {
          warnings.push(`Empty loop content at position ${block.startPos}`);
        }
      }
    } catch (error) {
      errors.push(error.message);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get statistics about loops in template
   */
  getStatistics(template) {
    try {
      // Count all loops including nested ones
      const allLoops = this.countAllLoops(template);
      const blocks = this.findLoopBlocks(template);

      let maxDepth = 0;
      let totalIterationVars = 0;

      for (const block of blocks) {
        maxDepth = Math.max(maxDepth, block.depth);

        // Count special loop variables used in this block and nested blocks
        const fullContent = block.content;
        const specialVars = ['@index', '@first', '@last', '@key', '@length'];
        for (const varName of specialVars) {
          if (fullContent.includes(`{{${varName}}}`)) {
            totalIterationVars++;
          }
        }
      }

      return {
        totalLoops: allLoops,
        maxNestingDepth: maxDepth,
        specialVarsUsed: totalIterationVars,
        averageContentLength: blocks.length > 0
          ? blocks.reduce((sum, b) => sum + b.content.length, 0) / blocks.length
          : 0
      };
    } catch (error) {
      return {
        totalLoops: 0,
        maxNestingDepth: 0,
        specialVarsUsed: 0,
        averageContentLength: 0,
        error: error.message
      };
    }
  }

  /**
   * Count all loops in template including nested ones
   */
  countAllLoops(template) {
    const pattern = /\{\{#each\s+[^}]+\}\}/g;
    const matches = template.match(pattern);
    return matches ? matches.length : 0;
  }

  /**
   * Preview loop expansion (useful for debugging)
   * Shows what the loop will generate without actually processing variables
   */
  previewLoop(template, variables) {
    try {
      const allLoops = this.countAllLoops(template);
      const blocks = this.findLoopBlocks(template);

      const previews = blocks.map(block => {
        const loopInfo = this.parseLoop(block.arrayPath);
        const array = this.getVariableValue(loopInfo.arrayPath, variables);

        let itemCount = 0;
        if (Array.isArray(array)) {
          itemCount = array.length;
        } else if (typeof array === 'object' && array !== null) {
          itemCount = Object.keys(array).length;
        } else if (array !== undefined && array !== null) {
          itemCount = 1;
        }

        return {
          arrayPath: loopInfo.arrayPath,
          itemAlias: loopInfo.itemAlias,
          itemCount,
          contentPreview: block.content.substring(0, 100) + (block.content.length > 100 ? '...' : ''),
          estimatedOutputLength: block.content.length * itemCount
        };
      });

      return {
        totalLoops: allLoops,
        loops: previews,
        estimatedTotalLength: previews.reduce((sum, p) => sum + p.estimatedOutputLength, 0)
      };
    } catch (error) {
      return {
        error: error.message
      };
    }
  }
}

export default TemplateLoops;
