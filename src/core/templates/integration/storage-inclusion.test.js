import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TemplateManager } from '../manager.js';
import { TemplateStorage } from '../storage.js';
import { TemplateProcessor } from '../processor.js';

// Mock Tauri fs plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: {
    AppData: 'AppData'
  },
  writeTextFile: vi.fn(),
  readTextFile: vi.fn(),
  exists: vi.fn(),
  mkdir: vi.fn(),
  readDir: vi.fn(),
  remove: vi.fn()
}));

import * as fs from '@tauri-apps/plugin-fs';

describe('Template Storage and Inclusion Integration', () => {
  let manager;
  let storage;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup storage with mocks
    storage = new TemplateStorage();
    manager = new TemplateManager({ storage, autoSave: true });

    // Default mock responses
    fs.exists.mockResolvedValue(false);
    fs.readDir.mockResolvedValue([]);
  });

  describe('File-Based Storage Integration', () => {
    it('should initialize manager with file storage', async () => {
      const fileData = {
        version: '1.0.0',
        templates: [
          {
            id: 'test1',
            name: 'Test 1',
            content: 'Hello {{name}}',
            category: 'general',
            tags: []
          }
        ]
      };

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(fileData));

      await manager.initialize();

      expect(manager.size()).toBe(1);
      expect(manager.read('test1')).toBeDefined();
    });

    it('should auto-save on template creation', async () => {
      await manager.initialize();

      await manager.create({
        id: 'auto-save-test',
        name: 'Auto Save Test',
        content: 'Content: {{value}}'
      });

      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should auto-save on template update', async () => {
      await manager.initialize();

      await manager.create({
        id: 'update-test',
        name: 'Update Test',
        content: 'Original'
      });

      vi.clearAllMocks();

      await manager.update('update-test', {
        content: 'Updated content'
      });

      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should auto-save on template deletion', async () => {
      await manager.initialize();

      await manager.create({
        id: 'delete-test',
        name: 'Delete Test',
        content: 'Content'
      });

      vi.clearAllMocks();

      await manager.delete('delete-test');

      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should persist templates across restarts', async () => {
      // First session: create templates
      await manager.initialize();

      await manager.create({
        id: 'persist1',
        name: 'Persist 1',
        content: 'Content 1'
      });

      await manager.create({
        id: 'persist2',
        name: 'Persist 2',
        content: 'Content 2'
      });

      // Capture saved data
      const savedData = JSON.parse(fs.writeTextFile.mock.calls[0][1]);

      // Simulate restart: new manager instance
      const newManager = new TemplateManager({ storage: new TemplateStorage() });

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(savedData));

      await newManager.initialize();

      expect(newManager.size()).toBe(2);
      expect(newManager.read('persist1')).toBeDefined();
      expect(newManager.read('persist2')).toBeDefined();
    });
  });

  describe('Template Inclusion Integration', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should process templates with includes', async () => {
      // Create templates
      await manager.create({
        id: 'header',
        name: 'Header',
        content: '# {{title}}\nBy {{author}}'
      });

      await manager.create({
        id: 'document',
        name: 'Document',
        content: '{{include:header}}\n\n{{content}}'
      });

      // Process document with includes
      const result = await manager.process('document', {
        title: 'Test Document',
        author: 'Test Author',
        content: 'Document body content'
      });

      expect(result.result).toContain('# Test Document');
      expect(result.result).toContain('By Test Author');
      expect(result.result).toContain('Document body content');
    });

    it('should process nested includes', async () => {
      await manager.create({
        id: 'meta',
        name: 'Meta',
        content: 'Title: {{title}}, Date: {{date}}'
      });

      await manager.create({
        id: 'header',
        name: 'Header',
        content: '# Header\n{{include:meta}}'
      });

      await manager.create({
        id: 'page',
        name: 'Page',
        content: '{{include:header}}\n\nContent: {{content}}'
      });

      const result = await manager.process('page', {
        title: 'My Page',
        date: '2024-01-01',
        content: 'Page content'
      });

      expect(result.result).toContain('# Header');
      expect(result.result).toContain('Title: My Page');
      expect(result.result).toContain('Date: 2024-01-01');
      expect(result.result).toContain('Content: Page content');
    });

    it('should pass variables to included templates', async () => {
      await manager.create({
        id: 'greeting',
        name: 'Greeting',
        content: 'Hello {{name}}, you have {{count}} messages'
      });

      await manager.create({
        id: 'email',
        name: 'Email',
        content: '{{include:greeting:name=John,count=5}}\n\nBody: {{body}}'
      });

      const result = await manager.process('email', {
        body: 'Email content'
      });

      expect(result.result).toContain('Hello John');
      expect(result.result).toContain('you have 5 messages');
      expect(result.result).toContain('Body: Email content');
    });

    it('should save and load templates with includes', async () => {
      // Create templates with includes
      await manager.create({
        id: 'component',
        name: 'Component',
        content: 'Component: {{value}}'
      });

      await manager.create({
        id: 'main',
        name: 'Main',
        content: 'Main template\n{{include:component:value=Test}}'
      });

      // Capture saved data
      const savedData = JSON.parse(
        fs.writeTextFile.mock.calls[fs.writeTextFile.mock.calls.length - 1][1]
      );

      // Create new manager and load
      const newManager = new TemplateManager({ storage: new TemplateStorage() });

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(savedData));

      await newManager.initialize();

      // Process template with includes
      const result = await newManager.process('main', {});

      expect(result.result).toContain('Main template');
      expect(result.result).toContain('Component: Test');
    });
  });

  describe('Backup and Restore with Includes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should backup templates with includes', async () => {
      await manager.create({
        id: 'include-test',
        name: 'Include Test',
        content: '{{include:other}}'
      });

      await manager.create({
        id: 'other',
        name: 'Other',
        content: 'Other content'
      });

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));

      const backup = await manager.backup();

      expect(backup.success).toBe(true);
      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should restore templates and process includes', async () => {
      const backupData = {
        version: '1.0.0',
        templates: [
          {
            id: 'part',
            name: 'Part',
            content: 'Part: {{value}}'
          },
          {
            id: 'whole',
            name: 'Whole',
            content: '{{include:part:value=Restored}}'
          }
        ]
      };

      fs.readTextFile.mockResolvedValue(JSON.stringify(backupData));
      fs.exists.mockResolvedValue(true);

      await manager.restore('backup.json');

      expect(manager.size()).toBe(2);

      const result = await manager.process('whole', {});

      expect(result.result).toContain('Part: Restored');
    });
  });

  describe('Import/Export with Includes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should export templates with includes', async () => {
      await manager.create({
        id: 'export1',
        name: 'Export 1',
        content: '{{include:export2}}'
      });

      await manager.create({
        id: 'export2',
        name: 'Export 2',
        content: 'Content: {{data}}'
      });

      const exported = await manager.exportToFile();

      expect(exported.success).toBe(true);
      expect(exported.data.templates).toHaveLength(2);
    });

    it('should import and process templates with includes', async () => {
      const importData = {
        version: '1.0.0',
        templates: [
          {
            id: 'imported-base',
            name: 'Imported Base',
            content: 'Base: {{baseValue}}'
          },
          {
            id: 'imported-main',
            name: 'Imported Main',
            content: '{{include:imported-base:baseValue=ImportedValue}}'
          }
        ]
      };

      fs.readTextFile.mockResolvedValue(JSON.stringify(importData));

      const result = await manager.importFromFile('import.json', {
        overwrite: true
      });

      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);

      const processed = await manager.process('imported-main', {});

      expect(processed.result).toContain('Base: ImportedValue');
    });
  });

  describe('Complex Include Scenarios with Storage', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle document template system', async () => {
      // Create a complete document template system
      await manager.create({
        id: 'doc-meta',
        name: 'Document Meta',
        content: 'Title: {{title}}\nAuthor: {{author}}\nDate: {{date}}'
      });

      await manager.create({
        id: 'doc-header',
        name: 'Document Header',
        content: '# {{title}}\n\n{{include:doc-meta}}'
      });

      await manager.create({
        id: 'doc-section',
        name: 'Document Section',
        content: '## {{sectionTitle}}\n\n{{sectionContent}}'
      });

      await manager.create({
        id: 'doc-footer',
        name: 'Document Footer',
        content: '---\nPage {{pageNum}} | {{copyright}}'
      });

      await manager.create({
        id: 'full-document',
        name: 'Full Document',
        content: `{{include:doc-header}}

{{include:doc-section:sectionTitle=Introduction,sectionContent=Intro text}}

{{include:doc-section:sectionTitle=Body,sectionContent=Body text}}

{{include:doc-footer}}`
      });

      // Process the full document
      const result = await manager.process('full-document', {
        title: 'My Document',
        author: 'John Doe',
        date: '2024-01-01',
        pageNum: '1',
        copyright: '© 2024'
      });

      expect(result.result).toContain('# My Document');
      expect(result.result).toContain('Author: John Doe');
      expect(result.result).toContain('## Introduction');
      expect(result.result).toContain('Intro text');
      expect(result.result).toContain('## Body');
      expect(result.result).toContain('Body text');
      expect(result.result).toContain('Page 1');
      expect(result.result).toContain('© 2024');
    });

    it('should maintain template relationships after backup/restore', async () => {
      // Create related templates
      await manager.create({
        id: 'base',
        name: 'Base',
        content: 'Base: {{baseVar}}'
      });

      await manager.create({
        id: 'derived',
        name: 'Derived',
        content: '{{include:base}} - Derived: {{derivedVar}}'
      });

      // Backup
      fs.exists.mockResolvedValue(true);
      const backupData = JSON.stringify({
        version: '1.0.0',
        templates: [
          manager.read('base'),
          manager.read('derived')
        ]
      });

      fs.readTextFile.mockResolvedValue(backupData);

      // Clear and restore
      await manager.clear();
      expect(manager.size()).toBe(0);

      await manager.restore('backup.json');

      // Verify relationships still work
      const result = await manager.process('derived', {
        baseVar: 'BaseValue',
        derivedVar: 'DerivedValue'
      });

      expect(result.result).toContain('Base: BaseValue');
      expect(result.result).toContain('Derived: DerivedValue');
    });
  });

  describe('Error Recovery', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should handle missing included template gracefully', async () => {
      await manager.create({
        id: 'broken',
        name: 'Broken',
        content: '{{include:nonexistent}}'
      });

      await expect(
        manager.process('broken', {})
      ).rejects.toThrow();
    });

    it('should recover from save failures', async () => {
      fs.writeTextFile.mockRejectedValueOnce(new Error('Disk full'));

      await expect(
        manager.create({
          id: 'fail-test',
          name: 'Fail Test',
          content: 'Content'
        })
      ).rejects.toThrow();

      // Manager should still be functional
      fs.writeTextFile.mockResolvedValue(undefined);

      await manager.create({
        id: 'success-test',
        name: 'Success Test',
        content: 'Content'
      });

      expect(manager.read('success-test')).toBeDefined();
    });
  });

  describe('Performance with Storage', () => {
    it('should handle many templates efficiently', async () => {
      await manager.initialize();

      // Create many templates
      const startTime = Date.now();

      for (let i = 0; i < 20; i++) {
        await manager.create({
          id: `perf-${i}`,
          name: `Perf ${i}`,
          content: `Content {{var${i}}}`
        });
      }

      const createTime = Date.now() - startTime;

      // Should complete in reasonable time
      expect(createTime).toBeLessThan(5000);
      expect(manager.size()).toBe(20);
    });

    it('should handle complex include chains efficiently', async () => {
      await manager.initialize();

      // Create chain of includes
      await manager.create({
        id: 'chain-1',
        name: 'Chain 1',
        content: 'Level 1: {{include:chain-2}}'
      });

      await manager.create({
        id: 'chain-2',
        name: 'Chain 2',
        content: 'Level 2: {{include:chain-3}}'
      });

      await manager.create({
        id: 'chain-3',
        name: 'Chain 3',
        content: 'Level 3: {{value}}'
      });

      const startTime = Date.now();

      const result = await manager.process('chain-1', { value: 'Done' });

      const processTime = Date.now() - startTime;

      expect(result.result).toContain('Level 1');
      expect(result.result).toContain('Level 2');
      expect(result.result).toContain('Level 3: Done');
      expect(processTime).toBeLessThan(1000);
    });
  });

  describe('Storage Statistics with Includes', () => {
    beforeEach(async () => {
      await manager.initialize();
    });

    it('should provide comprehensive statistics', async () => {
      await manager.create({
        id: 'stats-1',
        name: 'Stats 1',
        content: '{{include:stats-2}}'
      });

      await manager.create({
        id: 'stats-2',
        name: 'Stats 2',
        content: 'Content'
      });

      fs.readDir.mockResolvedValue([
        { name: 'templates-backup-2024-01-01.json' }
      ]);

      const stats = await manager.getStorageStatistics();

      expect(stats.total).toBe(2);
      expect(stats.storage.type).toBe('file-based');
      expect(stats.storage.templates).toBe(2);
    });
  });
});
