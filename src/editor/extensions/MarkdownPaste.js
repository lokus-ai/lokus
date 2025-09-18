import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { getMarkdownCompiler } from '../../core/markdown/compiler.js'

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

            const text = clipboardData.getData('text/plain')
            const html = clipboardData.getData('text/html')


            // Use our universal markdown compiler
            if (text) {
              const compiler = getMarkdownCompiler()
              
              // Check if HTML is actually rich content or just bloated markup
              if (html && html.trim()) {
                const isMarkdownText = compiler.isMarkdown(text)
                const htmlTextRatio = html.length / (text?.length || 1)
                
                
                // If text is clearly markdown, process it even if HTML is present
                if (isMarkdownText) {
                } else if (htmlTextRatio > 5) {
                  return false
                }
              }
              
              if (compiler.isMarkdown(text)) {
                
                try {
                  // Prevent default paste
                  event.preventDefault()

                  // Compile markdown to HTML
                  const htmlContent = compiler.compile(text)
                  
                  // Insert the converted HTML
                  const inserted = editor.chain()
                    .focus()
                    .insertContent(htmlContent, {
                      parseOptions: {
                        preserveWhitespace: 'full',
                      }
                    })
                    .run()

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