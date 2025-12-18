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
 * Parse blocks from HTML content (used by Lokus editor)
 * @param {string} content - HTML file content
 * @param {string} filePath - Path to the file (for registration)
 * @returns {Array<object>} Array of parsed blocks
 */
function parseHTMLBlocks(content, filePath) {
  if (!content) return []

  const blocks = []
  let lineNumber = 1

  // Strategy 1: Extract ALL elements with data-block-id attributes
  const blockIdRegex = /<([a-z][a-z0-9]*)[^>]*data-block-id=["']([^"']+)["'][^>]*>(.*?)<\/\1>/gi
  let blockMatch

  while ((blockMatch = blockIdRegex.exec(content)) !== null) {
    const tagName = blockMatch[1]
    const blockId = blockMatch[2]
    let text = blockMatch[3]
      .replace(/<[^>]+>/g, '') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+\^[a-zA-Z0-9_-]+\s*$/, '') // Remove the ^blockid marker from display
      .trim()

    // Determine block type from HTML tag
    let type = 'paragraph'
    let level = null
    if (/^h[1-6]$/.test(tagName)) {
      type = 'heading'
      level = parseInt(tagName[1])
    } else if (tagName === 'blockquote') {
      type = 'quote'
    } else if (tagName === 'li') {
      type = 'list'
    } else if (tagName === 'pre' || tagName === 'code') {
      type = 'code'
    }

    const block = {
      blockId,
      id: blockId, // Alias for compatibility
      type,
      level,
      text: text.slice(0, 100), // Limit preview
      line: lineNumber++,
      position: blockMatch.index,
      auto: false // Explicitly set by user
    }

    blocks.push(block)
    blockIdManager.registerBlock(filePath, blockId, block)
  }

  // Strategy 2: Auto-generate IDs for headings without explicit data-block-id
  const headingRegex = /<h([1-6])(?![^>]*data-block-id)([^>]*)>(.*?)<\/h\1>/gi
  let match

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1])
    let text = match[3]
      .replace(/<[^>]+>/g, '') // Strip HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim()

    // Generate slug from heading text
    const blockId = generateSlug(text)

    const block = {
      blockId,
      id: blockId, // Alias for compatibility
      type: 'heading',
      level,
      text,
      line: lineNumber++,
      position: match.index,
      auto: true // Auto-generated
    }

    blocks.push(block)
    blockIdManager.registerBlock(filePath, blockId, block)
  }

  // Strategy 3: Virtual IDs for ALL paragraphs, lists, blockquotes (for search)
  // These are searchable but not explicitly in the file
  const allBlocksRegex = /<(p|li|blockquote)(?![^>]*data-block-id)([^>]*)>(.*?)<\/\1>/gi
  let blockMatch2

  while ((blockMatch2 = allBlocksRegex.exec(content)) !== null) {
    const tagName = blockMatch2[1]
    let text = blockMatch2[3]
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/\s+\^[a-zA-Z0-9_-]+\s*$/, '') // Remove any ^blockid marker
      .trim()

    // Skip empty blocks
    if (!text || text.length < 3) continue

    // Generate virtual ID from content hash
    const virtualId = generateContentHash(text)

    let type = 'paragraph'
    if (tagName === 'li') type = 'list'
    if (tagName === 'blockquote') type = 'quote'

    const block = {
      blockId: virtualId,
      id: virtualId,
      type,
      text: text.slice(0, 100),
      line: lineNumber++,
      position: blockMatch2.index,
      auto: true,
      virtual: true // Mark as virtual (searchable but not in file)
    }

    blocks.push(block)
    // Don't register virtual blocks in block manager (they're transient)
  }

  return blocks
}

/**
 * Parse blocks from markdown content
 * @param {string} content - Markdown file content
 * @param {string} filePath - Path to the file (for registration)
 * @returns {Array<object>} Array of parsed blocks
 */
export function parseBlocks(content, filePath) {
  if (!content) return []

  // Check if content is HTML (Lokus stores as HTML)
  if (content.trim().startsWith('<')) {
    return parseHTMLBlocks(content, filePath)
  }

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
 * Generate a content hash for virtual block IDs
 * @param {string} text - Block content
 * @returns {string} Hash-based ID (e.g., "v1a2b3c")
 */
function generateContentHash(text) {
  // Simple hash for virtual IDs
  let hash = 0
  const str = text.slice(0, 200) // Use first 200 chars for hash

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }

  return `v${Math.abs(hash).toString(36)}`
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
    return []
  }
}

/**
 * Extract block from HTML content
 * @param {string} html - HTML content
 * @param {string} blockId - Block identifier
 * @returns {string|null} Block HTML or null
 */
function extractBlockFromHTML(html, blockId) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    const element = doc.querySelector(`[data-block-id="${blockId}"]`)
    if (!element) return null

    // For tables, get the entire table if a row/cell has the ID
    if (element.closest('table')) {
      return element.closest('table').outerHTML
    }

    // For list items, include nested items
    if (element.tagName === 'LI') {
      const parent = element.closest('ul, ol')
      const startIndex = Array.from(parent.children).indexOf(element)

      // Collect this item and any nested lists
      let endIndex = startIndex + 1
      const nextSibling = parent.children[startIndex + 1]
      if (nextSibling && (nextSibling.tagName === 'UL' || nextSibling.tagName === 'OL')) {
        endIndex = startIndex + 2
      }

      const items = Array.from(parent.children).slice(startIndex, endIndex)
      return items.map(item => item.outerHTML).join('\n')
    }

    return element.outerHTML
  } catch (error) {
    return null
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

      // Check if HTML or markdown
      if (content.trim().startsWith('<')) {
        return extractBlockFromHTML(content, blockId)
      }

      const lines = content.split('\n')

      // Extract block content based on type
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
      }

      if (blockMeta.type === 'list') {
        // For list items, include the item and any nested items
        const startLine = blockMeta.line - 1
        let endLine = startLine + 1

        const indent = lines[startLine].match(/^\s*/)[0].length

        // Include all more-indented lines (nested items)
        for (let i = startLine + 1; i < lines.length; i++) {
          const lineIndent = lines[i].match(/^\s*/)[0].length
          if (lines[i].trim() === '') continue // Skip empty lines
          if (lineIndent <= indent && lines[i].trim() !== '') break
          endLine = i + 1
        }

        return lines.slice(startLine, endLine).join('\n')
      }

      if (blockMeta.type === 'code') {
        // For code blocks, include entire block
        const startLine = blockMeta.line - 1
        let endLine = startLine + 1

        // Find closing ```
        for (let i = startLine + 1; i < lines.length; i++) {
          if (lines[i].trim().startsWith('```')) {
            endLine = i + 1
            break
          }
        }

        return lines.slice(startLine, endLine).join('\n')
      }

      if (blockMeta.type === 'quote') {
        // For blockquotes, include all consecutive quote lines
        const startLine = blockMeta.line - 1
        let endLine = startLine + 1

        for (let i = startLine + 1; i < lines.length; i++) {
          if (!lines[i].trim().startsWith('>')) break
          endLine = i + 1
        }

        return lines.slice(startLine, endLine).join('\n')
      }

      // For other blocks (paragraph, etc), just return the line
      return lines[blockMeta.line - 1] || null
    }

    return null
  } catch (error) {
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
