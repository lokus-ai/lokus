import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isValidFilePath,
  isValidCanvasData,
  isValidMarkdown,
  isValidSearchQuery,
  isRateLimited
} from '../../../../src/core/security/validator.js';

describe('Security Validator', () => {
  describe('isValidFilePath', () => {
    it('should accept valid file paths', () => {
      expect(isValidFilePath('/valid/path/to/file.txt')).toBe(true);
      expect(isValidFilePath('relative/path/file.md')).toBe(true);
      expect(isValidFilePath('simple-filename.json')).toBe(true);
      expect(isValidFilePath('/Users/user/Documents/notes.md')).toBe(true);
    });

    it('should reject directory traversal attempts', () => {
      expect(isValidFilePath('../../../etc/passwd')).toBe(false);
      expect(isValidFilePath('..\\..\\windows\\system32')).toBe(false);
      expect(isValidFilePath('/valid/path/../../../etc/passwd')).toBe(false);
    });

    it('should reject paths with dangerous characters', () => {
      expect(isValidFilePath('/path/with<script>alert("xss")</script>')).toBe(false);
      expect(isValidFilePath('/path/with>redirect')).toBe(false);
      expect(isValidFilePath('/path/with:colon')).toBe(false);
      expect(isValidFilePath('/path/with"quote')).toBe(false);
      expect(isValidFilePath('/path/with|pipe')).toBe(false);
      expect(isValidFilePath('/path/with?query')).toBe(false);
      expect(isValidFilePath('/path/with*wildcard')).toBe(false);
    });

    it('should reject home directory access attempts', () => {
      expect(isValidFilePath('~/sensitive/file')).toBe(false);
      expect(isValidFilePath('~root/.ssh/id_rsa')).toBe(false);
    });

    it('should handle null, undefined, and empty inputs', () => {
      expect(isValidFilePath(null)).toBe(false);
      expect(isValidFilePath(undefined)).toBe(false);
      expect(isValidFilePath('')).toBe(false);
    });

    it('should handle non-string inputs', () => {
      expect(isValidFilePath(123)).toBe(false);
      expect(isValidFilePath({})).toBe(false);
      expect(isValidFilePath([])).toBe(false);
    });

    it('should respect maximum path length', () => {
      const longPath = '/valid/path/' + 'a'.repeat(500) + '/file.txt';
      expect(isValidFilePath(longPath)).toBe(false);
    });

    it('should validate against base path when provided', () => {
      const basePath = '/allowed/workspace';
      expect(isValidFilePath('/allowed/workspace/file.txt', basePath)).toBe(true);
      expect(isValidFilePath('/allowed/workspace/subfolder/file.txt', basePath)).toBe(true);
      expect(isValidFilePath('/other/workspace/file.txt', basePath)).toBe(false);
    });
  });

  describe('isValidCanvasData', () => {
    it('should accept valid canvas data', () => {
      const validCanvas = {
        nodes: [
          { id: '1', type: 'text', x: 0, y: 0, width: 100, height: 50, text: 'Hello' }
        ],
        edges: [
          { id: '2', fromNode: '1', toNode: '3' }
        ],
        metadata: {
          version: '1.0.0',
          created: '2023-01-01T00:00:00Z'
        }
      };
      expect(isValidCanvasData(validCanvas)).toBe(true);
    });

    it('should accept empty canvas data', () => {
      const emptyCanvas = {
        nodes: [],
        edges: [],
        metadata: { version: '1.0.0' }
      };
      expect(isValidCanvasData(emptyCanvas)).toBe(true);
    });

    it('should reject canvas data without required properties', () => {
      expect(isValidCanvasData({})).toBe(false);
      expect(isValidCanvasData({ nodes: [] })).toBe(false);
      expect(isValidCanvasData({ edges: [] })).toBe(false);
    });

    it('should reject canvas data with non-array nodes or edges', () => {
      expect(isValidCanvasData({ nodes: 'not-array', edges: [] })).toBe(false);
      expect(isValidCanvasData({ nodes: [], edges: 'not-array' })).toBe(false);
    });

    it('should reject canvas data with too many nodes', () => {
      const tooManyNodes = {
        nodes: Array(1001).fill().map((_, i) => ({ id: i.toString(), type: 'text' })),
        edges: []
      };
      expect(isValidCanvasData(tooManyNodes)).toBe(false);
    });

    it('should reject canvas data with invalid node properties', () => {
      const invalidCanvas = {
        nodes: [
          { id: '<script>alert("xss")</script>', type: 'text', x: 0, y: 0 }
        ],
        edges: []
      };
      expect(isValidCanvasData(invalidCanvas)).toBe(false);
    });

    it('should handle null, undefined, and non-object inputs', () => {
      expect(isValidCanvasData(null)).toBe(false);
      expect(isValidCanvasData(undefined)).toBe(false);
      expect(isValidCanvasData('not-object')).toBe(false);
      expect(isValidCanvasData(123)).toBe(false);
    });
  });

  describe('isValidMarkdown', () => {
    it('should accept valid markdown', () => {
      expect(isValidMarkdown('# Hello World')).toBe(true);
      expect(isValidMarkdown('This is **bold** and *italic* text')).toBe(true);
      expect(isValidMarkdown('[Link](https://example.com)')).toBe(true);
      expect(isValidMarkdown('```js\nconsole.log("hello")\n```')).toBe(true);
    });

    it('should reject markdown with script tags', () => {
      expect(isValidMarkdown('# Hello <script>alert("xss")</script>')).toBe(false);
      expect(isValidMarkdown('Text with <script src="evil.js"></script>')).toBe(false);
    });

    it('should reject markdown with dangerous HTML', () => {
      expect(isValidMarkdown('<img src="x" onerror="alert(\'xss\')">')).toBe(false);
      expect(isValidMarkdown('<div onclick="steal()">Content</div>')).toBe(false);
    });

    it('should reject markdown with javascript: links', () => {
      expect(isValidMarkdown('[Click me](javascript:alert("xss"))')).toBe(false);
      expect(isValidMarkdown('<a href="javascript:evil()">Link</a>')).toBe(false);
    });

    it('should handle excessive content length', () => {
      const tooLong = 'a'.repeat(100001);
      expect(isValidMarkdown(tooLong)).toBe(false);
    });

    it('should handle null, undefined, and non-string inputs', () => {
      expect(isValidMarkdown(null)).toBe(false);
      expect(isValidMarkdown(undefined)).toBe(false);
      expect(isValidMarkdown(123)).toBe(false);
      expect(isValidMarkdown({})).toBe(false);
    });

    it('should accept empty strings', () => {
      expect(isValidMarkdown('')).toBe(true);
    });
  });

  describe('isValidSearchQuery', () => {
    it('should accept valid search queries', () => {
      expect(isValidSearchQuery('hello world')).toBe(true);
      expect(isValidSearchQuery('function getName()')).toBe(true);
      expect(isValidSearchQuery('class MyClass')).toBe(true);
      expect(isValidSearchQuery('"exact phrase"')).toBe(true);
    });

    it('should accept regex patterns', () => {
      expect(isValidSearchQuery('\\d+')).toBe(true);
      expect(isValidSearchQuery('[a-zA-Z]+')).toBe(true);
      expect(isValidSearchQuery('function.*\\{')).toBe(true);
    });

    it('should reject extremely long queries', () => {
      const tooLong = 'a'.repeat(1001);
      expect(isValidSearchQuery(tooLong)).toBe(false);
    });

    it('should reject queries with excessive nested groups', () => {
      const nestedGroups = '('.repeat(100) + ')'.repeat(100);
      expect(isValidSearchQuery(nestedGroups)).toBe(false);
    });

    it('should handle null, undefined, and non-string inputs', () => {
      expect(isValidSearchQuery(null)).toBe(false);
      expect(isValidSearchQuery(undefined)).toBe(false);
      expect(isValidSearchQuery(123)).toBe(false);
      expect(isValidSearchQuery({})).toBe(false);
    });

    it('should reject empty queries', () => {
      expect(isValidSearchQuery('')).toBe(false);
      expect(isValidSearchQuery('   ')).toBe(false);
    });
  });

  describe('isRateLimited', () => {
    beforeEach(() => {
      // Clear any existing rate limit data
      global.rateLimitStore = {};
    });

    it('should not rate limit initial requests', () => {
      expect(isRateLimited('user1', 'search')).toBe(false);
      expect(isRateLimited('user2', 'save')).toBe(false);
    });

    it('should rate limit after exceeding threshold', () => {
      // Simulate multiple rapid requests
      for (let i = 0; i < 100; i++) {
        isRateLimited('user1', 'search');
      }
      // Next request should be rate limited
      expect(isRateLimited('user1', 'search')).toBe(true);
    });

    it('should handle different action types separately', () => {
      // Max out search requests
      for (let i = 0; i < 100; i++) {
        isRateLimited('user1', 'search');
      }
      expect(isRateLimited('user1', 'search')).toBe(true);
      // But save requests should still work
      expect(isRateLimited('user1', 'save')).toBe(false);
    });

    it('should handle different users separately', () => {
      // Max out requests for user1
      for (let i = 0; i < 100; i++) {
        isRateLimited('user1', 'search');
      }
      expect(isRateLimited('user1', 'search')).toBe(true);
      // But user2 should not be affected
      expect(isRateLimited('user2', 'search')).toBe(false);
    });

    it('should handle invalid inputs', () => {
      expect(isRateLimited(null, 'search')).toBe(true);
      expect(isRateLimited(undefined, 'search')).toBe(true);
      expect(isRateLimited('user1', null)).toBe(true);
      expect(isRateLimited('user1', undefined)).toBe(true);
    });
  });
});