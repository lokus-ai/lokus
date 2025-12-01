import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { getMarkdownCompiler } from '../../core/markdown/compiler.js'
import { MarkdownCompiler } from '../../core/markdown/compiler-logic.js'

const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  onCreate() {
    console.log('[MarkdownPaste] Extension created successfully');
  },

  addProseMirrorPlugins() {
    console.log('[MarkdownPaste] Adding ProseMirror plugin');
    const editor = this.editor

    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

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
                console.log('[MarkdownPaste] Detected as markdown:', text.substring(0, 100));

                try {
                  // Prevent default paste immediately
                  event.preventDefault()

                  // Compile markdown to HTML asynchronously
                  workerCompiler.compile(text).then(htmlContent => {
                    console.log('[MarkdownPaste] Compiled HTML:', htmlContent.substring(0, 200));
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
                    console.error('Markdown paste compilation failed:', err)
                    // Fallback to inserting text if compilation fails
                    editor.chain().focus().insertContent(text).run()
                  })

                  return true
                } catch (error) {
                  return false
                }
              } else {
                console.log('[MarkdownPaste] NOT detected as markdown:', text.substring(0, 100));
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