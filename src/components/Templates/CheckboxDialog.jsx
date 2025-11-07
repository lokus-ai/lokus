import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

/**
 * CheckboxDialog - Checkbox/boolean dialog for template prompts
 *
 * Displays a dialog with a checkbox to collect boolean input
 * for template variables defined with {{checkbox:varName:question:defaultBool}}
 */
const CheckboxDialog = ({
  open,
  onOpenChange,
  prompt,
  onSubmit,
  onCancel
}) => {
  const [checked, setChecked] = useState(false);

  // Initialize with default value when dialog opens
  useEffect(() => {
    if (open && prompt) {
      setChecked(prompt.defaultValue === true || prompt.defaultValue === 'true');
    }
  }, [open, prompt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(checked);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === ' ') {
      e.preventDefault();
      setChecked(!checked);
    }
  };

  if (!prompt) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {prompt.question || 'Select option'}
          </DialogTitle>
          <DialogDescription className="text-sm opacity-70">
            Variable: <code className="bg-app-bg-secondary px-1 py-0.5 rounded text-xs">{prompt.varName}</code>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-4 py-4">
            <label
              className="flex items-center space-x-3 cursor-pointer group p-3 rounded-lg
                         hover:bg-app-bg-secondary transition-colors"
              onKeyDown={handleKeyDown}
              tabIndex={0}
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => setChecked(e.target.checked)}
                  className="sr-only"
                />
                <div
                  className={`w-6 h-6 border-2 rounded transition-all flex items-center justify-center
                    ${checked
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-app-bg-secondary border-app-border group-hover:border-blue-400'
                    }`}
                >
                  {checked && (
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="3"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path d="M5 13l4 4L19 7"></path>
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-app-text select-none flex-1">
                {prompt.question}
              </span>
            </label>

            <div className="pl-9 text-xs opacity-60">
              Press <kbd className="px-1.5 py-0.5 bg-app-bg-secondary rounded border border-app-border">Space</kbd> to toggle
            </div>
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

export default CheckboxDialog;
