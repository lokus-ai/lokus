import { useState, useEffect } from 'react';

// Global status items storage
let statusItemsMap = new Map();
let listeners = new Set();

/**
 * Register a status item
 * @param {Object} item - Status item configuration
 */
export function registerStatusItem(item) {
  statusItemsMap.set(item.id, item);
  notifyListeners();
}

/**
 * Unregister a status item
 * @param {string} id - Status item ID
 */
export function unregisterStatusItem(id) {
  statusItemsMap.delete(id);
  notifyListeners();
}

/**
 * Update a status item
 * @param {string} id - Status item ID
 * @param {Object} updates - Updates to apply
 */
export function updateStatusItem(id, updates) {
  const item = statusItemsMap.get(id);
  if (item) {
    Object.assign(item, updates);
    notifyListeners();
  }
}

/**
 * Get all status items
 * @returns {Array} Array of all status items
 */
export function getAllStatusItems() {
  return Array.from(statusItemsMap.values());
}

/**
 * Clear all status items for a plugin
 * @param {string} pluginId - Plugin ID to clear items for
 */
export function clearPluginStatusItems(pluginId) {
  for (const [id, item] of statusItemsMap) {
    if (item.pluginId === pluginId) {
      statusItemsMap.delete(id);
    }
  }
  notifyListeners();
}

/**
 * Notify all listeners of changes
 */
function notifyListeners() {
  listeners.forEach(listener => listener());
}

/**
 * Hook for accessing plugin status items
 * @returns {Array} Array of visible status items
 */
export function usePluginStatusItems() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const updateItems = () => {
      const visibleItems = Array.from(statusItemsMap.values())
        .filter(item => item._visible !== false)
        .sort((a, b) => (b.priority || 0) - (a.priority || 0));
      setItems(visibleItems);
    };

    updateItems();
    listeners.add(updateItems);

    return () => {
      listeners.delete(updateItems);
    };
  }, []);

  return items;
}
