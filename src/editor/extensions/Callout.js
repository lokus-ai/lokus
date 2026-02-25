/**
 * Callout Extension (raw ProseMirror)
 *
 * Supports syntax: >[!type] Optional Title
 *
 * Callout types: note, tip, warning, danger, info, success, question, example
 *
 * Features:
 * - Collapsible callouts with >[!type]- syntax
 * - Nested content support
 * - Dark mode compatible
 *
 * Schema is defined in lokus-schema.js. This module only provides:
 *   - Input rules
 *   - Keyboard shortcuts
 *   - Click-handler plugin (toggle collapsed)
 *   - Command functions
 */

import { InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Selection } from 'prosemirror-state'
import { wrapIn, lift } from 'prosemirror-commands'

const CALLOUT_TYPES = {
  note: { icon: '\u2139\uFE0F', color: 'blue', label: 'Note' },
  tip: { icon: '\uD83D\uDCA1', color: 'green', label: 'Tip' },
  warning: { icon: '\u26A0\uFE0F', color: 'orange', label: 'Warning' },
  danger: { icon: '\uD83D\uDEA8', color: 'red', label: 'Danger' },
  info: { icon: '\u2139\uFE0F', color: 'cyan', label: 'Info' },
  success: { icon: '\u2705', color: 'green', label: 'Success' },
  question: { icon: '\u2753', color: 'purple', label: 'Question' },
  example: { icon: '\uD83D\uDCDD', color: 'gray', label: 'Example' },
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * Wrap the current selection in a callout node.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {Object} [attrs]
 * @param {string} [attrs.type='note']
 * @param {string|null} [attrs.title=null]
 * @param {boolean} [attrs.collapsed=false]
 * @returns {boolean}
 */
export function setCallout(view, attrs = {}) {
  const calloutType = view.state.schema.nodes.callout
  if (!calloutType) return false
  const { type = 'note', title = null, collapsed = false } = attrs
  return wrapIn(calloutType, { type, title, collapsed })(view.state, view.dispatch)
}

/**
 * Toggle wrapping the current selection in a callout.
 * If already inside a callout, lift out; otherwise wrap in.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @param {Object} [attrs]
 * @returns {boolean}
 */
export function toggleCallout(view, attrs = {}) {
  const { state } = view
  const calloutType = state.schema.nodes.callout
  if (!calloutType) return false

  // Check if cursor is already inside a callout
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === calloutType) {
      return lift(state, view.dispatch)
    }
  }
  const { type = 'note', title = null, collapsed = false } = attrs
  return wrapIn(calloutType, { type, title, collapsed })(state, view.dispatch)
}

/**
 * Lift the current selection out of a callout.
 *
 * @param {import('prosemirror-view').EditorView} view
 * @returns {boolean}
 */
export function unsetCallout(view) {
  return lift(view.state, view.dispatch)
}

// ---------------------------------------------------------------------------
// Input rule: >[!type](-?) Optional Title
// ---------------------------------------------------------------------------

function calloutInputRule(schema) {
  return new InputRule(
    /^>\[!(\w+)\](-?)\s*(.*)$/,
    (state, match, start, end) => {
      const [, rawType, collapsedFlag, title] = match
      const calloutType = CALLOUT_TYPES[rawType.toLowerCase()] ? rawType.toLowerCase() : 'note'
      const collapsed = collapsedFlag === '-'

      const calloutNode = schema.nodes.callout.create(
        {
          type: calloutType,
          title: title || null,
          collapsed,
        },
        schema.nodes.paragraph.create()
      )

      const tr = state.tr
        .delete(start, end)
        .insert(start, calloutNode)

      // Place cursor inside the callout paragraph (start + 2 skips the
      // callout wrapper opening and the paragraph opening).
      try {
        tr.setSelection(Selection.near(tr.doc.resolve(start + 2)))
      } catch {
        // Fallback: leave cursor wherever PM puts it
      }

      return tr
    }
  )
}

// ---------------------------------------------------------------------------
// Click handler plugin (toggle collapsed state)
// ---------------------------------------------------------------------------

const calloutClickKey = new PluginKey('callout-click-handler')

function calloutClickPlugin() {
  return new Plugin({
    key: calloutClickKey,
    props: {
      handleDOMEvents: {
        click: (view, event) => {
          const target = event.target

          // Check if clicked on toggle button
          if (
            target.classList?.contains('callout-toggle') ||
            target.getAttribute?.('data-toggle')
          ) {
            const calloutHeader = target.closest('.callout-header')
            if (!calloutHeader) return false

            const callout = calloutHeader.parentElement
            if (!callout || !callout.classList.contains('callout')) return false

            // Find the callout node in the editor
            let calloutPos = null
            let calloutNode = null

            view.state.doc.descendants((node, pos) => {
              if (node.type.name === 'callout') {
                const nodeDOM = view.nodeDOM(pos)
                if (nodeDOM === callout) {
                  calloutPos = pos
                  calloutNode = node
                  return false
                }
              }
            })

            if (calloutNode && calloutPos !== null) {
              const tr = view.state.tr.setNodeMarkup(calloutPos, null, {
                ...calloutNode.attrs,
                collapsed: !calloutNode.attrs.collapsed,
              })
              view.dispatch(tr)
              return true
            }
          }

          return false
        },
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all Callout-related ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createCalloutPlugins(schema) {
  return [
    inputRules({ rules: [calloutInputRule(schema)] }),
    keymap({
      'Mod-Alt-c': (state, dispatch, view) => {
        if (!view) return false
        return setCallout(view, { type: 'note' })
      },
    }),
    calloutClickPlugin(),
  ]
}

export { CALLOUT_TYPES }
export default createCalloutPlugins
