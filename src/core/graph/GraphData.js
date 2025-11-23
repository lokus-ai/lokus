/**
 * GraphData - Real-time WikiLink integration and graph data management
 *
 * Features:
 * - Real-time sync with WikiLinks in documents
 * - Bidirectional relationship tracking
 * - Tag-based clustering and grouping
 * - Content preview and metadata
 * - IndexedDB persistence for large datasets
 * - Performance optimized for 10,000+ nodes
 */

import { v4 as uuidv4 } from 'uuid';
import { extractTags, extractInlineTags } from '../tags/tag-parser.js';
import { parseFrontmatter } from '../../bases/data/FrontmatterParser.js';

// Create deterministic ID from file path
function createNodeId(filePath) {
  // Simple hash function for deterministic IDs
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `node_${Math.abs(hash).toString(36)}`;
}

// Helper function to get CSS variable value
function getCSSVariable(variableName) {
  if (typeof window === 'undefined') return null;
  const value = getComputedStyle(document.documentElement).getPropertyValue(variableName).trim();
  // If it's a hex color, return it
  if (value.startsWith('#')) return value;
  // If it's an RGB value (like "10 185 129"), convert to hex
  if (value && !value.startsWith('#')) {
    const rgb = value.split(' ').map(n => parseInt(n.trim()));
    if (rgb.length === 3 && rgb.every(n => !isNaN(n))) {
      return `#${rgb.map(n => n.toString(16).padStart(2, '0')).join('')}`;
    }
  }
  return value || null;
}

export class GraphData {
  constructor(options = {}) {
    this.options = {
      enablePersistence: options.enablePersistence !== false,
      enableRealTimeSync: options.enableRealTimeSync !== false,
      maxCacheSize: options.maxCacheSize || 10000,
      indexedDBName: options.indexedDBName || 'lokus-graph-db',
      ...options
    };

    // Core data structures
    this.nodes = new Map(); // nodeId -> node data
    this.links = new Map(); // linkId -> link data
    this.metadata = new Map(); // nodeId -> metadata
    this.tags = new Map(); // tag -> Set of nodeIds
    this.backlinks = new Map(); // nodeId -> Set of nodeIds that link to it
    this.forwardlinks = new Map(); // nodeId -> Set of nodeIds it links to

    // WikiLink tracking
    this.wikiLinks = new Map(); // [[page]] -> nodeId
    this.documentNodes = new Map(); // documentId -> nodeId
    this.fileWatchers = new Map(); // fileId -> watcher

    // Clustering and analysis
    this.clusters = new Map(); // clusterId -> Set of nodeIds
    this.communities = new Map(); // communityId -> Set of nodeIds
    this.centralityScores = new Map(); // nodeId -> centrality score

    // Performance tracking
    this.stats = {
      nodeCount: 0,
      linkCount: 0,
      wikiLinkCount: 0,
      lastSync: Date.now(),
      syncDuration: 0
    };

    // Event system
    this.listeners = new Map();

    // Initialize
    this.initializeDatabase();
    this.setupRealtimeSync();
  }

  /**
   * Initialize IndexedDB for persistence
   */
  async initializeDatabase() {
    if (!this.options.enablePersistence) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.options.indexedDBName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.loadPersistedData();
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('nodes')) {
          const nodeStore = db.createObjectStore('nodes', { keyPath: 'id' });
          nodeStore.createIndex('type', 'type', { unique: false });
          nodeStore.createIndex('lastModified', 'lastModified', { unique: false });
        }

