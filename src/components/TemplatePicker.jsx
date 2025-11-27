import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Tag,
  Clock,
  Plus,
  Eye,
  Copy,
  Trash2,
  Edit,
  X
} from 'lucide-react';
import { useTemplates, useTemplateProcessor } from '../hooks/useTemplates.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog.jsx';
import { Button } from './ui/button.jsx';
import { Input } from './ui/input.jsx';
import { Badge } from './ui/badge.jsx';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select.jsx';

export default function TemplatePicker({
  open,
  onClose,
  onSelect,
  onEdit,
  onPreview,
  showPreview = true,
  allowCreate = true,
  allowEdit = true,
  allowDelete = true,
  allowDuplicate = true
}) {
  const {
    templates,
    loading,
    error,
    getCategories,
    getTags,
    deleteTemplate,
    duplicateTemplate
  } = useTemplates();

  const { process: processTemplate } = useTemplateProcessor();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('updated-desc');
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);

  // Load categories and tags
  useEffect(() => {
    if (open) {
      try {
        setCategories(getCategories());
        setTags(getTags());
      } catch (err) {
        console.error('Error loading categories/tags:', err);
      }
    }
  }, [open, getCategories, getTags, templates]);

  // Filter and sort templates
  useEffect(() => {
    let filtered = [...templates];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(template =>
        selectedTags.some(tag => template.tags.includes(tag))
      );
    }

    const [field, order] = sortBy.split('-');
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (field) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'created':
          aValue = new Date(a.metadata.createdAt);
          bValue = new Date(b.metadata.createdAt);
          break;
        case 'updated':
          aValue = new Date(a.metadata.updatedAt);
          bValue = new Date(b.metadata.updatedAt);
          break;
        case 'size':
          aValue = a.content.length;
          bValue = b.content.length;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }

      const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return order === 'desc' ? -result : result;
    });

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory, selectedTags, sortBy]);

  const handleSelect = async (template) => {
    try {
      const result = await processTemplate(template.id, {}, {
        context: {}
      });

      onSelect?.(template, result.result || result.content || result);
      onClose?.();
    } catch (err) {
      onSelect?.(template, template.content);
      onClose?.();
    }
  };

  const handlePreview = (template, event) => {
    event.stopPropagation();
    onPreview?.(template);
  };

  const handleEdit = (template, event) => {
    event.stopPropagation();
    onEdit?.(template);
  };

  const handleDuplicate = async (template, event) => {
    event.stopPropagation();

    try {
      const newId = `${template.id}_copy_${Date.now()}`;
      await duplicateTemplate(template.id, newId, {
        name: `${template.name} (Copy)`
      });
    } catch (err) {
      console.error('Failed to duplicate template:', err);
    }
  };

  const handleDelete = async (template, event) => {
    event.stopPropagation();

    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      try {
        await deleteTemplate(template.id);
      } catch (err) {
        console.error('Failed to delete template:', err);
      }
    }
  };

  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMinutes = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  // Get clean description from template
  const getDescription = (template) => {
    if (template.metadata?.description && template.metadata.description !== 'Template created from content') {
      return template.metadata.description;
    }

    // Extract clean text from content
    let text = template.content
      // Remove template variables
      .replace(/\{\{[^}]+\}\}/g, '')
      // Remove markdown syntax
      .replace(/^#+\s+/gm, '')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      // Remove list markers
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      // Remove extra whitespace
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Return first meaningful sentence or fallback
    const firstSentence = text.split(/[.!?]/)[0].trim();
    return firstSentence || `A ${template.category.toLowerCase()} template`;
  };

  const renderTemplateCard = (template) => (
    <div
      key={template.id}
      onClick={() => handleSelect(template)}
      className="group relative bg-app-panel border border-app-border rounded-lg p-4 hover:border-app-accent cursor-pointer transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 bg-app-bg border border-app-border rounded-md shrink-0">
          <FileText className="h-4 w-4 text-app-muted" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-app-text truncate mb-1">
            {template.name}
          </h3>
          <p className="text-xs text-app-muted">
            {template.category}
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {showPreview && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => handlePreview(template, e)}
              className="h-7 w-7"
            >
              <Eye className="h-3.5 w-3.5" />
            </Button>
          )}
          {allowEdit && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => handleEdit(template, e)}
              className="h-7 w-7"
            >
              <Edit className="h-3.5 w-3.5" />
            </Button>
          )}
          {allowDuplicate && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => handleDuplicate(template, e)}
              className="h-7 w-7"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          )}
          {allowDelete && (
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => handleDelete(template, e)}
              className="h-7 w-7 text-red-500 hover:bg-red-500/10"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-app-muted line-clamp-2 mb-3">
        {getDescription(template)}
      </p>

      {/* Tags */}
      {template.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map(tag => (
            <Badge key={tag} variant="outline" className="text-xs">
              {tag}
            </Badge>
          ))}
          {template.tags.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{template.tags.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-app-muted pt-2 border-t border-app-border">
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{formatRelativeTime(template.metadata.updatedAt)}</span>
        </div>
        <span>{(template.content.length / 1024).toFixed(1)}KB</span>
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-app-panel border border-app-border rounded-lg mb-4">
        <FileText className="h-12 w-12 text-app-muted" />
      </div>
      <h3 className="text-lg font-medium text-app-text mb-2">
        {searchQuery || selectedCategory !== 'all' || selectedTags.length > 0
          ? 'No templates found'
          : 'No templates yet'
        }
      </h3>
      <p className="text-sm text-app-muted mb-6">
        {searchQuery || selectedCategory !== 'all' || selectedTags.length > 0
          ? 'Try adjusting your filters or search'
          : 'Create your first template to get started'
        }
      </p>
      {allowCreate && !(searchQuery || selectedCategory !== 'all' || selectedTags.length > 0) && (
        <Button onClick={() => onEdit?.(null)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-6xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-app-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium">
              Select Template
            </DialogTitle>
            <DialogDescription className="text-sm mt-1">
              Choose a template to insert into your document
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 space-y-3 border-b border-app-border">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
              <Input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
              {searchQuery && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="Personal">Personal</SelectItem>
                <SelectItem value="Work">Work</SelectItem>
                <SelectItem value="Documentation">Documentation</SelectItem>
                <SelectItem value="Notes">Notes</SelectItem>
                <SelectItem value="Projects">Projects</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated-desc">Recent</SelectItem>
                <SelectItem value="name-asc">A-Z</SelectItem>
                <SelectItem value="name-desc">Z-A</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag className="h-3.5 w-3.5 text-app-muted" />
              {tags.slice(0, 8).map(tag => (
                <Badge
                  key={tag}
                  variant={selectedTags.includes(tag) ? "default" : "outline"}
                  onClick={() => toggleTag(tag)}
                  className="cursor-pointer text-xs"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-sm text-app-muted">Loading...</div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full">
              <p className="text-sm text-red-500">{error}</p>
            </div>
          )}

          {!loading && !error && filteredTemplates.length === 0 && renderEmptyState()}

          {!loading && !error && filteredTemplates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredTemplates.map(template => renderTemplateCard(template))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-app-border">
          <div className="flex items-center justify-between">
            <div className="text-sm text-app-muted">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </div>

            <div className="flex gap-2">
              {allowCreate && (
                <Button onClick={() => onEdit?.(null)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  New
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
