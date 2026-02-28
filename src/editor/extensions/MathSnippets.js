/**
 * MathSnippets Extension (raw ProseMirror)
 *
 * Provides math snippet insertion with tab-stop placeholders.
 * Uses :shortcode: syntax (e.g., :mat2: for 2x2 matrix)
 *
 * Features:
 * - Tab-stop placeholders like VS Code snippets
 * - Tab/Shift+Tab to navigate between placeholders
 * - Escape to exit snippet mode
 * - Auto-wraps in $ for inline math
 *
 * Schema is defined in lokus-schema.js. This module provides:
 *   - Input rule for :shortcode: trigger
 *   - Placeholder decoration plugin
 *   - Keyboard shortcuts for placeholder navigation
 *   - insertMathSnippet command
 */

import { InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { TextSelection } from 'prosemirror-state'
import { mathSnippets } from '../lib/math-snippets-data'

export const MathSnippetsPluginKey = new PluginKey('mathSnippets')

// ---------------------------------------------------------------------------
// Snippet state -- stored in a plugin's state rather than TipTap storage
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} SnippetState
 * @property {boolean} active
 * @property {Array<{index: number, start: number, end: number, defaultText: string}>} placeholders
 * @property {number} currentIndex
 * @property {number} basePos
 */

/** @returns {SnippetState} */
function emptySnippetState() {
  return { active: false, placeholders: [], currentIndex: 0, basePos: 0 }
}

// ---------------------------------------------------------------------------
// Template parser
// ---------------------------------------------------------------------------

/**
 * Parse template string for placeholders.
 * Format: ${n:default} where n is the tab order.
 *
 * @param {string} template
 * @returns {{ text: string, placeholders: Array<{index: number, start: number, end: number, defaultText: string}> }}
 */
function parseTemplate(template) {
  const placeholders = []
  let result = ''
  const placeholderRegex = /\$\{(\d+)(?::([^}]*))?\}/g
  let match
  let lastEnd = 0

  while ((match = placeholderRegex.exec(template)) !== null) {
    result += template.substring(lastEnd, match.index)
    const index = parseInt(match[1], 10)
    const defaultText = match[2] || ''
    const start = result.length
    result += defaultText
    const end = result.length
    placeholders.push({ index, start, end, defaultText })
    lastEnd = match.index + match[0].length
  }

  result += template.substring(lastEnd)
  placeholders.sort((a, b) => a.index - b.index)
  return { text: result, placeholders }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

/**
 * Create decorations for placeholder regions.
 *
 * @param {Array} placeholders
 * @param {number} basePos
 * @param {number} activeIndex
 * @returns {Decoration[]}
 */
function createPlaceholderDecorations(placeholders, basePos, activeIndex) {
  const decorations = []
  placeholders.forEach((p, i) => {
    const from = basePos + p.start
    const to = basePos + p.end
    if (from >= to) return // skip empty placeholders
    const className =
      i === activeIndex
        ? 'math-snippet-placeholder math-snippet-placeholder-active'
        : 'math-snippet-placeholder'
    decorations.push(
      Decoration.inline(from, to, {
        class: className,
        'data-placeholder-index': String(i),
      })
    )
  })
  return decorations
}

// ---------------------------------------------------------------------------
// Meta key for snippet operations
// ---------------------------------------------------------------------------

const SNIPPET_META = 'mathSnippetAction'

/**
 * @typedef {'activate'|'next'|'prev'|'exit'|'update'} SnippetAction
 */

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Insert a math snippet by name.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {string} snippetName
 * @param {Object} [customSnippets={}]
 * @returns {boolean}
 */
export function insertMathSnippet(view, snippetName, customSnippets = {}) {
  const allSnippets = { ...mathSnippets, ...customSnippets }
  const snippet = allSnippets[snippetName]
  if (!snippet) return false

  const { state } = view
  let template = snippet.template
  const { text, placeholders } = parseTemplate(template)
  const pos = state.selection.from

  const tr = state.tr.insertText(text, pos, state.selection.to)

  if (placeholders.length > 0) {
    const firstP = placeholders[0]
    tr.setSelection(
      TextSelection.create(tr.doc, pos + firstP.start, pos + firstP.end)
    )
    tr.setMeta(SNIPPET_META, {
      action: 'activate',
      placeholders,
      basePos: pos,
      currentIndex: 0,
    })
  }

  view.dispatch(tr)
  return true
}

