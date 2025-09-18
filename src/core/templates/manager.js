/**
 * Template Manager
 * 
 * Manages template CRUD operations, storage, and organization
 */

import { TemplateParser } from './parser.js';
import { TemplateProcessor } from './processor.js';

export class TemplateManager {
  constructor(options = {}) {
    this.storage = options.storage || new Map();
    this.parser = new TemplateParser();
    this.processor = new TemplateProcessor(options.processor);
    this.categories = new Map();
    this.tags = new Map();
    this.maxTemplates = options.maxTemplates || 1000;
    
    this.initializeDefaultCategories();
  }

  /**
   * Create a new template
   */
  async create(templateData) {
    const { id, name, content, category, tags, metadata } = templateData;
    
    if (!id || !name || !content) {
      throw new Error('Template ID, name, and content are required');
    }

    if (this.storage.has(id)) {
      throw new Error(`Template with ID '${id}' already exists`);
    }

    if (this.storage.size >= this.maxTemplates) {
      throw new Error(`Maximum number of templates (${this.maxTemplates}) reached`);
    }

    // Validate template syntax
    const validation = this.parser.validate(content);
    if (!validation.valid) {
      throw new Error(`Invalid template syntax: ${validation.errors.join(', ')}`);
    }

    const template = {
      id,
      name,
      content,
      category: category || 'general',
      tags: tags || [],
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: metadata?.version || '1.0.0'
      },
      stats: this.parser.getStatistics(content)
    };

    this.storage.set(id, template);
    this.updateCategoryIndex(template);
    this.updateTagIndex(template);

