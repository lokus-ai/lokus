/**
 * BlockId Extension for TipTap
 *
 * Implements Obsidian-style block IDs: text content ^blockid
 * Adds data-block-id attributes to parent blocks (paragraphs, lists, quotes, etc.)
 * Supports block references like [[file^blockid]]
 *
 * Strategy: Detect ^blockid pattern and set blockId attribute on parent node + style the marker
 */

import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export const BlockId = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock', 'table', 'tableRow'],
        attributes: {
          blockId: {
            default: null,
            parseHTML: element => element.getAttribute('data-block-id'),
            renderHTML: attributes => {
              if (!attributes.blockId) {
                return {}
              }
              return {
                'data-block-id': attributes.blockId,
              }
            },
          },
        },
      },
    ]
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockId'),

        // Use appendTransaction to modify node attributes without causing loops
        appendTransaction(transactions, oldState, newState) {
          const tr = newState.tr
          let modified = false

          // Check if any transaction changed the document
          const docChanged = transactions.some(transaction => transaction.docChanged)
          if (!docChanged) return null

          // Walk through document looking for ^blockid patterns
          newState.doc.descendants((node, pos) => {
            // Only process text-containing blocks that support blockId attribute
            if (!node.isBlock || !node.textContent) return
            if (!node.type.spec.attrs?.blockId) return

            // CRITICAL: Skip blocks that contain WikiLinks with block references
            // We don't want to interfere with [[File^blockid]] syntax
            let containsWikiLink = false
            node.descendants(child => {
              if (child.type.name === 'wikiLink' && child.attrs.target?.includes('^')) {
                containsWikiLink = true
                return false // Stop iteration
              }
            })
            if (containsWikiLink) return

            // Check if block ends with ^blockid pattern
            const text = node.textContent
            const match = /\s+\^([a-zA-Z0-9_-]+)\s*$/.exec(text)

            if (match) {
              const blockId = match[1]

              // Only update if blockId changed
              if (node.attrs.blockId !== blockId) {
                console.log('[BlockId] ✅ Setting blockId:', blockId, 'on', node.type.name)
                tr.setNodeMarkup(pos, null, { ...node.attrs, blockId })
                modified = true
              }
            } else if (node.attrs.blockId) {
              // Block ID pattern was removed, clear the attribute
              console.log('[BlockId] 🗑️ Clearing blockId from', node.type.name)
              tr.setNodeMarkup(pos, null, { ...node.attrs, blockId: null })
              modified = true
            }
          })

          return modified ? tr : null
        },

        // Add decorations for styling ^blockid text
        state: {
          init() {
            return DecorationSet.empty
          },

          apply(tr, set, oldState, newState) {
            if (!tr.docChanged) {
              return set.map(tr.mapping, tr.doc)
            }

            const decorations = []

            // Walk through document to add visual decorations
            newState.doc.descendants((node, pos) => {
              if (!node.isBlock || !node.textContent) return

              // Check if block ends with ^blockid pattern
              const text = node.textContent
              const match = /\s+\^([a-zA-Z0-9_-]+)\s*$/.exec(text)

              if (match) {
                // Add decoration to style the ^blockid text
                const matchPos = pos + 1 + text.length - match[0].length
                decorations.push(
                  Decoration.inline(matchPos, pos + 1 + text.length, {
                    class: 'block-id-marker',
                    style: 'opacity: 0.4; font-size: 0.85em; color: var(--text-muted);'
                  })
                )
              }
            })

            return DecorationSet.create(newState.doc, decorations)
          },
        },

        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

export default BlockId
