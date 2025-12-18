/**
 * Unit tests for ConfigurationAPI
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ConfigurationAPI } from '../../../src/plugins/api/ConfigurationAPI.js';

describe('ConfigurationAPI', () => {
  let configAPI;
  let mockConfigManager;

  beforeEach(() => {
    // Create mock config manager
    mockConfigManager = {
      get: vi.fn((key, defaultValue) => {
        const config = {
          'editor.fontSize': 14,
          'editor.theme': 'dark',
          'app.autoSave': true
        };
        return Promise.resolve(config[key] !== undefined ? config[key] : defaultValue);
      }),
      has: vi.fn((key) => {
        const config = {
          'editor.fontSize': 14,
          'editor.theme': 'dark',
          'app.autoSave': true
        };
        return Promise.resolve(config[key] !== undefined);
      }),
      update: vi.fn((key, value) => Promise.resolve())
    };

    configAPI = new ConfigurationAPI(mockConfigManager);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('get()', () => {
    test('should get configuration value', async () => {
      const value = await configAPI.get('editor.fontSize');

      expect(mockConfigManager.get).toHaveBeenCalledWith('editor.fontSize', undefined);
      expect(value).toBe(14);
    });

    test('should get configuration value with default', async () => {
      const value = await configAPI.get('nonexistent.key', 42);

      expect(mockConfigManager.get).toHaveBeenCalledWith('nonexistent.key', 42);
      expect(value).toBe(42);
    });

    test('should return default value if no config manager', async () => {
      configAPI.configManager = null;
      const value = await configAPI.get('editor.fontSize', 12);

      expect(value).toBe(12);
    });
  });

  describe('set()', () => {
    test('should set configuration value', async () => {
      await configAPI.set('editor.fontSize', 16);

      expect(mockConfigManager.update).toHaveBeenCalledWith('editor.fontSize', 16);
    });

    test('should emit configuration-changed event', async () => {
      const listener = vi.fn();
      configAPI.on('configuration-changed', listener);

      await configAPI.set('editor.fontSize', 16);

      expect(listener).toHaveBeenCalled();
    });

    test('should notify change listeners', async () => {
      const changeListener = vi.fn();
      configAPI.onDidChange(changeListener);

      await configAPI.set('editor.fontSize', 16);

      expect(changeListener).toHaveBeenCalled();
      const event = changeListener.mock.calls[0][0];
      expect(event.affectsConfiguration('editor.fontSize')).toBe(true);
      expect(event.affectsConfiguration('editor')).toBe(true);
      expect(event.affectsConfiguration('app')).toBe(false);
    });

    test('should do nothing if no config manager', async () => {
      configAPI.configManager = null;
      await configAPI.set('editor.fontSize', 16);

      expect(mockConfigManager.update).not.toHaveBeenCalled();
    });
  });

  describe('update()', () => {
    test('should update configuration value', async () => {
      await configAPI.update('editor.theme', 'light');

      expect(mockConfigManager.update).toHaveBeenCalledWith('editor.theme', 'light');
    });

    test('should notify change listeners', async () => {
      const changeListener = vi.fn();
      configAPI.onDidChange(changeListener);

      await configAPI.update('editor.theme', 'light');

      expect(changeListener).toHaveBeenCalled();
    });
  });

  describe('has()', () => {
    test('should check if configuration key exists', async () => {
      const exists = await configAPI.has('editor.fontSize');

      expect(mockConfigManager.has).toHaveBeenCalledWith('editor.fontSize');
      expect(exists).toBe(true);
    });

    test('should return false for non-existent key', async () => {
      const exists = await configAPI.has('nonexistent.key');

      expect(exists).toBe(false);
    });

    test('should return false if no config manager', async () => {
      configAPI.configManager = null;
      const exists = await configAPI.has('editor.fontSize');

      expect(exists).toBe(false);
    });
  });

  describe('inspect()', () => {
    test('should inspect configuration value', async () => {
      const inspection = await configAPI.inspect('editor.fontSize');

      expect(inspection).toHaveProperty('key', 'editor.fontSize');
      expect(inspection).toHaveProperty('globalValue', 14);
      expect(inspection).toHaveProperty('defaultValue');
      expect(inspection).toHaveProperty('workspaceValue');
      expect(inspection).toHaveProperty('workspaceFolderValue');
    });

    test('should return empty inspection if no config manager', async () => {
      configAPI.configManager = null;
      const inspection = await configAPI.inspect('editor.fontSize');

      expect(inspection).toHaveProperty('key', 'editor.fontSize');
      expect(inspection.globalValue).toBeUndefined();
    });
  });

  describe('onDidChange()', () => {
    test('should register change listener', () => {
      const listener = vi.fn();
      const disposable = configAPI.onDidChange(listener);

      expect(disposable).toHaveProperty('dispose');
      expect(typeof disposable.dispose).toBe('function');
    });

    test('should call listener on configuration change', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.fontSize', 16);

      expect(listener).toHaveBeenCalled();
      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration).toBeDefined();
      expect(typeof event.affectsConfiguration).toBe('function');
    });

    test('should support affectsConfiguration check', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.fontSize', 16);

      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration('editor.fontSize')).toBe(true);
      expect(event.affectsConfiguration('editor')).toBe(true);
      expect(event.affectsConfiguration('app')).toBe(false);
    });

    test('should dispose listener correctly', async () => {
      const listener = vi.fn();
      const disposable = configAPI.onDidChange(listener);

      disposable.dispose();
      await configAPI.set('editor.fontSize', 16);

      expect(listener).not.toHaveBeenCalled();
    });

    test('should throw error if callback is not a function', () => {
      expect(() => configAPI.onDidChange('not a function')).toThrow('Callback must be a function');
    });

    test('should handle errors in change listeners', async () => {
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const normalListener = vi.fn();

      configAPI.onDidChange(errorListener);
      configAPI.onDidChange(normalListener);

      // Should not throw
      await configAPI.set('editor.fontSize', 16);

      expect(errorListener).toHaveBeenCalled();
      expect(normalListener).toHaveBeenCalled();
    });
  });

  describe('getConfiguration()', () => {
    test('should get configuration section', () => {
      const editorConfig = configAPI.getConfiguration('editor');

      expect(editorConfig).toHaveProperty('get');
      expect(editorConfig).toHaveProperty('has');
      expect(editorConfig).toHaveProperty('update');
    });

    test('should get value from section', async () => {
      const editorConfig = configAPI.getConfiguration('editor');
      const fontSize = await editorConfig.get('fontSize');

      expect(mockConfigManager.get).toHaveBeenCalledWith('editor.fontSize', undefined);
      expect(fontSize).toBe(14);
    });

    test('should check if key exists in section', async () => {
      const editorConfig = configAPI.getConfiguration('editor');
      const exists = await editorConfig.has('fontSize');

      expect(mockConfigManager.has).toHaveBeenCalledWith('editor.fontSize');
      expect(exists).toBe(true);
    });

    test('should update value in section', async () => {
      const editorConfig = configAPI.getConfiguration('editor');
      await editorConfig.update('fontSize', 16);

      expect(mockConfigManager.update).toHaveBeenCalledWith('editor.fontSize', 16, undefined);
    });

    test('should notify listeners when updating through section', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      const editorConfig = configAPI.getConfiguration('editor');
      await editorConfig.update('fontSize', 16);

      expect(listener).toHaveBeenCalled();
    });

    test('should work without section', async () => {
      const rootConfig = configAPI.getConfiguration();
      const fontSize = await rootConfig.get('editor.fontSize');

      expect(mockConfigManager.get).toHaveBeenCalledWith('editor.fontSize', undefined);
      expect(fontSize).toBe(14);
    });

    test('should return default value if no config manager', async () => {
      configAPI.configManager = null;
      const editorConfig = configAPI.getConfiguration('editor');
      const fontSize = await editorConfig.get('fontSize', 12);

      expect(fontSize).toBe(12);
    });
  });

  describe('affectsConfiguration()', () => {
    test('should detect exact key match', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.fontSize', 16);

      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration('editor.fontSize')).toBe(true);
    });

    test('should detect parent section match', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.fontSize', 16);

      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration('editor')).toBe(true);
    });

    test('should not match unrelated section', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.fontSize', 16);

      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration('app')).toBe(false);
      expect(event.affectsConfiguration('theme')).toBe(false);
    });

    test('should handle nested sections', async () => {
      const listener = vi.fn();
      configAPI.onDidChange(listener);

      await configAPI.set('editor.formatting.indentSize', 4);

      const event = listener.mock.calls[0][0];
      expect(event.affectsConfiguration('editor.formatting.indentSize')).toBe(true);
      expect(event.affectsConfiguration('editor.formatting')).toBe(true);
      expect(event.affectsConfiguration('editor')).toBe(true);
      expect(event.affectsConfiguration('editor.theme')).toBe(false);
    });
  });
});
