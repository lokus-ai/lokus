/**
 * Block Writer
 *
 * Handles writing block IDs back to source files.
 * Supports both HTML and Markdown formats.
 * Used for auto-generating block IDs when referencing blocks without explicit IDs.
 */

import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { noteMutationClient } from '../notes/NoteMutationClient.js'

/**
 * Insert block ID into file
 * @param {string} filePath - Path to file
 * @param {number} lineNumber - Line number (1-indexed)
 * @param {string} blockId - Block identifier to insert
 * @returns {Promise<boolean>} Success status
 */
export async function insertBlockIdIntoFile(filePath, lineNumber, blockId) {
  try {
    // Read file
    const content = await readTextFile(filePath)

    // Check if HTML or markdown
    if (content.trim().startsWith('<')) {
      return await insertBlockIdIntoHTML(content, filePath, lineNumber, blockId)
    } else {
      return await insertBlockIdIntoMarkdown(content, filePath, lineNumber, blockId)
    }
  } catch (error) {
    return false
  }
}

/**
 * Insert block ID into HTML file
 * Adds data-block-id attribute to the element
 * @param {string} html - HTML content
 * @param {string} filePath - Path to file
 * @param {number} lineNumber - Line number (1-indexed)
 * @param {string} blockId - Block identifier
 * @returns {Promise<boolean>} Success status
 */
async function insertBlockIdIntoHTML(html, filePath, lineNumber, blockId) {
  try {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    // Find the block element (counting visible blocks)
    let currentLine = 0
    let targetElement = null

    const walker = doc.createTreeWalker(
      doc.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          // Only count block-level elements
          if (['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'PRE', 'TABLE'].includes(node.tagName)) {
            return NodeFilter.FILTER_ACCEPT
          }
          return NodeFilter.FILTER_SKIP
        }
      }
    )

    while (walker.nextNode()) {
      currentLine++
      if (currentLine === lineNumber) {
        targetElement = walker.currentNode
        break
      }
    }

    if (targetElement) {
      // Check if it already has a block ID
      if (targetElement.getAttribute('data-block-id')) {
        return false
      }

      targetElement.setAttribute('data-block-id', blockId)

      // Write back to file
      if (
        globalThis.__LOKUS_FEATURE_FLAGS__?.enable_note_engine_foundation
        && /\.(md|markdown|txt)$/i.test(filePath)
      ) {
        await noteMutationClient.writeNote({
          workspacePath: globalThis.__WORKSPACE_PATH__,
          path: filePath,
          content: doc.body.innerHTML,
          baseContent: html,
          source: 'block-id',
        })
      } else {
        await writeTextFile(filePath, doc.body.innerHTML)
      }
      return true
    }

    return false
  } catch (error) {
    return false
  }
}

/**
 * Insert block ID into Markdown file
 * Appends ^blockid at end of line
 * @param {string} markdown - Markdown content
 * @param {string} filePath - Path to file
 * @param {number} lineNumber - Line number (1-indexed)
 * @param {string} blockId - Block identifier
 * @returns {Promise<boolean>} Success status
 */
async function insertBlockIdIntoMarkdown(markdown, filePath, lineNumber, blockId) {
  try {
    const lines = markdown.split('\n')

    if (lineNumber < 1 || lineNumber > lines.length) {
      return false
    }

    const lineIndex = lineNumber - 1
    const line = lines[lineIndex]

    // Check if line already has a block ID
    if (/\s+\^[a-zA-Z0-9_-]+\s*$/.test(line)) {
      return false
    }

    // Insert ^blockid at end of line
    lines[lineIndex] = `${line.trimEnd()} ^${blockId}`

    // Write back to file
    if (globalThis.__LOKUS_FEATURE_FLAGS__?.enable_note_engine_foundation) {
      await noteMutationClient.writeNote({
        workspacePath: globalThis.__WORKSPACE_PATH__,
        path: filePath,
        content: lines.join('\n'),
        baseContent: markdown,
        source: 'block-id',
      })
    } else {
      await writeTextFile(filePath, lines.join('\n'))
    }
    return true
  } catch (error) {
    return false
  }
}

/**
 * Check if a file is currently being modified
 * Used to prevent concurrent write conflicts
 */
const writeQueue = new Map()

/**
 * Queue a block ID write operation
 * Prevents concurrent writes to the same file
 * @param {string} filePath - Path to file
 * @param {number} lineNumber - Line number
 * @param {string} blockId - Block identifier
 * @returns {Promise<boolean>} Success status
 */
export async function queueBlockIdWrite(filePath, lineNumber, blockId) {
  // Check if write is already queued for this file
  if (writeQueue.has(filePath)) {
    return false
  }

  // Mark as queued
  writeQueue.set(filePath, true)

  try {
    const success = await insertBlockIdIntoFile(filePath, lineNumber, blockId)
    return success
  } finally {
    // Remove from queue
    writeQueue.delete(filePath)
  }
}

export default {
  insertBlockIdIntoFile,
  queueBlockIdWrite
}
