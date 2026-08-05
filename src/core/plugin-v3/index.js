import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { PluginHost } from './host.js';
import { ContributionRegistry } from './contributions.js';
import { backend, isTauri } from './store.js';

export const contributions = new ContributionRegistry();

function defaultWorkerFactory() {
  return new Worker(new URL('./worker-entry.js', import.meta.url), { type: 'module' });
}

const MAX_NOTE_BYTES = 2_000_000;
const MAX_FETCH_CHARS = 1_000_000;
const overlayWindows = new Map();

function resolveVaultPath(relPath) {
  const workspace = host.workspacePath;
  if (!workspace) throw new Error('no workspace is open');
  if (!relPath || relPath.startsWith('/') || relPath.includes('..')) {
    throw new Error('path must be relative to the vault and must not contain ".."');
  }
  const joined = `${workspace.replace(/[\\/]+$/, '')}/${relPath}`;
  if (!joined.startsWith(workspace)) throw new Error('path escapes the vault');
  return joined;
}

export const effects = {
  toast(message, type = 'info', title) {
    try {
      const fn = type === 'error' ? toast.error : type === 'success' ? toast.success : toast.info;
      fn(message, title ? { description: title } : undefined);
    } catch { /* toast must never break the host */ }
  },

  insertIntoEditor(text) {
    import('../../plugins/api/EditorAPI.js')
      .then(({ editorAPI }) => editorAPI.insertContent(String(text || '')))
      .catch(() => {
        window.dispatchEvent(new CustomEvent('pv3:editor-insert', { detail: { text } }));
      });
  },

  executeCommand(id, args) {
    import('../../plugins/registry/CommandRegistry.js')
      .then(({ commandRegistry }) => {
        if (commandRegistry.exists(id)) return commandRegistry.execute(id, args);
        window.dispatchEvent(new CustomEvent('pv3:command', { detail: { id, args } }));
        return null;
      })
      .catch(() => {
        window.dispatchEvent(new CustomEvent('pv3:command', { detail: { id, args } }));
      });
    return true;
  },

  async listNotes(_pluginId, opts = {}) {
    if (!isTauri()) return [];
    if (!host.workspacePath) throw new Error('no workspace is open');
    const entries = await invoke('read_directory', { path: host.workspacePath });
    const names = (Array.isArray(entries) ? entries : []).map((e) => (typeof e === 'string' ? e : e?.name)).filter(Boolean);
    const md = names.filter((n) => n.toLowerCase().endsWith('.md'));
    const limit = Math.min(Number(opts.limit) || 500, 2000);
    return md.slice(0, limit);
  },

  async readNote(_pluginId, relPath) {
    const abs = resolveVaultPath(relPath);
    const content = await invoke('read_file_content', { path: abs });
    if (typeof content === 'string' && content.length > MAX_NOTE_BYTES) {
      throw new Error('note is too large to read through the plugin API');
    }
    return content;
  },

  async writeNote(_pluginId, relPath, content) {
    if (typeof content !== 'string') throw new Error('content must be a string');
    if (content.length > MAX_NOTE_BYTES) throw new Error('content is too large to write through the plugin API');
    const abs = resolveVaultPath(relPath.endsWith('.md') ? relPath : `${relPath}.md`);
    await invoke('write_file_content', { path: abs, content });
    return true;
  },

  storageGet(pluginId, key) {
    try {
      const raw = localStorage.getItem(`pv3:${pluginId}:${key}`);
      if (raw === null) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    } catch { return null; }
  },

  storageSet(pluginId, key, value) {
    try {
      localStorage.setItem(`pv3:${pluginId}:${key}`, JSON.stringify(value));
      return true;
    } catch {
      throw new Error('storage is full or unavailable');
    }
  },

  storageDelete(pluginId, key) {
    try { localStorage.removeItem(`pv3:${pluginId}:${key}`); return true; } catch { return false; }
  },

  async netFetch(_pluginId, url, opts = {}) {
    let parsed;
    try { parsed = new URL(url); } catch { throw new Error('invalid URL'); }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('only http(s) URLs are allowed');
    }
    const res = await fetch(url, {
      method: typeof opts.method === 'string' ? opts.method.toUpperCase() : 'GET',
      headers: opts.headers && typeof opts.headers === 'object' ? opts.headers : undefined,
      body: typeof opts.body === 'string' ? opts.body : undefined,
    });
    const body = await res.text();
    return { status: res.status, body: body.slice(0, MAX_FETCH_CHARS), truncated: body.length > MAX_FETCH_CHARS };
  },

  async showOverlay(pluginId, overlayId) {
    const rec = host.get(pluginId);
    const spec = rec?.manifest?.contributes?.overlays?.find((o) => o.id === overlayId);
    if (!spec) throw new Error(`overlay "${overlayId}" is not declared in the manifest`);
    const key = `pv3-overlay-${pluginId}-${overlayId}`;
    if (overlayWindows.has(key)) {
      try { await overlayWindows.get(key).setFocus(); return true; } catch { overlayWindows.delete(key); }
    }
    const { WebviewWindow } = await import('@tauri-apps/plugin-window');
    const { convertFileSrc } = await import('@tauri-apps/api/core');
    const url = convertFileSrc(`${rec.path}/${spec.src}`);
    const win = new WebviewWindow(key, {
      url,
      title: spec.title,
      width: spec.width,
      height: spec.height,
      transparent: true,
      decorations: false,
      alwaysOnTop: true,
      resizable: true,
      skipTaskbar: true,
    });
    overlayWindows.set(key, win);
    if (spec.clickThrough) {
      try { await win.setIgnoreCursorEvents(true); } catch { /* best effort */ }
    }
    return true;
  },

  async hideOverlay(pluginId, overlayId) {
    const key = `pv3-overlay-${pluginId}-${overlayId}`;
    const win = overlayWindows.get(key);
    if (!win) return false;
    overlayWindows.delete(key);
    try { await win.close(); } catch { /* already closed */ }
    return true;
  },

  workspaceInfo() {
    return { path: host.workspacePath || null };
  },
};

async function marketplaceInstaller(slug, version) {
  const { RegistryAPI } = await import('../../plugins/registry/RegistryAPI.js');
  const registry = new RegistryAPI();
  const response = await registry.downloadPlugin(slug, version);
  const blob = response.data;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  const { tempDir, join } = await import('@tauri-apps/api/path');
  const dir = await tempDir();
  const file = await join(dir, `${slug}-${version || 'latest'}.lokus`);
  await writeFile(file, bytes);
  return invoke('install_plugin', { path: file });
}

export const host = new PluginHost({
  backend,
  contributions,
  workerFactory: defaultWorkerFactory,
  effects,
  installer: isTauri() ? marketplaceInstaller : null,
});

export default host;
