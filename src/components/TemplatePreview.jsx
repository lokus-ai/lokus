import React, { useState, useEffect, useMemo } from 'react';
import {
  Eye,
  EyeOff,
  Code,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  Copy,
  Wand2,
  Variable,
  Settings
} from 'lucide-react';
import { useTemplateProcessor, useBuiltinVariables } from '../hooks/useTemplates.js';

export default function TemplatePreview({ 
  template, 
  open, 
  onClose,
  variables = {},
  onVariablesChange,
  onInsert,
  context = {}
}) {
  const { preview, processing, previewData, error } = useTemplateProcessor();
  const { resolveAll: resolveBuiltins } = useBuiltinVariables();
  
  const [currentVariables, setCurrentVariables] = useState({});
  const [showRawTemplate, setShowRawTemplate] = useState(false);
  const [showVariables, setShowVariables] = useState(true);
  const [validationErrors, setValidationErrors] = useState([]);

  // Parse template variables
  const templateVars = useMemo(() => {
    if (!template?.content) return [];
    
    try {
      // Extract variables from template content
      const variablePattern = /\{\{([^}]+)\}\}/g;
      const variables = [];
      let match;

      while ((match = variablePattern.exec(template.content)) !== null) {
        const fullMatch = match[0];
        const variableName = match[1].trim();

        // Parse variable with optional filters and default values
        const parts = variableName.split('|');
        const name = parts[0].trim();
        const filters = parts.slice(1).map(f => f.trim());

        // Check for default value syntax: variable || 'default'
        const defaultMatch = name.match(/^([^|]+)\s*\|\|\s*(.+)$/);
        let variableParts, defaultValue;

        if (defaultMatch) {
          variableParts = defaultMatch[1].trim();
          defaultValue = defaultMatch[2].trim().replace(/^['"]|['"]$/g, '');
        } else {
          variableParts = name;
          defaultValue = '';
        }

        // Avoid duplicates
        if (!variables.find(v => v.name === variableParts)) {
          variables.push({
            name: variableParts,
            defaultValue,
            filters,
            required: !defaultValue,
            fullMatch
          });
        }
      }

      return variables;
    } catch (err) {
      return [];
    }
  }, [template?.content]);

  // Initialize variables
  useEffect(() => {
    if (open && template) {
      const builtins = resolveBuiltins(context);
      const merged = { ...builtins, ...variables };
      
      // Set default values for template variables
      const withDefaults = { ...merged };
      templateVars.forEach(variable => {
        if (!(variable.name in withDefaults)) {
          withDefaults[variable.name] = variable.defaultValue || '';
        }
      });
      
      setCurrentVariables(withDefaults);
      onVariablesChange?.(withDefaults);
    }
  }, [open, template, variables, templateVars, resolveBuiltins, context, onVariablesChange]);

  // Update preview when variables change
  useEffect(() => {
    if (open && template && Object.keys(currentVariables).length > 0) {
      preview(template.id, currentVariables, { context })
        .catch(err => {
        });
    }
  }, [open, template, currentVariables, preview, context]);

  // Handle variable change
  const handleVariableChange = (name, value) => {
    const updated = { ...currentVariables, [name]: value };
    setCurrentVariables(updated);
    onVariablesChange?.(updated);
  };

  // Validate variables
  useEffect(() => {
    const errors = [];
    
    templateVars.forEach(variable => {
      const value = currentVariables[variable.name];
      if (variable.required && (!value || value.trim() === '')) {
        errors.push(`Variable "${variable.name}" is required`);
      }
    });
    
    setValidationErrors(errors);
  }, [templateVars, currentVariables]);

  // Handle insert
  const handleInsert = () => {
    if (validationErrors.length === 0 && previewData?.result) {
      onInsert?.(previewData.result, currentVariables);
      onClose?.();
    }
  };

  // Copy to clipboard
  const handleCopy = async () => {
    if (previewData?.result) {
      try {
        await navigator.clipboard.writeText(previewData.result);
      } catch { }
    }
  };

  if (!open || !template) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-app-panel border border-app-border rounded-lg shadow-lg w-full max-w-6xl h-[85vh] flex">
        
        {/* Variables Panel */}
        {showVariables && (
          <div className="w-80 border-r border-app-border flex flex-col">
            {/* Variables Header */}
            <div className="p-4 border-b border-app-border">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-app-text flex items-center gap-2">
                  <Variable size={16} />
                  Variables
                </h3>
                <button
                  onClick={() => setShowVariables(false)}
                  className="p-1 hover:bg-app-bg rounded transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Variables Content */}
            <div className="flex-1 overflow-auto p-4">
              {templateVars.length === 0 ? (
                <div className="text-center text-app-muted py-8">
                  <Variable size={24} className="mx-auto mb-2 opacity-50" />
                  <p>No variables in this template</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templateVars.map(variable => (
                    <div key={variable.name} className="space-y-2">
                      <label className="block">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-app-text">
                            {variable.name}
                          </span>
                          {variable.required && (
                            <span className="text-xs text-red-500">*</span>
                          )}
                        </div>
                        
                        <input
                          type="text"
                          value={currentVariables[variable.name] || ''}
                          onChange={(e) => handleVariableChange(variable.name, e.target.value)}
                          placeholder={variable.defaultValue || `Enter ${variable.name}`}
                          className={`w-full px-3 py-2 bg-app-bg border rounded-md outline-none transition-colors ${
                            variable.required && !currentVariables[variable.name]?.trim()
                              ? 'border-red-500 focus:ring-2 focus:ring-red-500/40'
                              : 'border-app-border focus:ring-2 focus:ring-app-accent/40'
                          }`}
                        />
                        
                        {variable.defaultValue && (
                          <div className="text-xs text-app-muted mt-1">
                            Default: {variable.defaultValue}
                          </div>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}

              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-md">
                  <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-2">
                    <AlertCircle size={16} />
                    Validation Errors
                  </div>
                  <ul className="text-sm text-red-400 space-y-1">
                    {validationErrors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Main Preview Panel */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-app-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-app-text">
                Template Preview
              </h2>
              <span className="text-sm text-app-muted">
                {template.name}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!showVariables && templateVars.length > 0 && (
                <button
                  onClick={() => setShowVariables(true)}
                  className="flex items-center gap-2 px-3 py-2 border border-app-border rounded-md hover:bg-app-bg transition-colors"
                >
                  <Settings size={16} />
                  Variables
                </button>
              )}

              <button
                onClick={() => setShowRawTemplate(!showRawTemplate)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors ${
                  showRawTemplate
                    ? 'bg-app-accent text-app-accent-fg border-app-accent'
                    : 'border-app-border hover:bg-app-bg'
                }`}
              >
                {showRawTemplate ? <EyeOff size={16} /> : <Code size={16} />}
                {showRawTemplate ? 'Preview' : 'Source'}
              </button>

              <button
                onClick={onClose}
                className="p-2 hover:bg-app-bg rounded-md transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {processing && (
              <div className="p-8 text-center text-app-muted">
                <Wand2 className="animate-spin mx-auto mb-2" size={24} />
                Processing template...
              </div>
            )}

            {error && (
              <div className="p-8">
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-red-500 font-medium mb-2">
                    <AlertCircle size={20} />
                    Preview Error
                  </div>
                  <p className="text-red-400">{error}</p>
                </div>
              </div>
            )}

            {!processing && !error && (
              <div className="h-full">
                {showRawTemplate ? (
                  // Raw template source
                  <div className="h-full p-4">
                    <pre className="bg-app-bg border border-app-border rounded-lg p-4 h-full overflow-auto text-sm font-mono">
                      <code>{template.content}</code>
                    </pre>
                  </div>
                ) : (
                  // Processed preview
                  <div className="h-full p-4">
                    {previewData?.result ? (
                      <div className="bg-app-bg border border-app-border rounded-lg h-full overflow-auto">
                        <div className="p-4">
                          <pre className="whitespace-pre-wrap font-sans text-app-text">
                            {previewData.result}
                          </pre>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-app-muted py-8">
                        <FileText size={24} className="mx-auto mb-2 opacity-50" />
                        <p>Preview will appear here</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-app-border flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-app-muted">
              {validationErrors.length === 0 ? (
                <>
                  <CheckCircle size={16} className="text-green-500" />
                  <span>Ready to insert</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-red-500" />
                  <span>{validationErrors.length} error{validationErrors.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {previewData?.result && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-2 px-3 py-2 border border-app-border rounded-md hover:bg-app-bg transition-colors"
                >
                  <Copy size={16} />
                  Copy
                </button>
              )}

              <button
                onClick={onClose}
                className="px-3 py-2 border border-app-border rounded-md hover:bg-app-bg transition-colors"
              >
                Cancel
              </button>

              <button
                onClick={handleInsert}
                disabled={validationErrors.length > 0 || !previewData?.result}
                className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                  validationErrors.length === 0 && previewData?.result
                    ? 'bg-app-accent text-app-accent-fg hover:bg-app-accent/80'
                    : 'bg-app-muted text-app-muted-fg cursor-not-allowed'
                }`}
              >
                <Wand2 size={16} />
                Insert
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}