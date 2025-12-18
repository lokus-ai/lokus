import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import pluginStateAdapter from '../core/plugins/PluginStateAdapter';

/**
 * Hook for managing status bar items from plugins
 * Provides left and right sections with priority-based ordering
 */
export function useStatusBar() {
  const [leftItems, setLeftItems] = useState([]);
  const [rightItems, setRightItems] = useState([]);

  useEffect(() => {
    // Listen for status bar events from plugins
    const setupEventListeners = async () => {
      try {
        // Listen for status bar item creation
        const unlistenCreate = await listen('status-bar-item-created', (event) => {
          const { id, position = 'right', priority = 0, ...itemData } = event.payload;
          addStatusBarItem(id, position, priority, itemData);
        });

        // Listen for status bar item disposal
        const unlistenDispose = await listen('status-bar-item-disposed', (event) => {
          const { id } = event.payload;
          removeStatusBarItem(id);
        });

        // Listen for status bar item updates
        const unlistenUpdate = await listen('status-bar-item-updated', (event) => {
          const { id, ...updateData } = event.payload;
          updateStatusBarItem(id, updateData);
        });

        // Listen for plugin activation to register status bar items
        const unlistenActivated = await listen('plugin-runtime-activated', (event) => {
          const { pluginId } = event.payload;
          registerPluginStatusBarItems(pluginId);
        });

        // Listen for plugin deactivation to clean up status bar items
        const unlistenDeactivated = await listen('plugin-runtime-deactivated', (event) => {
          const { pluginId } = event.payload;
          cleanupPluginStatusBarItems(pluginId);
        });

        // Register items for already active plugins
        const activePlugins = pluginStateAdapter.getEnabledPlugins();
        activePlugins.forEach(plugin => {
          registerPluginStatusBarItems(plugin.id);
        });

        // Cleanup function
        return () => {
          unlistenCreate();
          unlistenDispose();
          unlistenUpdate();
          unlistenActivated();
          unlistenDeactivated();
        };
      } catch (error) {
        return () => { }; // Return empty cleanup function
      }
    };

    setupEventListeners();
  }, []);

  // Register status bar items for a newly activated plugin
  const registerPluginStatusBarItems = async (pluginId) => {
    try {
      // Get plugin info from adapter
      const pluginInfo = pluginStateAdapter.getPlugin(pluginId);

      if (pluginInfo && pluginInfo.manifest && pluginInfo.manifest.contributes?.statusBar) {
        const statusBarConfig = pluginInfo.manifest.contributes.statusBar;

        // Import and register the component
        await registerPluginComponent(pluginId, statusBarConfig);
      } else {
      }
    } catch { }
  };

  // Register a React component from plugin
  const registerPluginComponent = async (pluginId, config) => {
    try {
      const { component, position = 'right', priority = 0 } = config;

      // Check if the plugin has registered its components globally
      if (typeof window !== 'undefined' && window.lokusPluginComponents) {
        const pluginComponents = window.lokusPluginComponents[pluginId];

        if (pluginComponents && pluginComponents[component]) {
          const Component = pluginComponents[component];

          // Validate the component before registering
          if (typeof Component === 'function' || (typeof Component === 'object' && Component.$$typeof)) {
            addStatusBarItem(
              `${pluginId}-${component}`,
              position,
              priority,
              {
                component: Component,
                pluginId,
                tooltip: `${pluginId} status`
              }
            );

            return;
          } else {
          }
        } else {
        }
      } else {
      }

      // Check window.lokus.plugins for component access
      if (typeof window !== 'undefined' && window.lokus && window.lokus.plugins) {
        const plugin = window.lokus.plugins.get(pluginId);
        if (plugin) {
          // For TimeTracker plugin specifically, look for exported components
          if (pluginId === 'TimeTracker' && component === 'TimeTrackerStatus') {
            // Try to get the component from the plugin module
            try {
              // Look for the component in various places
              let Component = null;

              // Try direct access
              if (plugin.TimeTrackerStatus) {
                Component = plugin.TimeTrackerStatus;
              } else if (plugin[component]) {
                Component = plugin[component];
              }

              if (Component) {
                addStatusBarItem(
                  `${pluginId}-${component}`,
                  position,
                  priority,
                  {
                    component: Component,
                    pluginId,
                    tooltip: 'Time Tracker'
                  }
                );

                return;
              }
            } catch { }
          }

          // Generic plugin component handling
          if (plugin[component]) {
            const Component = plugin[component];

            addStatusBarItem(
              `${pluginId}-${component}`,
              position,
              priority,
              {
                component: Component,
                pluginId,
                tooltip: `${pluginId} status`
              }
            );
          }
        }
      }
    } catch { }
  };

  // Add a status bar item
  const addStatusBarItem = (id, position, priority, itemData) => {
    const item = {
      id,
      position,
      priority,
      ...itemData
    };

    if (position === 'left') {
      setLeftItems(prev => {
        const filtered = prev.filter(item => item.id !== id);
        const newItems = [...filtered, item];
        return newItems;
      });
    } else {
      setRightItems(prev => {
        const filtered = prev.filter(item => item.id !== id);
        const newItems = [...filtered, item];
        return newItems;
      });
    }
  };

  // Remove a status bar item
  const removeStatusBarItem = (id) => {
    setLeftItems(prev => prev.filter(item => item.id !== id));
    setRightItems(prev => prev.filter(item => item.id !== id));
  };

  // Update a status bar item
  const updateStatusBarItem = (id, updateData) => {
    const updateItems = (items) =>
      items.map(item =>
        item.id === id ? { ...item, ...updateData } : item
      );

    setLeftItems(updateItems);
    setRightItems(updateItems);
  };

  // Clean up all status bar items for a plugin
  const cleanupPluginStatusBarItems = (pluginId) => {
    const filterItems = (items) =>
      items.filter(item => item.pluginId !== pluginId);

    setLeftItems(filterItems);
    setRightItems(filterItems);
  };

  // Manual API for adding status bar items (can be used by plugins directly)
  const addItem = (id, config) => {
    const { position = 'right', priority = 0, component, ...itemData } = config;

    // Extract actual component if it's wrapped
    let actualComponent = component;
    if (component && typeof component === 'object' && component.default) {
      actualComponent = component.default;
    }

    // Validate component if provided
    if (actualComponent && !(typeof actualComponent === 'function' || (typeof actualComponent === 'object' && actualComponent.$$typeof))) {
      return;
    }

    addStatusBarItem(id, position, priority, { component: actualComponent, ...itemData });
  };

  const removeItem = (id) => {
    removeStatusBarItem(id);
  };

  const updateItem = (id, updateData) => {
    updateStatusBarItem(id, updateData);
  };

  // Expose the API globally for plugin access
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.lokusStatusBar = {
        addItem,
        removeItem,
        updateItem
      };
    }
  }, []);

  return {
    leftItems,
    rightItems,
    addItem,
    removeItem,
    updateItem
  };
}