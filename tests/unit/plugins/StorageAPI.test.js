/**
 * StorageAPI Unit Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DataAPI } from '../../../src/plugins/api/LokusPluginAPI.js';

describe('StorageAPI', () => {
  let storageAPI;
  let mockDataManager;
  let mockDatabase;

  beforeEach(() => {
    // Mock database with all storage methods
    mockDatabase = {
      get: vi.fn(),
      set: vi.fn(),
      delete: vi.fn(),
      keys: vi.fn(),
      clear: vi.fn()
    };

    // Mock data manager
    mockDataManager = {
      getPluginDatabase: vi.fn().mockResolvedValue(mockDatabase)
    };

    storageAPI = new DataAPI(mockDataManager);
    storageAPI.currentPluginId = 'test-plugin';

    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('get()', () => {
    it('should get value from database', async () => {
      mockDatabase.get.mockResolvedValue({ foo: 'bar' });

      const result = await storageAPI.get('myKey');

      expect(result).toEqual({ foo: 'bar' });
      expect(mockDatabase.get).toHaveBeenCalledWith('myKey');
    });

    it('should return undefined for non-existent key', async () => {
      mockDatabase.get.mockResolvedValue(undefined);

      const result = await storageAPI.get('nonexistent');

      expect(result).toBeUndefined();
    });

    it('should fallback to localStorage when database unavailable', async () => {
      // Create a storage API without data manager
      const fallbackStorage = new DataAPI(null);
      fallbackStorage.currentPluginId = 'test-plugin';

      // Set value directly in localStorage
      localStorage.setItem('lokus_plugin_test-plugin_testKey', JSON.stringify({ value: 123 }));

      const result = await fallbackStorage.get('testKey');

      expect(result).toEqual({ value: 123 });
    });

    it('should return undefined for invalid JSON in localStorage', async () => {
      const fallbackStorage = new DataAPI(null);
      fallbackStorage.currentPluginId = 'test-plugin';

      localStorage.setItem('lokus_plugin_test-plugin_badKey', 'not valid json');

      const result = await fallbackStorage.get('badKey');

      expect(result).toBeUndefined();
    });
  });

  describe('set()', () => {
    it('should set value in database', async () => {
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.set('myKey', { data: 'value' });

      expect(mockDatabase.set).toHaveBeenCalledWith('myKey', { data: 'value' });
    });

    it('should handle string values', async () => {
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.set('stringKey', 'hello world');

      expect(mockDatabase.set).toHaveBeenCalledWith('stringKey', 'hello world');
    });

    it('should handle numeric values', async () => {
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.set('numberKey', 42);

      expect(mockDatabase.set).toHaveBeenCalledWith('numberKey', 42);
    });

    it('should handle array values', async () => {
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.set('arrayKey', [1, 2, 3]);

      expect(mockDatabase.set).toHaveBeenCalledWith('arrayKey', [1, 2, 3]);
    });

    it('should handle null values', async () => {
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.set('nullKey', null);

      expect(mockDatabase.set).toHaveBeenCalledWith('nullKey', null);
    });

    it('should fallback to localStorage when database unavailable', async () => {
      const fallbackStorage = new DataAPI(null);
      fallbackStorage.currentPluginId = 'test-plugin';

      await fallbackStorage.set('testKey', { stored: true });

      const stored = localStorage.getItem('lokus_plugin_test-plugin_testKey');
      expect(JSON.parse(stored)).toEqual({ stored: true });
    });
  });

  describe('delete()', () => {
    it('should delete value from database', async () => {
      mockDatabase.delete.mockResolvedValue(undefined);

      await storageAPI.delete('myKey');

      expect(mockDatabase.delete).toHaveBeenCalledWith('myKey');
    });

    it('should fallback to localStorage when database unavailable', async () => {
      const fallbackStorage = new DataAPI(null);
      fallbackStorage.currentPluginId = 'test-plugin';

      localStorage.setItem('lokus_plugin_test-plugin_deleteMe', 'value');

      await fallbackStorage.delete('deleteMe');

      expect(localStorage.getItem('lokus_plugin_test-plugin_deleteMe')).toBeNull();
    });
  });

  describe('keys()', () => {
    it('should get all keys from database', async () => {
      mockDatabase.keys.mockResolvedValue(['key1', 'key2', 'key3']);

      const result = await storageAPI.keys();

      expect(result).toEqual(['key1', 'key2', 'key3']);
    });

    it('should return empty array when no keys', async () => {
      mockDatabase.keys.mockResolvedValue([]);

      const result = await storageAPI.keys();

      expect(result).toEqual([]);
    });

    it('should return keys when using database fallback pattern', async () => {
      // Test the keys() method with a mock database
      const mockDb = {
        keys: vi.fn().mockResolvedValue(['key1', 'key2', 'key3'])
      };
      const mockManager = {
        getPluginDatabase: vi.fn().mockResolvedValue(mockDb)
      };
      const storage = new DataAPI(mockManager);
      storage.currentPluginId = 'test-plugin';

      const result = await storage.keys();

      expect(result).toContain('key1');
      expect(result).toContain('key2');
      expect(result).toContain('key3');
      expect(result.length).toBe(3);
    });
  });

  describe('clear()', () => {
    it('should clear all values from database', async () => {
      mockDatabase.clear.mockResolvedValue(undefined);

      await storageAPI.clear();

      expect(mockDatabase.clear).toHaveBeenCalled();
    });

    it('should call clear on database when available', async () => {
      const mockDb = {
        clear: vi.fn().mockResolvedValue(undefined),
        get: vi.fn().mockResolvedValue(undefined)
      };
      const mockManager = {
        getPluginDatabase: vi.fn().mockResolvedValue(mockDb)
      };
      const storage = new DataAPI(mockManager);
      storage.currentPluginId = 'test-plugin';

      await storage.clear();

      expect(mockDb.clear).toHaveBeenCalled();
    });
  });

  describe('getDatabase()', () => {
    it('should get a named database', async () => {
      const result = await storageAPI.getDatabase('mydb');

      expect(mockDataManager.getPluginDatabase).toHaveBeenCalledWith('test-plugin', 'mydb');
      expect(result).toBe(mockDatabase);
    });

    it('should cache database instances', async () => {
      await storageAPI.getDatabase('mydb');
      await storageAPI.getDatabase('mydb');

      expect(mockDataManager.getPluginDatabase).toHaveBeenCalledTimes(1);
    });

    it('should throw error when data manager unavailable', async () => {
      const noManagerStorage = new DataAPI(null);
      noManagerStorage.currentPluginId = 'test-plugin';

      await expect(noManagerStorage.getDatabase('mydb')).rejects.toThrow('Data access not available');
    });
  });

  describe('default database caching', () => {
    it('should reuse default database for convenience methods', async () => {
      mockDatabase.get.mockResolvedValue('value1');
      mockDatabase.set.mockResolvedValue(undefined);

      await storageAPI.get('key1');
      await storageAPI.set('key2', 'value');
      await storageAPI.get('key3');

      // Should only create default database once
      expect(mockDataManager.getPluginDatabase).toHaveBeenCalledTimes(1);
      expect(mockDataManager.getPluginDatabase).toHaveBeenCalledWith('test-plugin', 'default');
    });
  });

  describe('plugin isolation', () => {
    it('should isolate storage between plugins', async () => {
      const storageA = new DataAPI(null);
      storageA.currentPluginId = 'plugin-a';

      const storageB = new DataAPI(null);
      storageB.currentPluginId = 'plugin-b';

      await storageA.set('sharedKey', 'value-a');
      await storageB.set('sharedKey', 'value-b');

      const resultA = await storageA.get('sharedKey');
      const resultB = await storageB.get('sharedKey');

      expect(resultA).toBe('value-a');
      expect(resultB).toBe('value-b');
    });
  });

  describe('data types', () => {
    it('should handle complex nested objects', async () => {
      const complexData = {
        level1: {
          level2: {
            array: [1, 2, { nested: true }],
            date: '2024-01-01',
            boolean: false
          }
        }
      };

      mockDatabase.get.mockResolvedValue(complexData);

      const result = await storageAPI.get('complexKey');

      expect(result).toEqual(complexData);
    });

    it('should handle boolean false value', async () => {
      mockDatabase.get.mockResolvedValue(false);

      const result = await storageAPI.get('boolKey');

      expect(result).toBe(false);
    });

    it('should handle zero value', async () => {
      mockDatabase.get.mockResolvedValue(0);

      const result = await storageAPI.get('zeroKey');

      expect(result).toBe(0);
    });

    it('should handle empty string', async () => {
      mockDatabase.get.mockResolvedValue('');

      const result = await storageAPI.get('emptyKey');

      expect(result).toBe('');
    });
  });
});
