/**
 * Note Metadata Manager
 * Handles storage and retrieval of note metadata including tags, categories, and relationships
 */

export class NoteMetadata {
  constructor(plugin) {
    this.plugin = plugin;
    this.metadata = new Map(); // notePath -> metadata object
    this.metadataFile = '.lokus/note-organizer-metadata.json';
    this.isLoaded = false;
  }

  /**
   * Initialize metadata system
   */
  async initialize() {
    try {
      await this.loadMetadata();
      this.isLoaded = true;
      this.plugin.logger.info('Note metadata initialized');
    } catch (error) {
      this.plugin.logger.error('Failed to initialize metadata:', error);
      // Initialize with empty metadata
      this.metadata = new Map();
      this.isLoaded = true;
    }
  }

  /**
   * Load metadata from disk
   */
  async loadMetadata() {
    try {
      if (await this.plugin.fileExists(this.metadataFile)) {
        const content = await this.plugin.readFile(this.metadataFile);
        const data = JSON.parse(content);
        
        // Convert plain object to Map
        this.metadata = new Map(Object.entries(data.notes || {}));
        
        this.plugin.logger.debug(`Loaded metadata for ${this.metadata.size} notes`);
      } else {
        this.metadata = new Map();
      }
    } catch (error) {
      this.plugin.logger.error('Failed to load metadata:', error);
      throw error;
    }
  }

  /**
   * Save metadata to disk
   */
  async save() {
    try {
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        notes: Object.fromEntries(this.metadata)
      };

      await this.plugin.writeFile(this.metadataFile, JSON.stringify(data, null, 2));
      this.plugin.logger.debug('Metadata saved successfully');
    } catch (error) {
      this.plugin.logger.error('Failed to save metadata:', error);
      throw error;
    }
  }

  /**
   * Get metadata for a specific note
   */
  async getNoteMetadata(notePath) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    return this.metadata.get(notePath) || {
      tags: [],
      category: null,
      created: new Date().toISOString(),
      lastModified: new Date().toISOString(),
      relationships: [],
      customFields: {}
    };
  }

  /**
   * Set metadata for a note
   */
  async setNoteMetadata(notePath, metadata) {
    if (!this.isLoaded) {
      await this.initialize();
    }

    const existingMetadata = await this.getNoteMetadata(notePath);
    const updatedMetadata = {
      ...existingMetadata,
      ...metadata,
      lastModified: new Date().toISOString()
    };

    this.metadata.set(notePath, updatedMetadata);
  }

  /**
   * Add tag to a note
   */
  async addTag(notePath, tag) {
    const metadata = await this.getNoteMetadata(notePath);
    
    if (!metadata.tags.includes(tag)) {
      metadata.tags.push(tag);
      await this.setNoteMetadata(notePath, metadata);
    }
  }

  /**
   * Remove tag from a note
   */
  async removeTag(notePath, tag) {
    const metadata = await this.getNoteMetadata(notePath);
    
    metadata.tags = metadata.tags.filter(t => t !== tag);
    await this.setNoteMetadata(notePath, metadata);
  }

  /**
   * Get all tags for a note
   */
  async getNoteTags(notePath) {
    const metadata = await this.getNoteMetadata(notePath);
    return metadata.tags || [];
  }

  /**
   * Set category for a note
   */
  async setNoteCategory(notePath, category) {
    const metadata = await this.getNoteMetadata(notePath);
    metadata.category = category;
    await this.setNoteMetadata(notePath, metadata);
  }

  /**
   * Get category for a note
   */
  async getNoteCategory(notePath) {
    const metadata = await this.getNoteMetadata(notePath);
    return metadata.category;
  }

  /**
   * Add relationship between notes
   */
  async addRelationship(fromNote, toNote, relationshipType = 'related') {
    const metadata = await this.getNoteMetadata(fromNote);
    
    const relationship = {
      target: toNote,
      type: relationshipType,
      created: new Date().toISOString()
    };

    if (!metadata.relationships) {
      metadata.relationships = [];
    }

    // Check if relationship already exists
    const existingIndex = metadata.relationships.findIndex(
      r => r.target === toNote && r.type === relationshipType
    );

    if (existingIndex === -1) {
      metadata.relationships.push(relationship);
      await this.setNoteMetadata(fromNote, metadata);
    }
  }

  /**
   * Get all relationships for a note
   */
  async getNoteRelationships(notePath) {
    const metadata = await this.getNoteMetadata(notePath);
    return metadata.relationships || [];
  }

  /**
   * Get all notes
   */
  async getAllNotes() {
    if (!this.isLoaded) {
      await this.initialize();
    }

    return Array.from(this.metadata.entries()).map(([path, metadata]) => ({
      path,
      ...metadata
    }));
  }

  /**
   * Get all unique tags across all notes
   */
  async getAllTags() {
    const allNotes = await this.getAllNotes();
    const tagCounts = new Map();

    for (const note of allNotes) {
      for (const tag of note.tags || []) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries()).map(([tag, count]) => ({
      name: tag,
      noteCount: count
    }));
  }

  /**
   * Get all unique categories
   */
  async getAllCategories() {
    const allNotes = await this.getAllNotes();
    const categoryCounts = new Map();

    for (const note of allNotes) {
      if (note.category) {
        categoryCounts.set(note.category, (categoryCounts.get(note.category) || 0) + 1);
      }
    }

    return Array.from(categoryCounts.entries()).map(([category, count]) => ({
      name: category,
      noteCount: count
    }));
  }

  /**
   * Find notes by tag
   */
  async findNotesByTag(tag) {
    const allNotes = await this.getAllNotes();
    return allNotes.filter(note => note.tags && note.tags.includes(tag));
  }

  /**
   * Find notes by category
   */
  async findNotesByCategory(category) {
    const allNotes = await this.getAllNotes();
    return allNotes.filter(note => note.category === category);
  }

  /**
   * Search notes by metadata
   */
  async searchNotes(criteria) {
    const allNotes = await this.getAllNotes();
    
    return allNotes.filter(note => {
      // Filter by tags
      if (criteria.tags && criteria.tags.length > 0) {
        const hasAllTags = criteria.tags.every(tag => 
          note.tags && note.tags.includes(tag)
        );
        if (!hasAllTags) return false;
      }

      // Filter by category
      if (criteria.category && note.category !== criteria.category) {
        return false;
      }

      // Filter by date range
      if (criteria.dateFrom || criteria.dateTo) {
        const noteDate = new Date(note.lastModified);
        
        if (criteria.dateFrom && noteDate < new Date(criteria.dateFrom)) {
          return false;
        }
        
        if (criteria.dateTo && noteDate > new Date(criteria.dateTo)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get statistics about the metadata
   */
  async getStatistics() {
    const allNotes = await this.getAllNotes();
    const allTags = await this.getAllTags();
    const allCategories = await this.getAllCategories();

    return {
      totalNotes: allNotes.length,
      totalTags: allTags.length,
      totalCategories: allCategories.length,
      taggedNotes: allNotes.filter(note => note.tags && note.tags.length > 0).length,
      categorizedNotes: allNotes.filter(note => note.category).length,
      notesWithRelationships: allNotes.filter(note => note.relationships && note.relationships.length > 0).length
    };
  }
}