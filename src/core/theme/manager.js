import { emit } from "@tauri-apps/api/event";
import { readConfig, updateConfig } from "../config/store.js";
import platformService from "../../services/platform/PlatformService.js";

// --- Constants ---
const APP_DIR = "Lokus";
const GLOBAL_CONFIG = "config.json";
const THEMES_DIRNAME = "themes";
const WS_CONFIG_REL = ".lokus/config.json";
// These must match CSS variables defined in src/styles/globals.css and tailwind.config.cjs
const THEME_TOKEN_KEYS = [
  // Core tokens
  "--bg", "--text", "--panel", "--border", "--muted", "--accent", "--accent-fg",
  // Tab colors
  "--tab-active",
  // Task status colors
  "--task-todo", "--task-progress", "--task-urgent", "--task-question",
  "--task-completed", "--task-cancelled", "--task-delegated",
  // Semantic colors
  "--danger", "--success", "--warning", "--info",
  // Editor colors
  "--editor-placeholder",
  // App-prefixed tokens (for compatibility)
  "--app-bg", "--app-text", "--app-panel", "--app-border", "--app-muted", "--app-accent", "--app-accent-fg"
];
const BUILT_IN_THEME_TOKENS = {
  // Core tokens
  "--bg": "15 23 42", "--text": "241 245 249", "--panel": "30 41 59",
  "--border": "51 65 85", "--muted": "148 163 184", "--accent": "139 92 246", "--accent-fg": "255 255 255",
  // Tab colors
  "--tab-active": "30 41 59",
  // Task status colors (gray, blue, red, amber, green, gray, purple)
  "--task-todo": "107 114 128", "--task-progress": "59 130 246", "--task-urgent": "239 68 68",
  "--task-question": "245 158 11", "--task-completed": "16 185 129", "--task-cancelled": "107 114 128",
  "--task-delegated": "139 92 246",
  // Semantic colors
  "--danger": "239 68 68", "--success": "16 185 129", "--warning": "245 158 11", "--info": "59 130 246",
  // Editor colors
  "--editor-placeholder": "148 163 184"
};

// NEW: High-quality, professional default themes
const DEFAULT_THEMES = ["dracula", "nord", "one-dark-pro", "minimal-light", "neon-dark"];
const DEFAULT_THEME_CONTENT = {
  "dracula": `{"name": "Dracula", "tokens": {"--bg": "#282a36", "--text": "#f8f8f2", "--panel": "#21222c", "--border": "#44475a", "--muted": "#6272a4", "--accent": "#bd93f9", "--accent-fg": "#ffffff", "--task-todo": "#6272a4", "--task-progress": "#8be9fd", "--task-urgent": "#ff5555", "--task-question": "#f1fa8c", "--task-completed": "#50fa7b", "--task-cancelled": "#6272a4", "--task-delegated": "#bd93f9", "--danger": "#ff5555", "--success": "#50fa7b", "--warning": "#f1fa8c", "--info": "#8be9fd", "--editor-placeholder": "#6272a4"}}`,
  "nord": `{"name": "Nord", "tokens": {"--bg": "#2E3440", "--text": "#ECEFF4", "--panel": "#3B4252", "--border": "#4C566A", "--muted": "#D8DEE9", "--accent": "#88C0D0", "--accent-fg": "#2E3440", "--task-todo": "#4C566A", "--task-progress": "#5E81AC", "--task-urgent": "#BF616A", "--task-question": "#EBCB8B", "--task-completed": "#A3BE8C", "--task-cancelled": "#4C566A", "--task-delegated": "#B48EAD", "--danger": "#BF616A", "--success": "#A3BE8C", "--warning": "#EBCB8B", "--info": "#5E81AC", "--editor-placeholder": "#4C566A"}}`,
  "one-dark-pro": `{"name": "One Dark Pro", "tokens": {"--bg": "#282c34", "--text": "#abb2bf", "--panel": "#21252b", "--border": "#3a3f4b", "--muted": "#5c6370", "--accent": "#61afef", "--accent-fg": "#ffffff", "--task-todo": "#5c6370", "--task-progress": "#61afef", "--task-urgent": "#e06c75", "--task-question": "#d19a66", "--task-completed": "#98c379", "--task-cancelled": "#5c6370", "--task-delegated": "#c678dd", "--danger": "#e06c75", "--success": "#98c379", "--warning": "#d19a66", "--info": "#61afef", "--editor-placeholder": "#5c6370"}}`,
  "minimal-light": `{"name": "Minimal Light", "tokens": {"--bg": "#ffffff", "--text": "#1a1a1a", "--panel": "#f8f9fa", "--border": "#e5e7eb", "--muted": "#6b7280", "--accent": "#3b82f6", "--accent-fg": "#ffffff", "--task-todo": "#9ca3af", "--task-progress": "#3b82f6", "--task-urgent": "#ef4444", "--task-question": "#f59e0b", "--task-completed": "#10b981", "--task-cancelled": "#9ca3af", "--task-delegated": "#8b5cf6", "--danger": "#ef4444", "--success": "#10b981", "--warning": "#f59e0b", "--info": "#3b82f6", "--editor-placeholder": "#9ca3af"}}`,
  "neon-dark": `{"name": "Neon Dark", "tokens": {"--bg": "#0a0a0f", "--text": "#e2e8f0", "--panel": "#1a1a2e", "--border": "#16213e", "--muted": "#64748b", "--accent": "#00d4ff", "--accent-fg": "#0a0a0f", "--task-todo": "#64748b", "--task-progress": "#00d4ff", "--task-urgent": "#ff0080", "--task-question": "#ffea00", "--task-completed": "#00ff88", "--task-cancelled": "#64748b", "--task-delegated": "#8000ff", "--danger": "#ff0080", "--success": "#00ff88", "--warning": "#ffea00", "--info": "#00d4ff", "--editor-placeholder": "#64748b"}}`
};

