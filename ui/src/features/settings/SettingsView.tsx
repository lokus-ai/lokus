/** @part-of ui.settings */
import { type ReactNode, useCallback, useEffect, useState } from "react";

import { type AiConfig, type AiSettings, aiSettings, chatgptLogin, chatgptLogout, saveAiConfig, setAiSecret } from "../../bridge/ai";
import { analyticsEnabled, setAnalyticsEnabled } from "../../bridge/analytics";
import { type InstalledPlugin, pickFolder, type PluginManifest, runCore } from "../../bridge/core";
import { Icon, type IconName } from "../../shell/Icon";
import { noteFont, type Preferences, preferences, setPreference } from "../../shell/preferences";
import { useStore } from "../../shell/store";
import { app, applyLayout } from "../../shell/workspace";
import { loadPlugins, pluginSettings, setPluginSetting } from "../plugins/host";
import { Connections } from "../connections/Connections";
import { ProfileSettings } from "../profile/Profile";
import { UpdateSettings } from "../updates/UpdateCard";
import { TeamSettings } from "../teams/TeamSettings";
import { Choice, Row, Section, Toggle } from "./parts";

const PROVIDERS = { anthropic: "Claude", openai: "OpenAI-compatible", chatgpt: "ChatGPT plan" } as const;

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function Assistant() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [key, setKey] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);

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
  const signInChatGpt = async () => {
    setNote(null);
    setSigningIn(true);
    await chatgptLogin().catch((e) => setNote(message(e)));
    setSigningIn(false);
    await reload();
  };
  return (
    <Section title="Assistant" hint="Bring your own key. It is stored in this computer's keychain and requests go straight from Lokus to the provider. Pick the model in the chat box.">
      <Row label="Provider">
        <Choice value={config.provider} options={PROVIDERS} onChange={(provider) => void save({ provider, model: "" })} />
      </Row>
      {config.provider === "chatgpt" ? (
        <Row label="ChatGPT account" hint={hasKey ? "Signed in. Requests use your ChatGPT plan." : "Uses your own ChatGPT Plus or Pro plan. No API key."}>
          {hasKey ? (
            <button className="settings-button" onClick={() => void chatgptLogout().then(reload)}>
              Sign out
            </button>
          ) : (
            <button className="settings-button" disabled={signingIn} onClick={() => void signInChatGpt()}>
              {signingIn ? "Finish in your browser…" : "Sign in with ChatGPT"}
            </button>
          )}
        </Row>
      ) : (
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
      )}
      {config.provider === "openai" && (
        <Row label="Address" hint="Only for a compatible service other than OpenAI.">
          <input value={config.base_url} placeholder="https://api.openai.com/v1" onChange={(e) => void save({ base_url: e.target.value })} />
        </Row>
      )}
      <Row label="Change notes without asking" hint="Off: every edit, new note and action in a connected service waits for you to allow it.">
        <Toggle on={config.auto_approve} onChange={(auto_approve) => void save({ auto_approve })} label="Change notes without asking" />
      </Row>

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
const DENSITIES: Record<Preferences["density"], string> = { roomy: "Roomy", regular: "Regular", compact: "Compact" };
const DETAILS: Record<Preferences["detail"], string> = { essentials: "Essentials", balanced: "Balanced", everything: "Everything" };
const LAYOUTS: Record<Preferences["layout"], string> = { focused: "Just the page", standard: "Page and sidebar", everything: "With the assistant" };
const DETAIL_HINT: Record<Preferences["detail"], string> = {
  essentials: "Only what you need to act: names, who it belongs to, what is at risk.",
  balanced: "The useful extras too: who a task is for, when it is due, why a customer needs you.",
  everything: "All of it: task numbers, every label, where each message came from.",
};
const FONTS: Record<Preferences["editorFont"], string> = { sans: "Sans", serif: "Serif", mono: "Mono", custom: "Custom" };
const WIDTHS: Record<Preferences["pageWidth"], string> = { narrow: "Narrow", regular: "Regular", wide: "Wide", full: "Full" };

function Range({ value, min, max, step, unit, onChange }: { value: number; min: number; max: number; step: number; unit: string; onChange(v: number): void }) {
  return (
    <>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <output>
        {value}
        {unit}
      </output>
    </>
  );
}

/** How notes read: typeface, size, spacing and column width, with a sample that follows the choices. */
function Editor() {
  const prefs = useStore(preferences, (p) => p);
  return (
    <Section title="Editor" hint="How your notes read on this computer. Nothing here changes the files.">
      <div className="settings-sample" style={{ fontFamily: noteFont(prefs), fontSize: prefs.fontSize, lineHeight: prefs.lineHeight }}>
        <strong>Field notes</strong>
        <p>Six days across the Alta Via with a borrowed film camera. The huts were warm, the weather was moody, and the coffee deserves its own note.</p>
      </div>
      <Row label="Typeface">
        <Choice value={prefs.editorFont} options={FONTS} onChange={(v) => setPreference("editorFont", v)} />
      </Row>
      {prefs.editorFont === "custom" && (
        <Row label="Font name" hint="Any font installed on this computer, spelled as it appears in Font Book.">
          <input value={prefs.customFont} placeholder="Charter" spellCheck={false} onChange={(e) => setPreference("customFont", e.target.value)} />
        </Row>
      )}
      <Row label="Text size">
        <Range value={prefs.fontSize} min={13} max={24} step={1} unit="px" onChange={(v) => setPreference("fontSize", v)} />
      </Row>
      <Row label="Line spacing">
        <Range value={prefs.lineHeight} min={1.3} max={2} step={0.05} unit="" onChange={(v) => setPreference("lineHeight", Number(v.toFixed(2)))} />
      </Row>
      <Row label="Page width" hint="How wide the column of text may grow.">
        <Choice value={prefs.pageWidth} options={WIDTHS} onChange={(v) => setPreference("pageWidth", v)} />
      </Row>
    </Section>
  );
}

function Appearance() {
  const theme = useStore(preferences, (p) => p.theme);
  const density = useStore(preferences, (p) => p.density);
  const detail = useStore(preferences, (p) => p.detail);
  const layout = useStore(preferences, (p) => p.layout);
  return (
    <Section title="Appearance">
      <Row label="Theme" hint="System follows your computer's light or dark setting.">
        <Choice value={theme} options={THEMES} onChange={(v) => setPreference("theme", v)} />
      </Row>
      <h3>Layout</h3>
      <p className="settings-hint">How much is on your screen at once. Change these any time; nothing is lost when something is hidden.</p>
      <Row label="Spacing" hint="How much room rows, cards and lists take.">
        <Choice value={density} options={DENSITIES} onChange={(v) => setPreference("density", v)} />
      </Row>
      <Row label="Detail" hint={DETAIL_HINT[detail]}>
        <Choice value={detail} options={DETAILS} onChange={(v) => setPreference("detail", v)} />
      </Row>
      <Row label="When Lokus opens, show" hint="The sidebar and the assistant can always be opened and closed by hand.">
        <Choice
          value={layout}
          options={LAYOUTS}
          onChange={(v) => {
            setPreference("layout", v);
            applyLayout();
          }}
        />
      </Row>
    </Section>
  );
}

function Privacy() {
  const [analytics, setAnalytics] = useState(analyticsEnabled());
  return (
    <Section title="Privacy">
      <Row label="Share anonymous usage" hint="Which features are used and what you answered during setup. Never note names or contents.">
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
  );
}

const PAGES: { id: string; title: string; icon: IconName; body: () => ReactNode }[] = [
  { id: "profile", title: "Profile", icon: "account", body: () => <ProfileSettings /> },
  { id: "appearance", title: "Appearance", icon: "appearance", body: () => <Appearance /> },
  { id: "editor", title: "Editor", icon: "type", body: () => <Editor /> },
  { id: "team", title: "Team", icon: "team", body: () => <TeamSettings /> },
  { id: "connections", title: "Connections", icon: "plug", body: () => <Connections /> },
  { id: "assistant", title: "Assistant", icon: "assistant", body: () => <Assistant /> },
  { id: "plugins", title: "Plugins", icon: "plugins", body: () => <Plugins /> },
  { id: "privacy", title: "Privacy", icon: "privacy", body: () => <Privacy /> },
  { id: "updates", title: "Updates", icon: "download", body: () => <UpdateSettings /> },
];

interface Props {
  page: string;
  onPage(page: string): void;
  onClose(): void;
}

/** Settings open over the app as a dialog: pages on the left, the chosen page on the right. */
export default function SettingsView({ page, onPage, onClose }: Props) {
  const current = PAGES.find((p) => p.id === page) ?? PAGES[0];
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="settings-dialog" role="dialog" aria-label="Settings" onMouseDown={(e) => e.stopPropagation()}>
        <nav className="settings-nav">
          <p>Settings</p>
          {PAGES.map((p) => (
            <button key={p.id} className={p.id === current.id ? "active" : ""} onClick={() => onPage(p.id)}>
              <Icon name={p.icon} />
              {p.title}
            </button>
          ))}
        </nav>
        <div className="settings">
          <button className="panel-close settings-close" title="Close (Esc)" onClick={onClose}>
            <Icon name="close" size={14} />
          </button>
          {current.body()}
        </div>
      </div>
    </div>
  );
}
