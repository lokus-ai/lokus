import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { getMarkdownCompiler } from '../../core/markdown/compiler.js'
import { MarkdownCompiler } from '../../core/markdown/compiler-logic.js'

const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  onCreate() {
  },

  addProseMirrorPlugins() {
    const editor = this.editor

    return [
      new Plugin({
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
              const syncCompiler = new MarkdownCompiler()
              const workerCompiler = getMarkdownCompiler()

              // Check if HTML is actually rich content or just bloated markup
              if (html && html.trim()) {
                const isMarkdownText = syncCompiler.isMarkdown(text)
                const htmlTextRatio = html.length / (text?.length || 1)

                // If text is clearly markdown, process it even if HTML is present
                if (isMarkdownText) {
                } else if (htmlTextRatio > 5) {
                  return false
                }
              }

              if (syncCompiler.isMarkdown(text)) {

                try {
                  // Prevent default paste immediately
                  event.preventDefault()

                  // Compile markdown to HTML asynchronously
                  workerCompiler.compile(text).then(htmlContent => {
                    if (!htmlContent) return

                    // Insert the converted HTML with better parsing options
                    editor.chain()
                      .focus()
                      .insertContent(htmlContent, {
                        parseOptions: {
                          preserveWhitespace: 'full',
                          findPositions: true,
                          keepWhitespace: true,
                        },
                        updateSelection: true,
                      })
                      .run()
                  }).catch(err => {
                    // Fallback to inserting text if compilation fails
                    editor.chain().focus().insertContent(text).run()
                  })

                  return true
                } catch (error) {
                  return false
                }
              } else {
              }
            }

            return false
          },
        },
      }),
    ]
  },
})

export default MarkdownPaste