/**
 * Tests for HTML to Markdown Converter
 * Tests conversion from TipTap HTML output to clean markdown
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { htmlToMarkdown, HTMLToMarkdownConverter } from '../../../src/core/templates/html-to-markdown.js';

describe('HTMLToMarkdownConverter', () => {
  let converter;

  beforeEach(() => {
    converter = new HTMLToMarkdownConverter();
  });

  describe('Basic HTML Elements', () => {
    it('should convert headings', () => {
      expect(converter.convert('<h1>Heading 1</h1>')).toBe('# Heading 1');
      expect(converter.convert('<h2>Heading 2</h2>')).toBe('## Heading 2');
      expect(converter.convert('<h3>Heading 3</h3>')).toBe('### Heading 3');
    });

    it('should convert paragraphs', () => {
      const html = '<p>First paragraph</p><p>Second paragraph</p>';
      const result = converter.convert(html);
      expect(result).toContain('First paragraph');
      expect(result).toContain('Second paragraph');
    });

    it('should convert bold text', () => {
      expect(converter.convert('<strong>Bold</strong>')).toBe('**Bold**');
      expect(converter.convert('<b>Bold</b>')).toBe('**Bold**');
    });

    it('should convert italic text', () => {
      expect(converter.convert('<em>Italic</em>')).toBe('*Italic*');
      expect(converter.convert('<i>Italic</i>')).toBe('*Italic*');
    });

    it('should convert links', () => {
      const html = '<a href="https://example.com">Link Text</a>';
      const result = converter.convert(html);
      expect(result).toBe('[Link Text](https://example.com)');
    });

    it('should convert lists', () => {
      const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should convert ordered lists', () => {
      const html = '<ol><li>First</li><li>Second</li></ol>';
      const result = converter.convert(html);
      expect(result).toContain('1. First');
      expect(result).toContain('2. Second');
    });

    it('should convert code blocks', () => {
      const html = '<pre><code>const x = 42;</code></pre>';
      const result = converter.convert(html);
      expect(result).toContain('```');
      expect(result).toContain('const x = 42;');
    });

    it('should convert inline code', () => {
      const html = '<code>inline code</code>';
      const result = converter.convert(html);
      expect(result).toBe('`inline code`');
    });

    it('should convert blockquotes', () => {
      const html = '<blockquote>Quote text</blockquote>';
      const result = converter.convert(html);
      expect(result).toContain('> Quote text');
    });

    it('should convert horizontal rules', () => {
      const html = '<hr>';
      const result = converter.convert(html);
      expect(result).toContain('---');
    });
  });

  describe('Extended Markdown Features', () => {
    it('should convert strikethrough', () => {
      expect(converter.convert('<s>Strikethrough</s>')).toBe('~~Strikethrough~~');
      expect(converter.convert('<del>Strikethrough</del>')).toBe('~~Strikethrough~~');
    });

    it('should convert highlights', () => {
      const html = '<mark>Highlighted text</mark>';
      const result = converter.convert(html);
      expect(result).toBe('==Highlighted text==');
    });
  });

  describe('Template Variable Preservation', () => {
    it('should preserve simple template variables', () => {
      const html = '<p>{{date}}</p>';
      const result = converter.convert(html);
      expect(result).toContain('{{date}}');
    });

    it('should preserve template variables with filters', () => {
      const html = '<p>{{date | dateFormat("yyyy-MM-dd")}}</p>';
      const result = converter.convert(html);
      expect(result).toContain('{{date | dateFormat("yyyy-MM-dd")}}');
    });

    it('should preserve prompt variables', () => {
      const html = '<p>{{prompt:name:Enter name:Default}}</p>';
      const result = converter.convert(html);
      expect(result).toContain('{{prompt:name:Enter name:Default}}');
    });

    it('should preserve conditional blocks', () => {
      const html = '<p>{{#if condition}}Show this{{/if}}</p>';
      const result = converter.convert(html);
      expect(result).toContain('{{#if condition}}');
      expect(result).toContain('{{/if}}');
    });

    it('should preserve loop blocks', () => {
      const html = '<p>{{#each items}}{{this.name}}{{/each}}</p>';
      const result = converter.convert(html);
      expect(result).toContain('{{#each items}}');
      expect(result).toContain('{{/each}}');
    });
  });

  describe('TipTap-Specific Elements', () => {
    it('should handle task lists', () => {
      const html = '<ul><li data-type="taskItem" data-checked="false">Unchecked</li><li data-type="taskItem" data-checked="true">Checked</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('[ ] Unchecked');
      expect(result).toContain('[x] Checked');
    });

    it('should convert wiki links', () => {
      const html = '<a data-type="wikiLink" href="Page Name">Page Name</a>';
      const result = converter.convert(html);
      expect(result).toBe('[[Page Name]]');
    });
  });

  describe('Complex HTML', () => {
    it('should convert nested formatting', () => {
      const html = '<p><strong><em>Bold and italic</em></strong></p>';
      const result = converter.convert(html);
      expect(result).toContain('***Bold and italic***');
    });

    it('should convert mixed content', () => {
      const html = `
        <h1>Title</h1>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      `;
      const result = converter.convert(html);
      expect(result).toContain('# Title');
      expect(result).toContain('**bold**');
      expect(result).toContain('*italic*');
      expect(result).toContain('- Item 1');
      expect(result).toContain('- Item 2');
    });

    it('should convert template with all features', () => {
      const html = `
        <h1>{{prompt:title:Enter title:My Title}}</h1>
        <p><strong>Date:</strong> {{date}}</p>
        <p><strong>Time:</strong> {{time}}</p>
        <h2>User Input</h2>
        <p>{{#if priority == "High"}}</p>
        <p>High priority task!</p>
        <p>{{/if}}</p>
        <ul>
          <li data-type="taskItem" data-checked="false">Task 1</li>
          <li data-type="taskItem" data-checked="false">Task 2</li>
        </ul>
      `;
      const result = converter.convert(html);

      expect(result).toContain('# {{prompt:title:Enter title:My Title}}');
      expect(result).toContain('**Date:** {{date}}');
      expect(result).toContain('**Time:** {{time}}');
      expect(result).toContain('{{#if priority == "High"}}');
      expect(result).toContain('{{/if}}');
      expect(result).toContain('[ ] Task 1');
      expect(result).toContain('[ ] Task 2');
    });
  });

  describe('Whitespace Handling', () => {
    it('should clean up excessive newlines', () => {
      const html = '<p>Line 1</p>\n\n\n\n<p>Line 2</p>';
      const result = converter.convert(html);
      expect(result).not.toContain('\n\n\n');
    });

    it('should trim leading and trailing whitespace', () => {
      const html = '  <p>Content</p>  ';
      const result = converter.convert(html);
      expect(result).toBe('Content');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty input', () => {
      expect(converter.convert('')).toBe('');
    });

    it('should handle null input', () => {
      expect(converter.convert(null)).toBe('');
    });

    it('should handle undefined input', () => {
      expect(converter.convert(undefined)).toBe('');
    });

    it('should handle malformed HTML gracefully', () => {
      const html = '<p>Unclosed paragraph';
      const result = converter.convert(html);
      expect(result).toContain('Unclosed paragraph');
    });

    it('should fallback to text extraction on conversion error', () => {
      // Test with potentially problematic HTML
      const html = '<script>alert("test")</script><p>Normal content</p>';
      const result = converter.convert(html);
      expect(result).toContain('Normal content');
    });
  });

  describe('Singleton Instance', () => {
    it('should export a singleton instance', () => {
      expect(htmlToMarkdown).toBeDefined();
      expect(htmlToMarkdown).toBeInstanceOf(HTMLToMarkdownConverter);
    });

    it('should have working convert method on singleton', () => {
      const result = htmlToMarkdown.convert('<strong>Test</strong>');
      expect(result).toBe('**Test**');
    });
  });

  describe('Configuration', () => {
    it('should use ATX-style headings', () => {
      const html = '<h1>Heading</h1>';
      const result = converter.convert(html);
      expect(result).toBe('# Heading');
      expect(result).not.toContain('=====');
    });

    it('should use dashes for unordered lists', () => {
      const html = '<ul><li>Item</li></ul>';
      const result = converter.convert(html);
      expect(result).toContain('- Item');
      expect(result).not.toContain('* Item');
    });

    it('should use fenced code blocks', () => {
      const html = '<pre><code>code</code></pre>';
      const result = converter.convert(html);
      expect(result).toContain('```');
      expect(result).not.toContain('    code'); // Not indented
    });
  });

  describe('Real-World Examples', () => {
    it('should convert meeting notes template', () => {
      const html = `
        <h1>Meeting Notes - {{date.format("MMMM do, yyyy")}}</h1>
        <p><strong>Attendees:</strong> {{prompt:attendees:Who attended?:}}</p>
        <h2>Agenda</h2>
        <ul>
          <li data-type="taskItem" data-checked="false">Topic 1</li>
          <li data-type="taskItem" data-checked="false">Topic 2</li>
        </ul>
        <h2>Notes</h2>
        <p>{{cursor}}</p>
      `;
      const result = converter.convert(html);

      expect(result).toContain('# Meeting Notes - {{date.format("MMMM do, yyyy")}}');
      expect(result).toContain('**Attendees:** {{prompt:attendees:Who attended?:}}');
      expect(result).toContain('## Agenda');
      expect(result).toContain('[ ] Topic 1');
      expect(result).toContain('{{cursor}}');
    });

    it('should convert project template', () => {
      const html = `
        <h1>{{prompt:projectName:Project name:My Project}}</h1>
        <p><strong>Type:</strong> {{suggest:type:Project type:Feature,Bug,Docs:Feature}}</p>
        <p>{{#if type == "Feature"}}</p>
        <p><mark>New feature implementation</mark></p>
        <p>{{/if}}</p>
        <h2>Description</h2>
        <p>{{cursor}}</p>
      `;
      const result = converter.convert(html);

      expect(result).toContain('# {{prompt:projectName:Project name:My Project}}');
      expect(result).toContain('{{suggest:type:Project type:Feature,Bug,Docs:Feature}}');
      expect(result).toContain('{{#if type == "Feature"}}');
      expect(result).toContain('==New feature implementation==');
    });
  });
});
