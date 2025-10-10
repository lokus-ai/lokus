import { useEffect, useMemo, useState } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals } from "../core/theme/manager.js";
import { listActions, getActiveShortcuts, setShortcut, resetShortcuts } from "../core/shortcuts/registry.js";
import { readConfig, updateConfig } from "../core/config/store.js";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { Search, Pencil, RotateCcw } from "lucide-react";
import liveEditorSettings from "../core/editor/live-settings.js";
import markdownSyntaxConfig from "../core/markdown/syntax-config.js";
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
  const [markdownSyntax, setMarkdownSyntax] = useState(markdownSyntaxConfig.getAll());
  const [expandedSections, setExpandedSections] = useState({
    font: true,
    colors: false,
    spacing: false,
    typography: false,
    codeBlocks: false,
    lists: false,
    links: false,
    decorations: false,
    blockquotes: false,
    tables: false,
    presets: false
  });

  // Preset themes for quick styling
  const presets = {
    minimal: {
      fontSize: 16,
      lineHeight: 1.8,
      letterSpacing: 0,
      paragraphSpacing: 1.5,
      h1Size: 1.8,
      h2Size: 1.5,
      h3Size: 1.2,
      fontWeight: 400,
      boldWeight: 600
    },
    comfortable: {
      fontSize: 17,
      lineHeight: 1.7,
      letterSpacing: 0.003,
      paragraphSpacing: 1.2,
      h1Size: 2.0,
      h2Size: 1.6,
      h3Size: 1.3,
      fontWeight: 400,
      boldWeight: 700
    },
    compact: {
      fontSize: 14,
      lineHeight: 1.5,
      letterSpacing: -0.01,
      paragraphSpacing: 0.8,
      h1Size: 1.6,
      h2Size: 1.4,
      h3Size: 1.2,
      fontWeight: 400,
      boldWeight: 600
    },
    spacious: {
      fontSize: 18,
      lineHeight: 2.0,
      letterSpacing: 0.01,
      paragraphSpacing: 2,
      h1Size: 2.4,
      h2Size: 1.9,
      h3Size: 1.5,
      fontWeight: 300,
      boldWeight: 600
    }
  };

  const applyPreset = (presetName) => {
    const preset = presets[presetName];
    if (preset) {
      Object.keys(preset).forEach(key => {
        liveEditorSettings.updateSetting(key, preset[key]);
      });
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };
  
  // Theme is already initialized by ThemeProvider in main.jsx

  // Subscribe to live settings changes
  useEffect(() => {
    const unsubscribe = liveEditorSettings.onSettingsChange(() => {
      setLiveSettings(liveEditorSettings.getAllSettings());
    });
    return unsubscribe;
  }, []);

  // Subscribe to markdown syntax changes
  useEffect(() => {
    markdownSyntaxConfig.init();
    const unsubscribe = markdownSyntaxConfig.onChange(() => {
      setMarkdownSyntax(markdownSyntaxConfig.getAll());
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

      // Get all current settings from liveEditorSettings
      const currentSettings = liveEditorSettings.getAllSettings();

      // Save to global config (this actually works and persists)
      const { updateConfig } = await import("../core/config/store.js");
      await updateConfig({ editorSettings: currentSettings });

      setSaveStatus('success');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (e) {
      console.error('Failed to save editor settings:', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const resetEditorSettings = () => {
    // Reset live settings to defaults
    liveEditorSettings.reset();

    // Also update the local state (though not really used)
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

    // Force UI to update by triggering a re-render
    setLiveSettings(liveEditorSettings.getAllSettings());
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
            "Editor",
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
            <div className="flex flex-col lg:flex-row gap-6 max-w-7xl">
              {/* Settings Controls */}
              <div className="flex-1 space-y-2 min-w-0">
              {/* Style Presets */}
              <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                <button
                  onClick={() => toggleSection('presets')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" />
                    </svg>
                    <h2 className="text-sm font-semibold">Quick Presets</h2>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.presets ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.presets && (
                <div className="p-4 bg-app-bg/50 backdrop-blur-sm">
                  <p className="text-xs text-app-muted mb-3">Choose a preset to quickly apply professional styling</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => applyPreset('minimal')}
                      className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                    >
                      <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Minimal</div>
                      <div className="text-xs text-app-muted">Clean & simple</div>
                    </button>
                    <button
                      onClick={() => applyPreset('comfortable')}
                      className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                    >
                      <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Comfortable</div>
                      <div className="text-xs text-app-muted">Balanced & easy</div>
                    </button>
                    <button
                      onClick={() => applyPreset('compact')}
                      className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                    >
                      <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Compact</div>
                      <div className="text-xs text-app-muted">Dense & efficient</div>
                    </button>
                    <button
                      onClick={() => applyPreset('spacious')}
                      className="p-3 rounded-lg border border-app-border hover:border-app-accent hover:bg-app-accent/5 transition-all text-left group"
                    >
                      <div className="font-medium text-sm mb-1 group-hover:text-app-accent">Spacious</div>
                      <div className="text-xs text-app-muted">Airy & relaxed</div>
                    </button>
                  </div>
                </div>
                )}
              </section>

              {/* Font Settings - Real-time */}
              <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                <button
                  onClick={() => toggleSection('font')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                    <h2 className="text-sm font-semibold">Font & Typography</h2>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.font ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.font && (
                <div className="p-4 space-y-4 bg-app-bg/50 backdrop-blur-sm">
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Family</label>
                    <select
                      className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                      value={liveEditorSettings.getSetting('fontFamily')}
                      onChange={async (e) => {
                        liveEditorSettings.updateSetting('fontFamily', e.target.value);
                        await updateConfig({ editor: { ...editorSettings, font: { ...editorSettings.font, family: e.target.value } } });
                      }}
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Font Size</label>
                      <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('fontSize')}px</span>
                    </div>
                    <input
                      type="range"
                      min="12"
                      max="24"
                      step="1"
                      className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                      value={liveEditorSettings.getSetting('fontSize')}
                      onChange={(e) => liveEditorSettings.updateSetting('fontSize', parseInt(e.target.value))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Line Height</label>
                      <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('lineHeight')}</span>
                    </div>
                    <input
                      type="range"
                      min="1.2"
                      max="2.5"
                      step="0.1"
                      className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                      value={liveEditorSettings.getSetting('lineHeight')}
                      onChange={(e) => liveEditorSettings.updateSetting('lineHeight', parseFloat(e.target.value))}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-app-muted uppercase tracking-wide">Letter Spacing</label>
                      <span className="text-xs font-mono text-app-accent bg-app-accent/10 px-2 py-0.5 rounded">{liveEditorSettings.getSetting('letterSpacing')}em</span>
                    </div>
                    <input
                      type="range"
                      min="-0.05"
                      max="0.1"
                      step="0.005"
                      className="w-full h-2 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                      value={liveEditorSettings.getSetting('letterSpacing')}
                      onChange={(e) => liveEditorSettings.updateSetting('letterSpacing', parseFloat(e.target.value))}
                    />
                  </div>

                  <div className="border-t border-app-border/50 pt-4 mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-app-accent rounded-full"></div>
                      Heading Sizes
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-app-muted">H1</label>
                          <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h1Size')}em</span>
                        </div>
                        <input
                          type="range"
                          min="1.5"
                          max="3.0"
                          step="0.1"
                          className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                          value={liveEditorSettings.getSetting('h1Size')}
                          onChange={(e) => liveEditorSettings.updateSetting('h1Size', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-app-muted">H2</label>
                          <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h2Size')}em</span>
                        </div>
                        <input
                          type="range"
                          min="1.2"
                          max="2.5"
                          step="0.1"
                          className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                          value={liveEditorSettings.getSetting('h2Size')}
                          onChange={(e) => liveEditorSettings.updateSetting('h2Size', parseFloat(e.target.value))}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-app-muted">H3</label>
                          <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('h3Size')}em</span>
                        </div>
                        <input
                          type="range"
                          min="1.0"
                          max="2.0"
                          step="0.1"
                          className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                          value={liveEditorSettings.getSetting('h3Size')}
                          onChange={(e) => liveEditorSettings.updateSetting('h3Size', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-app-border/50 pt-4 mt-4">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted mb-3 flex items-center gap-2">
                      <div className="w-1 h-4 bg-app-accent rounded-full"></div>
                      Font Weights
                    </h3>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-medium text-app-muted">Normal</label>
                          <span className="text-xs font-mono text-app-accent">{liveEditorSettings.getSetting('fontWeight')}</span>
                        </div>
                        <input type="range" min="100" max="900" step="100"
                          className="w-full h-1.5 bg-app-border rounded-lg appearance-none cursor-pointer accent-app-accent"
                          value={liveEditorSettings.getSetting('fontWeight')}
                          onChange={(e) => liveEditorSettings.updateSetting('fontWeight', parseInt(e.target.value))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">Bold</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="100" max="900" step="100" className="flex-1"
                            value={liveEditorSettings.getSetting('boldWeight')}
                            onChange={(e) => liveEditorSettings.updateSetting('boldWeight', parseInt(e.target.value))}
                          />
                          <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('boldWeight')}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">H1</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="100" max="900" step="100" className="flex-1"
                            value={liveEditorSettings.getSetting('h1Weight')}
                            onChange={(e) => liveEditorSettings.updateSetting('h1Weight', parseInt(e.target.value))}
                          />
                          <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h1Weight')}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">H2</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="100" max="900" step="100" className="flex-1"
                            value={liveEditorSettings.getSetting('h2Weight')}
                            onChange={(e) => liveEditorSettings.updateSetting('h2Weight', parseInt(e.target.value))}
                          />
                          <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h2Weight')}</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium mb-1">H3</label>
                        <div className="flex items-center gap-2">
                          <input type="range" min="100" max="900" step="100" className="flex-1"
                            value={liveEditorSettings.getSetting('h3Weight')}
                            onChange={(e) => liveEditorSettings.updateSetting('h3Weight', parseInt(e.target.value))}
                          />
                          <span className="text-xs text-app-muted w-8">{liveEditorSettings.getSetting('h3Weight')}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </section>

              {/* Spacing Settings */}
              <section className="border border-app-border rounded-lg overflow-hidden bg-app-panel/30 hover:border-app-accent/30 transition-all">
                <button
                  onClick={() => toggleSection('spacing')}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-app-panel/50 to-transparent hover:from-app-panel flex items-center justify-between transition-all group"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                    </svg>
                    <h2 className="text-sm font-semibold">Spacing & Layout</h2>
                  </div>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${expandedSections.spacing ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.spacing && (
                <div className="p-4 space-y-4 bg-app-bg">
                  <div>
                    <label className="block text-sm font-medium mb-2">Paragraph Spacing</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="3"
                        step="0.25"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('paragraphSpacing')}
                        onChange={(e) => liveEditorSettings.updateSetting('paragraphSpacing', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('paragraphSpacing')}rem</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">List Item Spacing</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('listSpacing')}
                        onChange={(e) => liveEditorSettings.updateSetting('listSpacing', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('listSpacing')}rem</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Indentation Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="0.5"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('indentSize')}
                        onChange={(e) => liveEditorSettings.updateSetting('indentSize', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-12">{liveEditorSettings.getSetting('indentSize')}rem</span>
                    </div>
                  </div>
                </div>
                )}
              </section>

              {/* List Symbols */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('lists')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">List Symbols</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.lists ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.lists && (
                <div className="p-4 space-y-4 bg-app-bg">
                  <div>
                    <label className="block text-sm font-medium mb-2">Bullet Style</label>
                    <div className="flex gap-2">
                      {['•', '◦', '▪', '▸', '►', '○', '●'].map(symbol => (
                        <button
                          key={symbol}
                          onClick={() => liveEditorSettings.updateSetting('bulletStyle', symbol)}
                          className={`w-10 h-10 flex items-center justify-center rounded border transition-colors ${
                            liveEditorSettings.getSetting('bulletStyle') === symbol
                              ? 'border-app-accent bg-app-accent/10 text-app-accent'
                              : 'border-app-border hover:border-app-accent/50'
                          }`}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Checkbox Style</label>
                    <div className="flex gap-2">
                      {['☑', '✓', '✔', '☐', '✅'].map(symbol => (
                        <button
                          key={symbol}
                          onClick={() => liveEditorSettings.updateSetting('checkboxStyle', symbol)}
                          className={`w-10 h-10 flex items-center justify-center rounded border transition-colors ${
                            liveEditorSettings.getSetting('checkboxStyle') === symbol
                              ? 'border-app-accent bg-app-accent/10 text-app-accent'
                              : 'border-app-border hover:border-app-accent/50'
                          }`}
                        >
                          {symbol}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                )}
              </section>

              {/* Colors */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('colors')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Colors</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.colors ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.colors && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Text</label>
                    <input
                      type="color"
                      className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('textColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('textColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('textColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Heading</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('headingColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('headingColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('headingColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Link</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('linkColor') === '#inherit' ? '#0000ff' : liveEditorSettings.getSetting('linkColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('linkColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Link Hover</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('linkHoverColor') === '#inherit' ? '#0000cc' : liveEditorSettings.getSetting('linkHoverColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('linkHoverColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Code</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('codeColor') === '#inherit' ? '#e83e8c' : liveEditorSettings.getSetting('codeColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('codeColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Code BG</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('codeBackground')}
                      onChange={(e) => liveEditorSettings.updateSetting('codeBackground', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Quote</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('blockquoteColor') === '#inherit' ? '#6c757d' : liveEditorSettings.getSetting('blockquoteColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('blockquoteColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Quote Border</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('blockquoteBorder')}
                      onChange={(e) => liveEditorSettings.updateSetting('blockquoteBorder', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Bold</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('boldColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('boldColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('boldColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Italic</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('italicColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('italicColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('italicColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Highlight BG</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('highlightColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('highlightColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Highlight Text</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('highlightTextColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('highlightTextColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('highlightTextColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Selection</label>
                    <input type="color" className="w-full h-8 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('selectionColor').match(/#[0-9a-fA-F]{6}/)?.[0] || '#6366f1'}
                      onChange={(e) => liveEditorSettings.updateSetting('selectionColor', `rgba(${parseInt(e.target.value.slice(1,3), 16)}, ${parseInt(e.target.value.slice(3,5), 16)}, ${parseInt(e.target.value.slice(5,7), 16)}, 0.2)`)}
                    />
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Code Blocks */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('codeBlocks')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Code Blocks</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.codeBlocks ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.codeBlocks && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Background Color</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('codeBlockBg')}
                      onChange={(e) => liveEditorSettings.updateSetting('codeBlockBg', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Color</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('codeBlockBorder')}
                      onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorder', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Width</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="5"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('codeBlockBorderWidth')}
                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorderWidth', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockBorderWidth')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Radius</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="20"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('codeBlockBorderRadius')}
                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockBorderRadius', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockBorderRadius')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Padding</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="32"
                        step="2"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('codeBlockPadding')}
                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockPadding', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockPadding')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Family</label>
                    <select
                      className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                      value={liveEditorSettings.getSetting('codeBlockFont')}
                      onChange={(e) => liveEditorSettings.updateSetting('codeBlockFont', e.target.value)}
                    >
                      <option value="ui-monospace">System Monospace</option>
                      <option value="'JetBrains Mono', monospace">JetBrains Mono</option>
                      <option value="'Fira Code', monospace">Fira Code</option>
                      <option value="'Source Code Pro', monospace">Source Code Pro</option>
                      <option value="Consolas, monospace">Consolas</option>
                      <option value="Monaco, monospace">Monaco</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Font Size</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="10"
                        max="20"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('codeBlockFontSize')}
                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockFontSize', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('codeBlockFontSize')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Line Height</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1.0"
                        max="2.0"
                        step="0.1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('codeBlockLineHeight')}
                        onChange={(e) => liveEditorSettings.updateSetting('codeBlockLineHeight', parseFloat(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-8">{liveEditorSettings.getSetting('codeBlockLineHeight')}</span>
                    </div>
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Links */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('links')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Links</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.links ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.links && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Underline Style</label>
                    <select
                      className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                      value={liveEditorSettings.getSetting('linkUnderline')}
                      onChange={(e) => liveEditorSettings.updateSetting('linkUnderline', e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="hover">On Hover</option>
                      <option value="always">Always</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Underline Thickness</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('linkUnderlineThickness')}
                        onChange={(e) => liveEditorSettings.updateSetting('linkUnderlineThickness', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('linkUnderlineThickness')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Underline Offset</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="8"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('linkUnderlineOffset')}
                        onChange={(e) => liveEditorSettings.updateSetting('linkUnderlineOffset', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('linkUnderlineOffset')}px</span>
                    </div>
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Text Decorations */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('decorations')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Text Decorations</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.decorations ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.decorations && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Strikethrough Color</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('strikethroughColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('strikethroughColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Strikethrough Thickness</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('strikethroughThickness')}
                        onChange={(e) => liveEditorSettings.updateSetting('strikethroughThickness', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('strikethroughThickness')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Underline Color</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('underlineColor') === '#inherit' ? '#000000' : liveEditorSettings.getSetting('underlineColor')}
                      onChange={(e) => liveEditorSettings.updateSetting('underlineColor', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Underline Thickness</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('underlineThickness')}
                        onChange={(e) => liveEditorSettings.updateSetting('underlineThickness', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('underlineThickness')}px</span>
                    </div>
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Blockquotes */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('blockquotes')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Blockquotes</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.blockquotes ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.blockquotes && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Width</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="8"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('blockquoteBorderWidth')}
                        onChange={(e) => liveEditorSettings.updateSetting('blockquoteBorderWidth', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('blockquoteBorderWidth')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Padding</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="8"
                        max="32"
                        step="2"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('blockquotePadding')}
                        onChange={(e) => liveEditorSettings.updateSetting('blockquotePadding', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('blockquotePadding')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Style</label>
                    <select
                      className="w-full h-9 px-3 rounded-md bg-app-panel border border-app-border outline-none"
                      value={liveEditorSettings.getSetting('blockquoteStyle')}
                      onChange={(e) => liveEditorSettings.updateSetting('blockquoteStyle', e.target.value)}
                    >
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                      <option value="double">Double</option>
                    </select>
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Tables */}
              <section className="border border-app-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleSection('tables')}
                  className="w-full px-4 py-3 bg-app-panel/50 hover:bg-app-panel flex items-center justify-between transition-colors"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide">Tables</h2>
                  <svg className={`w-5 h-5 transition-transform ${expandedSections.tables ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {expandedSections.tables && (
                <div className="p-4 bg-app-bg">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Color</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('tableBorder')}
                      onChange={(e) => liveEditorSettings.updateSetting('tableBorder', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Header Background</label>
                    <input
                      type="color"
                      className="w-full h-10 rounded border border-app-border cursor-pointer"
                      value={liveEditorSettings.getSetting('tableHeaderBg')}
                      onChange={(e) => liveEditorSettings.updateSetting('tableHeaderBg', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Border Width</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        step="1"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('tableBorderWidth')}
                        onChange={(e) => liveEditorSettings.updateSetting('tableBorderWidth', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('tableBorderWidth')}px</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Cell Padding</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="4"
                        max="20"
                        step="2"
                        className="flex-1"
                        value={liveEditorSettings.getSetting('tableCellPadding')}
                        onChange={(e) => liveEditorSettings.updateSetting('tableCellPadding', parseInt(e.target.value))}
                      />
                      <span className="text-sm text-app-muted w-10">{liveEditorSettings.getSetting('tableCellPadding')}px</span>
                    </div>
                  </div>
                </div>
                </div>
                )}
              </section>

              {/* Save Button */}
              <div className="flex justify-end gap-3 pt-4 sticky bottom-0 bg-gradient-to-t from-app-bg via-app-bg to-transparent border-t border-app-border/50 py-4 backdrop-blur-sm">
                <button
                  onClick={resetEditorSettings}
                  className="px-4 py-2 rounded-lg border border-app-border hover:bg-app-panel hover:border-app-accent/50 transition-all flex items-center gap-2 group"
                >
                  <svg className="w-4 h-4 group-hover:rotate-180 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset
                </button>
                <button
                  onClick={saveEditorSettings}
                  className={`px-6 py-2 rounded-lg transition-all flex items-center gap-2 font-medium shadow-lg ${
                    saveStatus === 'saving'
                      ? 'bg-app-muted text-app-bg cursor-wait'
                      : saveStatus === 'success'
                      ? 'bg-green-600 text-white shadow-green-600/50'
                      : saveStatus === 'error'
                      ? 'bg-red-600 text-white shadow-red-600/50'
                      : 'bg-app-accent text-white hover:bg-app-accent/90 hover:shadow-app-accent/50'
                  }`}
                >
                  {saveStatus === 'saving' && (
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {saveStatus === 'success' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {saveStatus === 'error' && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {!saveStatus && (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                  )}
                  {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'success' ? 'Saved!' : saveStatus === 'error' ? 'Failed' : 'Save Settings'}
                </button>
              </div>
              </div>

              {/* Live Preview - Sticky on the right */}
              <div className="lg:w-[400px] lg:sticky lg:top-6 self-start">
                <div className="border border-app-border rounded-xl p-4 bg-gradient-to-br from-app-panel/50 to-app-bg backdrop-blur-sm shadow-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-app-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-app-muted">Live Preview</h3>
                  </div>
                  <div
                    className="ProseMirror min-h-[400px] max-h-[600px] overflow-y-auto p-4 bg-app-bg/80 rounded-lg border border-app-border/50 shadow-inner"
                    style={{
                      fontFamily: `var(--editor-font-family, ui-sans-serif)`,
                      fontSize: `var(--editor-font-size, 16px)`,
                      lineHeight: `var(--editor-line-height, 1.7)`,
                      letterSpacing: `var(--editor-letter-spacing, 0.003em)`,
                      color: `var(--editor-text-color, rgb(var(--text)))`
                    }}
                  >
                    <h1>Heading 1</h1>
                    <h2>Heading 2</h2>
                    <h3>Heading 3</h3>
                    <p>This is a paragraph with some <strong>bold text</strong> and <em>italic text</em>. You can see how your font settings affect the editor in real-time.</p>
                    <ul>
                      <li>Bullet point one</li>
                      <li>Bullet point two</li>
                      <li>Nested list:
                        <ul>
                          <li>Nested item 1</li>
                          <li>Nested item 2</li>
                        </ul>
                      </li>
                    </ul>
                    <p>Here's a <a href="#">link example</a> and some <code>inline code</code>.</p>
                    <blockquote>
                      <p>This is a blockquote to test quote styling.</p>
                    </blockquote>
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === "General" && (
            <div className="text-app-muted">General settings coming soon.</div>
          )}

          {section === "Markdown" && (
            <div className="max-w-3xl space-y-6">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-app-muted">Customize markdown syntax characters and behaviors</div>
                <button
                  onClick={() => markdownSyntaxConfig.reset()}
                  className="h-9 inline-flex items-center gap-2 px-3 rounded-md border border-app-border hover:bg-app-panel text-sm"
                >
                  <RotateCcw className="w-4 h-4" /> Reset All
                </button>
              </div>

              <div className="rounded-lg border border-app-border overflow-hidden">
                <div className="grid grid-cols-12 bg-app-panel/40 px-4 py-2 text-xs text-app-muted">
                  <div className="col-span-5">Syntax</div>
                  <div className="col-span-3">Marker</div>
                  <div className="col-span-4 text-right">Enabled</div>
                </div>
                <div className="divide-y divide-app-border/60">
                  {/* Headers */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-xl w-6 text-center">#</span>
                      <div>
                        <div className="text-sm">Headers</div>
                        <div className="text-xs text-app-muted">Heading marker</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="2"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.heading?.marker || '#'}
                        onChange={(e) => markdownSyntaxConfig.set('heading', 'marker', e.target.value)}
                        disabled={markdownSyntax.heading?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('heading', 'enabled', !(markdownSyntax.heading?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.heading?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.heading?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Bold */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="font-bold text-xl w-6 text-center">B</span>
                      <div>
                        <div className="text-sm">Bold</div>
                        <div className="text-xs text-app-muted">Wrapping characters for bold text</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="3"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.bold?.marker || '**'}
                        onChange={(e) => markdownSyntaxConfig.set('bold', 'marker', e.target.value)}
                        disabled={markdownSyntax.bold?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('bold', 'enabled', !(markdownSyntax.bold?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.bold?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.bold?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Italic */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="italic text-xl w-6 text-center">I</span>
                      <div>
                        <div className="text-sm">Italic</div>
                        <div className="text-xs text-app-muted">Wrapping characters for italic text</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="2"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.italic?.marker || '*'}
                        onChange={(e) => markdownSyntaxConfig.set('italic', 'marker', e.target.value)}
                        disabled={markdownSyntax.italic?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('italic', 'enabled', !(markdownSyntax.italic?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.italic?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.italic?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Inline Code */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="font-mono text-app-accent text-xl w-6 text-center">`</span>
                      <div>
                        <div className="text-sm">Inline Code</div>
                        <div className="text-xs text-app-muted">Wrapping character for code</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="2"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.inlineCode?.marker || '`'}
                        onChange={(e) => markdownSyntaxConfig.set('inlineCode', 'marker', e.target.value)}
                        disabled={markdownSyntax.inlineCode?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('inlineCode', 'enabled', !(markdownSyntax.inlineCode?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.inlineCode?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.inlineCode?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Strikethrough */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="line-through text-xl w-6 text-center">S</span>
                      <div>
                        <div className="text-sm">Strikethrough</div>
                        <div className="text-xs text-app-muted">Wrapping characters for strikethrough</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="3"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.strikethrough?.marker || '~~'}
                        onChange={(e) => markdownSyntaxConfig.set('strikethrough', 'marker', e.target.value)}
                        disabled={markdownSyntax.strikethrough?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('strikethrough', 'enabled', !(markdownSyntax.strikethrough?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.strikethrough?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.strikethrough?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Highlight */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="bg-yellow-200/30 px-1 text-xl w-6 text-center">H</span>
                      <div>
                        <div className="text-sm">Highlight</div>
                        <div className="text-xs text-app-muted">Wrapping characters for highlights</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="3"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.highlight?.marker || '=='}
                        onChange={(e) => markdownSyntaxConfig.set('highlight', 'marker', e.target.value)}
                        disabled={markdownSyntax.highlight?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('highlight', 'enabled', !(markdownSyntax.highlight?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.highlight?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.highlight?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Bullet Lists */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-xl w-6 text-center">•</span>
                      <div>
                        <div className="text-sm">Bullet Lists</div>
                        <div className="text-xs text-app-muted">Default list marker</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <select
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.bulletList?.defaultMarker || '-'}
                        onChange={(e) => markdownSyntaxConfig.set('bulletList', 'defaultMarker', e.target.value)}
                        disabled={markdownSyntax.bulletList?.enabled === false}
                      >
                        {(markdownSyntax.bulletList?.markers || ['*', '-', '+']).map(m => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('bulletList', 'enabled', !(markdownSyntax.bulletList?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.bulletList?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.bulletList?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Blockquote */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-app-muted text-xl w-6 text-center">&gt;</span>
                      <div>
                        <div className="text-sm">Blockquote</div>
                        <div className="text-xs text-app-muted">Quote line prefix</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="2"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.blockquote?.marker || '>'}
                        onChange={(e) => markdownSyntaxConfig.set('blockquote', 'marker', e.target.value)}
                        disabled={markdownSyntax.blockquote?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('blockquote', 'enabled', !(markdownSyntax.blockquote?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.blockquote?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.blockquote?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Wiki Links */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-app-accent w-6 text-center font-mono text-xl">[[</span>
                      <div>
                        <div className="text-sm">Wiki Links</div>
                        <div className="text-xs text-app-muted">Opening/closing brackets</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <div className="flex gap-1">
                        <input
                          type="text"
                          maxLength="3"
                          className="w-9 px-1 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                          value={markdownSyntax.link?.wikiLink?.open || '[['}
                          onChange={(e) => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, open: e.target.value }})}
                          disabled={markdownSyntax.link?.wikiLink?.enabled === false}
                        />
                        <input
                          type="text"
                          maxLength="3"
                          className="w-9 px-1 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                          value={markdownSyntax.link?.wikiLink?.close || ']]'}
                          onChange={(e) => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, close: e.target.value }})}
                          disabled={markdownSyntax.link?.wikiLink?.enabled === false}
                        />
                      </div>
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('link', { ...markdownSyntax.link, wikiLink: { ...markdownSyntax.link?.wikiLink, enabled: !(markdownSyntax.link?.wikiLink?.enabled !== false) }})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.link?.wikiLink?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.link?.wikiLink?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>

                  {/* Images */}
                  <div className="grid grid-cols-12 items-center px-4 py-2 hover:bg-app-panel/30">
                    <div className="col-span-5 flex items-center gap-3">
                      <span className="text-xl w-6 text-center">🖼</span>
                      <div>
                        <div className="text-sm">Images</div>
                        <div className="text-xs text-app-muted">Image prefix marker</div>
                      </div>
                    </div>
                    <div className="col-span-3">
                      <input
                        type="text"
                        maxLength="2"
                        className="w-20 px-2 py-1 text-center text-sm rounded bg-app-bg border border-app-border focus:border-app-accent outline-none font-mono"
                        value={markdownSyntax.image?.marker || '!'}
                        onChange={(e) => markdownSyntaxConfig.set('image', 'marker', e.target.value)}
                        disabled={markdownSyntax.image?.enabled === false}
                      />
                    </div>
                    <div className="col-span-4 flex justify-end">
                      <button
                        onClick={() => markdownSyntaxConfig.set('image', 'enabled', !(markdownSyntax.image?.enabled !== false))}
                        className={`w-12 h-6 rounded-full transition-colors relative ${
                          markdownSyntax.image?.enabled !== false ? 'bg-app-accent' : 'bg-app-border'
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full bg-white absolute top-1 transition-transform ${
                          markdownSyntax.image?.enabled !== false ? 'translate-x-7' : 'translate-x-1'
                        }`}></div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    const json = markdownSyntaxConfig.export();
                    navigator.clipboard.writeText(json);
                    alert('Copied to clipboard!');
                  }}
                  className="px-4 py-2 text-sm rounded-lg border border-app-border hover:bg-app-panel transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={async () => {
                    const saved = await markdownSyntaxConfig.save();
                    setSaveStatus(saved ? 'success' : 'error');
                    setTimeout(() => setSaveStatus(''), 3000);

                    // Emit event to notify other windows to reload config
                    if (saved) {
                      try {
                        const { emit } = await import('@tauri-apps/api/event');
                        await emit('lokus:markdown-config-changed', {
                          config: markdownSyntaxConfig.getAll()
                        });
                        console.log('[Preferences] Emitted lokus:markdown-config-changed event');
                      } catch (e) {
                        console.error('[Preferences] Failed to emit config change event:', e);
                      }
                    }
                  }}
                  className="px-6 py-2 text-sm rounded-lg bg-app-accent text-white hover:bg-app-accent/90 transition-colors relative"
                >
                  {saveStatus === 'success' ? '✓ Saved!' : saveStatus === 'error' ? '✗ Failed' : 'Save Configuration'}
                </button>
              </div>
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