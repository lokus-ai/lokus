/** @part-of ui.settings */
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { type AiConfig, aiModels, type AiSettings, aiSettings, checkMcp, type McpServer, saveAiConfig, setAiSecret } from "../../bridge/ai";
import { analyticsEnabled, setAnalyticsEnabled } from "../../bridge/analytics";
import { type InstalledPlugin, pickFolder, type PluginManifest, runCore } from "../../bridge/core";
import { type Preferences, preferences, setPreference } from "../../shell/preferences";
import { useStore } from "../../shell/store";
import { app } from "../../shell/workspace";
import { loadPlugins, pluginSettings, setPluginSetting } from "../plugins/host";

const PROVIDERS = { anthropic: "Anthropic (Claude)", openai: "OpenAI or compatible" } as const;

function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="settings-section">
      <h2>{title}</h2>
      {hint && <p className="settings-hint">{hint}</p>}
      {children}
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="settings-row">
      <div className="settings-label">
        <span>{label}</span>
        {hint && <small>{hint}</small>}
      </div>
      <div className="settings-control">{children}</div>
    </div>
  );
}

function Toggle({ on, onChange, label }: { on: boolean; onChange(on: boolean): void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} onClick={() => onChange(!on)} />;
}

function Choice<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange(value: T): void }) {
  return (
    <div className="segmented">
      {(Object.keys(options) as T[]).map((key) => (
        <button key={key} className={key === value ? "active" : ""} onClick={() => onChange(key)}>
          {options[key]}
        </button>
      ))}
    </div>
  );
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Assistant() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [server, setServer] = useState({ name: "", url: "", token: "" });
  const [checked, setChecked] = useState<Record<string, string>>({});

  const reload = useCallback(() => aiSettings().then(setSettings, (e) => setNote(message(e))), []);
  useEffect(() => void reload(), [reload]);
  if (!settings) return <p className="settings-hint">{note ?? "Loading…"}</p>;

  const { config } = settings;
  const hasKey = settings.keys[config.provider];
  const save = async (patch: Partial<AiConfig>) => {
    setNote(null);
    const next = { ...config, ...patch };
    setSettings({ ...settings, config: next });
    await saveAiConfig(next).catch((e) => setNote(message(e)));
  };
  const saveKey = async (value: string) => {
    setNote(null);
    await setAiSecret("provider", config.provider, value).then(
      () => setKey(""),
      (e) => setNote(message(e)),
    );
    await reload();
  };
  const loadModels = () => aiModels().then(setModels, (e) => setNote(message(e)));
  const addServer = async () => {
    const name = server.name.trim();
    const url = server.url.trim();
    if (!name || !/^https?:\/\//.test(url) || config.mcp.some((s) => s.name === name)) {
      setNote("A tool server needs a name that is not taken and an http(s) address.");
      return;
    }
    if (server.token.trim()) await setAiSecret("mcp", name, server.token).catch((e) => setNote(message(e)));
    await save({ mcp: [...config.mcp, { name, url, enabled: true }] });
    setServer({ name: "", url: "", token: "" });
    await reload();
  };
  const removeServer = async (target: McpServer) => {
    await setAiSecret("mcp", target.name, "").catch(() => {});
    await save({ mcp: config.mcp.filter((s) => s.name !== target.name) });
  };
  const check = async (target: McpServer) => {
    setChecked((c) => ({ ...c, [target.name]: "Checking…" }));
    const result = await checkMcp(target).then(
      (tools) => `Connected: ${tools.length} tool${tools.length === 1 ? "" : "s"}${tools.length ? ` (${tools.map((t) => t.name).slice(0, 6).join(", ")}${tools.length > 6 ? ", …" : ""})` : ""}`,
      (e) => message(e),
    );
    setChecked((c) => ({ ...c, [target.name]: result }));
  };

  return (
    <Section title="Assistant" hint="Bring your own key. It is stored in this computer's keychain and requests go straight from Lokus to the provider.">
      <Row label="Provider">
        <Choice value={config.provider} options={PROVIDERS} onChange={(provider) => void save({ provider, model: "" }).then(() => setModels([]))} />
      </Row>
      <Row label="API key" hint={hasKey ? "A key is saved. Paste a new one to replace it." : "No key yet."}>
        <input type="password" value={key} placeholder={hasKey ? "••••••••••••" : "Paste your key"} onChange={(e) => setKey(e.target.value)} autoComplete="off" />
        <button className="settings-button" disabled={!key.trim()} onClick={() => void saveKey(key)}>
          Save
        </button>
        {hasKey && (
          <button className="link danger" onClick={() => void saveKey("")}>
            Remove
          </button>
        )}
      </Row>
      <Row label="Model" hint={config.provider === "anthropic" ? "Leave empty for Claude Opus 5.5." : "Pick or type a model name."}>
        <input list="ai-models" value={config.model} placeholder={config.provider === "anthropic" ? "claude-opus-5-5" : "model name"} onChange={(e) => void save({ model: e.target.value })} onFocus={() => models.length === 0 && hasKey && void loadModels()} />
        <datalist id="ai-models">
          {models.map((m) => (
            <option key={m} value={m} />
          ))}
        </datalist>
      </Row>
      {config.provider === "openai" && (
        <Row label="Address" hint="Only for a compatible service other than OpenAI.">
          <input value={config.base_url} placeholder="https://api.openai.com/v1" onChange={(e) => void save({ base_url: e.target.value })} />
        </Row>
      )}
      <Row label="Change notes without asking" hint="Off: every edit, new note and tool-server action waits for you to allow it.">
        <Toggle on={config.auto_approve} onChange={(auto_approve) => void save({ auto_approve })} label="Change notes without asking" />
      </Row>

      <h3>Tool servers</h3>
      <p className="settings-hint">MCP servers give the assistant tools beyond your notes. Add one by its address.</p>
      {[...config.mcp, ...settings.plugin_servers.map((s) => ({ ...s, plugin: true }))].map((s) => (
        <div key={s.name} className="settings-item">
          <div className="settings-item-main">
            <strong>{s.name}</strong>
            <small>{"plugin" in s ? `${s.url} · from a plugin` : s.url}</small>
            {checked[s.name] && <small>{checked[s.name]}</small>}
          </div>
          <button className="link" onClick={() => void check(s)}>
            Check
          </button>
          {!("plugin" in s) && (
            <>
              <button className="link danger" onClick={() => void removeServer(s)}>
                Remove
              </button>
              <Toggle on={s.enabled} label={`Use ${s.name}`} onChange={(enabled) => void save({ mcp: config.mcp.map((m) => (m.name === s.name ? { ...m, enabled } : m)) })} />
            </>
          )}
        </div>
      ))}
      <div className="settings-add">
        <input value={server.name} placeholder="Name" onChange={(e) => setServer({ ...server, name: e.target.value })} />
        <input value={server.url} placeholder="https://example.com/mcp" onChange={(e) => setServer({ ...server, url: e.target.value })} />
        <input type="password" value={server.token} placeholder="Token (optional)" autoComplete="off" onChange={(e) => setServer({ ...server, token: e.target.value })} />
        <button className="settings-button" onClick={() => void addServer()}>
          Add
        </button>
      </div>
      {note && <p className="settings-hint error">{note}</p>}
    </Section>
  );
}

