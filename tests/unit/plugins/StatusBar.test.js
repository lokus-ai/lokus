/**
 * Tests for StatusBar plugin items
 * Tests usePluginStatusItems hook, registerStatusBarItem API, and StatusBar integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import {
  usePluginStatusItems,
  registerStatusItem,
  unregisterStatusItem,
  updateStatusItem,
  clearPluginStatusItems,
  getAllStatusItems
} from '../../../src/hooks/usePluginStatusItems.js';
import { UIAPI } from '../../../src/plugins/api/LokusPluginAPI.js';

describe('usePluginStatusItems', () => {
  afterEach(() => {
    // Clear all items after each test
    const items = getAllStatusItems();
    items.forEach(item => unregisterStatusItem(item.id));
  });

  describe('basic functionality', () => {
    it('returns empty array initially', () => {
      const { result } = renderHook(() => usePluginStatusItems());
      expect(result.current).toEqual([]);
    });

    it('returns registered items', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Test',
        priority: 0,
        alignment: 2,
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('test-item');
      expect(result.current[0].text).toBe('Test');
    });

    it('filters out hidden items', () => {
      registerStatusItem({
        id: 'visible-item',
        text: 'Visible',
        _visible: true,
        pluginId: 'test-plugin'
      });

      registerStatusItem({
        id: 'hidden-item',
        text: 'Hidden',
        _visible: false,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(1);
      expect(result.current[0].id).toBe('visible-item');
    });

    it('sorts items by priority (descending)', () => {
      registerStatusItem({
        id: 'low-priority',
        text: 'Low',
        priority: 1,
        _visible: true,
        pluginId: 'test-plugin'
      });

      registerStatusItem({
        id: 'high-priority',
        text: 'High',
        priority: 10,
        _visible: true,
        pluginId: 'test-plugin'
      });

      registerStatusItem({
        id: 'medium-priority',
        text: 'Medium',
        priority: 5,
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(3);
      expect(result.current[0].id).toBe('high-priority');
      expect(result.current[1].id).toBe('medium-priority');
      expect(result.current[2].id).toBe('low-priority');
    });
  });

  describe('registerStatusItem', () => {
    it('registers a new status item', () => {
      const item = {
        id: 'test-item',
        text: 'Test Item',
        tooltip: 'Test tooltip',
        command: 'test.command',
        alignment: 1,
        priority: 5,
        _visible: true,
        pluginId: 'test-plugin'
      };

      registerStatusItem(item);

      const items = getAllStatusItems();
      expect(items).toContainEqual(item);
    });

    it('triggers hook update on registration', () => {
      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(0);

      act(() => {
        registerStatusItem({
          id: 'new-item',
          text: 'New',
          _visible: true,
          pluginId: 'test-plugin'
        });
      });

      expect(result.current).toHaveLength(1);
    });
  });

  describe('unregisterStatusItem', () => {
    it('removes a status item', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Test',
        _visible: true,
        pluginId: 'test-plugin'
      });

      expect(getAllStatusItems()).toHaveLength(1);

      unregisterStatusItem('test-item');

      expect(getAllStatusItems()).toHaveLength(0);
    });

    it('triggers hook update on unregistration', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Test',
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(1);

      act(() => {
        unregisterStatusItem('test-item');
      });

      expect(result.current).toHaveLength(0);
    });

    it('handles unregistering non-existent item gracefully', () => {
      expect(() => unregisterStatusItem('non-existent')).not.toThrow();
    });
  });

  describe('updateStatusItem', () => {
    it('updates an existing status item', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Original',
        _visible: true,
        pluginId: 'test-plugin'
      });

      updateStatusItem('test-item', { text: 'Updated' });

      const items = getAllStatusItems();
      const item = items.find(i => i.id === 'test-item');

      expect(item.text).toBe('Updated');
    });

    it('triggers hook update on update', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Original',
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current[0].text).toBe('Original');

      act(() => {
        updateStatusItem('test-item', { text: 'Updated' });
      });

      expect(result.current[0].text).toBe('Updated');
    });

    it('handles updating non-existent item gracefully', () => {
      expect(() => updateStatusItem('non-existent', { text: 'Updated' })).not.toThrow();
    });

    it('can toggle visibility', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Test',
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(1);

      act(() => {
        updateStatusItem('test-item', { _visible: false });
      });

      expect(result.current).toHaveLength(0);
    });
  });

  describe('clearPluginStatusItems', () => {
    it('removes all items for a plugin', () => {
      registerStatusItem({
        id: 'plugin1-item1',
        text: 'Item 1',
        _visible: true,
        pluginId: 'plugin1'
      });

      registerStatusItem({
        id: 'plugin1-item2',
        text: 'Item 2',
        _visible: true,
        pluginId: 'plugin1'
      });

      registerStatusItem({
        id: 'plugin2-item1',
        text: 'Item 3',
        _visible: true,
        pluginId: 'plugin2'
      });

      expect(getAllStatusItems()).toHaveLength(3);

      clearPluginStatusItems('plugin1');

      expect(getAllStatusItems()).toHaveLength(1);
      expect(getAllStatusItems()[0].pluginId).toBe('plugin2');
    });

    it('triggers hook update on clear', () => {
      registerStatusItem({
        id: 'test-item',
        text: 'Test',
        _visible: true,
        pluginId: 'test-plugin'
      });

      const { result } = renderHook(() => usePluginStatusItems());

      expect(result.current).toHaveLength(1);

      act(() => {
        clearPluginStatusItems('test-plugin');
      });

      expect(result.current).toHaveLength(0);
    });
  });
});

describe('UIAPI - registerStatusBarItem', () => {
  let uiAPI;

  beforeEach(() => {
    uiAPI = new UIAPI(null, null);
    uiAPI.currentPluginId = 'test-plugin';
  });

  afterEach(() => {
    // Clear all items after each test
    const items = getAllStatusItems();
    items.forEach(item => unregisterStatusItem(item.id));
  });

  describe('registration', () => {
    it('registers a status bar item', async () => {
      const item = uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test',
        tooltip: 'Test tooltip',
        alignment: 2,
        priority: 5
      });

      expect(item).toBeDefined();
      expect(item.id).toBe('test-item');
      expect(item.text).toBe('Test');
    });

    it('uses default alignment (right) when not specified', async () => {
      uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test'
      });

      await waitFor(() => {
        const items = getAllStatusItems();
        const item = items.find(i => i.id === 'test-item');
        expect(item?.alignment).toBe(2);
      });
    });

    it('uses default priority (0) when not specified', async () => {
      uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test'
      });

      await waitFor(() => {
        const items = getAllStatusItems();
        const item = items.find(i => i.id === 'test-item');
        expect(item?.priority).toBe(0);
      });
    });

    it('sets pluginId correctly', async () => {
      uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test'
      });

      await waitFor(() => {
        const items = getAllStatusItems();
        const item = items.find(i => i.id === 'test-item');
        expect(item?.pluginId).toBe('test-plugin');
      });
    });

    it('supports custom colors', async () => {
      uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test',
        color: '#ff0000',
        backgroundColor: '#00ff00'
      });

      await waitFor(() => {
        const items = getAllStatusItems();
        const item = items.find(i => i.id === 'test-item');
        expect(item?.color).toBe('#ff0000');
        expect(item?.backgroundColor).toBe('#00ff00');
      });
    });
  });

  describe('item methods', () => {
    it('returns item with show/hide/dispose methods', () => {
      const item = uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test'
      });

      expect(typeof item.show).toBe('function');
      expect(typeof item.hide).toBe('function');
      expect(typeof item.dispose).toBe('function');
    });

    it('dispose removes the item', async () => {
      const item = uiAPI.registerStatusBarItem({
        id: 'test-item',
        text: 'Test'
      });

      // Wait for async registration
      await waitFor(() => {
        expect(uiAPI.statusItems.has('test-item')).toBe(true);
      });

      item.dispose();

      expect(uiAPI.statusItems.has('test-item')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes all status items for a plugin', async () => {
      uiAPI.registerStatusBarItem({
        id: 'item1',
        text: 'Item 1'
      });

      uiAPI.registerStatusBarItem({
        id: 'item2',
        text: 'Item 2'
      });

      await waitFor(() => {
        expect(getAllStatusItems().length).toBeGreaterThan(0);
      });

      uiAPI.removeAllStatusItems('test-plugin');

      await waitFor(() => {
        const items = getAllStatusItems();
        const pluginItems = items.filter(i => i.pluginId === 'test-plugin');
        expect(pluginItems).toHaveLength(0);
      });
    });
  });
});
