// Full-text search engine for Lokus
import MiniSearch from 'minisearch';

/**
 * SearchEngine - Manages full-text indexing and searching across all documents
 * Performance target: <200ms for 1000 notes
 */
class SearchEngine {
  constructor() {
    this.miniSearch = new MiniSearch({
      fields: ['title', 'content', 'tags', 'folder', 'codeBlocks'],
      storeFields: ['title', 'path', 'folder', 'tags', 'modified', 'created'],
      searchOptions: {
        boost: { title: 3, tags: 2, content: 1 },
        fuzzy: 0.2,
        prefix: true,
        combineWith: 'AND'
      }
    });

    this.documents = new Map();
    this.indexingQueue = [];
    this.isIndexing = false;
    this.listeners = new Set();
  }

  /**
   * Add or update a document in the index
   */
  async indexDocument(doc) {
    const {
      id,
      title,
      content,
      path,
      folder,
      tags = [],
      modified,
      created
    } = doc;

    // Extract code blocks from content
    const codeBlocks = this.extractCodeBlocks(content);

    const document = {
      id,
      title: title || path.split('/').pop(),
      content: this.stripMarkdown(content),
      codeBlocks: codeBlocks.join(' '),
      path,
      folder: folder || this.extractFolder(path),
      tags: Array.isArray(tags) ? tags.join(' ') : tags,
      modified: modified || Date.now(),
      created: created || Date.now()
    };

    // Store document
    this.documents.set(id, document);

    // Update index
    if (this.miniSearch.has(id)) {
      this.miniSearch.discard(id);
    }
    this.miniSearch.add(document);

    this.notifyListeners('documentIndexed', { id });
  }

  /**
   * Index multiple documents in batch
   */
  async indexDocuments(docs) {
    const startTime = performance.now();

    for (const doc of docs) {
      await this.indexDocument(doc);
    }

    const duration = performance.now() - startTime;

    this.notifyListeners('batchIndexed', { count: docs.length, duration });
  }

  /**
   * Remove document from index
   */
  removeDocument(id) {
    if (this.miniSearch.has(id)) {
      this.miniSearch.discard(id);
    }
    this.documents.delete(id);
    this.notifyListeners('documentRemoved', { id });
  }

  /**
   * Clear entire index
   */
  clear() {
    this.miniSearch.removeAll();
    this.documents.clear();
    this.notifyListeners('indexCleared');
  }

  /**
   * Search with parsed query and filters
   */
  search(query, options = {}) {
    const {
      filters = {},
      fuzzy = true,
      prefix = true,
      combineWith = 'AND',
      limit = 100
    } = options;

    const startTime = performance.now();

    // Perform search
    let results = this.miniSearch.search(query, {
      fuzzy: fuzzy ? 0.2 : false,
      prefix,
      combineWith,
      boost: { title: 3, tags: 2, content: 1 }
    });

    // Apply filters
    if (Object.keys(filters).length > 0) {
      results = this.applyFilters(results, filters);
    }

    // Limit results
    results = results.slice(0, limit);

    // Enhance results with snippets
    results = results.map(result => {
      const doc = this.documents.get(result.id);
      return {
        ...result,
        ...doc,
        snippet: this.generateSnippet(doc.content, query, 50),
        highlights: this.getHighlights(doc, query)
      };
    });

    const duration = performance.now() - startTime;

    return {
      results,
      total: results.length,
      duration
    };
  }

