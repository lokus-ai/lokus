/**
 * Advanced Note Organizer Plugin
 * 
 * An intermediate-level plugin demonstrating:
 * - Complex UI with multiple panels and views
 * - File system operations for metadata storage
 * - Settings management and user preferences
 * - Event-driven architecture
 * - Search and filtering functionality
 * - Tag and category management
 * - Note relationships and linking
 * 
 * This plugin helps users organize their notes with a comprehensive
 * tagging and categorization system, advanced search, and relationship tracking.
 */

import { BasePlugin } from '@lokus/plugin-base';
import { NoteMetadata } from './note-metadata.js';
import { SearchEngine } from './search-engine.js';
import { TagManager } from './tag-manager.js';

export default class NoteOrganizerPlugin extends BasePlugin {
  constructor() {
    super();
    
    // Core components
    this.metadata = null;
    this.searchEngine = null;
    this.tagManager = null;
    
    // UI components
    this.tagsPanelId = null;
    this.searchPanelId = null;
    this.categoriesPanelId = null;
    
    // Current state
    this.currentNote = null;
    this.isIndexing = false;
    
    // Debounced functions
    this.debouncedIndex = null;
    this.debouncedSave = null;
  }

  /**
   * Plugin activation
   */
  async activate() {
    await super.activate();
    
    try {
      this.logger.info('Note Organizer plugin activating...');
      
      // Initialize debounced functions
      this.setupDebouncedFunctions();
      
      // Initialize core components
      await this.initializeComponents();
      
      // Setup UI
      await this.setupUI();
      
      // Register commands
      this.registerCommands();
      
      // Setup event listeners
      this.setupEventListeners();
      
      // Perform initial indexing
      await this.performInitialIndexing();
      
      this.showNotification('Note Organizer activated! Start organizing your notes with tags and categories.', 'info');
      
    } catch (error) {
      this.logger.error('Failed to activate Note Organizer:', error);
      this.showNotification('Failed to activate Note Organizer', 'error');
      throw error;
    }
  }

  /**
   * Setup debounced functions for performance
   */
  setupDebouncedFunctions() {
    this.debouncedIndex = this.debounce(async () => {
      await this.indexCurrentNote();
    }, 1000);

    this.debouncedSave = this.debounce(async () => {
      await this.saveMetadata();
    }, 2000);
  }

  /**
   * Initialize core components
   */
  async initializeComponents() {
    // Initialize metadata manager
    this.metadata = new NoteMetadata(this);
    await this.metadata.initialize();

    // Initialize search engine
    this.searchEngine = new SearchEngine(this);
    await this.searchEngine.initialize();

    // Initialize tag manager
    this.tagManager = new TagManager(this);
    await this.tagManager.initialize();

    this.logger.info('Core components initialized');
  }

  /**
   * Setup UI panels and views
   */
  async setupUI() {
    // Create tags panel
    this.tagsPanelId = this.registerPanel({
      name: 'note-tags',
      title: 'Tags',
      position: 'sidebar',
      content: await this.createTagsPanel(),
      icon: '🏷️',
      resizable: true,
      defaultSize: { width: 250, height: 300 }
    });

    // Create search panel
    this.searchPanelId = this.registerPanel({
      name: 'note-search',
      title: 'Search Notes',
      position: 'sidebar',
      content: await this.createSearchPanel(),
      icon: '🔍',
      resizable: true,
      defaultSize: { width: 300, height: 400 }
    });

    // Create categories panel
    this.categoriesPanelId = this.registerPanel({
      name: 'note-categories',
      title: 'Categories',
      position: 'sidebar',
      content: await this.createCategoriesPanel(),
      icon: '📁',
      resizable: true,
      defaultSize: { width: 250, height: 200 }
    });

    // Inject CSS styles
    this.injectStyles();

    this.logger.info('UI components created');
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Add tag command
    this.registerCommand({
      name: 'add-tag',
      description: 'Add Tag to Current Note',
      icon: '🏷️',
      action: () => this.showAddTagDialog()
    });

    // Search notes command
    this.registerCommand({
      name: 'search-notes',
      description: 'Search All Notes',
      icon: '🔍',
      action: () => this.showSearchDialog()
    });

    // Create template command
    this.registerCommand({
      name: 'create-template',
      description: 'Create Note Template',
      icon: '📄',
      action: () => this.showCreateTemplateDialog()
    });

    // Link notes command
    this.registerCommand({
      name: 'link-notes',
      description: 'Link Related Notes',
      icon: '🔗',
      action: () => this.showLinkNotesDialog()
    });

    // Quick categorize command
    this.registerCommand({
      name: 'quick-categorize',
      description: 'Quick Categorize Note',
      icon: '📂',
      action: () => this.showQuickCategorizeDialog()
    });

    // Show statistics command
    this.registerCommand({
      name: 'show-stats',
      description: 'Show Organization Statistics',
      icon: '📊',
      action: () => this.showStatistics()
    });
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for content changes to update indexing
    this.addEventListener('editor:content-change', () => {
      this.debouncedIndex();
    });

    // Listen for document changes
    this.addEventListener('document:opened', (event) => {
      this.handleDocumentOpened(event);
    });

    this.addEventListener('document:saved', (event) => {
      this.handleDocumentSaved(event);
    });

    // Listen for settings changes
    this.addEventListener('settings:changed', (event) => {
      if (event.key.startsWith('noteOrganizer.')) {
        this.handleSettingsChanged(event);
      }
    });
  }

