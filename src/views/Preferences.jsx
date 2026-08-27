import { useEffect, useMemo, useState, useCallback } from "react";
import { setGlobalActiveTheme, listAvailableThemes, readGlobalVisuals, importThemeFile, validateThemeFile, exportTheme, deleteCustomTheme, getThemeTokens, saveThemeTokens, applyTokens } from "../core/theme/manager.js";
import { listActions, getActiveShortcuts, setShortcut, resetShortcuts } from "../core/shortcuts/registry.js";
import { readConfig, updateConfig } from "../core/config/store.js";
import { formatAccelerator } from "../core/shortcuts/registry.js";
import { Search, Pencil, RotateCcw, Upload, Download, Save, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { open, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import liveEditorSettings from "../core/editor/live-settings.js";
// Import editor styles for Live Preview
import "../editor/styles/editor.css";
import markdownSyntaxConfig from "../core/markdown/syntax-config.js";
import { useFeatureFlags, useAdvancedFeatures } from "../contexts/RemoteConfigContext";
import { CalendarSettings, CalendarConnectionStatus } from "../components/Calendar/index.js";
import calendarService from "../services/calendar.js";
import { useAuth } from "../core/auth/AuthContext";
import { User, LogIn, LogOut, Crown, Shield, Settings as SettingsIcon } from "lucide-react";
import QuickImport from "../components/QuickImport.jsx";
import * as P from "./preferences/primitives.jsx";
import General from "./preferences/sections/General.jsx";
import Callouts from "./preferences/sections/Callouts.jsx";
import Markdown from "./preferences/sections/Markdown.jsx";
import Editor from "./preferences/sections/Editor.jsx";
import DailyNotes from "./preferences/sections/DailyNotes.jsx";
import Shortcuts from "./preferences/sections/Shortcuts.jsx";
import Connections from "./preferences/sections/Connections.jsx";
import Account from "./preferences/sections/Account.jsx";
import Updates from "./preferences/sections/Updates.jsx";
import Import from "./preferences/sections/Import.jsx";
import SyncPreferences from "./preferences/SyncPreferences.jsx";
import TeamPreferences from "./preferences/TeamPreferences.jsx";
import { getAppVersion } from "../utils/appInfo.js";
import { isDesktop } from '../platform/index.js';
import { getCalloutConfig, saveCalloutConfig } from "@/core/editor/callout-config.js";



export default function Preferences({ workspacePath: workspacePathProp }) {
  const [themes, setThemes] = useState([]);
  const [activeTheme, setActiveTheme] = useState("");
  const [themeTokens, setThemeTokens] = useState({});
  const [originalTokens, setOriginalTokens] = useState({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [section, setSection] = useState("Appearance");
  const { isAuthenticated, user, signIn, signInWithGoogle, signInWithApple, signInWithEmail, signUpWithEmail, resetPassword, signOut, deleteAccount, isLoading, isGuest, getAccessToken } = useAuth();
  const featureFlags = useFeatureFlags();
  const { advancedFeatures, setAdvancedFeatures } = useAdvancedFeatures();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin', 'signup', 'reset'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showQuickImport, setShowQuickImport] = useState(false);
  const [icalSubscriptions, setIcalSubscriptions] = useState([]);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalLoading, setIcalLoading] = useState(false);
  // CalDAV state
  const [caldavAccount, setCaldavAccount] = useState(null);
  const [caldavLoading, setCaldavLoading] = useState(false);
  const [caldavForm, setCaldavForm] = useState({ serverUrl: 'https://caldav.icloud.com', username: '', password: '' });
  const [caldavCalendars, setCaldavCalendars] = useState([]);
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

  // Custom symbol shortcuts state
  const [customSymbols, setCustomSymbols] = useState({});
  const [newSymbolName, setNewSymbolName] = useState('');
  const [newSymbolChar, setNewSymbolChar] = useState('');

  // Workspace path (used for non-sync features)
  const [workspacePath, setWorkspacePath] = useState(workspacePathProp || '');


  // Daily Notes state
  const [dailyNotesSettings, setDailyNotesSettings] = useState({
    format: 'yyyy-MM-dd',
    folder: 'Daily Notes',
    template: '',
    openOnStartup: false
  });

  // Update settings state
  const [appVersion, setAppVersion] = useState('');
  const [betaUpdates, setBetaUpdates] = useState(false);

  // Callouts
  const [callouts, setCallouts] = useState(getCalloutConfig());





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

  // Custom symbol shortcuts helpers
  const saveCustomSymbols = async (symbols) => {
    try {
      await updateConfig({ customSymbols: symbols });
      // Emit event to notify editor to reload symbols
      const { emit } = await import('@tauri-apps/api/event');
      await emit('lokus:custom-symbols-changed', { symbols });
    } catch (e) {
      console.error('Failed to save custom symbols:', e);
    }
  };

  const addCustomSymbol = () => {
    const name = newSymbolName.trim();
    const char = newSymbolChar.trim();
    if (!name || !char) return;
    if (name.length < 2) return; // Minimum 2 characters for name

    const updated = { ...customSymbols, [name]: char };
    setCustomSymbols(updated);
    saveCustomSymbols(updated);
    setNewSymbolName('');
    setNewSymbolChar('');
  };

  const removeCustomSymbol = (name) => {
    const updated = { ...customSymbols };
    delete updated[name];
    setCustomSymbols(updated);
    saveCustomSymbols(updated);
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

  // Load app version and update preferences
  useEffect(() => {
    const loadUpdateSettings = async () => {
      try {
        const version = await getAppVersion();
        setAppVersion(version);

        // Load beta updates preference from config
        const config = await readConfig();
        if (config?.updates?.betaChannel !== undefined) {
          setBetaUpdates(config.updates.betaChannel);
        }
      } catch (error) {
        console.error('Failed to load update settings:', error);
      }
    };
    loadUpdateSettings();
  }, []);

  // Load iCal subscriptions and CalDAV account when Connections section is active
  useEffect(() => {
    if (section === 'Connections') {
      calendarService.ical.getSubscriptions().then(setIcalSubscriptions);
      calendarService.caldav.getAccount().then(account => {
        setCaldavAccount(account);
        if (account) {
          calendarService.caldav.refreshCalendars().then(setCaldavCalendars).catch(() => { });
        }
      });
    }
  }, [section]);

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
      const themeId = visuals.theme || "";
      setActiveTheme(themeId);

      // Load theme tokens for the initially selected theme
      if (themeId) {
        try {
          const tokens = await getThemeTokens(themeId);
          setThemeTokens(tokens);
          setOriginalTokens(tokens);
          setHasUnsavedChanges(false);
        } catch (err) {
          console.error('Preferences: Failed to load theme tokens', err);
        }
      }

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
      } catch (err) {
        console.error('Preferences: Failed to load editor settings', err);
      }
      // load markdown shortcut prefs
      try {
        const cfg = await readConfig();
        const hs = cfg.markdownShortcuts?.headingAlt || {};
        if (hs.marker) setHeadingAltMarker(hs.marker);
        if (typeof hs.enabled === 'boolean') setHeadingAltEnabled(hs.enabled);
      } catch (err) {
        console.error('Preferences: Failed to load markdown shortcuts', err);
      }

      // Load daily notes settings
      try {
        const cfg = await readConfig();
        if (cfg.dailyNotes) {
          setDailyNotesSettings({
            format: cfg.dailyNotes.format || 'yyyy-MM-dd',
            folder: cfg.dailyNotes.folder || 'Daily Notes',
            template: cfg.dailyNotes.template || '',
            openOnStartup: cfg.dailyNotes.openOnStartup || false
          });
        }
      } catch (err) {
        console.error('Preferences: Failed to load daily notes settings', err);
      }

      // Load custom symbols
      try {
        const cfg = await readConfig();
        if (cfg.customSymbols) {
          setCustomSymbols(cfg.customSymbols);
        }
      } catch (err) {
        console.error('Preferences: Failed to load custom symbols', err);
      }

      // Get workspace path from opener, URL params, or backend API
      try {
        let foundPath = false;

        // Always check URL params for section
        const params = new URLSearchParams(window.location.search);
        const sectionParam = params.get('section');
        if (sectionParam) {
          setSection(decodeURIComponent(sectionParam));
        }

        // Try to get workspace path from window.opener first (if opened from workspace)
        if (window.opener && window.opener.__WORKSPACE_PATH__) {
          setWorkspacePath(window.opener.__WORKSPACE_PATH__);
          foundPath = true;
        } else {
          // Try from URL params
          const path = params.get('workspacePath');
          if (path) {
            setWorkspacePath(decodeURIComponent(path));
            foundPath = true;
          }
        }

        // Fallback: Try to get from backend API state if not found
        if (!foundPath) {
          try {
            const currentWorkspace = await invoke('api_get_current_workspace');
            if (currentWorkspace) {
              setWorkspacePath(currentWorkspace);
            } else {
              if (import.meta.env.DEV) {
              }
            }
          } catch (err) {
            console.error('Preferences: Failed to get current workspace from API', err);
          }
        }
      } catch (err) {
        console.error('Preferences: Failed to get workspace path', err);
      }
    }
    loadData().catch((err) => {
      console.error('Preferences: Failed to load data', err);
    });
  }, []);

  useEffect(() => {
    getActiveShortcuts().then(setKeymap).catch((err) => {
      console.error('Preferences: Failed to get active shortcuts', err);
    });
  }, []);

  // Listen for section navigation events (when window is already open)
  useEffect(() => {
    let unlisten = null;
    const setupListener = async () => {
      try {
        const { listenWindow } = await import('../core/window/events.js');
        unlisten = await listenWindow('preferences:navigate', (event) => {
          if (event.payload) {
            setSection(event.payload);
          }
        });
      } catch (e) {
        console.error('Failed to set up preferences:navigate listener', e);
      }
    };
    setupListener();
    return () => {
      if (unlisten) unlisten();
    };
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


  const handleThemeChange = async (e) => {
    const themeId = e.target.value;
    setActiveTheme(themeId);
    await setGlobalActiveTheme(themeId).catch((err) => {
      console.error('Preferences: Failed to set global active theme', err);
    });

    // Load theme tokens for editing
    if (themeId) {
      try {
        const tokens = await getThemeTokens(themeId);
        setThemeTokens(tokens);
        setOriginalTokens(tokens);
        setHasUnsavedChanges(false);
      } catch (error) {
        setThemeTokens({});
        setOriginalTokens({});
      }
    } else {
      setThemeTokens({});
      setOriginalTokens({});
    }
  };

  const handleUploadTheme = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Theme',
          extensions: ['json']
        }]
      });

      if (!selected) return;

      const themeId = await importThemeFile(selected, false);

      // Refresh theme list
      const available = await listAvailableThemes();
      setThemes(available);

      // Switch to the new theme
      setActiveTheme(themeId);
      await setGlobalActiveTheme(themeId);

      // Load tokens
      const tokens = await getThemeTokens(themeId);
      setThemeTokens(tokens);
      setOriginalTokens(tokens);
      setHasUnsavedChanges(false);

      alert('Theme imported successfully!');
    } catch (error) {
      alert(`Failed to import theme: ${error.message}`);
    }
  };

  const handleExportTheme = async () => {
    if (!activeTheme) {
      alert('Please select a theme first');
      return;
    }

    try {
      const themeName = themes.find(t => t.id === activeTheme)?.name || activeTheme;
      const filePath = await saveDialog({
        defaultPath: `${themeName}.json`,
        filters: [{
          name: 'Theme',
          extensions: ['json']
        }]
      });

      if (!filePath) return;

      await exportTheme(activeTheme, filePath);
      alert('Theme exported successfully!');
    } catch (error) {
      alert(`Failed to export theme: ${error.message}`);
    }
  };

  const handleTokenChange = (tokenKey, newValue) => {
    const updatedTokens = { ...themeTokens, [tokenKey]: newValue };
    setThemeTokens(updatedTokens);
    setHasUnsavedChanges(true);

    // Live preview: apply changes immediately
    applyTokens(updatedTokens);
  };

  const handleSaveTheme = async () => {
    if (!activeTheme) {
      alert('Please select a theme first');
      return;
    }

    try {
      await saveThemeTokens(activeTheme, themeTokens);
      setOriginalTokens(themeTokens);
      setHasUnsavedChanges(false);
      alert('Theme saved successfully!');
    } catch (error) {
      alert(`Failed to save theme: ${error.message}`);
    }
  };

  const handleResetTheme = () => {
    setThemeTokens(originalTokens);
    setHasUnsavedChanges(false);
    applyTokens(originalTokens);
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
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  const saveDailyNotesSettings = async () => {
    try {
      await updateConfig({ dailyNotes: dailyNotesSettings });
    } catch (err) {
      console.error('Preferences: Failed to update daily notes config', err);
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
    } catch { }
  };

  // Add error boundary
  try {
    return (
      <div className="h-full bg-app-bg text-app-text flex flex-col">
        {/* Titlebar drag region for macOS traffic lights */}
        <header
          data-tauri-drag-region
          className="h-12 pl-20 pr-4 flex items-center border-b border-app-border bg-app-panel shrink-0"
        >
          {/* Title shown in window titlebar, no need to duplicate here */}
        </header>

        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: "196px 1fr" }}>
          {/* Sidebar — grouped by what kind of setting it is, so fourteen
              entries read as four short lists instead of one long one. The
              active row is marked with an accent rule and text rather than a
              solid pill, which was louder than anything in the content. */}
          <aside className="bg-app-panel border-r border-app-border py-4 px-3 overflow-y-auto">
            {[
              { label: null, items: ["General", "Appearance"] },
              {
                label: "Writing", items: [
                  "Editor",
                  "Callouts",
                  "Markdown",
                  ...(featureFlags.enable_daily_notes ? ["Daily Notes"] : []),
                  "Shortcuts",
                ]
              },
              {
                label: "Data", items: [
                  ...(featureFlags.enable_import_export ? ["Import"] : []),
                  ...(featureFlags.enable_sync ? ["Sync"] : []),
                  ...(featureFlags.enable_team_notes_foundation ? ["Teams"] : []),
                  ...(featureFlags.enable_calendar ? ["Connections"] : []),
                ]
              },
              {
                label: "About", items: [
                  "Account",
                  ...(import.meta.env.VITE_DISABLE_UPDATE_CHECKER !== 'true' ? ["Updates"] : []),
                ]
              },
            ].filter((g) => g.items.length > 0).map((group) => (
              <div key={group.label ?? "top"} className="mb-5 last:mb-0">
                {group.label && (
                  <h2 className="font-mono text-[9.5px] tracking-[0.16em] uppercase text-app-muted px-2 mb-1.5">
                    {group.label}
                  </h2>
                )}
                {group.items.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSection(name)}
                    aria-current={section === name ? "page" : undefined}
                    className={`w-full text-left pl-2 pr-2 py-[5px] text-[13.5px] rounded-[4px]
                                border-l-2 transition-colors motion-reduce:transition-none
                                focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-app-accent
                                ${section === name
                        ? "border-app-accent text-app-text bg-app-bg"
                        : "border-transparent text-app-text-secondary hover:text-app-text"}`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            ))}
          </aside>

          {/* Content */}
          <main className="p-6 overflow-auto">
            {section === "Appearance" && (
              <P.Page
                title="Appearance"
                lede="Themes are plain files. Upload one someone shared, or edit the colours here and export your own."
                actions={
                  <>
                    <P.Button onClick={handleUploadTheme}>
                      <span className="flex items-center gap-1.5"><Upload className="w-3.5 h-3.5" />Upload</span>
                    </P.Button>
                    <P.Button onClick={handleExportTheme} disabled={!activeTheme}>
                      <span className="flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Export</span>
                    </P.Button>
                  </>
                }
              >
                <P.Group label="Theme">
                  <P.Row label="Active theme" hint="Applies to every window straight away.">
                    <P.Select value={activeTheme} onChange={(v) => handleThemeChange({ target: { value: v } })}>
                      {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>{theme.name}</option>
                      ))}
                    </P.Select>
                  </P.Row>
                </P.Group>

                {activeTheme && Object.keys(themeTokens).length > 0 && (
                  <P.Group
                    label="Colours"
                    hint="Each row is one token in the theme file. Accepts an RGB triplet (255 128 0) or a hex value."
                  >
                    <div className="max-h-[320px] overflow-y-auto -mr-2 pr-2">
                      {Object.entries(themeTokens).sort().map(([key, value]) => {
                        const swatch = value.includes(' ') ? `rgb(${value})` : value;
                        return (
                          <div key={key} className="py-2 border-b border-app-border/60 last:border-b-0 flex items-center gap-3">
                            <span
                              aria-hidden
                              title={swatch}
                              className="w-4 h-4 rounded-[3px] border border-app-border flex-none"
                              style={{ backgroundColor: swatch }}
                            />
                            <label htmlFor={`tok-${key}`} className="font-mono text-[11.5px] text-app-muted flex-1 min-w-0 truncate">
                              {key}
                            </label>
                            <P.TextField
                              id={`tok-${key}`}
                              mono
                              value={value}
                              onChange={(v) => handleTokenChange(key, v)}
                              placeholder="255 128 0"
                              className="w-[150px] flex-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                    {hasUnsavedChanges && (
                      <div className="flex items-center gap-2 pt-3">
                        <P.Button tone="primary" onClick={handleSaveTheme}>Save changes</P.Button>
                        <P.Button tone="ghost" onClick={handleResetTheme}>Discard</P.Button>
                      </div>
                    )}
                  </P.Group>
                )}

                {!activeTheme && <P.Empty>Choose a theme above to edit its colours.</P.Empty>}
              </P.Page>
            )}

            {section === "Editor" && (
              <Editor
                settings={liveSettings}
                onChange={(k, v) => liveEditorSettings.updateSetting(k, v)}
                onApplyPreset={applyPreset}
                onReset={resetEditorSettings}
                onFontFamilyChange={async (v) => {
                  liveEditorSettings.updateSetting('fontFamily', v);
                  await updateConfig({ editor: { ...editorSettings, font: { ...editorSettings.font, family: v } } });
                }}
              />
            )}

            {section === "Callouts" && (
              <Callouts
                callouts={callouts}
                onChange={(next) => { setCallouts(next); saveCalloutConfig(next); }}
              />
            )}

            {section === "General" && (
              <General
                advancedFeatures={advancedFeatures}
                onAdvancedFeaturesChange={setAdvancedFeatures}
              />
            )}

            {section === "Markdown" && (
              <Markdown
                syntax={markdownSyntax}
                customSymbols={customSymbols}
                newSymbolName={newSymbolName}
                onNewSymbolNameChange={setNewSymbolName}
                newSymbolChar={newSymbolChar}
                onNewSymbolCharChange={setNewSymbolChar}
                onAddSymbol={addCustomSymbol}
                onRemoveSymbol={removeCustomSymbol}
              />
            )}

            {section === "Daily Notes" && (
              <DailyNotes
                settings={dailyNotesSettings}
                onChange={(patch) => setDailyNotesSettings((s) => ({ ...s, ...patch }))}
                onSave={saveDailyNotesSettings}
              />
            )}

            {section === "Shortcuts" && (
              <Shortcuts
                actions={actions}
                keymap={keymap}
                query={query}
                onQueryChange={setQuery}
                editing={editing}
                onBeginEdit={beginEdit}
                onCancelEdit={cancelEdit}
                onKeyCapture={onKeyCapture}
                onResetAll={onResetAll}
              />
            )}

            {section === "Connections" && (
              <Connections
                {...{
                  icalSubscriptions, setIcalSubscriptions,
                  icalUrl, setIcalUrl,
                  icalLoading, setIcalLoading,
                  caldavAccount, setCaldavAccount,
                  caldavCalendars, setCaldavCalendars,
                  caldavForm, setCaldavForm,
                  caldavLoading, setCaldavLoading,
                }}
              />
            )}

            {section === "Account" && (
              <Account
                {...{
                  isLoading, isGuest, isAuthenticated, user,
                  signInWithGoogle, signInWithApple, signInWithEmail,
                  signUpWithEmail, resetPassword, signOut, deleteAccount,
                  authMode, setAuthMode,
                  authEmail, setAuthEmail,
                  authPassword, setAuthPassword,
                  authConfirmPassword, setAuthConfirmPassword,
                  authError, setAuthError,
                  authMessage, setAuthMessage,
                  authLoading, setAuthLoading,
                  isSigningOut, setIsSigningOut,
                }}
              />
            )}

            {featureFlags.enable_sync && section === "Sync" && (
              <SyncPreferences isAuthenticated={isAuthenticated} isGuest={isGuest} userId={user?.id} workspacePath={workspacePath} />
            )}

            {featureFlags.enable_team_notes_foundation && section === "Teams" && (
              <TeamPreferences
                userId={user?.id}
                isAuthenticated={isAuthenticated}
                isGuest={isGuest}
              />
            )}


            {section === "Updates" && (
              <Updates
                appVersion={appVersion}
                betaUpdates={betaUpdates}
                onBetaUpdatesChange={async (next) => {
                  setBetaUpdates(next);
                  try { await updateConfig({ updates: { betaChannel: next } }); }
                  catch (e) { console.error('Failed to save beta updates preference:', e); }
                }}
              />
            )}

            {section === "Import" && (
              <Import onImport={() => setShowQuickImport(true)} />
            )}

          </main>
        </div>

        {/* Quick Import Modal */}
        {showQuickImport && (
          <QuickImport
            onClose={() => setShowQuickImport(false)}
            onWorkspaceOpen={(path) => {
              // TODO: Navigate to workspace
              window.dispatchEvent(new CustomEvent('open-workspace', { detail: { path } }));
            }}
          />
        )}

      </div>
    );
  } catch (error) {
    return (
      <div className="p-5 bg-app-bg text-app-text min-h-full">
        <h1 className="text-2xl font-bold mb-4">Preferences</h1>
        <p className="text-app-muted mb-4">There was an error loading preferences. Check the console for details.</p>
        <p className="text-red-500 font-mono text-xs mb-4 p-3 bg-red-500/10 rounded">
          {error.toString()}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-app-accent text-app-accent-fg rounded hover:opacity-90 transition-opacity"
        >
          Reload Window
        </button>
      </div>
    );
  }
}