// --- File System & JSON Helpers ---
// Browser-safe helpers now handled by config store; theme files optional
let isTauri = false; try {
  const w = typeof window !== 'undefined' ? window : undefined;
  isTauri = !!(
    w && (
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
    )
  );
} catch {}
let join, exists, readDir, readTextFile, writeTextFile, appDataDir, mkdir;
let tauriInitialized = false;

async function initializeTauri() {
  if (tauriInitialized) return;
  
  // In test environment, always try to load the modules (they'll be mocked)
  const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';
  
  if (isTauri || isTest) {
    try {
      ({ join, appDataDir } = await import("@tauri-apps/api/path"));
      ({ exists, readDir, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs"));
      tauriInitialized = true;
      
      // If we're in test mode, act like Tauri is available
      if (isTest) {
        isTauri = true;
      }
    } catch (e) {
      if (!isTest) {
        isTauri = false;
      }
    }
  }
}
async function ensureDir(p) { await initializeTauri(); if (!isTauri) return; if (!(await exists(p))) await mkdir(p, { recursive: true }); }
async function readJson(p) { await initializeTauri(); if (!isTauri) return null; try { return JSON.parse(await readTextFile(p)); } catch { return null; } }
async function writeJson(p, data) { await initializeTauri(); if (!isTauri) return; await writeTextFile(p, JSON.stringify(data, null, 2)); }
export async function getGlobalDir() { await initializeTauri(); if (!isTauri) return APP_DIR; const d = await join(await appDataDir(), APP_DIR); await ensureDir(d); return d; }
export async function getGlobalConfigPath() { await initializeTauri(); if (!isTauri) return GLOBAL_CONFIG; return await join(await getGlobalDir(), GLOBAL_CONFIG); }
export async function getGlobalThemesDir() { await initializeTauri(); if (!isTauri) return THEMES_DIRNAME; const t = await join(await getGlobalDir(), THEMES_DIRNAME); await ensureDir(t); return t; }

// --- Core Theme Logic ---
// Bug fix #6: Add proper validation to prevent crashes
function normalize(val) {
  // Add type check
  if (typeof val !== "string") return val;

  // Trim whitespace
  val = val.trim();

  if (val.startsWith("#")) {
    const clean = val.replace("#", "");
    // Validate hex characters
    if (!/^[0-9A-Fa-f]{3}$|^[0-9A-Fa-f]{6}$/.test(clean)) {
      return val; // Return as-is instead of processing
    }
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  return val;
}

export async function applyTokens(tokens) {
  // Add null check - Bug fix #5
  if (!tokens || typeof tokens !== 'object') {
    return;
  }

  const root = document.documentElement;

  // Map app-prefixed tokens to correct CSS variable names
  const mappedTokens = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('--app-')) {
      // Map --app-bg to --bg, etc.
      const mappedKey = key.replace('--app-', '--');
      mappedTokens[mappedKey] = value;
    }
    mappedTokens[key] = value;
  }

  for (const key of THEME_TOKEN_KEYS) {
    const value = mappedTokens[key];
    if (value) {
      const normalizedValue = normalize(value);
      root.style.setProperty(key, normalizedValue);
    } else {
      root.style.removeProperty(key);
    }
  }

  // Sync window theme with native titlebar - Bug fix #1
  if (isTauri) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const { getCurrentWindow } = await import('@tauri-apps/api/window');

      const bgColor = mappedTokens['--bg'] || '15 23 42';
      const isDark = document.documentElement.classList.contains('dark') ||
                     window.matchMedia('(prefers-color-scheme: dark)').matches;

      await invoke('sync_window_theme', {
        isDark,
        bgColor
      });
    } catch (e) {
      // Silently fail - window theme sync is not critical
    }
  }
}

