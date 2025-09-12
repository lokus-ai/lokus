import { describe, it, expect } from 'vitest';

// Test utility functions that could be extracted from the editor
describe('Editor Utilities', () => {
  describe('Markdown Detection', () => {
    it('should detect markdown features correctly', () => {
      const detectMarkdownFeatures = (text) => {
        const features = {
          hasHeadings: /^#{1,6}\s/m.test(text),
          hasCodeBlocks: /```[\s\S]*?```/.test(text),
          hasBoldItalic: /(\*\*[^*]+\*\*|\*[^*]+\*|__[^_]+__|_[^_]+_)/.test(text),
          hasLists: /^\s*[-*+]\s/m.test(text) || /^\s*\d+\.\s/m.test(text),
          hasTaskLists: /^\s*- \[[x\s]\]/m.test(text),
          hasBlockquotes: /^>\s/m.test(text),
          hasStrikethrough: /~~[^~]+~~/.test(text),
          hasHighlights: /==[^=]+==/.test(text),
          hasWikiLinks: /\[\[[^\]]+\]\]/.test(text),
          hasMath: /\$\$[\s\S]*?\$\$|\$[^$\s][^$]*[^$\s]\$/.test(text)
        };
        
        return features;
      };

      // Test heading detection
      expect(detectMarkdownFeatures('# Heading')).toHaveProperty('hasHeadings', true);
      expect(detectMarkdownFeatures('## Sub Heading')).toHaveProperty('hasHeadings', true);
      expect(detectMarkdownFeatures('Regular text')).toHaveProperty('hasHeadings', false);

      // Test code block detection
      expect(detectMarkdownFeatures('```javascript\ncode\n```')).toHaveProperty('hasCodeBlocks', true);
      expect(detectMarkdownFeatures('inline `code`')).toHaveProperty('hasCodeBlocks', false);

      // Test formatting detection
      expect(detectMarkdownFeatures('**bold text**')).toHaveProperty('hasBoldItalic', true);
      expect(detectMarkdownFeatures('*italic text*')).toHaveProperty('hasBoldItalic', true);
      expect(detectMarkdownFeatures('regular text')).toHaveProperty('hasBoldItalic', false);

      // Test list detection
      expect(detectMarkdownFeatures('- list item')).toHaveProperty('hasLists', true);
      expect(detectMarkdownFeatures('1. numbered item')).toHaveProperty('hasLists', true);
      expect(detectMarkdownFeatures('regular text')).toHaveProperty('hasLists', false);

      // Test task list detection
      expect(detectMarkdownFeatures('- [x] completed task')).toHaveProperty('hasTaskLists', true);
      expect(detectMarkdownFeatures('- [ ] incomplete task')).toHaveProperty('hasTaskLists', true);
      expect(detectMarkdownFeatures('- regular list')).toHaveProperty('hasTaskLists', false);

      // Test math detection
      expect(detectMarkdownFeatures('$E=mc^2$')).toHaveProperty('hasMath', true);
      expect(detectMarkdownFeatures('$$E=mc^2$$')).toHaveProperty('hasMath', true);
      expect(detectMarkdownFeatures('regular text')).toHaveProperty('hasMath', false);

      // Test wiki link detection
      expect(detectMarkdownFeatures('[[Page Name]]')).toHaveProperty('hasWikiLinks', true);
      expect(detectMarkdownFeatures('[regular](link)')).toHaveProperty('hasWikiLinks', false);
    });
  });

  describe('Text Processing', () => {
    it('should handle wiki link parsing', () => {
      const parseWikiLink = (text) => {
        const match = /^\[\[([^#|]+)(?:#([^|]+))?(?:\|(.*))?]]\$/.exec(text || '');
        return match ? {
          path: match[1]?.trim(),
          hash: match[2]?.trim() || '',
          alt: match[3]?.trim() || ''
        } : null;
      };

      expect(parseWikiLink('[[Page Name]]')).toEqual({
        path: 'Page Name',
        hash: '',
        alt: ''
      });

      expect(parseWikiLink('[[Page#section|Display Text]]')).toEqual({
        path: 'Page',
        hash: 'section',
        alt: 'Display Text'
      });
    });

    it('should sanitize file names', () => {
      const sanitizeFileName = (name) => {
        return name
          .replace(/[<>:"/\\|?*]/g, '-')
          .replace(/\s+/g, '-')
          .toLowerCase();
      };

      expect(sanitizeFileName('My File Name')).toBe('my-file-name');
      expect(sanitizeFileName('File:with/slashes')).toBe('file-with-slashes');
      expect(sanitizeFileName('File<>with"quotes')).toBe('file--with-quotes');
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should parse keyboard shortcuts correctly', () => {
      const parseShortcut = (shortcut) => {
        const parts = shortcut.split('+');
        const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || '');
        
        return parts.map(part => {
          switch(part) {
            case 'CommandOrControl': return isMac ? '⌘' : 'Ctrl';
            case 'Control': return isMac ? '⌃' : 'Ctrl';
            case 'Shift': return isMac ? '⇧' : 'Shift';
            case 'Alt': return isMac ? '⌥' : 'Alt';
            default: return part.toUpperCase();
          }
        });
      };

      const shortcut = parseShortcut('CommandOrControl+S');
      expect(shortcut).toContain('S');
      expect(shortcut.length).toBe(2);
    });
  });

  describe('Content Validation', () => {
    it('should validate editor content', () => {
      const validateContent = (content) => {
        if (!content || typeof content !== 'string') {
          return { valid: false, error: 'Content must be a non-empty string' };
        }

        if (content.length > 1000000) { // 1MB limit
          return { valid: false, error: 'Content too large' };
        }

        return { valid: true };
      };

      expect(validateContent('Valid content')).toEqual({ valid: true });
      expect(validateContent('')).toEqual({ 
        valid: false, 
        error: 'Content must be a non-empty string' 
      });
      expect(validateContent(null)).toEqual({ 
        valid: false, 
        error: 'Content must be a non-empty string' 
      });
    });
  });
});