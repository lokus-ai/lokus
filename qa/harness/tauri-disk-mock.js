/**
 * In-page Tauri mock, disk-backed (QA harness).
 *
 * Injected via page.addInitScript on every navigation. Presents a
 * `window.__TAURI_INTERNALS__` implementation that:
 *   - forwards app invoke() commands to the Node QaBackend (real temp vault on
 *     disk) through the Playwright binding `window.__qaInvoke`
 *   - implements the Tauri v2 event plugin locally (listen/unlisten/emit) so
 *     `lokus:*` menu-accelerator events can be fired exactly like the native
 *     menu would — via `window.__qaEmitTauriEvent(name, payload)`
 *   - simulates the Rust window behavior for close (hide-on-close), recording
 *     every window op so journeys can assert on lifecycle behavior.
 *
 * Everything must be self-contained (no imports) — it runs as an init script.
 */

(() => {
  if (window.__QA_MOCK_INSTALLED__) return;
  window.__QA_MOCK_INSTALLED__ = true;

  // ---------------- event system ----------------
  let nextCallbackId = 1;
  const callbacks = new Map(); // id -> fn
  const listeners = new Map(); // eventName -> Map(eventId -> callbackId)

  function transformCallback(cb, once = false) {
    const id = nextCallbackId++;
    callbacks.set(id, (payload) => {
      if (once) callbacks.delete(id);
      return cb(payload);
    });
    return id;
  }

  function addListener(event, handlerId) {
    if (!listeners.has(event)) listeners.set(event, new Map());
    const eventId = nextCallbackId++;
    listeners.get(event).set(eventId, handlerId);
    return eventId;
  }

  function removeListener(event, eventId) {
    listeners.get(event)?.delete(eventId);
  }

  function emitEvent(event, payload) {
    const subs = listeners.get(event);
    if (!subs) return 0;
    let n = 0;
    for (const [eventId, cbId] of subs) {
      const cb = callbacks.get(cbId);
      if (cb) {
        try {
          cb({ event, id: eventId, payload });
          n++;
        } catch (e) {
          console.error(`[QA mock] listener for ${event} threw`, e);
        }
      }
    }
    return n;
  }

  // Exposed to the harness: fire an event exactly like a Tauri menu accelerator would.
  window.__qaEmitTauriEvent = (event, payload = null) => emitEvent(event, payload);
  window.__qaListenerCount = (event) => listeners.get(event)?.size ?? 0;

  // @tauri-apps/api v2 unlisten() calls this directly (not via invoke).
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = {
    unregisterListener: (event, eventId) => removeListener(event, eventId),
  };

  // ---------------- window lifecycle simulation ----------------
  // Mirrors src-tauri/src/lib.rs: CloseRequested on non-prefs windows -> hide + prevent_close.
  const windowState = { visible: true, closeRequests: 0 };
  window.__qaWindowState = windowState;

  function recordWindowEvent(op) {
    windowState.closeRequests += op === 'close' ? 1 : 0;
    if (op === 'close' || op === 'hide') {
      windowState.visible = false;
      // Visual simulation of a hidden window so screenshots show what the user sees.
      document.documentElement.style.visibility = 'hidden';
      document.documentElement.setAttribute('data-qa-window-hidden', 'true');
    }
    if (op === 'show') {
      windowState.visible = true;
      document.documentElement.style.visibility = '';
      document.documentElement.removeAttribute('data-qa-window-hidden');
    }
    window.__qaInvoke && window.__qaInvoke('__qa_window_event', { op });
  }
  window.__qaShowWindow = () => recordWindowEvent('show');

  // ---------------- invoke ----------------
  async function forward(cmd, args) {
    const res = await window.__qaInvoke(cmd, args ?? {});
    if (res && res.ok === false) throw res.error;
    return res ? res.value : null;
  }

  async function invoke(cmd, args = {}, _options) {
    // Plugin namespace handling
    if (cmd.startsWith('plugin:event|')) {
      const op = cmd.split('|')[1];
      if (op === 'listen') return addListener(args.event, args.handler);
      if (op === 'unlisten') return removeListener(args.event, args.eventId);
      if (op === 'emit' || op === 'emit_to') {
        emitEvent(args.event, args.payload);
        return null;
      }
      return null;
    }
    if (cmd.startsWith('plugin:window|')) {
      const op = cmd.split('|')[1];
      if (op === 'close' || op === 'destroy') {
        recordWindowEvent('close');
        return null;
      }
      if (op === 'hide') {
        recordWindowEvent('hide');
        return null;
      }
      if (op === 'show' || op === 'set_focus') {
        recordWindowEvent('show');
        return null;
      }
      if (op === 'is_visible') return windowState.visible;
      if (op === 'title') return 'Lokus (QA)';
      if (op === 'theme') return 'light';
      return null;
    }
    if (cmd.startsWith('plugin:dialog|')) {
      const op = cmd.split('|')[1];
      if (op === 'open') return forward('__qa_dialog_open', args);
      if (op === 'save') return forward('__qa_dialog_open', args);
      if (op === 'message' || op === 'ask' || op === 'confirm') return true;
      return null;
    }
    if (cmd.startsWith('plugin:path|')) {
      const op = cmd.split('|')[1];
      if (op === 'resolve_directory' || op === 'resolve') return forward('__qa_home_dir', {});
      if (op === 'join' || op === 'join_dir') return forward('__qa_path_join', args);
      return forward('__qa_home_dir', {});
    }
    if (cmd.startsWith('plugin:fs|')) {
      const op = cmd.split('|')[1];
      if (op === 'read_file' || op === 'read_text_file') return forward('__qa_read_bytes', args);
      if (op === 'exists') return forward('__qa_path_exists', args);
      return null;
    }
    if (cmd.startsWith('plugin:global-shortcut|') || cmd.startsWith('plugin:updater|') ||
        cmd.startsWith('plugin:process|') || cmd.startsWith('plugin:shell|') ||
        cmd.startsWith('plugin:opener|') || cmd.startsWith('plugin:deep-link|')) {
      return null;
    }
    if (cmd.startsWith('plugin:')) return null;

    // Launcher (Tauri mode) opens the workspace in a "new window" — in the
    // browser harness that means navigating this page to the workspace URL.
    if (cmd === 'open_workspace_window') {
      const u = new URL(window.location.href);
      u.search = `?testMode=true&workspacePath=${encodeURIComponent(args.workspacePath ?? args.path)}`;
      window.location.href = u.toString();
      return true;
    }

    return forward(cmd, args);
  }

  window.__TAURI_INTERNALS__ = {
    invoke,
    transformCallback,
    convertFileSrc: (filePath, protocol) =>
      `${protocol || 'asset'}://localhost/${encodeURIComponent(filePath)}`,
    metadata: {
      currentWindow: { label: 'main' },
      currentWebview: { label: 'main', windowLabel: 'main' },
      windows: [{ label: 'main' }],
      webviews: [{ label: 'main', windowLabel: 'main' }],
    },
    plugins: {},
  };
  window.__TAURI_METADATA__ = {
    __currentWindow: { label: 'main' },
    __windows: [{ label: 'main' }],
  };

  console.log('[QA mock] disk-backed Tauri mock installed');
})();
