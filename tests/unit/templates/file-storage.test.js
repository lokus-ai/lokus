/**
 * Tests for File-Based Template Storage
 * Tests template storage as individual .md files with YAML frontmatter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileBasedTemplateStorage } from '../../../src/core/templates/file-storage.js';

// Mock Tauri fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  readDir: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  remove: vi.fn()
}));

import { readTextFile, writeTextFile, readDir, exists, mkdir, remove } from '@tauri-apps/plugin-fs';

describe('FileBasedTemplateStorage', () => {
  let storage;
  const testDir = '/test/templates';

  beforeEach(() => {
    storage = new FileBasedTemplateStorage({ templateDir: testDir });
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize storage and create directory if needed', async () => {
      exists.mockResolvedValue(false);
      mkdir.mockResolvedValue(undefined);
      readDir.mockResolvedValue([]);

      await storage.initialize();

      expect(storage.isInitialized()).toBe(true);
      expect(mkdir).toHaveBeenCalledWith(testDir, { recursive: true });
    });

    it('should load existing templates on initialization', async () => {
      exists.mockResolvedValue(true);
      readDir.mockResolvedValue([
        { name: 'test-template.md', isFile: true },
        { name: 'another-template.md', isFile: true }
      ]);
      readTextFile.mockResolvedValueOnce(`---
id: test-template
name: "Test Template"
category: Personal
tags:
  - test
createdAt: 2025-11-06T00:00:00.000Z
updatedAt: 2025-11-06T00:00:00.000Z
---

# Test Content`);
      readTextFile.mockResolvedValueOnce(`---
id: another-template
name: "Another Template"
category: Work
tags: []
createdAt: 2025-11-06T00:00:00.000Z
updatedAt: 2025-11-06T00:00:00.000Z
---

# Another Content`);

      await storage.initialize();

      const cache = storage.getCache();
      expect(cache.size).toBe(2);
      expect(cache.has('test-template')).toBe(true);
      expect(cache.has('another-template')).toBe(true);
    });
  });

  describe('Template Creation', () => {
    it('should save template as .md file with frontmatter', async () => {
      const template = {
        id: 'new-template',
        name: 'New Template',
        content: '# Hello World\n\nThis is a test.',
        category: 'Personal',
        tags: ['test', 'demo'],
        metadata: {
          createdAt: '2025-11-06T00:00:00.000Z',
          updatedAt: '2025-11-06T00:00:00.000Z'
        }
      };

      writeTextFile.mockResolvedValue(undefined);

      const result = await storage.saveTemplate(template);

      expect(result.success).toBe(true);
      expect(result.filepath).toBe(`${testDir}/new-template.md`);
      expect(writeTextFile).toHaveBeenCalledWith(
        `${testDir}/new-template.md`,
        expect.stringContaining('id: new-template')
      );
      expect(writeTextFile).toHaveBeenCalledWith(
        `${testDir}/new-template.md`,
        expect.stringContaining('# Hello World')
      );
    });

    it('should generate correct YAML frontmatter', async () => {
      const template = {
        id: 'test-id',
        name: 'Test Name',
        content: 'Content',
        category: 'Work',
        tags: ['tag1', 'tag2'],
        metadata: {
          createdAt: '2025-11-06T00:00:00.000Z'
        }
      };

      writeTextFile.mockResolvedValue(undefined);

      await storage.saveTemplate(template);

      const savedContent = writeTextFile.mock.calls[0][1];
      expect(savedContent).toMatch(/^---\n/);
      expect(savedContent).toContain('id: test-id');
      expect(savedContent).toContain('name: "Test Name"');
      expect(savedContent).toContain('category: Work');
      expect(savedContent).toContain('tags:');
      expect(savedContent).toContain('  - tag1');
      expect(savedContent).toContain('  - tag2');
      expect(savedContent).toContain('createdAt:');
      expect(savedContent).toContain('updatedAt:');
      expect(savedContent).toMatch(/---\n\nContent$/);
    });

    it('should sanitize template ID for filename', async () => {
      const template = {
        id: 'Test Template With Spaces!',
        name: 'Test',
        content: 'Content',
        category: 'Personal',
        tags: []
      };

      writeTextFile.mockResolvedValue(undefined);

      await storage.saveTemplate(template);

      expect(writeTextFile).toHaveBeenCalledWith(
        expect.stringContaining('Test-Template-With-Spaces-.md'),
        expect.any(String)
      );
    });
  });

  describe('Template Loading', () => {
    it('should load all .md files from directory', async () => {
      exists.mockResolvedValue(true);
      readDir.mockResolvedValue([
        { name: 'template1.md', isFile: true },
        { name: 'template2.md', isFile: true },
        { name: 'not-markdown.txt', isFile: true },
        { name: 'folder', isFile: false }
      ]);
      readTextFile.mockResolvedValue(`---
id: template1
name: "Template 1"
category: Personal
tags: []
createdAt: 2025-11-06T00:00:00.000Z
updatedAt: 2025-11-06T00:00:00.000Z
---

Content`);

      const result = await storage.load();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2); // Only .md files
      expect(readTextFile).toHaveBeenCalledTimes(2);
    });

    it('should parse frontmatter correctly', async () => {
      exists.mockResolvedValue(true);
      readDir.mockResolvedValue([{ name: 'test.md', isFile: true }]);
      readTextFile.mockResolvedValue(`---
id: test-id
name: "Test Template"
category: Work
tags:
  - important
  - work
createdAt: 2025-11-06T12:00:00.000Z
updatedAt: 2025-11-06T13:00:00.000Z
---

# Template Content

This is the body.`);

      await storage.load();

      const cache = storage.getCache();
      const template = cache.get('test-id');

      expect(template).toBeDefined();
      expect(template.id).toBe('test-id');
      expect(template.name).toBe('Test Template');
      expect(template.category).toBe('Work');
      expect(template.tags).toEqual(['important', 'work']);
      expect(template.content).toBe('# Template Content\n\nThis is the body.');
    });

    it('should handle templates without frontmatter', async () => {
      exists.mockResolvedValue(true);
      readDir.mockResolvedValue([{ name: 'plain.md', isFile: true }]);
      readTextFile.mockResolvedValue('# Plain Template\n\nNo frontmatter here.');

      await storage.load();

      const cache = storage.getCache();
      const template = cache.get('plain');

      expect(template).toBeDefined();
      expect(template.id).toBe('plain');
      expect(template.content).toBe('# Plain Template\n\nNo frontmatter here.');
    });
  });

  describe('Template Deletion', () => {
    it('should delete template file', async () => {
      exists.mockResolvedValue(true);
      remove.mockResolvedValue(undefined);

      const result = await storage.deleteTemplate('test-template');

      expect(result.success).toBe(true);
      expect(remove).toHaveBeenCalledWith(`${testDir}/test-template.md`);
    });

    it('should remove template from cache', async () => {
      exists.mockResolvedValue(true);
      remove.mockResolvedValue(undefined);

      // Add to cache first
      storage.cache.set('test-template', { id: 'test-template', name: 'Test' });

      await storage.deleteTemplate('test-template');

      expect(storage.cache.has('test-template')).toBe(false);
    });

    it('should succeed even if file does not exist', async () => {
      exists.mockResolvedValue(false);

      const result = await storage.deleteTemplate('non-existent');

      expect(result.success).toBe(true);
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe('Filename Generation', () => {
    it('should generate safe filenames', () => {
      expect(storage.generateFilename('simple')).toBe('simple.md');
      expect(storage.generateFilename('with-dashes')).toBe('with-dashes.md');
      expect(storage.generateFilename('With Spaces')).toBe('With-Spaces.md');
      expect(storage.generateFilename('special!@#$chars')).toBe('special----chars.md');
    });
  });

  describe('YAML Parsing', () => {
    it('should parse simple key-value pairs', () => {
      const yaml = 'key1: value1\nkey2: value2';
      const result = storage.parseFrontmatter(yaml);

      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
    });

    it('should parse quoted values', () => {
      const yaml = 'name: "Quoted Value"';
      const result = storage.parseFrontmatter(yaml);

      expect(result.name).toBe('Quoted Value');
    });

    it('should parse arrays', () => {
      const yaml = 'tags:\n  - tag1\n  - tag2\n  - tag3';
      const result = storage.parseFrontmatter(yaml);

      expect(result.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should parse empty arrays', () => {
      const yaml = 'tags: []';
      const result = storage.parseFrontmatter(yaml);

      expect(result.tags).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      exists.mockResolvedValue(true);
      readDir.mockResolvedValue([{ name: 'error.md', isFile: true }]);
      readTextFile.mockRejectedValue(new Error('Read failed'));

      // Should not throw
      const result = await storage.load();

      expect(result.success).toBe(true);
      expect(result.count).toBe(0); // No templates loaded due to error
    });

    it('should handle write errors', async () => {
      const template = {
        id: 'test',
        name: 'Test',
        content: 'Content',
        category: 'Personal',
        tags: []
      };

      writeTextFile.mockRejectedValue(new Error('Write failed'));

      await expect(storage.saveTemplate(template)).rejects.toThrow();
    });
  });
});
