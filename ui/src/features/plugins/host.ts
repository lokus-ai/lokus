/** @part-of ui.plugins */
import { type InstalledPlugin, type PluginManifest, pluginUrl, runCore } from "../../bridge/core";
import { listCommands, registerCommands, runCommand, unregisterCommands } from "../../shell/commands";
import { app, notify } from "../../shell/workspace";

/**
 * Runs plugins. Each one lives in a sandboxed frame with no access to this
 * window; it can only send messages, and every request is checked here
 * against the permissions in its manifest.
 */
interface Running {
  frame: HTMLIFrameElement;
  ready: Promise<void>;
  markReady(): void;
}

const COMMAND_TIMEOUT = 15_000;
const manifests = new Map<string, PluginManifest>();
const running = new Map<string, Running>();
const calls = new Map<number, { resolve(value: unknown): void; reject(error: unknown): void }>();
let registered: string[] = [];
let access = new Map<string, string>();
let nextCall = 1;
let holder: HTMLDivElement | null = null;

const fail = (code: string, message: string) => Object.assign(new Error(message), { code });
const plain = (value: unknown) => JSON.parse(JSON.stringify(value ?? null)) as unknown;

function frames(id?: string): HTMLIFrameElement[] {
  const all = [...document.querySelectorAll<HTMLIFrameElement>("iframe[data-plugin]")];
  return id ? all.filter((f) => f.dataset.plugin === id) : all;
}

/** Load the plugin's background page, once. */
function start(manifest: PluginManifest): Running {
  const existing = running.get(manifest.id);
  if (existing) return existing;
  if (!holder) {
    holder = document.createElement("div");
    holder.hidden = true;
    document.body.append(holder);
  }
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox", "allow-scripts");
  frame.dataset.plugin = manifest.id;
  let markReady = () => {};
  const ready = new Promise<void>((resolve, reject) => {
    markReady = resolve;
    window.setTimeout(() => reject(fail("plugin_timeout", `${manifest.name || manifest.id} did not start`)), COMMAND_TIMEOUT);
  });
  ready.catch(() => {});
  frame.src = pluginUrl(manifest.id);
  holder.append(frame);
  const entry = { frame, ready, markReady };
  running.set(manifest.id, entry);
  return entry;
}

/** Run one of a plugin's own commands inside its frame. */
async function invoke(manifest: PluginManifest, command: string, args: Record<string, unknown>): Promise<unknown> {
  const { frame, ready } = start(manifest);
  await ready;
  const call = nextCall++;
  return new Promise((resolve, reject) => {
    calls.set(call, { resolve, reject });
    window.setTimeout(() => {
      if (calls.delete(call)) reject(fail("plugin_timeout", `${command} did not answer`));
    }, COMMAND_TIMEOUT);
    frame.contentWindow?.postMessage({ lokus: 1, command, call, args: plain(args) }, "*");
  });
}

/** May this plugin run this app command? */
function allowed(manifest: PluginManifest, name: string): boolean {
  const has = (permission: string) => manifest.permissions.includes(permission);
  if (name.startsWith(`${manifest.id}.`)) return true;
  const level = access.get(name);
  if (level) return (level === "read" && has("vault:read")) || (level === "write" && has("vault:write"));
  if (name === "note.open") return has("vault:read");
  return name.startsWith("editor.") && has("editor") && listCommands().some((c) => c.id === name);
}

async function stored(id: string): Promise<{ settings?: Record<string, unknown>; storage?: unknown }> {
  return (await runCore<{ settings?: Record<string, unknown>; storage?: unknown } | null>("plugins.data.get", { id })) ?? {};
}

export async function pluginSettings(manifest: PluginManifest): Promise<Record<string, unknown>> {
  const saved = (await stored(manifest.id)).settings ?? {};
  return Object.fromEntries(manifest.contributes.settings.map((s) => [s.key, saved[s.key] ?? s.default ?? null]));
}

export async function setPluginSetting(manifest: PluginManifest, key: string, value: unknown): Promise<void> {
  const data = await stored(manifest.id);
  await runCore("plugins.data.set", { id: manifest.id, value: { ...data, settings: { ...data.settings, [key]: value } } });
  emit("settings-changed", {}, manifest.id);
}

async function answer(manifest: PluginManifest, method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case "run": {
      const name = String(params.name);
      if (!allowed(manifest, name)) throw fail("forbidden", `${manifest.id} is not allowed to run ${name}`);
      return runCommand(name, (params.args as Record<string, unknown>) ?? {});
    }
    case "notify":
      return notify(String(params.message).slice(0, 200));
    case "storage.get":
      return (await stored(manifest.id)).storage ?? null;
    case "storage.set": {
      const data = await stored(manifest.id);
      return runCore("plugins.data.set", { id: manifest.id, value: { ...data, storage: params.value ?? null } });
    }
    case "settings.get":
      return pluginSettings(manifest);
    case "views.open":
      return openPluginView(manifest.id, String(params.id));
    default:
      throw fail("unknown_method", `unknown plugin call ${method}`);
  }
}