export async function broadcastTheme(payload) {
  try { await emit("theme:apply", payload); }
  catch (_) {
    // Browser fallback: dispatch DOM event
    try { window.dispatchEvent(new CustomEvent('theme:apply', { detail: payload })); } catch {}
  }
}

export async function installDefaultThemes() {
  if (!isTauri) return; // no-op in browser
  const themesDir = await getGlobalThemesDir();
  for (const themeId of DEFAULT_THEMES) {
    const themeJsonPath = await join(themesDir, `${themeId}.json`);
    if (!(await exists(themeJsonPath))) {
      try { await writeTextFile(themeJsonPath, DEFAULT_THEME_CONTENT[themeId]); }
      catch { }
    }
  }
}

export async function loadThemeManifestById(id) {
  if (!id) return null;
  await initializeTauri();

  // First, check if it's a built-in theme
  if (DEFAULT_THEME_CONTENT[id]) {
    try { return JSON.parse(DEFAULT_THEME_CONTENT[id]); }
    catch { }
  }

  // Otherwise, try to load from Rust backend (custom themes in ~/.lokus/themes/)
  if (isTauri) {
    try {
      await ensureTauriInvoke();
      const tokens = await invoke('get_theme_tokens', { themeId: id });
      return { tokens };
    } catch { }
  }

  return null;
}

export async function listAvailableThemes() {
  const themeMap = new Map();

  // Add default built-in themes
  for (const themeId of DEFAULT_THEMES) {
    try {
      const manifest = JSON.parse(DEFAULT_THEME_CONTENT[themeId]);
      themeMap.set(themeId, { id: themeId, name: manifest.name });
    } catch { themeMap.set(themeId, { id: themeId, name: themeId }); }
  }

  // Add custom themes from Rust backend (reads from ~/.lokus/themes/)
  if (isTauri) {
    try {
      const customThemes = await listCustomThemes();
      for (const manifest of customThemes) {
        // Generate safe theme ID from name (same logic as Rust backend)
        const themeId = manifest.name
          .toLowerCase()
          .replace(/[^a-z0-9_-]/g, '_');
        themeMap.set(themeId, { id: themeId, name: manifest.name });
      }
    } catch { }
  }

  return Array.from(themeMap.values());
}

// --- Public API ---
export async function readGlobalVisuals() {
  const cfg = await readConfig();
  const themeId = cfg.theme || null;
  const result = { theme: themeId };
  return result;
}

