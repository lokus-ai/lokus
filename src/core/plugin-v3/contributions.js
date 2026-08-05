export class ContributionRegistry {
  constructor() {
    this.byPlugin = new Map();
    this.runtime = new Map();
    this.listeners = new Set();
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    for (const fn of this.listeners) {
      try { fn(); } catch { /* listener errors must not break the host */ }
    }
  }

  register(pluginId, manifest) {
    this.byPlugin.set(pluginId, manifest.contributes || {});
    this.notify();
  }

  unregister(pluginId) {
    this.byPlugin.delete(pluginId);
    this.runtime.delete(pluginId);
    this.notify();
  }

  clear() {
    this.byPlugin.clear();
    this.runtime.clear();
    this.notify();
  }

  #flat(kind) {
    const out = [];
    for (const [pluginId, contributes] of this.byPlugin) {
      for (const item of contributes[kind] || []) {
        out.push({ ...item, pluginId, qualifiedId: `${pluginId}.${item.id ?? item.name}` });
      }
    }
    const runtimeItems = [];
    for (const [pluginId, rt] of this.runtime) {
      for (const item of rt[kind] || []) {
        runtimeItems.push({ ...item, pluginId, qualifiedId: `${pluginId}.${item.id ?? item.name}` });
      }
    }
    const seen = new Set(out.map((i) => i.qualifiedId));
    for (const item of runtimeItems) {
      if (!seen.has(item.qualifiedId)) out.push(item);
    }
    return out;
  }

  commands() { return this.#flat('commands'); }
  panels() { return this.#flat('panels'); }
  statusBar() { return this.#flat('statusBar'); }
  toolbar() { return this.#flat('toolbar'); }
  slashCommands() { return this.#flat('slashCommands'); }
  overlays() { return this.#flat('overlays'); }

  findCommand(qualifiedId) {
    return this.commands().find((c) => c.qualifiedId === qualifiedId) || null;
  }

  isDeclared(pluginId, kind, itemId) {
    const list = this.byPlugin.get(pluginId)?.[kind] || [];
    return list.some((i) => (i.id ?? i.name) === itemId);
  }

  addRuntime(pluginId, kind, item) {
    if (!this.runtime.has(pluginId)) this.runtime.set(pluginId, {});
    const bucket = this.runtime.get(pluginId);
    if (!bucket[kind]) bucket[kind] = [];
    bucket[kind] = bucket[kind].filter((i) => (i.id ?? i.name) !== (item.id ?? item.name));
    bucket[kind].push(item);
    this.notify();
  }

  updateRuntime(pluginId, kind, itemId, patch) {
    const bucket = this.runtime.get(pluginId);
    const list = bucket?.[kind];
    if (!list) return false;
    const idx = list.findIndex((i) => (i.id ?? i.name) === itemId);
    if (idx === -1) return false;
    list[idx] = { ...list[idx], ...patch };
    this.notify();
    return true;
  }
}
