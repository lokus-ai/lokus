/**
 * Template Prompts System
 *
 * Handles user interaction prompts in templates:
 * - {{prompt:varName:question:defaultValue}}
 * - {{suggest:varName:question:option1,option2,option3:default}}
 * - {{checkbox:varName:question:defaultBool}}
 */

export class TemplatePrompts {
  constructor() {
    // Regex patterns for different prompt types
    this.promptPattern = /\{\{prompt:([^:]+):([^:]+)(?::([^}]*))?\}\}/g;
    this.suggestPattern = /\{\{suggest:([^:]+):([^:]+):([^:]+)(?::([^}]*))?\}\}/g;
    this.checkboxPattern = /\{\{checkbox:([^:]+):([^:]+)(?::([^}]*))?\}\}/g;

    // Store for previous values (optional feature for remembering inputs)
    this.previousValues = new Map();
  }

  /**
   * Parse all prompts from a template
   * Returns array of prompt definitions
   */
  parsePrompts(template) {
    if (!template || typeof template !== 'string') {
      return [];
    }

    const prompts = [];

    // Parse text prompts
    prompts.push(...this.parseTextPrompts(template));

    // Parse suggest/dropdown prompts
    prompts.push(...this.parseSuggestPrompts(template));

    // Parse checkbox prompts
    prompts.push(...this.parseCheckboxPrompts(template));

    // Sort by position in template
    prompts.sort((a, b) => a.position - b.position);

    // Remove duplicates (same variable name)
    const seen = new Set();
    return prompts.filter(prompt => {
      if (seen.has(prompt.varName)) {
        return false;
      }
      seen.add(prompt.varName);
      return true;
    });
  }

  /**
   * Parse text input prompts
   * Format: {{prompt:varName:question:defaultValue}}
   */
  parseTextPrompts(template) {
    const prompts = [];
    let match;

    // Reset regex state
    this.promptPattern.lastIndex = 0;

    while ((match = this.promptPattern.exec(template)) !== null) {
      const [fullMatch, varName, question, defaultValue = ''] = match;

      prompts.push({
        type: 'prompt',
        varName: varName.trim(),
        question: question.trim(),
        defaultValue: defaultValue.trim(),
        fullMatch,
        position: match.index
      });
    }

    return prompts;
  }

  /**
   * Parse dropdown/suggester prompts
   * Format: {{suggest:varName:question:option1,option2,option3:default}}
   */
  parseSuggestPrompts(template) {
    const prompts = [];
    let match;

    // Reset regex state
    this.suggestPattern.lastIndex = 0;

    while ((match = this.suggestPattern.exec(template)) !== null) {
      const [fullMatch, varName, question, optionsStr, defaultValue = ''] = match;

      // Parse options (split by comma, trim whitespace)
      const options = optionsStr
        .split(',')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);

      prompts.push({
        type: 'suggest',
        varName: varName.trim(),
        question: question.trim(),
        options,
        defaultValue: defaultValue.trim() || (options.length > 0 ? options[0] : ''),
        fullMatch,
        position: match.index
      });
    }

    return prompts;
  }

  /**
   * Parse checkbox prompts
   * Format: {{checkbox:varName:question:defaultBool}}
   */
  parseCheckboxPrompts(template) {
    const prompts = [];
    let match;

    // Reset regex state
    this.checkboxPattern.lastIndex = 0;

    while ((match = this.checkboxPattern.exec(template)) !== null) {
      const [fullMatch, varName, question, defaultValue = 'false'] = match;

      // Parse boolean default value
      const boolDefault = this.parseBoolean(defaultValue.trim());

      prompts.push({
        type: 'checkbox',
        varName: varName.trim(),
        question: question.trim(),
        defaultValue: boolDefault,
        fullMatch,
        position: match.index
      });
    }

    return prompts;
  }

  /**
   * Parse boolean value from string
   */
  parseBoolean(value) {
    if (typeof value === 'boolean') {
      return value;
    }

    const str = String(value).toLowerCase().trim();
    return str === 'true' || str === '1' || str === 'yes';
  }

  /**
   * Get previous value for a variable (if remembered)
   */
  getPreviousValue(varName) {
    return this.previousValues.get(varName);
  }

  /**
   * Remember a value for future use
   */
  rememberValue(varName, value) {
    this.previousValues.set(varName, value);
  }

  /**
   * Clear all remembered values
   */
  clearMemory() {
    this.previousValues.clear();
  }

  /**
   * Replace prompt syntax with resolved values
   * Returns new template with prompts replaced by values
   */
  replacePrompts(template, values = {}) {
    if (!template || typeof template !== 'string') {
      console.log('[Prompts] replacePrompts: invalid template');
      return template;
    }

    console.log('[Prompts] replacePrompts START');
    console.log('[Prompts] Input template length:', template.length);
    console.log('[Prompts] Values:', values);

    let result = template;

    // Replace all prompt types
    const afterText = this.replaceTextPrompts(result, values);
    console.log('[Prompts] After replaceTextPrompts, changed:', result !== afterText);
    result = afterText;

    const afterSuggest = this.replaceSuggestPrompts(result, values);
    console.log('[Prompts] After replaceSuggestPrompts, changed:', result !== afterSuggest);
    result = afterSuggest;

    const afterCheckbox = this.replaceCheckboxPrompts(result, values);
    console.log('[Prompts] After replaceCheckboxPrompts, changed:', result !== afterCheckbox);
    result = afterCheckbox;

    console.log('[Prompts] Final result length:', result.length);
    console.log('[Prompts] Result preview:', result.substring(0, 200));

    return result;
  }

  /**
   * Replace text prompts with values
   */
  replaceTextPrompts(template, values) {
    // Reset lastIndex to ensure regex works correctly
    this.promptPattern.lastIndex = 0;

    let matchCount = 0;
    const result = template.replace(this.promptPattern, (fullMatch, varName, question, defaultValue = '') => {
      matchCount++;
      const trimmedVarName = varName.trim();

      console.log(`[Prompts] replaceTextPrompts match #${matchCount}:`, {
        fullMatch,
        varName: trimmedVarName,
        hasValue: values.hasOwnProperty(trimmedVarName),
        value: values[trimmedVarName],
        defaultValue: defaultValue?.trim()
      });

      if (values.hasOwnProperty(trimmedVarName)) {
        const replacement = String(values[trimmedVarName]);
        console.log(`[Prompts] Replacing with value:`, replacement);
        return replacement;
      }

      // Use default value if no value provided
      const replacement = defaultValue.trim();
      console.log(`[Prompts] Replacing with default:`, replacement);
      return replacement;
    });

    console.log(`[Prompts] replaceTextPrompts: ${matchCount} matches found`);
    return result;
  }

  /**
   * Replace suggest prompts with values
   */
  replaceSuggestPrompts(template, values) {
    // Reset lastIndex to ensure regex works correctly
    this.suggestPattern.lastIndex = 0;

    let matchCount = 0;
    const result = template.replace(this.suggestPattern, (fullMatch, varName, question, optionsStr, defaultValue = '') => {
      matchCount++;
      const trimmedVarName = varName.trim();

      console.log(`[Prompts] replaceSuggestPrompts match #${matchCount}:`, {
        fullMatch,
        varName: trimmedVarName,
        hasValue: values.hasOwnProperty(trimmedVarName),
        value: values[trimmedVarName],
        defaultValue: defaultValue?.trim()
      });

      if (values.hasOwnProperty(trimmedVarName)) {
        const replacement = String(values[trimmedVarName]);
        console.log(`[Prompts] Replacing with value:`, replacement);
        return replacement;
      }

      // Use default value or first option
      const options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0);
      const replacement = defaultValue.trim() || (options.length > 0 ? options[0] : '');
      console.log(`[Prompts] Replacing with default:`, replacement);
      return replacement;
    });

    console.log(`[Prompts] replaceSuggestPrompts: ${matchCount} matches found`);
    return result;
  }

  /**
   * Replace checkbox prompts with values
   */
  replaceCheckboxPrompts(template, values) {
    // Reset lastIndex to ensure regex works correctly
    this.checkboxPattern.lastIndex = 0;

    let matchCount = 0;
    const result = template.replace(this.checkboxPattern, (fullMatch, varName, question, defaultValue = 'false') => {
      matchCount++;
      const trimmedVarName = varName.trim();

      console.log(`[Prompts] replaceCheckboxPrompts match #${matchCount}:`, {
        fullMatch,
        varName: trimmedVarName,
        hasValue: values.hasOwnProperty(trimmedVarName),
        value: values[trimmedVarName],
        defaultValue: defaultValue?.trim()
      });

      if (values.hasOwnProperty(trimmedVarName)) {
        const replacement = String(values[trimmedVarName]);
        console.log(`[Prompts] Replacing with value:`, replacement);
        return replacement;
      }

      // Use default boolean value
      const replacement = String(this.parseBoolean(defaultValue.trim()));
      console.log(`[Prompts] Replacing with default:`, replacement);
      return replacement;
    });

    console.log(`[Prompts] replaceCheckboxPrompts: ${matchCount} matches found`);
    return result;
  }

  /**
   * Validate prompt definitions
   */
  validate(template) {
    const errors = [];
    const warnings = [];

    try {
      const prompts = this.parsePrompts(template);

      // Check for empty variable names
      const emptyVarNames = prompts.filter(p => !p.varName);
      if (emptyVarNames.length > 0) {
        errors.push('Found prompts with empty variable names');
      }

      // Check for duplicate variable names
      const varNames = prompts.map(p => p.varName);
      const duplicates = varNames.filter((name, index) => varNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        warnings.push(`Duplicate variable names: ${[...new Set(duplicates)].join(', ')}`);
      }

      // Check suggest prompts have options
      const suggestsWithoutOptions = prompts.filter(p => p.type === 'suggest' && (!p.options || p.options.length === 0));
      if (suggestsWithoutOptions.length > 0) {
        errors.push('Suggest prompts must have at least one option');
      }

      // Performance warning for many prompts
      if (prompts.length > 10) {
        warnings.push('Template has many prompts, consider splitting into multiple templates');
      }

    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get statistics about prompts in template
   */
  getStatistics(template) {
    const prompts = this.parsePrompts(template);

    return {
      total: prompts.length,
      byType: {
        prompt: prompts.filter(p => p.type === 'prompt').length,
        suggest: prompts.filter(p => p.type === 'suggest').length,
        checkbox: prompts.filter(p => p.type === 'checkbox').length
      },
      withDefaults: prompts.filter(p => p.defaultValue !== undefined && p.defaultValue !== '').length,
      uniqueVariables: new Set(prompts.map(p => p.varName)).size
    };
  }

  /**
   * Extract just the variable names that need user input
   */
  getRequiredVariables(template) {
    const prompts = this.parsePrompts(template);
    return prompts.map(p => p.varName);
  }

  /**
   * Check if template has any prompts
   */
  hasPrompts(template) {
    return this.parsePrompts(template).length > 0;
  }
}

/**
 * Show prompt dialogs to collect user input
 * This function should be called from the UI layer
 */
export async function showPromptDialogs(prompts, options = {}) {
  // This is a placeholder that will be overridden by the UI layer
  // The actual implementation will be in the React components
  throw new Error('showPromptDialogs must be implemented by the UI layer');
}

/**
 * Convenience function to parse and show prompts
 */
export async function collectUserInput(template, options = {}) {
  const promptsParser = new TemplatePrompts();
  const prompts = promptsParser.parsePrompts(template);

  if (prompts.length === 0) {
    return {}; // No prompts to show
  }

  // This will be overridden by the UI implementation
  const values = await showPromptDialogs(prompts, options);

  // Remember values if requested
  if (options.remember) {
    for (const [varName, value] of Object.entries(values)) {
      promptsParser.rememberValue(varName, value);
    }
  }

  return values;
}

// Export singleton instance
export const templatePrompts = new TemplatePrompts();

export default TemplatePrompts;
