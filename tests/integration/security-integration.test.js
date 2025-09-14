import { describe, it, expect, beforeEach, vi } from 'vitest';
import { canvasManager } from '../../src/core/canvas/manager.js';
import { sanitizeHtml, isValidCanvasData, isValidFilePath } from '../../src/core/security/index.js';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke
}));

// Mock DOMPurify
global.DOMPurify = {
  sanitize: (html, config) => {
    return html
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/javascript:/gi, '');
  },
  isSupported: true
};

describe('Security Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear canvas cache
    canvasManager.clearCache();
  });

  describe('Canvas Security Integration', () => {
    it('should validate canvas data when loading from file', async () => {
      const maliciousCanvasContent = JSON.stringify({
        nodes: [
          {
            id: '<script>alert("xss")</script>',
            type: 'text',
            x: 0,
            y: 0,
            text: '<img src=x onerror="steal()">'
          }
        ],
        edges: []
      });

      mockInvoke.mockResolvedValueOnce(maliciousCanvasContent);

      // This should either reject the malicious data or sanitize it
      const result = await canvasManager.loadCanvas('/test/malicious.canvas');
      
      expect(result).toBeDefined();
      expect(result.nodes).toBeDefined();
      
      // The malicious script should be removed or sanitized
      if (result.nodes.length > 0) {
        expect(result.nodes[0].id).not.toContain('<script>');
        expect(result.nodes[0].text).not.toContain('onerror');
      }
    });

    it('should prevent saving malicious canvas data', async () => {
      const maliciousCanvas = {
        nodes: [
          {
            id: 'node1<script>alert("xss")</script>',
            type: 'text',
            x: 0,
            y: 0,
            text: 'Normal text'
          }
        ],
        edges: []
      };

      // This should either throw an error or sanitize the data
      await expect(async () => {
        await canvasManager.saveCanvas('/test/malicious.canvas', maliciousCanvas);
      }).rejects.toThrow('Invalid canvas data');
    });

    it('should validate file paths in canvas operations', async () => {
      const maliciousPath = '../../../etc/passwd';
      
      // Should reject dangerous paths
      await expect(async () => {
        await canvasManager.createCanvas('/workspace', maliciousPath);
      }).rejects.toThrow('Invalid');

      await expect(async () => {
        await canvasManager.loadCanvas(maliciousPath);
      }).rejects.toThrow('Invalid canvas path');
    });

    it('should sanitize canvas node text content', async () => {
      const canvasWithMaliciousText = {
        nodes: [
          {
            id: 'node1',
            type: 'text',
            x: 0,
            y: 0,
            text: '<script>alert("xss")</script>Hello World'
          }
        ],
        edges: []
      };

      mockInvoke.mockResolvedValueOnce('success');

      // The canvas manager should sanitize the text before saving
      await canvasManager.saveCanvas('/test/safe.canvas', canvasWithMaliciousText);
      
      // Verify the sanitization happened in the save call
      const savedContent = mockInvoke.mock.calls[0][1].content;
      const parsedContent = JSON.parse(savedContent);
      
      expect(parsedContent.nodes[0].text).not.toContain('<script>');
      expect(parsedContent.nodes[0].text).toContain('Hello World');
    });
  });

  describe('Cross-Component Security Integration', () => {
    it('should consistently validate file paths across all components', () => {
      const testPaths = [
        '../../../etc/passwd',
        '~/sensitive/file',
        '/valid/path/file.txt',
        'C:\\Windows\\System32\\evil.exe',
        '/workspace/valid/file.md'
      ];

      testPaths.forEach(path => {
        const isValid = isValidFilePath(path);
        
        if (path.includes('../') || path.includes('~') || path.includes('System32')) {
          expect(isValid).toBe(false);
        } else if (path.startsWith('/valid') || path.startsWith('/workspace')) {
          expect(isValid).toBe(true);
        }
      });
    });

    it('should consistently sanitize HTML across all components', () => {
      const testHTML = [
        '<script>alert("xss")</script>Hello',
        '<img src=x onerror="steal()">',
        '<div onclick="evil()">Content</div>',
        '<p>Safe content</p>',
        '<a href="javascript:bad()">Link</a>'
      ];

      testHTML.forEach(html => {
        const sanitized = sanitizeHtml(html);
        
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('onerror');
        expect(sanitized).not.toContain('onclick');
        expect(sanitized).not.toContain('javascript:');
        
        // But should preserve safe content
        if (html.includes('Hello')) {
          expect(sanitized).toContain('Hello');
        }
        if (html.includes('Safe content')) {
          expect(sanitized).toContain('Safe content');
        }
      });
    });

    it('should validate complex nested data structures', () => {
      const complexCanvas = {
        nodes: [
          {
            id: 'node1',
            type: 'text',
            x: 0,
            y: 0,
            children: [
              {
                id: '<script>nested_xss()</script>',
                text: 'Nested content'
              }
            ]
          }
        ],
        edges: [
          {
            id: 'edge1',
            fromNode: 'node1',
            toNode: '<img src=x onerror="edge_xss()">'
          }
        ]
      };

      const isValid = isValidCanvasData(complexCanvas);
      expect(isValid).toBe(false); // Should reject malicious nested content
    });
  });

  describe('Performance and Denial of Service Protection', () => {
    it('should handle large canvas data without crashing', () => {
      const largeCanvas = {
        nodes: Array(2000).fill(null).map((_, i) => ({
          id: `node${i}`,
          type: 'text',
          x: i * 10,
          y: i * 10,
          text: `Node ${i}`
        })),
        edges: []
      };

      const isValid = isValidCanvasData(largeCanvas);
      expect(isValid).toBe(false); // Should reject excessively large data
    });

    it('should handle deeply nested malicious content', () => {
      const deeplyNested = {
        nodes: [{
          id: 'node1',
          type: 'text',
          data: {
            level1: {
              level2: {
                level3: {
                  malicious: '<script>deep_xss()</script>'
                }
              }
            }
          }
        }],
        edges: []
      };

      const isValid = isValidCanvasData(deeplyNested);
      // Should either be invalid or the malicious content should be sanitized
      expect(isValid).toBe(false);
    });

    it('should limit string lengths to prevent DoS', () => {
      const longString = 'a'.repeat(100000);
      
      const canvasWithLongStrings = {
        nodes: [{
          id: 'node1',
          type: 'text',
          text: longString
        }],
        edges: []
      };

      const isValid = isValidCanvasData(canvasWithLongStrings);
      expect(isValid).toBe(false); // Should reject overly long strings
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle circular references safely', () => {
      const circularCanvas = {
        nodes: [],
        edges: []
      };
      
      // Create circular reference
      circularCanvas.self = circularCanvas;

      const isValid = isValidCanvasData(circularCanvas);
      expect(isValid).toBe(false); // Should handle circular refs without crashing
    });

    it('should handle malformed JSON gracefully', async () => {
      mockInvoke.mockResolvedValueOnce('{"nodes": [{"id": "unclosed"'); // Malformed JSON

      const result = await canvasManager.loadCanvas('/test/malformed.canvas');
      
      // Should return empty canvas instead of crashing
      expect(result).toBeDefined();
      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should handle null and undefined inputs gracefully', () => {
      expect(() => isValidCanvasData(null)).not.toThrow();
      expect(() => isValidCanvasData(undefined)).not.toThrow();
      expect(() => isValidFilePath(null)).not.toThrow();
      expect(() => isValidFilePath(undefined)).not.toThrow();
      
      expect(isValidCanvasData(null)).toBe(false);
      expect(isValidCanvasData(undefined)).toBe(false);
      expect(isValidFilePath(null)).toBe(false);
      expect(isValidFilePath(undefined)).toBe(false);
    });

    it('should maintain security under concurrent operations', async () => {
      const promises = [];
      
      // Simulate concurrent malicious operations
      for (let i = 0; i < 10; i++) {
        promises.push(canvasManager.loadCanvas(`/test/malicious${i}.canvas`));
      }
      
      mockInvoke.mockResolvedValue('{"nodes": [], "edges": []}');
      
      // All should complete without security breaches
      const results = await Promise.all(promises);
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result.nodes).toBeDefined();
        expect(result.edges).toBeDefined();
      });
    });
  });
});