    return template;
  }

  /**
   * Read template by ID
   */
  read(id) {
    return this.storage.get(id) || null;
  }

  /**
   * Update existing template
   */
  async update(id, updates) {
    const existing = this.storage.get(id);
    if (!existing) {
      throw new Error(`Template '${id}' not found`);
    }

    const { name, content, category, tags, metadata } = updates;

    // Validate new content if provided
    if (content !== undefined) {
      const validation = this.parser.validate(content);
      if (!validation.valid) {
        throw new Error(`Invalid template syntax: ${validation.errors.join(', ')}`);
      }
    }

    // Remove from old indexes
    this.removeCategoryIndex(existing);
    this.removeTagIndex(existing);

    // Update template
    const updated = {
      ...existing,
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      ...(category !== undefined && { category }),
      ...(tags !== undefined && { tags }),
      metadata: {
        ...existing.metadata,
        ...metadata,
        updatedAt: new Date().toISOString(),
        version: this.incrementVersion(existing.metadata.version)
      },
      ...(content !== undefined && { stats: this.parser.getStatistics(content) })
    };

    this.storage.set(id, updated);
    this.updateCategoryIndex(updated);
    this.updateTagIndex(updated);

    return updated;
  }

  /**
   * Delete template
   */
  delete(id) {
    const template = this.storage.get(id);
    if (!template) {
      return false;
    }

    this.removeCategoryIndex(template);
    this.removeTagIndex(template);
    return this.storage.delete(id);
  }

  /**
   * List all templates
   */
  list(options = {}) {
    const { category, tags, search, limit, offset, sortBy, sortOrder } = options;
    
    let templates = Array.from(this.storage.values());

    // Filter by category
    if (category) {
      templates = templates.filter(t => t.category === category);
    }

    // Filter by tags
    if (tags && tags.length > 0) {
      templates = templates.filter(t => 
        tags.some(tag => t.tags.includes(tag))
      );
    }

    // Search in name and content
    if (search) {
      const searchLower = search.toLowerCase();
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.content.toLowerCase().includes(searchLower) ||
        t.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }

    // Sort templates
    if (sortBy) {
      templates.sort((a, b) => {
        let aValue = this.getSortValue(a, sortBy);
        let bValue = this.getSortValue(b, sortBy);
        
        if (typeof aValue === 'string') {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        const result = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
        return sortOrder === 'desc' ? -result : result;
      });
    }

    // Pagination
    const start = offset || 0;
    const end = limit ? start + limit : templates.length;
    
    return {
      templates: templates.slice(start, end),
      total: templates.length,
      offset: start,
      limit: limit || templates.length
    };
  }

  /**
   * Process template with variables
   */
  async process(id, variables = {}, options = {}) {
    console.log('[TemplateManager] Processing template:', id);
    console.log('[TemplateManager] Available templates:', Array.from(this.storage.keys()));
    
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found`);
    }

    console.log('[TemplateManager] Template found:', template.name);
    console.log('[TemplateManager] Variables received:', variables);
    
    return await this.processor.process(template.content, variables, options);
  }

  /**
   * Preview template processing
   */
  async preview(id, variables = {}) {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found`);
    }

    return await this.processor.preview(template.content, variables);
  }

  /**
   * Duplicate template
   */
  async duplicate(id, newId, options = {}) {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found`);
    }

    const duplicateData = {
      id: newId,
      name: options.name || `${template.name} (Copy)`,
      content: template.content,
      category: options.category || template.category,
      tags: options.tags || [...template.tags],
      metadata: {
        ...template.metadata,
        originalId: id,
        ...options.metadata
      }
    };

    return await this.create(duplicateData);
  }

  /**
   * Export template
   */
  export(id) {
    const template = this.storage.get(id);
    if (!template) {
      throw new Error(`Template '${id}' not found`);
    }

    return {
      ...template,
      exportedAt: new Date().toISOString(),
      exportVersion: '1.0.0'
    };
  }

  /**
   * Import template
   */
  async import(templateData, options = {}) {
    const { overwrite = false } = options;
    
    if (!templateData.id || !templateData.name || !templateData.content) {
      throw new Error('Invalid template data: missing required fields');
    }

    if (this.storage.has(templateData.id) && !overwrite) {
      throw new Error(`Template '${templateData.id}' already exists. Use overwrite option to replace.`);
    }

    const importData = {
      id: templateData.id,
      name: templateData.name,
      content: templateData.content,
      category: templateData.category || 'imported',
      tags: templateData.tags || ['imported'],
      metadata: {
        ...templateData.metadata,
        importedAt: new Date().toISOString()
      }
    };

    if (overwrite && this.storage.has(templateData.id)) {
      return await this.update(templateData.id, importData);
    } else {
      return await this.create(importData);
    }
  }

  /**
   * Get template statistics
   */
  getStatistics() {
    const templates = Array.from(this.storage.values());
    
    const categoryStats = {};
    const tagStats = {};
    const complexityStats = {};
    
    templates.forEach(template => {
      // Category stats
      categoryStats[template.category] = (categoryStats[template.category] || 0) + 1;
      
      // Tag stats
      template.tags.forEach(tag => {
        tagStats[tag] = (tagStats[tag] || 0) + 1;
      });
      
      // Complexity stats
      const complexity = template.stats.complexity;
      complexityStats[complexity] = (complexityStats[complexity] || 0) + 1;
    });

    return {
      total: templates.length,
      categories: Object.keys(categoryStats).length,
      tags: Object.keys(tagStats).length,
      categoryStats,
      tagStats,
      complexityStats,
      averageSize: templates.length > 0 
        ? Math.round(templates.reduce((sum, t) => sum + t.content.length, 0) / templates.length)
        : 0
    };
  }

  /**
   * Get all categories
   */
  getCategories() {
    return Array.from(this.categories.entries()).map(([id, info]) => ({
      id,
      ...info
    }));
  }

  /**
   * Get all tags
   */
  getTags() {
    return Array.from(this.tags.keys()).sort();
  }

  /**
   * Search templates
   */
  search(query, options = {}) {
    return this.list({ search: query, ...options });
  }

  /**
   * Validate template content
   */
  validate(content) {
    return this.parser.validate(content);
  }

  /**
   * Clear all templates
   */
  clear() {
    this.storage.clear();
    this.categories.clear();
    this.tags.clear();
    this.initializeDefaultCategories();
  }

  /**
   * Get storage size
   */
  size() {
    return this.storage.size;
  }

  // Private methods

  initializeDefaultCategories() {
    const defaultCategories = [
      { id: 'general', name: 'General', description: 'General purpose templates' },
      { id: 'notes', name: 'Notes', description: 'Note taking templates' },
      { id: 'documentation', name: 'Documentation', description: 'Documentation templates' },
      { id: 'reports', name: 'Reports', description: 'Report generation templates' },
      { id: 'letters', name: 'Letters', description: 'Letter and email templates' },
      { id: 'imported', name: 'Imported', description: 'Imported templates' }
    ];

    defaultCategories.forEach(cat => {
      this.categories.set(cat.id, {
        name: cat.name,
        description: cat.description,
        templates: []
      });
    });
  }

  updateCategoryIndex(template) {
    if (!this.categories.has(template.category)) {
      this.categories.set(template.category, {
        name: template.category,
        description: `Templates in ${template.category} category`,
        templates: []
      });
    }
    
    const category = this.categories.get(template.category);
    if (!category.templates.includes(template.id)) {
      category.templates.push(template.id);
    }
  }

  removeCategoryIndex(template) {
    const category = this.categories.get(template.category);
    if (category) {
      category.templates = category.templates.filter(id => id !== template.id);
      if (category.templates.length === 0 && !['general', 'notes', 'documentation', 'reports', 'letters', 'imported'].includes(template.category)) {
        this.categories.delete(template.category);
      }
    }
  }

  updateTagIndex(template) {
    template.tags.forEach(tag => {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, []);
      }
      const tagTemplates = this.tags.get(tag);
      if (!tagTemplates.includes(template.id)) {
        tagTemplates.push(template.id);
      }
    });
  }

  removeTagIndex(template) {
    template.tags.forEach(tag => {
      const tagTemplates = this.tags.get(tag);
      if (tagTemplates) {
        const filtered = tagTemplates.filter(id => id !== template.id);
        if (filtered.length === 0) {
          this.tags.delete(tag);
        } else {
          this.tags.set(tag, filtered);
        }
      }
    });
  }

  getSortValue(template, sortBy) {
    switch (sortBy) {
      case 'name': return template.name;
      case 'category': return template.category;
      case 'created': return template.metadata.createdAt;
      case 'updated': return template.metadata.updatedAt;
      case 'size': return template.content.length;
      case 'complexity': return template.stats.complexity;
      default: return template.name;
    }
  }

  incrementVersion(version) {
    const parts = version.split('.');
    const patch = parseInt(parts[2] || '0', 10) + 1;
    return `${parts[0] || '1'}.${parts[1] || '0'}.${patch}`;
  }
}

export default TemplateManager;