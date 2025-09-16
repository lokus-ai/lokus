/**
 * Search Engine for Note Organizer
 * Provides full-text search and content indexing capabilities
 */

export class SearchEngine {
  constructor(plugin) {
    this.plugin = plugin;
    this.index = new Map(); // word -> Set of note paths
    this.noteContent = new Map(); // notePath -> content data
    this.searchDepth = 3;
    this.stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does',
      'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can'
    ]);
  }

  /**
   * Initialize search engine
   */
  async initialize() {
    try {
      await this.loadIndex();
      this.plugin.logger.info('Search engine initialized');
    } catch (error) {
      this.plugin.logger.error('Failed to initialize search engine:', error);
      this.index = new Map();
      this.noteContent = new Map();
    }
  }

  /**
   * Load search index from storage
   */
  async loadIndex() {
    const indexFile = '.lokus/search-index.json';
    
    try {
      if (await this.plugin.fileExists(indexFile)) {
        const content = await this.plugin.readFile(indexFile);
        const data = JSON.parse(content);
        
        // Reconstruct index from stored data
        this.index = new Map();
        for (const [word, notePaths] of Object.entries(data.index || {})) {
          this.index.set(word, new Set(notePaths));
        }
        
        this.noteContent = new Map(Object.entries(data.noteContent || {}));
        
        this.plugin.logger.debug(`Loaded search index with ${this.index.size} terms`);
      }
    } catch (error) {
      this.plugin.logger.error('Failed to load search index:', error);
      throw error;
    }
  }

  /**
   * Save search index to storage
   */
  async saveIndex() {
    const indexFile = '.lokus/search-index.json';
    
    try {
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        index: Object.fromEntries(
          Array.from(this.index.entries()).map(([word, notePaths]) => 
            [word, Array.from(notePaths)]
          )
        ),
        noteContent: Object.fromEntries(this.noteContent)
      };

      await this.plugin.writeFile(indexFile, JSON.stringify(data, null, 2));
      this.plugin.logger.debug('Search index saved');
    } catch (error) {
      this.plugin.logger.error('Failed to save search index:', error);
    }
  }

  /**
   * Index a note's content
   */
  async indexNote(noteData) {
    const { path, content } = noteData;
    
    try {
      // Remove existing index entries for this note
      await this.removeNoteFromIndex(path);
      
      // Extract and clean text content
      const textContent = this.extractTextContent(content);
      const words = this.tokenizeText(textContent);
      
      // Store note content data
      this.noteContent.set(path, {
        title: this.extractTitle(content),
        excerpt: this.createExcerpt(textContent),
        wordCount: words.length,
        lastIndexed: new Date().toISOString()
      });

      // Index each word
      for (const word of words) {
        if (!this.index.has(word)) {
          this.index.set(word, new Set());
        }
        this.index.get(word).add(path);
      }

      this.plugin.logger.debug(`Indexed note: ${path} (${words.length} words)`);
      
      // Save index periodically
      this.saveIndex();
      
    } catch (error) {
      this.plugin.logger.error(`Failed to index note ${path}:`, error);
    }
  }

  /**
   * Remove a note from the search index
   */
  async removeNoteFromIndex(notePath) {
    // Remove from word index
    for (const [word, notePaths] of this.index.entries()) {
      notePaths.delete(notePath);
      if (notePaths.size === 0) {
        this.index.delete(word);
      }
    }

    // Remove from content store
    this.noteContent.delete(notePath);
  }

  /**
   * Rebuild the entire search index
   */
  async rebuildIndex() {
    this.plugin.logger.info('Rebuilding search index...');
    
    try {
      // Clear existing index
      this.index.clear();
      this.noteContent.clear();

      // Get all notes from metadata
      const allNotes = await this.plugin.metadata.getAllNotes();
      
      // Index each note
      for (const note of allNotes) {
        try {
          // Read note content
          const content = await this.plugin.readFile(note.path);
          await this.indexNote({
            path: note.path,
            content: content
          });
        } catch (error) {
          this.plugin.logger.warn(`Failed to read note for indexing: ${note.path}`, error);
        }
      }

      await this.saveIndex();
      this.plugin.logger.info(`Search index rebuilt with ${this.index.size} terms`);
      
    } catch (error) {
      this.plugin.logger.error('Failed to rebuild search index:', error);
      throw error;
    }
  }

  /**
   * Search for notes
   */
  async search(query, options = {}) {
    const {
      type = 'content', // 'content', 'title', 'tags', 'all'
      sortBy = 'relevance', // 'relevance', 'date', 'title'
      limit = 50,
      includeMetadata = true
    } = options;

    try {
      let results = [];

      switch (type) {
        case 'content':
          results = await this.searchContent(query);
          break;
        case 'title':
          results = await this.searchTitles(query);
          break;
        case 'tags':
          results = await this.searchTags(query);
          break;
        case 'all':
          results = await this.searchAll(query);
          break;
        default:
          results = await this.searchContent(query);
      }

      // Sort results
      results = this.sortResults(results, sortBy);

      // Limit results
      if (limit > 0) {
        results = results.slice(0, limit);
      }

      // Include metadata if requested
      if (includeMetadata) {
        results = await this.enrichResultsWithMetadata(results);
      }

      this.plugin.logger.debug(`Search completed: ${results.length} results for "${query}"`);
      return results;

    } catch (error) {
      this.plugin.logger.error('Search failed:', error);
      return [];
    }
  }

  /**
   * Search content text
   */
  async searchContent(query) {
    const searchTerms = this.tokenizeText(query);
    const results = new Map(); // notePath -> score

    for (const term of searchTerms) {
      const notePaths = this.index.get(term) || new Set();
      
      for (const notePath of notePaths) {
        const currentScore = results.get(notePath) || 0;
        results.set(notePath, currentScore + 1);
      }
    }

    // Convert to result objects
    return Array.from(results.entries()).map(([path, score]) => ({
      path,
      score: score / searchTerms.length, // Normalize score
      type: 'content',
      matches: this.findMatches(path, searchTerms)
    }));
  }

  /**
   * Search note titles
   */
  async searchTitles(query) {
    const searchTerms = this.tokenizeText(query.toLowerCase());
    const results = [];

    for (const [notePath, contentData] of this.noteContent.entries()) {
      const title = contentData.title.toLowerCase();
      let score = 0;

      for (const term of searchTerms) {
        if (title.includes(term)) {
          score += title === term ? 2 : 1; // Exact match gets higher score
        }
      }

      if (score > 0) {
        results.push({
          path: notePath,
          score,
          type: 'title',
          matches: [{ field: 'title', text: contentData.title }]
        });
      }
    }

    return results;
  }

  /**
   * Search tags
   */
  async searchTags(query) {
    const results = [];
    const allNotes = await this.plugin.metadata.getAllNotes();

    for (const note of allNotes) {
      const tags = note.tags || [];
      const matchingTags = tags.filter(tag => 
        tag.toLowerCase().includes(query.toLowerCase())
      );

      if (matchingTags.length > 0) {
        results.push({
          path: note.path,
          score: matchingTags.length,
          type: 'tags',
          matches: matchingTags.map(tag => ({ field: 'tag', text: tag }))
        });
      }
    }

    return results;
  }

  /**
   * Search all fields
   */
  async searchAll(query) {
    const contentResults = await this.searchContent(query);
    const titleResults = await this.searchTitles(query);
    const tagResults = await this.searchTags(query);

    // Combine and merge results
    const allResults = new Map();

    for (const result of [...contentResults, ...titleResults, ...tagResults]) {
      const existing = allResults.get(result.path);
      if (existing) {
        existing.score += result.score;
        existing.matches.push(...result.matches);
        existing.type = 'all';
      } else {
        allResults.set(result.path, { ...result, type: 'all' });
      }
    }

    return Array.from(allResults.values());
  }

  /**
   * Find text matches in note content
   */
  findMatches(notePath, searchTerms) {
    const contentData = this.noteContent.get(notePath);
    if (!contentData) return [];

    const matches = [];
    const excerpt = contentData.excerpt.toLowerCase();

    for (const term of searchTerms) {
      const index = excerpt.indexOf(term);
      if (index !== -1) {
        const start = Math.max(0, index - 50);
        const end = Math.min(excerpt.length, index + term.length + 50);
        const context = excerpt.slice(start, end);
        
        matches.push({
          field: 'content',
          text: context,
          term: term,
          position: index
        });
      }
    }

    return matches;
  }

  /**
   * Sort search results
   */
  sortResults(results, sortBy) {
    switch (sortBy) {
      case 'date':
        return results.sort((a, b) => {
          const aData = this.noteContent.get(a.path);
          const bData = this.noteContent.get(b.path);
          return new Date(bData?.lastIndexed || 0) - new Date(aData?.lastIndexed || 0);
        });
      
      case 'title':
        return results.sort((a, b) => {
          const aTitle = this.noteContent.get(a.path)?.title || '';
          const bTitle = this.noteContent.get(b.path)?.title || '';
          return aTitle.localeCompare(bTitle);
        });
      
      case 'relevance':
      default:
        return results.sort((a, b) => b.score - a.score);
    }
  }

  /**
   * Enrich results with metadata
   */
  async enrichResultsWithMetadata(results) {
    const enriched = [];

    for (const result of results) {
      const metadata = await this.plugin.metadata.getNoteMetadata(result.path);
      const contentData = this.noteContent.get(result.path);

      enriched.push({
        ...result,
        title: contentData?.title || 'Untitled',
        excerpt: contentData?.excerpt || '',
        tags: metadata.tags || [],
        category: metadata.category || null,
        lastModified: metadata.lastModified,
        wordCount: contentData?.wordCount || 0
      });
    }

    return enriched;
  }

  /**
   * Extract text content from HTML
   */
  extractTextContent(html) {
    // Create temporary element to strip HTML
    const temp = document.createElement('div');
    temp.innerHTML = html;
    
    // Remove script and style elements
    const scripts = temp.querySelectorAll('script, style');
    scripts.forEach(el => el.remove());
    
    return temp.textContent || temp.innerText || '';
  }

  /**
   * Extract title from content
   */
  extractTitle(content) {
    // Look for first heading
    const headingMatch = content.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/i);
    if (headingMatch) {
      return this.extractTextContent(headingMatch[1]).trim();
    }

    // Look for first line of text
    const textContent = this.extractTextContent(content);
    const firstLine = textContent.split('\n')[0].trim();
    
    return firstLine.slice(0, 100) || 'Untitled';
  }

  /**
   * Create excerpt from text
   */
  createExcerpt(text, maxLength = 300) {
    const clean = text.replace(/\s+/g, ' ').trim();
    
    if (clean.length <= maxLength) {
      return clean;
    }

    // Find last complete word within limit
    const truncated = clean.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    
    return lastSpace > 0 ? 
      truncated.slice(0, lastSpace) + '...' : 
      truncated + '...';
  }

  /**
   * Tokenize text into search terms
   */
  tokenizeText(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word))
      .filter(Boolean);
  }

  /**
   * Set search depth for related searches
   */
  setSearchDepth(depth) {
    this.searchDepth = Math.max(1, Math.min(10, depth));
  }

  /**
   * Get search statistics
   */
  getStatistics() {
    return {
      indexedTerms: this.index.size,
      indexedNotes: this.noteContent.size,
      averageWordsPerNote: this.noteContent.size > 0 ? 
        Array.from(this.noteContent.values())
          .reduce((sum, data) => sum + (data.wordCount || 0), 0) / this.noteContent.size : 0
    };
  }
}