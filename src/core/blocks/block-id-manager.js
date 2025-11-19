/**
 * Block ID Manager
 *
 * Manages block IDs for granular linking within notes.
 * Supports Obsidian-compatible syntax: [[Note^blockid]]
 *
 * Features:
 * - Generate short, readable block IDs (8 chars)
 * - LRU cache for block metadata (100 files max)
 * - Register and resolve block references
 * - Lazy loading for performance
 */

class BlockIdManager {
  constructor() {
    // Map of blockId -> { filePath, type, text, line, position }
    this.blockIndex = new Map()

    // Map of filePath -> Set<blockId>
    this.fileBlocks = new Map()

    // LRU cache management
    this.cacheOrder = [] // Array of filePaths in access order
    this.maxCacheSize = 100

    // Track last modification times to invalidate cache
    this.fileMtimes = new Map()
  }

  /**
   * Generate a short, readable block ID
   * Format: 8 alphanumeric characters (e.g., "a3x9k2m4")
   * @returns {string} Block ID
   */
  generateId() {
    return Math.random().toString(36).substring(2, 10)
  }

  /**
   * Register a block in the index
   * @param {string} filePath - Absolute path to the file
   * @param {string} blockId - Unique block identifier
   * @param {object} metadata - Block metadata
   * @param {string} metadata.type - Block type (heading, paragraph, list, etc.)
   * @param {string} metadata.text - Block content preview
   * @param {number} metadata.line - Line number in file
   * @param {number} metadata.position - Character position in file
   */
  registerBlock(filePath, blockId, metadata) {
    // Store block metadata
    this.blockIndex.set(blockId, {
      filePath,
      ...metadata
    })

    // Track blocks per file
    if (!this.fileBlocks.has(filePath)) {
      this.fileBlocks.set(filePath, new Set())
    }
    this.fileBlocks.get(filePath).add(blockId)

    // Update LRU cache
    this._updateCache(filePath)
  }

  /**
   * Resolve a block reference to its metadata
   * @param {string} blockId - Block identifier
   * @returns {object|null} Block metadata or null if not found
   */
  resolveBlockRef(blockId) {
    return this.blockIndex.get(blockId) || null
  }

  /**
   * Get all blocks for a specific file
   * @param {string} filePath - Absolute path to the file
   * @returns {Array<object>} Array of block metadata objects
   */
  getFileBlocks(filePath) {
    const blockIds = this.fileBlocks.get(filePath)
    if (!blockIds) return []

    return Array.from(blockIds).map(blockId => ({
      blockId,
      ...this.blockIndex.get(blockId)
    })).filter(block => block.filePath) // Filter out any undefined blocks
  }

  /**
   * Search for blocks by text content
   * @param {string} query - Search query
   * @param {object} options - Search options
   * @param {string} options.filePath - Optional: limit search to specific file
   * @param {number} options.limit - Maximum results (default: 30)
   * @returns {Array<object>} Array of matching blocks
   */
  searchBlocks(query, options = {}) {
    const { filePath, limit = 30 } = options
    const lowerQuery = query.toLowerCase()
    const results = []

    for (const [blockId, metadata] of this.blockIndex) {
      // Filter by file if specified
      if (filePath && metadata.filePath !== filePath) continue

      // Search in block text
      if (metadata.text && metadata.text.toLowerCase().includes(lowerQuery)) {
        results.push({
          blockId,
          ...metadata,
          score: this._scoreBlock(metadata.text, lowerQuery)
        })
      }

      // Stop if limit reached
      if (results.length >= limit * 2) break // Get more for sorting
    }

    // Sort by relevance and limit
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
  }

  /**
   * Score a block for search relevance
   * @private
   */
  _scoreBlock(text, query) {
    const lowerText = text.toLowerCase()
    let score = 0

    // Exact match
    if (lowerText === query) score += 100

    // Starts with query
    if (lowerText.startsWith(query)) score += 50

    // Word boundary match
    if (new RegExp(`\\b${query}`, 'i').test(text)) score += 25

    // Contains query
    if (lowerText.includes(query)) score += 10

    // Prefer shorter text (more specific)
    score -= Math.min(text.length, 100) * 0.1

    return score
  }

  /**
   * Invalidate cache for a specific file
   * Useful when file is modified
   * @param {string} filePath - Path to invalidate
   */
  invalidateFile(filePath) {
    // Remove all blocks for this file
    const blockIds = this.fileBlocks.get(filePath)
    if (blockIds) {
      for (const blockId of blockIds) {
        this.blockIndex.delete(blockId)
      }
      this.fileBlocks.delete(filePath)
    }

    // Remove from cache order
    const index = this.cacheOrder.indexOf(filePath)
    if (index !== -1) {
      this.cacheOrder.splice(index, 1)
    }

    // Remove mtime
    this.fileMtimes.delete(filePath)
  }

  /**
   * Update LRU cache
   * @private
   */
  _updateCache(filePath) {
    // Move to end of cache order (most recently used)
    const index = this.cacheOrder.indexOf(filePath)
    if (index !== -1) {
      this.cacheOrder.splice(index, 1)
    }
    this.cacheOrder.push(filePath)

    // Evict oldest if over limit
    if (this.cacheOrder.length > this.maxCacheSize) {
      const oldest = this.cacheOrder.shift()
      this.invalidateFile(oldest)
    }
  }

  /**
   * Clear all cached blocks
   */
  clear() {
    this.blockIndex.clear()
    this.fileBlocks.clear()
    this.cacheOrder = []
    this.fileMtimes.clear()
  }

  /**
   * Get cache statistics
   * @returns {object} Cache stats
   */
  getStats() {
    return {
      totalBlocks: this.blockIndex.size,
      totalFiles: this.fileBlocks.size,
      cacheSize: this.cacheOrder.length,
      maxCacheSize: this.maxCacheSize
    }
  }
}

// Export singleton instance
export const blockIdManager = new BlockIdManager()
export default blockIdManager
