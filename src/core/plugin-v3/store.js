import { invoke } from '@tauri-apps/api/core';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { homeDir, join } from '@tauri-apps/api/path';

export function isTauri() {
  try {
    const w = window;
    return !!(
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (navigator?.userAgent || '').includes('Tauri')
    );
  } catch {
    return false;
  }
}

export const backend = {
  async listPlugins() {
    if (!isTauri()) return [];
    const infos = await invoke('list_plugins');
    return infos.map((info) => ({
      folder: String(info.path || '').split(/[\\/]/).filter(Boolean).pop() || '',
      path: info.path,
      manifest: info.manifest || {},
    }));
  },

  async enabledIds() {
    if (!isTauri()) return [];
    return invoke('get_enabled_plugins');
  },

  enable(key) { return invoke('enable_plugin', { name: key }); },
  disable(key) { return invoke('disable_plugin', { name: key }); },

  async grants(key) {
    try {
      return await invoke('get_plugin_permissions', { pluginName: key });
    } catch {
      return [];
    }
  },

  saveGrants(key, caps) {
    return invoke('set_plugin_permission', { pluginName: key, permissions: caps });
  },

  saveSetting(key, settingKey, value) {
    return invoke('set_plugin_setting', { pluginName: key, key: settingKey, value });
  },

  async readSource(folder, main) {
    if (!folder || !main || main.includes('..') || main.startsWith('/')) {
      throw new Error('invalid plugin main path');
    }
    const home = await homeDir();
    const path = await join(home, '.lokus', 'plugins', folder, main);
    return readTextFile(path);
  },

  uninstall(key) { return invoke('uninstall_plugin', { name: key }); },
};
