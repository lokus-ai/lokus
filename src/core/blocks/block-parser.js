/**
 * Block Parser
 *
 * Parses markdown files to extract block references.
 * Supports two syntaxes:
 * 1. Heading IDs: ## Heading {#custom-id}
 * 2. Block IDs: Text content ^blockid
 *
 * Compatible with Obsidian block reference syntax.
 */

import blockIdManager from './block-id-manager.js'

/**
 * Parse blocks from markdown content
 * @param {string} content - Markdown file content
 * @param {string} filePath - Path to the file (for registration)
 * @returns {Array<object>} Array of parsed blocks
 */
export function parseBlocks(content, filePath) {
  if (!content) return []

  const lines = content.split('\n')
  const blocks = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNumber = i + 1

    // Parse heading with custom ID: ## Heading {#custom-id}
    const headingMatch = /^(#{1,6})\s+(.+?)\s*\{#([a-zA-Z0-9_-]+)\}\s*$/.exec(line)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2].trim()
      const blockId = headingMatch[3]

      const block = {
        blockId,
        type: 'heading',
        level,
        text,
        line: lineNumber,
        position: i
      }

      blocks.push(block)
      blockIdManager.registerBlock(filePath, blockId, block)
      continue
    }

    // Parse block ID at end of line: Text content ^blockid
    const blockIdMatch = /^(.+?)\s+\^([a-zA-Z0-9_-]+)\s*$/.exec(line)
    if (blockIdMatch) {
      const text = blockIdMatch[1].trim()
      const blockId = blockIdMatch[2]

      // Determine block type based on line format
      let type = 'paragraph'
      if (/^>\s/.test(text)) {
        type = 'quote'
      } else if (/^[-*+]\s/.test(text)) {
        type = 'list'
      } else if (/^```/.test(text)) {
        type = 'code'
      }

      const block = {
        blockId,
        type,
        text: text.slice(0, 100), // Limit preview to 100 chars
        line: lineNumber,
        position: i
      }

      blocks.push(block)
      blockIdManager.registerBlock(filePath, blockId, block)
      continue
    }

    // Auto-generate IDs for headings without explicit IDs
    const autoHeadingMatch = /^(#{1,6})\s+(.+)$/.exec(line)
    if (autoHeadingMatch) {
      const level = autoHeadingMatch[1].length
      const text = autoHeadingMatch[2].trim()

      // Generate slug from heading text
      const blockId = generateSlug(text)

      const block = {
        blockId,
        type: 'heading',
        level,
        text,
        line: lineNumber,
        position: i,
        auto: true // Mark as auto-generated
      }

      blocks.push(block)
      blockIdManager.registerBlock(filePath, blockId, block)
    }
  }

  return blocks
}

/**
 * Generate a slug from text
 * @param {string} text - Text to slugify
 * @returns {string} URL-friendly slug
 */
function generateSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .slice(0, 50) // Limit length
}

/**
 * Parse blocks from file (async version)
 * Reads file and parses blocks
 * @param {string} filePath - Path to markdown file
 * @returns {Promise<Array<object>>} Array of blocks
 */
export async function parseBlocksFromFile(filePath) {
  try {
    // Check if in Tauri environment
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const content = await readTextFile(filePath)
      return parseBlocks(content, filePath)
    }

    // Fallback for non-Tauri environments (testing, etc.)
    return []
  } catch (error) {
    console.error('[BlockParser] Error reading file:', filePath, error)
    return []
  }
}

/**
 * Extract block content from file
 * Gets the actual content of a specific block
 * @param {string} filePath - Path to file
 * @param {string} blockId - Block identifier
 * @returns {Promise<string|null>} Block content or null
 */
export async function extractBlockContent(filePath, blockId) {
  try {
    // Get block metadata
    const blockMeta = blockIdManager.resolveBlockRef(blockId)
    if (!blockMeta || blockMeta.filePath !== filePath) {
      return null
    }

    // Read file content
    if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
      const { readTextFile } = await import('@tauri-apps/plugin-fs')
      const content = await readTextFile(filePath)
      const lines = content.split('\n')

      // Extract block content
      if (blockMeta.type === 'heading') {
        // For headings, include the heading and content until next heading of same or higher level
        const startLine = blockMeta.line - 1
        const headingLevel = blockMeta.level
        let endLine = lines.length

        for (let i = startLine + 1; i < lines.length; i++) {
          const match = /^(#{1,6})\s/.exec(lines[i])
          if (match && match[1].length <= headingLevel) {
            endLine = i
            break
          }
        }

        return lines.slice(startLine, endLine).join('\n')
      } else {
        // For other blocks, just return the line
        return lines[blockMeta.line - 1] || null
      }
    }

    return null
  } catch (error) {
    console.error('[BlockParser] Error extracting block content:', error)
    return null
  }
}

/**
 * Update blocks for a file (re-parse)
 * Useful when file is modified
 * @param {string} filePath - Path to file
 * @returns {Promise<Array<object>>} Updated blocks
 */
export async function updateFileBlocks(filePath) {
  // Invalidate old blocks
  blockIdManager.invalidateFile(filePath)

  // Re-parse
  return await parseBlocksFromFile(filePath)
}

export default {
  parseBlocks,
  parseBlocksFromFile,
  extractBlockContent,
  updateFileBlocks
}
