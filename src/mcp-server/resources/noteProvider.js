/**
 * Note Resource Provider for Lokus
 * Integrates with Lokus's note system to provide access to:
 * - Markdown files and their processed content
 * - Wiki links and backlinks
 * - Note metadata and structure
 * - Note relationships and graph data
 */

import { invoke } from '@tauri-apps/api/core';
import { getMarkdownCompiler } from '../../core/markdown/compiler.js';

export class NoteProvider {
  constructor() {
    this.workspacePath = null;
    this.notes = new Map();
    this.wikiLinks = new Map();
    this.backlinks = new Map();
    this.subscribers = new Set();
    this.markdownCompiler = null;

    // Initialize note monitoring
    this.initializeNoteMonitoring();
  }

  /**
   * Initialize note monitoring and markdown compiler
   */
  async initializeNoteMonitoring() {
    try {
      // Initialize markdown compiler
      this.markdownCompiler = getMarkdownCompiler();

      // Get current workspace path
      this.workspacePath = typeof window !== 'undefined' ? window.__LOKUS_WORKSPACE_PATH__ : null;

      if (this.workspacePath) {
        await this.loadNotes();
      }

      // Setup monitoring
      this.setupNoteListeners();
    } catch { }
  }

  /**
   * Load all notes from the workspace
   */
  async loadNotes() {
    if (!this.workspacePath) return;

    try {
      // Get file tree and filter for markdown files
      const files = await invoke('read_workspace_files', { workspacePath: this.workspacePath });
      const markdownFiles = this.findMarkdownFiles(files);

      // Load content for each markdown file
      for (const file of markdownFiles) {
        await this.loadNoteContent(file.path);
      }

      // Process wiki links and build relationships
      this.processWikiLinks();

      // Notify subscribers
      this.notifySubscribers('notes:loaded');
    } catch { }
  }

  /**
   * Find all markdown files in the file tree
   */
  findMarkdownFiles(entries, markdownFiles = []) {
    for (const entry of entries) {
      if (entry.is_directory && entry.children) {
        this.findMarkdownFiles(entry.children, markdownFiles);
      } else if (!entry.is_directory && entry.name.endsWith('.md')) {
        markdownFiles.push(entry);
      }
    }
    return markdownFiles;
  }

