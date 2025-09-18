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

            // Use our universal markdown compiler
            if (text) {
              const compiler = getMarkdownCompiler()
              
              // Check if HTML is actually rich content or just bloated markup
              if (html && html.trim()) {
                const isMarkdownText = compiler.isMarkdown(text)
                const htmlTextRatio = html.length / (text?.length || 1)
                
                console.log('[MarkdownPaste] HTML analysis:', {
                  htmlTextRatio: htmlTextRatio.toFixed(2),
                  isMarkdownText,
                  htmlSample: html.substring(0, 200)
                })
                
                // If text is clearly markdown, process it even if HTML is present
                if (isMarkdownText) {
                  console.log('[MarkdownPaste] Text is markdown, processing despite HTML presence')
                } else if (htmlTextRatio > 5) {
                  console.log('[MarkdownPaste] Rich HTML detected (ratio > 5), skipping markdown processing')
                  return false
                }
              }
              
              if (compiler.isMarkdown(text)) {
                console.log('[MarkdownPaste] Markdown detected, processing...')
                
                try {
                  // Prevent default paste
                  event.preventDefault()

                  // Compile markdown to HTML
                  const htmlContent = compiler.compile(text)
                  
                  // Insert the converted HTML with better parsing options
                  const inserted = editor.chain()
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