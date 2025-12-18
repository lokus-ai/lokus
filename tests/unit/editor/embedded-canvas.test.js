/**
 * Tests for Embedded Canvas Extension
 * Tests the ![canvas] input rule and markdown round-trip
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarkdownExporter } from '../../../src/core/export/markdown-exporter.js';

describe('Embedded Canvas', () => {
  describe('Input Rule Pattern', () => {
    // Test the regex pattern used in the input rule
    const CANVAS_INPUT_REGEX = /!\[canvas(?::(\d+)x(\d+))?\]$/;

    it('should match ![canvas] without dimensions', () => {
      const match = '![canvas]'.match(CANVAS_INPUT_REGEX);
      expect(match).not.toBeNull();
      expect(match[1]).toBeUndefined(); // No width
      expect(match[2]).toBeUndefined(); // No height
    });

    it('should match ![canvas:600x400] with dimensions', () => {
      const match = '![canvas:600x400]'.match(CANVAS_INPUT_REGEX);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('600');
      expect(match[2]).toBe('400');
    });

    it('should match ![canvas:1200x800] with large dimensions', () => {
      const match = '![canvas:1200x800]'.match(CANVAS_INPUT_REGEX);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('1200');
      expect(match[2]).toBe('800');
    });

    it('should match at end of text', () => {
      const match = 'Some text before ![canvas]'.match(CANVAS_INPUT_REGEX);
      expect(match).not.toBeNull();
    });

    it('should match at end with dimensions', () => {
      const match = 'Draw here: ![canvas:400x300]'.match(CANVAS_INPUT_REGEX);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('400');
      expect(match[2]).toBe('300');
    });

    it('should not match ![canvas] in middle of line', () => {
      const match = '![canvas] and more text'.match(CANVAS_INPUT_REGEX);
      expect(match).toBeNull();
    });

    it('should not match regular image syntax', () => {
      const match = '![alt text](http://example.com/img.png)'.match(CANVAS_INPUT_REGEX);
      expect(match).toBeNull();
    });

    it('should not match wiki embed syntax', () => {
      const match = '![[Note Name]]'.match(CANVAS_INPUT_REGEX);
      expect(match).toBeNull();
    });

    it('should not match canvas link syntax', () => {
      const match = '![My Canvas]'.match(CANVAS_INPUT_REGEX);
      // This should not match because "My Canvas" doesn't start with "canvas:"
      expect(match).toBeNull();
    });
  });

  describe('Dimension Clamping', () => {
    const MIN_WIDTH = 200;
    const MIN_HEIGHT = 150;
    const MAX_WIDTH = 1200;
    const MAX_HEIGHT = 800;

    function clampDimensions(width, height) {
      return {
        width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width)),
        height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, height))
      };
    }

    it('should clamp too-small width', () => {
      const { width } = clampDimensions(100, 400);
      expect(width).toBe(MIN_WIDTH);
    });

    it('should clamp too-small height', () => {
      const { height } = clampDimensions(600, 50);
      expect(height).toBe(MIN_HEIGHT);
    });

    it('should clamp too-large width', () => {
      const { width } = clampDimensions(2000, 400);
      expect(width).toBe(MAX_WIDTH);
    });

    it('should clamp too-large height', () => {
      const { height } = clampDimensions(600, 1500);
      expect(height).toBe(MAX_HEIGHT);
    });

    it('should not change valid dimensions', () => {
      const { width, height } = clampDimensions(600, 400);
      expect(width).toBe(600);
      expect(height).toBe(400);
    });
  });

  describe('Markdown Export', () => {
    let exporter;

    beforeEach(() => {
      exporter = new MarkdownExporter();
    });

    it('should export embedded-canvas to ![canvas:uuid:WxH] format', () => {
      const html = '<p><embedded-canvas data-fragment-id="abc-123" data-width="600" data-height="400"></embedded-canvas></p>';
      const markdown = exporter.export(html);

      expect(markdown).toContain('![canvas:abc-123:600x400]');
    });

    it('should export with custom dimensions', () => {
      const html = '<embedded-canvas data-fragment-id="def-456" data-width="800" data-height="600"></embedded-canvas>';
      const markdown = exporter.export(html);

      expect(markdown).toContain('![canvas:def-456:800x600]');
    });

    it('should preserve fragment ID with UUID format', () => {
      const uuid = 'a1b2c3d4-e5f6-4789-abcd-ef0123456789';
      const html = `<embedded-canvas data-fragment-id="${uuid}" data-width="600" data-height="400"></embedded-canvas>`;
      const markdown = exporter.export(html);

      expect(markdown).toContain(`![canvas:${uuid}:600x400]`);
    });

    it('should handle multiple embedded canvases', () => {
      const html = `
        <p>First canvas:</p>
        <embedded-canvas data-fragment-id="canvas-1" data-width="600" data-height="400"></embedded-canvas>
        <p>Second canvas:</p>
        <embedded-canvas data-fragment-id="canvas-2" data-width="400" data-height="300"></embedded-canvas>
      `;
      const markdown = exporter.export(html);

      expect(markdown).toContain('![canvas:canvas-1:600x400]');
      expect(markdown).toContain('![canvas:canvas-2:400x300]');
    });

    it('should not export embedded canvas without fragment ID', () => {
      const html = '<embedded-canvas data-width="600" data-height="400"></embedded-canvas>';
      const markdown = exporter.export(html);

      expect(markdown).not.toContain('![canvas:');
    });
  });

  describe('Markdown Import Pattern', () => {
    // Test the regex pattern used in the markdown-it plugin
    const EMBEDDED_CANVAS_REGEX = /^canvas:([a-f0-9-]+):(\d+)x(\d+)$/;

    it('should match valid embedded canvas syntax', () => {
      const content = 'canvas:abc-123:600x400';
      const match = content.match(EMBEDDED_CANVAS_REGEX);

      expect(match).not.toBeNull();
      expect(match[1]).toBe('abc-123');
      expect(match[2]).toBe('600');
      expect(match[3]).toBe('400');
    });

    it('should match UUID fragment IDs', () => {
      const content = 'canvas:a1b2c3d4-e5f6-4789-abcd-ef0123456789:800x600';
      const match = content.match(EMBEDDED_CANVAS_REGEX);

      expect(match).not.toBeNull();
      expect(match[1]).toBe('a1b2c3d4-e5f6-4789-abcd-ef0123456789');
    });

    it('should not match canvas links (no dimensions)', () => {
      const content = 'My Canvas';
      const match = content.match(EMBEDDED_CANVAS_REGEX);

      expect(match).toBeNull();
    });

    it('should not match invalid fragment IDs', () => {
      const content = 'canvas:INVALID_ID:600x400';
      const match = content.match(EMBEDDED_CANVAS_REGEX);

      expect(match).toBeNull(); // Uppercase not allowed
    });
  });

  describe('Markdown Round-trip', () => {
    let exporter;

    beforeEach(() => {
      exporter = new MarkdownExporter();
    });

    it('should export and format correctly for re-import', () => {
      const html = '<embedded-canvas data-fragment-id="test-uuid-1234" data-width="600" data-height="400"></embedded-canvas>';
      const markdown = exporter.export(html);

      // The exported markdown should be in the correct format
      expect(markdown.trim()).toBe('![canvas:test-uuid-1234:600x400]');
    });

    it('should preserve dimensions through export', () => {
      const testCases = [
        { width: '200', height: '150' },
        { width: '600', height: '400' },
        { width: '1200', height: '800' }
      ];

      for (const { width, height } of testCases) {
        const html = `<embedded-canvas data-fragment-id="test" data-width="${width}" data-height="${height}"></embedded-canvas>`;
        const markdown = exporter.export(html);

        expect(markdown).toContain(`${width}x${height}`);
      }
    });
  });
});

describe('Embedded Canvas vs Canvas Link Distinction', () => {
  describe('Pattern Matching', () => {
    // Embedded canvas: ![canvas:uuid:WxH] - creates inline editable canvas
    // Canvas link: ![Canvas Name] - links to existing .canvas file

    it('should distinguish embedded canvas from canvas link', () => {
      const embeddedPattern = /!\[canvas:([a-f0-9-]+):(\d+)x(\d+)\]/;
      const canvasLinkPattern = /!\[([^\[\]]+)\](?!\()/;

      const embeddedSyntax = '![canvas:abc-123:600x400]';
      const canvasLinkSyntax = '![My Canvas]';

      // Embedded canvas should match the specific pattern
      expect(embeddedPattern.test(embeddedSyntax)).toBe(true);
      expect(embeddedPattern.test(canvasLinkSyntax)).toBe(false);

      // Canvas link should match the general pattern but not embedded canvas format
      // (The actual plugin checks for "canvas:" prefix to distinguish)
    });

    it('should not confuse embedded canvas with images', () => {
      const embeddedPattern = /!\[canvas:([a-f0-9-]+):(\d+)x(\d+)\]/;
      const imageSyntax = '![alt text](http://example.com/image.png)';

      expect(embeddedPattern.test(imageSyntax)).toBe(false);
    });

    it('should not confuse embedded canvas with wiki embeds', () => {
      const embeddedPattern = /!\[canvas:([a-f0-9-]+):(\d+)x(\d+)\]/;
      const wikiEmbedSyntax = '![[Note Name]]';

      expect(embeddedPattern.test(wikiEmbedSyntax)).toBe(false);
    });
  });
});

describe('UUID Generation', () => {
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  it('should generate valid UUID v4 format', () => {
    const uuid = generateUUID();

    // UUID v4 format validation
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('should always have 4 in the version position', () => {
    for (let i = 0; i < 100; i++) {
      const uuid = generateUUID();
      expect(uuid[14]).toBe('4');
    }
  });

  it('should always have 8, 9, a, or b in the variant position', () => {
    for (let i = 0; i < 100; i++) {
      const uuid = generateUUID();
      expect(['8', '9', 'a', 'b']).toContain(uuid[19]);
    }
  });

  it('should generate unique IDs', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(generateUUID());
    }
    expect(ids.size).toBe(1000);
  });
});
