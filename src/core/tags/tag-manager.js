/**
 * Tag Manager - Index and manage tags across all notes
 * Provides fast queries for tag browser and filtering
 */

import { extractTags, normalizeTag, getTagHierarchy, parseNestedTag } from './tag-parser.js';
import EventEmitter from 'events';

class TagManager extends EventEmitter {
  constructor() {
    super();

    // Map of tag -> Set of note IDs
    this.tagToNotes = new Map();

    // Map of note ID -> Set of tags
    this.noteToTags = new Map();

    // Cache for tag counts
    this.tagCounts = new Map();

    // Track indexed notes
    this.indexedNotes = new Set();
  }

  /**
   * Index a note's tags
   * @param {string} noteId - Unique note identifier
   * @param {string} content - Note content
   * @param {object} frontmatter - Parsed frontmatter
   */
  indexNote(noteId, content, frontmatter = {}) {
    // Remove old tags for this note first
    this.removeNote(noteId);

    // Extract tags
    const tags = extractTags(content, frontmatter);

    if (tags.size === 0) {
      this.indexedNotes.add(noteId);
      return;
    }

    // Store note -> tags mapping
    this.noteToTags.set(noteId, tags);

    // Store tag -> notes mapping
    tags.forEach(tag => {
      if (!this.tagToNotes.has(tag)) {
        this.tagToNotes.set(tag, new Set());
      }
      this.tagToNotes.get(tag).add(noteId);

      // Update count cache
      this.tagCounts.set(tag, this.tagToNotes.get(tag).size);
    });

    this.indexedNotes.add(noteId);

    // Emit event
    this.emit('note-indexed', { noteId, tags: Array.from(tags) });
    this.emit('tags-changed');
  }

  /**
   * Remove a note from the index
   * @param {string} noteId - Note to remove
   */
  removeNote(noteId) {
    const tags = this.noteToTags.get(noteId);

    if (tags) {
      // Remove note from all its tags
      tags.forEach(tag => {
        const notes = this.tagToNotes.get(tag);
        if (notes) {
          notes.delete(noteId);

          // Remove tag entirely if no notes left
          if (notes.size === 0) {
            this.tagToNotes.delete(tag);
            this.tagCounts.delete(tag);
          } else {
            this.tagCounts.set(tag, notes.size);
          }
        }
      });

      this.noteToTags.delete(noteId);
    }

    this.indexedNotes.delete(noteId);

    this.emit('note-removed', { noteId });
    this.emit('tags-changed');
  }

  /**
   * Get all tags with their counts
   * @returns {Array<{tag: string, count: number}>} - Sorted by count (descending)
   */
  getAllTags() {
    const tags = [];

    this.tagToNotes.forEach((notes, tag) => {
      tags.push({
        tag: tag,
        count: notes.size,
        notes: Array.from(notes)
      });
    });

    // Sort by count (descending), then alphabetically
    return tags.sort((a, b) => {
      if (a.count !== b.count) return b.count - a.count;
      return a.tag.localeCompare(b.tag);
    });
  }

  /**
   * Get tags organized as a hierarchy
   * @returns {object} - Nested tag structure
   */
  getTagHierarchy() {
    const hierarchy = {};

    this.tagToNotes.forEach((notes, tag) => {
      const parts = tag.split('/');
      let current = hierarchy;

      parts.forEach((part, index) => {
        if (!current[part]) {
          current[part] = {
            name: part,
            fullPath: parts.slice(0, index + 1).join('/'),
            count: 0,
            notes: new Set(),
            children: {}
          };
        }

        // Add notes to all parent levels
        notes.forEach(noteId => current[part].notes.add(noteId));
        current[part].count = current[part].notes.size;

        current = current[part].children;
      });
    });

    return hierarchy;
  }

