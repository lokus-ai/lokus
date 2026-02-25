/**
 * CustomCodeBlock Extension (raw ProseMirror)
 *
 * Provides syntax highlighting for code blocks via lowlight + decorations,
 * input rules for ``` fences, and keyboard shortcuts.
 *
 * Schema is defined in lokus-schema.js (codeBlock with language attr).
 * This module provides:
 *   - Syntax highlighting decoration plugin
 *   - Input rule for ``` fences
 *   - Keyboard shortcuts (Enter, Backspace, Mod-Alt-c)
 */

import { lowlight } from 'lowlight'
import { InputRule, inputRules } from 'prosemirror-inputrules'
import { keymap } from 'prosemirror-keymap'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'
import { setBlockType } from 'prosemirror-commands'
import { Selection, TextSelection } from 'prosemirror-state'

// Import common languages
import javascript from 'highlight.js/lib/languages/javascript'
import typescript from 'highlight.js/lib/languages/typescript'
import python from 'highlight.js/lib/languages/python'
import java from 'highlight.js/lib/languages/java'
import cpp from 'highlight.js/lib/languages/cpp'
import c from 'highlight.js/lib/languages/c'
import csharp from 'highlight.js/lib/languages/csharp'
import go from 'highlight.js/lib/languages/go'
import rust from 'highlight.js/lib/languages/rust'
import php from 'highlight.js/lib/languages/php'
import ruby from 'highlight.js/lib/languages/ruby'
import swift from 'highlight.js/lib/languages/swift'
import kotlin from 'highlight.js/lib/languages/kotlin'
import css from 'highlight.js/lib/languages/css'
import html from 'highlight.js/lib/languages/xml'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import bash from 'highlight.js/lib/languages/bash'
import sql from 'highlight.js/lib/languages/sql'
import markdown from 'highlight.js/lib/languages/markdown'

// Register languages with lowlight
lowlight.registerLanguage('javascript', javascript)
lowlight.registerLanguage('js', javascript)
lowlight.registerLanguage('typescript', typescript)
lowlight.registerLanguage('ts', typescript)
lowlight.registerLanguage('python', python)
lowlight.registerLanguage('py', python)
lowlight.registerLanguage('java', java)
lowlight.registerLanguage('cpp', cpp)
lowlight.registerLanguage('c', c)
lowlight.registerLanguage('csharp', csharp)
lowlight.registerLanguage('cs', csharp)
lowlight.registerLanguage('go', go)
lowlight.registerLanguage('rust', rust)
lowlight.registerLanguage('php', php)
lowlight.registerLanguage('ruby', ruby)
lowlight.registerLanguage('swift', swift)
lowlight.registerLanguage('kotlin', kotlin)
lowlight.registerLanguage('css', css)
lowlight.registerLanguage('html', html)
lowlight.registerLanguage('xml', html)
lowlight.registerLanguage('json', json)
lowlight.registerLanguage('yaml', yaml)
lowlight.registerLanguage('yml', yaml)
lowlight.registerLanguage('bash', bash)
lowlight.registerLanguage('sh', bash)
lowlight.registerLanguage('shell', bash)
lowlight.registerLanguage('sql', sql)
lowlight.registerLanguage('markdown', markdown)
lowlight.registerLanguage('md', markdown)

// ---------------------------------------------------------------------------
// Syntax highlighting decoration plugin
// ---------------------------------------------------------------------------

const highlightKey = new PluginKey('code-block-highlight')

/**
 * Walk the lowlight HAST tree and collect inline decoration spans.
 *
 * @param {Array} children - HAST children array
 * @param {number} offset - Current character offset within the code block text
 * @param {Array} decorations - Accumulator for Decoration objects
 * @param {number} blockStart - The absolute PM position where the code text starts
 * @returns {number} The offset after processing all children
 */
function collectDecorations(children, offset, decorations, blockStart) {
  for (const child of children) {
    if (child.type === 'text') {
      offset += child.value.length
    } else if (child.type === 'element') {
      const className = (child.properties?.className || []).join(' ')
      const startOffset = offset

      // Recurse into element children
      offset = collectDecorations(child.children || [], offset, decorations, blockStart)

      if (className && offset > startOffset) {
        decorations.push(
          Decoration.inline(
            blockStart + startOffset,
            blockStart + offset,
            { class: className }
          )
        )
      }
    }
  }
  return offset
}

