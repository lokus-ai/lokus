/**
 * usePluginTreeViews - React hook for accessing plugin tree view providers
 * Provides real-time updates when tree providers are registered/unregistered
 */

import { useState, useEffect } from 'react';
import { treeViewRegistry } from '../plugins/registry/TreeViewRegistry.js';

/**
 * Hook to get all tree view providers
 * Automatically updates when providers are registered or unregistered
 * @returns {Array} Array of tree view registrations with viewId, provider, title, pluginId
 */
export function usePluginTreeViews() {
  const [treeViews, setTreeViews] = useState([]);

  useEffect(() => {
    const updateTreeViews = () => {
      setTreeViews(treeViewRegistry.getAll());
    };

    // Initial load
    updateTreeViews();

    // Listen for changes
    treeViewRegistry.on('tree-provider-registered', updateTreeViews);
    treeViewRegistry.on('tree-provider-unregistered', updateTreeViews);
    treeViewRegistry.on('tree-providers-cleared', updateTreeViews);

    return () => {
      treeViewRegistry.off('tree-provider-registered', updateTreeViews);
      treeViewRegistry.off('tree-provider-unregistered', updateTreeViews);
      treeViewRegistry.off('tree-providers-cleared', updateTreeViews);
    };
  }, []);

  return treeViews;
}

/**
 * Hook to get tree views for a specific plugin
 * @param {string} pluginId - Plugin ID to filter by
 * @returns {Array} Array of tree view registrations for the plugin
 */
export function usePluginTreeViewsByPlugin(pluginId) {
  const [treeViews, setTreeViews] = useState([]);

  useEffect(() => {
    const updateTreeViews = () => {
      setTreeViews(treeViewRegistry.getByPlugin(pluginId));
    };

    updateTreeViews();

    treeViewRegistry.on('tree-provider-registered', updateTreeViews);
    treeViewRegistry.on('tree-provider-unregistered', updateTreeViews);
    treeViewRegistry.on('tree-providers-cleared', updateTreeViews);

    return () => {
      treeViewRegistry.off('tree-provider-registered', updateTreeViews);
      treeViewRegistry.off('tree-provider-unregistered', updateTreeViews);
      treeViewRegistry.off('tree-providers-cleared', updateTreeViews);
    };
  }, [pluginId]);

  return treeViews;
}

/**
 * Hook to check if a tree view exists
 * @param {string} viewId - Tree view ID to check
 * @returns {boolean} True if tree view exists
 */
export function useTreeViewExists(viewId) {
  const [exists, setExists] = useState(false);

  useEffect(() => {
    const updateExists = () => {
      setExists(treeViewRegistry.exists(viewId));
    };

    updateExists();

    treeViewRegistry.on('tree-provider-registered', updateExists);
    treeViewRegistry.on('tree-provider-unregistered', updateExists);
    treeViewRegistry.on('tree-providers-cleared', updateExists);

    return () => {
      treeViewRegistry.off('tree-provider-registered', updateExists);
      treeViewRegistry.off('tree-provider-unregistered', updateExists);
      treeViewRegistry.off('tree-providers-cleared', updateExists);
    };
  }, [viewId]);

  return exists;
}
