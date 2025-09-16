/**
 * Template Parser
 * 
 * Parses template syntax including variable substitution and JavaScript execution blocks
 */

export class TemplateParser {
  constructor() {
    this.variablePattern = /\{\{([^}]+)\}\}/g;
    this.jsBlockPattern = /<%(?!#)\s*([\s\S]*?)\s*%>/g;
    this.commentPattern = /<%#[\s\S]*?%>/g;
  }

  /**
   * Parse template and extract variables and JS blocks
   */
  parse(template) {
    if (!template || typeof template !== 'string') {
      throw new Error('Template must be a non-empty string');
    }

    const variables = this.extractVariables(template);
    const jsBlocks = this.extractJsBlocks(template);
    const comments = this.extractComments(template);

    return {
      template,
      variables,
      jsBlocks,
      comments,
      hasVariables: variables.length > 0,
      hasJsBlocks: jsBlocks.length > 0,
      hasComments: comments.length > 0
    };
  }

  /**
   * Extract variable references from template
   */
  extractVariables(template) {
    const variables = [];
    let match;

    while ((match = this.variablePattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const variableName = match[1].trim();

      // Parse variable with optional filters and default values
      // First check for default value syntax: variable || 'default'
      const defaultMatch = variableName.match(/^([^|]+)\s*\|\|\s*([^|]+)(.*)$/);
      let variableParts, defaultValue, filterPart;

      if (defaultMatch) {
        variableParts = defaultMatch[1].trim();
        defaultValue = defaultMatch[2].trim().replace(/^['"]|['"]$/g, '');
        filterPart = defaultMatch[3]; // Remaining filters after default value
      } else {
        // No default value, split by single |
        const parts = variableName.split('|');
        variableParts = parts[0].trim();
        defaultValue = null;
        filterPart = parts.slice(1).join('|'); // Join remaining parts for filters
      }

      // Parse filters from the filter part
      const filters = filterPart 
        ? filterPart.split('|').map(f => f.trim()).filter(f => f.length > 0)
        : [];

      variables.push({
        fullMatch,
        name: variableParts,
        filters,
        defaultValue,
        position: match.index
      });
    }

    // Reset regex state
    this.variablePattern.lastIndex = 0;
    return variables;
  }

  /**
   * Extract JavaScript execution blocks
   */
  extractJsBlocks(template) {
    const jsBlocks = [];
    let match;

    while ((match = this.jsBlockPattern.exec(template)) !== null) {
      const fullMatch = match[0];
      const code = match[1].trim();

      jsBlocks.push({
        fullMatch,
        code,
        position: match.index,
        isExpression: this.isExpression(code),
        isStatement: this.isStatement(code)
      });
    }

    // Reset regex state
    this.jsBlockPattern.lastIndex = 0;
    return jsBlocks;
  }

  /**
   * Extract comment blocks
   */
  extractComments(template) {
    const comments = [];
    let match;

    while ((match = this.commentPattern.exec(template)) !== null) {
      comments.push({
        fullMatch: match[0],
        position: match.index
      });
    }

    // Reset regex state
    this.commentPattern.lastIndex = 0;
    return comments;
  }

  /**
   * Check if code is an expression (returns a value)
   */
  isExpression(code) {
    // Simple heuristic: if it starts with return, or is a single expression
    if (code.startsWith('return ')) return true;
    
    // Check if it's a simple expression (no semicolons, control structures)
    if (!code.includes(';') && !code.match(/\b(if|for|while|function|var|let|const)\b/)) {
      return true;
    }

    return false;
  }

  /**
   * Check if code contains statements
   */
  isStatement(code) {
    return code.includes(';') || code.match(/\b(if|for|while|function|var|let|const)\b/);
  }

  /**
   * Validate template syntax
   */
  validate(template) {
    const errors = [];
    const warnings = [];

    try {
      const parsed = this.parse(template);

      // Check for malformed variable syntax
      const malformedVars = template.match(/\{[^}]*\}(?!\})/g);
      if (malformedVars) {
        errors.push(`Malformed variable syntax: ${malformedVars.join(', ')}`);
      }

      // Check for unclosed JS blocks by looking for unmatched <%
      const hasUnmatchedOpen = template.includes('<%') && !template.match(/<%[\s\S]*?%>/);
      if (hasUnmatchedOpen) {
        errors.push('Unclosed JavaScript blocks detected');
      }

      // Check for unclosed variables by looking for unmatched {{
      const hasUnmatchedVariable = template.includes('{{') && !template.match(/\{\{[^}]*\}\}/);
      if (hasUnmatchedVariable) {
        errors.push('Unclosed variable blocks detected');
      }

      // Performance warnings
      if (parsed.jsBlocks.length > 10) {
        warnings.push('Template contains many JavaScript blocks, consider optimizing');
      }

      if (parsed.variables.length > 50) {
        warnings.push('Template contains many variables, consider breaking into smaller templates');
      }

      // Security warnings
      for (const block of parsed.jsBlocks) {
        if (block.code.includes('eval') || block.code.includes('Function')) {
          warnings.push('JavaScript block contains potentially dangerous code');
        }
      }

    } catch (error) {
      errors.push(`Parse error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get template statistics
   */
  getStatistics(template) {
    const parsed = this.parse(template);
    
    return {
      length: template.length,
      variables: {
        count: parsed.variables.length,
        unique: [...new Set(parsed.variables.map(v => v.name))].length,
        withDefaults: parsed.variables.filter(v => v.defaultValue !== null).length,
        withFilters: parsed.variables.filter(v => v.filters.length > 0).length
      },
      jsBlocks: {
        count: parsed.jsBlocks.length,
        expressions: parsed.jsBlocks.filter(b => b.isExpression).length,
        statements: parsed.jsBlocks.filter(b => b.isStatement).length,
        totalCodeLength: parsed.jsBlocks.reduce((sum, b) => sum + b.code.length, 0)
      },
      comments: {
        count: parsed.comments.length
      },
      complexity: this.calculateComplexity(parsed)
    };
  }

  /**
   * Calculate template complexity score
   */
  calculateComplexity(parsed) {
    let score = 0;
    
    // Base complexity from variables and JS blocks
    score += parsed.variables.length * 1;
    score += parsed.jsBlocks.length * 3;
    
    // Additional complexity for filters and defaults
    score += parsed.variables.filter(v => v.filters.length > 0).length * 2;
    score += parsed.variables.filter(v => v.defaultValue !== null).length * 1;
    
    // Complexity from JS block types
    score += parsed.jsBlocks.filter(b => b.isStatement).length * 2;
    
    if (score <= 10) return 'simple';
    if (score <= 25) return 'moderate';
    if (score <= 50) return 'complex';
    return 'very-complex';
  }
}

export default TemplateParser;