        if (!db.objectStoreNames.contains('links')) {
          const linkStore = db.createObjectStore('links', { keyPath: 'id' });
          linkStore.createIndex('source', 'source', { unique: false });
          linkStore.createIndex('target', 'target', { unique: false });
        }

        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'nodeId' });
        }
      };
    });
  }

  /**
   * Load persisted data from IndexedDB
   */
  async loadPersistedData() {
    if (!this.db) return;

    try {
      const [nodes, links, metadata] = await Promise.all([
        this.getAllFromStore('nodes'),
        this.getAllFromStore('links'),
        this.getAllFromStore('metadata')
      ]);

      // Reconstruct data structures
      nodes.forEach(node => this.nodes.set(node.id, node));
      links.forEach(link => this.links.set(link.id, link));
      metadata.forEach(meta => this.metadata.set(meta.nodeId, meta));

      this.rebuildIndices();
      this.emit('dataLoaded', { nodeCount: nodes.length, linkCount: links.length });
    } catch (error) {
    }
  }

  /**
   * Get all records from an IndexedDB store
   */
  async getAllFromStore(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Setup real-time synchronization with document changes
   */
  setupRealtimeSync() {
    if (!this.options.enableRealTimeSync) return;

    // Listen for document changes
    this.on('documentChanged', this.handleDocumentChange.bind(this));
    this.on('documentCreated', this.handleDocumentCreated.bind(this));
    this.on('documentDeleted', this.handleDocumentDeleted.bind(this));

    // Start periodic sync
    this.syncInterval = setInterval(() => {
      this.syncWithDocuments();
    }, 5000); // Sync every 5 seconds
  }

  /**
   * Handle document content changes
   */
  async handleDocumentChange(event) {
    const { documentId, content, metadata } = event;

    const startTime = performance.now();

    // Parse WikiLinks from content
    const wikiLinks = this.extractWikiLinks(content);
    const tags = this.extractTags(content);

    // Get or create node for this document
    let node = this.getNodeByDocumentId(documentId);
    if (!node) {
      node = this.createDocumentNode(documentId, metadata);
    }

    // Update node content and metadata
    this.updateNodeContent(node.id, content, metadata);

    // Update WikiLinks
    await this.updateWikiLinksForNode(node.id, wikiLinks);

    // Update tags
    this.updateTagsForNode(node.id, tags);

    // Recalculate metrics
    this.recalculateNodeMetrics(node.id);

    const syncDuration = performance.now() - startTime;
    this.stats.lastSync = Date.now();
    this.stats.syncDuration = syncDuration;

    this.emit('nodeUpdated', { nodeId: node.id, syncDuration });
  }

  /**
   * Handle document creation
   */
  async handleDocumentCreated(event) {
    const { documentId, content = '', metadata = {} } = event;

    // Create new node for the document
    const node = this.createDocumentNode(documentId, metadata);

    // If there's content, parse it
    if (content.trim()) {
      await this.handleDocumentChange({ documentId, content, metadata });
    }

    this.emit('nodeCreated', { nodeId: node.id, documentId });
  }

  /**
   * Handle document deletion
   */
  async handleDocumentDeleted(event) {
    const { documentId } = event;

    // Find and remove the node
    const node = this.getNodeByDocumentId(documentId);
    if (node) {
      this.removeNode(node.id);
      this.documentNodes.delete(documentId);
      this.emit('nodeDeleted', { nodeId: node.id, documentId });
    }
  }

  /**
   * Handle bulk document changes for initial load
   */
  async handleBulkDocumentChanges(documents) {
    const startTime = performance.now();
    let processedCount = 0;

    // Process all documents
    for (const doc of documents) {
      const { documentId, content, metadata } = doc;

      // Parse WikiLinks from content
      const wikiLinks = this.extractWikiLinks(content);
      const tags = this.extractTags(content);

      // Get or create node for this document
      let node = this.getNodeByDocumentId(documentId);
      if (!node) {
        node = this.createDocumentNode(documentId, metadata);
      }

      // Update node content and metadata
      this.updateNodeContent(node.id, content, metadata);

      // Update WikiLinks
      await this.updateWikiLinksForNode(node.id, wikiLinks);

      // Update tags
      this.updateTagsForNode(node.id, tags);

      // Recalculate metrics
      this.recalculateNodeMetrics(node.id);

      processedCount++;
    }

    const totalDuration = performance.now() - startTime;
    this.stats.lastSync = Date.now();

    this.emit('dataLoaded', {
      nodeCount: this.nodes.size,
      linkCount: this.links.size,
      duration: totalDuration
    });
  }

  /**
   * Extract WikiLinks from content (supports multiple formats)
   */
  extractWikiLinks(content) {
    const links = [];

    // Format 1: HTML WikiLink nodes (from Cmd+L modal)
    const htmlWikiLinkRegex = /<a[^>]*data-type="wiki-link"[^>]*>([^<]*)<\/a>/g;
    let match;

    while ((match = htmlWikiLinkRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const displayText = match[1].trim();

      // Extract href from the full match
      const hrefMatch = /href="([^"]*)"/.exec(fullMatch);
      const href = hrefMatch ? hrefMatch[1].trim() : '';

      // Extract page name from href, remove full path and .md extension
      let page = href;
      if (href.includes('/')) {
        // Extract filename from full path
        page = href.split('/').pop() || '';
      }
      page = page.replace('.md', '') || displayText;

      links.push({
        page,
        display: displayText,
        position: match.index,
        raw: fullMatch,
        type: 'wikilink'
      });
    }

    // Format 2: [[WikiLink]] or [[WikiLink|Display]] (STANDARD OBSIDIAN SYNTAX)
    const standardWikiLinkRegex = /\[\[([^\]]+)\]\]/g;

    while ((match = standardWikiLinkRegex.exec(content)) !== null) {
      const linkText = match[1].trim();
      const [page, display] = linkText.includes('|')
        ? linkText.split('|').map(s => s.trim())
        : [linkText, linkText];

      links.push({
        page: page.replace('.md', ''), // Remove .md extension if present
        display,
        position: match.index,
        raw: match[0],
        type: 'wikilink'
      });
    }

    // Format 3: HTML target-based WikiLinks (from saved files): <a target="..." href="..." ...>
    const targetWikiLinkRegex = /<a[^>]+target="([^"]+)"[^>]*>/g;

    while ((match = targetWikiLinkRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const target = match[1].trim();

      // Extract href from the full match for full path
      const hrefMatch = /href="([^"]*)"/.exec(fullMatch);
      const href = hrefMatch ? hrefMatch[1].trim() : '';

      // Use href (full path) if available, otherwise fall back to target
      let page = href || target;

      // If href contains full path, use it directly; otherwise use target
      if (href && href.includes('/')) {
        // href has full path, use it directly for ID generation
        page = href;
      } else {
        // No full path available, use target filename
        page = target.replace('.md', '');
      }

      // Don't duplicate if already found
      const alreadyExists = links.some(link =>
        link.page === page || link.page === target || link.page === href
      );

      if (!alreadyExists) {
        links.push({
          page,
          display: target.replace('.md', ''), // Display name is still the filename
          position: match.index,
          raw: fullMatch,
          type: 'wikilink',
          fullPath: href, // Store the full path for debugging
          target: target  // Store the original target for debugging
        });
      }
    }

    // Format 4: <<WikiLink>> or <<WikiLink|Display>> (TEXT SYNTAX)
    const wikiLinkRegex = /<<([^>]+)>>/g;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const linkText = match[1].trim();
      const [page, display] = linkText.includes('|')
        ? linkText.split('|').map(s => s.trim())
        : [linkText, linkText];

      // Don't duplicate if already found as standard WikiLink
      const alreadyExists = links.some(link =>
        link.page === page || link.page === page.replace('.md', '')
      );

      if (!alreadyExists) {
        links.push({
          page: page.replace('.md', ''), // Remove .md extension if present
          display,
          position: match.index,
          raw: match[0],
          type: 'wikilink'
        });
      }
    }

    // Format 4: File.md links (like Test1.md)
    const mdLinkRegex = /([A-Za-z0-9_-]+\.md)\b/g;

    while ((match = mdLinkRegex.exec(content)) !== null) {
      const fileName = match[1];
      const pageName = fileName.replace('.md', '');

      // Don't duplicate if already found as WikiLink
      const alreadyExists = links.some(link =>
        link.page === pageName || link.page === fileName
      );

      if (!alreadyExists) {
        links.push({
          page: pageName,
          display: pageName,
          position: match.index,
          raw: match[0],
          type: 'mdfile'
        });
      }
    }

    // Format 5: [Link](File.md) markdown links
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+\.md)\)/g;

    while ((match = markdownLinkRegex.exec(content)) !== null) {
      const display = match[1].trim();
      const fileName = match[2];
      const pageName = fileName.replace('.md', '');

      // Don't duplicate if already found
      const alreadyExists = links.some(link =>
        link.page === pageName || link.page === fileName
      );

      if (!alreadyExists) {
        links.push({
          page: pageName,
          display: display,
          position: match.index,
          raw: match[0],
          type: 'markdown'
        });
      }
    }

    return links;
  }

  /**
   * Extract tags from content (including YAML frontmatter)
   */
  extractTags(content) {
    try {
      // Parse frontmatter to get tags from YAML
      const { raw: frontmatter } = parseFrontmatter(content);

      // Extract tags using the proper tag parser
      const allTags = extractTags(content, frontmatter);

      // Convert Set to array format expected by rest of the code
      const tags = Array.from(allTags).map(tag => ({
        tag: tag,
        position: 0, // Position is not critical for graph view
        raw: `#${tag}`
      }));

      return tags;
    } catch (error) {
      console.error('[GraphData] Failed to extract tags:', error);
      return [];
    }
  }

  /**
   * Get node by document ID
   */
  getNodeByDocumentId(documentId) {
    const nodeId = this.documentNodes.get(documentId);
    return nodeId ? this.nodes.get(nodeId) : null;
  }

  /**
   * Create node for a document
   */
  createDocumentNode(documentId, metadata = {}) {
    const nodeId = createNodeId(documentId); // Use deterministic ID
    const now = Date.now();

    const node = {
      id: nodeId,
      type: 'document',
      documentId,
      title: metadata.title || metadata.filename || 'Untitled',
      label: metadata.title || metadata.filename || 'Untitled',
      size: 8,
      color: this.getTypeColor('document'),
      created: now,
      lastModified: now,
      wordCount: 0,
      linkCount: 0,
      backinkCount: 0,
      tags: [],
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      metadata: { ...metadata }
    };

    this.nodes.set(nodeId, node);
    this.documentNodes.set(documentId, nodeId);
    this.stats.nodeCount++;

    this.persistNode(node);
    this.emit('nodeCreated', { node });


    // Clean up any existing placeholder for this document
    this.cleanupPlaceholderForDocument(documentId, metadata.title);

    return node;
  }

  /**
   * Remove placeholder node if document node exists
   */
  cleanupPlaceholderForDocument(documentId, title) {
    const nodesToRemove = [];

    for (const [nodeId, node] of this.nodes.entries()) {
      if (node.type === 'placeholder' &&
        (node.title === title ||
          node.title === title?.replace('.md', '') ||
          node.title + '.md' === title)) {
        nodesToRemove.push(nodeId);
      }
    }

    // Remove placeholder nodes
    for (const nodeId of nodesToRemove) {
      this.removeNode(nodeId);
    }
  }

  /**
   * Update WikiLinks for a node
   */
  async updateWikiLinksForNode(nodeId, wikiLinks) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove existing forward links for this node
    const existingForwardLinks = this.forwardlinks.get(nodeId) || new Set();
    for (const targetId of existingForwardLinks) {
      this.removeLink(nodeId, targetId);
    }

    // Create new links
    const newForwardLinks = new Set();

    for (const wikiLink of wikiLinks) {
      const targetNode = await this.getOrCreateWikiLinkNode(wikiLink.page);

      if (targetNode.id !== nodeId) { // Avoid self-links
        this.createLink(nodeId, targetNode.id, {
          type: 'wikilink',
          strength: 1,
          metadata: {
            displayText: wikiLink.display,
            position: wikiLink.position
          }
        });

        newForwardLinks.add(targetNode.id);
      }
    }

    this.forwardlinks.set(nodeId, newForwardLinks);

    // Update node statistics
    node.linkCount = newForwardLinks.size;
    node.lastModified = Date.now();

    this.persistNode(node);
  }

  /**
   * Get or create node for a WikiLink target
   */
  async getOrCreateWikiLinkNode(pageName) {

    // Handle full path vs filename scenarios
    let expectedNodeId;
    let normalizedPageName;

    if (pageName.includes('/')) {
      // This is a full path, use it directly
      expectedNodeId = createNodeId(pageName);
      normalizedPageName = pageName;
    } else {
      // This is just a filename, normalize it
      normalizedPageName = pageName.endsWith('.md') ? pageName : pageName + '.md';
      expectedNodeId = createNodeId(normalizedPageName);
    }

    // First, check if we already have a document node with this exact ID
    if (this.nodes.has(expectedNodeId)) {
      const existingNode = this.nodes.get(expectedNodeId);
      // Update wikiLinks mapping to point to this document node
      this.wikiLinks.set(pageName, existingNode.id);
      return existingNode;
    }

    // If we have a filename but nodes are stored with full paths, search for any node ending with this filename
    if (!pageName.includes('/')) {
      for (const node of this.nodes.values()) {
        if (node.type === 'document') {
          // Check if the node's documentId ends with our filename
          if (node.documentId && node.documentId.endsWith(normalizedPageName)) {
            this.wikiLinks.set(pageName, node.id);
            return node;
          }
          // Also check by title
          if (node.title === pageName || node.title === normalizedPageName || node.title + '.md' === normalizedPageName) {
            this.wikiLinks.set(pageName, node.id);
            return node;
          }
        }
      }
    }

    // If we have a full path but nodes might be stored with filenames, extract filename and search
    if (pageName.includes('/')) {
      const filename = pageName.split('/').pop();
      for (const node of this.nodes.values()) {
        if (node.type === 'document' && (node.title === filename || node.title === filename.replace('.md', ''))) {
          this.wikiLinks.set(pageName, node.id);
          return node;
        }
      }
    }

    // Check if we already have a placeholder/wikilink node for this page
    let nodeId = this.wikiLinks.get(pageName);

    if (nodeId && this.nodes.has(nodeId)) {
      return this.nodes.get(nodeId);
    }

    // Create new placeholder node with the SAME ID that the document would have
    nodeId = expectedNodeId; // Use the same ID generation as document nodes!
    const now = Date.now();

    const node = {
      id: nodeId,
      type: 'placeholder',
      title: pageName,
      label: pageName,
      size: 6,
      color: this.getTypeColor('placeholder'),
      created: now,
      lastModified: now,
      isPlaceholder: true,
      wordCount: 0,
      linkCount: 0,
      backlinkCount: 0,
      tags: [],
      x: Math.random() * 800 + 100,
      y: Math.random() * 600 + 100,
      metadata: {}
    };

    this.nodes.set(nodeId, node);
    this.wikiLinks.set(pageName, nodeId);
    this.stats.nodeCount++;

    this.persistNode(node);
    this.emit('nodeCreated', { node });


    return node;
  }

  /**
   * Update WikiLinks for a specific node
   */
  async updateWikiLinksForNode(nodeId, wikiLinks) {
    const node = this.nodes.get(nodeId);
    if (!node) return;


    // Remove existing forward links for this node
    const existingForwardLinks = this.forwardlinks.get(nodeId) || new Set();
    for (const targetId of existingForwardLinks) {
      const linkId = `${nodeId}-${targetId}`;
      if (this.links.has(linkId)) {
        this.links.delete(linkId);
        this.stats.linkCount--;

        // Remove from backlinks
        const backlinks = this.backlinks.get(targetId);
        if (backlinks) {
          backlinks.delete(nodeId);
        }

      }
    }

    // Clear forward links for this node
    this.forwardlinks.set(nodeId, new Set());

    // Create new links for each WikiLink
    for (const wikiLink of wikiLinks) {
      try {
        // Get or create target node
        const targetNode = await this.getOrCreateWikiLinkNode(wikiLink.page);

        // Don't create self-links
        if (targetNode.id === nodeId) {
          continue;
        }

        // Create the link
        const link = this.createLink(nodeId, targetNode.id, {
          type: wikiLink.type || 'wikilink',
          strength: 1,
          metadata: {
            linkText: wikiLink.display,
            position: wikiLink.position,
            raw: wikiLink.raw
          }
        });

        // Link created successfully

        // Update wikilink count
        if (wikiLink.type === 'wikilink' || wikiLink.type === 'mdfile') {
          this.stats.wikiLinkCount++;
        }

      } catch (error) {
      }
    }

    // Update node link count
    node.linkCount = (this.forwardlinks.get(nodeId) || new Set()).size;
    this.persistNode(node);
  }

  /**
   * Create link between nodes
   */
  createLink(sourceId, targetId, options = {}) {
    const linkId = options.id || `${sourceId}-${targetId}`;

    if (this.links.has(linkId)) {
      return this.links.get(linkId); // Link already exists
    }

    // Get node titles for better logging
    const sourceNode = this.nodes.get(sourceId);
    const targetNode = this.nodes.get(targetId);
    const sourceTitle = sourceNode ? sourceNode.title : sourceId;
    const targetTitle = targetNode ? targetNode.title : targetId;


    const link = {
      id: linkId,
      source: sourceId,
      target: targetId,
      type: options.type || 'default',
      strength: options.strength || 1,
      color: options.color || this.getLinkColor(options.type),
      width: options.width || 1.5,
      created: Date.now(),
      metadata: options.metadata || {}
    };

    this.links.set(linkId, link);
    this.stats.linkCount++;

    // Update backlinks and forward links
    if (!this.backlinks.has(targetId)) {
      this.backlinks.set(targetId, new Set());
    }
    this.backlinks.get(targetId).add(sourceId);

    if (!this.forwardlinks.has(sourceId)) {
      this.forwardlinks.set(sourceId, new Set());
    }
    this.forwardlinks.get(sourceId).add(targetId);

    // Update target node backlink count
    if (targetNode) {
      targetNode.backlinkCount = this.backlinks.get(targetId).size;
      this.persistNode(targetNode);
    }

    this.persistLink(link);
    this.emit('linkCreated', { link });

    return link;
  }

  /**
   * Remove link between nodes
   */
  removeLink(sourceId, targetId) {
    const linkId = `${sourceId}-${targetId}`;
    const link = this.links.get(linkId);

    if (!link) return;

    this.links.delete(linkId);
    this.stats.linkCount--;

    // Update indices
    if (this.backlinks.has(targetId)) {
      this.backlinks.get(targetId).delete(sourceId);
    }
    if (this.forwardlinks.has(sourceId)) {
      this.forwardlinks.get(sourceId).delete(targetId);
    }

    // Update target node backlink count
    const targetNode = this.nodes.get(targetId);
    if (targetNode) {
      targetNode.backlinkCount = this.backlinks.get(targetId)?.size || 0;
      this.persistNode(targetNode);
    }

    this.deletePersistedLink(linkId);
    this.emit('linkRemoved', { link });
  }

  /**
   * Update tags for a node
   */
  updateTagsForNode(nodeId, extractedTags) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove node from old tags
    for (const oldTag of node.tags || []) {
      if (this.tags.has(oldTag)) {
        this.tags.get(oldTag).delete(nodeId);
        if (this.tags.get(oldTag).size === 0) {
          this.tags.delete(oldTag);
        }
      }
    }

    // Add node to new tags
    const newTags = extractedTags.map(t => t.tag);
    node.tags = newTags;

    for (const tag of newTags) {
      if (!this.tags.has(tag)) {
        this.tags.set(tag, new Set());
      }
      this.tags.get(tag).add(nodeId);
    }

    node.lastModified = Date.now();
    this.persistNode(node);
  }

  /**
   * Update node content and metadata
   */
  updateNodeContent(nodeId, content, metadata = {}) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Update content metadata
    node.wordCount = this.countWords(content);
    node.lastModified = Date.now();
    node.metadata = { ...node.metadata, ...metadata };

    // Update title if provided
    if (metadata.title && metadata.title !== node.title) {
      node.title = metadata.title;
      node.label = metadata.title;
    }

    // Update node size based on content length
    node.size = Math.max(6, Math.min(20, 6 + Math.log10(node.wordCount + 1) * 2));

    this.persistNode(node);
    this.emit('nodeContentUpdated', { nodeId, content, metadata });
  }

  /**
   * Count words in content
   */
  countWords(content) {
    if (!content) return 0;
    return content.trim().split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Recalculate node metrics (centrality, importance, etc.)
   */
  recalculateNodeMetrics(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Calculate degree centrality
    const inDegree = this.backlinks.get(nodeId)?.size || 0;
    const outDegree = this.forwardlinks.get(nodeId)?.size || 0;
    const degree = inDegree + outDegree;

    // Calculate betweenness centrality (simplified)
    const betweenness = this.calculateBetweennessCentrality(nodeId);

    // Combined importance score
    const importance = (degree * 0.7) + (betweenness * 0.3) + (Math.log10(node.wordCount + 1) * 0.1);

    this.centralityScores.set(nodeId, {
      degree,
      inDegree,
      outDegree,
      betweenness,
      importance
    });

    // Update node color based on importance
    node.color = this.getImportanceColor(importance);
  }

  /**
   * Calculate simplified betweenness centrality
   */
  calculateBetweennessCentrality(nodeId) {
    // Simplified calculation - in a full implementation, 
    // this would use shortest path algorithms
    const connections = this.backlinks.get(nodeId)?.size || 0;
    return connections > 0 ? Math.log10(connections + 1) : 0;
  }

  /**
   * Get color based on node type
   */
  getTypeColor(type) {
    // Try to get color from CSS variables (theme-aware)
    const cssColors = {
      document: getCSSVariable('--graph-node-document'),
      placeholder: getCSSVariable('--graph-node-placeholder'),
      tag: getCSSVariable('--graph-node-tag'),
      folder: getCSSVariable('--graph-node-folder')
    };

    // Fallback colors if CSS variables not available
    const fallbackColors = {
      document: '#10b981',
      placeholder: '#6b7280',
      tag: '#ef4444',
      folder: '#f59e0b',
      default: '#6366f1'
    };

    return cssColors[type] || fallbackColors[type] || fallbackColors.default;
  }

  /**
   * Get color based on importance
   */
  getImportanceColor(importance) {
    if (importance > 10) return '#dc2626'; // Red for very important
    if (importance > 5) return '#ea580c'; // Orange for important
    if (importance > 2) return '#ca8a04'; // Yellow for moderately important
    return '#10b981'; // Green for normal
  }

  /**
   * Get link color based on type
   */
  getLinkColor(type) {
    // Try to get color from CSS variables (theme-aware)
    const baseColor = getCSSVariable('--graph-link');
    const hoverColor = getCSSVariable('--graph-link-hover');

    // Add transparency to theme colors
    if (baseColor && baseColor.startsWith('#')) {
      return baseColor + '60'; // Add 60 alpha (37.5% opacity)
    }

    // Fallback colors if CSS variables not available
    const fallbackColors = {
      wikilink: '#ffffff60',
      tag: '#ef444460',
      folder: '#f59e0b60',
      default: '#ffffff40'
    };

    return fallbackColors[type] || fallbackColors.default;
  }

  /**
   * Rebuild indices after data load
   */
  rebuildIndices() {
    this.backlinks.clear();
    this.forwardlinks.clear();
    this.wikiLinks.clear();
    this.documentNodes.clear();
    this.tags.clear();

    // Rebuild document mapping
    for (const node of this.nodes.values()) {
      if (node.documentId) {
        this.documentNodes.set(node.documentId, node.id);
      }
      if (node.title && node.type === 'placeholder') {
        this.wikiLinks.set(node.title, node.id);
      }
      if (node.tags) {
        for (const tag of node.tags) {
          if (!this.tags.has(tag)) {
            this.tags.set(tag, new Set());
          }
          this.tags.get(tag).add(node.id);
        }
      }
    }

    // Rebuild link indices
    for (const link of this.links.values()) {
      if (!this.backlinks.has(link.target)) {
        this.backlinks.set(link.target, new Set());
      }
      this.backlinks.get(link.target).add(link.source);

      if (!this.forwardlinks.has(link.source)) {
        this.forwardlinks.set(link.source, new Set());
      }
      this.forwardlinks.get(link.source).add(link.target);
    }

    // Update stats
    this.stats.nodeCount = this.nodes.size;
    this.stats.linkCount = this.links.size;
    this.stats.wikiLinkCount = Array.from(this.links.values())
      .filter(link => link.type === 'wikilink').length;
  }

  /**
   * Sync with all documents
   */
  async syncWithDocuments() {
    // This would integrate with the document system
    // For now, emit event for external handling
    this.emit('syncRequested');
  }

  /**
   * Get graph data for rendering
   */
  getGraphData() {
    return {
      nodes: Array.from(this.nodes.values()),
      links: Array.from(this.links.values())
    };
  }

  /**
   * Search nodes by content
   */
  searchNodes(query, options = {}) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    for (const node of this.nodes.values()) {
      let score = 0;

      // Title match
      if (node.title.toLowerCase().includes(lowerQuery)) {
        score += 10;
      }

      // Tag match
      if (node.tags && node.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
        score += 5;
      }

      // Type match
      if (node.type.toLowerCase().includes(lowerQuery)) {
        score += 3;
      }

      if (score > 0) {
        results.push({ node, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, options.limit || 50)
      .map(r => r.node);
  }

  /**
   * Get nodes by tag
   */
  getNodesByTag(tag) {
    const nodeIds = this.tags.get(tag) || new Set();
    return Array.from(nodeIds).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Get backlinks for a node
   */
  getBacklinks(nodeId) {
    const backlinkIds = this.backlinks.get(nodeId) || new Set();
    return Array.from(backlinkIds).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Get forward links for a node
   */
  getForwardLinks(nodeId) {
    const forwardLinkIds = this.forwardlinks.get(nodeId) || new Set();
    return Array.from(forwardLinkIds).map(id => this.nodes.get(id)).filter(Boolean);
  }

  /**
   * Persist node to IndexedDB
   */
  async persistNode(node) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['nodes'], 'readwrite');
      const store = transaction.objectStore('nodes');
      await store.put(node);
    } catch (error) {
    }
  }

  /**
   * Persist link to IndexedDB
   */
  async persistLink(link) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['links'], 'readwrite');
      const store = transaction.objectStore('links');
      await store.put(link);
    } catch (error) {
    }
  }

  /**
   * Delete persisted link from IndexedDB
   */
  async deletePersistedLink(linkId) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['links'], 'readwrite');
      const store = transaction.objectStore('links');
      await store.delete(linkId);
    } catch (error) {
    }
  }

  /**
   * Event system
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
        }
      });
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      tagCount: this.tags.size,
      placeholderCount: Array.from(this.nodes.values()).filter(n => n.isPlaceholder).length,
      documentCount: Array.from(this.nodes.values()).filter(n => n.type === 'document').length
    };
  }

  /**
   * Remove a node and all its connections
   */
  removeNode(nodeId) {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    // Remove all links connected to this node
    const linksToRemove = [];
    for (const link of this.links.values()) {
      if (link.source === nodeId || link.target === nodeId) {
        linksToRemove.push(link.id);
      }
    }

    for (const linkId of linksToRemove) {
      this.removeLink(linkId);
    }

    // Remove from indices
    this.backlinks.delete(nodeId);
    this.forwardlinks.delete(nodeId);
    this.centralityScores.delete(nodeId);

    // Remove from tag index
    if (node.tags) {
      for (const tag of node.tags) {
        const tagNodes = this.tags.get(tag);
        if (tagNodes) {
          tagNodes.delete(nodeId);
          if (tagNodes.size === 0) {
            this.tags.delete(tag);
          }
        }
      }
    }

    // Remove from wikiLinks index if placeholder
    if (node.type === 'placeholder' && node.title) {
      this.wikiLinks.delete(node.title);
    }

    // Remove the node
    this.nodes.delete(nodeId);

    // Update stats
    this.stats.nodeCount = this.nodes.size;

    // Delete from persistence
    this.deletePersistedNode(nodeId);

    this.emit('nodeRemoved', { nodeId });
  }

  /**
   * Remove a link
   */
  removeLink(linkId) {
    const link = this.links.get(linkId);
    if (!link) return;

    // Remove from backlinks/forwardlinks indices
    const backlinks = this.backlinks.get(link.target);
    if (backlinks) {
      backlinks.delete(link.source);
    }

    const forwardlinks = this.forwardlinks.get(link.source);
    if (forwardlinks) {
      forwardlinks.delete(link.target);
    }

    // Remove the link
    this.links.delete(linkId);

    // Update stats
    this.stats.linkCount = this.links.size;

    // Delete from persistence
    this.deletePersistedLink(linkId);

    this.emit('linkRemoved', { linkId });
  }

  /**
   * Delete persisted node from IndexedDB
   */
  async deletePersistedNode(nodeId) {
    if (!this.db) return;

    try {
      const transaction = this.db.transaction(['nodes'], 'readwrite');
      const store = transaction.objectStore('nodes');
      await store.delete(nodeId);
    } catch (error) {
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    if (this.db) {
      this.db.close();
    }

    this.listeners.clear();
    this.nodes.clear();
    this.links.clear();
    this.metadata.clear();
    this.tags.clear();
    this.backlinks.clear();
    this.forwardlinks.clear();
  }
}

export default GraphData;