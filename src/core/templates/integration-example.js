/**
 * Integration Example: Using Template Prompts with Template Manager
 *
 * This example shows how to integrate the prompts system with the existing
 * template processing pipeline.
 */

import { TemplateManager } from './manager.js';
import { TemplateProcessor } from './processor.js';
import { TemplatePrompts } from './prompts.js';

/**
 * Enhanced Template Manager with Prompts Support
 */
export class EnhancedTemplateManager extends TemplateManager {
  constructor(options = {}) {
    super(options);
    this.promptsParser = new TemplatePrompts();
  }

  /**
   * Process template with user prompts
   * This method should be called from the UI layer where showPromptsFunc is available
   */
  async processWithPrompts(templateId, context = {}, showPromptsFunc) {
    // 1. Load the template
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let content = template.content;

    // 2. Check if template has prompts and collect user input
    if (this.promptsParser.hasPrompts(content)) {
      try {
        // Show prompts to user and collect values
        const userValues = await showPromptsFunc(content);

        // Replace prompts with user-provided values
        content = this.promptsParser.replacePrompts(content, userValues);

        // Merge user values into context for potential use in JS blocks
        context = { ...context, ...userValues };
      } catch (error) {
        // User cancelled - could throw or return null
        throw new Error('User cancelled template prompts');
      }
    }

    // 3. Process the template normally (variables, JS blocks, etc.)
    const processor = new TemplateProcessor(this.options);
    const result = await processor.process(content, context);

    return result;
  }

  /**
   * Get template info including prompt requirements
   */
  getTemplateInfo(templateId) {
    const template = this.getTemplate(templateId);
    if (!template) return null;

    const prompts = this.promptsParser.parsePrompts(template.content);
    const stats = this.promptsParser.getStatistics(template.content);
    const validation = this.promptsParser.validate(template.content);

    return {
      ...template,
      prompts: {
        count: prompts.length,
        list: prompts,
        stats,
        validation,
        hasPrompts: prompts.length > 0
      }
    };
  }

  /**
   * Preview template with sample prompt values
   */
  async previewWithPrompts(templateId, sampleValues = {}) {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    let content = template.content;

    // Replace prompts with sample values
    if (this.promptsParser.hasPrompts(content)) {
      content = this.promptsParser.replacePrompts(content, sampleValues);
    }

    // Process in preview mode
    const processor = new TemplateProcessor({ strictMode: false });
    return await processor.preview(content, sampleValues);
  }
}

/**
 * Example usage in a React component:
 *
 * ```jsx
 * import { EnhancedTemplateManager } from './core/templates/integration-example';
 * import { useTemplatePrompts } from './components/features/Templates';
 *
 * function TemplateComponent() {
 *   const { showPrompts, PromptsManager } = useTemplatePrompts();
 *   const templateManager = new EnhancedTemplateManager();
 *
 *   const handleApplyTemplate = async (templateId) => {
 *     try {
 *       // Process template with prompts
 *       const result = await templateManager.processWithPrompts(
 *         templateId,
 *         { /* additional context */ },
 *         showPrompts // Pass the showPrompts function
 *       );
 *
 *       // Use the result (e.g., insert into editor)
 *       
 *     } catch (error) {
 *       console.error('Template processing failed:', error);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       <button onClick={() => handleApplyTemplate('meeting-notes')}>
 *         Create Meeting Notes
 *       </button>
 *       {PromptsManager}
 *     </>
 *   );
 * }
 * ```
 */

/**
 * Standalone function for processing templates with prompts
 */
export async function processTemplateWithPrompts(template, context = {}, showPromptsFunc) {
  const promptsParser = new TemplatePrompts();

  // Handle user prompts if any
  if (promptsParser.hasPrompts(template)) {
    const userValues = await showPromptsFunc(template);
    template = promptsParser.replacePrompts(template, userValues);
    context = { ...context, ...userValues };
  }

  // Process the template
  const processor = new TemplateProcessor();
  return await processor.process(template, context);
}

/**
 * Helper to check if a template needs user input
 */
export function requiresUserInput(template) {
  const promptsParser = new TemplatePrompts();
  return promptsParser.hasPrompts(template);
}

/**
 * Helper to get all required variable names
 */
export function getRequiredInputs(template) {
  const promptsParser = new TemplatePrompts();
  return promptsParser.getRequiredVariables(template);
}

export default EnhancedTemplateManager;
