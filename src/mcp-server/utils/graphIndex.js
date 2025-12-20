/**
 * Graph Index for Lokus MCP Server
 *
 * Builds and maintains a persistent index of wiki links between notes.
 * Provides graph traversal, path finding, and cluster detection.
 */

import { readFile, writeFile, readdir, stat } from 'fs/promises';
import { join, relative, extname, basename } from 'path';

// Wiki link regex: [[Note Name]] or [[Note Name|Display Text]]
const WIKI_LINK_REGEX = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * GraphIndex class for managing the knowledge graph
 */
export class GraphIndex {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.indexPath = join(workspacePath, '.lokus', 'mcp-graph-index.json');
    this.graph = null;
    this.lastBuilt = null;
  }

  /**
   * Build or load the graph index
   */
  async load(forceRebuild = false) {
    if (!forceRebuild && !this.graph) {
      // Try to load from cache
      try {
        const cached = await this.loadFromCache();
        if (cached && this.isCacheFresh(cached)) {
          this.graph = cached.graph;
          this.lastBuilt = cached.lastBuilt;
          return this.graph;
        }
      } catch (error) {
        // Cache doesn't exist or is invalid
      }
    }

    // Build fresh index
    await this.build();
    return this.graph;
  }

  /**
   * Check if cache is still fresh (less than 5 minutes old)
   */
  isCacheFresh(cached) {
    if (!cached.lastBuilt) return false;
    const age = Date.now() - new Date(cached.lastBuilt).getTime();
    return age < 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Load graph from cache file
   */
  async loadFromCache() {
    const content = await readFile(this.indexPath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Save graph to cache file
   */
  async saveToCache() {
    const data = {
      graph: this.graph,
      lastBuilt: this.lastBuilt,
      version: '1.0'
    };
    await writeFile(this.indexPath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Build the graph from all notes
   */
  async build() {
    this.graph = {
      nodes: {},      // nodeId -> { path, name, links, backlinks, metadata }
      edges: [],      // { from, to, label }
      stats: {}
    };

    // Scan all markdown files
    const files = await this.scanDirectory(this.workspacePath);

    // First pass: create nodes
    for (const file of files) {
      const relativePath = relative(this.workspacePath, file);
      const name = basename(file, '.md');
      const nodeId = this.normalizeNodeId(name);

      this.graph.nodes[nodeId] = {
        id: nodeId,
        path: relativePath,
        name,
        outgoingLinks: [],
        incomingLinks: [],
        metadata: {}
      };
    }

    // Second pass: extract links and create edges
    for (const file of files) {
      await this.processFile(file);
    }

    // Calculate stats
    this.graph.stats = this.calculateStats();
    this.lastBuilt = new Date().toISOString();

    // Save to cache
    try {
      await this.saveToCache();
    } catch (error) {
      // Couldn't save cache, continue anyway
    }

    return this.graph;
  }

  /**
   * Normalize a node ID (case-insensitive, trim whitespace)
   */
  normalizeNodeId(name) {
    return name.trim().toLowerCase().replace(/\.md$/, '');
  }

  /**
   * Process a file and extract wiki links
   */
  async processFile(filePath) {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = relative(this.workspacePath, filePath);
    const sourceName = basename(filePath, '.md');
    const sourceId = this.normalizeNodeId(sourceName);

    const matches = content.matchAll(WIKI_LINK_REGEX);

    for (const match of matches) {
      const [, targetName, displayText] = match;
      const targetId = this.normalizeNodeId(targetName);

      // Skip self-links
      if (sourceId === targetId) continue;

      // Add to source's outgoing links
      if (this.graph.nodes[sourceId]) {
        if (!this.graph.nodes[sourceId].outgoingLinks.includes(targetId)) {
          this.graph.nodes[sourceId].outgoingLinks.push(targetId);
        }
      }

      // Add to target's incoming links (if target exists)
      if (this.graph.nodes[targetId]) {
        if (!this.graph.nodes[targetId].incomingLinks.includes(sourceId)) {
          this.graph.nodes[targetId].incomingLinks.push(sourceId);
        }
      }

      // Add edge
      this.graph.edges.push({
        from: sourceId,
        to: targetId,
        label: displayText || targetName
      });
    }

    // Store metadata
    if (this.graph.nodes[sourceId]) {
      this.graph.nodes[sourceId].metadata = {
        linkCount: this.graph.nodes[sourceId].outgoingLinks.length,
        wordCount: content.split(/\s+/).length
      };
    }
  }

  /**
   * Recursively scan directory for markdown files
   */
  async scanDirectory(dirPath, files = []) {
    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        if (entry.startsWith('.') || entry === 'node_modules') continue;

        const fullPath = join(dirPath, entry);
        const stats = await stat(fullPath);

        if (stats.isDirectory()) {
          await this.scanDirectory(fullPath, files);
        } else if (extname(entry) === '.md') {
          files.push(fullPath);
        }
      }

      return files;
    } catch (error) {
      return files;
    }
  }

  /**
   * Calculate graph statistics
   */
  calculateStats() {
    const nodes = Object.values(this.graph.nodes);
    const totalLinks = this.graph.edges.length;
    const orphans = nodes.filter(n =>
      n.outgoingLinks.length === 0 && n.incomingLinks.length === 0
    ).length;

    const connectionCounts = nodes.map(n =>
      n.outgoingLinks.length + n.incomingLinks.length
    );

    return {
      nodeCount: nodes.length,
      edgeCount: totalLinks,
      orphanCount: orphans,
      averageConnections: nodes.length > 0
        ? (connectionCounts.reduce((a, b) => a + b, 0) / nodes.length).toFixed(2)
        : 0,
      maxConnections: Math.max(...connectionCounts, 0)
    };
  }

  /**
   * Get related notes via graph traversal
   */
  getRelatedNotes(noteName, options = {}) {
    const { depth = 1, direction = 'both', limit = 20 } = options;
    const startId = this.normalizeNodeId(noteName);

    if (!this.graph?.nodes[startId]) {
      return { found: false, related: [] };
    }

    const visited = new Set([startId]);
    const related = [];

    const traverse = (nodeId, currentDepth) => {
      if (currentDepth > depth) return;

      const node = this.graph.nodes[nodeId];
      if (!node) return;

      // Get links based on direction
      let links = [];
      if (direction === 'outgoing' || direction === 'both') {
        links.push(...node.outgoingLinks.map(id => ({ id, type: 'outgoing' })));
      }
      if (direction === 'incoming' || direction === 'both') {
        links.push(...node.incomingLinks.map(id => ({ id, type: 'incoming' })));
      }

      for (const link of links) {
        if (!visited.has(link.id)) {
          visited.add(link.id);

          const linkedNode = this.graph.nodes[link.id];
          if (linkedNode) {
            related.push({
              id: link.id,
              name: linkedNode.name,
              path: linkedNode.path,
              depth: currentDepth,
              direction: link.type,
              connections: linkedNode.outgoingLinks.length + linkedNode.incomingLinks.length
            });

            // Continue traversal
            traverse(link.id, currentDepth + 1);
          }
        }
      }
    };

    traverse(startId, 1);

    // Sort by depth, then by connections
    related.sort((a, b) => {
      if (a.depth !== b.depth) return a.depth - b.depth;
      return b.connections - a.connections;
    });

    return {
      found: true,
      source: this.graph.nodes[startId],
      related: related.slice(0, limit)
    };
  }

  /**
   * Find shortest path between two notes
   */
  findPath(fromName, toName) {
    const fromId = this.normalizeNodeId(fromName);
    const toId = this.normalizeNodeId(toName);

    if (!this.graph?.nodes[fromId] || !this.graph?.nodes[toId]) {
      return { found: false, path: [], message: 'One or both notes not found' };
    }

    if (fromId === toId) {
      return { found: true, path: [this.graph.nodes[fromId]], distance: 0 };
    }

    // BFS to find shortest path
    const queue = [[fromId]];
    const visited = new Set([fromId]);

    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      const node = this.graph.nodes[current];

      if (!node) continue;

      // Check all connections (both directions)
      const neighbors = [...new Set([...node.outgoingLinks, ...node.incomingLinks])];

      for (const neighborId of neighbors) {
        if (neighborId === toId) {
          // Found the target
          const fullPath = [...path, toId].map(id => this.graph.nodes[id]);
          return {
            found: true,
            path: fullPath,
            distance: fullPath.length - 1
          };
        }

        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          queue.push([...path, neighborId]);
        }
      }
    }

    return { found: false, path: [], message: 'No path exists between these notes' };
  }

  /**
   * Get orphan notes (no connections)
   */
  getOrphans() {
    if (!this.graph) return [];

    return Object.values(this.graph.nodes)
      .filter(n => n.outgoingLinks.length === 0 && n.incomingLinks.length === 0)
      .map(n => ({ id: n.id, name: n.name, path: n.path }));
  }

  /**
   * Get hub notes (most connected)
   */
  getHubs(limit = 10) {
    if (!this.graph) return [];

    return Object.values(this.graph.nodes)
      .map(n => ({
        id: n.id,
        name: n.name,
        path: n.path,
        outgoing: n.outgoingLinks.length,
        incoming: n.incomingLinks.length,
        total: n.outgoingLinks.length + n.incomingLinks.length
      }))
      .filter(n => n.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }

  /**
   * Detect clusters (connected components)
   */
  getClusters() {
    if (!this.graph) return [];

    const visited = new Set();
    const clusters = [];

    const dfs = (nodeId, cluster) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = this.graph.nodes[nodeId];
      if (!node) return;

      cluster.push({
        id: nodeId,
        name: node.name,
        path: node.path
      });

      // Visit all connected nodes
      for (const linkedId of [...node.outgoingLinks, ...node.incomingLinks]) {
        dfs(linkedId, cluster);
      }
    };

    for (const nodeId of Object.keys(this.graph.nodes)) {
      if (!visited.has(nodeId)) {
        const cluster = [];
        dfs(nodeId, cluster);
        if (cluster.length > 0) {
          clusters.push(cluster);
        }
      }
    }

    // Sort by cluster size
    clusters.sort((a, b) => b.length - a.length);

    return clusters.map((cluster, index) => ({
      id: index + 1,
      size: cluster.length,
      nodes: cluster
    }));
  }

  /**
   * Search notes by name
   */
  searchByName(query, limit = 20) {
    if (!this.graph) return [];

    const lowerQuery = query.toLowerCase();

    return Object.values(this.graph.nodes)
      .filter(n => n.name.toLowerCase().includes(lowerQuery))
      .map(n => ({
        id: n.id,
        name: n.name,
        path: n.path,
        connections: n.outgoingLinks.length + n.incomingLinks.length
      }))
      .sort((a, b) => {
        // Exact matches first
        const aExact = a.name.toLowerCase() === lowerQuery ? 0 : 1;
        const bExact = b.name.toLowerCase() === lowerQuery ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;
        // Then by connections
        return b.connections - a.connections;
      })
      .slice(0, limit);
  }

  /**
   * Get graph overview
   */
  getOverview() {
    if (!this.graph) return null;

    return {
      stats: this.graph.stats,
      hubs: this.getHubs(5),
      orphanCount: this.graph.stats.orphanCount,
      clusterCount: this.getClusters().length,
      lastBuilt: this.lastBuilt
    };
  }
}

// Singleton instance cache
const instances = new Map();

/**
 * Get or create a GraphIndex for a workspace
 */
export function getGraphIndex(workspacePath) {
  if (!instances.has(workspacePath)) {
    instances.set(workspacePath, new GraphIndex(workspacePath));
  }
  return instances.get(workspacePath);
}

export default { GraphIndex, getGraphIndex };
