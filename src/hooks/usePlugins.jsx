import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

const PluginContext = createContext(null);

export function PluginProvider({ children }) {
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [installingPlugins, setInstallingPlugins] = useState(new Set());
  const [enabledPlugins, setEnabledPlugins] = useState(new Set());

  // Load plugins on mount
  useEffect(() => {
    loadPlugins();
  }, []);

  // Listen for plugin system events
  useEffect(() => {
    let isTauri = false; 
    try {
      const w = window;
      isTauri = !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {}
    
    if (isTauri) {
      const unlistenPromise = listen("plugins:updated", () => {
        loadPlugins();
      });
      return () => { unlistenPromise.then(unlisten => unlisten()); };
    } else {
      const onDom = () => loadPlugins();
      window.addEventListener('plugins:updated', onDom);
      return () => window.removeEventListener('plugins:updated', onDom);
    }
  }, []);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      // In a real implementation, this would call the Tauri backend
      // For now, we'll use mock data
      const mockPlugins = [
        {
          id: "markdown-extensions",
          name: "Advanced Markdown Extensions",
          version: "1.2.0",
          description: "Adds support for tables, task lists, and custom syntax highlighting",
          author: "Lokus Team",
          enabled: true,
          permissions: ["file-system", "editor-extensions"],
          lastUpdated: "2024-01-15",
          rating: 4.8,
          downloads: 12500,
          settings: {
            enableTables: true,
            enableTaskLists: true,
            customSyntax: false
          },
          dependencies: [],
          conflicts: [],
          ui: {
            panels: [
              {
                id: 'markdown-tools',
                title: 'Markdown Tools',
                type: 'react-component',
                component: 'MarkdownToolsPanel'
              }
            ]
          }
        },
        {
          id: "git-integration",
          name: "Git Integration",
          version: "2.1.3",
          description: "Seamless Git integration with commit, branch, and merge support",
          author: "Community",
          enabled: false,
          permissions: ["file-system", "network", "shell-commands"],
          lastUpdated: "2024-01-10",
          rating: 4.5,
          downloads: 8900,
          settings: {
            autoCommit: false,
            showBranchStatus: true,
            integrationLevel: "basic"
          },
          dependencies: ["git-cli"],
          conflicts: [],
          ui: {
            panels: [
              {
                id: 'git-status',
                title: 'Git Status',
                type: 'react-component',
                component: 'GitStatusPanel'
              }
            ]
          }
        }
      ];
      
      setPlugins(mockPlugins);
      setEnabledPlugins(new Set(mockPlugins.filter(p => p.enabled).map(p => p.id)));
    } catch (err) {
      setError(err.message);
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const installPlugin = useCallback(async (pluginId, pluginData) => {
    try {
      setInstallingPlugins(prev => new Set(prev).add(pluginId));
      
      // In a real implementation, this would call the Tauri backend
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate installation
      
      // Add to plugins list
      setPlugins(prev => [...prev, { ...pluginData, enabled: false }]);
      
      // Emit plugin update event
      try {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('plugins:updated');
      } catch {
        window.dispatchEvent(new CustomEvent('plugins:updated'));
      }
      
      return true;
    } catch (err) {
      console.error(`Failed to install plugin ${pluginId}:`, err);
      throw err;
    } finally {
      setInstallingPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
    }
  }, []);

  const uninstallPlugin = useCallback(async (pluginId) => {
    try {
      // In a real implementation, this would call the Tauri backend
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate uninstallation
      
      // Remove from plugins list
      setPlugins(prev => prev.filter(p => p.id !== pluginId));
      setEnabledPlugins(prev => {
        const newSet = new Set(prev);
        newSet.delete(pluginId);
        return newSet;
      });
      
      // Emit plugin update event
      try {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('plugins:updated');
      } catch {
        window.dispatchEvent(new CustomEvent('plugins:updated'));
      }
      
      return true;
    } catch (err) {
      console.error(`Failed to uninstall plugin ${pluginId}:`, err);
      throw err;
    }
  }, []);

  const togglePlugin = useCallback(async (pluginId, enabled) => {
    try {
      // In a real implementation, this would call the Tauri backend
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate toggle
      
      // Update plugin state
      setPlugins(prev => prev.map(plugin => 
        plugin.id === pluginId ? { ...plugin, enabled } : plugin
      ));
      
      setEnabledPlugins(prev => {
        const newSet = new Set(prev);
        if (enabled) {
          newSet.add(pluginId);
        } else {
          newSet.delete(pluginId);
        }
        return newSet;
      });
      
      // Emit plugin update event
      try {
        const { emit } = await import('@tauri-apps/api/event');
        await emit('plugins:updated');
      } catch {
        window.dispatchEvent(new CustomEvent('plugins:updated'));
      }
      
      return true;
    } catch (err) {
      console.error(`Failed to toggle plugin ${pluginId}:`, err);
      throw err;
    }
  }, []);

  const updatePluginSettings = useCallback(async (pluginId, settings) => {
    try {
      // In a real implementation, this would call the Tauri backend
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate save
      
      // Update plugin settings
      setPlugins(prev => prev.map(plugin => 
        plugin.id === pluginId ? { ...plugin, settings: { ...plugin.settings, ...settings } } : plugin
      ));
      
      return true;
    } catch (err) {
      console.error(`Failed to update settings for plugin ${pluginId}:`, err);
      throw err;
    }
  }, []);

  const getPlugin = useCallback((pluginId) => {
    return plugins.find(p => p.id === pluginId);
  }, [plugins]);

  const getEnabledPlugins = useCallback(() => {
    return plugins.filter(p => p.enabled);
  }, [plugins]);

  const getPluginPanels = useCallback(() => {
    return plugins
      .filter(p => p.enabled && p.ui?.panels?.length > 0)
      .flatMap(p => p.ui.panels.map(panel => ({ ...panel, pluginId: p.id, pluginName: p.name })));
  }, [plugins]);

  const value = {
    plugins,
    loading,
    error,
    installingPlugins,
    enabledPlugins,
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginSettings,
    getPlugin,
    getEnabledPlugins,
    getPluginPanels,
    refreshPlugins: loadPlugins
  };

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error("usePlugins must be used within a PluginProvider");
  }
  return context;
}

// Hook for managing plugin panels
export function usePluginPanels() {
  const { getPluginPanels } = usePlugins();
  const [activePanel, setActivePanel] = useState(null);
  const [collapsed, setCollapsed] = useState(false);
  const [pinned, setPinned] = useState(false);

  const panels = getPluginPanels();

  // Auto-select first available panel
  useEffect(() => {
    if (panels.length > 0 && !activePanel) {
      setActivePanel(panels[0].id);
    } else if (panels.length === 0) {
      setActivePanel(null);
    }
  }, [panels, activePanel]);

  const openPanel = useCallback((panelId) => {
    setActivePanel(panelId);
    setCollapsed(false);
  }, []);

  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  const toggleCollapse = useCallback(() => {
    setCollapsed(prev => !prev);
  }, []);

  const togglePin = useCallback(() => {
    setPinned(prev => !prev);
  }, []);

  return {
    panels,
    activePanel,
    collapsed,
    pinned,
    openPanel,
    closePanel,
    toggleCollapse,
    togglePin,
    setActivePanel
  };
}