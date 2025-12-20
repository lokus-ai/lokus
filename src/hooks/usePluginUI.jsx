/**
 * Hook for managing plugin UI elements
 * Provides access to plugin-contributed panels, status bar items, and commands
 */

import { useState, useEffect, useCallback } from 'react';
import pluginManager from '../core/plugins/PluginStateAdapter.js';
import { listen } from '@tauri-apps/api/event';

export function usePluginUI() {
  const [statusBarItems, setStatusBarItems] = useState([]);
  const [panels, setPanels] = useState([]);
  const [commands, setCommands] = useState(new Map());

  // Listen for plugin UI updates
  useEffect(() => {
    let unlisten = null;
    let commandUnlisten = null;
    let isMounted = true;

    const setupListeners = async () => {
      try {
        // Listen for status bar item updates
        unlisten = await listen('status-bar-item-updated', (event) => {
          if (!isMounted) return;
          const { pluginId, action, item } = event.payload;

          setStatusBarItems(prev => {
            switch (action) {
              case 'create':
              case 'show':
                // Add or update item
                const filtered = prev.filter(i => i.id !== item.id);
                return [...filtered, { ...item, pluginId }];

              case 'hide':
              case 'dispose':
                // Remove item
                return prev.filter(i => i.id !== item.id);

              default:
                return prev;
            }
          });
        });

        // Listen for command registrations
        commandUnlisten = await listen('command-registered', (event) => {
          if (!isMounted) return;
          const { pluginId, command, title } = event.payload;

          setCommands(prev => {
            const newCommands = new Map(prev);
            newCommands.set(command, {
              pluginId,
              title,
              execute: (...args) => executePluginCommand(pluginId, command, args)
            });
            return newCommands;
          });
        });
      } catch (error) {
        // Silently handle setup errors
      }
    };

    setupListeners();

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
      if (commandUnlisten) commandUnlisten();
    };
  }, []);

  // Update panels from active plugins
  useEffect(() => {
    const updatePanels = () => {
      const activePanels = [];
      const activePlugins = pluginManager.getActivePlugins();

      activePlugins.forEach(pluginId => {
        const pluginInfo = pluginManager.getPlugin(pluginId);
        if (pluginInfo && pluginInfo.context && pluginInfo.context.panels) {
          pluginInfo.context.panels.forEach((panel, panelId) => {
            activePanels.push({
              id: panelId,
              pluginId,
              pluginName: pluginInfo.info.name || pluginId,
              ...panel
            });
          });
        }
      });

      setPanels(activePanels);
    };

    // Update panels initially and whenever plugins change
    updatePanels();

    // Set up interval to check for panel updates
    const interval = setInterval(updatePanels, 1000);

    return () => clearInterval(interval);
  }, []);

  const executePluginCommand = useCallback(async (pluginId, command, args) => {
    try {
      const pluginInfo = pluginManager.getPlugin(pluginId);
      if (pluginInfo && pluginInfo.context && pluginInfo.context.commands) {
        const handler = pluginInfo.context.commands.get(command);
        if (handler && typeof handler === 'function') {
          return await handler(...args);
        }
      }
    } catch { }
  }, []);

  const getPluginAPI = useCallback((pluginId) => {
    return pluginManager.getPluginAPI(pluginId);
  }, []);

  const getStatusBarItems = useCallback(() => {
    return statusBarItems.filter(item => item && item.text);
  }, [statusBarItems]);

  const getPanels = useCallback(() => {
    return panels;
  }, [panels]);

  const getCommands = useCallback(() => {
    return Array.from(commands.entries()).map(([command, info]) => ({
      command,
      ...info
    }));
  }, [commands]);

  const executeCommand = useCallback(async (command, ...args) => {
    if (commands.has(command)) {
      const commandInfo = commands.get(command);
      return await commandInfo.execute(...args);
    }
    throw new Error(`Command ${command} not found`);
  }, [commands]);

  return {
    statusBarItems: getStatusBarItems(),
    panels: getPanels(),
    commands: getCommands(),
    executeCommand,
    getPluginAPI,
    executePluginCommand
  };
}

export default usePluginUI;