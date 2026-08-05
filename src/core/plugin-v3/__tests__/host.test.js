import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PluginHost } from '../host.js';
import { ContributionRegistry } from '../contributions.js';

class FakeWorker {
  constructor() {
    this.sent = [];
    this.terminated = false;
    this.onmessage = null;
    this.onerror = null;
    this.failReady = false;
  }

  postMessage(msg) {
    this.sent.push(msg);
    if (msg.kind === 'init' && !this.failReady) {
      queueMicrotask(() => this.onmessage?.({ data: { v: 3, kind: 'ready' } }));
    }
    if (msg.kind === 'deactivate') {
      queueMicrotask(() => this.onmessage?.({ data: { v: 3, kind: 'deactivated' } }));
    }
  }

  terminate() { this.terminated = true; }

  receive(msg) { this.onmessage?.({ data: msg }); }
}

const v3Manifest = (over = {}) => ({
  apiVersion: 3,
  id: 'dog',
  name: 'Dog',
  version: '1.0.0',
  main: 'index.js',
  capabilities: [],
  activation: ['startup'],
  contributes: { commands: [{ id: 'bark', title: 'Bark' }] },
  ...over,
});

function makeBackend({ plugins = [], enabled = [] } = {}) {
  return {
    calls: { enable: [], disable: [], grants: [], uninstall: [], saveGrants: [] },
    plugins,
    async listPlugins() { return this.plugins; },
    async enabledIds() { return enabled; },
    async enable(key) { this.calls.enable.push(key); },
    async disable(key) { this.calls.disable.push(key); },
    async grants(key) { this.calls.grants.push(key); return []; },
    async saveGrants(key, caps) { this.calls.saveGrants.push([key, caps]); },
    async readSource() { return 'module.exports = { activate() {} };'; },
    async uninstall(key) { this.calls.uninstall.push(key); },
  };
}

function makeHost({ plugins = [], enabled = [], confirmGrants = null } = {}) {
  const backend = makeBackend({ plugins, enabled });
  const contributions = new ContributionRegistry();
  const workers = [];
  const host = new PluginHost({
    backend,
    contributions,
    workerFactory: () => {
      const w = new FakeWorker();
      workers.push(w);
      return w;
    },
    effects: { toast: vi.fn(), workspaceInfo: () => ({ path: null }) },
    confirmGrants,
  });
  return { host, backend, contributions, workers };
}

const pluginEntry = (manifest, folder = manifest.id) => ({ folder, path: `/plugins/${folder}`, manifest });

