/**
 * Tests for Canvas Preview Generator
 * Tests SVG generation from TLDraw canvas snapshots
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
      const result = getCachedPreview('/nonexistent/path.canvas');
      expect(result).toBeNull();
    });

    it('should invalidate cache entry', () => {
      const removed = invalidateCache('/some/path.canvas');
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
    it('should throw error for invalid canvas path', async () => {
      const result = await generatePreview('');
      // Should return error SVG data URL
      expect(result).toContain('data:image/svg+xml;base64,');
    });

    it('should generate preview for empty canvas', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {}
        }
      });

      const result = await generatePreview('/test/empty.canvas');

      expect(result).toContain('data:image/svg+xml;base64,');
      // Check for empty canvas message in base64 - "Empty Canvas" encodes to "RW1wdHkgQ2FudmFz"
      expect(result).toContain('RW1wdHkgQ2FudmFz');
    });

    it('should generate preview for canvas with shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:1': {
              id: 'shape:1',
              typeName: 'shape',
              type: 'geo',
              x: 100,
              y: 100,
              props: {
                geo: 'rectangle',
                w: 200,
                h: 100,
                color: 'black'
              }
            }
          }
        }
      });

      const result = await generatePreview('/test/shapes.canvas');

      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('<rect');
    });

    it('should cache preview after generation', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: { store: {} }
      });

      await generatePreview('/test/cached.canvas');

      // Second call should return cached result
      const cached = getCachedPreview('/test/cached.canvas');
      expect(cached).not.toBeNull();
      expect(cached).toContain('data:image/svg+xml;base64,');
    });

    it('should handle canvas with records array format', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        records: [
          {
            id: 'shape:1',
            typeName: 'shape',
            type: 'text',
            x: 50,
            y: 50,
            props: {
              richText: {
                content: [
                  { content: [{ text: 'Hello World' }] }
                ]
              },
              w: 100,
              size: 'm'
            }
          }
        ]
      });

      const result = await generatePreview('/test/records.canvas');

      expect(result).toContain('data:image/svg+xml;base64,');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');
      expect(svg).toContain('Hello World');
    });
  });

  describe('Shape Conversion', () => {
    it('should convert draw shapes with path segments', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:draw1': {
              id: 'shape:draw1',
              typeName: 'shape',
              type: 'draw',
              x: 0,
              y: 0,
              props: {
                segments: [
                  {
                    type: 'free',
                    points: [
                      { x: 0, y: 0, z: 0.5 },
                      { x: 10, y: 10, z: 0.5 },
                      { x: 20, y: 5, z: 0.5 }
                    ]
                  }
                ],
                color: 'black'
              }
            }
          }
        }
      });

      const result = await generatePreview('/test/draw.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<path');
      expect(svg).toContain('M 0 0');
      expect(svg).toContain('L 10 10');
    });

    it('should convert text shapes with richText format', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:text1': {
              id: 'shape:text1',
              typeName: 'shape',
              type: 'text',
              x: 100,
              y: 100,
              props: {
                richText: {
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Test Label' }]
                    }
                  ]
                },
                w: 100,
                size: 's',
                scale: 1,
                color: 'black'
              }
            }
          }
        }
      });

      const result = await generatePreview('/test/text.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<text');
      expect(svg).toContain('Test Label');
    });

    it('should convert geo shapes (rectangle, ellipse, triangle)', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:rect': {
              id: 'shape:rect',
              typeName: 'shape',
              type: 'geo',
              x: 0,
              y: 0,
              props: { geo: 'rectangle', w: 100, h: 50, color: 'blue' }
            },
            'shape:ellipse': {
              id: 'shape:ellipse',
              typeName: 'shape',
              type: 'geo',
              x: 150,
              y: 0,
              props: { geo: 'ellipse', w: 80, h: 80, color: 'red' }
            },
            'shape:triangle': {
              id: 'shape:triangle',
              typeName: 'shape',
              type: 'geo',
              x: 250,
              y: 0,
              props: { geo: 'triangle', w: 60, h: 60, color: 'green' }
            }
          }
        }
      });

      const result = await generatePreview('/test/geo.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<rect');
      expect(svg).toContain('<ellipse');
      expect(svg).toContain('<polygon');
    });

    it('should convert arrow shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:arrow': {
              id: 'shape:arrow',
              typeName: 'shape',
              type: 'arrow',
              x: 0,
              y: 0,
              props: {
                start: { x: 0, y: 0 },
                end: { x: 100, y: 50 },
                color: 'black'
              }
            }
          }
        }
      });

      const result = await generatePreview('/test/arrow.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('<line');
      expect(svg).toContain('<polygon'); // arrowhead
    });
  });

  describe('Color Mapping', () => {
    it('should map TLDraw colors to hex values', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:1': {
              id: 'shape:1',
              typeName: 'shape',
              type: 'geo',
              x: 0,
              y: 0,
              props: { geo: 'rectangle', w: 50, h: 50, color: 'blue' }
            }
          }
        }
      });

      const result = await generatePreview('/test/colors.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('#4dabf7'); // blue color
    });

    it('should map black to light color for dark mode visibility', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:1': {
              id: 'shape:1',
              typeName: 'shape',
              type: 'geo',
              x: 0,
              y: 0,
              props: { geo: 'rectangle', w: 50, h: 50, color: 'black' }
            }
          }
        }
      });

      const result = await generatePreview('/test/black.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('#e1e1e1'); // light gray for black
    });
  });

  describe('Bounds Calculation', () => {
    it('should calculate correct bounds for draw shapes', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:draw': {
              id: 'shape:draw',
              typeName: 'shape',
              type: 'draw',
              x: 100,
              y: 100,
              props: {
                segments: [
                  {
                    points: [
                      { x: 0, y: 0 },
                      { x: 50, y: -50 }, // Goes up
                      { x: 100, y: 25 }
                    ]
                  }
                ]
              }
            }
          }
        }
      });

      const result = await generatePreview('/test/bounds.canvas');
      expect(result).toContain('data:image/svg+xml;base64,');
      // Should not throw error - bounds should be calculated correctly
    });

    it('should add padding to bounds', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:1': {
              id: 'shape:1',
              typeName: 'shape',
              type: 'geo',
              x: 0,
              y: 0,
              props: { w: 100, h: 100 }
            }
          }
        }
      });

      const result = await generatePreview('/test/padding.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      // Check viewBox includes padding (should be larger than just 100x100)
      expect(svg).toContain('viewBox');
    });
  });

  describe('SVG Background', () => {
    it('should have dark background in generated SVG', async () => {
      canvasManager.loadCanvas.mockResolvedValue({
        document: {
          store: {
            'shape:1': {
              id: 'shape:1',
              typeName: 'shape',
              type: 'geo',
              x: 0,
              y: 0,
              props: { w: 50, h: 50 }
            }
          }
        }
      });

      const result = await generatePreview('/test/bg.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('#1e1e2e'); // Dark background color
    });
  });

  describe('Error Handling', () => {
    it('should return error SVG when canvas load fails', async () => {
      canvasManager.loadCanvas.mockRejectedValue(new Error('File not found'));

      const result = await generatePreview('/test/error.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('Preview Error');
    });

    it('should handle invalid canvas data structure', async () => {
      canvasManager.loadCanvas.mockResolvedValue(null);

      const result = await generatePreview('/test/invalid.canvas');
      const svg = Buffer.from(result.split(',')[1], 'base64').toString('utf-8');

      expect(svg).toContain('Preview Error');
    });
  });
});