  /**
   * Get notes that have a specific tag
   * @param {string} tag - Tag to query
   * @param {boolean} includeNested - Include notes with nested tags
   * @returns {string[]} - Array of note IDs
   */
  getNotesWithTag(tag, includeNested = false) {
    const normalized = normalizeTag(tag);
    const notes = new Set();

    if (includeNested) {
      // Get all tags that start with this tag
      this.tagToNotes.forEach((tagNotes, t) => {
        if (t === normalized || t.startsWith(normalized + '/')) {
          tagNotes.forEach(noteId => notes.add(noteId));
        }
      });
    } else {
      const tagNotes = this.tagToNotes.get(normalized);
      if (tagNotes) {
        tagNotes.forEach(noteId => notes.add(noteId));
      }
    }

    return Array.from(notes);
  }

  /**
   * Get tags for a specific note
   * @param {string} noteId - Note ID
   * @returns {string[]} - Array of tags
   */
  getTagsForNote(noteId) {
    const tags = this.noteToTags.get(noteId);
    return tags ? Array.from(tags) : [];
  }

  /**
   * Get notes that have ALL specified tags
   * @param {string[]} tags - Tags to match (AND logic)
   * @returns {string[]} - Note IDs that have all tags
   */
  getNotesWithAllTags(tags) {
    if (tags.length === 0) return [];
    if (tags.length === 1) return this.getNotesWithTag(tags[0]);

    // Start with first tag's notes
    let result = new Set(this.getNotesWithTag(tags[0]));

    // Intersect with each subsequent tag
    for (let i = 1; i < tags.length; i++) {
      const tagNotes = new Set(this.getNotesWithTag(tags[i]));
      result = new Set([...result].filter(noteId => tagNotes.has(noteId)));

      if (result.size === 0) break; // Early exit
    }

    return Array.from(result);
  }

  /**
   * Get notes that have ANY of the specified tags
   * @param {string[]} tags - Tags to match (OR logic)
   * @returns {string[]} - Note IDs that have any tag
   */
  getNotesWithAnyTag(tags) {
    const result = new Set();

    tags.forEach(tag => {
      const notes = this.getNotesWithTag(tag);
      notes.forEach(noteId => result.add(noteId));
    });

    return Array.from(result);
  }

  /**
   * Search tags by query string
   * @param {string} query - Search query
   * @returns {Array<{tag: string, count: number, relevance: number}>}
   */
  searchTags(query) {
    if (!query || query.length === 0) return this.getAllTags();

    const lowerQuery = query.toLowerCase();
    const results = [];

    this.tagToNotes.forEach((notes, tag) => {
      // Calculate relevance score
      let relevance = 0;

      // Exact match
      if (tag === lowerQuery) relevance = 100;
      // Starts with
      else if (tag.startsWith(lowerQuery)) relevance = 80;
      // Contains
      else if (tag.includes(lowerQuery)) relevance = 50;
      // Fuzzy match on parts
      else {
        const parts = tag.split('/');
        if (parts.some(part => part.includes(lowerQuery))) relevance = 30;
      }

      if (relevance > 0) {
        results.push({
          tag: tag,
          count: notes.size,
          relevance: relevance,
          notes: Array.from(notes)
        });
      }
    });

    // Sort by relevance, then count
    return results.sort((a, b) => {
      if (a.relevance !== b.relevance) return b.relevance - a.relevance;
      return b.count - a.count;
    });
  }

  /**
   * Rename a tag across all notes
   * @param {string} oldTag - Current tag name
   * @param {string} newTag - New tag name
   * @returns {number} - Number of notes affected
   */
  renameTag(oldTag, newTag) {
    const oldNormalized = normalizeTag(oldTag);
    const newNormalized = normalizeTag(newTag);

    if (oldNormalized === newNormalized) return 0;

    const notes = this.tagToNotes.get(oldNormalized);
    if (!notes || notes.size === 0) return 0;

    const affectedNotes = Array.from(notes);

    // Update mappings
    affectedNotes.forEach(noteId => {
      const noteTags = this.noteToTags.get(noteId);
      if (noteTags) {
        noteTags.delete(oldNormalized);
        noteTags.add(newNormalized);
      }
    });

    // Move notes to new tag
    if (!this.tagToNotes.has(newNormalized)) {
      this.tagToNotes.set(newNormalized, new Set());
    }

    affectedNotes.forEach(noteId => {
      this.tagToNotes.get(newNormalized).add(noteId);
    });

    // Remove old tag
    this.tagToNotes.delete(oldNormalized);
    this.tagCounts.delete(oldNormalized);
    this.tagCounts.set(newNormalized, affectedNotes.length);

    this.emit('tag-renamed', { oldTag: oldNormalized, newTag: newNormalized, noteCount: affectedNotes.length });
    this.emit('tags-changed');

    return affectedNotes.length;
  }

