import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Grid,
  List,
  Eye,
  Edit,
  Copy,
  Trash2,
  Download,
  Upload,
  Settings,
  BarChart3,
  Tag,
  Folder,
  Clock,
  FileText,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useTemplates, useTemplateOrganization } from '../hooks/useTemplates.js';
import TemplatePicker from '../components/TemplatePicker.jsx';
import TemplatePreview from '../components/TemplatePreview.jsx';

export default function TemplateManager() {
  const {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    loadTemplates
  } = useTemplates();

  const { categories, tags, stats } = useTemplateOrganization();

  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [showPicker, setShowPicker] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [sortBy, setSortBy] = useState('updated');
  const [sortOrder, setSortOrder] = useState('desc');
  const [showStats, setShowStats] = useState(false);

  // Filter templates
  const filteredTemplates = React.useMemo(() => {
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

    return filtered;
  }, [templates, searchQuery, selectedCategory, selectedTags, sortBy, sortOrder]);

  // Handle template actions
  const handleEdit = (template) => {
    setSelectedTemplate(template);
    // Navigate to template editor (would need routing setup)
  };

  const handlePreview = (template) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleDuplicate = async (template) => {
    try {
      const newId = `${template.id}_copy_${Date.now()}`;
      await duplicateTemplate(template.id, newId, {
        name: `${template.name} (Copy)`
      });
    } catch (err) {
    }
  };

  const handleDelete = async (template) => {
    if (window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      try {
        await deleteTemplate(template.id);
      } catch (err) {
      }
    }
  };

  const handleExport = (template) => {
    try {
      const exportData = JSON.stringify(template, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        try {
          const content = await file.text();
          const templateData = JSON.parse(content);
          // Validate and create template
          await createTemplate({
            ...templateData,
            id: `imported_${Date.now()}`,
            metadata: {
              ...templateData.metadata,
              importedAt: new Date().toISOString()
            }
          });
        } catch (err) {
          alert('Failed to import template. Please check the file format.');
        }
      }
    };
    input.click();
  };

  // Handle tag toggle
  const toggleTag = (tag) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
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

  const TemplateCard = ({ template }) => (
    <div className="bg-app-bg border border-app-border rounded-lg p-4 hover:bg-app-panel transition-colors group">
      {/* Template Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileText size={16} className="text-app-muted flex-shrink-0" />
          <h3 className="font-medium text-app-text truncate">
            {template.name}
          </h3>
        </div>
        
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => handlePreview(template)}
            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
            title="Preview"
          >
            <Eye size={14} />
          </button>
          
          <button
            onClick={() => handleEdit(template)}
            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
            title="Edit"
          >
            <Edit size={14} />
          </button>
          
          <button
            onClick={() => handleDuplicate(template)}
            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
            title="Duplicate"
          >
            <Copy size={14} />
          </button>
          
          <button
            onClick={() => handleExport(template)}
            className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
            title="Export"
          >
            <Download size={14} />
          </button>
          
          <button
            onClick={() => handleDelete(template)}
            className="p-1 hover:bg-red-500/20 rounded text-app-muted hover:text-red-500 transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
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
  );

  const TemplateRow = ({ template }) => (
    <div className="flex items-center gap-4 p-3 hover:bg-app-panel rounded-lg transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-app-muted flex-shrink-0" />
          <h3 className="font-medium text-app-text truncate">
            {template.name}
          </h3>
        </div>
        <div className="text-sm text-app-muted truncate">
          {template.content.substring(0, 80)}...
        </div>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-app-muted">
        <span>{template.category}</span>
        <span>•</span>
        <span>{getTemplateStats(template)}</span>
        <span>•</span>
        <span>{formatRelativeTime(template.metadata.updatedAt)}</span>
      </div>
      
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => handlePreview(template)}
          className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
          title="Preview"
        >
          <Eye size={14} />
        </button>
        
        <button
          onClick={() => handleEdit(template)}
          className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
          title="Edit"
        >
          <Edit size={14} />
        </button>
        
        <button
          onClick={() => handleDuplicate(template)}
          className="p-1 hover:bg-app-accent/20 rounded text-app-muted hover:text-app-text transition-colors"
          title="Duplicate"
        >
          <Copy size={14} />
        </button>
        
        <button
          onClick={() => handleDelete(template)}
          className="p-1 hover:bg-red-500/20 rounded text-app-muted hover:text-red-500 transition-colors"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      {/* Header */}
      <header className="h-12 px-4 flex items-center justify-between border-b border-app-border bg-app-panel">
        <div className="flex items-center gap-3">
          <h1 className="font-semibold">Template Manager</h1>
          {stats && (
            <span className="text-sm text-app-muted">
              {stats.total} template{stats.total !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 px-3 py-1 border border-app-border rounded-md hover:bg-app-bg transition-colors"
          >
            <BarChart3 size={16} />
            {showStats ? 'Hide' : 'Show'} Stats
          </button>

          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-3 py-1 border border-app-border rounded-md hover:bg-app-bg transition-colors"
          >
            <Upload size={16} />
            Import
          </button>

          <button
            onClick={() => handleEdit(null)}
            className="flex items-center gap-2 px-3 py-1 bg-app-accent text-app-accent-fg rounded-md hover:bg-app-accent/80 transition-colors"
          >
            <Plus size={16} />
            New Template
          </button>
        </div>
      </header>

      {/* Stats Panel */}
      {showStats && stats && (
        <div className="bg-app-panel border-b border-app-border p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-app-text">{stats.total}</div>
              <div className="text-sm text-app-muted">Total Templates</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-app-text">{stats.categories}</div>
              <div className="text-sm text-app-muted">Categories</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-app-text">{stats.tags}</div>
              <div className="text-sm text-app-muted">Tags</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-app-text">{stats.averageSize}</div>
              <div className="text-sm text-app-muted">Avg Size (chars)</div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-app-panel border-b border-app-border p-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-app-bg border border-app-border rounded-md outline-none focus:ring-2 focus:ring-app-accent/40"
            />
          </div>

          {/* Category Filter */}
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

          {/* Sort */}
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

          {/* View Mode */}
          <div className="flex border border-app-border rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid' ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'
              }`}
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list' ? 'bg-app-accent text-app-accent-fg' : 'hover:bg-app-bg'
              }`}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Tags Filter */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {tags.slice(0, 12).map(tag => (
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
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading && (
          <div className="text-center text-app-muted py-8">
            Loading templates...
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 inline-block">
              <div className="flex items-center gap-2 text-red-500 font-medium mb-2">
                <AlertCircle size={20} />
                Error Loading Templates
              </div>
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && filteredTemplates.length === 0 && (
          <div className="text-center text-app-muted py-8">
            {searchQuery || selectedCategory || selectedTags.length > 0
              ? 'No templates match your filters'
              : 'No templates yet. Create your first template!'
            }
          </div>
        )}

        {!loading && !error && filteredTemplates.length > 0 && (
          <div className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-2'
          }>
            {filteredTemplates.map(template => (
              viewMode === 'grid' 
                ? <TemplateCard key={template.id} template={template} />
                : <TemplateRow key={template.id} template={template} />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showPicker && (
        <TemplatePicker
          open={showPicker}
          onClose={() => setShowPicker(false)}
          onSelect={(template) => {
            setShowPicker(false);
          }}
        />
      )}

      {showPreview && selectedTemplate && (
        <TemplatePreview
          template={selectedTemplate}
          open={showPreview}
          onClose={() => {
            setShowPreview(false);
            setSelectedTemplate(null);
          }}
          onInsert={(result, variables) => {
          }}
        />
      )}
    </div>
  );
}