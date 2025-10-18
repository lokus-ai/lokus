/**
 * MentionDetector - Find unlinked mentions of note titles in content
 */

export class MentionDetector {
  constructor(graphData) {
    this.graphData = graphData;
    this.mentionCache = new Map();
  }

  /**
   * Find all unlinked mentions of a target node in other nodes
   */
  findUnlinkedMentions(targetNodeId) {
    const targetNode = this.graphData.nodes.get(targetNodeId);

    if (!targetNode || !targetNode.title) {
      return [];
    }

    const mentions = [];
    const targetTitle = targetNode.title;

    // Search through all document nodes
    for (const sourceNode of this.graphData.nodes.values()) {
      if (sourceNode.id === targetNodeId) {
        continue;
      }

      const content = sourceNode.metadata?.content || '';
      if (!content) {
        continue;
      }

      const nodeMentions = this.findMentionsInContent(
        content,
        targetTitle,
        sourceNode,
        targetNode
      );

      mentions.push(...nodeMentions);
    }

    return mentions;
  }

  /**
   * Find mentions of target title in content
   */
  findMentionsInContent(content, targetTitle, sourceNode, targetNode) {
    const mentions = [];
    const escapedTitle = this.escapeRegex(targetTitle);
    const pattern = new RegExp(`\\b${escapedTitle}\\b`, 'gi');

    const linkedPositions = this.getLinkedPositions(content, targetTitle);

    let match;
    while ((match = pattern.exec(content)) !== null) {
      const position = match.index;
      const matchedText = match[0];

      // Skip if this position is already linked
      if (linkedPositions.has(position)) {
        continue;
      }

      const context = this.extractContextAt(content, position, matchedText.length);

      mentions.push({
        sourceNodeId: sourceNode.id,
        sourceTitle: sourceNode.title,
        targetNodeId: targetNode.id,
        targetTitle: targetNode.title,
        position,
        matchedText,
        context
      });
    }

    return mentions;
  }

  /**
   * Get positions of already-linked mentions in content
   */
  getLinkedPositions(content, targetTitle) {
    const positions = new Set();

    const wikiLinkPatterns = [
      new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\]\\]`, 'gi'),
      new RegExp(`\\[\\[${this.escapeRegex(targetTitle)}\\|[^\\]]+\\]\\]`, 'gi')
    ];

    for (const pattern of wikiLinkPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const titleStart = match.index + 2;
        positions.add(titleStart);
      }
    }

    return positions;
  }

  /**
   * Extract context snippet around a position
   */
  extractContextAt(content, position, matchLength) {
    const beforeStart = Math.max(0, position - 50);
    const afterEnd = Math.min(content.length, position + matchLength + 50);

    let before = content.substring(beforeStart, position);
    let after = content.substring(position + matchLength, afterEnd);

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
   * Escape special regex characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get all unlinked mentions with caching
   */
  getUnlinkedMentions(targetNodeId, forceRefresh = false) {
    if (!forceRefresh && this.mentionCache.has(targetNodeId)) {
      return this.mentionCache.get(targetNodeId);
    }

    const mentions = this.findUnlinkedMentions(targetNodeId);
    this.mentionCache.set(targetNodeId, mentions);

    return mentions;
  }

  /**
   * Clear cache
   */
  clearCache(nodeId) {
    this.mentionCache.delete(nodeId);
  }

  clearAllCaches() {
    this.mentionCache.clear();
  }

  destroy() {
    this.mentionCache.clear();
  }
}

export default MentionDetector;
