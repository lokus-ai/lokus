import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import scheduleBlockManager from '../core/schedule/ScheduleBlockManager.js';

const ScheduleContext = createContext(null);

/**
 * Schedule Context Provider
 *
 * Provides schedule block state to calendar components.
 * Manages loading blocks for visible date ranges and real-time updates.
 */
export function ScheduleProvider({ children }) {
  const [blocks, setBlocks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const currentRangeRef = useRef({ start: null, end: null });

  // Subscribe to schedule block manager changes
  useEffect(() => {
    const unsubscribe = scheduleBlockManager.addListener((event) => {
      // Refresh blocks when changes occur
      if (currentRangeRef.current.start && currentRangeRef.current.end) {
        loadBlocksForRange(
          currentRangeRef.current.start,
          currentRangeRef.current.end,
          true
        );
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Load schedule blocks for a date range
   */
  const loadBlocksForRange = useCallback(async (rangeStart, rangeEnd, forceRefresh = false) => {
    currentRangeRef.current = { start: rangeStart, end: rangeEnd };

    // Skip if same range and not forced
    if (!forceRefresh && blocks.length > 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetchedBlocks = await scheduleBlockManager.getBlocksInRange(rangeStart, rangeEnd);
      setBlocks(fetchedBlocks);
    } catch (err) {
      console.error('Failed to load schedule blocks:', err);
      setError(err.message || 'Failed to load schedule blocks');
    } finally {
      setLoading(false);
    }
  }, [blocks.length]);

  /**
   * Create a new schedule block
   */
  const createBlock = useCallback(async (taskId, start, end) => {
    try {
      const block = await scheduleBlockManager.createBlock(taskId, start, end);
      return block;
    } catch (err) {
      console.error('Failed to create schedule block:', err);
      throw err;
    }
  }, []);

  /**
   * Update a schedule block (move or resize)
   */
  const updateBlock = useCallback(async (blockId, updates) => {
    try {
      const block = await scheduleBlockManager.updateBlock(blockId, updates);
      return block;
    } catch (err) {
      console.error('Failed to update schedule block:', err);
      throw err;
    }
  }, []);

  /**
   * Delete a schedule block
   */
  const deleteBlock = useCallback(async (blockId) => {
    try {
      await scheduleBlockManager.deleteBlock(blockId);
    } catch (err) {
      console.error('Failed to delete schedule block:', err);
      throw err;
    }
  }, []);

  /**
   * Delete all schedule blocks for a task
   */
  const deleteBlocksForTask = useCallback(async (taskId) => {
    try {
      return await scheduleBlockManager.deleteBlocksForTask(taskId);
    } catch (err) {
      console.error('Failed to delete schedule blocks for task:', err);
      throw err;
    }
  }, []);

  /**
   * Get blocks for a specific date (filters from loaded range)
   */
  const getBlocksForDate = useCallback((date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    return blocks.filter(block => {
      const blockStart = new Date(block.start);
      const blockEnd = new Date(block.end);
      return blockStart < dayEnd && blockEnd > dayStart;
    });
  }, [blocks]);

  const value = {
    blocks,
    loading,
    error,
    loadBlocksForRange,
    createBlock,
    updateBlock,
    deleteBlock,
    deleteBlocksForTask,
    getBlocksForDate
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}

/**
 * Hook to access schedule context
 */
export function useScheduleContext() {
  const context = useContext(ScheduleContext);
  if (!context) {
    throw new Error('useScheduleContext must be used within a ScheduleProvider');
  }
  return context;
}

export default ScheduleContext;
