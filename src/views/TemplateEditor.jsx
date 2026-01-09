import React, { useState, useEffect, useCallback } from 'react';
import {
  Save,
  X,
  Eye,
  Code,
  Variable,
  Tag,
  Folder,
  FileText,
  AlertCircle,
  CheckCircle,
  Wand2,
  Copy,
  RotateCcw,
  HelpCircle,
  Lightbulb
} from 'lucide-react';
import { useTemplates, useTemplateValidation, useBuiltinVariables } from '../hooks/useTemplates.js';
import TemplatePreview from '../components/TemplatePreview.jsx';

export default function TemplateEditor({
  template = null, // null for new template
  onSave,
  onCancel,
  onClose
}) {
  const { createTemplate, updateTemplate, getCategories, getTags } = useTemplates();
  const { validate, getStatistics } = useTemplateValidation();
  const { getVariablesByCategory } = useBuiltinVariables();

  // Form state
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    content: '',
    category: 'general',
    tags: [],
    metadata: {}
  });

  // UI state
  const [showPreview, setShowPreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showVariables, setShowVariables] = useState(false);
  const [validation, setValidation] = useState({ valid: true, errors: [], warnings: [] });
  const [statistics, setStatistics] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Categories and tags
  const [categories, setCategories] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [builtinVariables, setBuiltinVariables] = useState({});
  const [newTag, setNewTag] = useState('');

  // Initialize form data
  useEffect(() => {
    if (template) {
      setFormData({
        id: template.id,
        name: template.name,
        content: template.content,
        category: template.category,
        tags: [...template.tags],
        metadata: { ...template.metadata }
      });
    } else {
      // New template
      setFormData({
        id: `template_${Date.now()}`,
        name: '',
        content: '',
        category: 'general',
        tags: [],
        metadata: {}
      });
    }
  }, [template]);

  // Load data
  useEffect(() => {
    try {
      setCategories(getCategories());
      setAllTags(getTags());
      setBuiltinVariables(getVariablesByCategory());
    } catch (err) {
      console.error('TemplateEditor: Failed to load template data', err);
    }
  }, [getCategories, getTags, getVariablesByCategory]);

  // Validate template content
  useEffect(() => {
    if (formData.content) {
      const validationResult = validate(formData.content);
      setValidation(validationResult);

      const stats = getStatistics(formData.content);
      setStatistics(stats);
    } else {
      setValidation({ valid: true, errors: [], warnings: [] });
      setStatistics(null);
    }
  }, [formData.content, validate, getStatistics]);

  // Handle form changes
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle tag operations
  const addTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      handleChange('tags', [...formData.tags, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove) => {
    handleChange('tags', formData.tags.filter(tag => tag !== tagToRemove));
  };

  const addExistingTag = (tag) => {
    if (!formData.tags.includes(tag)) {
      handleChange('tags', [...formData.tags, tag]);
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('Template name is required');
      return;
    }

    if (!formData.content.trim()) {
      setError('Template content is required');
      return;
    }

    if (!validation.valid) {
      setError('Please fix validation errors before saving');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const templateData = {
        ...formData,
        name: formData.name.trim(),
        content: formData.content.trim()
      };

      let savedTemplate;
      if (template) {
        // Update existing
        savedTemplate = await updateTemplate(template.id, templateData);
      } else {
        // Create new
        savedTemplate = await createTemplate(templateData);
      }

      onSave?.(savedTemplate);
      onClose?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Insert variable at cursor
  const insertVariable = (variableName) => {
    const textarea = document.getElementById('template-content');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = formData.content.substring(0, start);
      const after = formData.content.substring(end);
      const newContent = before + `{{${variableName}}}` + after;

      handleChange('content', newContent);

      // Set cursor position after insertion
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variableName.length + 4, start + variableName.length + 4);
      }, 0);
    }
  };

  // Insert template snippets
  const insertSnippet = (snippet) => {
    const textarea = document.getElementById('template-content');
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = formData.content.substring(0, start);
      const after = formData.content.substring(end);
      const newContent = before + snippet + after;

      handleChange('content', newContent);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    }
  };

  const templateSnippets = [
    { name: 'Variable with default', snippet: '{{variable || "default value"}}' },
    { name: 'JavaScript expression', snippet: '<% expression %>' },
    { name: 'JavaScript block', snippet: '<%\n  // JavaScript code here\n%>' },
    { name: 'Comment', snippet: '<%# This is a comment %>' },
    { name: 'Cursor placeholder', snippet: '{{cursor}}' },
    { name: 'Date variable', snippet: '{{date}}' },
    { name: 'User variable', snippet: '{{user}}' }
  ];

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">
            {template ? 'Edit Template' : 'New Template'}
          </h1>
          {formData.name && (
            <span className="text-sm text-app-muted">
              {formData.name}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-md transition-colors ${showHelp ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'
              }`}
            title="Help"
          >
            <HelpCircle size={16} />
          </button>

          <button
            onClick={() => setShowVariables(!showVariables)}
            className={`flex items-center gap-2 px-3 py-1 border border-app-border rounded-md transition-colors ${showVariables ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'
              }`}
          >
            <Variable size={16} />
            Variables
          </button>

          <button
            onClick={() => setShowPreview(true)}
            disabled={!formData.content.trim()}
            className="flex items-center gap-2 px-3 py-1 border border-app-border rounded-md hover:bg-app-bg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eye size={16} />
            Preview
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !validation.valid || !formData.name.trim() || !formData.content.trim()}
            className="flex items-center gap-2 px-3 py-1 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save'}
          </button>

          <button
            onClick={onClose}
            className="p-2 hover:bg-app-bg rounded-md transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Variables Sidebar */}
        {showVariables && (
          <div className="w-80 border-r border-app-border bg-app-panel/50 flex flex-col">
            <div className="p-4 border-b border-app-border">
              <h3 className="font-medium mb-3">Built-in Variables</h3>

              {Object.entries(builtinVariables).map(([category, vars]) => (
                <div key={category} className="mb-4">
                  <h4 className="text-sm font-medium text-app-muted uppercase tracking-wide mb-2">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {vars.map(variable => (
                      <button
                        key={variable.name}
                        onClick={() => insertVariable(variable.name)}
                        className="w-full text-left px-2 py-1 text-sm hover:bg-app-bg rounded transition-colors"
                      >
                        <div className="font-mono text-app-accent">
                          {variable.name}
                        </div>
                        <div className="text-xs text-app-muted">
                          {variable.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="mt-6">
                <h4 className="text-sm font-medium text-app-muted uppercase tracking-wide mb-2">
                  Snippets
                </h4>
                <div className="space-y-1">
                  {templateSnippets.map(snippet => (
                    <button
                      key={snippet.name}
                      onClick={() => insertSnippet(snippet.snippet)}
                      className="w-full text-left px-2 py-1 text-sm hover:bg-app-bg rounded transition-colors"
                    >
                      <div className="text-app-text">{snippet.name}</div>
                      <div className="text-xs font-mono text-app-muted">
                        {snippet.snippet}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Help Sidebar */}
        {showHelp && (
          <div className="w-80 border-r border-app-border bg-app-panel/50 flex flex-col">
            <div className="p-4 border-b border-app-border">
              <h3 className="font-medium mb-3">Template Syntax Help</h3>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h4 className="font-medium mb-2">Variables</h4>
                <div className="text-sm text-app-muted space-y-1">
                  <div><code className="bg-app-bg px-1 rounded">{'{{variable}}'}</code> - Simple variable</div>
                  <div><code className="bg-app-bg px-1 rounded">{'{{variable || "default"}}'}</code> - With default value</div>
                  <div><code className="bg-app-bg px-1 rounded">{'{{cursor}}'}</code> - Cursor position placeholder</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">JavaScript</h4>
                <div className="text-sm text-app-muted space-y-1">
                  <div><code className="bg-app-bg px-1 rounded">{'<% expression %>'}</code> - JavaScript expression</div>
                  <div><code className="bg-app-bg px-1 rounded">{'<% code %>'}</code> - JavaScript code block</div>
                  <div><code className="bg-app-bg px-1 rounded">{'<%# comment %>'}</code> - Comments</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Built-in Variables</h4>
                <div className="text-sm text-app-muted space-y-1">
                  <div><code className="bg-app-bg px-1 rounded">{'{{date}}'}</code> - Current date</div>
                  <div><code className="bg-app-bg px-1 rounded">{'{{time}}'}</code> - Current time</div>
                  <div><code className="bg-app-bg px-1 rounded">{'{{user}}'}</code> - Username</div>
                  <div><code className="bg-app-bg px-1 rounded">{'{{title}}'}</code> - Document title</div>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-2">Examples</h4>
                <div className="text-sm text-app-muted space-y-2">
                  <div className="bg-app-bg p-2 rounded">
                    <div className="font-mono text-xs">
                      # {'{{title || "Meeting Notes"}}'}
                      <br />
                      Date: {'{{date}}'}
                      <br />
                      Attendees: {'{{attendees}}'}
                      <br /><br />
                      ## Agenda
                      {'{{cursor}}'}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Form */}
          <div className="p-4 border-b border-app-border bg-app-panel/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Enter template name"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => handleChange('category', e.target.value)}
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
                >
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Tags
                </label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag"
                    className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/80 transition-colors"
                  >
                    Add
                  </button>
                </div>

                {/* Current Tags */}
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.tags.map(tag => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-app-accent/20 text-app-accent rounded-md text-sm"
                      >
                        #{tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-red-500 transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Suggested Tags */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {allTags.filter(tag => !formData.tags.includes(tag)).slice(0, 5).map(tag => (
                      <button
                        key={tag}
                        onClick={() => addExistingTag(tag)}
                        className="px-2 py-1 text-xs border border-app-border rounded-md hover:bg-app-panel transition-colors"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content Editor */}
          <div className="flex-1 flex flex-col">
            {/* Editor Header */}
            <div className="px-4 py-2 border-b border-app-border bg-app-panel/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code size={16} className="text-app-muted" />
                <span className="text-sm font-medium">Template Content</span>
              </div>

              {/* Validation Status */}
              <div className="flex items-center gap-2 text-sm">
                {validation.valid ? (
                  <div className="flex items-center gap-1 text-green-500">
                    <CheckCircle size={16} />
                    Valid
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-500">
                    <AlertCircle size={16} />
                    {validation.errors.length} error{validation.errors.length !== 1 ? 's' : ''}
                  </div>
                )}

                {statistics && (
                  <div className="text-app-muted">
                    {statistics.variables.count} vars • {statistics.jsBlocks.count} blocks • {statistics.length} chars
                  </div>
                )}
              </div>
            </div>

            {/* Editor */}
            <div className="flex-1 relative">
              <textarea
                id="template-content"
                value={formData.content}
                onChange={(e) => handleChange('content', e.target.value)}
                placeholder="Enter your template content here...

Examples:
# {{title || &quot;My Template&quot;}}
Date: {{date}}
Author: {{user}}

{{cursor}}

<% if (condition) { %>
  Conditional content
<% } %>"
                className="w-full h-full p-4 bg-app-bg border-0 outline-none resize-none font-mono text-sm"
              />
            </div>

            {/* Validation Messages */}
            {(validation.errors.length > 0 || validation.warnings.length > 0) && (
              <div className="border-t border-app-border p-4 bg-app-panel/30">
                {validation.errors.length > 0 && (
                  <div className="mb-2">
                    <div className="flex items-center gap-2 text-red-500 font-medium mb-1">
                      <AlertCircle size={16} />
                      Errors
                    </div>
                    <ul className="text-sm text-red-400 space-y-1">
                      {validation.errors.map((error, index) => (
                        <li key={index}>• {error}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {validation.warnings.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 text-yellow-500 font-medium mb-1">
                      <Lightbulb size={16} />
                      Warnings
                    </div>
                    <ul className="text-sm text-yellow-400 space-y-1">
                      {validation.warnings.map((warning, index) => (
                        <li key={index}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-4 border-t border-app-border bg-red-500/10">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle size={16} />
                {error}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && formData.content.trim() && (
        <TemplatePreview
          template={formData}
          open={showPreview}
          onClose={() => setShowPreview(false)}
          onInsert={(result, variables) => {
            setShowPreview(false);
          }}
        />
      )}
    </div>
  );
}