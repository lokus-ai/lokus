export const RPC_VERSION = 3;
export const RPC_TIMEOUT_MS = 5000;

let hostSeq = 0;
let workerSeq = 0;

export function request(method, args = {}, fromHost = false) {
  const seq = fromHost ? ++hostSeq : ++workerSeq;
  return { v: RPC_VERSION, kind: 'req', id: `${fromHost ? 'h' : 'w'}${seq}`, method, args };
}

export function response(id, ok, result = null, error = null) {
  return { v: RPC_VERSION, kind: 'res', id, ok, result, error };
}

export function evt(event, data = null) {
  return { v: RPC_VERSION, kind: 'evt', event, data };
}

export function logMsg(level, message, data = null) {
  return { v: RPC_VERSION, kind: 'log', level, message, data };
}

export function errorMsg(message) {
  return { v: RPC_VERSION, kind: 'error', message: String(message).slice(0, 2000) };
}

export function initMsg({ pluginId, manifest, code }) {
  return { v: RPC_VERSION, kind: 'init', pluginId, manifest, code };
}

export function deactivateMsg() {
  return { v: RPC_VERSION, kind: 'deactivate' };
}

export function isValidMessage(m) {
  return !!m && m.v === RPC_VERSION && typeof m.kind === 'string';
}

export class PendingRequests {
  constructor(timeoutMs = RPC_TIMEOUT_MS) {
    this.pending = new Map();
    this.timeoutMs = timeoutMs;
  }

  track(id, resolve, reject) {
    const timer = setTimeout(() => {
      if (this.pending.delete(id)) {
        reject(new Error(`plugin call timed out after ${this.timeoutMs}ms`));
      }
    }, this.timeoutMs);
    this.pending.set(id, { resolve, reject, timer });
  }

  settle(id, ok, result, error) {
    const entry = this.pending.get(id);
    if (!entry) return false;
    this.pending.delete(id);
    clearTimeout(entry.timer);
    if (ok) entry.resolve(result);
    else entry.reject(new Error(error || 'plugin call failed'));
    return true;
  }

  rejectAll(reason) {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(new Error(reason));
      this.pending.delete(id);
    }
  }

  get size() {
    return this.pending.size;
  }
}
