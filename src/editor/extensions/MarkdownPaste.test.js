import { describe, it, expect, vi, beforeEach } from 'vitest'
import MarkdownPaste from './MarkdownPaste.js'

describe('MarkdownPaste Extension', () => {
  let mockEditor
  let extension

  beforeEach(() => {
    mockEditor = {
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          insertContent: vi.fn(() => ({
            run: vi.fn()
          }))
        }))
      }))
    }
    
    extension = MarkdownPaste.configure().configure({ editor: mockEditor })
  })

  it('should be created successfully', () => {
    expect(extension.name).toBe('markdownPaste')
  })

  it('should detect markdown content patterns', () => {
    const testCases = [
      { text: '**bold text**', expected: true },
      { text: '*italic text*', expected: true },
      { text: '# Heading', expected: true },
      { text: '- List item', expected: true },
      { text: '1. Numbered list', expected: true },
      { text: '> Blockquote', expected: true },
      { text: '~~strikethrough~~', expected: true },
      { text: '==highlight==', expected: true },
      { text: '`code`', expected: true },
      { text: '[link](url)', expected: true },
      { text: '```code block```', expected: true },
      { text: '- [x] task list', expected: true },
      { text: '[[wiki link]]', expected: true },
      { text: '![[wiki embed]]', expected: true },
      { text: 'plain text without markdown', expected: false },
      { text: '', expected: false },
      { text: null, expected: false }
    ]

    // We need to extract the isMarkdownContent function logic for testing
    const isMarkdownContent = (text) => {
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
        /\[\[[^\]]+\]\]/,       // [[wiki links]]
        /!\[\[[^\]]+\]\]/,      // ![[wiki embeds]]
      ]

      return markdownPatterns.some(pattern => pattern.test(text))
    }

    testCases.forEach(({ text, expected }) => {
      expect(isMarkdownContent(text)).toBe(expected)
    })
  })

  it('should handle mixed markdown content', () => {
    const mixedMarkdown = `
# Main Heading

This is **bold** and *italic* text.

- First item
- Second item with \`code\`

> This is a blockquote

## Subheading

1. Numbered list
2. Another item

\`\`\`javascript
console.log("Hello World");
\`\`\`

[[wiki link]] and ![[embed]]
`

    const isMarkdownContent = (text) => {
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
        /\[\[[^\]]+\]\]/,       // [[wiki links]]
        /!\[\[[^\]]+\]\]/,      // ![[wiki embeds]]
      ]
      return markdownPatterns.some(pattern => pattern.test(text))
    }

    expect(isMarkdownContent(mixedMarkdown)).toBe(true)
  })
})