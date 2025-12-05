import React, { useState, useEffect } from 'react';
import PromptDialog from "./PromptDialog";
import SuggestDialog from "./SuggestDialog";
import CheckboxDialog from "./CheckboxDialog";
import { TemplatePrompts } from "../../../core/templates/prompts";

/**
 * TemplatePromptsManager - Orchestrates showing all template prompts
 *
 * This component manages the flow of showing multiple prompts in sequence,
 * collecting all user inputs, and returning them as a variables object.
 */
const TemplatePromptsManager = ({
  template,
  onComplete,
  onCancel,
  remember = false
}) => {
  const [prompts, setPrompts] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [values, setValues] = useState({});
  const [isOpen, setIsOpen] = useState(false);

  const promptsParser = new TemplatePrompts();

  // Parse prompts when template changes
  useEffect(() => {
    if (template) {
      const parsed = promptsParser.parsePrompts(template);
      setPrompts(parsed);
      setCurrentIndex(0);
      setValues({});
      setIsOpen(parsed.length > 0);
    }
  }, [template]);

  // Get current prompt
  const currentPrompt = prompts[currentIndex] || null;
  const isLastPrompt = currentIndex === prompts.length - 1;
  const progress = prompts.length > 0 ? ((currentIndex + 1) / prompts.length) * 100 : 0;

  const handleSubmit = (value) => {
    // Store the value
    const newValues = {
      ...values,
      [currentPrompt.varName]: value
    };
    setValues(newValues);

    // Remember value if requested
    if (remember) {
      promptsParser.rememberValue(currentPrompt.varName, value);
    }

    // Move to next prompt or complete
    if (isLastPrompt) {
      setIsOpen(false);
      onComplete(newValues);
    } else {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    setCurrentIndex(0);
    setValues({});
    onCancel();
  };

  const handleOpenChange = (open) => {
    if (!open) {
      handleCancel();
    }
  };

  if (!currentPrompt) return null;

  return (
    <>
      {/* Progress indicator */}
      {prompts.length > 1 && isOpen && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[60]">
          <div className="bg-app-panel border border-app-border rounded-lg shadow-lg px-4 py-2">
            <div className="flex items-center space-x-3">
              <span className="text-xs text-app-text opacity-70">
                Question {currentIndex + 1} of {prompts.length}
              </span>
              <div className="w-32 h-1.5 bg-app-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show appropriate dialog based on prompt type */}
      {currentPrompt.type === 'prompt' && (
        <PromptDialog
          open={isOpen}
          onOpenChange={handleOpenChange}
          prompt={currentPrompt}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {currentPrompt.type === 'suggest' && (
        <SuggestDialog
          open={isOpen}
          onOpenChange={handleOpenChange}
          prompt={currentPrompt}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}

      {currentPrompt.type === 'checkbox' && (
        <CheckboxDialog
          open={isOpen}
          onOpenChange={handleOpenChange}
          prompt={currentPrompt}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      )}
    </>
  );
};

/**
 * Hook to use template prompts
 * Returns a function to show prompts for a template
 */
export const useTemplatePrompts = () => {
  const [isShowing, setIsShowing] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [resolver, setResolver] = useState(null);

  const showPrompts = (template, options = {}) => {
    return new Promise((resolve, reject) => {
      setCurrentTemplate(template);
      setIsShowing(true);
      setResolver(() => ({ resolve, reject }));
    });
  };

  const handleComplete = (values) => {
    setIsShowing(false);
    if (resolver) {
      resolver.resolve(values);
      setResolver(null);
    }
  };

  const handleCancel = () => {
    setIsShowing(false);
    if (resolver) {
      resolver.reject(new Error('User cancelled'));
      setResolver(null);
    }
  };

  const PromptsManager = isShowing ? (
    <TemplatePromptsManager
      template={currentTemplate}
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  ) : null;

  return {
    showPrompts,
    PromptsManager
  };
};

/**
 * Standalone function to show prompts (async)
 * This can be used outside of React components
 */
export const showTemplatePrompts = async (template, options = {}) => {
  const promptsParser = new TemplatePrompts();
  const prompts = promptsParser.parsePrompts(template);

  if (prompts.length === 0) {
    return {}; // No prompts to show
  }

  // This would need to be implemented with a global state manager or portal
  // For now, this is a placeholder that should be overridden
  throw new Error('showTemplatePrompts must be called through useTemplatePrompts hook or integrated with a global state manager');
};

export default TemplatePromptsManager;
