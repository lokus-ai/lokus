import { validateManifest, isV3Manifest, parseActivation } from './contract.js';
import { CapabilityGate } from './gate.js';
import { createBridge } from './bridge.js';
import { initMsg, deactivateMsg, evt, response, isValidMessage, PendingRequests } from './rpc.js';

const READY_TIMEOUT_MS = 8000;
const DEACTIVATE_TIMEOUT_MS = 1500;
const MAX_STRIKES = 3;
const LOG_LIMIT = 100;

function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export class PluginHost {
  constructor({ backend, contributions, workerFactory, effects, installer = null, confirmGrants = null }) {
    this.backend = backend;
    this.contributions = contributions;
    this.workerFactory = workerFactory;
    this.effects = effects;
    this.installer = installer;
    this.confirmGrants = confirmGrants;

    this.plugins = new Map();
    this.workerState = new Map();
    this.workspacePath = null;
    this.loading = true;
    this.error = null;
    this.listeners = new Set();
    this._snapshot = null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this._snapshot = null;
    for (const fn of this.listeners) {
      try { fn(); } catch { /* UI listeners must not break the host */ }
    }
  }

  getSnapshot() {
    if (this._snapshot) return this._snapshot;
    this._snapshot = {
      loading: this.loading,
      error: this.error,
      plugins: Array.from(this.plugins.values()).map((rec) => ({
        id: rec.id,
        name: rec.manifest?.name || rec.id,
        version: rec.manifest?.version,
        description: rec.manifest?.description,
        enabled: rec.enabled,
        status: rec.status,
        v3: rec.v3,
        capabilities: rec.manifest?.capabilities || [],
        health: { strikes: rec.health.strikes, lastError: rec.health.lastError },
      })),
    };
    return this._snapshot;
  }

  get(id) { return this.plugins.get(id); }
  getLogs(id) { return this.get(id)?.health.logs || []; }
  getAudit(id) { return this.get(id)?.gate?.audit || []; }

  setWorkspacePath(path) { this.workspacePath = path; }

  async init() {
    try {
      const [list, enabledRaw] = await Promise.all([this.backend.listPlugins(), this.backend.enabledIds()]);
      const enabled = new Set(enabledRaw);
      for (const p of list) this.ingest(p, enabled);
      this.error = null;
      for (const rec of this.plugins.values()) {
        if (rec.status === 'enabled' && this.activatesOn(rec, 'startup')) {
          await this.activate(rec.id).catch((err) => this.strike(rec.id, `startup failed: ${err.message}`));
        }
      }
    } catch (err) {
      this.error = err.message;
    } finally {
      this.loading = false;
      this.notify();
    }
  }

  ingest({ folder, path, manifest }, enabledSet) {
    const v3 = isV3Manifest(manifest);
    const validation = v3 ? validateManifest(manifest) : null;
    const id = manifest?.id || manifest?.name || folder;
    const isEnabled = enabledSet.has(folder) || enabledSet.has(manifest?.id) || enabledSet.has(manifest?.name);
    const rec = {
      id,
      folder,
      path,
      manifest,
      v3: v3 && validation.valid,
      enabled: isEnabled,
      status: !v3 ? 'unsupported' : !validation.valid ? 'invalid' : isEnabled ? 'enabled' : 'disabled',
      health: { strikes: 0, lastError: null, logs: [] },
      worker: null,
      gate: null,
      devUrl: null,
      devGrants: null,
    };
    if (rec.status === 'invalid') rec.health.lastError = validation.errors.join('; ');
    this.plugins.set(id, rec);
    if (rec.v3 && rec.enabled) this.contributions.register(id, manifest);
    return rec;
  }

  activatesOn(rec, kind, value = null) {
    for (const raw of rec.manifest?.activation || []) {
      const parsed = raw === 'startup' ? { kind: 'startup' } : parseActivation(raw);
      if (!parsed) continue;
      if (parsed.kind === kind && (value === null || parsed.value === value)) return true;
    }
    return false;
  }

  async activate(id) {
    const rec = this.plugins.get(id);
    if (!rec) throw new Error(`plugin not found: ${id}`);
    if (!rec.v3) throw new Error(`plugin "${id}" is not a v3 plugin and cannot run`);
    if (rec.status === 'active') return;

    const code = rec.devUrl
      ? await this.fetchDevSource(rec)
      : await this.backend.readSource(rec.folder, rec.manifest.main);

    const grants = rec.devUrl ? (rec.devGrants || []) : await this.backend.grants(rec.id);
    const gate = new CapabilityGate(id, grants, (d) => {
      if (!d.allowed && d.reason === 'not-granted') {
        this.pushLog(id, 'warn', `blocked ${d.method} — needs "${d.capability}"`);
      }
    });

    const worker = this.workerFactory();
    const state = { pending: new PendingRequests(), readyResolve: null, readyReject: null, deactivatedResolve: null };
    this.workerState.set(id, state);
    rec.worker = worker;
    rec.gate = gate;
    rec.status = 'activating';
    this.notify();

    const bridge = createBridge({
      pluginId: id,
      gate,
      effects: this.effects,
      contributions: this.contributions,
    });
    worker.onmessage = (e) => this.onWorkerMessage(id, e, bridge);
    worker.onerror = (e) => this.strike(id, e?.message || 'plugin worker crashed');

    const ready = new Promise((resolve, reject) => {
      state.readyResolve = resolve;
      state.readyReject = reject;
    });
    worker.postMessage(initMsg({ pluginId: id, manifest: rec.manifest, code }));

    try {
      await withTimeout(ready, READY_TIMEOUT_MS, 'plugin did not become ready in time');
    } catch (err) {
      await this.teardownWorker(id);
      this.strike(id, err.message);
      throw err;
    }

    this.contributions.register(id, rec.manifest);
    rec.status = 'active';
    rec.health.strikes = 0;
    this.pushLog(id, 'info', 'activated');
    this.notify();
  }

  onWorkerMessage(id, e, bridge) {
    const m = e.data;
    if (!isValidMessage(m)) return;
    const state = this.workerState.get(id);
    if (!state) return;

    switch (m.kind) {
      case 'ready':
        state.readyResolve?.();
        break;
      case 'deactivated':
        state.deactivatedResolve?.();
        break;
      case 'error':
        this.strike(id, m.message);
        break;
      case 'log':
        this.pushLog(id, m.level || 'info', m.message);
        break;
      case 'req':
        bridge.dispatch(m.method, m.args)
          .then((result) => this.safePost(id, response(m.id, true, result)))
          .catch((err) => this.safePost(id, response(m.id, false, null, err.message)));
        break;
      default:
        break;
    }
  }

  safePost(id, message) {
    const rec = this.plugins.get(id);
    try { rec?.worker?.postMessage(message); } catch { /* worker already gone */ }
  }

  emitToPlugin(id, event, data = null) {
    this.safePost(id, evt(event, data));
  }

  async deactivate(id) {
    const rec = this.plugins.get(id);
    if (!rec) return;
    if (!rec.worker) return;
    const state = this.workerState.get(id);
    const done = new Promise((resolve) => { state.deactivatedResolve = resolve; });
    this.safePost(id, deactivateMsg());
    await withTimeout(done, DEACTIVATE_TIMEOUT_MS, 'deactivate timed out').catch(() => {});
    await this.teardownWorker(id);
    if (rec.status !== 'error') rec.status = rec.enabled ? 'enabled' : 'disabled';
    this.pushLog(id, 'info', 'deactivated');
    this.notify();
  }

  async teardownWorker(id) {
    const rec = this.plugins.get(id);
    const state = this.workerState.get(id);
    try { rec?.worker?.terminate(); } catch { /* already terminated */ }
    state?.pending.rejectAll('plugin stopped');
    this.workerState.delete(id);
    if (rec) rec.worker = null;
  }

  strike(id, message) {
    const rec = this.plugins.get(id);
    if (!rec) return;
    rec.health.strikes += 1;
    rec.health.lastError = message;
    this.pushLog(id, 'error', message);
    if (rec.health.strikes >= MAX_STRIKES && rec.worker) {
      this.deactivate(id).then(() => {
        rec.status = 'error';
        this.effects.toast(`Plugin "${rec.manifest?.name || id}" was stopped after repeated errors`, 'error');
        this.notify();
      });
    }
    this.notify();
  }

  pushLog(id, level, message) {
    const rec = this.plugins.get(id);
    if (!rec) return;
    rec.health.logs.push({ level, message, at: Date.now() });
    if (rec.health.logs.length > LOG_LIMIT) rec.health.logs.splice(0, rec.health.logs.length - LOG_LIMIT);
  }

  async enable(id) {
    const rec = this.plugins.get(id);
    if (!rec) throw new Error(`plugin not found: ${id}`);
    if (!rec.v3) throw new Error(`plugin "${id}" is not a v3 plugin and cannot run`);
    if (!rec.devUrl) await this.backend.enable(rec.folder);
    rec.enabled = true;
    this.contributions.register(id, rec.manifest);
    await this.activate(id);
  }

  async disable(id) {
    const rec = this.plugins.get(id);
    if (!rec) throw new Error(`plugin not found: ${id}`);
    rec.enabled = false;
    await this.deactivate(id);
    this.contributions.unregister(id);
    if (!rec.devUrl) await this.backend.disable(rec.folder);
    this.notify();
  }

  async uninstall(id) {
    const rec = this.plugins.get(id);
    if (!rec) return;
    await this.deactivate(id);
    if (!rec.devUrl) await this.backend.uninstall(rec.folder);
    this.plugins.delete(id);
    this.contributions.unregister(id);
    this.notify();
  }

  async refresh() {
    const list = await this.backend.listPlugins();
    const enabled = new Set(await this.backend.enabledIds());
    const seen = new Set();
    for (const p of list) {
      seen.add(p.manifest?.id || p.manifest?.name || p.folder);
      if (!this.plugins.has(p.manifest?.id || p.manifest?.name || p.folder)) this.ingest(p, enabled);
    }
    for (const [id, rec] of this.plugins) {
      if (!rec.devUrl && !seen.has(id)) {
        await this.deactivate(id);
        this.plugins.delete(id);
      }
    }
    this.notify();
  }

  async installMarketplace(slug, version) {
    if (!this.installer) throw new Error('marketplace installs are not available here');
    await this.installer(slug, version);
    await this.refresh();
    const rec = Array.from(this.plugins.values()).find(
      (r) => r.manifest?.name === slug || r.id === slug || r.folder === slug
    );
    if (!rec) throw new Error('install finished but the plugin was not found');
    return rec;
  }

  async approveInstall(id, grantedCaps) {
    const rec = this.plugins.get(id);
    if (!rec) throw new Error(`plugin not found: ${id}`);
    await this.backend.saveGrants(rec.folder, grantedCaps);
    await this.enable(id);
  }

  async loadDevPlugin(url) {
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    const manifestRes = await fetch(`${baseUrl}plugin.json`);
    if (!manifestRes.ok) throw new Error(`could not fetch plugin.json from ${baseUrl}`);
    const rawManifest = await manifestRes.json();
    const validation = validateManifest(rawManifest);
    if (!validation.valid) throw new Error(`invalid manifest: ${validation.errors.join('; ')}`);
    const manifest = validation.manifest;

    if (this.confirmGrants) {
      const caps = await this.confirmGrants(manifest);
      if (caps === null) throw new Error('install cancelled by user');
      await this.backend.saveGrants(manifest.id, caps);
    }

    if (this.plugins.has(manifest.id)) await this.uninstall(manifest.id);

    const rec = {
      id: manifest.id,
      folder: manifest.id,
      path: baseUrl,
      manifest,
      v3: true,
      enabled: true,
      status: 'disabled',
      health: { strikes: 0, lastError: null, logs: [] },
      worker: null,
      gate: null,
      devUrl: baseUrl,
      devGrants: manifest.capabilities,
    };
    this.plugins.set(manifest.id, rec);
    await this.activate(manifest.id);
    this.notify();
  }

  async fetchDevSource(rec) {
    const res = await fetch(`${rec.devUrl}${rec.manifest.main}`);
    if (!res.ok) throw new Error(`could not fetch ${rec.manifest.main} from dev server`);
    return res.text();
  }

  async triggerCommand(qualifiedId) {
    const command = this.contributions.findCommand(qualifiedId);
    if (!command) throw new Error(`unknown command: ${qualifiedId}`);
    const rec = this.plugins.get(command.pluginId);
    if (rec && rec.status !== 'active') await this.activate(command.pluginId);
    this.emitToPlugin(command.pluginId, 'command', { id: command.id });
  }

  async triggerView(viewName) {
    for (const rec of this.plugins.values()) {
      if (rec.v3 && rec.enabled && rec.status !== 'active' && this.activatesOn(rec, 'view', viewName)) {
        await this.activate(rec.id).catch((err) => this.strike(rec.id, err.message));
      }
    }
  }

  async triggerFile(filePath) {
    const dot = filePath.lastIndexOf('.');
    if (dot === -1) return;
    const ext = filePath.slice(dot);
    for (const rec of this.plugins.values()) {
      if (rec.v3 && rec.enabled && rec.status !== 'active' && this.activatesOn(rec, 'file', ext)) {
        await this.activate(rec.id).catch((err) => this.strike(rec.id, err.message));
      }
    }
  }
}
