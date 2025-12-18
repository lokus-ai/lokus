/**
 * Tests for Canvas Fragment Manager
 * Tests fragment storage operations for embedded canvases
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

// Import after mocking
import { CanvasFragmentManager, fragmentManager } from '../../../src/core/canvas/fragment-manager.js';
import { invoke } from '@tauri-apps/api/core';

describe('Canvas Fragment Manager', () => {
  let manager;

  beforeEach(() => {
    manager = new CanvasFragmentManager();
    vi.clearAllMocks();
  });

  describe('Path Generation', () => {
    it('should generate correct fragments directory path', () => {
      const workspacePath = '/Users/test/workspace';
      const dir = manager.getFragmentsDir(workspacePath);

      expect(dir).toBe('/Users/test/workspace/.lokus/canvas-fragments');
    });

    it('should generate correct fragment file path', () => {
      const workspacePath = '/Users/test/workspace';
      const fragmentId = 'abc123-def456';
      const path = manager.getFragmentPath(workspacePath, fragmentId);

      expect(path).toBe('/Users/test/workspace/.lokus/canvas-fragments/abc123-def456.json');
    });
  });

  describe('Fragment ID Generation', () => {
    it('should generate valid UUID v4', () => {
      const id = manager.generateFragmentId();

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set();
      for (let i = 0; i < 100; i++) {
        ids.add(manager.generateFragmentId());
      }

      expect(ids.size).toBe(100);
    });
  });

  describe('Empty Fragment Data', () => {
    it('should create empty fragment data with default dimensions', () => {
      const data = manager.createEmptyFragmentData();

      expect(data.records).toEqual([]);
      expect(data.schema).toBeDefined();
      expect(data.schema.schemaVersion).toBe(1);
      expect(data.metadata.width).toBe(600);
      expect(data.metadata.height).toBe(400);
    });

    it('should create empty fragment data with custom dimensions', () => {
      const data = manager.createEmptyFragmentData(800, 600);

      expect(data.metadata.width).toBe(800);
      expect(data.metadata.height).toBe(600);
    });

    it('should include timestamp in metadata', () => {
      const before = new Date().toISOString();
      const data = manager.createEmptyFragmentData();
      const after = new Date().toISOString();

      expect(data.metadata.created).toBeDefined();
      expect(data.metadata.modified).toBeDefined();
      expect(new Date(data.metadata.created).getTime()).toBeGreaterThanOrEqual(new Date(before).getTime());
      expect(new Date(data.metadata.created).getTime()).toBeLessThanOrEqual(new Date(after).getTime());
    });

    it('should include TLDraw schema with all shape types', () => {
      const data = manager.createEmptyFragmentData();

      expect(data.schema.recordVersions.shape).toBeDefined();
      expect(data.schema.recordVersions.shape.subTypeVersions).toHaveProperty('draw');
      expect(data.schema.recordVersions.shape.subTypeVersions).toHaveProperty('geo');
      expect(data.schema.recordVersions.shape.subTypeVersions).toHaveProperty('text');
    });
  });

  describe('Load Fragment', () => {
    it('should load fragment from file', async () => {
      const mockData = {
        records: [{ id: 'shape:1', type: 'draw' }],
        schema: { schemaVersion: 1 },
        metadata: { width: 600, height: 400 }
      };

      invoke.mockResolvedValue(JSON.stringify(mockData));

      const result = await manager.loadFragment('/workspace', 'fragment-123');

      expect(invoke).toHaveBeenCalledWith('read_file_content', {
        path: '/workspace/.lokus/canvas-fragments/fragment-123.json'
      });
      expect(result.records).toEqual(mockData.records);
    });

    it('should return empty fragment on file not found', async () => {
      invoke.mockRejectedValue(new Error('File not found'));

      const result = await manager.loadFragment('/workspace', 'nonexistent');

      expect(result.records).toEqual([]);
      expect(result.schema).toBeDefined();
    });

    it('should add default schema if missing', async () => {
      const mockData = {
        records: [{ id: 'shape:1' }]
        // No schema
      };

      invoke.mockResolvedValue(JSON.stringify(mockData));

      const result = await manager.loadFragment('/workspace', 'fragment-123');

      expect(result.schema).toBeDefined();
      expect(result.schema.schemaVersion).toBe(1);
    });

    it('should return empty fragment on parse error', async () => {
      invoke.mockResolvedValue('invalid json {');

      const result = await manager.loadFragment('/workspace', 'bad-json');

      expect(result.records).toEqual([]);
    });

    it('should cache loaded fragment', async () => {
      const mockData = {
        records: [],
        schema: { schemaVersion: 1 },
        metadata: {}
      };

      invoke.mockResolvedValue(JSON.stringify(mockData));

      await manager.loadFragment('/workspace', 'cached');

      const cached = manager.fragmentCache.get('/workspace/.lokus/canvas-fragments/cached.json');
      expect(cached).toBeDefined();
    });
  });

  describe('Save Fragment', () => {
    it('should save fragment to file', async () => {
      invoke.mockResolvedValue(undefined);

      const data = {
        records: [{ id: 'shape:1' }],
        schema: { schemaVersion: 1 },
        metadata: { width: 600, height: 400 }
      };

      await manager.saveFragment('/workspace', 'fragment-123', data);

      expect(invoke).toHaveBeenCalledWith('write_file_content', expect.objectContaining({
        path: '/workspace/.lokus/canvas-fragments/fragment-123.json'
      }));
    });

    it('should update modified timestamp on save', async () => {
      invoke.mockResolvedValue(undefined);

      const data = {
        records: [],
        schema: { schemaVersion: 1 },
        metadata: { width: 600, height: 400, created: '2024-01-01T00:00:00.000Z' }
      };

      await manager.saveFragment('/workspace', 'fragment-123', data);

      // Check that the saved content has updated modified timestamp
      const savedContent = JSON.parse(invoke.mock.calls.find(c => c[0] === 'write_file_content')[1].content);
      expect(new Date(savedContent.metadata.modified).getTime()).toBeGreaterThan(new Date('2024-01-01').getTime());
    });

    it('should ensure directories exist before save', async () => {
      invoke.mockResolvedValue(undefined);

      const data = manager.createEmptyFragmentData();

      await manager.saveFragment('/workspace', 'new-fragment', data);

      // Check that create_directory was called for .lokus and canvas-fragments
      const createDirCalls = invoke.mock.calls.filter(c => c[0] === 'create_directory');
      expect(createDirCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Delete Fragment', () => {
    it('should delete fragment file', async () => {
      invoke.mockResolvedValue(undefined);

      const result = await manager.deleteFragment('/workspace', 'to-delete');

      expect(invoke).toHaveBeenCalledWith('delete_file', {
        path: '/workspace/.lokus/canvas-fragments/to-delete.json'
      });
      expect(result).toBe(true);
    });

    it('should return false on delete error', async () => {
      invoke.mockRejectedValue(new Error('Permission denied'));

      const result = await manager.deleteFragment('/workspace', 'protected');

      expect(result).toBe(false);
    });

    it('should clear cache on delete', async () => {
      // First cache something
      manager.fragmentCache.set('/workspace/.lokus/canvas-fragments/cached.json', {});

      invoke.mockResolvedValue(undefined);

      await manager.deleteFragment('/workspace', 'cached');

      expect(manager.fragmentCache.has('/workspace/.lokus/canvas-fragments/cached.json')).toBe(false);
    });
  });

  describe('Fragment Exists', () => {
    it('should return true for existing fragment', async () => {
      invoke.mockResolvedValue('{}');

      const exists = await manager.fragmentExists('/workspace', 'exists');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing fragment', async () => {
      invoke.mockRejectedValue(new Error('File not found'));

      const exists = await manager.fragmentExists('/workspace', 'missing');

      expect(exists).toBe(false);
    });
  });

  describe('List Fragments', () => {
    it('should return list of fragment IDs', async () => {
      invoke.mockResolvedValue([
        'abc-123.json',
        'def-456.json',
        'ghi-789.json'
      ]);

      const ids = await manager.listFragments('/workspace');

      expect(ids).toEqual(['abc-123', 'def-456', 'ghi-789']);
    });

    it('should return empty array on error', async () => {
      invoke.mockRejectedValue(new Error('Directory not found'));

      const ids = await manager.listFragments('/workspace');

      expect(ids).toEqual([]);
    });

    it('should filter out non-json files', async () => {
      invoke.mockResolvedValue([
        'abc.json',
        'def.json',
        '.DS_Store',
        'readme.txt'
      ]);

      const ids = await manager.listFragments('/workspace');

      expect(ids).toEqual(['abc', 'def']);
    });
  });

  describe('Queue Management', () => {
    it('should prevent concurrent loads of same fragment', async () => {
      let resolveFirst;
      const firstPromise = new Promise(r => { resolveFirst = r; });

      invoke.mockImplementation(() => firstPromise);

      // Start two loads at the same time
      const load1 = manager.loadFragment('/workspace', 'concurrent');
      const load2 = manager.loadFragment('/workspace', 'concurrent');

      // Both should return the same promise
      expect(manager.loadQueue.size).toBe(1);

      // Resolve the load
      resolveFirst('{}');

      await Promise.all([load1, load2]);

      // Queue should be cleared
      expect(manager.loadQueue.size).toBe(0);
    });

    it('should return queue status', () => {
      const status = manager.getQueueStatus();

      expect(status).toHaveProperty('activeLoads');
      expect(status).toHaveProperty('activeSaves');
      expect(status).toHaveProperty('cachedFragments');
      expect(Array.isArray(status.activeLoads)).toBe(true);
    });
  });

  describe('Singleton Instance', () => {
    it('should export singleton instance', () => {
      expect(fragmentManager).toBeInstanceOf(CanvasFragmentManager);
    });
  });
});
