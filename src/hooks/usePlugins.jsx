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
        // Load real plugins from Tauri backend
        const [pluginInfos, enabledPluginNames] = await Promise.all([
          invoke('list_plugins'),
          invoke('get_enabled_plugins')
        ]);
        
        // Convert backend format to frontend format
        const convertedPlugins = pluginInfos.map(pluginInfo => ({
          id: pluginInfo.manifest.name,
          name: pluginInfo.manifest.name,
          version: pluginInfo.manifest.version,
          description: pluginInfo.manifest.description,
          author: pluginInfo.manifest.author,
          enabled: enabledPluginNames.includes(pluginInfo.manifest.name),
          permissions: pluginInfo.manifest.permissions,
          lastUpdated: pluginInfo.installed_at,
          path: pluginInfo.path,
          size: pluginInfo.size,
          main: pluginInfo.manifest.main,
          dependencies: pluginInfo.manifest.dependencies || {},
          keywords: pluginInfo.manifest.keywords || [],
          repository: pluginInfo.manifest.repository,
          homepage: pluginInfo.manifest.homepage,
          license: pluginInfo.manifest.license,
          // Default UI properties for now
          rating: 0,
          downloads: 0,
          settings: {},
          conflicts: [],
          ui: {
            panels: []
          }
        }));
        
        setPlugins(convertedPlugins);
        setEnabledPlugins(new Set(enabledPluginNames));
      } else {
        // Browser mode - use empty list for now
        setPlugins([]);
        setEnabledPlugins(new Set());
      }
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
        // Use real Tauri commands
        if (enabled) {
          await invoke('enable_plugin', { name: pluginId });
        } else {
          await invoke('disable_plugin', { name: pluginId });
        }
      } else {
        // Browser mode - simulate delay
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Update local state
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