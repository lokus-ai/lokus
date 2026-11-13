/** @part-of core.plugins */
// The plugin side of the Lokus plugin API (apiVersion 1). Every plugin page
// loads this file and gets one global, `lokus`. The page runs in a sandboxed
// frame with no access to the app; everything goes through messages that the
// app checks against the plugin's permissions.
(() => {
  const pending = new Map();
  const handlers = new Map();
  const listeners = new Map();
  let next = 1;

  const send = (message) => parent.postMessage({ lokus: 1, ...message }, "*");
  const call = (method, params) =>
    new Promise((resolve, reject) => {
      const id = next++;
      pending.set(id, { resolve, reject });
      send({ id, method, params });
    });

  addEventListener("message", async (e) => {
    const m = e.data;
    if (e.source !== parent || !m || m.lokus !== 1) return;
    if (m.reply !== undefined) {
      const waiting = pending.get(m.reply);
      pending.delete(m.reply);
      if (!waiting) return;
      if (m.ok) waiting.resolve(m.value);
      else waiting.reject(Object.assign(new Error(m.error?.message ?? "failed"), { code: m.error?.code }));
    } else if (m.command !== undefined) {
      try {
        const handler = handlers.get(m.command);
        if (!handler) throw new Error(`no handler for ${m.command}`);
        send({ done: m.call, ok: true, value: (await handler(m.args ?? {})) ?? null });
      } catch (err) {
        send({ done: m.call, ok: false, error: { code: "plugin_error", message: String(err?.message ?? err) } });
      }
    } else if (m.event !== undefined) {
      for (const listener of listeners.get(m.event) ?? []) {
        try {
          listener(m.data);
        } catch (err) {
          console.error(err);
        }
      }
    }
  });

  window.lokus = {
    apiVersion: 1,
    /** Run an app command, e.g. `lokus.run("note.read", { path })`. */
    run: (name, args) => call("run", { name, args: args ?? {} }),
    /** Show a short message at the bottom of the window. */
    notify: (message) => call("notify", { message: String(message) }),
    commands: {
      /** Provide the code for a command declared in the manifest. */
      handle(id, handler) {
        handlers.set(id, handler);
      },
    },
    /** Events: "active-note" ({ path }) and "vault-changed" ({}). */
    on(event, listener) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(listener);
      return () => listeners.get(event)?.delete(listener);
    },
    storage: {
      get: () => call("storage.get"),
      set: (value) => call("storage.set", { value }),
    },
    settings: {
      /** The plugin's settings, with defaults filled in. */
      get: () => call("settings.get"),
    },
    views: {
      /** Open one of this plugin's views in the side panel. */
      open: (id) => call("views.open", { id }),
    },
  };

  addEventListener("load", () => send({ ready: true }));
})();
