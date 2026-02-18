/**
 * Unit tests for ScheduleBlockManager
 */

import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ScheduleBlockManager } from '../../../src/core/schedule/ScheduleBlockManager.js';

// Mock @tauri-apps/api/core
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { invoke } from '@tauri-apps/api/core';

describe('ScheduleBlockManager', () => {
  let manager;

  beforeEach(() => {
    manager = new ScheduleBlockManager();
    vi.clearAllMocks();
  });

  describe('createBlock()', () => {
    test('should invoke create_schedule_block with correct args', async () => {
      const mockBlock = {
        id: 'block-1',
        task_id: 'task-1',
        start: '2026-02-16T09:00:00Z',
        end: '2026-02-16T10:00:00Z',
        created_at: Date.now(),
        updated_at: Date.now()
      };
      invoke.mockResolvedValue(mockBlock);

      const result = await manager.createBlock('task-1', '2026-02-16T09:00:00Z', '2026-02-16T10:00:00Z');

      expect(invoke).toHaveBeenCalledWith('create_schedule_block', {
        taskId: 'task-1',
        start: '2026-02-16T09:00:00Z',
        end: '2026-02-16T10:00:00Z'
      });
      expect(result).toEqual(mockBlock);
    });

    test('should notify listeners on block creation', async () => {
      const mockBlock = { id: 'block-1', task_id: 'task-1' };
      invoke.mockResolvedValue(mockBlock);

      const listener = vi.fn();
      manager.addListener(listener);

      await manager.createBlock('task-1', '2026-02-16T09:00:00Z', '2026-02-16T10:00:00Z');

      expect(listener).toHaveBeenCalledWith({
        type: 'block_created',
        block: mockBlock
      });
    });

    test('should invalidate cache on creation', async () => {
      invoke.mockResolvedValue({ id: 'block-1' });

      // Fill cache
      manager.cache.set('all_blocks', []);

      await manager.createBlock('task-1', '2026-02-16T09:00:00Z', '2026-02-16T10:00:00Z');

      expect(manager.cache.size).toBe(0);
    });
  });

  describe('updateBlock()', () => {
    test('should invoke update_schedule_block with correct args', async () => {
      const mockBlock = {
        id: 'block-1',
        task_id: 'task-1',
        start: '2026-02-16T09:00:00Z',
        end: '2026-02-16T11:00:00Z'
      };
      invoke.mockResolvedValue(mockBlock);

      await manager.updateBlock('block-1', { end: '2026-02-16T11:00:00Z' });

      expect(invoke).toHaveBeenCalledWith('update_schedule_block', {
        blockId: 'block-1',
        start: null,
        end: '2026-02-16T11:00:00Z'
      });
    });

    test('should notify listeners on update', async () => {
      invoke.mockResolvedValue({ id: 'block-1' });

      const listener = vi.fn();
      manager.addListener(listener);

      await manager.updateBlock('block-1', { end: '2026-02-16T11:00:00Z' });

      expect(listener).toHaveBeenCalledWith(expect.objectContaining({
        type: 'block_updated'
      }));
    });
  });

  describe('deleteBlock()', () => {
    test('should invoke delete_schedule_block', async () => {
      invoke.mockResolvedValue(undefined);

      await manager.deleteBlock('block-1');

      expect(invoke).toHaveBeenCalledWith('delete_schedule_block', {
        blockId: 'block-1'
      });
    });

    test('should notify listeners on deletion', async () => {
      invoke.mockResolvedValue(undefined);

      const listener = vi.fn();
      manager.addListener(listener);

      await manager.deleteBlock('block-1');

      expect(listener).toHaveBeenCalledWith({
        type: 'block_deleted',
        blockId: 'block-1'
      });
    });
  });

  describe('getAllBlocks()', () => {
    test('should return cached blocks on second call', async () => {
      const mockBlocks = [{ id: 'block-1' }, { id: 'block-2' }];
      invoke.mockResolvedValue(mockBlocks);

      // First call hits backend
      const result1 = await manager.getAllBlocks();
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(mockBlocks);

      // Second call returns from cache
      const result2 = await manager.getAllBlocks();
      expect(invoke).toHaveBeenCalledTimes(1); // No additional invoke
      expect(result2).toEqual(mockBlocks);
    });

    test('should bypass cache when forceRefresh is true', async () => {
      const mockBlocks = [{ id: 'block-1' }];
      invoke.mockResolvedValue(mockBlocks);

      await manager.getAllBlocks();
      await manager.getAllBlocks(true);

      expect(invoke).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBlocksInRange()', () => {
    test('should invoke with range parameters', async () => {
      const mockBlocks = [{ id: 'block-1' }];
      invoke.mockResolvedValue(mockBlocks);

      const result = await manager.getBlocksInRange(
        '2026-02-16T00:00:00Z',
        '2026-02-22T23:59:59Z'
      );

      expect(invoke).toHaveBeenCalledWith('get_schedule_blocks_in_range', {
        rangeStart: '2026-02-16T00:00:00Z',
        rangeEnd: '2026-02-22T23:59:59Z'
      });
      expect(result).toEqual(mockBlocks);
    });

    test('should cache range results', async () => {
      invoke.mockResolvedValue([]);

      await manager.getBlocksInRange('2026-02-16T00:00:00Z', '2026-02-22T23:59:59Z');
      await manager.getBlocksInRange('2026-02-16T00:00:00Z', '2026-02-22T23:59:59Z');

      expect(invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteBlocksForTask()', () => {
    test('should invoke with task ID and return deleted IDs', async () => {
      invoke.mockResolvedValue(['block-1', 'block-2']);

      const result = await manager.deleteBlocksForTask('task-1');

      expect(invoke).toHaveBeenCalledWith('delete_schedule_blocks_for_task', {
        taskId: 'task-1'
      });
      expect(result).toEqual(['block-1', 'block-2']);
    });
  });

  describe('listener management', () => {
    test('should add and remove listeners', () => {
      const listener = vi.fn();
      const unsubscribe = manager.addListener(listener);

      expect(manager.listeners.size).toBe(1);

      unsubscribe();
      expect(manager.listeners.size).toBe(0);
    });

    test('should not crash if listener throws', async () => {
      const badListener = vi.fn(() => { throw new Error('oops'); });
      const goodListener = vi.fn();

      manager.addListener(badListener);
      manager.addListener(goodListener);

      invoke.mockResolvedValue({ id: 'block-1' });

      // Should not throw
      await manager.createBlock('task-1', '2026-02-16T09:00:00Z', '2026-02-16T10:00:00Z');

      // Good listener should still be called
      expect(goodListener).toHaveBeenCalled();
    });
  });

  describe('cache invalidation', () => {
    test('invalidateCache should clear all cached data', () => {
      manager.cache.set('all_blocks', []);
      manager.cache.set('range_abc_def', []);

      manager.invalidateCache();

      expect(manager.cache.size).toBe(0);
    });
  });
});
