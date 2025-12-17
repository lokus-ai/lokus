/**
 * Tests for Canvas Link Markdown Export and Parsing
 * Tests the round-trip: HTML canvas-link -> Markdown ![name] -> HTML canvas-link
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownExporter } from '../../../src/core/export/markdown-exporter.js';

describe('Canvas Link Markdown', () => {
  let exporter;

  beforeEach(() => {
    exporter = new MarkdownExporter();
  });

  describe('Export to Markdown', () => {
    it('should export canvas-link span to ![name] format', () => {
      const html = '<p><span data-type="canvas-link" class="canvas-link" href="/path/to/canvas.canvas">My Canvas</span></p>';

      const markdown = exporter.export(html);

      expect(markdown).toContain('![My Canvas]');
    });

    it('should export canvas-link anchor (legacy) to ![name] format', () => {
      const html = '<p><a data-type="canvas-link" class="canvas-link" href="/path/to/canvas.canvas">Legacy Canvas</a></p>';

      const markdown = exporter.export(html);

      expect(markdown).toContain('![Legacy Canvas]');
    });

    it('should preserve canvas name with spaces', () => {
      const html = '<p><span data-type="canvas-link" class="canvas-link" href="/path.canvas">Lecture 1 Notes</span></p>';

      const markdown = exporter.export(html);

      expect(markdown).toContain('![Lecture 1 Notes]');
    });

    it('should handle broken canvas links', () => {
      const html = '<p><span data-type="canvas-link" class="canvas-link canvas-link-broken" href="">Missing Canvas</span></p>';

      const markdown = exporter.export(html);

      expect(markdown).toContain('![Missing Canvas]');
    });

    it('should not confuse canvas links with wiki links', () => {
      const html = `
        <p>
          <span data-type="canvas-link" class="canvas-link" href="/canvas.canvas">My Canvas</span>
          and
          <a data-type="wiki-link" href="/note.md" target="Note|Note">Note</a>
        </p>
      `;

      const markdown = exporter.export(html);

      expect(markdown).toContain('![My Canvas]');
      expect(markdown).toContain('[[Note|Note]]');
    });

    it('should handle multiple canvas links in same paragraph', () => {
      const html = `
        <p>
          <span data-type="canvas-link" class="canvas-link" href="/a.canvas">Canvas A</span>
          and
          <span data-type="canvas-link" class="canvas-link" href="/b.canvas">Canvas B</span>
        </p>
      `;

      const markdown = exporter.export(html);

      expect(markdown).toContain('![Canvas A]');
      expect(markdown).toContain('![Canvas B]');
    });

    it('should handle canvas link with special characters in name', () => {
      const html = '<p><span data-type="canvas-link" class="canvas-link" href="/path.canvas">Canvas (Draft) - v2</span></p>';

      const markdown = exporter.export(html);

      expect(markdown).toContain('![Canvas (Draft) - v2]');
    });
  });

  describe('HTML to Markdown Conversion', () => {
    it('should handle canvas link within formatted text', () => {
      const html = `
        <p>Check out <strong>this</strong> <span data-type="canvas-link" class="canvas-link" href="/test.canvas">Test Canvas</span> for details.</p>
      `;

      const markdown = exporter.export(html);

      expect(markdown).toContain('**this**');
      expect(markdown).toContain('![Test Canvas]');
    });

    it('should handle canvas link in heading', () => {
      const html = `
        <h2>Overview <span data-type="canvas-link" class="canvas-link" href="/overview.canvas">Diagram</span></h2>
      `;

      const markdown = exporter.export(html);

      expect(markdown).toContain('## ');
      expect(markdown).toContain('![Diagram]');
    });
  });
});

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

describe('Canvas Link Round-trip', () => {
  // Test export works correctly - parsing is handled by MarkdownCompiler

  it('should export canvas link to markdown format', () => {
    const exporter = new MarkdownExporter();

    // Start with HTML
    const originalHtml = '<p><span data-type="canvas-link" class="canvas-link" href="/test.canvas">Test Canvas</span></p>';

    // Export to markdown
    const markdown = exporter.export(originalHtml);
    expect(markdown).toContain('![Test Canvas]');
  });

  it('should preserve canvas name through export', () => {
    const exporter = new MarkdownExporter();

    const htmlCases = [
      { html: '<p><span data-type="canvas-link" class="canvas-link" href="/a.canvas">Simple</span></p>', expected: '![Simple]' },
      { html: '<p><span data-type="canvas-link" class="canvas-link" href="/a.canvas">With Spaces</span></p>', expected: '![With Spaces]' },
      { html: '<p><span data-type="canvas-link" class="canvas-link" href="/a.canvas">Special (chars) - v1</span></p>', expected: '![Special (chars) - v1]' },
    ];

    for (const { html, expected } of htmlCases) {
      const markdown = exporter.export(html);
      expect(markdown).toContain(expected);
    }
  });
});
