import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import pluginManager from "../core/plugins/PluginManager.js";
import { useProviderStartup } from "./usePerformanceTracking.js";

const PluginContext = createContext(null);

export function PluginProvider({ children }) {
  const [plugins, setPlugins] = useState(pluginManager.allPlugins);
  const [loading, setLoading] = useState(pluginManager.isLoading);
  const [error, setError] = useState(pluginManager.currentError);
  const [installingPlugins, setInstallingPlugins] = useState(pluginManager.installingPluginIds);
  const [enabledPlugins, setEnabledPlugins] = useState(pluginManager.enabledPluginIds);

  // Track PluginProvider initialization time
  useProviderStartup("Plugin System", !loading, {
    pluginCount: plugins.length,
    enabledCount: enabledPlugins.length,
    hasError: !!error
  });

  // Subscribe to plugin manager state changes
  useEffect(() => {
    const unsubscribe = pluginManager.onPluginStateChange((state) => {
      setPlugins(state.plugins);
      setLoading(state.loading);
      setError(state.error);
      setInstallingPlugins(state.installingPlugins);
      setEnabledPlugins(state.enabledPlugins);
    });

    // Trigger initial load
    pluginManager.loadPlugins();

    return unsubscribe;
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
        pluginManager.loadPlugins(true); // Force reload on external updates
      });
      return () => { unlistenPromise.then(unlisten => unlisten()); };
    } else {
      const onDom = () => pluginManager.loadPlugins(true);
      window.addEventListener('plugins:updated', onDom);
      return () => window.removeEventListener('plugins:updated', onDom);
    }
  }, []);

  // Delegate methods to plugin manager
  const loadPlugins = useCallback((forceReload = false) => {
    return pluginManager.loadPlugins(forceReload);
  }, []);

  const installPlugin = useCallback((pluginId, pluginData) => {
    return pluginManager.installPlugin(pluginId, pluginData);
  }, []);

  const uninstallPlugin = useCallback((pluginId) => {
    return pluginManager.uninstallPlugin(pluginId);
  }, []);

  const togglePlugin = useCallback((pluginId, enabled) => {
    return pluginManager.togglePlugin(pluginId, enabled);
  }, []);

  const updatePluginSettings = useCallback((pluginId, settings) => {
    return pluginManager.updatePluginSettings(pluginId, settings);
  }, []);

  const getPlugin = useCallback((pluginId) => {
    return pluginManager.getPlugin(pluginId);
  }, []);

  const getEnabledPlugins = useCallback(() => {
    return pluginManager.getEnabledPlugins();
  }, []);

  const getPluginPanels = useCallback(() => {
    return pluginManager.getPluginPanels();
  }, []);

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