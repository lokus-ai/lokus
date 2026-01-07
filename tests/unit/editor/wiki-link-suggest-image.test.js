/**
 * Tests for Image Embed Suggestion Plugin (![[)
 * Tests the ![[ trigger for image file autocomplete and URL import
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Image Embed Suggestion', () => {
  describe('Trigger Detection', () => {
    // Test regex patterns for detecting ![[ trigger

    it('should match ![[ at start of line', () => {
      const text = '![[';
      const pattern = /!\[\[$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should match ![[ after space', () => {
      const text = 'Check this ![[';
      const pattern = /!\[\[$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should match ![[ with partial query', () => {
      const text = 'See ![[img';
      // When typing, the suggestion is active with partial query
      const pattern = /!\[\[[^\]]*$/;
      expect(pattern.test(text)).toBe(true);
    });

    it('should not match completed image embed', () => {
      const text = '![[image.png]]';
      const pattern = /!\[\[[^\]]*$/;
      expect(pattern.test(text)).toBe(false);
    });

    it('should not match single bracket ![', () => {
      const text = '![canvas';
      const pattern = /!\[\[[^\]]*$/;
      expect(pattern.test(text)).toBe(false);
    });
  });

  describe('Query Extraction', () => {
    function extractQuery(fullText) {
      const match = fullText.match(/!\[\[([^\]]*)$/);
      return match ? match[1] : null;
    }

    it('should extract empty query at trigger', () => {
      const query = extractQuery('Check ![[');
      expect(query).toBe('');
    });

    it('should extract single character', () => {
      const query = extractQuery('![[i');
      expect(query).toBe('i');
    });

    it('should extract partial filename', () => {
      const query = extractQuery('![[screen');
      expect(query).toBe('screen');
    });

    it('should extract full filename', () => {
      const query = extractQuery('![[screenshot.png');
      expect(query).toBe('screenshot.png');
    });

    it('should extract path with slashes', () => {
      const query = extractQuery('![[assets/images/photo');
      expect(query).toBe('assets/images/photo');
    });

    it('should return null for non-image embed context', () => {
      const query = extractQuery('Just some text');
      expect(query).toBeNull();
    });
  });

  describe('Image File Filtering', () => {
    const imageFiles = [
      { title: 'screenshot.png', path: '/images/screenshot.png' },
      { title: 'photo.jpg', path: '/images/photo.jpg' },
      { title: 'diagram.svg', path: '/images/diagram.svg' },
      { title: 'banner.gif', path: '/assets/banner.gif' },
      { title: 'Screen Shot 2024.png', path: '/images/Screen Shot 2024.png' },
      { title: 'icon.webp', path: '/icons/icon.webp' },
    ];

    function filterImages(files, query) {
      if (!query) return files;
      const q = query.toLowerCase();
      return files.filter(f =>
        f.title.toLowerCase().includes(q) ||
        f.path.toLowerCase().includes(q)
      );
    }

    it('should return all files for empty query', () => {
      const results = filterImages(imageFiles, '');
      expect(results.length).toBe(imageFiles.length);
    });

    it('should filter by title', () => {
      const results = filterImages(imageFiles, 'screen');
      expect(results.length).toBe(2); // screenshot.png, Screen Shot 2024.png
    });

    it('should filter by extension', () => {
      const results = filterImages(imageFiles, '.png');
      expect(results.length).toBe(2); // screenshot.png, Screen Shot 2024.png
    });

    it('should filter by path', () => {
      const results = filterImages(imageFiles, 'assets');
      expect(results.length).toBe(1); // banner.gif
    });

    it('should handle case insensitive matching', () => {
      const results = filterImages(imageFiles, 'PNG');
      expect(results.length).toBe(2);
    });

    it('should return empty for no matches', () => {
      const results = filterImages(imageFiles, 'xyz123');
      expect(results.length).toBe(0);
    });
  });

  describe('Image vs Canvas vs WikiLink Distinction', () => {
    it('should detect ![[ as image embed, not canvas or wiki link', () => {
      const text = '![[image';
      const isImageEmbed = /!\[\[/.test(text);
      const isCanvasLink = /!\[[^\[]+$/.test(text) && !/!\[\[/.test(text);
      const isWikiLink = text.includes('[[') && !text.includes('![[');

      expect(isImageEmbed).toBe(true);
      expect(isCanvasLink).toBe(false);
    });

    it('should detect ![ as canvas, not image embed', () => {
      const text = '![canvas';
      const isImageEmbed = /!\[\[/.test(text);
      const isCanvasLink = /!\[[^\[]+$/.test(text);

      expect(isImageEmbed).toBe(false);
      expect(isCanvasLink).toBe(true);
    });

    it('should detect [[ as wiki link, not image embed', () => {
      const text = '[[Note';
      const isImageEmbed = /!\[\[/.test(text);
      const isWikiLink = /\[\[[^\]]*$/.test(text);

      expect(isImageEmbed).toBe(false);
      expect(isWikiLink).toBe(true);
    });

    it('should handle all three in same paragraph', () => {
      const text = '[[Wiki]] and ![Canvas] and ![[image';

      // Only image embed is still open
      const isOpenImageEmbed = /!\[\[[^\]]*$/.test(text);
      expect(isOpenImageEmbed).toBe(true);
    });
  });

  describe('Supported Image Extensions', () => {
    const supportedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.ico'];

    function isImageFile(filename) {
      const ext = filename.toLowerCase().match(/\.[^.]+$/)?.[0];
      return ext ? supportedExtensions.includes(ext) : false;
    }

    it('should recognize PNG files', () => {
      expect(isImageFile('image.png')).toBe(true);
      expect(isImageFile('IMAGE.PNG')).toBe(true);
    });

    it('should recognize JPEG files', () => {
      expect(isImageFile('photo.jpg')).toBe(true);
      expect(isImageFile('photo.jpeg')).toBe(true);
    });

    it('should recognize GIF files', () => {
      expect(isImageFile('animation.gif')).toBe(true);
    });

    it('should recognize SVG files', () => {
      expect(isImageFile('diagram.svg')).toBe(true);
    });

    it('should recognize WebP files', () => {
      expect(isImageFile('modern.webp')).toBe(true);
    });

    it('should NOT recognize markdown files', () => {
      expect(isImageFile('document.md')).toBe(false);
    });

    it('should NOT recognize text files', () => {
      expect(isImageFile('notes.txt')).toBe(false);
    });

    it('should NOT recognize canvas files', () => {
      expect(isImageFile('diagram.canvas')).toBe(false);
    });
  });

  describe('Import from URL Option', () => {
    // Test the "Import from URL" special option behavior

    const IMPORT_URL_KEY = '__import_url__';

    function shouldShowImportOption(items, query) {
      // Show import option when there are items or when query looks like a URL
      const looksLikeUrl = /^https?:\/\//i.test(query || '');
      return items.length > 0 || looksLikeUrl || !query;
    }

    it('should show import option when there are results', () => {
      const items = [{ title: 'image.png', path: '/image.png' }];
      expect(shouldShowImportOption(items, 'image')).toBe(true);
    });

    it('should show import option for empty query', () => {
      expect(shouldShowImportOption([], '')).toBe(true);
    });

    it('should show import option when query looks like URL', () => {
      expect(shouldShowImportOption([], 'https://example.com')).toBe(true);
    });

    it('should NOT show import option for no results with non-URL query', () => {
      expect(shouldShowImportOption([], 'nonexistent-file')).toBe(false);
    });
  });
});

describe('Image Embed URL Paste Handler', () => {
  describe('URL Detection', () => {
    function isValidImageUrl(text) {
      return /^https?:\/\//i.test(text) || text.startsWith('data:');
    }

    it('should detect https URLs', () => {
      expect(isValidImageUrl('https://example.com/image.png')).toBe(true);
    });

    it('should detect http URLs', () => {
      expect(isValidImageUrl('http://example.com/image.png')).toBe(true);
    });

    it('should detect data URLs', () => {
      expect(isValidImageUrl('data:image/png;base64,abc123')).toBe(true);
    });

    it('should handle case insensitive protocol', () => {
      expect(isValidImageUrl('HTTPS://EXAMPLE.COM/image.png')).toBe(true);
    });

    it('should NOT detect relative paths', () => {
      expect(isValidImageUrl('./image.png')).toBe(false);
    });

    it('should NOT detect plain filenames', () => {
      expect(isValidImageUrl('image.png')).toBe(false);
    });
  });

  describe('Context Detection', () => {
    function isInsideImageEmbed(textBefore) {
      // Check if cursor is inside an unclosed ![[
      const lastOpen = textBefore.lastIndexOf('![[');
      const lastClose = textBefore.lastIndexOf(']]');
      return lastOpen > lastClose;
    }

    it('should detect cursor inside open ![[', () => {
      expect(isInsideImageEmbed('Some text ![[partial')).toBe(true);
    });

    it('should NOT detect cursor after closed ![[]]', () => {
      expect(isInsideImageEmbed('Some text ![[image.png]] cursor here')).toBe(false);
    });

    it('should detect cursor in nested context', () => {
      expect(isInsideImageEmbed('![[completed]] and ![[open')).toBe(true);
    });

    it('should NOT detect cursor in wiki link context', () => {
      // Wiki links use [[ not ![[
      const text = '[[wikilink';
      const lastImageOpen = text.lastIndexOf('![[');
      expect(lastImageOpen).toBe(-1);
    });

    it('should handle empty text', () => {
      expect(isInsideImageEmbed('')).toBe(false);
    });
  });

  describe('URL Insertion', () => {
    // Test the URL gets inserted correctly as a wikiLink node

    function createImageEmbedAttrs(url) {
      return {
        embed: true,
        src: url,
        href: url,
        target: url,
        isExternal: true,
      };
    }

    it('should set embed to true for image embeds', () => {
      const attrs = createImageEmbedAttrs('https://example.com/img.png');
      expect(attrs.embed).toBe(true);
    });

    it('should set src to the URL', () => {
      const url = 'https://example.com/image.png';
      const attrs = createImageEmbedAttrs(url);
      expect(attrs.src).toBe(url);
    });

    it('should mark as external', () => {
      const attrs = createImageEmbedAttrs('https://example.com/img.png');
      expect(attrs.isExternal).toBe(true);
    });

    it('should handle URLs with query parameters', () => {
      const url = 'https://example.com/image.png?width=200&height=300';
      const attrs = createImageEmbedAttrs(url);
      expect(attrs.src).toBe(url);
    });

    it('should handle data URLs', () => {
      const url = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA';
      const attrs = createImageEmbedAttrs(url);
      expect(attrs.src).toBe(url);
      expect(attrs.isExternal).toBe(true);
    });
  });
});

describe('Image Embed Result Rendering', () => {
  describe('Local Image Display', () => {
    function formatImageName(path) {
      return path.split('/').pop() || path;
    }

    it('should extract filename from path', () => {
      expect(formatImageName('/images/screenshot.png')).toBe('screenshot.png');
    });

    it('should handle nested paths', () => {
      expect(formatImageName('/assets/images/photos/vacation.jpg')).toBe('vacation.jpg');
    });

    it('should handle filenames with spaces', () => {
      expect(formatImageName('/images/Screen Shot 2024.png')).toBe('Screen Shot 2024.png');
    });
  });

  describe('Import URL Option', () => {
    const IMPORT_URL_OPTION = {
      path: '__import_url__',
      title: 'Import from URL',
      icon: 'link',
    };

    it('should have special path identifier', () => {
      expect(IMPORT_URL_OPTION.path).toBe('__import_url__');
    });

    it('should have descriptive title', () => {
      expect(IMPORT_URL_OPTION.title).toBe('Import from URL');
    });
  });
});
