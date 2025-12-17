/**
 * WikiLinkEmbed Extension for TipTap
 *
 * Implements Obsidian-style block embeds: ![[File^blockid]]
 * Embeds the actual content of the block inline, not just a link.
 * Supports live updates when source changes.
 */

import { Node } from '@tiptap/core'
import { extractBlockContent } from '../../core/blocks/block-parser.js'

export const WikiLinkEmbed = Node.create({
  name: 'wikiLinkEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      id: { default: '' },
      filePath: { default: '' },
      blockId: { default: '' },
      content: { default: '' },
      fileName: { default: '' },
      loading: { default: false },
      error: { default: null }
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="wiki-embed"]' }]
  },

  renderHTML({ node }) {
    const { fileName, blockId, content, loading, error } = node.attrs

    if (error) {
      return [
        'div',
        {
          'data-type': 'wiki-embed',
          class: 'wiki-embed-block wiki-embed-error'
        },
        [
          'div',
          { class: 'wiki-embed-header' },
          `![[${fileName}^${blockId}]]`
        ],
        [
          'div',
          { class: 'wiki-embed-content wiki-embed-error-content' },
          `❌ ${error}`
        ]
      ]
    }

    if (loading) {
      return [
        'div',
        {
          'data-type': 'wiki-embed',
          class: 'wiki-embed-block wiki-embed-loading'
        },
        [
          'div',
          { class: 'wiki-embed-header' },
          `![[${fileName}^${blockId}]]`
        ],
        [
          'div',
          { class: 'wiki-embed-content' },
          'Loading...'
        ]
      ]
    }

    return [
      'div',
      {
        'data-type': 'wiki-embed',
        class: 'wiki-embed-block'
      },
      [
        'div',
        { class: 'wiki-embed-header' },
        [
          'span',
          { class: 'wiki-embed-icon' },
          '📄'
        ],
        [
          'span',
          { class: 'wiki-embed-title' },
          `${fileName} › ${blockId}`
        ]
      ],
      [
        'div',
        {
          class: 'wiki-embed-content',
          // Render HTML content if it's HTML, otherwise markdown
          ...(content.trim().startsWith('<') ? {} : { 'data-markdown': 'true' })
        },
        content || 'Empty block'
      ]
    ]
  },

  addCommands() {
    return {
      setWikiLinkEmbed: (fileName, blockId, filePath) => async ({ chain, editor }) => {
        const id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`)

        // Insert with loading state
        const insertSuccess = chain()
          .insertContent({
            type: this.name,
            attrs: {
              id,
              fileName,
              blockId,
              filePath,
              content: '',
              loading: true,
              error: null
            }
          })
          .run()

        if (!insertSuccess) return false

        // Fetch content asynchronously
        try {
          const content = await extractBlockContent(filePath, blockId)

          if (!content) {
            // Update with error
            editor.commands.command(({ tr, state }) => {
              let pos = -1
              state.doc.descendants((node, position) => {
                if (pos !== -1) return false
                if (node.type.name === this.name && node.attrs.id === id) {
                  pos = position
                  return false
                }
                return true
              })

              if (pos !== -1) {
                tr.setNodeMarkup(pos, undefined, {
                  ...state.doc.nodeAt(pos).attrs,
                  loading: false,
                  error: 'Block not found'
                })
                return true
              }
              return false
            })
            return false
          }

          // Update with actual content
          editor.commands.command(({ tr, state, dispatch }) => {
            let pos = -1
            state.doc.descendants((node, position) => {
              if (pos !== -1) return false
              if (node.type.name === this.name && node.attrs.id === id) {
                pos = position
                return false
              }
              return true
            })

            if (pos !== -1) {
              tr.setNodeMarkup(pos, undefined, {
                ...state.doc.nodeAt(pos).attrs,
                content,
                loading: false
              })
              if (dispatch) dispatch(tr)
              return true
            }
            return false
          })

          return true
        } catch (error) {

          // Update with error
          editor.commands.command(({ tr, state }) => {
            let pos = -1
            state.doc.descendants((node, position) => {
              if (pos !== -1) return false
              if (node.type.name === this.name && node.attrs.id === id) {
                pos = position
                return false
              }
              return true
            })

            if (pos !== -1) {
              tr.setNodeMarkup(pos, undefined, {
                ...state.doc.nodeAt(pos).attrs,
                loading: false,
                error: error.message || 'Failed to load block'
              })
              return true
            }
            return false
          })

          return false
        }
      }
    }
  }
})

export default WikiLinkEmbed
