// Plugin cage. Runs inside a dedicated Worker: no DOM, no Tauri, no window.
// The only way out is the `lokus` API, which is RPC to the host.
import {
  request, logMsg, errorMsg, isValidMessage, PendingRequests,
} from './rpc.js';

const pending = new PendingRequests();
const eventListeners = new Map();
let pluginExports = null;

const scopedConsole = {};
for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  scopedConsole[level] = (...args) => {
    try {
      self.postMessage(logMsg(level, args.map((a) => {
        try { return typeof a === 'string' ? a : JSON.stringify(a); } catch { return String(a); }
      }).join(' ')));
    } catch { /* console must never crash the plugin */ }
  };
}

function call(method, args = {}) {
  return new Promise((resolve, reject) => {
    const msg = request(method, args);
    pending.track(msg.id, resolve, reject);
    self.postMessage(msg);
  });
}

function on(event, handler) {
  if (!eventListeners.has(event)) eventListeners.set(event, new Set());
  eventListeners.get(event).add(handler);
  return () => eventListeners.get(event)?.delete(handler);
}

const api = {
  commands: {
    execute: (id, args) => call('commands.execute', { id, args }),
  },
  ui: {
    notify: ({ message, type = 'info', title } = {}) => call('ui.notify', { message, type, title }),
    setStatusBarItem: (itemId, patch) => call('ui.statusbar', { itemId, patch }),
  },
  editor: {
    insert: (text) => call('editor.insert', { text }),
  },
  notes: {
    list: (opts = {}) => call('notes.list', opts),
    read: (path) => call('notes.read', { path }),
    write: (path, content) => call('notes.write', { path, content }),
  },
  storage: {
    get: (key) => call('storage.get', { key }),
    set: (key, value) => call('storage.set', { key, value }),
    delete: (key) => call('storage.delete', { key }),
  },
  network: {
    fetch: (url, opts = {}) => call('network.fetch', { url, opts }),
  },
  overlay: {
    show: (overlayId) => call('overlay.show', { overlayId }),
    hide: (overlayId) => call('overlay.hide', { overlayId }),
  },
  workspace: {
    info: () => call('workspace.info', {}),
  },
  on,
};

async function runPlugin(code) {
  const module = { exports: {} };
  const factory = new Function('module', 'exports', 'lokus', 'console', code);
  factory(module, module.exports, api, scopedConsole);
  pluginExports = module.exports || {};
  if (typeof pluginExports.activate === 'function') {
    await pluginExports.activate(api);
  }
}

self.onmessage = async (e) => {
  const m = e.data;
  if (!isValidMessage(m)) return;

  if (m.kind === 'init') {
    try {
      await runPlugin(m.code);
      self.postMessage({ v: 3, kind: 'ready' });
    } catch (err) {
      self.postMessage(errorMsg(`activate failed: ${err && err.message}`));
    }
    return;
  }

  if (m.kind === 'res') {
    pending.settle(m.id, m.ok, m.result, m.error);
    return;
  }

  if (m.kind === 'evt') {
    const handlers = eventListeners.get(m.event);
    if (handlers) {
      for (const handler of handlers) {
        try { handler(m.data); } catch (err) {
          self.postMessage(errorMsg(`event handler for "${m.event}" failed: ${err && err.message}`));
        }
      }
    }
    return;
  }

  if (m.kind === 'deactivate') {
    try {
      if (pluginExports && typeof pluginExports.deactivate === 'function') {
        await pluginExports.deactivate();
      }
    } catch (err) {
      self.postMessage(errorMsg(`deactivate failed: ${err && err.message}`));
    } finally {
      pending.rejectAll('plugin deactivated');
      eventListeners.clear();
      self.postMessage({ v: 3, kind: 'deactivated' });
    }
  }
};

self.onerror = (e) => {
  try {
    self.postMessage(errorMsg(e && e.message ? e.message : 'plugin crashed'));
  } catch { /* nothing left to do */ }
};
