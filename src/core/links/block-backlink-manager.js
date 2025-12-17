/**
 * Block Backlink Manager
 *
 * Tracks block-level references across files.
 * Indexes [[File^blockid]] patterns and provides backlink lookup.
 */

import { readTextFile } from '@tauri-apps/plugin-fs'

export class BlockBacklinkManager {
  constructor() {
    this.blockLinks = new Map() // blockId -> [{ sourceFile, sourceLine, context }]
    this.indexed = false
  }

  /**
   * Parse all files for block references
   * @param {Array} fileIndex - Array of file objects with path property
   */
  async indexBlockLinks(fileIndex) {

    this.blockLinks.clear()

    for (const file of fileIndex) {
      // Skip files with invalid paths or non-markdown files
      if (!file.path || typeof file.path !== 'string' || !file.path.endsWith('.md')) {
        continue
      }

      try {
        await this.parseFileForBlockLinks(file.path)
      } catch { }
    }

    this.indexed = true
  }

  /**
   * Parse a single file for block references
   * @param {string} filePath - Path to file
   */
  async parseFileForBlockLinks(filePath) {
    try {
      const content = await readTextFile(filePath)

      // Find all [[File^blockid]] patterns (both regular links and embeds)
      const blockRefPattern = /!?\[\[([^\]^#]+)\^([^\]]+)\]\]/g
      let match

      while ((match = blockRefPattern.exec(content)) !== null) {
        const isEmbed = match[0].startsWith('!')
        const fileName = match[1].trim()
        const blockId = match[2].trim()
        const position = match.index

        // Extract context (50 chars before and after)
        const context = this.extractContext(content, position, 50)

        // Calculate line number
        const lineNumber = content.substring(0, position).split('\n').length

        // Store link
        const key = `${fileName}^${blockId}`
        if (!this.blockLinks.has(key)) {
          this.blockLinks.set(key, [])
        }

        this.blockLinks.get(key).push({
          sourceFile: filePath,
          targetFile: fileName,
          blockId,
          isEmbed,
          lineNumber,
          position,
          context
        })
      }
    } catch (error) {
      // File might not exist or be readable, skip silently
      if (error.message?.includes('No such file')) return
      throw error
    }
  }

  /**
   * Extract context around a position
   * @param {string} content - File content
   * @param {number} position - Character position
   * @param {number} contextLength - Characters before/after
   * @returns {Object} Context object
   */
  extractContext(content, position, contextLength = 50) {
    const before = content.slice(Math.max(0, position - contextLength), position)
    const linkLength = content.slice(position).indexOf(']]') + 2
    const after = content.slice(position + linkLength, position + linkLength + contextLength)

    return { before, after }
  }

  /**
   * Get all backlinks for a specific block
   * @param {string} fileName - File name
   * @param {string} blockId - Block identifier
   * @returns {Array} Array of backlink objects
   */
  getBlockBacklinks(fileName, blockId) {
    const key = `${fileName}^${blockId}`
    return this.blockLinks.get(key) || []
  }

  /**
   * Get all backlinks for a file (all blocks in that file)
   * @param {string} fileName - File name
   * @returns {Array} Array of backlink objects
   */
  getFileBlockBacklinks(fileName) {
    const backlinks = []

    for (const [key, links] of this.blockLinks.entries()) {
      if (key.startsWith(`${fileName}^`)) {
        backlinks.push(...links)
      }
    }

    return backlinks
  }

  /**
   * Invalidate cache for a specific file
   * Call this when a file changes
   * @param {string} filePath - Path to file
   */
  invalidateFile(filePath) {
    // Remove all entries with this sourceFile
    for (const [key, links] of this.blockLinks.entries()) {
      const filtered = links.filter(link => link.sourceFile !== filePath)
      if (filtered.length === 0) {
        this.blockLinks.delete(key)
      } else if (filtered.length !== links.length) {
        this.blockLinks.set(key, filtered)
      }
    }
  }

  /**
   * Re-index a specific file
   * @param {string} filePath - Path to file
   */
  async reindexFile(filePath) {
    this.invalidateFile(filePath)
    await this.parseFileForBlockLinks(filePath)
  }

  /**
   * Clear all cached data
   */
  clear() {
    this.blockLinks.clear()
    this.indexed = false
  }

  /**
   * Get statistics
   * @returns {Object} Stats object
   */
  getStats() {
    const totalLinks = Array.from(this.blockLinks.values()).reduce((sum, links) => sum + links.length, 0)
    return {
      uniqueBlocks: this.blockLinks.size,
      totalLinks,
      indexed: this.indexed
    }
  }
}

// Singleton instance
const blockBacklinkManager = new BlockBacklinkManager()

export default blockBacklinkManager