function permission(p: string): string {
  if (p === "vault:read") return "Read your notes";
  if (p === "vault:write") return "Change your notes";
  if (p === "editor") return "Read and type in the open note";
  return `Connect to ${p.replace(/^net:/, "")}`;
}

function PluginSettings({ manifest }: { manifest: PluginManifest }) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  useEffect(() => void pluginSettings(manifest).then(setValues), [manifest]);
  const change = (key: string, value: unknown) => {
    setValues((v) => ({ ...v, [key]: value }));
    void setPluginSetting(manifest, key, value);
  };
  return (
    <>
      {manifest.contributes.settings.map((s) => (
        <Row key={s.key} label={s.title}>
          {s.type === "toggle" ? (
            <Toggle on={Boolean(values[s.key])} label={s.title} onChange={(on) => change(s.key, on)} />
          ) : s.type === "select" ? (
            <Choice value={String(values[s.key] ?? "")} options={Object.fromEntries((s.options ?? []).map((o) => [o, o]))} onChange={(v) => change(s.key, v)} />
          ) : (
            <input type={s.type === "number" ? "number" : "text"} value={String(values[s.key] ?? "")} onChange={(e) => change(s.key, s.type === "number" ? Number(e.target.value) : e.target.value)} />
          )}
        </Row>
      ))}
    </>
  );
}

