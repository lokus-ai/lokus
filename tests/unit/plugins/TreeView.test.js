/**
 * Tests for TreeView and TreeDataProvider
 * Tests tree data provider adapter and UIAPI tree provider registration
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { TreeDataProviderAdapter } from '../../../src/plugins/api/TreeDataProvider.js';
import { UIAPI } from '../../../src/plugins/api/LokusPluginAPI.js';
import { treeViewRegistry } from '../../../src/plugins/registry/TreeViewRegistry.js';

// Mock the tree view registry to ensure events fire synchronously in tests
vi.mock('../../../src/plugins/registry/TreeViewRegistry.js', () => ({
  treeViewRegistry: {
    register: vi.fn(),
    unregister: vi.fn(),
    getAll: vi.fn(() => []),
    on: vi.fn(),
    off: vi.fn()
  }
}));

describe('TreeDataProviderAdapter', () => {
  let provider;
  let adapter;

  beforeEach(() => {
    provider = {
      getChildren: vi.fn(),
      getTreeItem: vi.fn(),
      onDidChangeTreeData: vi.fn()
    };

    adapter = new TreeDataProviderAdapter('test-view', provider);
  });

  describe('initialization', () => {
    it('creates adapter with viewId and provider', () => {
      expect(adapter.viewId).toBe('test-view');
      expect(adapter.provider).toBe(provider);
    });

    it('subscribes to provider change events', () => {
      expect(provider.onDidChangeTreeData).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('getChildren', () => {
    it('calls provider getChildren with element', async () => {
      const mockChildren = ['child1', 'child2'];
      provider.getChildren.mockResolvedValue(mockChildren);

      const result = await adapter.getChildren('parent');

      expect(provider.getChildren).toHaveBeenCalledWith('parent');
      expect(result).toEqual(mockChildren);
    });

    it('returns empty array on error', async () => {
      provider.getChildren.mockRejectedValue(new Error('Test error'));

      const result = await adapter.getChildren('parent');

      expect(result).toEqual([]);
    });

    it('passes undefined for root elements', async () => {
      provider.getChildren.mockResolvedValue([]);

      await adapter.getChildren(undefined);

      expect(provider.getChildren).toHaveBeenCalledWith(undefined);
    });
  });

  describe('getTreeItem', () => {
    it('calls provider getTreeItem with element', async () => {
      const mockTreeItem = { label: 'Test Item', collapsibleState: 0 };
      provider.getTreeItem.mockResolvedValue(mockTreeItem);

      const result = await adapter.getTreeItem('element');

      expect(provider.getTreeItem).toHaveBeenCalledWith('element');
      expect(result).toEqual(mockTreeItem);
    });

    it('returns error item on error', async () => {
      provider.getTreeItem.mockRejectedValue(new Error('Test error'));

      const result = await adapter.getTreeItem('element');

      expect(result).toEqual({ label: 'Error loading item' });
    });
  });

  describe('getParent', () => {
    it('calls provider getParent if available', async () => {
      provider.getParent = vi.fn().mockResolvedValue('parent');

      const result = await adapter.getParent('child');

      expect(provider.getParent).toHaveBeenCalledWith('child');
      expect(result).toBe('parent');
    });

    it('returns undefined if getParent not available', async () => {
      delete provider.getParent;

      const result = await adapter.getParent('child');

      expect(result).toBeUndefined();
    });

    it('returns undefined on error', async () => {
      provider.getParent = vi.fn().mockRejectedValue(new Error('Test error'));

      const result = await adapter.getParent('child');

      expect(result).toBeUndefined();
    });
  });

  describe('refresh', () => {
    it('emits didChangeTreeData event', () => {
      const listener = vi.fn();
      adapter.on('didChangeTreeData', listener);

      adapter.refresh();

      expect(listener).toHaveBeenCalled();
    });

    it('emits didChangeTreeData with element', () => {
      const listener = vi.fn();
      adapter.on('didChangeTreeData', listener);

      adapter.refresh('element');

      expect(listener).toHaveBeenCalledWith('element');
    });
  });
});


describe('UIAPI - registerTreeDataProvider', () => {
  let uiAPI;

  beforeEach(() => {
    uiAPI = new UIAPI(null, null);
    // Grant UI permissions for testing
    const allPermissions = new Set([
      'ui:create',
      'ui:dialogs',
      'ui:notifications'
    ]);
    uiAPI._setPermissionContext('test-plugin', allPermissions);
  });

  it('registers a tree data provider', async () => {
    const provider = {
      getChildren: vi.fn(),
      getTreeItem: vi.fn(),
      onDidChangeTreeData: vi.fn()
    };

    const disposable = uiAPI.registerTreeDataProvider('test-view', provider);

    await waitFor(() => {
      expect(uiAPI.treeProviders.has('test-view')).toBe(true);
    });

    expect(disposable.dispose).toBeDefined();
  });

  it('stores provider in treeProviders map after registration', async () => {
    const provider = {
      getChildren: vi.fn().mockResolvedValue([]),
      getTreeItem: vi.fn().mockResolvedValue({ label: 'test' }),
      onDidChangeTreeData: vi.fn()
    };

    uiAPI.registerTreeDataProvider('test-view-2', provider);

    // The provider should be stored in the local map after async initialization
    await waitFor(() => {
      expect(uiAPI.treeProviders.has('test-view-2')).toBe(true);
    }, { timeout: 3000 });

    // Verify the stored provider is a TreeDataProviderAdapter
    const storedProvider = uiAPI.treeProviders.get('test-view-2');
    expect(storedProvider).toBeDefined();
    expect(storedProvider.viewId).toBe('test-view-2');
  });

  it('unregisters provider on dispose', async () => {
    const provider = {
      getChildren: vi.fn(),
      getTreeItem: vi.fn(),
      onDidChangeTreeData: vi.fn()
    };

    const disposable = uiAPI.registerTreeDataProvider('test-view', provider);

    await waitFor(() => {
      expect(uiAPI.treeProviders.has('test-view')).toBe(true);
    });

    disposable.dispose();

    expect(uiAPI.treeProviders.has('test-view')).toBe(false);
  });
});
