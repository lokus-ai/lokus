/**
 * Universal Markdown Compiler
 * 
 * Detects markdown content and compiles it to rich HTML
 * Works independently of TipTap for reliable markdown processing
 */

import MarkdownIt from "markdown-it"
import markdownItMark from "markdown-it-mark"
import markdownItStrikethrough from "markdown-it-strikethrough-alt"

export class MarkdownCompiler {
  constructor(options = {}) {
    this.md = new MarkdownIt({
      html: true,
      linkify: true,
      typographer: true,
      breaks: true,  // Convert line breaks
      ...options.markdownIt
    })
      .use(markdownItMark)
      .use(markdownItStrikethrough)
    
    this.options = {
      aggressive: true,  // Aggressively detect markdown
      minLength: 5,      // Minimum text length to process
      debugLogs: true,   // Show debug information
      ...options
    }
  }

  /**
   * Detect if text contains markdown
   */
  isMarkdown(text) {
    if (!text || typeof text !== 'string' || text.length < this.options.minLength) {
      return false
    }

    // Explicit markdown patterns (must have space after # for headers)
    const explicitPatterns = [
      /\*\*[^*]+\*\*/,        // **bold**
      /\*[^*]+\*/,            // *italic*
      /~~[^~]+~~/,            // ~~strikethrough~~
      /==[^=]+=/,             // ==highlight==
      /`[^`]+`/,              // `code`
      /^#{1,6}\s/m,           // # headings (space required)
      /^>\s/m,                // > blockquotes
      /^[-*+]\s/m,            // - lists
      /^\d+\.\s/m,            // 1. numbered lists
      /^\|.+\|/m,             // | table |
      /\[[^\]]*\]\([^)]*\)/,  // [link](url)
      /```[\s\S]*?```/,       // ```code blocks```
      /^\s*- \[[x\s]\]/m,     // - [x] task lists
    ]

    // Check for explicit markdown
    const hasExplicitMarkdown = explicitPatterns.some(pattern => pattern.test(text))
    
    if (hasExplicitMarkdown) {
      this.log('Explicit markdown detected')
      return true
    }

    // Likelihood scoring for ambiguous content
    let score = 0
    
    // Multi-line content
    const lineCount = text.split('\n').length
    if (lineCount > 2) score += 2
    if (lineCount > 5) score += 2
    
    // Length bonus
    if (text.length > 50) score += 1
    if (text.length > 200) score += 1
    
    // Structure patterns
    if (/\n\s*\n/.test(text)) score += 2  // Double line breaks
    if (/^[A-Z][^\n]*$/m.test(text)) score += 1  // Lines starting with capitals
    if (/\w+:\s*\w+/.test(text)) score += 1  // Key-value pairs
    
    // Aggressive mode: process most multi-line content
    if (this.options.aggressive) {
      if (lineCount > 1 && text.length > 20) score += 3
    }
    
    const threshold = this.options.aggressive ? 3 : 5
    const isLikely = score >= threshold
    
    this.log(`Markdown likelihood score: ${score}/${threshold}, likely: ${isLikely}`)
    return isLikely
  }

  /**
   * Compile markdown to HTML
   */
  compile(text) {
    if (!text || typeof text !== 'string') {
      return text
    }

    try {
      this.log('Compiling markdown:', text.substring(0, 100))
      
      const html = this.md.render(text)
      
      this.log('Compiled HTML:', html.substring(0, 200))
      return html
    } catch (error) {
      console.error('[MarkdownCompiler] Compilation failed:', error)
      return text // Fallback to original text
    }
  }

  /**
   * Smart process: detect and compile if needed
   */
  process(text) {
    if (!this.isMarkdown(text)) {
      this.log('Text not detected as markdown, returning as-is')
      return text
    }

    return this.compile(text)
  }

  /**
   * Process content for templates (with cursor handling)
   */
  processTemplate(content) {
    // Handle cursor placeholder specially
    const cursorPlaceholder = '{{cursor}}'
    const hasCursor = content.includes(cursorPlaceholder)
    
    if (hasCursor) {
      // Process parts separately to preserve cursor position
      const parts = content.split(cursorPlaceholder)
      const processedParts = parts.map(part => this.process(part))
      return processedParts.join(cursorPlaceholder)
    }
    
    return this.process(content)
  }

  /**
   * Debug logging
   */
  log(...args) {
    if (this.options.debugLogs) {
      console.log('[MarkdownCompiler]', ...args)
    }
  }
}

// Global instance
let compiler = null

export function getMarkdownCompiler(options = {}) {
  if (!compiler) {
    compiler = new MarkdownCompiler(options)
  }
  return compiler
}

export default MarkdownCompiler