  /**
   * Perform initial indexing of existing notes
   */
  async performInitialIndexing() {
    if (this.isIndexing) return;

    try {
      this.isIndexing = true;
      this.showNotification('Indexing notes...', 'info');

      await this.searchEngine.rebuildIndex();
      await this.updateAllPanels();

      this.logger.info('Initial indexing completed');
    } catch (error) {
      this.logger.error('Initial indexing failed:', error);
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Handle document opened event
   */
  async handleDocumentOpened(event) {
    this.currentNote = event.path;
    
    // Load metadata for current note
    await this.loadCurrentNoteMetadata();
    
    // Update UI to show current note info
    await this.updateCurrentNoteDisplay();
  }

  /**
   * Handle document saved event
   */
  async handleDocumentSaved(event) {
    // Update metadata when document is saved
    await this.indexCurrentNote();
    await this.updateAllPanels();
  }

  /**
   * Handle settings changes
   */
  async handleSettingsChanged(event) {
    switch (event.key) {
      case 'noteOrganizer.defaultTags':
        await this.tagManager.updateDefaultTags(event.value);
        break;
      case 'noteOrganizer.autoTag':
        if (event.value) {
          await this.indexCurrentNote();
        }
        break;
      case 'noteOrganizer.searchDepth':
        this.searchEngine.setSearchDepth(event.value);
        break;
    }
  }

  /**
   * Load metadata for current note
   */
  async loadCurrentNoteMetadata() {
    if (!this.currentNote) return;

    try {
      const metadata = await this.metadata.getNoteMetadata(this.currentNote);
      this.logger.debug('Loaded metadata for current note:', metadata);
    } catch (error) {
      this.logger.error('Failed to load current note metadata:', error);
    }
  }

  /**
   * Index the current note
   */
  async indexCurrentNote() {
    if (!this.currentNote || this.isIndexing) return;

    try {
      const content = this.getEditorContent();
      if (!content) return;

      // Extract metadata from content
      const noteData = {
        path: this.currentNote,
        content: content,
        lastModified: new Date().toISOString()
      };

      // Index the note
      await this.searchEngine.indexNote(noteData);

      // Auto-tag if enabled
      const autoTag = await this.getSetting('autoTag', true);
      if (autoTag) {
        await this.autoTagNote(noteData);
      }

      // Save metadata
      this.debouncedSave();

    } catch (error) {
      this.logger.error('Failed to index current note:', error);
    }
  }

  /**
   * Auto-tag note based on content analysis
   */
  async autoTagNote(noteData) {
    try {
      const suggestedTags = await this.tagManager.suggestTags(noteData.content);
      
      if (suggestedTags.length > 0) {
        for (const tag of suggestedTags) {
          await this.metadata.addTag(noteData.path, tag);
        }
        
        this.logger.debug('Auto-tagged note with:', suggestedTags);
      }
    } catch (error) {
      this.logger.error('Auto-tagging failed:', error);
    }
  }

  /**
   * Save metadata to disk
   */
  async saveMetadata() {
    try {
      await this.metadata.save();
      this.logger.debug('Metadata saved successfully');
    } catch (error) {
      this.logger.error('Failed to save metadata:', error);
    }
  }

  /**
   * Create tags panel content
   */
  async createTagsPanel() {
    const tags = await this.tagManager.getAllTags();
    const currentNoteTags = this.currentNote ? 
      await this.metadata.getNoteTags(this.currentNote) : [];

    const tagItems = tags.map(tag => {
      const isActive = currentNoteTags.includes(tag.name);
      const noteCount = tag.noteCount || 0;
      
      return `
        <div class="tag-item ${isActive ? 'active' : ''}" data-tag="${tag.name}">
          <span class="tag-name">${tag.name}</span>
          <span class="tag-count">${noteCount}</span>
          <div class="tag-actions">
            ${isActive ? 
              `<button class="btn-remove" onclick="noteOrganizer.removeTag('${tag.name}')">×</button>` :
              `<button class="btn-add" onclick="noteOrganizer.addTag('${tag.name}')">+</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="tags-panel">
        <div class="panel-header">
          <h3>Tags</h3>
          <button class="btn-new" onclick="noteOrganizer.showAddTagDialog()">+ New Tag</button>
        </div>
        
        <div class="search-box">
          <input type="text" placeholder="Filter tags..." onkeyup="noteOrganizer.filterTags(this.value)">
        </div>
        
        <div class="tags-list" id="tags-list">
          ${tagItems || '<div class="empty-state">No tags found</div>'}
        </div>
        
        <div class="panel-footer">
          <button class="btn-secondary" onclick="noteOrganizer.manageAllTags()">Manage All Tags</button>
        </div>
      </div>
    `;
  }

  /**
   * Create search panel content
   */
  async createSearchPanel() {
    const recentSearches = await this.getSetting('recentSearches', []);

    return `
      <div class="search-panel">
        <div class="panel-header">
          <h3>Search Notes</h3>
        </div>
        
        <div class="search-form">
          <div class="search-input-group">
            <input type="text" id="search-query" placeholder="Search notes..." onkeypress="noteOrganizer.handleSearchKeypress(event)">
            <button class="btn-search" onclick="noteOrganizer.performSearch()">🔍</button>
          </div>
          
          <div class="search-filters">
            <select id="search-type">
              <option value="content">Content</option>
              <option value="title">Title</option>
              <option value="tags">Tags</option>
              <option value="all">All</option>
            </select>
            
            <select id="search-sort">
              <option value="relevance">Relevance</option>
              <option value="date">Date</option>
              <option value="title">Title</option>
            </select>
          </div>
        </div>
        
        <div class="search-results" id="search-results">
          <div class="empty-state">Enter a search query to find notes</div>
        </div>
        
        <div class="recent-searches">
          <h4>Recent Searches</h4>
          <div class="recent-list">
            ${recentSearches.map(query => 
              `<div class="recent-item" onclick="noteOrganizer.useRecentSearch('${query}')">${query}</div>`
            ).join('') || '<div class="empty-state">No recent searches</div>'}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Create categories panel content
   */
  async createCategoriesPanel() {
    const categories = await this.metadata.getAllCategories();

    const categoryItems = categories.map(category => `
      <div class="category-item" data-category="${category.name}">
        <div class="category-header">
          <span class="category-name">${category.name}</span>
          <span class="category-count">${category.noteCount}</span>
        </div>
        <div class="category-actions">
          <button class="btn-view" onclick="noteOrganizer.viewCategory('${category.name}')">View</button>
          <button class="btn-edit" onclick="noteOrganizer.editCategory('${category.name}')">Edit</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="categories-panel">
        <div class="panel-header">
          <h3>Categories</h3>
          <button class="btn-new" onclick="noteOrganizer.createCategory()">+ New</button>
        </div>
        
        <div class="categories-list">
          ${categoryItems || '<div class="empty-state">No categories created</div>'}
        </div>
        
        <div class="panel-footer">
          <button class="btn-secondary" onclick="noteOrganizer.organizeBulk()">Bulk Organize</button>
        </div>
      </div>
    `;
  }

  /**
   * Show add tag dialog
   */
  async showAddTagDialog() {
    const result = await this.showDialog({
      type: 'input',
      title: 'Add Tag',
      message: 'Enter tag name:',
      placeholder: 'e.g., personal, work, important',
      validation: (value) => {
        if (!value.trim()) return 'Tag name is required';
        if (value.length > 30) return 'Tag name too long';
        if (!/^[a-zA-Z0-9-_]+$/.test(value)) return 'Only letters, numbers, hyphens, and underscores allowed';
        return null;
      }
    });

    if (result.confirmed && this.currentNote) {
      try {
        await this.metadata.addTag(this.currentNote, result.value.trim());
        await this.updateAllPanels();
        this.showNotification(`Tag "${result.value}" added`, 'success');
      } catch (error) {
        this.logger.error('Failed to add tag:', error);
        this.showNotification('Failed to add tag', 'error');
      }
    }
  }

  /**
   * Show search dialog
   */
  async showSearchDialog() {
    const result = await this.showDialog({
      type: 'custom',
      title: 'Advanced Search',
      content: this.createAdvancedSearchDialog(),
      size: { width: 500, height: 400 },
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Search', role: 'confirm', primary: true }
      ]
    });

    if (result.confirmed) {
      const searchParams = this.extractSearchParams();
      await this.performAdvancedSearch(searchParams);
    }
  }

  /**
   * Show statistics
   */
  async showStatistics() {
    const stats = await this.generateStatistics();
    
    const statsContent = `
      <div class="stats-display">
        <h3>Organization Statistics</h3>
        
        <div class="stat-group">
          <h4>Notes</h4>
          <div class="stat-item">Total Notes: <strong>${stats.totalNotes}</strong></div>
          <div class="stat-item">Tagged Notes: <strong>${stats.taggedNotes}</strong></div>
          <div class="stat-item">Categorized Notes: <strong>${stats.categorizedNotes}</strong></div>
        </div>
        
        <div class="stat-group">
          <h4>Organization</h4>
          <div class="stat-item">Total Tags: <strong>${stats.totalTags}</strong></div>
          <div class="stat-item">Total Categories: <strong>${stats.totalCategories}</strong></div>
          <div class="stat-item">Average Tags per Note: <strong>${stats.avgTagsPerNote}</strong></div>
        </div>
        
        <div class="stat-group">
          <h4>Activity</h4>
          <div class="stat-item">Notes Modified Today: <strong>${stats.modifiedToday}</strong></div>
          <div class="stat-item">Notes Modified This Week: <strong>${stats.modifiedThisWeek}</strong></div>
        </div>
      </div>
    `;

    await this.showDialog({
      type: 'custom',
      title: 'Organization Statistics',
      content: statsContent,
      size: { width: 400, height: 500 },
      buttons: [{ text: 'Close', role: 'confirm' }]
    });
  }

  /**
   * Generate organization statistics
   */
  async generateStatistics() {
    try {
      const allNotes = await this.metadata.getAllNotes();
      const allTags = await this.tagManager.getAllTags();
      const allCategories = await this.metadata.getAllCategories();

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      let taggedNotes = 0;
      let categorizedNotes = 0;
      let totalTagCount = 0;
      let modifiedToday = 0;
      let modifiedThisWeek = 0;

      for (const note of allNotes) {
        const tags = await this.metadata.getNoteTags(note.path);
        const category = await this.metadata.getNoteCategory(note.path);
        const modifiedDate = new Date(note.lastModified);

        if (tags.length > 0) {
          taggedNotes++;
          totalTagCount += tags.length;
        }

        if (category) {
          categorizedNotes++;
        }

        if (modifiedDate >= today) {
          modifiedToday++;
        }

        if (modifiedDate >= weekAgo) {
          modifiedThisWeek++;
        }
      }

      return {
        totalNotes: allNotes.length,
        taggedNotes,
        categorizedNotes,
        totalTags: allTags.length,
        totalCategories: allCategories.length,
        avgTagsPerNote: allNotes.length > 0 ? (totalTagCount / allNotes.length).toFixed(1) : 0,
        modifiedToday,
        modifiedThisWeek
      };

    } catch (error) {
      this.logger.error('Failed to generate statistics:', error);
      return {
        totalNotes: 0,
        taggedNotes: 0,
        categorizedNotes: 0,
        totalTags: 0,
        totalCategories: 0,
        avgTagsPerNote: 0,
        modifiedToday: 0,
        modifiedThisWeek: 0
      };
    }
  }

  /**
   * Update all UI panels
   */
  async updateAllPanels() {
    try {
      await this.updateCurrentNoteDisplay();
      // Update panel contents would go here in a real implementation
    } catch (error) {
      this.logger.error('Failed to update panels:', error);
    }
  }

  /**
   * Update current note display
   */
  async updateCurrentNoteDisplay() {
    if (!this.currentNote) return;

    try {
      const tags = await this.metadata.getNoteTags(this.currentNote);
      const category = await this.metadata.getNoteCategory(this.currentNote);
      
      this.logger.debug('Current note tags:', tags);
      this.logger.debug('Current note category:', category);
      
    } catch (error) {
      this.logger.error('Failed to update current note display:', error);
    }
  }

  /**
   * Inject CSS styles
   */
  injectStyles() {
    const styles = `
      .note-organizer-panel {
        font-family: system-ui, -apple-system, sans-serif;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--border-color, #e5e7eb);
      }

      .panel-header h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-primary, #111827);
      }

      .btn-new, .btn-search, .btn-secondary {
        padding: 6px 12px;
        font-size: 12px;
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 4px;
        background: var(--bg-secondary, #f9fafb);
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .btn-new:hover, .btn-search:hover, .btn-secondary:hover {
        background: var(--bg-hover, #f3f4f6);
      }

      .search-box, .search-input-group {
        padding: 12px;
      }

      .search-box input, .search-input-group input {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--border-color, #e5e7eb);
        border-radius: 4px;
        font-size: 14px;
      }

      .tag-item, .category-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        border-bottom: 1px solid var(--border-light, #f3f4f6);
        transition: background-color 0.15s ease;
      }

      .tag-item:hover, .category-item:hover {
        background: var(--bg-hover, #f9fafb);
      }

      .tag-item.active {
        background: var(--bg-accent, #dbeafe);
        border-left: 3px solid var(--color-primary, #3b82f6);
      }

      .tag-name, .category-name {
        font-size: 14px;
        color: var(--text-primary, #111827);
      }

      .tag-count, .category-count {
        font-size: 12px;
        color: var(--text-muted, #6b7280);
        background: var(--bg-muted, #f3f4f6);
        padding: 2px 6px;
        border-radius: 10px;
      }

      .empty-state {
        padding: 24px;
        text-align: center;
        color: var(--text-muted, #6b7280);
        font-size: 14px;
      }

      .stats-display {
        padding: 16px;
      }

      .stat-group {
        margin-bottom: 16px;
      }

      .stat-group h4 {
        margin: 0 0 8px 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text-secondary, #374151);
      }

      .stat-item {
        padding: 4px 0;
        font-size: 14px;
        color: var(--text-primary, #111827);
      }

      @media (prefers-color-scheme: dark) {
        .panel-header h3 {
          color: var(--text-primary, #f9fafb);
        }
        
        .tag-name, .category-name {
          color: var(--text-primary, #f9fafb);
        }
        
        .btn-new, .btn-search, .btn-secondary {
          background: var(--bg-secondary, #374151);
          border-color: var(--border-color, #4b5563);
          color: var(--text-primary, #f9fafb);
        }
      }
    `;

    this.addDisposable(() => this.removeStyles());

    if (!document.getElementById('note-organizer-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'note-organizer-styles';
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
    }
  }

  /**
   * Remove injected styles
   */
  removeStyles() {
    const styleSheet = document.getElementById('note-organizer-styles');
    if (styleSheet) {
      styleSheet.remove();
    }
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    try {
      this.logger.info('Note Organizer plugin deactivating...');

      // Save any pending metadata
      if (this.metadata) {
        await this.metadata.save();
      }

      // Remove styles
      this.removeStyles();

      // Call parent deactivation
      await super.deactivate();

      this.showNotification('Note Organizer deactivated', 'info');

    } catch (error) {
      this.logger.error('Error during Note Organizer deactivation:', error);
    }
  }
}

// Make plugin available globally for UI interactions
if (typeof window !== 'undefined') {
  window.noteOrganizer = null;
}