import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TemplateStorage } from './storage.js';

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

describe('TemplateStorage', () => {
  let storage;
  let mockTemplates;

  beforeEach(() => {
    storage = new TemplateStorage();
    mockTemplates = new Map([
      ['test1', { id: 'test1', name: 'Test 1', content: 'Content 1' }],
      ['test2', { id: 'test2', name: 'Test 2', content: 'Content 2' }]
    ]);

    // Reset all mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize storage successfully', async () => {
      fs.exists.mockResolvedValue(false);

      await storage.initialize();

      expect(storage.isInitialized()).toBe(true);
      expect(storage.getCache().size).toBe(0);
    });

    it('should load existing templates on initialization', async () => {
      const existingData = {
        version: '1.0.0',
        templates: [
          { id: 'test1', name: 'Test 1', content: 'Content 1' }
        ]
      };

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(existingData));

      await storage.initialize();

      expect(storage.getCache().size).toBe(1);
      expect(storage.getCache().get('test1')).toEqual(existingData.templates[0]);
    });
  });

  describe('Save and Load', () => {
    it('should save templates to file', async () => {
      fs.exists.mockResolvedValue(false);

      const result = await storage.save(mockTemplates);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(fs.writeTextFile).toHaveBeenCalled();

      const writeCall = fs.writeTextFile.mock.calls[0];
      const savedData = JSON.parse(writeCall[1]);
      expect(savedData.templates).toHaveLength(2);
      expect(savedData.version).toBe('1.0.0');
    });

    it('should load templates from file', async () => {
      const fileData = {
        version: '1.0.0',
        templates: [
          { id: 'test1', name: 'Test 1', content: 'Content 1' },
          { id: 'test2', name: 'Test 2', content: 'Content 2' }
        ]
      };

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(fileData));

      const result = await storage.load();

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.templates.size).toBe(2);
      expect(result.templates.get('test1').name).toBe('Test 1');
    });

    it('should handle missing file gracefully', async () => {
      fs.exists.mockResolvedValue(false);

      const result = await storage.load();

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.templates.size).toBe(0);
    });

    it('should update cache after save', async () => {
      fs.exists.mockResolvedValue(false);

      await storage.save(mockTemplates);

      const cache = storage.getCache();
      expect(cache.size).toBe(2);
      expect(cache.get('test1')).toEqual(mockTemplates.get('test1'));
    });
  });

  describe('Backup and Restore', () => {
    it('should create backup before saving', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue([]);

      await storage.save(mockTemplates);

      expect(fs.writeTextFile).toHaveBeenCalledTimes(2); // backup + save
    });

    it('should create backup with timestamp', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue([]);

      const result = await storage.backup();

      expect(result.success).toBe(true);
      expect(result.filename).toContain('templates-backup-');
      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should restore templates from backup', async () => {
      const backupData = {
        version: '1.0.0',
        templates: [
          { id: 'restored', name: 'Restored', content: 'Restored content' }
        ]
      };

      fs.readTextFile.mockResolvedValue(JSON.stringify(backupData));
      fs.exists.mockResolvedValue(true);
      fs.readDir.mockResolvedValue([]);

      const result = await storage.restore('backup-file.json');

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(storage.getCache().get('restored')).toBeDefined();
    });

    it('should list available backups', async () => {
      fs.readDir.mockResolvedValue([
        { name: 'templates-backup-2024-01-01.json' },
        { name: 'templates-backup-2024-01-02.json' },
        { name: 'other-file.txt' }
      ]);

      const backups = await storage.listBackups();

      expect(backups).toHaveLength(2);
      expect(backups[0].name).toContain('templates-backup-');
      expect(backups[0].timestamp).toBeDefined();
    });

    it('should limit number of backups', async () => {
      const oldBackups = Array.from({ length: 10 }, (_, i) => ({
        name: `templates-backup-2024-01-${String(i + 1).padStart(2, '0')}.json`
      }));

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue(oldBackups);

      storage.maxBackups = 5;
      await storage.backup();

      // Should attempt to remove old backups
      expect(fs.remove).toHaveBeenCalled();
    });
  });

  describe('Import and Export', () => {
    it('should export templates', async () => {
      const result = await storage.export(mockTemplates);

      expect(result.success).toBe(true);
      expect(result.count).toBe(2);
      expect(result.data.templates).toHaveLength(2);
      expect(result.data.version).toBe('1.0.0');
    });

    it('should export to specified path', async () => {
      const exportPath = '/path/to/export.json';

      await storage.export(mockTemplates, exportPath);

      expect(fs.writeTextFile).toHaveBeenCalledWith(
        exportPath,
        expect.any(String)
      );
    });

    it('should import templates from file', async () => {
      const importData = {
        version: '1.0.0',
        templates: [
          { id: 'imported', name: 'Imported', content: 'Imported content' }
        ]
      };

      fs.readTextFile.mockResolvedValue(JSON.stringify(importData));

      const result = await storage.import('/path/to/import.json');

      expect(result.success).toBe(true);
      expect(result.count).toBe(1);
      expect(result.templates).toHaveLength(1);
    });

    it('should validate import data structure', async () => {
      fs.readTextFile.mockResolvedValue(JSON.stringify({ invalid: 'data' }));

      await expect(storage.import('/invalid.json')).rejects.toThrow(
        'Invalid import data structure'
      );
    });
  });

  describe('Migration', () => {
    it('should migrate from in-memory storage', async () => {
      fs.exists.mockResolvedValue(false);

      const result = await storage.migrate(mockTemplates);

      expect(result.success).toBe(true);
      expect(result.migrated).toBe(2);
      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should backup existing data before migration', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue([]);

      await storage.migrate(mockTemplates);

      // Should call writeTextFile at least twice (backup + migrate, possibly backup cleanup)
      expect(fs.writeTextFile).toHaveBeenCalled();
      expect(fs.writeTextFile.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('should reject invalid migration data', async () => {
      await expect(storage.migrate('invalid')).rejects.toThrow(
        'Invalid in-memory storage provided'
      );
    });
  });

  describe('Cache Management', () => {
    it('should maintain cache consistency', async () => {
      fs.exists.mockResolvedValue(false);

      await storage.save(mockTemplates);

      const cache = storage.getCache();
      expect(cache.size).toBe(2);
      expect(cache.get('test1')).toEqual(mockTemplates.get('test1'));
    });

    it('should update cache after load', async () => {
      const fileData = {
        version: '1.0.0',
        templates: [{ id: 'cached', name: 'Cached', content: 'Content' }]
      };

      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify(fileData));

      await storage.load();

      expect(storage.getCache().get('cached')).toBeDefined();
    });
  });

  describe('Clear', () => {
    it('should clear all templates', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue([]);

      await storage.save(mockTemplates);
      expect(storage.getCache().size).toBe(2);

      await storage.clear();

      expect(storage.getCache().size).toBe(0);
      expect(fs.writeTextFile).toHaveBeenCalled();
    });

    it('should create backup before clearing', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue(JSON.stringify({ templates: [] }));
      fs.readDir.mockResolvedValue([]);

      await storage.clear();

      // Should have called writeTextFile at least twice (backup + clear, possibly backup cleanup)
      expect(fs.writeTextFile).toHaveBeenCalled();
      expect(fs.writeTextFile.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Statistics', () => {
    it('should return storage statistics', async () => {
      fs.readDir.mockResolvedValue([
        { name: 'templates-backup-2024-01-01.json' }
      ]);

      await storage.save(mockTemplates);
      const stats = await storage.getStatistics();

      expect(stats.templates).toBe(2);
      expect(stats.backups).toBe(1);
      expect(stats.initialized).toBeDefined();
      expect(stats.filename).toBe('templates.json');
    });

    it('should handle statistics errors gracefully', async () => {
      fs.readDir.mockRejectedValue(new Error('Read error'));

      const stats = await storage.getStatistics();

      expect(stats.templates).toBe(0);
      expect(stats.backups).toBe(0);
      // Error is handled, just returns empty backups list
      expect(stats.initialized).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle file write errors', async () => {
      fs.writeTextFile.mockRejectedValue(new Error('Write failed'));

      await expect(storage.save(mockTemplates)).rejects.toThrow(
        'Failed to save templates'
      );
    });

    it('should handle file read errors', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockRejectedValue(new Error('Read failed'));

      await expect(storage.load()).rejects.toThrow(
        'Failed to load templates'
      );
    });

    it('should handle invalid JSON', async () => {
      fs.exists.mockResolvedValue(true);
      fs.readTextFile.mockResolvedValue('invalid json');

      await expect(storage.load()).rejects.toThrow();
    });
  });

  describe('Configuration', () => {
    it('should use custom filename', () => {
      const customStorage = new TemplateStorage({ filename: 'custom.json' });
      expect(customStorage.filename).toBe('custom.json');
    });

    it('should use custom max backups', () => {
      const customStorage = new TemplateStorage({ maxBackups: 3 });
      expect(customStorage.maxBackups).toBe(3);
    });

    it('should respect autoSave option', () => {
      const noAutoSave = new TemplateStorage({ autoSave: false });
      expect(noAutoSave.autoSave).toBe(false);
    });
  });
});
