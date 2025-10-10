import { useEffect, useMemo, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";
import { listActions, getActiveShortcuts, setShortcut, resetShortcuts } from "../core/shortcuts/registry.js";
import { readConfig, updateConfig } from "../core/config/store.js";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { Search, Pencil, RotateCcw } from "lucide-react";
import liveEditorSettings from "../core/editor/live-settings.js";
import AIAssistant from "./preferences/AIAssistant.jsx";
import ConnectionStatus from "../components/ConnectionStatus.jsx";
import GmailLogin from "../components/gmail/GmailLogin.jsx";
import { useAuth } from "../core/auth/AuthContext";
import { User, LogIn, LogOut, Crown, Shield, Settings as SettingsIcon } from "lucide-react";

export default function Preferences() {
  console.log('🔧 Preferences component rendering');
  console.log('🔧 Window location:', window.location.href);
  console.log('🔧 Window search params:', new URLSearchParams(window.location.search).toString());
  console.log('🔧 Document root styles:', window.getComputedStyle(document.documentElement).getPropertyValue('--bg'));
  console.log('🔧 Document body classes:', document.body.className);
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [section, setSection] = useState("Appearance");
  const { isAuthenticated, user, signIn, signOut, isLoading } = useAuth();
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  const setMdPref = async (key, value) => {
    const next = { ...md, [key]: value };
    setMd(next);
    try {
      const { updateConfig } = await import("../core/config/store.js");
      await updateConfig({ markdown: next });
    } catch (e) { }
  };

  // Add error boundary
  try {
    return (
      <div className="h-screen bg-app-bg text-app-text flex flex-col" style={{ 
        minHeight: '100vh', 
        backgroundColor: 'var(--bg, #ffffff)', 
        color: 'var(--text, #000000)',
        fontFamily: 'ui-sans-serif, -apple-system, BlinkMacSystemFont, system-ui, sans-serif'
      }}>
        <header className="h-12 px-4 flex items-center border-b border-app-border bg-app-panel" style={{ 
          backgroundColor: 'var(--panel, #f5f5f5)', 
          borderColor: 'var(--border, #e5e5e5)',
          borderBottomWidth: '1px',
          borderBottomStyle: 'solid'
        }}>
          <div className="font-medium" style={{ fontSize: '14px', fontWeight: '500' }}>Preferences</div>
        </header>

      <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "220px 1px 1fr" }}>
        {/* Sidebar */}
        <aside className="bg-app-panel/50 p-3">
          {[
            // "General",
            "Appearance",
            // "Editor",
            "Markdown",
            "Shortcuts",
            "Connections",
            "Account",
            "AI Assistant",
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

          {section === "Connections" && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-4 text-app-text">Connections</h2>
                <p className="text-app-text-secondary mb-6">
                  Connect external services and manage integrations with your workspace.
                </p>
              </div>

              {/* Available Connections */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-app-text">Available Services</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Gmail - Real connection */}
                  <div className="bg-app-panel border border-app-border rounded-lg p-4 hover:bg-app-panel/80 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center text-white font-semibold">
                          G
                        </div>
                        <div>
                          <h4 className="font-medium text-app-text">Gmail</h4>
                          <p className="text-xs text-app-text-secondary">Email integration</p>
                        </div>
                      </div>
                      <ConnectionStatus />
                    </div>
                  </div>

                  {/* Outlook - Disabled */}
                  <div className="bg-app-panel border border-app-border rounded-lg p-4 opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold">
                          O
                        </div>
                        <div>
                          <h4 className="font-medium text-app-text-secondary">Outlook</h4>
                          <p className="text-xs text-app-text-secondary">Coming soon</p>
                        </div>
                      </div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Jira - Disabled */}
                  <div className="bg-app-panel border border-app-border rounded-lg p-4 opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-semibold">
                          J
                        </div>
                        <div>
                          <h4 className="font-medium text-app-text-secondary">Jira</h4>
                          <p className="text-xs text-app-text-secondary">Coming soon</p>
                        </div>
                      </div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    </div>
                  </div>

                  {/* Slack - Disabled */}
                  <div className="bg-app-panel border border-app-border rounded-lg p-4 opacity-50 cursor-not-allowed">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center text-white font-semibold">
                          S
                        </div>
                        <div>
                          <h4 className="font-medium text-app-text-secondary">Slack</h4>
                          <p className="text-xs text-app-text-secondary">Coming soon</p>
                        </div>
                      </div>
                      <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gmail Connection Component */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-app-text">Gmail Integration</h3>
                <GmailLogin />
              </div>
            </div>
          )}

          {section === "Account" && (
            <div className="space-y-8 max-w-2xl">
              {/* Account Header */}
              <div>
                <h1 className="text-2xl font-bold text-app-text mb-2">Account</h1>
                <p className="text-app-text-secondary">
                  Manage your account settings, authentication, and profile.
                </p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-app-accent border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : !isAuthenticated ? (
                /* Sign In State */
                <div className="bg-app-panel border border-app-border rounded-xl p-8">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-app-accent rounded-full flex items-center justify-center mx-auto mb-6">
                      <LogIn className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-app-text mb-3">Sign in to Lokus</h2>
                    <p className="text-app-text-secondary mb-8 max-w-md mx-auto">
                      Sync your notes across devices and access your account.
                    </p>
                    <button
                      onClick={async () => {
                        try {
                          await signIn();
                        } catch (error) {
                          console.error('Sign in failed:', error);
                        }
                      }}
                      className="inline-flex items-center gap-2 px-6 py-3 bg-app-accent text-white font-medium rounded-lg hover:bg-app-accent/90 transition-colors"
                    >
                      <LogIn className="w-4 h-4" />
                      Sign In
                    </button>
                  </div>
                </div>
              ) : (
                /* Signed In State - Arc-like Dashboard */
                <div className="space-y-6">
                  {/* Profile Section */}
                  <div className="bg-app-panel border border-app-border rounded-xl p-6">
                    <div className="flex items-center gap-4">
                      {user?.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt="Profile"
                          className="w-16 h-16 rounded-full border-2 border-app-border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-app-accent rounded-full flex items-center justify-center">
                          <User className="w-8 h-8 text-white" />
                        </div>
                      )}
                      <div className="flex-1">
                        <h2 className="text-lg font-semibold text-app-text">
                          {user?.name || 'User'}
                        </h2>
                        <p className="text-app-text-secondary text-sm">
                          {user?.email || 'No email available'}
                        </p>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            setIsSigningOut(true);
                            await signOut();
                          } catch (error) {
                            console.error('Sign out failed:', error);
                          } finally {
                            setIsSigningOut(false);
                          }
                        }}
                        disabled={isSigningOut}
                        className="px-4 py-2 text-app-text-secondary hover:text-app-text border border-app-border rounded-lg hover:bg-app-bg transition-colors disabled:opacity-50"
                      >
                        {isSigningOut ? 'Signing out...' : 'Sign Out'}
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-app-panel border border-app-border rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-app-text">247</div>
                      <div className="text-sm text-app-text-secondary">Notes</div>
                    </div>
                    <div className="bg-app-panel border border-app-border rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-app-text">12</div>
                      <div className="text-sm text-app-text-secondary">Days</div>
                    </div>
                    <div className="bg-app-panel border border-app-border rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-app-text">1.2GB</div>
                      <div className="text-sm text-app-text-secondary">Storage</div>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="bg-app-panel border border-app-border rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-app-text mb-4">Account Features</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-app-accent rounded-full"></div>
                        <span className="text-app-text">Cross-device sync</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-app-accent rounded-full"></div>
                        <span className="text-app-text">Cloud backup</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 bg-app-accent rounded-full"></div>
                        <span className="text-app-text">Collaboration tools</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {section === "AI Assistant" && (
            <AIAssistant />
          )}
        </main>
      </div>
    </div>
    );
  } catch (error) {
    console.error('🔧 Preferences rendering error:', error);
    return (
      <div style={{ padding: '20px', backgroundColor: '#ffffff', color: '#000000', minHeight: '100vh' }}>
        <h1>Preferences</h1>
        <p>There was an error loading preferences. Check the console for details.</p>
        <p style={{ color: '#ff0000', fontFamily: 'monospace', fontSize: '12px' }}>
          {error.toString()}
        </p>
        <button onClick={() => window.location.reload()} style={{ padding: '10px', marginTop: '10px' }}>
          Reload Window
        </button>
      </div>
    );
  }
}