import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";

/**
 * PromptDialog - Text input dialog for template prompts
 *
 * Displays a dialog with a text input field to collect user input
 * for template variables defined with {{prompt:varName:question:default}}
 */
const PromptDialog = ({
  open,
  onOpenChange,
  prompt,
  onSubmit,
  onCancel
}) => {
  const [value, setValue] = useState('');

  // Initialize with default value when dialog opens
  useEffect(() => {
    if (open && prompt) {
      setValue(prompt.defaultValue || '');
    }
  }, [open, prompt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(value);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {prompt.question || 'Enter value'}
          </DialogTitle>
          <DialogDescription className="text-sm opacity-70">
            Variable: <code className="bg-app-bg-secondary px-1 py-0.5 rounded text-xs">{prompt.varName}</code>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={prompt.defaultValue || 'Enter value...'}
              className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg
                         text-app-text focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent transition-all"
              autoFocus
            />
            {prompt.defaultValue && (
              <p className="text-xs opacity-60">
                Default: {prompt.defaultValue}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-app-border bg-app-bg-secondary
                         text-app-text hover:bg-app-bg-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700
                         transition-colors font-medium"
            >
              Continue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default PromptDialog;
