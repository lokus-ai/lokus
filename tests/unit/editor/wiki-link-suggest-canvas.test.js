/**
 * Tests for Canvas Link Suggestion Plugin
 * Tests the ![ trigger and filtering behavior for canvas file autocomplete
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the file system operations
vi.mock('../../../src/services/FileService.js', () => ({
  default: {
    listFiles: vi.fn()
  }
}));

// Mock invoke for Tauri commands
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('Canvas Link Suggestion', () => {
  describe('Filtering Logic', () => {
    // Test the scoring/filtering algorithm used in the canvas suggestion plugin

    const canvasFiles = [
      { title: 'Lecture 1.canvas', path: '/notes/Lecture 1.canvas' },
      { title: 'Lecture 2.canvas', path: '/notes/Lecture 2.canvas' },
      { title: 'Lecture Notes Overview.canvas', path: '/notes/Lecture Notes Overview.canvas' },
      { title: 'Project Plan.canvas', path: '/projects/Project Plan.canvas' },
      { title: 'My Lecture.canvas', path: '/personal/My Lecture.canvas' },
      { title: 'Architecture.canvas', path: '/projects/Architecture.canvas' },
      { title: 'Daily Canvas.canvas', path: '/daily/Daily Canvas.canvas' }
    ];

    function scoreAndFilter(files, query) {
      const q = query.toLowerCase();
      const scored = files.map(f => {
        const fileName = f.title.toLowerCase().replace('.canvas', '');
        let score = -1;

        // Exact prefix match gets highest score
        if (fileName.startsWith(q)) {
          score = 1000;
        }
        // Contains in title gets medium score
        else if (fileName.includes(q)) {
          score = 100;
        }
        // Contains in path gets low score
        else if (f.path.toLowerCase().includes(q)) {
          score = 10;
        }

        return { ...f, score };
      });

      return scored
        .filter(f => f.score >= 0)
        .sort((a, b) => b.score - a.score);
    }

    it('should return all files for empty query', () => {
      const results = scoreAndFilter(canvasFiles, '');
      expect(results.length).toBe(canvasFiles.length);
    });

    it('should prioritize prefix matches over contains matches', () => {
      const results = scoreAndFilter(canvasFiles, 'lect');

      // "Lecture 1", "Lecture 2", "Lecture Notes Overview" should come first (prefix match)
      expect(results[0].title).toBe('Lecture 1.canvas');
      expect(results[1].title).toBe('Lecture 2.canvas');
      expect(results[2].title).toBe('Lecture Notes Overview.canvas');

      // "My Lecture" should come after (contains match)
      expect(results[3].title).toBe('My Lecture.canvas');
    });

    it('should filter out non-matching files', () => {
      const results = scoreAndFilter(canvasFiles, 'arch');

      // Only "Architecture" should match
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Architecture.canvas');
    });

    it('should handle case insensitive matching', () => {
      const results = scoreAndFilter(canvasFiles, 'LECTURE');

      expect(results.length).toBe(4); // Lecture 1, 2, Notes Overview, My Lecture
    });

    it('should match path when title does not match', () => {
      const files = [
        { title: 'Overview.canvas', path: '/lectures/week1/Overview.canvas' }
      ];

      const results = scoreAndFilter(files, 'week');

      expect(results.length).toBe(1);
      expect(results[0].score).toBe(10); // Path match score
    });

    it('should handle single character queries', () => {
      const results = scoreAndFilter(canvasFiles, 'l');

      // Should match files starting with 'l' first
      const prefixMatches = results.filter(r => r.score === 1000);
      expect(prefixMatches.length).toBeGreaterThan(0);
    });

    it('should handle multi-word queries', () => {
      const results = scoreAndFilter(canvasFiles, 'lecture notes');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Lecture Notes Overview.canvas');
    });

    it('should return empty array for no matches', () => {
      const results = scoreAndFilter(canvasFiles, 'xyz123');

      expect(results.length).toBe(0);
    });

    it('should handle special characters in query', () => {
      const files = [
        { title: 'Canvas (Draft).canvas', path: '/Canvas (Draft).canvas' },
        { title: 'Canvas - v2.canvas', path: '/Canvas - v2.canvas' }
      ];

      const results = scoreAndFilter(files, 'draft');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Canvas (Draft).canvas');
    });
  });

  describe('Trigger Detection', () => {
    // Test regex patterns for detecting ![ trigger

    it('should match ![ at start of line', () => {
      const text = '![';
      const pattern = /!\[[^\]]*$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should match ![ after space', () => {
      const text = 'Check this ![';
      const pattern = /!\[[^\]]*$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should match ![ with partial query', () => {
      const text = 'See ![Lect';
      const pattern = /!\[[^\]]*$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should match ![ with full name', () => {
      const text = '![Lecture 1 Canvas';
      const pattern = /!\[[^\]]*$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should not match completed canvas link', () => {
      const text = '![Canvas Name]';
      const pattern = /!\[[^\]]*$/;
      expect(pattern.test(text)).toBe(false);
    });

    it('should not match image syntax ![alt](url)', () => {
      const text = '![alt](http://example.com/img.png)';
      const pattern = /!\[[^\]]*$/;
      // This would match '![alt](http://example.com/img.png' if ] not closed
      // But typically the closing ] breaks the pattern
      expect(pattern.test(text)).toBe(false);
    });

    it('should not match wiki embed ![[', () => {
      const text = '![[Note';
      // This is a wiki embed pattern, handled separately
      const canvasPattern = /!\[[^\[]/;
      expect(canvasPattern.test(text)).toBe(false);
    });

    it('should extract query from ![ pattern', () => {
      const text = 'See ![Lecture 1';
      const match = text.match(/!\[([^\]]*)$/);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('Lecture 1');
    });

    it('should handle empty query', () => {
      const text = 'Check ![';
      const match = text.match(/!\[([^\]]*)$/);
      expect(match).not.toBeNull();
      expect(match[1]).toBe('');
    });
  });

  describe('Wiki Link vs Canvas Link Distinction', () => {
    // Ensure wiki links [[ and canvas links ![ don't conflict

    it('should detect [[ as wiki link, not canvas link', () => {
      const text = '[[Note';
      const isWikiLink = text.includes('[[');
      const isCanvasLink = /!\[[^\]]*$/.test(text);

      expect(isWikiLink).toBe(true);
      expect(isCanvasLink).toBe(false);
    });

    it('should detect ![ as canvas link, not wiki link', () => {
      const text = '![Canvas';
      const isExactWikiLink = text.slice(-2) === '[[' || text.includes('[[');
      const isCanvasLink = /!\[[^\]]*$/.test(text);

      expect(isCanvasLink).toBe(true);
    });

    it('should handle both in same paragraph', () => {
      const text = 'See [[Wiki Note]] and also ![Canvas';

      // Canvas link is still open
      const isOpenCanvasLink = /!\[[^\]]*$/.test(text);
      expect(isOpenCanvasLink).toBe(true);
    });

    it('should not trigger wiki link autocomplete for ![ prefix', () => {
      // The fix: exact match textBefore === '[[' instead of endsWith('[')
      const textBefore = '![';
      const isWikiLinkTrigger = textBefore === '[[';

      expect(isWikiLinkTrigger).toBe(false);
    });
  });

  describe('List Item Behavior', () => {
    // Canvas links should not trigger in list items

    const testAllowInNode = (nodeType) => {
      // Simulates the allow() check
      const isInList = nodeType === 'listItem' || nodeType === 'taskItem';
      return !isInList;
    };

    it('should allow in paragraph', () => {
      expect(testAllowInNode('paragraph')).toBe(true);
    });

    it('should allow in heading', () => {
      expect(testAllowInNode('heading')).toBe(true);
    });

    it('should not allow in listItem', () => {
      expect(testAllowInNode('listItem')).toBe(false);
    });

    it('should not allow in taskItem', () => {
      expect(testAllowInNode('taskItem')).toBe(false);
    });

    it('should allow in blockquote', () => {
      expect(testAllowInNode('blockquote')).toBe(true);
    });
  });

  describe('Query Extraction', () => {
    // Test extracting the search query from cursor position

    function extractQuery(fullText, cursorOffset) {
      const textBefore = fullText.slice(0, cursorOffset);
      const match = textBefore.match(/!\[([^\]]*)$/);
      return match ? match[1] : null;
    }

    it('should extract empty query at trigger', () => {
      const query = extractQuery('Check ![', 8);
      expect(query).toBe('');
    });

    it('should extract single character', () => {
      const query = extractQuery('Check ![L', 9);
      expect(query).toBe('L');
    });

    it('should extract partial word', () => {
      const query = extractQuery('Check ![Lect', 12);
      expect(query).toBe('Lect');
    });

    it('should extract full word', () => {
      const query = extractQuery('Check ![Lecture', 15);
      expect(query).toBe('Lecture');
    });

    it('should extract multi-word query', () => {
      const query = extractQuery('![Lecture 1 Notes', 17);
      expect(query).toBe('Lecture 1 Notes');
    });

    it('should handle query with special characters', () => {
      const query = extractQuery('![Canvas (Draft) - v2', 21);
      expect(query).toBe('Canvas (Draft) - v2');
    });

    it('should return null for non-canvas context', () => {
      const query = extractQuery('Just some text', 14);
      expect(query).toBeNull();
    });
  });

  describe('Result Limiting', () => {
    // Test that results are limited to prevent UI overflow

    function limitResults(results, max = 30) {
      return results.slice(0, max);
    }

    it('should limit results to 30 by default', () => {
      const manyFiles = Array.from({ length: 50 }, (_, i) => ({
        title: `Canvas ${i}.canvas`,
        path: `/Canvas ${i}.canvas`
      }));

      const limited = limitResults(manyFiles);
      expect(limited.length).toBe(30);
    });

    it('should not modify results under limit', () => {
      const fewFiles = Array.from({ length: 10 }, (_, i) => ({
        title: `Canvas ${i}.canvas`,
        path: `/Canvas ${i}.canvas`
      }));

      const limited = limitResults(fewFiles);
      expect(limited.length).toBe(10);
    });

    it('should preserve order when limiting', () => {
      const files = [
        { title: 'A.canvas', path: '/A.canvas', score: 1000 },
        { title: 'B.canvas', path: '/B.canvas', score: 100 },
        { title: 'C.canvas', path: '/C.canvas', score: 10 }
      ];

      const limited = limitResults(files, 2);
      expect(limited[0].title).toBe('A.canvas');
      expect(limited[1].title).toBe('B.canvas');
    });
  });
});

describe('Canvas Link Node Creation', () => {
  // Test the structure of the canvas link node that gets created

  describe('Node Attributes', () => {
    const createCanvasLinkAttrs = (canvas) => ({
      href: canvas.path,
      title: canvas.title.replace('.canvas', ''),
      class: 'canvas-link'
    });

    it('should set href to canvas path', () => {
      const canvas = { title: 'My Canvas.canvas', path: '/canvases/My Canvas.canvas' };
      const attrs = createCanvasLinkAttrs(canvas);

      expect(attrs.href).toBe('/canvases/My Canvas.canvas');
    });

    it('should strip .canvas extension from title', () => {
      const canvas = { title: 'Project Plan.canvas', path: '/Project Plan.canvas' };
      const attrs = createCanvasLinkAttrs(canvas);

      expect(attrs.title).toBe('Project Plan');
    });

    it('should set canvas-link class', () => {
      const canvas = { title: 'Test.canvas', path: '/Test.canvas' };
      const attrs = createCanvasLinkAttrs(canvas);

      expect(attrs.class).toBe('canvas-link');
    });

    it('should handle titles with multiple dots', () => {
      const canvas = { title: 'Draft.v2.canvas', path: '/Draft.v2.canvas' };
      const attrs = createCanvasLinkAttrs(canvas);

      // Only remove .canvas extension, not all dots
      expect(attrs.title).toBe('Draft.v2');
    });

    it('should handle paths with spaces', () => {
      const canvas = {
        title: 'Lecture 1 Notes.canvas',
        path: '/My Notes/Lecture 1 Notes.canvas'
      };
      const attrs = createCanvasLinkAttrs(canvas);

      expect(attrs.href).toBe('/My Notes/Lecture 1 Notes.canvas');
      expect(attrs.title).toBe('Lecture 1 Notes');
    });
  });
});
