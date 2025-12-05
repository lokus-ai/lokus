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
 * SuggestDialog - Dropdown selection dialog for template prompts
 *
 * Displays a dialog with a dropdown/select field to collect user selection
 * for template variables defined with {{suggest:varName:question:option1,option2:default}}
 */
const SuggestDialog = ({
  open,
  onOpenChange,
  prompt,
  onSubmit,
  onCancel
}) => {
  const [value, setValue] = useState('');
  const [customValue, setCustomValue] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  // Initialize with default value when dialog opens
  useEffect(() => {
    if (open && prompt) {
      const defaultVal = prompt.defaultValue || (prompt.options && prompt.options[0]) || '';
      setValue(defaultVal);
      setShowCustom(false);
      setCustomValue('');
    }
  }, [open, prompt]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalValue = showCustom ? customValue : value;
    onSubmit(finalValue);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    }
  };

  const handleSelectChange = (e) => {
    const selectedValue = e.target.value;
    if (selectedValue === '__custom__') {
      setShowCustom(true);
      setCustomValue('');
    } else {
      setShowCustom(false);
      setValue(selectedValue);
    }
  };

  if (!prompt) return null;

  const options = prompt.options || [];

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
          <div className="space-y-2">
            <select
              value={showCustom ? '__custom__' : value}
              onChange={handleSelectChange}
              onKeyDown={handleKeyDown}
              className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg
                         text-app-text focus:outline-none focus:ring-2 focus:ring-blue-500
                         focus:border-transparent transition-all cursor-pointer"
              autoFocus={!showCustom}
            >
              {options.map((option, index) => (
                <option key={index} value={option}>
                  {option}
                </option>
              ))}
              <option value="__custom__">Custom value...</option>
            </select>

            {showCustom && (
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter custom value..."
                className="w-full px-3 py-2 bg-app-bg-secondary border border-app-border rounded-lg
                           text-app-text focus:outline-none focus:ring-2 focus:ring-blue-500
                           focus:border-transparent transition-all mt-2"
                autoFocus
              />
            )}

            {!showCustom && prompt.defaultValue && (
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
              disabled={showCustom && !customValue}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700
                         transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SuggestDialog;
