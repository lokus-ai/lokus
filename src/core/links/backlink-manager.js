/**
 * BacklinkManager - Index and track backlinks between notes
 */

export class BacklinkManager {
  constructor(graphData) {
    if (!graphData) {
      throw new Error('BacklinkManager requires a GraphData instance');
    }

    this.graphData = graphData;
    this.backlinkCache = new Map();
    this.listeners = new Map();
  }

  /**
   * Get all backlinks for a specific node
   */
  getBacklinks(nodeId) {
    if (!this.graphData || !this.graphData.nodes) {
      return [];
    }

    // Check cache first
    if (this.backlinkCache.has(nodeId)) {
      return this.backlinkCache.get(nodeId);
    }

    const backlinks = [];

    // Get target node info
    const targetNode = this.graphData.nodes.get(nodeId);
    const targetTitleRaw = targetNode?.title || targetNode?.label || '';
    // Strip .md extension for matching (wiki links don't include extensions)
    const targetTitle = targetTitleRaw.replace(/\.md$/i, '');

    if (!targetNode || !targetTitle) {
      return [];
    }

    // Find all nodes that link to this node
    for (const [sourceId, sourceNode] of this.graphData.nodes.entries()) {
      if (sourceId === nodeId) continue;

      // Get content from node metadata
      const metadata = this.graphData.getNodeMetadata(sourceId);
      const content = metadata?.content || '';
      if (!content) continue;

      // Simple check for wiki link patterns
      const patterns = [
        new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\]\\]`, 'gi'),
        new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\|[^\\]]+\\]\\]`, 'gi')
      ];

      for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          const position = match.index;
          const context = this.extractContext(content, position, match[0].length);

          backlinks.push({
            sourceNodeId: sourceId,
            sourceTitle: sourceNode.title || sourceNode.label,
            targetNodeId: nodeId,
            context: context,
            position: position,
            linkText: match[0],
            created: Date.now()
          });
        }
      }
    }

    const sortedBacklinks = backlinks.sort((a, b) => b.created - a.created);

    // Cache the results
    this.backlinkCache.set(nodeId, sortedBacklinks);

    return sortedBacklinks;
  }

  /**
   * Extract context snippet around a position
   */
  extractContext(content, position, matchLength) {
    const beforeStart = Math.max(0, position - 50);
    const afterEnd = Math.min(content.length, position + matchLength + 50);

    let before = content.substring(beforeStart, position);
    let after = content.substring(position + matchLength, afterEnd);

    // Trim to word boundaries
    if (beforeStart > 0) {
      const firstSpace = before.indexOf(' ');
      if (firstSpace !== -1) {
        before = '...' + before.substring(firstSpace + 1);
      }
    }

    if (afterEnd < content.length) {
      const lastSpace = after.lastIndexOf(' ');
      if (lastSpace !== -1) {
        after = after.substring(0, lastSpace) + '...';
      }
    }

    before = before.replace(/\s+/g, ' ').trim();
    after = after.replace(/\s+/g, ' ').trim();
    const match = content.substring(position, position + matchLength);

    return {
      before,
      match,
      after,
      full: `${before}${match}${after}`
    };
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Filter backlinks by search query
   */
  filterBacklinks(nodeId, query) {
    const backlinks = this.getBacklinks(nodeId);

    if (!query || query.trim() === '') {
      return backlinks;
    }

    const lowerQuery = query.toLowerCase();

    return backlinks.filter(backlink => {
      return (
        backlink.sourceTitle.toLowerCase().includes(lowerQuery) ||
        backlink.context?.full?.toLowerCase().includes(lowerQuery) ||
        backlink.linkText?.toLowerCase().includes(lowerQuery)
      );
    });
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
        } catch { }
      });
    }
  }

  destroy() {
    this.backlinkCache.clear();
    this.listeners.clear();
  }
}

export default BacklinkManager;
