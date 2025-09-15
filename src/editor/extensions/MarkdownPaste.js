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
              text: text?.substring(0, 100),
              html: html?.substring(0, 100),
              textLength: text?.length,
              htmlLength: html?.length
            })

            // Skip processing if HTML content is present and looks like rich formatted content
            // But allow processing if HTML is just basic/minimal (often happens with markdown sources)
            if (html && html.trim() && isRichHTML(html)) {
              console.log('[MarkdownPaste] Skipping - rich HTML detected:', html.substring(0, 200))
              return false
            } else if (html && html.trim()) {
              console.log('[MarkdownPaste] HTML present but seems basic, will process if text looks like markdown:', html.substring(0, 200))
            }

            // Force process if user has markdown content
            // This is more aggressive - when in doubt, try to process as markdown
            const hasExplicitMarkdown = text && isMarkdownContent(text)
            const seemsLikeMarkdown = text && isLikelyMarkdown(text)
            const hasLineBreaksAndLength = text && text.length > 20 && text.includes('\n')
            
            console.log('[MarkdownPaste] Detection results:', {
              hasExplicitMarkdown,
              seemsLikeMarkdown, 
              hasLineBreaksAndLength,
              textSample: text?.substring(0, 150)
            })
            
            const shouldProcessAsMarkdown = text && (
              hasExplicitMarkdown || 
              seemsLikeMarkdown ||
              hasLineBreaksAndLength
            )

            if (shouldProcessAsMarkdown) {
              console.log('[MarkdownPaste] Converting markdown content...')
              console.log('[MarkdownPaste] Input text:', text.substring(0, 200))
              
              try {
                const md = new MarkdownIt({
                  html: true,
                  linkify: true,
                  typographer: true,
                  breaks: true,  // Convert line breaks to <br>
                })
                  .use(markdownItMark)
                  .use(markdownItStrikethrough)

                const htmlContent = md.render(text)
                console.log('[MarkdownPaste] Converted HTML:', htmlContent.substring(0, 300))

                // Prevent default paste
                event.preventDefault()

                // Insert the converted HTML
                const inserted = editor.chain()
                  .focus()
                  .insertContent(htmlContent, {
                    parseOptions: {
                      preserveWhitespace: 'full',
                    }
                  })
                  .run()

                console.log('[MarkdownPaste] Insertion result:', inserted)
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
    /\[[^\]]*\]\([^)]*\)/,  // [link](url)
    /```[\s\S]*?```/,       // ```code blocks```
    /^\s*- \[[x\s]\]/m,     // - [x] task lists
  ]

  return markdownPatterns.some(pattern => pattern.test(text))
}

function isRichHTML(html) {
  if (!html || typeof html !== 'string') return false
  
  // Check for rich formatting that indicates this is already formatted content
  // rather than simple HTML that might accompany markdown
  const richHTMLPatterns = [
    /<(div|span)[^>]*style[^>]*>/i,    // Inline styles
    /<(b|strong|i|em|u|font)[^>]*>/i,  // Rich text formatting tags
    /<img[^>]*>/i,                     // Images with HTML
    /<table[^>]*>/i,                   // HTML tables
    /<(h[1-6])[^>]*>/i,               // HTML headings (vs markdown)
    /<p[^>]*class[^>]*>/i,            // Styled paragraphs
    /<[^>]*color[^>]*>/i,             // Color styling
  ]

  // Also check for complex HTML structure
  const tagCount = (html.match(/<[^>]+>/g) || []).length
  const hasComplexStructure = tagCount > 3 // More than simple wrapping tags
  
  return richHTMLPatterns.some(pattern => pattern.test(html)) || hasComplexStructure
}

function isLikelyMarkdown(text) {
  if (!text || typeof text !== 'string') return false
  
  // More aggressive detection for content that should be processed as markdown
  const indicators = [
    // Multiple lines with consistent markdown-like patterns
    /^.+\n.+/m,                        // Multi-line content (often markdown)
    /\n\s*\n/,                         // Double line breaks (markdown paragraphs)
    /^[A-Z][^.!?]*[.!?]\s*$/m,        // Sentence-like lines (might be headings)
    /\w+:\s*\w+/,                      // Key-value pairs (metadata)
    /^\w+.*$/m,                        // Simple text lines (benefit from markdown processing)
  ]
  
  // Count how many markdown-like characteristics this text has
  let score = 0
  
  // Length bonus (longer text more likely to be markdown content)
  if (text.length > 50) score += 1
  if (text.length > 200) score += 1
  
  // Line count bonus (markdown often multi-line)
  const lineCount = text.split('\n').length
  if (lineCount > 2) score += 1
  if (lineCount > 5) score += 1
  
  // Pattern matching
  indicators.forEach(pattern => {
    if (pattern.test(text)) score += 1
  })
  
  // If it has any explicit markdown OR scores high on likelihood, process it
  // Lowered threshold to be more aggressive about processing content
  return score >= 1
}

export default MarkdownPaste