// ---------------------------------------------------------------------------
// Main plugin
// ---------------------------------------------------------------------------

/**
 * Create the MathSnippets ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @param {Object} [options]
 * @param {Object} [options.customSnippets={}]
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createMathSnippetsPlugins(schema, options = {}) {
  const { customSnippets = {} } = options

  // -- Stateful decoration plugin ------------------------------------------

  const decorationPlugin = new Plugin({
    key: MathSnippetsPluginKey,

    state: {
      init() {
        return {
          snippet: emptySnippetState(),
          decorations: DecorationSet.empty,
        }
      },

      apply(tr, pluginState, _oldState, newState) {
        let snippet = { ...pluginState.snippet }

        // Handle explicit snippet meta actions
        const meta = tr.getMeta(SNIPPET_META)
        if (meta) {
          switch (meta.action) {
            case 'activate':
              snippet = {
                active: true,
                placeholders: meta.placeholders,
                currentIndex: meta.currentIndex ?? 0,
                basePos: meta.basePos,
              }
              break

            case 'next': {
              if (!snippet.active) break
              const nextIndex = (snippet.currentIndex + 1) % snippet.placeholders.length
              if (nextIndex === 0 && snippet.currentIndex === snippet.placeholders.length - 1) {
                // Cycled through all -- exit
                snippet = emptySnippetState()
              } else {
                snippet = { ...snippet, currentIndex: nextIndex }
              }
              break
            }

            case 'prev': {
              if (!snippet.active) break
              const prevIndex =
                snippet.currentIndex === 0
                  ? snippet.placeholders.length - 1
                  : snippet.currentIndex - 1
              snippet = { ...snippet, currentIndex: prevIndex }
              break
            }

            case 'exit':
              snippet = emptySnippetState()
              break

            case 'update':
              if (meta.basePos !== undefined) snippet.basePos = meta.basePos
              break
          }
        }

        // Map basePos through document changes
        if (snippet.active && tr.docChanged && !meta) {
          snippet = { ...snippet, basePos: tr.mapping.map(snippet.basePos) }
        }

        // Check if cursor moved outside snippet area (auto-exit)
        if (snippet.active && snippet.placeholders.length > 0) {
          const { from, to } = newState.selection
          const firstP = snippet.placeholders[0]
          const lastP = snippet.placeholders[snippet.placeholders.length - 1]
          const snippetStart = snippet.basePos + firstP.start
          const snippetEnd = snippet.basePos + lastP.end
          const nearSnippet = from >= snippetStart - 5 && to <= snippetEnd + 5
          const inPlaceholder = snippet.placeholders.some(p => {
            const pFrom = snippet.basePos + p.start
            const pTo = snippet.basePos + p.end
            return from >= pFrom && to <= pTo
          })

          if (!nearSnippet && !inPlaceholder) {
            snippet = emptySnippetState()
          }
        }

        // Build decorations
        let decorations = DecorationSet.empty
        if (snippet.active && snippet.placeholders.length > 0) {
          try {
            const decs = createPlaceholderDecorations(
              snippet.placeholders,
              snippet.basePos,
              snippet.currentIndex
            )
            if (decs.length > 0) {
              decorations = DecorationSet.create(newState.doc, decs)
            }
          } catch {
            // If positions are out of range, exit snippet mode
            snippet = emptySnippetState()
          }
        }

        return { snippet, decorations }
      },
    },

    props: {
      decorations(state) {
        return this.getState(state).decorations
      },
    },
  })

  // -- Input rule ----------------------------------------------------------

  const snippetInputRule = new InputRule(
    /:([a-zA-Z][a-zA-Z0-9]*):$/,
    (state, match, start, end) => {
      const word = match[1]
      const allSnippets = { ...mathSnippets, ...customSnippets }
      const snippet = allSnippets[word]
      if (!snippet) return null // Let SymbolShortcuts handle it

      // Check if we're inside a math context
      let template = snippet.template
      const $pos = state.selection.$from
      let insideMath = false

      for (let d = $pos.depth; d >= 0; d--) {
        const node = $pos.node(d)
        if (node.type.name === 'inlineMath' || node.type.name === 'math') {
          insideMath = true
          break
        }
      }

      if (!insideMath) {
        const textBefore = $pos.parent.textBetween(0, $pos.parentOffset, null, '\ufffc')
        const dollarCount = (textBefore.match(/\$/g) || []).length
        if (dollarCount % 2 === 1) {
          insideMath = true
        }
      }

      // Strip outer $ delimiters if already inside math
      if (insideMath) {
        if (template.startsWith('$$')) {
          template = template.slice(2)
        } else if (template.startsWith('$')) {
          template = template.slice(1)
        }
        if (template.endsWith('$$')) {
          template = template.slice(0, -2)
        } else if (template.endsWith('$')) {
          template = template.slice(0, -1)
        }
      }

      const { text, placeholders } = parseTemplate(template)
      const insertPos = start

      // Delete trigger text and insert snippet text
      const tr = state.tr
        .delete(start, end)
        .insertText(text, insertPos)

      if (placeholders.length > 0) {
        // Select first placeholder
        const firstP = placeholders[0]
        tr.setSelection(
          TextSelection.create(tr.doc, insertPos + firstP.start, insertPos + firstP.end)
        )

        tr.setMeta(SNIPPET_META, {
          action: 'activate',
          placeholders,
          basePos: insertPos,
          currentIndex: 0,
        })
      }

      return tr
    }
  )

  // -- Keyboard shortcuts --------------------------------------------------

  const snippetKeymap = keymap({
    Tab: (state, dispatch, view) => {
      const pluginState = decorationPlugin.getState(state)
      if (!pluginState?.snippet?.active) return false

      const snippet = pluginState.snippet
      const nextIndex = (snippet.currentIndex + 1) % snippet.placeholders.length

      if (dispatch) {
        // If we cycled through all, exit
        if (nextIndex === 0 && snippet.currentIndex === snippet.placeholders.length - 1) {
          const lastP = snippet.placeholders[snippet.placeholders.length - 1]
          const endPos = snippet.basePos + lastP.end
          const tr = state.tr
            .setSelection(TextSelection.create(state.doc, endPos))
            .setMeta(SNIPPET_META, { action: 'exit' })
          dispatch(tr)
        } else {
          const placeholder = snippet.placeholders[nextIndex]
          const from = snippet.basePos + placeholder.start
          const to = snippet.basePos + placeholder.end
          const tr = state.tr
            .setSelection(TextSelection.create(state.doc, from, to))
            .setMeta(SNIPPET_META, { action: 'next' })
          dispatch(tr)
        }
      }
      return true
    },

    'Shift-Tab': (state, dispatch) => {
      const pluginState = decorationPlugin.getState(state)
      if (!pluginState?.snippet?.active) return false

      const snippet = pluginState.snippet
      const prevIndex =
        snippet.currentIndex === 0
          ? snippet.placeholders.length - 1
          : snippet.currentIndex - 1

      if (dispatch) {
        const placeholder = snippet.placeholders[prevIndex]
        const from = snippet.basePos + placeholder.start
        const to = snippet.basePos + placeholder.end
        const tr = state.tr
          .setSelection(TextSelection.create(state.doc, from, to))
          .setMeta(SNIPPET_META, { action: 'prev' })
        dispatch(tr)
      }
      return true
    },

    Escape: (state, dispatch) => {
      const pluginState = decorationPlugin.getState(state)
      if (!pluginState?.snippet?.active) return false

      if (dispatch) {
        dispatch(state.tr.setMeta(SNIPPET_META, { action: 'exit' }))
      }
      return true
    },
  })

  return [
    inputRules({ rules: [snippetInputRule] }),
    decorationPlugin,
    snippetKeymap,
  ]
}

// Export for use in other components
export { mathSnippets, parseTemplate }

export default createMathSnippetsPlugins
