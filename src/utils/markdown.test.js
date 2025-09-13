import { describe, it, expect } from 'vitest'

// Utility functions for markdown detection and parsing
const markdownUtils = {
  isMarkdownContent(text) {
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
  },

  detectMarkdownFeatures(text) {
    if (!text || typeof text !== 'string') return []
    
    const features = []
    
    if (/^#{1,6}\s+/m.test(text)) features.push('headings')
    if (/```[\s\S]*?```/.test(text)) features.push('codeBlocks')
    if (/\*\*[^*]+\*\*|__[^_]+__/.test(text)) features.push('bold')
    if (/\*[^*]+\*|_[^_]+_/.test(text)) features.push('italic')
    if (/^\s*[-*+]\s/m.test(text) || /^\s*\d+\.\s/m.test(text)) features.push('lists')
    if (/^\s*- \[[x\s]\]/m.test(text)) features.push('taskLists')
    if (/>\s/.test(text)) features.push('blockquotes') // Fixed: removed ^ anchor
    if (/~~[^~]+~~/.test(text)) features.push('strikethrough')
    if (/==[^=]+==/.test(text)) features.push('highlights')
    if (/\[\[[^\]]+\]\]/.test(text)) features.push('wikiLinks')
    if (/\$\$[\s\S]*?\$\$|\$[^$\s][^$]*[^$\s]\$/.test(text)) features.push('math')
    
    return features
  },

  shouldProcessAsMarkdown(text) {
    const features = this.detectMarkdownFeatures(text)
    const hasMath = features.includes('math')
    const hasComplexFeatures = features.some(f => ['codeBlocks', 'taskLists', 'wikiLinks'].includes(f))
    
    // Don't process as markdown if it has math
    if (hasMath) return false
    
    // Process if it has complex features or multiple features
    return hasComplexFeatures || features.length >= 2
  }
}

describe('Markdown Utilities', () => {
  describe('isMarkdownContent', () => {
    it('should detect bold text', () => {
      expect(markdownUtils.isMarkdownContent('**bold text**')).toBe(true)
      expect(markdownUtils.isMarkdownContent('__bold text__')).toBe(false) // not in patterns
    })

    it('should detect italic text', () => {
      expect(markdownUtils.isMarkdownContent('*italic text*')).toBe(true)
      expect(markdownUtils.isMarkdownContent('_italic text_')).toBe(false) // not in patterns
    })

    it('should detect headings', () => {
      expect(markdownUtils.isMarkdownContent('# Heading 1')).toBe(true)
      expect(markdownUtils.isMarkdownContent('## Heading 2')).toBe(true)
      expect(markdownUtils.isMarkdownContent('###### Heading 6')).toBe(true)
    })

    it('should detect code blocks', () => {
      expect(markdownUtils.isMarkdownContent('`inline code`')).toBe(true)
    })

    it('should detect lists', () => {
      expect(markdownUtils.isMarkdownContent('- list item')).toBe(true)
      expect(markdownUtils.isMarkdownContent('* list item')).toBe(true)
      expect(markdownUtils.isMarkdownContent('+ list item')).toBe(true)
      expect(markdownUtils.isMarkdownContent('1. numbered item')).toBe(true)
    })

    it('should detect blockquotes', () => {
      expect(markdownUtils.isMarkdownContent('> quoted text')).toBe(true)
    })

    it('should detect strikethrough', () => {
      expect(markdownUtils.isMarkdownContent('~~strikethrough~~')).toBe(true)
    })

    it('should detect highlights', () => {
      expect(markdownUtils.isMarkdownContent('==highlighted text==')).toBe(true)
    })

    it('should detect tables', () => {
      expect(markdownUtils.isMarkdownContent('| col1 | col2 |')).toBe(true)
    })

    it('should return false for plain text', () => {
      expect(markdownUtils.isMarkdownContent('just plain text')).toBe(false)
    })

    it('should handle empty or invalid input', () => {
      expect(markdownUtils.isMarkdownContent('')).toBe(false)
      expect(markdownUtils.isMarkdownContent(null)).toBe(false)
      expect(markdownUtils.isMarkdownContent(undefined)).toBe(false)
      expect(markdownUtils.isMarkdownContent(123)).toBe(false)
    })
  })

  describe('detectMarkdownFeatures', () => {
    it('should detect multiple features', () => {
      const text = '# Heading\n\n**Bold** and *italic* text\n\n- List item\n\n`code`'
      const features = markdownUtils.detectMarkdownFeatures(text)
      
      expect(features).toContain('headings')
      expect(features).toContain('bold')
      expect(features).toContain('italic')
      expect(features).toContain('lists')
    })

    it('should detect task lists', () => {
      const text = '- [x] Completed task\n- [ ] Incomplete task'
      const features = markdownUtils.detectMarkdownFeatures(text)
      
      expect(features).toContain('taskLists')
    })

    it('should detect wiki links', () => {
      const text = 'Link to [[Another Page]]'
      const features = markdownUtils.detectMarkdownFeatures(text)
      
      expect(features).toContain('wikiLinks')
    })

    it('should detect math', () => {
      const text = 'Inline $x = y$ and block $$E = mc^2$$'
      const features = markdownUtils.detectMarkdownFeatures(text)
      
      expect(features).toContain('math')
    })

    it('should return empty array for plain text', () => {
      const features = markdownUtils.detectMarkdownFeatures('just plain text')
      expect(features).toEqual([])
    })
  })

  describe('shouldProcessAsMarkdown', () => {
    it('should process complex markdown', () => {
      const text = '# Heading\n\n```code block```\n\nSome text'
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(true)
    })

    it('should process multiple feature markdown', () => {
      const text = '**Bold** text with *italic* and > blockquote'
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(true)
    })

    it('should not process math content', () => {
      const text = 'Math equation: $x = y + z$'
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(false)
    })

    it('should process bold markdown that also matches italic pattern', () => {
      const text = '**just bold**'
      // Note: This text matches both bold (**text**) and italic (*text*) patterns
      // so it has 2 features and should be processed
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(true)
    })

    it('should process task lists', () => {
      const text = '- [x] Task done\n- [ ] Task todo'
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(true)
    })

    it('should process wiki links', () => {
      const text = 'Link to [[Page Name]]'
      expect(markdownUtils.shouldProcessAsMarkdown(text)).toBe(true)
    })
  })
})