import { useEffect, useMemo, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";
import { listActions, getActiveShortcuts, setShortcut, resetShortcuts } from "../core/shortcuts/registry.js";
import { readConfig, updateConfig } from "../core/config/store.js";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { Search, Pencil, RotateCcw } from "lucide-react";
import liveEditorSettings from "../core/editor/live-settings.js";

export default function Preferences() {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [section, setSection] = useState("Appearance");
  // Removed mode/accent complexity - themes handle everything now
  const actions = useMemo(() => listActions(), []);
  const [keymap, setKeymap] = useState({});
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [md, setMd] = useState({ links: true, taskList: true, tables: true, images: true });
  const [headingAltMarker, setHeadingAltMarker] = useState('^');
  const [headingAltEnabled, setHeadingAltEnabled] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // For showing save feedback
  const [liveSettings, setLiveSettings] = useState(liveEditorSettings.getAllSettings());
  
  // Theme is already initialized by ThemeProvider in main.jsx

  // Subscribe to live settings changes
  useEffect(() => {
    const unsubscribe = liveEditorSettings.onSettingsChange(() => {
      setLiveSettings(liveEditorSettings.getAllSettings());
    });
    return unsubscribe;
  }, []);
  
  // Enhanced Editor Preferences
  const [editorSettings, setEditorSettings] = useState({
    font: {
      family: 'ui-sans-serif',
      size: 16,
      lineHeight: 1.7,
      letterSpacing: 0.003
    },
    typography: {
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      headingColor: 'inherit',
      codeBlockTheme: 'default',
      linkColor: 'rgb(var(--accent))'
    },
    behavior: {
      autoPairBrackets: true,
      smartQuotes: false,
      autoIndent: true,
      wordWrap: true,
      showLineNumbers: false
    },
    appearance: {
      showMarkdown: false,
      focusMode: false,
      typewriterMode: false
    }
  });

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
        
        // Load editor settings
        if (cfg.editor) {
          setEditorSettings(prev => ({
            font: { ...prev.font, ...cfg.editor.font },
            typography: { ...prev.typography, ...cfg.editor.typography },
            behavior: { ...prev.behavior, ...cfg.editor.behavior },
            appearance: { ...prev.appearance, ...cfg.editor.appearance }
          }));
        }
      } catch {}
      // load markdown shortcut prefs
      try {
        const cfg = await readConfig();
        const hs = cfg.markdownShortcuts?.headingAlt || {};
        if (hs.marker) setHeadingAltMarker(hs.marker);
        if (typeof hs.enabled === 'boolean') setHeadingAltEnabled(hs.enabled);
      } catch {}
    }
    loadData().catch(() => {});
  }, []);

  useEffect(() => {
    getActiveShortcuts().then(setKeymap).catch(() => {});
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
    setGlobalActiveTheme(themeId).catch(() => {});
  };

  // Listen for theme changes from other windows
  useEffect(() => {
    const handleThemeUpdate = (e) => {
      const data = e.detail || e.payload || {};
      if (data.visuals?.theme !== undefined) {
        setActiveTheme(data.visuals.theme || "");
      }
    };

    // Listen for both DOM events (browser) and theme:apply events
    window.addEventListener('theme:apply', handleThemeUpdate);
    
    return () => {
      window.removeEventListener('theme:apply', handleThemeUpdate);
    };
  }, []);

  // Editor Settings Helpers
  const updateEditorSetting = (category, key, value) => {
    setEditorSettings(prev => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }));
  };

  const saveEditorSettings = async () => {
    try {
      setSaveStatus('saving');
      const { updateConfig } = await import("../core/config/store.js");
      await updateConfig({ editor: editorSettings });
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const resetEditorSettings = () => {
    const defaultSettings = {
      font: {
        family: 'ui-sans-serif',
        size: 16,
        lineHeight: 1.7,
        letterSpacing: 0.003
      },
      typography: {
        h1Size: 2.0,
        h2Size: 1.6,
        h3Size: 1.3,
        headingColor: 'inherit',
        codeBlockTheme: 'default',
        linkColor: 'rgb(var(--accent))'
      },
      behavior: {
        autoPairBrackets: true,
        smartQuotes: false,
        autoIndent: true,
        wordWrap: true,
        showLineNumbers: false
      },
      appearance: {
        showMarkdown: false,
        focusMode: false,
        typewriterMode: false
      }
    };
    setEditorSettings(defaultSettings);
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
            "Editor",
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

            </div>
          )}

          {section === "Editor" && (
            <div className="space-y-6 max-w-xl">
              <div className="text-sm text-app-muted mb-4">
                ✨ <strong>Real-time preview!</strong> Changes apply instantly to your editor.
              </div>
              
              {/* Font Settings - Real-time */}
              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-4">Font</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Family</label>
                    <select
                      className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                      value={liveEditorSettings.getSetting('fontFamily')}
                      onChange={(e) => liveEditorSettings.updateSetting('fontFamily', e.target.value)}
                    >
                      <option value="ui-sans-serif">System UI</option>
                      <option value="ui-serif">System Serif</option>
                      <option value="ui-monospace">System Monospace</option>
                      <option value="Inter">Inter</option>
                      <option value="Roboto">Roboto</option>
                      <option value="'Helvetica Neue', Helvetica">Helvetica</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', serif">Times New Roman</option>
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="12"
                        max="24"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('fontSize')}
                        onChange={(e) => liveEditorSettings.updateSetting('fontSize', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('fontSize')}px</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Line Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.2"
                        max="2.5"
                        step="0.1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('lineHeight')}
                        onChange={(e) => liveEditorSettings.updateSetting('lineHeight', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('lineHeight')}</span>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2">Letter Spacing</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-0.05"
                        max="0.1"
                        step="0.005"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('letterSpacing')}
                        onChange={(e) => liveEditorSettings.updateSetting('letterSpacing', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('letterSpacing')}em</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Typography Settings - Real-time */}
              <section>
                <h2 className="text-sm uppercase tracking-wide text-app-muted mb-4">Headings</h2>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">H1 Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.5"
                        max="3.0"
                        step="0.1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('h1Size')}
                        onChange={(e) => liveEditorSettings.updateSetting('h1Size', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('h1Size')}em</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">H2 Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.2"
                        max="2.5"
                        step="0.1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('h2Size')}
                        onChange={(e) => liveEditorSettings.updateSetting('h2Size', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('h2Size')}em</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">H3 Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('h3Size')}
                        onChange={(e) => liveEditorSettings.updateSetting('h3Size', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('h3Size')}em</span>
                    </div>
                  </div>
                </div>
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
                    className={`px-2 py-1 rounded border border-app-border transition-colors ${
                      saveStatus.includes('markdown') 
                        ? saveStatus === 'markdown-success' 
                          ? 'bg-green-600 text-white border-green-600'
                          : saveStatus === 'markdown-error'
                          ? 'bg-red-600 text-white border-red-600'
                          : 'bg-app-muted text-app-bg cursor-wait'
                        : 'bg-app-panel hover:bg-app-bg'
                    }`}
                    onClick={async () => {
                      const invalid = ['$', '[', '!']
                      const marker = (headingAltMarker || '').trim()
                      if (!marker || invalid.includes(marker)) {
                        setSaveStatus('markdown-invalid')
                        setTimeout(() => setSaveStatus(''), 3000)
                        return
                      }
                      try {
                        setSaveStatus('markdown-saving')
                        const cfg = await readConfig();
                        const next = {
                          ...(cfg || {}),
                          markdownShortcuts: {
                            ...(cfg?.markdownShortcuts || {}),
                            headingAlt: { enabled: headingAltEnabled, marker }
                          }
                        }
                        await updateConfig(next)
                        setSaveStatus('markdown-success')
                        setTimeout(() => setSaveStatus(''), 3000)
                      } catch (e) {
                        setSaveStatus('markdown-error')
                        setTimeout(() => setSaveStatus(''), 3000)
                      }
                    }}
                    disabled={saveStatus.includes('markdown-saving')}
                  >
                    {saveStatus === 'markdown-saving' ? 'Saving...' : saveStatus === 'markdown-success' ? 'Saved!' : saveStatus === 'markdown-error' ? 'Failed' : 'Save'}
                  </button>
                </div>
                <div className="text-xs text-app-muted">
                  {saveStatus === 'markdown-invalid' ? (
                    <span className="text-red-600">Choose a single character that is not $, [ or !</span>
                  ) : saveStatus === 'markdown-success' ? (
                    <span className="text-green-600">Saved! Reopen notes to apply changes.</span>
                  ) : saveStatus === 'markdown-error' ? (
                    <span className="text-red-600">Failed to save. Please try again.</span>
                  ) : (
                    'Example: ^^^ + space → Heading 3. We block $, [ and ! to avoid math/wiki conflicts.'
                  )}
                </div>
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
    } catch (e) { }
  };