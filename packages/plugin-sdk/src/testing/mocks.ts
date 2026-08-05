import type { FetchResult, LokusAPI, NotifyOptions, PluginEvent } from '../api.js';

export interface MockLokusState {
  notes: Map<string, string>;
  storage: Map<string, unknown>;
  inserted: string[];
  notifications: NotifyOptions[];
  statusItems: Map<string, { text?: string; tooltip?: string }>;
  overlays: Set<string>;
  commandsExecuted: Array<{ id: string; args?: Record<string, unknown> }>;
}

export interface MockLokus {
  api: LokusAPI;
  state: MockLokusState;
  /** Fire a host event at the plugin, e.g. fire('command', { id: 'stamp' }). */
  fire(event: PluginEvent, data: { id: string }): void;
}

/**
 * In-memory LokusAPI for unit-testing plugins outside Lokus.
 * Permission denials are NOT simulated — test those in the app's QA harness.
 */
export function createMockLokusAPI(): MockLokus {
  const state: MockLokusState = {
    notes: new Map(),
    storage: new Map(),
    inserted: [],
    notifications: [],
    statusItems: new Map(),
    overlays: new Set(),
    commandsExecuted: [],
  };
  const handlers = new Map<string, Set<(data: { id: string }) => void>>();

  const api: LokusAPI = {
    commands: {
      execute: async (id, args) => {
        state.commandsExecuted.push({ id, args });
        return null;
      },
    },
    ui: {
      notify: async (options) => {
        state.notifications.push(options);
        return true;
      },
      setStatusBarItem: async (itemId, patch) => {
        state.statusItems.set(itemId, { ...state.statusItems.get(itemId), ...patch });
        return true;
      },
    },
    editor: {
      insert: async (text) => {
        state.inserted.push(text);
        return true;
      },
    },
    notes: {
      list: async (options) => Array.from(state.notes.keys()).slice(0, options?.limit ?? 500),
      read: async (path) => {
        const content = state.notes.get(path);
        if (content === undefined) throw new Error(`note not found: ${path}`);
        return content;
      },
      write: async (path, content) => {
        state.notes.set(path, content);
        return true;
      },
    },
    storage: {
      get: async <T>(key: string) => (state.storage.get(key) as T | undefined) ?? null,
      set: async (key, value) => {
        state.storage.set(key, value);
        return true;
      },
      delete: async (key) => {
        state.storage.delete(key);
        return true;
      },
    },
    network: {
      fetch: async (): Promise<FetchResult> => ({ status: 200, body: '', truncated: false }),
    },
    overlay: {
      show: async (overlayId) => {
        state.overlays.add(overlayId);
        return true;
      },
      hide: async (overlayId) => {
        state.overlays.delete(overlayId);
        return true;
      },
    },
    workspace: {
      info: async () => ({ path: '/mock-vault' }),
    },
    on: (event, handler) => {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)?.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },
  };

  const fire = (event: PluginEvent, data: { id: string }) => {
    for (const handler of handlers.get(event) ?? []) handler(data);
  };

  return { api, state, fire };
}
