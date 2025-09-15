import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Tag,
  Folder,
  Clock,
  Star,
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
    searchTemplates, 
    getCategories, 
    getTags,
    deleteTemplate,
    duplicateTemplate
  } = useTemplates();
  
  const { process: processTemplate } = useTemplateProcessor();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('updated');
  const [sortOrder, setSortOrder] = useState('desc');
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
        console.error('Failed to load categories/tags:', err);
      }
    }
  }, [open, getCategories, getTags]);

  // Filter and sort templates
  useEffect(() => {
    let filtered = [...templates];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(query) ||
        template.content.toLowerCase().includes(query) ||
        template.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (selectedCategory) {
      filtered = filtered.filter(template => template.category === selectedCategory);
    }

    // Apply tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(template =>
        selectedTags.some(tag => template.tags.includes(tag))
      );
    }

    // Sort templates
    filtered.sort((a, b) => {
      let aValue, bValue;

      switch (sortBy) {
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
      return sortOrder === 'desc' ? -result : result;
    });

    setFilteredTemplates(filtered);
  }, [templates, searchQuery, selectedCategory, selectedTags, sortBy, sortOrder]);

  // Handle template selection
  const handleSelect = async (template) => {
    try {
      // Process the template with built-in variables
      const result = await processTemplate(template.id, {}, {
        context: {
          // Add any context like current file info
        }
      });
      
      // Call onSelect with both template and processed content
      onSelect?.(template, result.content);
      onClose?.();
    } catch (err) {
      console.error('Failed to process template:', err);
      // Fallback to raw template content
      onSelect?.(template, template.content);
      onClose?.();
    }
  };

  // Handle template preview
  const handlePreview = (template, event) => {
    event.stopPropagation();
    onPreview?.(template);
  };

  // Handle template editing
  const handleEdit = (template, event) => {
    event.stopPropagation();
    onEdit?.(template);
  };

  // Handle template duplication
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

  // Handle template deletion
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

  // Handle tag toggle
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  // Get template stats display
  const getTemplateStats = (template) => {
    const stats = template.stats || {};
    const parts = [];
    
    if (stats.variables?.count > 0) {
      parts.push(`${stats.variables.count} vars`);
    }
    
    if (stats.jsBlocks?.count > 0) {
      parts.push(`${stats.jsBlocks.count} blocks`);
    }
    
    parts.push(`${Math.round(template.content.length / 1024 * 10) / 10}KB`);
    
    return parts.join(' • ');
  };

  // Format relative time
  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    if (diffMinutes > 0) return `${diffMinutes}m ago`;
    return 'Just now';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Select Template</DialogTitle>
          <DialogDescription>
            Choose a template to insert into your document. Templates support variables like {"{{date}}"} and {"{{cursor}}"}.
          </DialogDescription>
        </DialogHeader>

        {/* Filters */}
        <div className="p-4 border-b border-app-border space-y-3">
          {/* Search and Sort */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
              <input
                type="text"
                placeholder="Search templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
              />
            </div>
            
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split('-');
                setSortBy(sort);
                setSortOrder(order);
              }}
              className="px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none"
            >
              <option value="updated-desc">Recently Updated</option>
              <option value="created-desc">Recently Created</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="size-asc">Size (Small)</option>
              <option value="size-desc">Size (Large)</option>
            </select>
          </div>

          {/* Category and Tags */}
          <div className="flex gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-app-bg border border-app-border rounded-md outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <div className="flex-1">
              <div className="flex flex-wrap gap-1">
                {tags.slice(0, 10).map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-2 py-1 text-xs rounded-md border transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-app-accent text-app-accent-fg border-app-accent'
                        : 'bg-app-bg border-app-border hover:bg-app-panel'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {loading && (
            <div className="p-8 text-center text-app-muted">
              Loading templates...
            </div>
          )}

          {error && (
            <div className="p-8 text-center text-red-500">
              Error: {error}
            </div>
          )}

          {!loading && !error && filteredTemplates.length === 0 && (
            <div className="p-8 text-center text-app-muted">
              {searchQuery || selectedCategory || selectedTags.length > 0
                ? 'No templates match your filters'
                : 'No templates available'
              }
            </div>
          )}

          {!loading && !error && filteredTemplates.length > 0 && (
            <div className="h-full overflow-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredTemplates.map(template => (
                  <div
                    key={template.id}
                    onClick={() => handleSelect(template)}
                    className="bg-app-bg border border-app-border rounded-lg p-4 hover:bg-app-panel cursor-pointer transition-colors group"
                  >
                    {/* Template Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <FileText size={16} className="text-app-muted flex-shrink-0" />
                        <h3 className="font-medium text-app-text truncate">
                          {template.name}
                        </h3>
                      </div>
                      
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {showPreview && (
                          <button
                            onClick={(e) => handlePreview(template, e)}
                            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
                            title="Preview"
                          >
                            <Eye size={14} />
                          </button>
                        )}
                        
                        {allowEdit && (
                          <button
                            onClick={(e) => handleEdit(template, e)}
                            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
                            title="Edit"
                          >
                            <Edit size={14} />
                          </button>
                        )}
                        
                        {allowDuplicate && (
                          <button
                            onClick={(e) => handleDuplicate(template, e)}
                            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
                            title="Duplicate"
                          >
                            <Copy size={14} />
                          </button>
                        )}
                        
                        {allowDelete && (
                          <button
                            onClick={(e) => handleDelete(template, e)}
                            className="p-1 hover:bg-red-500/20 rounded text-app-muted hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Template Content Preview */}
                    <div className="text-sm text-app-muted mb-3 line-clamp-3">
                      {template.content.length > 100
                        ? `${template.content.substring(0, 100)}...`
                        : template.content
                      }
                    </div>

                    {/* Template Metadata */}
                    <div className="space-y-2">
                      {/* Category and Tags */}
                      <div className="flex items-center gap-2 text-xs">
                        <div className="flex items-center gap-1">
                          <Folder size={12} />
                          <span className="text-app-muted">{template.category}</span>
                        </div>
                        
                        {template.tags.length > 0 && (
                          <div className="flex items-center gap-1">
                            <Tag size={12} />
                            <span className="text-app-muted">
                              {template.tags.slice(0, 2).join(', ')}
                              {template.tags.length > 2 && ` +${template.tags.length - 2}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Stats and Time */}
                      <div className="flex items-center justify-between text-xs text-app-muted">
                        <span>{getTemplateStats(template)}</span>
                        <div className="flex items-center gap-1">
                          <Clock size={12} />
                          <span>{formatRelativeTime(template.metadata.updatedAt)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-app-border flex justify-between items-center">
          <div className="text-sm text-app-muted">
            {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            {filteredTemplates.length !== templates.length && ` (filtered from ${templates.length})`}
          </div>
          
          <div className="flex gap-2">
            {allowCreate && (
              <button
                onClick={() => onEdit?.(null)}
                className="flex items-center gap-2 px-3 py-2 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/80 transition-colors"
              >
                <Plus size={16} />
                New Template
              </button>
            )}
            
            <button
              onClick={onClose}
              className="px-3 py-2 border border-app-border rounded-md hover:bg-app-bg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}