export async function setGlobalActiveTheme(id) {
  try {
    await updateConfig({ theme: id });
  } catch (e) {
    return;
  }

  const manifest = await loadThemeManifestById(id);
  let tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;

  // Merge with defaults to fill in missing tokens
  tokensToApply = { ...BUILT_IN_THEME_TOKENS, ...tokensToApply };

  await applyTokens(tokensToApply);

  await broadcastTheme({ tokens: tokensToApply, visuals: { theme: id } });
}

// Removed setGlobalVisuals - themes now handle everything

export async function loadThemeForWorkspace(workspacePath) {
  let wsCfg = null;
  if (isTauri) {
    const wsCfgPath = await join(workspacePath, WS_CONFIG_REL);
    wsCfg = await readJson(wsCfgPath);
  }
  let id = wsCfg?.theme;
  if (!id || id === "inherit") {
    const globalCfg = await readGlobalVisuals();
    id = globalCfg.theme;
  }
  const manifest = await loadThemeManifestById(id);
  let tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;

  // Merge with defaults to fill in missing tokens
  tokensToApply = { ...BUILT_IN_THEME_TOKENS, ...tokensToApply };

  await applyTokens(tokensToApply);
}

export async function applyInitialTheme() {
  let { theme } = await readGlobalVisuals();

  // Check if we should sync with system dark mode
  if (theme === 'system' || theme === 'auto') {
    theme = getSystemPreferredTheme();
  }

  const manifest = await loadThemeManifestById(theme);
  let tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;

  // Merge with defaults to fill in missing tokens
  tokensToApply = { ...BUILT_IN_THEME_TOKENS, ...tokensToApply };

  await applyTokens(tokensToApply);

  // Set up system theme listener if using auto mode
  if (theme === 'system' || theme === 'auto') {
    const cleanup = setupSystemThemeListener();
    // Store cleanup function globally if needed
    if (cleanup) {
      if (window.__lokusThemeCleanup) {
        window.__lokusThemeCleanup();
      }
      window.__lokusThemeCleanup = cleanup;
    }
  }
}

// Get system preferred theme
export function getSystemPreferredTheme() {
  if (typeof window === 'undefined') return 'light';
  
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  // On Windows, we could also check registry for specific Windows theme
  // For now, we'll use the standard media query
  return prefersDark ? 'dark' : 'light';
}

// Set up listener for system theme changes
// Returns cleanup function to prevent memory leaks - Bug fix #2
export function setupSystemThemeListener() {
  if (typeof window === 'undefined' || !window.matchMedia) return null;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = async (e) => {
    const newTheme = e.matches ? 'dark' : 'light';
    await setGlobalActiveTheme(newTheme);

    // Emit theme change event
    if (isTauri) {
      await emit("theme:changed", { theme: newTheme });
    }
  };

  // Modern browsers
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    // Return cleanup function
    return () => mediaQuery.removeEventListener('change', handleChange);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }
}

// --- Theme Management API ---
let invoke;
async function ensureTauriInvoke() {
  if (invoke) return;
  if (isTauri) {
    const tauriCore = await import('@tauri-apps/api/core');
    invoke = tauriCore.invoke;
  }
}

export async function importThemeFile(filePath, overwrite = false) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme import only available in desktop app');

  const themeId = await invoke('import_theme_file', { filePath, overwrite });
  return themeId;
}

export async function validateThemeFile(filePath) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme validation only available in desktop app');

  const result = await invoke('validate_theme_file', { filePath });
  return result;
}

export async function exportTheme(themeId, exportPath) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme export only available in desktop app');

  await invoke('export_theme', { themeId, exportPath });
}

export async function deleteCustomTheme(themeId) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme deletion only available in desktop app');

  await invoke('delete_custom_theme', { themeId });
}

export async function listCustomThemes() {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) return [];

  const themes = await invoke('list_custom_themes');
  return themes;
}

export async function getThemeTokens(themeId) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme token retrieval only available in desktop app');

  const tokens = await invoke('get_theme_tokens', { themeId });
  return tokens;
}

export async function saveThemeTokens(themeId, tokens) {
  await initializeTauri();
  await ensureTauriInvoke();
  if (!isTauri) throw new Error('Theme saving only available in desktop app');

  await invoke('save_theme_tokens', { themeId, tokens });
}