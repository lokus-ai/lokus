import React, { useState, useEffect } from 'react';
import { Save, FileText, Tag, Folder, AlertCircle, Eye, Code, Sparkles } from 'lucide-react';
import { useTemplates } from '../hooks/useTemplates.js';
import { getMarkdownCompiler } from '../core/markdown/compiler.js';
import { htmlToMarkdown } from '../core/templates/html-to-markdown.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Label } from './ui/label.jsx';
import { Textarea } from './ui/textarea.jsx';
import { Badge } from './ui/badge.jsx';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.jsx';
import platformService from '../services/platform/PlatformService.js';

export default function CreateTemplate({
  open,
  onClose,
  initialContent = '',
  onSaved
}) {
  const { createTemplate, getCategories, templates } = useTemplates();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Personal');
  const [tags, setTags] = useState([]);
  const [tagInput, setTagInput] = useState('');
  const [content, setContent] = useState(initialContent);
  const [activeTab, setActiveTab] = useState('edit');
  const [previewHtml, setPreviewHtml] = useState('');
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  // Load categories
  useEffect(() => {
    if (open) {
      try {
        setCategories(getCategories());
      } catch (err) {
        console.error('Failed to load categories:', err);
      }
    }
  }, [open, getCategories]);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      let processedContent = initialContent;

      if (initialContent) {
        const hasHTMLTags = /<[a-z][\s\S]*>/i.test(initialContent);

        if (hasHTMLTags) {
          try {
            processedContent = htmlToMarkdown.convert(initialContent);
          } catch (err) {
            console.error('HTML to Markdown conversion failed:', err);
            processedContent = initialContent;
          }
        }
      }

      setContent(processedContent);
      setName('');
      setCategory('Personal');
      setTags([]);
      setTagInput('');
      setActiveTab('edit');
      setSaving(false);
      setDuplicateWarning(false);
    }
  }, [open, initialContent]);

  // Check for duplicate template names
  useEffect(() => {
    if (name.trim() && templates.length > 0) {
      const templateId = generateId(name);
      const exists = templates.some(t => t.id === templateId);
      setDuplicateWarning(exists);
    } else {
      setDuplicateWarning(false);
    }
  }, [name, templates]);

  // Generate template preview
  useEffect(() => {
    if (activeTab !== 'preview' || !content) {
      setPreviewHtml('');
      return;
    }

    const generatePreview = async () => {
      try {
        const compiler = getMarkdownCompiler();
        const html = await compiler.process(content);
        setPreviewHtml(html);
      } catch (err) {
        setPreviewHtml('<p class="text-red-500">Failed to generate preview</p>');
      }
    };

    generatePreview();
  }, [content, activeTab]);

  // Generate template ID from name
  const generateId = (templateName) => {
    return templateName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  // Handle tag input
  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const tag = tagInput.trim();
      if (tag && !tags.includes(tag)) {
        setTags([...tags, tag]);
        setTagInput('');
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  // Remove tag
  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // Handle save
  const handleSave = async () => {
    if (!name.trim() || !content.trim()) {
      return;
    }

    const templateId = generateId(name);

    // Check for duplicate and confirm overwrite
    if (duplicateWarning) {
      const confirmed = confirm(
        `A template named "${name}" already exists. This will overwrite the existing template file. Continue?`
      );
      if (!confirmed) {
        return;
      }
    }

    setSaving(true);

    try {
      const templateData = {
        id: templateId,
        name: name.trim(),
        content: content.trim(),
        category: category,
        tags: tags,
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
      <DialogContent className="w-full max-w-5xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-app-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="p-2 bg-app-accent/10 rounded-lg">
                <Sparkles className="h-5 w-5 text-app-accent" />
              </div>
              Create Template
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Create a reusable template from your content. Templates support variables like{' '}
              <code className="px-1.5 py-0.5 bg-app-panel rounded text-xs font-mono">{`{{date}}`}</code>
              {' '}and{' '}
              <code className="px-1.5 py-0.5 bg-app-panel rounded text-xs font-mono">{`{{cursor}}`}</code>.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Form */}
          <div className="w-2/5 border-r border-app-border p-6 overflow-y-auto">
            <div className="space-y-6">
              {/* Template Name */}
              <div className="space-y-2">
                <Label htmlFor="template-name" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Template Name
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="template-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Daily Standup Notes"
                  className={duplicateWarning ? 'border-yellow-500 focus-visible:ring-yellow-500/40' : ''}
                />
                {duplicateWarning && (
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      A template with this name already exists and will be overwritten
                    </p>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label htmlFor="category" className="flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Category
                </Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Personal">Personal</SelectItem>
                    <SelectItem value="Work">Work</SelectItem>
                    <SelectItem value="Documentation">Documentation</SelectItem>
                    <SelectItem value="Notes">Notes</SelectItem>
                    <SelectItem value="Projects">Projects</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags" className="flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </Label>
                <div className="flex flex-wrap gap-2 p-2 min-h-[42px] border border-app-border rounded-md bg-app-bg focus-within:ring-2 focus-within:ring-app-accent/40">
                  {tags.map(tag => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 pl-2 pr-1 cursor-pointer hover:bg-app-panel/60"
                      onClick={() => removeTag(tag)}
                    >
                      {tag}
                      <span className="text-app-muted hover:text-app-text">×</span>
                    </Badge>
                  ))}
                  <input
                    id="tags"
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                    placeholder={tags.length === 0 ? "Add tags (press Enter)" : ""}
                    className="flex-1 min-w-[120px] bg-transparent outline-none text-sm placeholder:text-app-muted"
                  />
                </div>
                <p className="text-xs text-app-muted">
                  Press Enter or comma to add tags
                </p>
              </div>

              {/* Info Box */}
              <div className="p-4 bg-app-accent/5 border border-app-accent/20 rounded-lg space-y-2">
                <h4 className="text-sm font-medium text-app-text flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-app-accent" />
                  Available Variables
                </h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <code className="px-2 py-1 bg-app-panel rounded font-mono">{`{{date}}`}</code>
                  <code className="px-2 py-1 bg-app-panel rounded font-mono">{`{{time}}`}</code>
                  <code className="px-2 py-1 bg-app-panel rounded font-mono">{`{{cursor}}`}</code>
                  <code className="px-2 py-1 bg-app-panel rounded font-mono">{`{{title}}`}</code>
                </div>
                <p className="text-xs text-app-muted mt-2">
                  Use variables for dynamic content in your templates
                </p>
              </div>
            </div>
          </div>

          {/* Right Panel - Content Editor */}
          <div className="flex-1 flex flex-col">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <div className="px-6 pt-4 pb-2 border-b border-app-border">
                <TabsList className="w-full justify-start">
                  <TabsTrigger value="edit" className="gap-2">
                    <Code className="h-4 w-4" />
                    Edit
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="gap-2">
                    <Eye className="h-4 w-4" />
                    Preview
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="edit" className="flex-1 m-0 p-6 overflow-hidden">
                <div className="h-full flex flex-col space-y-2">
                  <Label htmlFor="content">
                    Template Content
                    <span className="text-red-500 ml-1">*</span>
                  </Label>
                  <Textarea
                    id="content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={`# {{title || "Template Title"}}

**Date:** {{date}}
**Time:** {{time}}

## Content
{{cursor}}

Add your template content here. Use {{variable}} for dynamic values.`}
                    className="flex-1 resize-none font-mono text-sm"
                  />
                  <p className="text-xs text-app-muted">
                    {content.length} characters • Markdown supported
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="preview" className="flex-1 m-0 p-6 overflow-auto">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {previewHtml ? (
                    <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  ) : (
                    <div className="text-center text-app-muted py-12">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>Preview will appear here</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border bg-app-panel/30">
          <div className="flex items-center justify-between">
            <div className="text-sm text-app-muted">
              <div>Template will be available in Command Palette ({platformService.getModifierSymbol()}+K)</div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={onClose}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !name.trim() || !content.trim()}
                variant={duplicateWarning ? "destructive" : "default"}
                className="gap-2"
              >
                {duplicateWarning ? (
                  <>
                    <AlertCircle className="h-4 w-4" />
                    {saving ? 'Overwriting...' : 'Overwrite Template'}
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Template'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
