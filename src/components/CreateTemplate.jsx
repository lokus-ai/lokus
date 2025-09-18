import React, { useState, useEffect } from 'react';
import { Save, Eye, FileText, Tag, Folder, X } from 'lucide-react';
import { useTemplates } from '../hooks/useTemplates.js';
import { getMarkdownCompiler } from '../core/markdown/compiler.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.jsx';

export default function CreateTemplate({ 
  open, 
  onClose, 
  initialContent = '',
  onSaved 
}) {
  const { createTemplate, getCategories } = useTemplates();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Personal');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState(initialContent);
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);

  // Load categories
  useEffect(() => {
    if (open) {
      try {
        setCategories(getCategories());
      } catch (err) {
      }
    }
  }, [open, getCategories]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      setContent(initialContent);
      setName('');
      setCategory('Personal');
      setTags('');
      setShowPreview(false);
      setSaving(false);
    }
  }, [open, initialContent]);

  // Generate template preview
  const getPreview = () => {
    if (!content) return 'No content to preview';
    
    try {
      const compiler = getMarkdownCompiler();
      return compiler.process(content);
    } catch (err) {
      return content; // Fallback to raw content
    }
  };

  // Generate template ID from name
  const generateId = (templateName) => {
    return templateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      alert('Please provide both a name and content for the template');
      return;
    }

    setSaving(true);
    
    try {
      const templateId = generateId(name);
      const tagArray = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      
      const templateData = {
        id: templateId,
        name: name.trim(),
        content: content.trim(),
        category: category,
        tags: tagArray,
        metadata: {
          description: `Template created from content`,
          createdBy: 'user'
        }
      };

      await createTemplate(templateData);
      
      onSaved?.();
      onClose?.();
    } catch (err) {
      alert(`Failed to save template: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Create Template
          </DialogTitle>
          <DialogDescription>
            Create a reusable template from your content. Templates support variables like {`{{date}}`} and {`{{cursor}}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Left Panel - Form */}
          <div className="w-1/2 flex flex-col gap-4">
            {/* Template Name */}
            <div>
              <label className="block text-sm font-medium text-app-text mb-2">
                Template Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Daily Standup Notes"
                className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
              />
            </div>

            {/* Category & Tags */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  <Folder className="inline h-4 w-4 mr-1" />
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none"
                >
                  <option value="Personal">Personal</option>
                  <option value="Work">Work</option>
                  <option value="Documentation">Documentation</option>
                  <option value="Notes">Notes</option>
                  <option value="Projects">Projects</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-app-text mb-2">
                  <Tag className="inline h-4 w-4 mr-1" />
                  Tags
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="meeting, daily, notes"
                  className="w-full px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
                />
                <p className="text-xs text-app-muted mt-1">Separate with commas</p>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col">
              <label className="block text-sm font-medium text-app-text mb-2">
                Template Content *
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`# {{title || "Template Title"}}

**Date:** {{date}}
**Time:** {{time}}

## Content
{{cursor}}

Add your template content here. Use {{variable}} for dynamic values.`}
                className="flex-1 px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40 resize-none font-mono text-sm"
              />
              <p className="text-xs text-app-muted mt-1">
                Use <code>{'{{date}}'}</code>, <code>{'{{time}}'}</code>, <code>{'{{cursor}}'}</code> for dynamic content
              </p>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="w-1/2 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-app-text">
                <Eye className="inline h-4 w-4 mr-1" />
                Live Preview
              </label>
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="text-xs px-2 py-1 bg-app-accent/20 text-app-accent rounded"
              >
                {showPreview ? 'Hide' : 'Show'} Preview
              </button>
            </div>
            
            <div className="flex-1 bg-app-panel border border-app-border rounded-md p-3 overflow-auto">
              {showPreview ? (
                <div 
                  className="prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: getPreview() }}
                />
              ) : (
                <div className="text-app-muted text-sm">
                  Click "Show Preview" to see how your template will look when compiled.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center pt-4 border-t border-app-border">
          <div className="text-sm text-app-muted">
            Template will be available in Command Palette (Cmd+K)
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-app-border rounded-md hover:bg-app-panel transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim() || !content.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Template'}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}