function onMessage(e: MessageEvent): void {
  const m = e.data as Record<string, unknown> | null;
  if (!m || m.lokus !== 1) return;
  const frame = frames().find((f) => f.contentWindow === e.source);
  const manifest = frame ? manifests.get(frame.dataset.plugin ?? "") : undefined;
  if (!frame || !manifest) return;
  if (m.ready) {
    if (running.get(manifest.id)?.frame === frame) running.get(manifest.id)?.markReady();
  } else if (typeof m.done === "number") {
    const waiting = calls.get(m.done);
    calls.delete(m.done);
    if (m.ok) waiting?.resolve(m.value);
    else waiting?.reject(fail("plugin_error", String((m.error as { message?: string })?.message ?? "the plugin failed")));
  } else if (typeof m.id === "number" && typeof m.method === "string") {
    const reply = (body: object) => frame.contentWindow?.postMessage({ lokus: 1, reply: m.id, ...body }, "*");
    answer(manifest, m.method, (m.params as Record<string, unknown>) ?? {}).then(
      (value) => reply({ ok: true, value: plain(value) }),
      (err: { code?: string; message?: string }) => reply({ ok: false, error: { code: err.code ?? "error", message: err.message ?? String(err) } }),
    );
  }
}

/** Tell plugins something happened. Only plugins that may read the vault hear about notes. */
function emit(event: string, data: unknown, only?: string): void {
  for (const frame of frames(only)) {
    const manifest = manifests.get(frame.dataset.plugin ?? "");
    if (!manifest || (!only && !manifest.permissions.includes("vault:read"))) continue;
    frame.contentWindow?.postMessage({ lokus: 1, event, data }, "*");
  }
}

export function openPluginView(plugin: string, view: string): void {
  const found = manifests.get(plugin)?.contributes.views.find((v) => v.id === view);
  if (!found) throw fail("not_found", `${plugin} has no view ${view}`);
  app.set({ panel: { kind: "plugin", plugin, view, title: found.title, page: found.page } });
}

/** Read the installed plugins again and (re)start the enabled ones. */
export async function loadPlugins(): Promise<InstalledPlugin[]> {
  for (const { frame } of running.values()) frame.remove();
  running.clear();
  manifests.clear();
  unregisterCommands(registered);
  registered = [];
  const panel = app.get().panel;
  if (!app.get().vault) {
    app.set({ plugins: [], panel: panel?.kind === "plugin" ? null : panel });
    return [];
  }
  const [installed, commands] = await Promise.all([
    runCore<InstalledPlugin[]>("plugins.list"),
    runCore<{ name: string; access: string }[]>("commands.list"),
  ]);
  access = new Map(commands.map((c) => [c.name, c.access]));
  for (const { enabled, manifest } of installed) {
    if (!enabled || !manifest) continue;
    manifests.set(manifest.id, manifest);
    const own = [
      ...manifest.contributes.commands.map((c) => ({
        id: c.id,
        title: c.title,
        keys: c.keys,
        run: (args: Record<string, unknown>) => invoke(manifest, c.id, args),
      })),
      ...manifest.contributes.views.map((v) => ({
        id: `${manifest.id}.view.${v.id}`,
        title: `Open ${v.title}`,
        run: () => openPluginView(manifest.id, v.id),
      })),
    ];
    registerCommands(own);
    registered.push(...own.map((c) => c.id));
    if (manifest.activation.includes("onStartup")) start(manifest);
  }
  const still = panel?.kind === "plugin" && manifests.has(panel.plugin);
  app.set({ plugins: installed, panel: panel?.kind === "plugin" && !still ? null : panel });
  return installed;
}

/** Start the plugin host and keep it in step with the open vault. */
export function startPlugins(): void {
  window.addEventListener("message", onMessage);
  let last = { root: app.get().vault?.root, active: app.get().active, version: app.get().version };
  app.subscribe(() => {
    const s = app.get();
    const now = { root: s.vault?.root, active: s.active, version: s.version };
    const before = last;
    last = now;
    if (now.root !== before.root) void loadPlugins().catch((e) => notify(String(e?.message ?? e)));
    if (now.active !== before.active) emit("active-note", { path: now.active });
    if (now.version !== before.version) emit("vault-changed", {});
  });
  if (last.root) void loadPlugins().catch(() => {});
  registerCommands([
    { id: "plugins.reload", title: "Plugins: reload", run: async () => (await loadPlugins()).map((p) => ({ id: p.id, enabled: p.enabled, error: p.error })) },
    { id: "plugins.running", title: "Running plugin frames", hidden: true, run: () => frames().map((f) => ({ plugin: f.dataset.plugin, background: f.parentElement === holder })) },
  ]);
}
