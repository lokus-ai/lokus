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
      /^---+$/m,              // --- horizontal rules
      /^\s*\|\s*[^|]+\s*\|/m, // | table cells |
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
    const lines = text.split('\n')
    const lineCount = lines.length
    if (lineCount > 2) score += 2
    if (lineCount > 5) score += 2
    if (lineCount > 10) score += 3  // Very structured content
    
    // Length bonus
    if (text.length > 50) score += 1
    if (text.length > 200) score += 1
    if (text.length > 500) score += 2  // Long form content
    
    // Structure patterns
    if (/\n\s*\n/.test(text)) score += 2  // Double line breaks
    if (/^[A-Z][^\n]*$/m.test(text)) score += 1  // Lines starting with capitals
    if (/\w+:\s*\w+/.test(text)) score += 1  // Key-value pairs
    
    // Common structured content patterns
    if (/^[A-Z][^.!?]*$/m.test(text)) score += 1  // Title-like lines
    if (lines.some(line => line.trim().length > 40)) score += 1  // Long lines suggest prose
    if (lines.filter(line => line.trim().length > 0).length >= lineCount * 0.7) score += 2  // Dense content
    
    // Multi-paragraph indicators
    const paragraphs = text.split(/\n\s*\n/).length
    if (paragraphs > 1) score += 2
    if (paragraphs > 3) score += 2
    
    // Aggressive mode: process most multi-line content
    if (this.options.aggressive) {
      if (lineCount > 1 && text.length > 20) score += 3
      // Boost score for content that looks like documentation/articles
      if (lineCount > 3 && text.length > 100) score += 2
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
      
      // Normalize line endings and preserve structure
      let normalizedText = text
        .replace(/\r\n/g, '\n')  // Windows line endings
        .replace(/\r/g, '\n')   // Mac line endings
        .trim()
      
      // Ensure proper paragraph breaks for multi-line content
      // Replace single line breaks with double line breaks where appropriate
      if (normalizedText.includes('\n') && !normalizedText.includes('\n\n')) {
        // Check if this looks like structured content (headings, lists, etc.)
        const hasStructure = /^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s)/m.test(normalizedText)
        
        if (hasStructure) {
          // For structured content, add paragraph breaks before headings and after lists
          normalizedText = normalizedText
            .replace(/\n(#{1,6}\s)/g, '\n\n$1')  // Double break before headings
            .replace(/^(#{1,6}\s.*)\n(?!#{1,6}\s|\n)/gm, '$1\n\n')  // Double break after headings
        } else {
          // For regular content, treat double line breaks as paragraph separators
          normalizedText = normalizedText.replace(/\n(?!\n)/g, '\n\n')
        }
      }
      
      const html = this.md.render(normalizedText)
      
      this.log('Compiled HTML:', html.substring(0, 200))
      return html
    } catch (error) {
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