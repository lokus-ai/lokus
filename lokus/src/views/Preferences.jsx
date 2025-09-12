import { useEffect, useMemo, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";
import { useTheme } from "../hooks/theme.jsx";
import AccentPicker from "../components/AccentPicker.jsx";
import { listActions, getActiveShortcuts, setShortcut, resetShortcuts } from "../core/shortcuts/registry.js";
import { readConfig, updateConfig } from "../core/config/store.js";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { Search, Pencil, RotateCcw } from "lucide-react";

export default function Preferences() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [section, setSection] = useState("Appearance");
  const { mode, setMode } = useTheme();
  const actions = useMemo(() => listActions(), []);
  const [keymap, setKeymap] = useState({});
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [md, setMd] = useState({ links: true, taskList: true, tables: true, images: true });
  const [headingAltMarker, setHeadingAltMarker] = useState('^');
  const [headingAltEnabled, setHeadingAltEnabled] = useState(false);

  useEffect(() => {
    async function loadData() {
      const available = await listAvailableThemes();
      setThemes(available);
      const visuals = await readGlobalVisuals();
      setActiveTheme(visuals.theme || "");
      // load markdown prefs if present
      try {
        const { readConfig } = await import("../core/config/store.js");
        const cfg = await readConfig();
        if (cfg.markdown) setMd({ ...md, ...cfg.markdown });
      } catch {}
      // load markdown shortcut prefs
      try {
        const cfg = await readConfig();
        const hs = cfg.markdownShortcuts?.headingAlt || {};
        if (hs.marker) setHeadingAltMarker(hs.marker);
        if (typeof hs.enabled === 'boolean') setHeadingAltEnabled(hs.enabled);
      } catch {}
    }
    loadData().catch(console.error);
  }, []);

  useEffect(() => {
    getActiveShortcuts().then(setKeymap).catch(console.error);
  }, []);

  const beginEdit = (id) => setEditing(id);
  const cancelEdit = () => setEditing(null);
  const onKeyCapture = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    // Build an accelerator string similar to registry helper
    const { eventToAccelerator } = await import("../core/shortcuts/registry.js");
    const accel = eventToAccelerator(e);
    await setShortcut(id, accel);
    const next = await getActiveShortcuts();
    setKeymap(next);
    setEditing(null);
  };
  const onResetAll = async () => {
    await resetShortcuts();
    const next = await getActiveShortcuts();
    setKeymap(next);
  };

  // Split accelerator into keycap parts for premium UI
  const accelParts = (accel) => {
    if (!accel) return [];
    const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform || navigator.userAgent || "");
    const parts = accel.split('+');
    return parts.map(p => {
      if (p === 'CommandOrControl') return isMac ? '⌘' : 'Ctrl';
      if (p === 'Control') return isMac ? '⌃' : 'Ctrl';
      if (p === 'Shift') return isMac ? '⇧' : 'Shift';
      if (p === 'Alt' || p === 'Option') return isMac ? '⌥' : 'Alt';
      if (p === 'Comma') return ',';
      return p.toUpperCase();
    });
  };

  const Keycap = ({ children }) => (
    <span className="inline-flex items-center rounded-md border border-app-border bg-app-bg px-2 py-0.5 text-xs font-medium tracking-wide">
      {children}
    </span>
  );

  const handleThemeChange = (e) => {
    const themeId = e.target.value;
    setActiveTheme(themeId);
    setGlobalActiveTheme(themeId).catch(console.error);
  };

  return (
    <div className="h-screen bg-app-bg text-app-text flex flex-col">
      <header className="h-12 px-4 flex items-center border-b border-app-border bg-app-panel">
        <div className="font-medium">Preferences</div>
      </header>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "220px 1px 1fr" }}>
        {/* Sidebar */}
        <aside className="bg-app-panel/50 p-3">
          {[
            "General",
            "Appearance",
            "Markdown",
            "Shortcuts",
          ].map((name) => (
            <button
              key={name}
              onClick={() => setSection(name)}
              className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors ${
                section === name ? "bg-app-accent text-app-accent-fg" : "text-app-text hover:bg-app-bg"
              }`}
            >
              {name}
            </button>
          ))}
        </aside>
        <div className="bg-app-border/20 w-px" />

        {/* Content */}
        <main className="p-6 overflow-auto">
          {section === "Appearance" && (
            <div className="space-y-8 max-w-xl">
              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Mode</h2>
                <div className="inline-flex rounded-md border border-app-border overflow-hidden">
                  {["system","light","dark"].map(m => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`px-3 py-1 text-sm ${mode===m?"bg-app-accent text-app-accent-fg":"bg-app-panel hover:bg-app-bg"}`}
                    >
                      {m[0].toUpperCase()+m.slice(1)}
                    </button>
                  ))}
                </div>
              </section>

              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Theme</h2>
                <select
                  className="h-9 px-3 w-full rounded-md bg-app-panel border border-app-border outline-none"
                  value={activeTheme}
                  onChange={handleThemeChange}
                >
                  <option value="">Built-in</option>
                  {themes.map((theme) => (
                    <option key={theme.id} value={theme.id}>
                      {theme.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-app-muted mt-2">
                  Add more themes to <code>~/Library/Application Support/Lokus/themes/</code>
                </p>
              </section>

              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-3">Accent</h2>
                <AccentPicker />
              </section>
            </div>
          )}

          {section === "General" && (
            <div className="text-app-muted">General settings coming soon.</div>
          )}

          {section === "Markdown" && (
            <div className="max-w-2xl space-y-6">
              <div className="text-sm text-app-muted">Toggle common Markdown enhancements. Changes apply after reopening notes.</div>
              <div className="grid gap-3">
                <label className="flex items-center justify-between gap-4 border border-app-border rounded-md px-3 py-2 bg-app-panel/40">
                  <div>
                    <div className="font-medium">Auto Links</div>
                    <div className="text-xs text-app-muted">Detect and format URLs as links.</div>
                  </div>
                  <input type="checkbox" checked={md.links} onChange={e => setMdPref('links', e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-4 border border-app-border rounded-md px-3 py-2 bg-app-panel/40">
                  <div>
                    <div className="font-medium">Task Lists</div>
                    <div className="text-xs text-app-muted">[ ] and [x] style checklists.</div>
                  </div>
                  <input type="checkbox" checked={md.taskList} onChange={e => setMdPref('taskList', e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-4 border border-app-border rounded-md px-3 py-2 bg-app-panel/40">
                  <div>
                    <div className="font-medium">Tables</div>
                    <div className="text-xs text-app-muted">Create and edit tables.</div>
                  </div>
                  <input type="checkbox" checked={md.tables} onChange={e => setMdPref('tables', e.target.checked)} />
                </label>
                <label className="flex items-center justify-between gap-4 border border-app-border rounded-md px-3 py-2 bg-app-panel/40">
                  <div>
                    <div className="font-medium">Images</div>
                    <div className="text-xs text-app-muted">Embed images by URL or paste.</div>
                  </div>
                  <input type="checkbox" checked={md.images} onChange={e => setMdPref('images', e.target.checked)} />
                </label>
              </div>
              <div className="border-t border-app-border pt-4">
                <div className="text-sm text-app-muted mb-2">Alternate Shortcuts</div>
                <div className="flex items-center gap-3 mb-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={headingAltEnabled} onChange={e => setHeadingAltEnabled(e.target.checked)} />
                    Enable alternate heading marker
                  </label>
                  <input className="px-2 py-1 w-20 rounded border border-app-border bg-app-panel" maxLength={1} value={headingAltMarker} onChange={e => setHeadingAltMarker(e.target.value.slice(0,1))} placeholder="^" />
                  <button
                    className="px-2 py-1 rounded border border-app-border bg-app-panel hover:bg-app-bg"
                    onClick={async () => {
                      const invalid = ['$', '[', '!']
                      const marker = (headingAltMarker || '').trim()
                      if (!marker || invalid.includes(marker)) {
                        alert('Choose a single character that is not $, [ or !')
                        return
                      }
                      const cfg = await readConfig();
                      const next = {
                        ...(cfg || {}),
                        markdownShortcuts: {
                          ...(cfg?.markdownShortcuts || {}),
                          headingAlt: { enabled: headingAltEnabled, marker }
                        }
                      }
                      await updateConfig(next)
                      alert('Saved. Reopen notes to apply.')
                    }}
                  >Save</button>
                </div>
                <div className="text-xs text-app-muted">Example: ^^^ + space → Heading 3. We block $, [ and ! to avoid math/wiki conflicts.</div>
              </div>
              <div className="text-xs text-app-muted">Note: some changes may require reopening the editor to take effect.</div>
            </div>
          )}

          {section === "General" && (
            <div className="text-app-muted">General settings coming soon.</div>
          )}

          {section === "Shortcuts" && (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-app-muted" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search actions..."
                    className="w-full pl-8 pr-3 h-9 rounded-md bg-app-bg border border-app-border outline-none focus:ring-2 focus:ring-app-accent/40"
                  />
                </div>
                <button onClick={onResetAll} className="h-9 inline-flex items-center gap-2 px-3 rounded-md border border-app-border hover:bg-app-panel text-sm">
                  <RotateCcw className="w-4 h-4" /> Reset All
                </button>
              </div>

              <div className="rounded-lg border border-app-border overflow-hidden">
                <div className="grid grid-cols-12 bg-app-panel/40 px-4 py-2 text-xs text-app-muted">
                  <div className="col-span-7">Action</div>
                  <div className="col-span-3">Shortcut</div>
                  <div className="col-span-2 text-right">Edit</div>
                </div>
                <div className="divide-y divide-app-border/60">
                  {actions
                    .filter(a => a.name.toLowerCase().includes(query.toLowerCase()))
                    .map(a => {
                      const accel = keymap[a.id];
                      const parts = accelParts(accel);
                      return (
                        <div key={a.id} className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                          <div className="col-span-7 text-sm">{a.name}</div>
                          <div className="col-span-3">
                            {editing === a.id ? (
                              <div className="inline-flex items-center gap-2">
                                <span className="text-xs text-app-muted">Press keys…</span>
                              </div>
                            ) : (
                              <div className="flex flex-wrap items-center gap-1">
                                {parts.length > 0 ? parts.map((p, i) => (
                                  <Keycap key={i}>{p}</Keycap>
                                )) : <span className="text-xs text-app-muted">Not set</span>}
                              </div>
                            )}
                          </div>
                          <div className="col-span-2">
                            {editing === a.id ? (
                              <input
                                autoFocus
                                onKeyDown={(e) => onKeyCapture(e, a.id)}
                                onBlur={cancelEdit}
                                className="w-full h-8 text-center bg-app-bg border border-dashed border-app-border rounded outline-none"
                                placeholder={formatAccelerator(accel) || "Press keys..."}
                              />
                            ) : (
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  onClick={() => beginEdit(a.id)}
                                  className="h-8 inline-flex items-center gap-2 px-2 rounded-md border border-app-border hover:bg-app-panel text-xs"
                                >
                                  <Pencil className="w-3.5 h-3.5" /> Edit
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
  const setMdPref = async (key, value) => {
    const next = { ...md, [key]: value };
    setMd(next);
    try {
      const { updateConfig } = await import("../core/config/store.js");
      await updateConfig({ markdown: next });
    } catch (e) { console.warn("Failed to persist markdown prefs", e); }
  };
