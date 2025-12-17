import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { useToast } from "./use-toast";
import pluginManager from "../core/plugins/PluginStateAdapter.js";

const PluginContext = createContext(null);

export function PluginProvider({ children }) {
  const [plugins, setPlugins] = useState(pluginManager.allPlugins);
  const [loading, setLoading] = useState(pluginManager.isLoading);
  const [error, setError] = useState(pluginManager.currentError);
  const [installingPlugins, setInstallingPlugins] = useState(pluginManager.installingPluginIds);
  const [enabledPlugins, setEnabledPlugins] = useState(pluginManager.enabledPluginIds);
  const { toast } = useToast();

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
    } catch { }

    // Expose manual loader for dev mode
    window.loadDevPlugin = async (url) => {
      console.log(`[Manual] Loading dev plugin from ${url}...`);
      try {
        await pluginManager.loadDevPlugin(url);
        console.log('[Manual] Plugin loaded successfully');
        return "Success";
      } catch (e) {
        console.error('[Manual] Failed to load plugin:', e);
        throw e;
      }
    };

    if (isTauri) {
      const unlistenPromise = listen("plugins:updated", () => {
        pluginManager.loadPlugins(true); // Force reload on external updates
      });

      // Listen for deep links (e.g. lokus://plugin-dev?url=...)
      const deepLinkUnlistenPromise = listen("deep-link-received", async (event) => {
        const urlStr = event.payload;
        if (typeof urlStr === 'string' && urlStr.startsWith('lokus://plugin-dev')) {
          try {
            const urlObj = new URL(urlStr);
            const devUrl = urlObj.searchParams.get('url');
            if (devUrl) {
              toast({
                title: "Loading Dev Plugin",
                description: `Connecting to ${devUrl}...`,
              });

              await pluginManager.loadDevPlugin(devUrl);

              toast({
                title: "Plugin Loaded",
                description: "Development plugin loaded successfully.",
                variant: "success" // Assuming success variant exists, or default
              });
            }
          } catch (error) {
            console.error("Failed to load dev plugin from deep link:", error);
            toast({
              title: "Plugin Load Failed",
              description: error.message,
              variant: "destructive"
            });
          }
        }
      });

      return () => {
        unlistenPromise.then(unlisten => unlisten());
        deepLinkUnlistenPromise.then(unlisten => unlisten());
      };
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