describe('PluginHost lifecycle', () => {
  it('activates enabled v3 plugins on startup and registers contributions', async () => {
    const { host, contributions } = makeHost({
      plugins: [pluginEntry(v3Manifest())],
      enabled: ['dog'],
    });
    await host.init();
    expect(host.get('dog').status).toBe('active');
    expect(contributions.commands().map((c) => c.qualifiedId)).toEqual(['dog.bark']);
  });

  it('marks legacy plugins unsupported and refuses to run them', async () => {
    const legacy = { id: 'old', name: 'Old', version: '1.0.0' };
    const { host } = makeHost({ plugins: [pluginEntry(legacy)], enabled: ['old'] });
    await host.init();
    expect(host.get('old').status).toBe('unsupported');
    await expect(host.activate('old')).rejects.toThrow(/not a v3 plugin/);
  });

  it('marks invalid v3 manifests as invalid with the reason recorded', async () => {
    const bad = v3Manifest({ capabilities: ['not-a-capability'] });
    const { host } = makeHost({ plugins: [pluginEntry(bad)], enabled: ['dog'] });
    await host.init();
    expect(host.get('dog').status).toBe('invalid');
    expect(host.get('dog').health.lastError).toMatch(/capabilities/);
  });

  it('does not activate disabled plugins until enabled', async () => {
    const { host, backend } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: [] });
    await host.init();
    expect(host.get('dog').status).toBe('disabled');
    await host.enable('dog');
    expect(host.get('dog').status).toBe('active');
    expect(backend.calls.enable).toEqual(['dog']);
  });

  it('lazy-activates on command trigger and forwards the event', async () => {
    const manifest = v3Manifest({ activation: ['command:bark'] });
    const { host, workers } = makeHost({ plugins: [pluginEntry(manifest)], enabled: ['dog'] });
    await host.init();
    expect(host.get('dog').status).toBe('enabled');
    await host.triggerCommand('dog.bark');
    expect(host.get('dog').status).toBe('active');
    const evtSent = workers[0].sent.find((m) => m.kind === 'evt' && m.event === 'command');
    expect(evtSent.data).toEqual({ id: 'bark' });
  });

  it('deactivate terminates the worker and removes contributions', async () => {
    const { host, contributions, workers } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: ['dog'] });
    await host.init();
    await host.disable('dog');
    expect(workers[0].terminated).toBe(true);
    expect(host.get('dog').status).toBe('disabled');
    expect(contributions.commands()).toHaveLength(0);
  });

  it('uninstall removes the plugin entirely', async () => {
    const { host, backend } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: ['dog'] });
    await host.init();
    await host.uninstall('dog');
    expect(host.get('dog')).toBeUndefined();
    expect(backend.calls.uninstall).toEqual(['dog']);
  });

  it('stops a plugin after repeated crashes', async () => {
    const { host, workers } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: ['dog'] });
    await host.init();
    workers[0].onerror({ message: 'boom 1' });
    workers[0].onerror({ message: 'boom 2' });
    workers[0].onerror({ message: 'boom 3' });
    await new Promise((r) => setTimeout(r, 10));
    expect(host.get('dog').status).toBe('error');
    expect(host.get('dog').health.lastError).toBe('boom 3');
    expect(workers[0].terminated).toBe(true);
  });

  it('approveInstall stores grants then enables', async () => {
    const { host, backend } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: [] });
    await host.init();
    await host.approveInstall('dog', ['ui', 'overlay']);
    expect(backend.calls.saveGrants).toEqual([['dog', ['ui', 'overlay']]]);
    expect(host.get('dog').status).toBe('active');
  });

  it('records logs and audit trail', async () => {
    const { host } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: ['dog'] });
    await host.init();
    const worker = host.get('dog').worker;
    worker.receive({ v: 3, kind: 'log', level: 'info', message: 'hello from plugin' });
    worker.receive({ v: 3, kind: 'req', id: 'w9', method: 'notes.read', args: { path: 'a.md' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(host.getLogs('dog').some((l) => l.message === 'hello from plugin')).toBe(true);
    expect(host.getAudit('dog').some((a) => a.method === 'notes.read' && !a.allowed)).toBe(true);
    const denied = host.get('dog').worker.sent.find((m) => m.kind === 'res' && m.id === 'w9');
    expect(denied.ok).toBe(false);
    expect(denied.error).toMatch(/permission denied/);
  });

  it('dev plugins go through the grants confirmation', async () => {
    const manifest = v3Manifest({ id: 'dev-dog', capabilities: ['overlay'] });
    const confirmGrants = vi.fn().mockResolvedValue(['overlay']);
    const { host, backend } = makeHost({ confirmGrants });
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => manifest })
      .mockResolvedValueOnce({ ok: true, text: async () => 'module.exports={activate(){}}' }));
    await host.loadDevPlugin('http://localhost:9999');
    expect(confirmGrants).toHaveBeenCalledWith(expect.objectContaining({ id: 'dev-dog' }));
    expect(backend.calls.saveGrants).toEqual([['dev-dog', ['overlay']]]);
    expect(host.get('dev-dog').status).toBe('active');
    vi.unstubAllGlobals();
  });

  it('dev install is cancelled when the user declines grants', async () => {
    const manifest = v3Manifest({ id: 'dev-dog' });
    const { host } = makeHost({ confirmGrants: vi.fn().mockResolvedValue(null) });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => manifest }));
    await expect(host.loadDevPlugin('http://localhost:9999')).rejects.toThrow(/cancelled/);
    expect(host.get('dev-dog')).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it('snapshot exposes stable plugin metadata for the UI', async () => {
    const { host } = makeHost({ plugins: [pluginEntry(v3Manifest())], enabled: ['dog'] });
    await host.init();
    const snap = host.getSnapshot();
    expect(snap.loading).toBe(false);
    expect(snap.plugins[0]).toMatchObject({ id: 'dog', name: 'Dog', status: 'active', v3: true });
  });

  it('survives a failing plugin without blocking other plugins', async () => {
    const bad = v3Manifest({ id: 'bad' });
    const good = v3Manifest({ id: 'good' });
    const { host, workers } = makeHost({
      plugins: [pluginEntry(bad, 'bad'), pluginEntry(good, 'good')],
      enabled: ['bad', 'good'],
    });
    workers.push(null);
    await host.init();
    expect(host.get('good').status).toBe('active');
  });
});