  /**
   * Delete a tag (remove from all notes)
   * @param {string} tag - Tag to delete
   * @returns {number} - Number of notes affected
   */
  deleteTag(tag) {
    const normalized = normalizeTag(tag);
    const notes = this.tagToNotes.get(normalized);

    if (!notes || notes.size === 0) return 0;

    const affectedNotes = Array.from(notes);

    // Remove tag from all notes
    affectedNotes.forEach(noteId => {
      const noteTags = this.noteToTags.get(noteId);
      if (noteTags) {
        noteTags.delete(normalized);
      }
    });

    // Remove from index
    this.tagToNotes.delete(normalized);
    this.tagCounts.delete(normalized);

    this.emit('tag-deleted', { tag: normalized, noteCount: affectedNotes.length });
    this.emit('tags-changed');

    return affectedNotes.length;
  }

  /**
   * Get tag suggestions for autocomplete
   * @param {string} prefix - Current tag input
   * @param {number} limit - Max suggestions
   * @returns {string[]} - Suggested tags
   */
  getSuggestions(prefix, limit = 10) {
    if (!prefix || prefix.length === 0) {
      // Return most popular tags
      return this.getAllTags()
        .slice(0, limit)
        .map(t => t.tag);
    }

    const normalized = normalizeTag(prefix);
    return this.searchTags(normalized)
      .slice(0, limit)
      .map(t => t.tag);
  }

  /**
   * Get statistics about the tag system
   * @returns {object} - Tag statistics
   */
  getStats() {
    return {
      totalTags: this.tagToNotes.size,
      totalNotes: this.indexedNotes.size,
      notesWithTags: this.noteToTags.size,
      averageTagsPerNote: this.noteToTags.size > 0
        ? Array.from(this.noteToTags.values()).reduce((sum, tags) => sum + tags.size, 0) / this.noteToTags.size
        : 0,
      mostPopularTags: this.getAllTags().slice(0, 10)
    };
  }

  /**
   * Clear all indexed data
   */
  clear() {
    this.tagToNotes.clear();
    this.noteToTags.clear();
    this.tagCounts.clear();
    this.indexedNotes.clear();

    this.emit('tags-cleared');
    this.emit('tags-changed');
  }

  /**
   * Rebuild index from scratch
   * @param {Array<{id, content, frontmatter}>} notes - All notes
   */
  rebuildIndex(notes) {
    this.clear();

    notes.forEach(note => {
      this.indexNote(note.id, note.content, note.frontmatter);
    });

    this.emit('index-rebuilt', { noteCount: notes.length });
  }

  /**
   * Export index data (for persistence)
   * @returns {object} - Serializable index data
   */
  export() {
    return {
      tagToNotes: Array.from(this.tagToNotes.entries()).map(([tag, notes]) => [tag, Array.from(notes)]),
      noteToTags: Array.from(this.noteToTags.entries()).map(([noteId, tags]) => [noteId, Array.from(tags)]),
      indexedNotes: Array.from(this.indexedNotes)
    };
  }

  /**
   * Import index data (restore from persistence)
   * @param {object} data - Previously exported data
   */
  import(data) {
    this.clear();

    if (data.tagToNotes) {
      data.tagToNotes.forEach(([tag, notes]) => {
        this.tagToNotes.set(tag, new Set(notes));
        this.tagCounts.set(tag, notes.length);
      });
    }

    if (data.noteToTags) {
      data.noteToTags.forEach(([noteId, tags]) => {
        this.noteToTags.set(noteId, new Set(tags));
      });
    }

    if (data.indexedNotes) {
      data.indexedNotes.forEach(noteId => this.indexedNotes.add(noteId));
    }

    this.emit('index-imported');
    this.emit('tags-changed');
  }
}

// Singleton instance
const tagManager = new TagManager();

export default tagManager;
export { TagManager };
