/**
 * CodeBlockIndent Plugin (raw ProseMirror)
 *
 * Adds proper tab indentation support inside code blocks.
 * - Tab key inserts 2 spaces (or configurable)
 * - Shift+Tab removes indentation
 * - Works like VS Code inside code blocks
 */

import { keymap } from 'prosemirror-keymap'

/**
 * Check whether the current selection is inside a codeBlock node.
 *
 * @param {import('prosemirror-state').EditorState} state
 * @returns {boolean}
 */
function isInCodeBlock(state) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth >= 0; depth--) {
    if ($from.node(depth).type.name === 'codeBlock') return true
  }
  return false
}

/**
 * Create the code-block indent keymap plugin.
 *
 * @param {Object} [options]
 * @param {number} [options.tabSize=2] - Number of spaces per tab
 * @returns {import('prosemirror-state').Plugin} A ProseMirror keymap plugin
 */
export function createCodeBlockIndentPlugin(options = {}) {
  const { tabSize = 2 } = options
  const spaces = ' '.repeat(tabSize)

  return keymap({
    // Tab: insert spaces inside code blocks
    Tab: (state, dispatch) => {
      if (!isInCodeBlock(state)) return false
      if (dispatch) {
        const { $from, $to } = state.selection
        dispatch(state.tr.insertText(spaces, $from.pos, $to.pos))
      }
      return true
    },

    // Shift-Tab: remove leading spaces on the current line
    'Shift-Tab': (state, dispatch) => {
      if (!isInCodeBlock(state)) return false

      const { $from } = state.selection
      // Get text from start of the text block to the cursor
      const textBefore = state.doc.textBetween($from.start(), $from.pos, '\n')

      // Find the current line (text after last newline)
      const lines = textBefore.split('\n')
      const currentLine = lines[lines.length - 1]

      // Check if the line starts with spaces
      const indentMatch = currentLine.match(/^(\s+)/)
      if (indentMatch && dispatch) {
        const spacesToRemove = Math.min(tabSize, indentMatch[1].length)
        const lineStartPos = $from.pos - currentLine.length
        dispatch(state.tr.delete(lineStartPos, lineStartPos + spacesToRemove))
      }

      return true
    },
  })
}

export default createCodeBlockIndentPlugin
