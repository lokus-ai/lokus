/**
 * Tests for Canvas Preview Generator
 * Tests SVG generation from Excalidraw canvas files
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the canvas manager
vi.mock('../../../src/core/canvas/manager.js', () => ({
  canvasManager: {
    loadCanvas: vi.fn()
  }
}));

// Import after mocking
import {
  generatePreview,
  getCachedPreview,
  invalidateCache,
  clearAllCache,
  getCacheStats
} from '../../../src/core/canvas/preview-generator.js';
import { canvasManager } from '../../../src/core/canvas/manager.js';

describe('Canvas Preview Generator', () => {
  beforeEach(() => {
    clearAllCache();
    vi.clearAllMocks();
  });

  describe('Cache Management', () => {
    it('should return null for uncached path', () => {
      const result = getCachedPreview('/nonexistent/path.excalidraw');
      expect(result).toBeNull();
    });

    it('should invalidate cache entry', () => {
      const removed = invalidateCache('/some/path.excalidraw');
      expect(removed).toBe(false); // Nothing to remove
    });

    it('should clear all cache entries', () => {
      const count = clearAllCache();
      expect(count).toBe(0);
    });

    it('should return cache statistics', () => {
      const stats = getCacheStats();
      expect(stats).toHaveProperty('totalEntries');
      expect(stats).toHaveProperty('validEntries');
      expect(stats).toHaveProperty('expiredEntries');
      expect(stats).toHaveProperty('cacheTtlMs');
      expect(stats.cacheTtlMs).toBe(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('generatePreview', () => {
    it('should return error SVG for invalid canvas path', async () => {
      const result = await generatePreview('');
      // Should return error SVG data URL
      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('Preview Error');
    });

    it('should generate preview for empty canvas', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: []
      });

      const result = await generatePreview('/test/empty.excalidraw');

      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('Empty Canvas');
    });

    it('should generate preview for canvas with rectangle element', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 100,
            y: 100,
            width: 200,
            height: 100,
            strokeColor: '#e1e1e1',
            backgroundColor: 'transparent',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/shapes.excalidraw');

      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('<rect');
    });

    it('should cache preview after generation', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: []
      });

      await generatePreview('/test/cached.excalidraw');

      // Second call should return cached result
      const cached = getCachedPreview('/test/cached.excalidraw');
      expect(cached).not.toBeNull();
      expect(cached).toContain('data:image/svg+xml;base64,');
    });

    it('should filter out deleted elements', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            isDeleted: true
          }
        ]
      });

      const result = await generatePreview('/test/deleted.excalidraw');
      // Deleted element means canvas is effectively empty
      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('Empty Canvas');
    });
  });

  describe('Shape Conversion', () => {
    it('should convert rectangle shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'rect1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 200,
            height: 100,
            strokeColor: '#e1e1e1',
            backgroundColor: 'transparent',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/rect.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<rect');
    });

    it('should convert ellipse shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'ellipse1',
            type: 'ellipse',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            backgroundColor: 'transparent',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/ellipse.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<ellipse');
    });

    it('should convert diamond shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'diamond1',
            type: 'diamond',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            backgroundColor: 'transparent',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/diamond.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<polygon');
    });

    it('should convert text shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'text1',
            type: 'text',
            x: 100,
            y: 100,
            width: 200,
            height: 30,
            text: 'Test Label',
            strokeColor: '#e1e1e1',
            fontSize: 20,
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/text.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<text');
      expect(svg).toContain('Test Label');
    });

    it('should convert arrow shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'arrow1',
            type: 'arrow',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            points: [[0, 0], [100, 50]],
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/arrow.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<path');
      expect(svg).toContain('<polygon'); // arrowhead
    });

    it('should convert line shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'line1',
            type: 'line',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            points: [[0, 0], [100, 50]],
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/line.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<path');
    });

    it('should convert freedraw shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'freedraw1',
            type: 'freedraw',
            x: 0,
            y: 0,
            width: 100,
            height: 50,
            points: [[0, 0], [10, 10], [20, 5]],
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/freedraw.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<path');
    });
  });

  describe('SVG Structure', () => {
    it('should have dark background in generated SVG', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/bg.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('#1e1e2e'); // Dark background color
    });

    it('should include viewBox in generated SVG', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/viewbox.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('viewBox');
    });

    it('should use stroke color from element', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#ff0000',
            backgroundColor: 'transparent',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/stroke.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('#ff0000');
    });
  });

  describe('Bounds Calculation', () => {
    it('should add padding to bounds', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'el1',
            type: 'rectangle',
            x: 0,
            y: 0,
            width: 100,
            height: 100,
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/padding.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      // viewBox should include padding (larger than 100x100)
      expect(svg).toContain('viewBox');
    });

    it('should calculate correct bounds for freedraw shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        elements: [
          {
            id: 'freedraw1',
            type: 'freedraw',
            x: 100,
            y: 100,
            width: 100,
            height: 100,
            points: [
              [0, 0],
              [50, -50],
              [100, 25]
            ],
            strokeColor: '#e1e1e1',
            isDeleted: false
          }
        ]
      });

      const result = await generatePreview('/test/bounds.excalidraw');
      expect(result).toContain('data:image/svg+xml;base64,');
    });
  });

  describe('Error Handling', () => {
    it('should return error SVG when canvas load fails', async () => {
      canvasManager.loadCanvas.mockRejectedValue(new Error('File not found'));

      const result = await generatePreview('/test/error.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('Preview Error');
    });

    it('should handle invalid canvas data structure (null)', async () => {
      canvasManager.loadCanvas.mockResolvedValue(null);

      const result = await generatePreview('/test/invalid.excalidraw');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('Preview Error');
    });

    it('should handle canvas with no elements property', async () => {
      canvasManager.loadCanvas.mockResolvedValue({});

      const result = await generatePreview('/test/noelements.excalidraw');
      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('Empty Canvas');
    });
  });
});
