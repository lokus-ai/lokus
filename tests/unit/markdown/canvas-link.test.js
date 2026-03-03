/**
 * Tests for Canvas Link Markdown Pattern Recognition and Parsing
 *
 * Note: The MarkdownExporter (src/core/export/markdown-exporter.js) was removed
 * from this codebase. Tests for the export functionality have been removed.
 * This file tests the canvas link pattern recognition logic used by the
 * markdown compiler.
 */

import { describe, it, expect, beforeEach } from 'vitest';

describe('Canvas Link Markdown Parsing', () => {
  // Test the markdown-it plugin that parses ![CanvasName] back to canvas-link spans
  // Using MarkdownCompiler directly

  describe('Parse ![name] Pattern', () => {
    let compiler;

    beforeEach(async () => {
      // Dynamic import to avoid worker issues in tests
      const { MarkdownCompiler } = await import('../../../src/core/markdown/compiler-logic.js');
      compiler = new MarkdownCompiler();
    });

    it('should not parse ![[name]] as canvas link (wiki embed)', async () => {
      const markdown = 'This ![[Embedded Note]] is a wiki embed.';
      const html = compiler.md.render(markdown);

      // Should be wiki embed, not canvas link
      expect(html).not.toContain('data-type="canvas-link"');
    });

    it('should not parse ![alt](url) as canvas link (image)', async () => {
      const markdown = 'Image: ![alt text](http://example.com/image.png)';
      const html = compiler.md.render(markdown);

      expect(html).toContain('<img');
      expect(html).not.toContain('data-type="canvas-link"');
    });

    it('should render standard markdown correctly', async () => {
      const markdown = '**bold** and *italic*';
      const html = compiler.md.render(markdown);

      expect(html).toContain('<strong>bold</strong>');
      expect(html).toContain('<em>italic</em>');
    });
  });

  describe('Canvas Link Pattern Recognition', () => {
    // Test the pattern recognition without full markdown rendering

    it('should recognize ![name] pattern (not image, not wiki embed)', () => {
      // Pattern: ![something] where something is not empty and doesn't start with [
      const pattern = /!\[([^\[\]]+)\](?!\()/;

      expect(pattern.test('![Canvas Name]')).toBe(true);
      expect(pattern.test('![My Canvas]')).toBe(true);
      expect(pattern.test('![Lecture 1]')).toBe(true);
    });

    it('should not match image syntax', () => {
      const pattern = /!\[([^\[\]]+)\](?!\()/;

      // Images have (url) after ]
      expect('![alt](http://example.com/img.png)'.match(pattern)).toBeNull();
    });

    it('should not match wiki embed syntax', () => {
      const canvasPattern = /!\[([^\[\]]+)\](?!\()/;

      // Wiki embeds have [[ inside
      expect('![[Note Name]]'.match(canvasPattern)).toBeNull();
    });

    it('should extract canvas name from pattern', () => {
      const pattern = /!\[([^\[\]]+)\](?!\()/;

      const match = '![My Canvas]'.match(pattern);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('My Canvas');
    });

    it('should handle canvas names with special characters', () => {
      const pattern = /!\[([^\[\]]+)\](?!\()/;

      const match1 = '![Canvas (Draft) - v2]'.match(pattern);
      expect(match1[1]).toBe('Canvas (Draft) - v2');

      const match2 = '![2024-01-15 Notes]'.match(pattern);
      expect(match2[1]).toBe('2024-01-15 Notes');
    });

    it('should match multiple canvas links in text', () => {
      const pattern = /!\[([^\[\]]+)\](?!\()/g;
      const text = 'See ![Canvas A] and also ![Canvas B] for reference.';

      const matches = [...text.matchAll(pattern)];
      expect(matches.length).toBe(2);
      expect(matches[0][1]).toBe('Canvas A');
      expect(matches[1][1]).toBe('Canvas B');
    });
  });
});
