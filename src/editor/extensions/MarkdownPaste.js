import { Plugin } from 'prosemirror-state'
import { Slice } from 'prosemirror-model'
import { MarkdownCompiler } from '../../core/markdown/compiler-logic.js'
import { createLokusParser } from '../../core/markdown/lokus-md-pipeline.js'

// Singleton — created once on first use, reused on subsequent pastes
let _syncCompiler = null
const getSyncCompiler = () => {
  if (!_syncCompiler) _syncCompiler = new MarkdownCompiler()
  return _syncCompiler
}

/**
 * Creates the MarkdownPaste ProseMirror plugin.
 *
 * Intercepts paste events and converts Markdown content to ProseMirror nodes
 * using the Lokus markdown pipeline, inserting the result via view.dispatch().
 *
 * @returns {Plugin}
 */
export function createMarkdownPastePlugin() {
  return new Plugin({
    props: {
      handlePaste(view, event) {
        const clipboardData = event.clipboardData
        if (!clipboardData) return false

        // Inside code blocks, paste as plain text only
        const { state } = view
        const { $from } = state.selection
        if ($from.parent.type.name === 'codeBlock') {
          const text = clipboardData.getData('text/plain')
          if (text) {
            event.preventDefault()
            // Insert plain text directly into the code block
            const tr = state.tr.insertText(text, $from.pos, state.selection.$to.pos)
            view.dispatch(tr)
            return true
          }
          return false
        }

        const text = clipboardData.getData('text/plain')
        const html = clipboardData.getData('text/html')

        // Use our universal markdown compiler
        if (text) {
          // Use local sync compiler for quick checks
          const syncCompiler = getSyncCompiler()

          // Check if HTML is actually rich content or just bloated markup
          if (html && html.trim()) {
            const isMarkdownText = syncCompiler.isMarkdown(text)
            const htmlTextRatio = html.length / (text?.length || 1)

            // If text is clearly markdown, process it even if HTML is present
            if (isMarkdownText) {
              // continue to markdown processing below
            } else if (htmlTextRatio > 5) {
              return false
            }
          }

          if (syncCompiler.isMarkdown(text)) {
            try {
              // Prevent default paste immediately
              event.preventDefault()

              // Parse markdown directly to a ProseMirror doc, then insert as a slice
              const parser = createLokusParser(state.schema)

              // Parse asynchronously to keep the pattern consistent with the
              // async worker path, but use the synchronous parser directly
              Promise.resolve().then(() => {
                try {
                  const doc = parser.parse(text)
                  if (!doc) return

                  const slice = new Slice(doc.content, 0, 0)
                  const tr = view.state.tr.replaceSelection(slice)
                  view.dispatch(tr)
                } catch (err) {
                  // Fallback: insert as plain text if parsing fails
                  const tr = view.state.tr.insertText(text)
                  view.dispatch(tr)
                }
              })

              return true
            } catch (error) {
              return false
            }
          }
        }

        return false
      },
    },
  })
}

export default createMarkdownPastePlugin
