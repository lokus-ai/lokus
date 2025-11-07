/**
 * Template Conditionals
 *
 * Handles conditional logic in templates including if/else statements
 * Syntax: {{#if condition}}...{{else}}...{{/if}}
 */

export class TemplateConditionals {
  constructor(options = {}) {
    this.strictMode = options.strictMode !== false;
    this.maxNestingDepth = options.maxNestingDepth || 10;
  }

  /**
   * Find all conditional blocks in template
   * Returns array of conditional blocks with their positions and content
   */
  findConditionalBlocks(template) {
    const blocks = [];
    const stack = [];
    let currentPos = 0;

    // Pattern to match: {{#if condition}}, {{else if condition}}, {{else}}, {{/if}}
    const pattern = /\{\{#if\s+([^}]+)\}\}|\{\{else\s+if\s+([^}]+)\}\}|\{\{else\}\}|\{\{\/if\}\}/g;
    let match;

    while ((match = pattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const position = match.index;

      if (fullMatch.startsWith('{{#if')) {
        // Start of new conditional block
        const condition = match[1].trim();
        stack.push({
          type: 'if',
          condition,
          startPos: position,
          endPos: position + fullMatch.length,
          depth: stack.length,
          branches: []
        });
      } else if (fullMatch.startsWith('{{else if')) {
        // Else-if branch
        if (stack.length === 0) {
          throw new Error(`Unexpected {{else if}} at position ${position}`);
        }
        const condition = match[2].trim();
        const currentBlock = stack[stack.length - 1];

        // Close previous branch
        if (currentBlock.branches.length > 0) {
          const lastBranch = currentBlock.branches[currentBlock.branches.length - 1];
          lastBranch.endPos = position;
          lastBranch.content = template.substring(lastBranch.contentStart, position);
        } else {
          // First branch (the if part)
          currentBlock.branches.push({
            type: 'if',
            condition: currentBlock.condition,
            contentStart: currentBlock.endPos,
            endPos: position,
            content: template.substring(currentBlock.endPos, position)
          });
        }

        // Add else-if branch
        currentBlock.branches.push({
          type: 'elseif',
          condition,
          contentStart: position + fullMatch.length,
          startPos: position
        });
      } else if (fullMatch === '{{else}}') {
        // Else branch
        if (stack.length === 0) {
          throw new Error(`Unexpected {{else}} at position ${position}`);
        }
        const currentBlock = stack[stack.length - 1];

        // Close previous branch
        if (currentBlock.branches.length > 0) {
          const lastBranch = currentBlock.branches[currentBlock.branches.length - 1];
          lastBranch.endPos = position;
          lastBranch.content = template.substring(lastBranch.contentStart, position);
        } else {
          // First branch (the if part)
          currentBlock.branches.push({
            type: 'if',
            condition: currentBlock.condition,
            contentStart: currentBlock.endPos,
            endPos: position,
            content: template.substring(currentBlock.endPos, position)
          });
        }

        // Add else branch
        currentBlock.branches.push({
          type: 'else',
          condition: null,
          contentStart: position + fullMatch.length,
          startPos: position
        });
      } else if (fullMatch === '{{/if}}') {
        // End of conditional block
        if (stack.length === 0) {
          throw new Error(`Unexpected {{/if}} at position ${position}`);
        }

        const currentBlock = stack.pop();

        // Close last branch
        if (currentBlock.branches.length > 0) {
          const lastBranch = currentBlock.branches[currentBlock.branches.length - 1];
          lastBranch.endPos = position;
          lastBranch.content = template.substring(lastBranch.contentStart, position);
        } else {
          // Only if branch, no else
          currentBlock.branches.push({
            type: 'if',
            condition: currentBlock.condition,
            contentStart: currentBlock.endPos,
            endPos: position,
            content: template.substring(currentBlock.endPos, position)
          });
        }

        currentBlock.closePos = position;
        currentBlock.closeEndPos = position + fullMatch.length;
        currentBlock.fullContent = template.substring(currentBlock.startPos, currentBlock.closeEndPos);

        // If this is a top-level block, add to results
        if (stack.length === 0) {
          blocks.push(currentBlock);
        }
      }
    }

    if (stack.length > 0) {
      throw new Error(`Unclosed conditional block starting at position ${stack[0].startPos}`);
    }

    return blocks;
  }

  /**
   * Parse a condition string into a structured condition object
   * Supports: ==, !=, <, >, <=, >=, &&, ||
   */
  parseCondition(conditionString) {
    if (!conditionString || typeof conditionString !== 'string') {
      throw new Error('Condition must be a non-empty string');
    }

    const condition = conditionString.trim();

    // Handle parentheses for grouped conditions
    if (condition.includes('(') && condition.includes(')')) {
      return this.parseComplexCondition(condition);
    }

    // Handle logical operators (&&, ||)
    if (condition.includes('&&')) {
      const parts = this.splitByOperator(condition, '&&');
      return {
        type: 'and',
        left: this.parseCondition(parts[0]),
        right: this.parseCondition(parts[1])
      };
    }

    if (condition.includes('||')) {
      const parts = this.splitByOperator(condition, '||');
      return {
        type: 'or',
        left: this.parseCondition(parts[0]),
        right: this.parseCondition(parts[1])
      };
    }

    // Handle comparison operators
    const comparisonOps = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];
    for (const op of comparisonOps) {
      if (condition.includes(op)) {
        const parts = this.splitByOperator(condition, op);
        if (parts.length === 2) {
          return {
            type: 'comparison',
            operator: op,
            left: this.parseValue(parts[0]),
            right: this.parseValue(parts[1])
          };
        }
      }
    }

    // Simple truthiness check
    return {
      type: 'truthiness',
      value: this.parseValue(condition)
    };
  }

  /**
   * Parse complex conditions with parentheses
   */
  parseComplexCondition(condition) {
    // Simple implementation - can be enhanced for more complex cases
    const trimmed = condition.trim();

    // Remove outer parentheses if they wrap the entire expression
    if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
      const inner = trimmed.substring(1, trimmed.length - 1);
      // Check if the parentheses are balanced and wrap the whole thing
      if (this.isBalanced(inner)) {
        return this.parseCondition(inner);
      }
    }

    // Otherwise parse as regular condition
    return this.parseCondition(condition);
  }

  /**
   * Check if parentheses in a string are balanced
   */
  isBalanced(str) {
    let count = 0;
    for (let char of str) {
      if (char === '(') count++;
      if (char === ')') count--;
      if (count < 0) return false;
    }
    return count === 0;
  }

  /**
   * Split condition by operator (handling quotes)
   */
  splitByOperator(condition, operator) {
    let inQuotes = false;
    let quoteChar = null;
    let depth = 0;

    for (let i = 0; i < condition.length; i++) {
      const char = condition[i];

      // Handle quotes
      if ((char === '"' || char === "'") && (i === 0 || condition[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true;
          quoteChar = char;
        } else if (char === quoteChar) {
          inQuotes = false;
          quoteChar = null;
        }
      }

      // Handle parentheses
      if (!inQuotes) {
        if (char === '(') depth++;
        if (char === ')') depth--;
      }

      // Check for operator at this position
      if (!inQuotes && depth === 0) {
        const remaining = condition.substring(i);
        if (remaining.startsWith(operator)) {
          const left = condition.substring(0, i).trim();
          const right = condition.substring(i + operator.length).trim();
          return [left, right];
        }
      }
    }

    return [condition];
  }

  /**
   * Parse a value (string, number, boolean, or variable reference)
   */
  parseValue(valueStr) {
    const trimmed = valueStr.trim();

    // Boolean literals
    if (trimmed === 'true') return { type: 'literal', value: true };
    if (trimmed === 'false') return { type: 'literal', value: false };

    // Null/undefined
    if (trimmed === 'null') return { type: 'literal', value: null };
    if (trimmed === 'undefined') return { type: 'literal', value: undefined };

    // String literals
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
        (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
      return {
        type: 'literal',
        value: trimmed.substring(1, trimmed.length - 1)
      };
    }

    // Number literals
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { type: 'literal', value: parseFloat(trimmed) };
    }

    // Variable reference
    return { type: 'variable', path: trimmed };
  }

  /**
   * Evaluate a condition with given variables
   */
  evaluateCondition(conditionObj, variables) {
    if (!conditionObj) return false;

    switch (conditionObj.type) {
      case 'and':
        return this.evaluateCondition(conditionObj.left, variables) &&
               this.evaluateCondition(conditionObj.right, variables);

      case 'or':
        return this.evaluateCondition(conditionObj.left, variables) ||
               this.evaluateCondition(conditionObj.right, variables);

      case 'comparison':
        return this.evaluateComparison(
          conditionObj.operator,
          this.resolveValue(conditionObj.left, variables),
          this.resolveValue(conditionObj.right, variables)
        );

      case 'truthiness':
        return this.isTruthy(this.resolveValue(conditionObj.value, variables));

      default:
        return false;
    }
  }

  /**
   * Evaluate a comparison operation
   */
  evaluateComparison(operator, left, right) {
    switch (operator) {
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '<': return left < right;
      case '>': return left > right;
      case '<=': return left <= right;
      case '>=': return left >= right;
      default: return false;
    }
  }

  /**
   * Check if a value is truthy
   */
  isTruthy(value) {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value.length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return !!value;
  }

  /**
   * Resolve a value (literal or variable)
   */
  resolveValue(valueObj, variables) {
    if (!valueObj) return undefined;

    if (valueObj.type === 'literal') {
      return valueObj.value;
    }

    if (valueObj.type === 'variable') {
      return this.getVariableValue(valueObj.path, variables);
    }

    return undefined;
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
   * Process a single conditional block
   */
  processConditional(block, variables) {
    // Evaluate each branch in order
    for (const branch of block.branches) {
      if (branch.type === 'else') {
        // Else branch always executes if reached
        return branch.content;
      }

      // Evaluate condition
      const conditionObj = this.parseCondition(branch.condition);
      const result = this.evaluateCondition(conditionObj, variables);

      if (result) {
        return branch.content;
      }
    }

    // No branch matched, return empty string
    return '';
  }

  /**
   * Process all conditional blocks in a template
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
      // Process recursively to handle nested conditionals
      let result = template;
      let hasChanges = true;
      let iterations = 0;
      const maxIterations = 50; // Prevent infinite loops

      while (hasChanges && iterations < maxIterations) {
        hasChanges = false;
        iterations++;

        // Find all conditional blocks (outermost first)
        const blocks = this.findConditionalBlocks(result);

        if (blocks.length === 0) {
          break;
        }

        // Process from end to start to maintain positions
        for (let i = blocks.length - 1; i >= 0; i--) {
          const block = blocks[i];
          const replacement = this.processConditional(block, variables);

          result = result.substring(0, block.startPos) +
                  replacement +
                  result.substring(block.closeEndPos);
          hasChanges = true;
        }
      }

      if (iterations >= maxIterations) {
        throw new Error('Maximum conditional processing iterations exceeded');
      }

      return result;
    } catch (error) {
      if (this.strictMode) {
        throw new Error(`Conditional processing failed: ${error.message}`);
      }
      return template; // Return original template on error in non-strict mode
    }
  }

  /**
   * Validate conditional syntax in template
   */
  validate(template) {
    const errors = [];
    const warnings = [];

    try {
      const blocks = this.findConditionalBlocks(template);

      // Check nesting depth
      for (const block of blocks) {
        if (block.depth >= this.maxNestingDepth) {
          warnings.push(`Conditional nesting depth (${block.depth}) exceeds recommended maximum`);
        }

        // Check for empty conditions
        if (!block.condition || block.condition.trim() === '') {
          errors.push(`Empty condition at position ${block.startPos}`);
        }

        // Try to parse each condition
        for (const branch of block.branches) {
          if (branch.condition) {
            try {
              this.parseCondition(branch.condition);
            } catch (error) {
              errors.push(`Invalid condition "${branch.condition}": ${error.message}`);
            }
          }
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
   * Get statistics about conditionals in template
   */
  getStatistics(template) {
    try {
      const blocks = this.findConditionalBlocks(template);

      let maxDepth = 0;
      let elseIfCount = 0;
      let elseCount = 0;

      for (const block of blocks) {
        maxDepth = Math.max(maxDepth, block.depth);
        for (const branch of block.branches) {
          if (branch.type === 'elseif') elseIfCount++;
          if (branch.type === 'else') elseCount++;
        }
      }

      return {
        totalConditionals: blocks.length,
        maxNestingDepth: maxDepth,
        elseIfCount,
        elseCount,
        averageBranches: blocks.length > 0
          ? blocks.reduce((sum, b) => sum + b.branches.length, 0) / blocks.length
          : 0
      };
    } catch (error) {
      return {
        totalConditionals: 0,
        maxNestingDepth: 0,
        elseIfCount: 0,
        elseCount: 0,
        averageBranches: 0,
        error: error.message
      };
    }
  }
}

export default TemplateConditionals;