/**
 * Build a DecorationSet with syntax highlight decorations for all codeBlock
 * nodes in the document.
 *
 * @param {import('prosemirror-model').Node} doc
 * @returns {DecorationSet}
 */
function buildHighlightDecorations(doc) {
  const decorations = []

  doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return

    const code = node.textContent
    if (!code) return

    const language = node.attrs.language
    // pos is the position of the codeBlock node itself.
    // pos + 1 is where the text content starts.
    const blockStart = pos + 1

    let result
    try {
      if (language && lowlight.registered(language)) {
        result = lowlight.highlight(language, code)
      } else {
        result = lowlight.highlightAuto(code)
      }
    } catch {
      return // Skip highlighting on error
    }

    if (result?.children) {
      collectDecorations(result.children, 0, decorations, blockStart)
    }
  })

  return DecorationSet.create(doc, decorations)
}

function syntaxHighlightPlugin() {
  return new Plugin({
    key: highlightKey,
    state: {
      init(_, state) {
        return buildHighlightDecorations(state.doc)
      },
      apply(tr, oldDecorations, _oldState, newState) {
        // Only rebuild when document changes
        if (!tr.docChanged) return oldDecorations
        return buildHighlightDecorations(newState.doc)
      },
    },
    props: {
      decorations(state) {
        return this.getState(state)
      },
    },
  })
}

// ---------------------------------------------------------------------------
// Input rule: ```language to create a code block
// ---------------------------------------------------------------------------

function codeBlockInputRule(schema) {
  const codeBlockType = schema.nodes.codeBlock
  if (!codeBlockType) return null

  return new InputRule(
    /^```([a-z]+)?[\s\n]$/,
    (state, match, start, end) => {
      const language = match[1] || null
      const tr = state.tr
        .delete(start, end)
        .setBlockType(start, start, codeBlockType, { language })
      return tr
    }
  )
}

// ---------------------------------------------------------------------------
// Keyboard shortcuts
// ---------------------------------------------------------------------------

function codeBlockKeymap(schema) {
  const codeBlockType = schema.nodes.codeBlock
  const paragraphType = schema.nodes.paragraph

  return keymap({
    // Mod-Alt-c: toggle code block
    'Mod-Alt-c': (state, dispatch) => {
      if (!codeBlockType) return false
      const { $from } = state.selection
      if ($from.parent.type === codeBlockType) {
        // Already in a code block -- convert to paragraph
        if (paragraphType) {
          return setBlockType(paragraphType)(state, dispatch)
        }
        return false
      }
      return setBlockType(codeBlockType)(state, dispatch)
    },

    // Enter inside a code block: insert a newline, stay in the block
    Enter: (state, dispatch) => {
      const { $from, $to } = state.selection
      if ($from.parent.type.name !== 'codeBlock') return false

      if (dispatch) {
        dispatch(state.tr.insertText('\n', $from.pos, $to.pos))
      }
      return true
    },

    // Backspace at start of empty code block: convert to paragraph
    Backspace: (state, dispatch) => {
      const { empty, $anchor } = state.selection
      if (!empty || $anchor.parent.type.name !== 'codeBlock') return false
      const isAtStart = $anchor.parentOffset === 0

      if (isAtStart || !$anchor.parent.textContent.length) {
        if (paragraphType && dispatch) {
          return setBlockType(paragraphType)(state, dispatch)
        }
      }
      return false
    },
  })
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Create all CustomCodeBlock-related ProseMirror plugins.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {import('prosemirror-state').Plugin[]}
 */
export function createCodeBlockPlugins(schema) {
  const plugins = [syntaxHighlightPlugin()]

  const rule = codeBlockInputRule(schema)
  if (rule) {
    plugins.push(inputRules({ rules: [rule] }))
  }

  plugins.push(codeBlockKeymap(schema))

  return plugins
}

export { lowlight }
export default createCodeBlockPlugins
