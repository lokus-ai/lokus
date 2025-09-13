import { Extension } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'
import MarkdownIt from "markdown-it"
import markdownItMark from "markdown-it-mark"
import markdownItStrikethrough from "markdown-it-strikethrough-alt"

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
              text: text?.substring(0, 100) 
            })

            // Only process plain text that looks like markdown
            if (text && !html && isMarkdownContent(text)) {
              console.log('[MarkdownPaste] Converting markdown content...')
              
              try {
                const md = new MarkdownIt({
                  html: true,
                  linkify: true,
                  typographer: true,
                })
                  .use(markdownItMark)
                  .use(markdownItStrikethrough)

                const htmlContent = md.render(text)
                console.log('[MarkdownPaste] Converted HTML:', htmlContent)

                // Prevent default paste
                event.preventDefault()

                // Insert the converted HTML
                editor.chain()
                  .focus()
                  .insertContent(htmlContent, {
                    parseOptions: {
                      preserveWhitespace: 'full',
                    }
                  })
                  .run()

                return true
              } catch (error) {
                console.error('[MarkdownPaste] Conversion failed:', error)
                return false
              }
            }

            return false
          },
        },
      }),
    ]
  },
})

function isMarkdownContent(text) {
  if (!text || typeof text !== 'string') return false
  
  const markdownPatterns = [
    /\*\*[^*]+\*\*/,        // **bold**
    /\*[^*]+\*/,            // *italic*
    /~~[^~]+~~/,            // ~~strikethrough~~
    /==[^=]+=/,             // ==highlight==
    /`[^`]+`/,              // `code`
    /^#{1,6}\s+/m,          // # headings
    /^>\s+/m,               // > blockquotes
    /^[-*+]\s+/m,           // - lists
    /^\d+\.\s+/m,           // 1. numbered lists
    /^\|.+\|/m,             // | table |
  ]

  return markdownPatterns.some(pattern => pattern.test(text))
}

export default MarkdownPaste