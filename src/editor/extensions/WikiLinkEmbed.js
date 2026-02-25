/**
 * WikiLinkEmbed Extension (raw ProseMirror)
 *
 * Block atom node for Obsidian-style block embeds: ![[File^blockid]]
 * Embeds the actual content of the block inline, not just a link.
 * Supports live updates when source changes.
 *
 * Schema is defined in lokus-schema.js. This module provides:
 *   - setWikiLinkEmbed command
 *   - Async content resolution plugin
 */

import { Plugin, PluginKey } from 'prosemirror-state'
import { extractBlockContent } from '../../core/blocks/block-parser.js'

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

function genId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`
}

/**
 * Insert a wiki-link embed node at the current selection.
 * Resolves content asynchronously and updates the node.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} fileName
 * @param {string} blockId
 * @param {string} filePath
 * @returns {boolean}
 */
export function setWikiLinkEmbed(view, fileName, blockId, filePath) {
  const { state } = view
  const embedType = state.schema.nodes.wikiLinkEmbed
  if (!embedType) return false

  const id = genId()
  const node = embedType.create({
    id,
    fileName,
    blockId,
    filePath,
    content: '',
    loading: true,
    error: null,
  })

  const { from, to } = state.selection
  const tr = state.tr.replaceWith(from, to, node)
  view.dispatch(tr)

  // Fetch content asynchronously and update the node
  resolveEmbedContent(view, id, filePath, blockId)

  return true
}

/**
 * Resolve embed content asynchronously and update the node in the editor.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} id - The unique id of the embed node
 * @param {string} filePath
 * @param {string} blockId
 */
async function resolveEmbedContent(view, id, filePath, blockId) {
  try {
    const content = await extractBlockContent(filePath, blockId)

    if (!content) {
      updateEmbedNode(view, id, { loading: false, error: 'Block not found' })
      return
    }

    updateEmbedNode(view, id, { content, loading: false })
  } catch (error) {
    updateEmbedNode(view, id, {
      loading: false,
      error: error.message || 'Failed to load block',
    })
  }
}

/**
 * Find the embed node by id and update its attrs.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} id
 * @param {Object} attrUpdates
 */
function updateEmbedNode(view, id, attrUpdates) {
  const { state } = view
  let pos = -1
  state.doc.descendants((node, position) => {
    if (pos !== -1) return false
    if (node.type.name === 'wikiLinkEmbed' && node.attrs.id === id) {
      pos = position
      return false
    }
    return true
  })

  if (pos !== -1) {
    const existingNode = state.doc.nodeAt(pos)
    if (!existingNode) return
    const tr = state.tr.setNodeMarkup(pos, undefined, {
      ...existingNode.attrs,
      ...attrUpdates,
    })
    view.dispatch(tr)
  }
}

// ---------------------------------------------------------------------------
// Plugin: watches for transactions that insert embed nodes in loading state
// and triggers async resolution.
//
// This handles the case where an embed is inserted via an input rule
// (from WikiLink.js blockEmbedInputRule) rather than through the command.
// ---------------------------------------------------------------------------

const wikiLinkEmbedKey = new PluginKey('wikilink-embed-resolver')

function embedResolverPlugin() {
  return new Plugin({
    key: wikiLinkEmbedKey,
    view() {
      return {
        update(view, prevState) {
          // Check for newly inserted embed nodes in loading state
          const { state } = view
          if (state.doc === prevState.doc) return

          state.doc.descendants((node, pos) => {
            if (
              node.type.name === 'wikiLinkEmbed' &&
              node.attrs.loading === true &&
              node.attrs.content === ''
            ) {
              // Check if this node existed in the previous state at the same position
              // and was also loading. If so, skip to avoid duplicate resolution.
              let wasAlreadyLoading = false
              try {
                const prevNode = prevState.doc.nodeAt(pos)
                if (
                  prevNode &&
                  prevNode.type.name === 'wikiLinkEmbed' &&
                  prevNode.attrs.id === node.attrs.id &&
                  prevNode.attrs.loading === true
                ) {
                  wasAlreadyLoading = true
                }
              } catch {
                // Position out of range in prev doc
              }

              if (!wasAlreadyLoading) {
                resolveEmbedContent(
                  view,
                  node.attrs.id,
                  node.attrs.filePath,
                  node.attrs.blockId
                )
              }
            }
          })
        },
      }
    },
  })
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all WikiLinkEmbed-related ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createWikiLinkEmbedPlugins(schema) {
  return [embedResolverPlugin()]
}

export default createWikiLinkEmbedPlugins
