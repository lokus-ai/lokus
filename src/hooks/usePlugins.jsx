import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { confirm } from '@tauri-apps/plugin-dialog';
import { host, contributions } from '../core/plugin-v3/index.js';
import { startSlotSync } from '../core/plugin-v3/slots.js';
import { usePluginSnapshot, useContributed } from '../features/plugin-v3/hooks.js';
import AskScreen from '../features/plugin-v3/AskScreen.jsx';
import PluginConsole from '../features/plugin-v3/PluginConsole.jsx';

const PluginContext = createContext(null);
const IS_APPSTORE = import.meta.env.VITE_APPSTORE === 'true';

export function PluginProvider({ children }) {
  const snap = usePluginSnapshot();
  const panels = useContributed('panels');
  const [ask, setAsk] = useState(null);
  const [consoleId, setConsoleId] = useState(null);
  const [installingPlugins, setInstallingPlugins] = useState(new Set());

  const askForGrants = useCallback(
    (manifest) => new Promise((resolve) => setAsk({ manifest, resolve })),
    []
  );

  useEffect(() => {
    host.confirmGrants = (manifest) => askForGrants(manifest);
    const stopSlots = startSlotSync(host, contributions);
    host.init();

    let unlistenDeep = null;
    if (!IS_APPSTORE) {
      listen('deep-link-received', async (event) => {
        const urlStr = event.payload;
        if (typeof urlStr !== 'string' || !urlStr.startsWith('lokus://plugin-dev')) return;
        let devUrl = null;
        try { devUrl = new URL(urlStr).searchParams.get('url'); } catch { return; }
        if (!devUrl) return;
        const ok = await confirm(
          `Load a development plugin from:\n\n${devUrl}\n\nThis runs third-party code on your computer. Only continue if you trust this source.`,
          { title: 'Load development plugin?', kind: 'warning' }
        ).catch(() => false);
        if (ok) host.loadDevPlugin(devUrl).catch((e) => console.error('[plugins v3] dev load failed:', e));
      }).then((un) => { unlistenDeep = un; }).catch(() => {});
    }

    const onRegistryInstall = async (event) => {
      const slug = event?.detail?.slug;
      if (!slug || IS_APPSTORE) return;
      const ok = await confirm(
        `Install plugin "${slug}" from the Lokus registry?\n\nYou will see its permission requests before it is enabled.`,
        { title: 'Install plugin?', kind: 'question' }
      ).catch(() => false);
      if (!ok) return;
      try {
        const rec = await host.installMarketplace(slug, event?.detail?.version);
        const caps = await askForGrants(rec.manifest);
        if (caps === null) {
          await host.uninstall(rec.id);
          return;
        }
        await host.approveInstall(rec.id, caps);
      } catch (e) {
        console.error('[plugins v3] registry install failed:', e);
      }
    };
    window.addEventListener('plugin-install-from-registry', onRegistryInstall);

    return () => {
      stopSlots();
      if (typeof unlistenDeep === 'function') unlistenDeep();
      window.removeEventListener('plugin-install-from-registry', onRegistryInstall);
    };
  }, [askForGrants]);

  const installPlugin = useCallback(async (pluginId, data = {}) => {
    setInstallingPlugins((prev) => new Set(prev).add(pluginId));
    try {
      if (data.fromMarketplace) {
        const rec = await host.installMarketplace(pluginId, data.version);
        const caps = await askForGrants(rec.manifest);
        if (caps === null) {
          await host.uninstall(rec.id);
          throw new Error('Install cancelled');
        }
        await host.approveInstall(rec.id, caps);
        return true;
      }

      if (data.path) {
        const before = new Set(host.getSnapshot().plugins.map((p) => p.id));
        await invoke('install_plugin', { path: data.path });
        await host.refresh();
        const rec = host.getSnapshot().plugins
          .map((p) => host.get(p.id))
          .find((r) => r && !before.has(r.id));
        if (!rec) throw new Error('Install finished but the plugin was not found');
        const caps = await askForGrants(rec.manifest);
        if (caps === null) {
          await host.uninstall(rec.id);
          throw new Error('Install cancelled');
        }
        await host.approveInstall(rec.id, caps);
        return true;
      }

      throw new Error('No install source provided');
    } finally {
      setInstallingPlugins((prev) => {
        const next = new Set(prev);
        next.delete(pluginId);
        return next;
      });
    }
  }, [askForGrants]);

  const uninstallPlugin = useCallback((pluginId) => host.uninstall(pluginId), []);

  const togglePlugin = useCallback((pluginId, enabled) => {
    return enabled ? host.enable(pluginId) : host.disable(pluginId);
  }, []);

  const updatePluginSettings = useCallback(async (pluginId, settings) => {
    const rec = host.get(pluginId);
    if (!rec) return false;
    await host.backend.saveSetting(rec.folder, 'settings', settings);
    return true;
  }, []);

  const getPlugin = useCallback((pluginId) => {
    const rec = host.get(pluginId);
    if (!rec) return null;
    return {
      id: rec.id,
      name: rec.manifest?.name || rec.id,
      version: rec.manifest?.version,
      description: rec.manifest?.description,
      enabled: rec.enabled,
      status: rec.status,
      v3: rec.v3,
      manifest: rec.manifest,
      path: rec.path,
      capabilities: rec.manifest?.capabilities || [],
    };
  }, []);

  const plugins = snap.plugins.map((p) => {
    const rec = host.get(p.id);
    return {
      ...p,
      manifest: rec?.manifest,
      author: rec?.manifest?.author,
      path: rec?.path,
      devUrl: rec?.devUrl,
      capabilities: rec?.manifest?.capabilities || [],
    };
  });

  const value = {
    plugins,
    loading: snap.loading,
    error: snap.error,
    installingPlugins,
    enabledPlugins: new Set(plugins.filter((p) => p.enabled).map((p) => p.id)),
    installPlugin,
    uninstallPlugin,
    togglePlugin,
    updatePluginSettings,
    getPlugin,
    getEnabledPlugins: () => plugins.filter((p) => p.enabled),
    getPluginPanels: () => panels,
    refreshPlugins: () => host.refresh(),
    openConsole: setConsoleId,
    getLogs: (id) => host.getLogs(id),
    getBlockedCalls: (id) => host.getAudit(id).filter((d) => !d.allowed),
  };

  return (
    <PluginContext.Provider value={value}>
      {children}
      <AskScreen
        request={ask}
        onAllow={(caps) => { ask?.resolve(caps); setAsk(null); }}
        onCancel={() => { ask?.resolve(null); setAsk(null); }}
      />
      <PluginConsole pluginId={consoleId} onClose={() => setConsoleId(null)} />
    </PluginContext.Provider>
  );
}

export function usePlugins() {
  const context = useContext(PluginContext);
  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }
  return context;
}

export function usePluginPanels() {
  const { getPluginPanels } = usePlugins();
  const panels = getPluginPanels();
  return { panels };
}