function Plugins() {
  const plugins = useStore(app, (s) => s.plugins);
  const [note, setNote] = useState<string | null>(null);
  const attempt = async (work: () => Promise<unknown>) => {
    setNote(null);
    await work().catch((e) => setNote(message(e)));
    await loadPlugins().catch((e) => setNote(message(e)));
  };
  const install = async () => {
    const from = await pickFolder();
    if (from) await attempt(() => runCore("plugins.install", { from }));
  };
  const row = (p: InstalledPlugin) => (
    <div key={p.id} className="settings-plugin">
      <div className="settings-item">
        <div className="settings-item-main">
          <strong>
            {p.manifest?.name || p.id} {p.manifest?.version && <span className="settings-version">{p.manifest.version}</span>}
          </strong>
          <small>{p.error ?? p.manifest?.description}</small>
          {p.manifest && (
            <small>{p.manifest.permissions.length ? `Can: ${p.manifest.permissions.map(permission).join(" · ")}` : "Needs no access to your notes"}</small>
          )}
        </div>
        <button className="link danger" onClick={() => void attempt(() => runCore("plugins.remove", { id: p.id }))}>
          Remove
        </button>
        {!p.error && <Toggle on={p.enabled} label={`Turn ${p.id} on`} onChange={(enabled) => void attempt(() => runCore("plugins.enable", { id: p.id, enabled }))} />}
      </div>
      {p.enabled && p.manifest && p.manifest.contributes.settings.length > 0 && <PluginSettings manifest={p.manifest} />}
    </div>
  );
  return (
    <Section title="Plugins" hint="A plugin runs in its own sandbox and can only do what is listed under it. Plugins belong to this vault and start switched off.">
      {plugins.length === 0 && <p className="settings-hint">No plugins installed.</p>}
      {plugins.map(row)}
      <button className="settings-button" onClick={() => void install()}>
        Install from a folder…
      </button>
      {note && <p className="settings-hint error">{note}</p>}
    </Section>
  );
}

const THEMES: Record<Preferences["theme"], string> = { system: "System", light: "Light", dark: "Dark" };
const FONTS: Record<Preferences["editorFont"], string> = { sans: "Sans", serif: "Serif", mono: "Mono" };

export default function SettingsView() {
  const prefs = useStore(preferences, (p) => p);
  const [analytics, setAnalytics] = useState(analyticsEnabled());
  return (
    <div className="settings">
      <div className="settings-column">
        <h1>Settings</h1>
        <Section title="Appearance">
          <Row label="Theme">
            <Choice value={prefs.theme} options={THEMES} onChange={(v) => setPreference("theme", v)} />
          </Row>
          <Row label="Note font">
            <Choice value={prefs.editorFont} options={FONTS} onChange={(v) => setPreference("editorFont", v)} />
          </Row>
        </Section>
        <Assistant />
        <Plugins />
        <Section title="Privacy">
          <Row label="Share anonymous usage" hint="Which features are used, never note names or contents.">
            <Toggle
              on={analytics}
              label="Share anonymous usage"
              onChange={(on) => {
                setAnalyticsEnabled(on);
                setAnalytics(analyticsEnabled());
              }}
            />
          </Row>
        </Section>
      </div>
    </div>
  );
}
