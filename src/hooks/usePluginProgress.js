import { useState, useEffect } from 'react';

// Global progress items storage
let progressItemsMap = new Map();
let listeners = new Set();

/**
 * Register a progress item
 * @param {string} id - Progress ID
 * @param {Object} item - Progress item configuration
 */
export function startProgress(id, item) {
  progressItemsMap.set(id, {
    id,
    title: item.title,
    message: item.message,
    percentage: item.percentage,
    cancellable: item.cancellable,
    location: item.location || 'notification',
    onCancel: item.onCancel
  });
  notifyListeners();
}

/**
 * Update a progress item
 * @param {string} id - Progress ID
 * @param {Object} updates - Updates to apply
 */
export function updateProgress(id, updates) {
  const item = progressItemsMap.get(id);
  if (item) {
    Object.assign(item, updates);
    notifyListeners();
  }
}

/**
 * End/remove a progress item
 * @param {string} id - Progress ID
 */
export function endProgress(id) {
  progressItemsMap.delete(id);
  notifyListeners();
}

/**
 * Get all progress items
 * @returns {Array} Array of all progress items
 */
export function getAllProgressItems() {
  return Array.from(progressItemsMap.values());
}

/**
 * Notify all listeners of changes
 */
function notifyListeners() {
  listeners.forEach(listener => listener());
}

/**
 * Hook for accessing plugin progress items
 * @returns {Array} Array of active progress items
 */
export function usePluginProgress() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const updateItems = () => {
      const activeItems = Array.from(progressItemsMap.values());
      setItems(activeItems);
    };

    updateItems();
    listeners.add(updateItems);

    return () => {
      listeners.delete(updateItems);
    };
  }, []);

  return items;
}
