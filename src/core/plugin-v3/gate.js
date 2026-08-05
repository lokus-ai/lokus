const METHOD_CAPABILITY = {
  'ui.notify': 'ui',
  'ui.panel': 'ui',
  'ui.statusbar': 'ui',
  'commands.execute': 'commands',
  'editor.insert': 'editor',
  'notes.list': 'notes.read',
  'notes.read': 'notes.read',
  'notes.write': 'notes.write',
  'storage.get': 'storage',
  'storage.set': 'storage',
  'storage.delete': 'storage',
  'network.fetch': 'network',
  'overlay.show': 'overlay',
  'overlay.hide': 'overlay',
  'workspace.info': null,
};

const AUDIT_LIMIT = 200;

export class CapabilityGate {
  constructor(pluginId, grants = [], onDecision = null) {
    this.pluginId = pluginId;
    this.grants = new Set(grants);
    this.onDecision = onDecision;
    this.audit = [];
  }

  setGrants(grants) {
    this.grants = new Set(grants);
  }

  capabilityFor(method) {
    if (!(method in METHOD_CAPABILITY)) return undefined;
    return METHOD_CAPABILITY[method];
  }

  check(method) {
    const capability = this.capabilityFor(method);
    if (capability === undefined) {
      const decision = { pluginId: this.pluginId, method, allowed: false, reason: 'unknown-method' };
      this.record(decision);
      return decision;
    }
    if (capability === null) {
      const decision = { pluginId: this.pluginId, method, allowed: true, capability: null, reason: 'always-allowed' };
      this.record(decision);
      return decision;
    }
    const allowed = this.grants.has(capability);
    const decision = {
      pluginId: this.pluginId,
      method,
      capability,
      allowed,
      reason: allowed ? 'granted' : 'not-granted',
      at: Date.now(),
    };
    this.record(decision);
    return decision;
  }

  record(decision) {
    this.audit.push(decision);
    if (this.audit.length > AUDIT_LIMIT) this.audit.splice(0, this.audit.length - AUDIT_LIMIT);
    if (this.onDecision) this.onDecision(decision);
  }
}

export { METHOD_CAPABILITY };
