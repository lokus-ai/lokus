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
  // Core tokens (Lokus Dark defaults)
  "--bg": "24 22 31", "--text": "224 221 240", "--panel": "32 30 41",
  "--border": "54 51 67", "--muted": "120 117 142", "--accent": "224 168 114", "--accent-fg": "255 255 255",
  // Tab colors
  "--tab-active": "40 38 51",
  // Task status colors
  "--task-todo": "120 117 142", "--task-progress": "224 168 114", "--task-urgent": "235 111 146",
  "--task-question": "246 193 119", "--task-completed": "110 201 143", "--task-cancelled": "120 117 142",
  "--task-delegated": "196 167 231",
  // Semantic colors
  "--danger": "235 111 146", "--success": "110 201 143", "--warning": "246 193 119", "--info": "140 170 238",
  // Editor colors
  "--editor-placeholder": "120 117 142"
};

// Built-in themes (2 signature + 2 community favorites)
const DEFAULT_THEMES = ["lokus-dark", "lokus-light", "rose-pine", "tokyo-night"];
const DEFAULT_THEME_CONTENT = {
  "lokus-dark": `{"name": "Lokus Dark", "tokens": {"--bg": "#18161f", "--text": "#e0ddf0", "--panel": "#201e29", "--border": "#363343", "--muted": "#78758e", "--accent": "#e0a872", "--accent-fg": "#ffffff", "--task-todo": "#78758e", "--task-progress": "#e0a872", "--task-urgent": "#eb6f92", "--task-question": "#f6c177", "--task-completed": "#6ec98f", "--task-cancelled": "#78758e", "--task-delegated": "#c4a7e7", "--danger": "#eb6f92", "--success": "#6ec98f", "--warning": "#f6c177", "--info": "#8caaee", "--editor-placeholder": "#78758e"}}`,
  "lokus-light": `{"name": "Lokus Light", "tokens": {"--bg": "#f9f5ef", "--text": "#2b2738", "--panel": "#f0ebe3", "--border": "#d4cec5", "--muted": "#817c9c", "--accent": "#c27830", "--accent-fg": "#ffffff", "--task-todo": "#817c9c", "--task-progress": "#c27830", "--task-urgent": "#c23c5a", "--task-question": "#b88425", "--task-completed": "#28a06e", "--task-cancelled": "#817c9c", "--task-delegated": "#8b5cf6", "--danger": "#c23c5a", "--success": "#28a06e", "--warning": "#b88425", "--info": "#5a7fe8", "--editor-placeholder": "#817c9c"}}`,
  "rose-pine": `{"name": "Rosé Pine", "tokens": {"--bg": "#191724", "--text": "#e0def4", "--panel": "#1f1d2e", "--border": "#403d52", "--muted": "#6e6a86", "--accent": "#c4a7e7", "--accent-fg": "#191724", "--task-todo": "#6e6a86", "--task-progress": "#c4a7e7", "--task-urgent": "#eb6f92", "--task-question": "#f6c177", "--task-completed": "#9ccfd8", "--task-cancelled": "#6e6a86", "--task-delegated": "#ebbcba", "--danger": "#eb6f92", "--success": "#9ccfd8", "--warning": "#f6c177", "--info": "#31748f", "--editor-placeholder": "#6e6a86"}}`,
  "tokyo-night": `{"name": "Tokyo Night", "tokens": {"--bg": "#1a1b26", "--text": "#a9b1d6", "--panel": "#1f2335", "--border": "#3b4261", "--muted": "#565f89", "--accent": "#7aa2f7", "--accent-fg": "#1a1b26", "--task-todo": "#565f89", "--task-progress": "#7aa2f7", "--task-urgent": "#f7768e", "--task-question": "#e0af68", "--task-completed": "#9ece6a", "--task-cancelled": "#565f89", "--task-delegated": "#bb9af7", "--danger": "#f7768e", "--success": "#9ece6a", "--warning": "#e0af68", "--info": "#2ac3de", "--editor-placeholder": "#565f89"}}`
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
  // Default to Lokus Dark if no theme is set
  if (!id) {
    id = 'lokus-dark';
  }
  const manifest = await loadThemeManifestById(id);
  let tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;

  // Merge with defaults to fill in missing tokens
  tokensToApply = { ...BUILT_IN_THEME_TOKENS, ...tokensToApply };

  await applyTokens(tokensToApply);
}

export async function applyInitialTheme() {
  let { theme } = await readGlobalVisuals();

  // Default to Lokus Dark if no theme is set
  if (!theme) {
    theme = 'lokus-dark';
  }

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
  return prefersDark ? 'lokus-dark' : 'lokus-light';
}

// Set up listener for system theme changes
// Returns cleanup function to prevent memory leaks - Bug fix #2
export function setupSystemThemeListener() {
  if (typeof window === 'undefined' || !window.matchMedia) return null;

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = async (e) => {
    const newTheme = e.matches ? 'lokus-dark' : 'lokus-light';
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