  /**
   * Load content for a specific note
   */
  async loadNoteContent(notePath) {
    try {
      const content = await invoke('read_file_content', { path: notePath });
      const name = notePath.split('/').pop().replace('.md', '');

      // Process markdown content
      const processedContent = this.markdownCompiler ?
        await this.markdownCompiler.process(content) : content;

      // Extract metadata
      const metadata = this.extractNoteMetadata(content, notePath);

      // Extract wiki links
      const wikiLinks = this.extractWikiLinks(content);

      // Store note data
      const noteData = {
        path: notePath,
        name,
        content,
        processedContent,
        metadata,
        wikiLinks,
        lastModified: new Date().toISOString(),
        wordCount: content.split(/\s+/).length,
        characterCount: content.length
      };

      this.notes.set(notePath, noteData);

      return noteData;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract note metadata from content
   */
  extractNoteMetadata(content, notePath) {
    const metadata = {
      title: notePath.split('/').pop().replace('.md', ''),
      tags: [],
      createdDate: null,
      modifiedDate: new Date().toISOString(),
      frontmatter: null
    };

    // Extract frontmatter if present
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      try {
        const frontmatter = {};
        const lines = frontmatterMatch[1].split('\n');
        for (const line of lines) {
          const [key, ...valueParts] = line.split(':');
          if (key && valueParts.length > 0) {
            const value = valueParts.join(':').trim();
            frontmatter[key.trim()] = value;
          }
        }
        metadata.frontmatter = frontmatter;

        // Extract common metadata fields
        if (frontmatter.title) metadata.title = frontmatter.title;
        if (frontmatter.tags) {
          metadata.tags = Array.isArray(frontmatter.tags) ?
            frontmatter.tags : frontmatter.tags.split(',').map(t => t.trim());
        }
        if (frontmatter.created) metadata.createdDate = frontmatter.created;
        if (frontmatter.modified) metadata.modifiedDate = frontmatter.modified;
      } catch { }
    }

    // Extract inline tags (#tag)
    const inlineTags = content.match(/#[a-zA-Z0-9_-]+/g);
    if (inlineTags) {
      metadata.tags = [...metadata.tags, ...inlineTags.map(tag => tag.substring(1))];
      metadata.tags = [...new Set(metadata.tags)]; // Remove duplicates
    }

    // Extract title from first heading if not set
    if (metadata.title === notePath.split('/').pop().replace('.md', '')) {
      const firstHeading = content.match(/^#\s+(.+)$/m);
      if (firstHeading) {
        metadata.title = firstHeading[1].trim();
      }
    }

    return metadata;
  }

  /**
   * Extract wiki links from content
   */
  extractWikiLinks(content) {
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    const links = [];
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const linkText = match[1];
      const [target, display] = linkText.includes('|') ?
        linkText.split('|').map(s => s.trim()) : [linkText, linkText];

      links.push({
        target: target.trim(),
        display: display.trim(),
        position: match.index
      });
    }

    return links;
  }

  /**
   * Process wiki links to build relationship maps
   */
  processWikiLinks() {
    this.wikiLinks.clear();
    this.backlinks.clear();

    for (const [notePath, noteData] of this.notes) {
      const noteName = noteData.name;

      // Store outgoing links
      if (noteData.wikiLinks.length > 0) {
        this.wikiLinks.set(notePath, noteData.wikiLinks);
      }

      // Build backlinks map
      for (const link of noteData.wikiLinks) {
        const targetNote = this.findNoteByName(link.target);
        if (targetNote) {
          if (!this.backlinks.has(targetNote.path)) {
            this.backlinks.set(targetNote.path, []);
          }
          this.backlinks.get(targetNote.path).push({
            sourcePath: notePath,
            sourceName: noteName,
            linkText: link.display
          });
        }
      }
    }
  }

  /**
   * Find note by name (supports partial matching)
   */
  findNoteByName(name) {
    // Exact match first
    for (const [path, noteData] of this.notes) {
      if (noteData.name.toLowerCase() === name.toLowerCase()) {
        return noteData;
      }
    }

    // Partial match
    for (const [path, noteData] of this.notes) {
      if (noteData.name.toLowerCase().includes(name.toLowerCase())) {
        return noteData;
      }
    }

    return null;
  }

  /**
   * Setup note event listeners
   */
  setupNoteListeners() {
    try {
      // Monitor workspace path changes
      if (typeof window !== 'undefined') {
        const checkWorkspaceChange = () => {
          const currentPath = window.__LOKUS_WORKSPACE_PATH__;
          if (currentPath && currentPath !== this.workspacePath) {
            this.workspacePath = currentPath;
            this.loadNotes();
          }
        };

        setInterval(checkWorkspaceChange, 1000);
      }
    } catch { }
  }

  /**
   * Get all available resources
   */
  async listResources() {
    const resources = [
      {
        uri: 'lokus://notes/all',
        name: 'All Notes',
        description: 'Complete list of all notes in the workspace',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://notes/metadata',
        name: 'Notes Metadata',
        description: 'Metadata for all notes including tags, titles, and statistics',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://notes/wiki-links',
        name: 'Wiki Links',
        description: 'All wiki links and their relationships',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://notes/backlinks',
        name: 'Backlinks',
        description: 'Backlink relationships between notes',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://notes/tags',
        name: 'Note Tags',
        description: 'All tags used across notes',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://notes/graph',
        name: 'Note Graph',
        description: 'Graph representation of note relationships',
        mimeType: 'application/json'
      }
    ];

    // Add individual note resources
    for (const [notePath, noteData] of this.notes) {
      resources.push({
        uri: `lokus://notes/note/${encodeURIComponent(notePath)}`,
        name: `Note: ${noteData.metadata.title}`,
        description: `Content and metadata for note: ${noteData.name}`,
        mimeType: 'text/markdown'
      });
    }

    return resources;
  }

  /**
   * Read a specific resource
   */
  async readResource(uri) {
    try {
      const url = new URL(uri);
      const path = url.pathname;

      switch (path) {
        case '/all':
          return this.getAllNotes();

        case '/metadata':
          return this.getNotesMetadata();

        case '/wiki-links':
          return this.getWikiLinks();

        case '/backlinks':
          return this.getBacklinks();

        case '/tags':
          return this.getNoteTags();

        case '/graph':
          return this.getNoteGraph();

        default:
          if (path.startsWith('/note/')) {
            const notePath = decodeURIComponent(path.substring(6));
            return this.getNoteContent(notePath);
          }
          throw new Error(`Unknown resource path: ${path}`);
      }
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: `Error reading resource: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get all notes
   */
  async getAllNotes() {
    const notesList = Array.from(this.notes.values()).map(note => ({
      path: note.path,
      name: note.name,
      title: note.metadata.title,
      tags: note.metadata.tags,
      wordCount: note.wordCount,
      characterCount: note.characterCount,
      lastModified: note.lastModified,
      wikiLinksCount: note.wikiLinks.length
    }));

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalNotes: notesList.length,
          notes: notesList,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get notes metadata
   */
  async getNotesMetadata() {
    const metadata = Array.from(this.notes.values()).map(note => note.metadata);

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalNotes: metadata.length,
          metadata,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get wiki links
   */
  async getWikiLinks() {
    const wikiLinksData = {};
    for (const [notePath, links] of this.wikiLinks) {
      const noteName = this.notes.get(notePath)?.name || notePath;
      wikiLinksData[noteName] = links;
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalLinkedNotes: this.wikiLinks.size,
          wikiLinks: wikiLinksData,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get backlinks
   */
  async getBacklinks() {
    const backlinksData = {};
    for (const [notePath, backlinks] of this.backlinks) {
      const noteName = this.notes.get(notePath)?.name || notePath;
      backlinksData[noteName] = backlinks;
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalNotesWithBacklinks: this.backlinks.size,
          backlinks: backlinksData,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get note tags
   */
  async getNoteTags() {
    const tagMap = new Map();

    for (const noteData of this.notes.values()) {
      for (const tag of noteData.metadata.tags) {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag).push({
          notePath: noteData.path,
          noteName: noteData.name,
          title: noteData.metadata.title
        });
      }
    }

    const tagsData = {};
    for (const [tag, notes] of tagMap) {
      tagsData[tag] = {
        count: notes.length,
        notes
      };
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          totalTags: tagMap.size,
          tags: tagsData,
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get note graph representation
   */
  async getNoteGraph() {
    const nodes = [];
    const edges = [];

    // Create nodes for each note
    for (const noteData of this.notes.values()) {
      nodes.push({
        id: noteData.path,
        label: noteData.metadata.title,
        name: noteData.name,
        tags: noteData.metadata.tags,
        wordCount: noteData.wordCount,
        type: 'note'
      });
    }

    // Create edges for wiki links
    for (const [sourcePath, links] of this.wikiLinks) {
      for (const link of links) {
        const targetNote = this.findNoteByName(link.target);
        if (targetNote) {
          edges.push({
            source: sourcePath,
            target: targetNote.path,
            type: 'wiki-link',
            label: link.display
          });
        }
      }
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify({
          graph: {
            nodes,
            edges,
            statistics: {
              totalNodes: nodes.length,
              totalEdges: edges.length,
              averageConnections: edges.length / Math.max(nodes.length, 1)
            }
          },
          lastUpdated: new Date().toISOString()
        }, null, 2)
      }]
    };
  }

  /**
   * Get specific note content
   */
  async getNoteContent(notePath) {
    const noteData = this.notes.get(notePath);
    if (!noteData) {
      return {
        contents: [{
          type: 'text',
          text: `Note not found: ${notePath}`
        }]
      };
    }

    return {
      contents: [
        {
          type: 'text',
          text: noteData.content
        },
        {
          type: 'text',
          text: `\n\n--- Note Metadata ---\n${JSON.stringify(noteData.metadata, null, 2)}`
        },
        {
          type: 'text',
          text: `\n\n--- Wiki Links ---\n${JSON.stringify(noteData.wikiLinks, null, 2)}`
        }
      ]
    };
  }

  /**
   * Subscribe to note changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  notifySubscribers(event, data = null) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data);
      } catch { }
    }
  }

  /**
   * Refresh notes data
   */
  async refresh() {
    await this.loadNotes();
    this.notifySubscribers('notes:refreshed');
  }

  /**
   * Get note provider metadata
   */
  getMetadata() {
    return {
      name: 'Lokus Note Provider',
      description: 'Provides access to Lokus notes, wiki links, and note relationships',
      version: '1.0.0',
      capabilities: [
        'note-content',
        'wiki-links',
        'backlinks',
        'note-metadata',
        'note-tags',
        'note-graph',
        'markdown-processing'
      ]
    };
  }
}