  /**
   * Apply filters to search results
   */
  applyFilters(results, filters) {
    return results.filter(result => {
      const doc = this.documents.get(result.id);
      if (!doc) return false;

      // Tag filter
      if (filters.tag) {
        const tags = doc.tags.toLowerCase().split(' ');
        const filterTag = filters.tag.toLowerCase();
        if (!tags.includes(filterTag)) return false;
      }

      // Folder filter
      if (filters.folder) {
        if (!doc.folder.toLowerCase().includes(filters.folder.toLowerCase())) {
          return false;
        }
      }

      // Modified date filter
      if (filters.modified) {
        const modifiedDate = new Date(doc.modified);
        if (!this.matchesDateFilter(modifiedDate, filters.modified)) {
          return false;
        }
      }

      // Created date filter
      if (filters.created) {
        const createdDate = new Date(doc.created);
        if (!this.matchesDateFilter(createdDate, filters.created)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Match date filter (today, yesterday, last7days, last30days, or specific date)
   */
  matchesDateFilter(date, filter) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
      case 'today':
        return date >= today;
      case 'yesterday': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        return date >= yesterday && date < today;
      }
      case 'last7days': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return date >= weekAgo;
      }
      case 'last30days': {
        const monthAgo = new Date(today);
        monthAgo.setDate(monthAgo.getDate() - 30);
        return date >= monthAgo;
      }
      default:
        // Try parsing as date string
        try {
          const filterDate = new Date(filter);
          return date.toDateString() === filterDate.toDateString();
        } catch {
          return true;
        }
    }
  }

  /**
   * Generate context snippet around matches
   */
  generateSnippet(content, query, contextChars = 50) {
    if (!content || !query) return '';

    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase().split(/\s+/)[0]; // Use first word

    const index = lowerContent.indexOf(lowerQuery);
    if (index === -1) {
      return content.substring(0, contextChars * 2) + '...';
    }

    const start = Math.max(0, index - contextChars);
    const end = Math.min(content.length, index + lowerQuery.length + contextChars);

    let snippet = content.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }

  /**
   * Get highlighted matches in document
   */
  getHighlights(doc, query) {
    const highlights = [];
    const words = query.toLowerCase().split(/\s+/);

    // Check title
    for (const word of words) {
      if (doc.title.toLowerCase().includes(word)) {
        highlights.push({ field: 'title', term: word });
      }
    }

    // Check content
    const contentLower = doc.content.toLowerCase();
    for (const word of words) {
      const count = (contentLower.match(new RegExp(word, 'gi')) || []).length;
      if (count > 0) {
        highlights.push({ field: 'content', term: word, count });
      }
    }

    return highlights;
  }

  /**
   * Extract folder from path
   */
  extractFolder(path) {
    const parts = path.split('/');
    parts.pop(); // Remove filename
    return parts.join('/') || '/';
  }

  /**
   * Extract code blocks from markdown content
   */
  extractCodeBlocks(content) {
    const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
    const matches = content.match(codeBlockRegex) || [];
    return matches.map(block => block.replace(/```\w*\n?/g, '').replace(/`/g, ''));
  }

  /**
   * Strip markdown formatting for cleaner indexing
   */
  stripMarkdown(content) {
    return content
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/!\[.*?\]\(.*?\)/g, '') // Remove images
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Convert links to text
      .replace(/[*_~=#-]/g, '') // Remove formatting chars
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Get autocomplete suggestions
   */
  autoSuggest(prefix, limit = 10) {
    if (!prefix || prefix.length < 2) return [];

    const results = this.miniSearch.search(prefix, {
      prefix: true,
      fuzzy: 0.2,
      boost: { title: 3, tags: 2 }
    });

    return results
      .slice(0, limit)
      .map(result => {
        const doc = this.documents.get(result.id);
        return {
          id: result.id,
          title: doc.title,
          path: doc.path,
          score: result.score
        };
      });
  }

  /**
   * Get search statistics
   */
  getStats() {
    return {
      documentCount: this.documents.size,
      indexSize: this.miniSearch.documentCount
    };
  }

  /**
   * Export index for persistence
   */
  export() {
    return {
      index: JSON.stringify(this.miniSearch),
      documents: Array.from(this.documents.entries())
    };
  }

  /**
   * Import persisted index
   */
  import(data) {
    try {
      this.miniSearch = MiniSearch.loadJSON(data.index, {
        fields: ['title', 'content', 'tags', 'folder', 'codeBlocks'],
        storeFields: ['title', 'path', 'folder', 'tags', 'modified', 'created']
      });
      this.documents = new Map(data.documents);
      this.notifyListeners('indexImported');
    } catch { }
  }

  /**
   * Event listener management
   */
  addListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch { }
    });
  }
}

// Singleton instance
let searchEngineInstance = null;

export function getSearchEngine() {
  if (!searchEngineInstance) {
    searchEngineInstance = new SearchEngine();
  }
  return searchEngineInstance;
}

export default SearchEngine;
