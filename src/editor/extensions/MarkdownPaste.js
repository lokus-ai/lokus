import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import { getMarkdownCompiler } from '../../core/markdown/compiler.js'

const MarkdownPaste = Extension.create({
  name: 'markdownPaste',

  onCreate() {
    console.log('[MarkdownPaste] Extension created successfully')
  },

  addProseMirrorPlugins() {
    const editor = this.editor
    console.log('[MarkdownPaste] Adding ProseMirror plugin')

    return [
      new Plugin({
        props: {
          handlePaste(view, event) {
            const clipboardData = event.clipboardData
            if (!clipboardData) return false

            const text = clipboardData.getData('text/plain')
            const html = clipboardData.getData('text/html')

            console.log('[MarkdownPaste] Paste event:', { 
              hasText: !!text, 
              hasHtml: !!html, 
              textLength: text?.length,
              htmlLength: html?.length,
              textSample: text?.substring(0, 100)
            })

            // Skip if we already have rich HTML content
            if (html && html.trim() && html.length > text?.length) {
              console.log('[MarkdownPaste] Rich HTML detected, skipping markdown processing')
              return false
            }

            // Use our universal markdown compiler
            if (text) {
              const compiler = getMarkdownCompiler()
              
              if (compiler.isMarkdown(text)) {
                console.log('[MarkdownPaste] Markdown detected, processing...')
                
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

                  console.log('[MarkdownPaste] Successfully inserted compiled markdown')
                  return true
                } catch (error) {
                  console.error('[MarkdownPaste] Compilation failed:', error)
                  return false
                }
              } else {
                console.log('[MarkdownPaste] Text not detected as markdown')
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