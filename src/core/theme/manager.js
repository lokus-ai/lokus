import { emit } from "@tauri-apps/api/event";
import { readConfig, updateConfig } from "../config/store.js";

// --- Constants ---
const APP_DIR = "Lokus";
const GLOBAL_CONFIG = "config.json";
const THEMES_DIRNAME = "themes";
const WS_CONFIG_REL = ".lokus/config.json";
// These must match CSS variables defined in src/styles/globals.css and tailwind.config.cjs
const THEME_TOKEN_KEYS = [
  // Core tokens
  "--bg", "--text", "--panel", "--border", "--muted", "--accent", "--accent-fg",
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
if (isTauri) {
  try {
    ({ join, appDataDir } = await import("@tauri-apps/api/path"));
    ({ exists, readDir, readTextFile, writeTextFile, mkdir } = await import("@tauri-apps/plugin-fs"));
  } catch (e) {
    isTauri = false;
  }
}
async function ensureDir(p) { if (!isTauri) return; if (!(await exists(p))) await mkdir(p, { recursive: true }); }
async function readJson(p) { if (!isTauri) return null; try { return JSON.parse(await readTextFile(p)); } catch { return null; } }
async function writeJson(p, data) { if (!isTauri) return; await writeTextFile(p, JSON.stringify(data, null, 2)); }
export async function getGlobalDir() { if (!isTauri) return APP_DIR; const d = await join(await appDataDir(), APP_DIR); await ensureDir(d); return d; }
export async function getGlobalConfigPath() { if (!isTauri) return GLOBAL_CONFIG; return await join(await getGlobalDir(), GLOBAL_CONFIG); }
export async function getGlobalThemesDir() { if (!isTauri) return THEMES_DIRNAME; const t = await join(await getGlobalDir(), THEMES_DIRNAME); await ensureDir(t); return t; }

// --- Core Theme Logic ---
function normalize(val) {
  if (typeof val !== "string") return val;
  if (val.startsWith("#")) {
    const clean = val.replace("#", "");
    const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
    const n = parseInt(full, 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
  }
  return val;
}

export function applyTokens(tokens) {
  console.log('[theme] applyTokens called with:', tokens);
  const root = document.documentElement;
  
  // Map app-prefixed tokens to correct CSS variable names
  const mappedTokens = {};
  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('--app-')) {
      // Map --app-bg to --bg, etc.
      const mappedKey = key.replace('--app-', '--');
      mappedTokens[mappedKey] = value;
      console.log(`[theme] Mapping ${key} -> ${mappedKey}: ${value}`);
    }
    mappedTokens[key] = value;
  }
  
  for (const key of THEME_TOKEN_KEYS) {
    const value = mappedTokens[key];
    if (value) {
      const normalizedValue = normalize(value);
      console.log(`[theme] Setting ${key}: ${value} -> ${normalizedValue}`);
      root.style.setProperty(key, normalizedValue);
    } else {
      console.log(`[theme] Removing ${key} (no value)`);
      root.style.removeProperty(key);
    }
  }
  console.log('[theme] applyTokens completed');
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
      catch (e) { }
    }
  }
}

export async function loadThemeManifestById(id) {
  if (!id) return null;
  const userThemePath = await join(await getGlobalThemesDir(), `${id}.json`);
  if (await exists(userThemePath)) {
    const j = await readJson(userThemePath);
    if (j?.tokens) return j;
  }
  if (DEFAULT_THEME_CONTENT[id]) {
    try { return JSON.parse(DEFAULT_THEME_CONTENT[id]); }
    catch (e) { }
  }
  return null;
}

export async function listAvailableThemes() {
  const themeMap = new Map();
  for (const themeId of DEFAULT_THEMES) {
    try {
      const manifest = JSON.parse(DEFAULT_THEME_CONTENT[themeId]);
      themeMap.set(themeId, { id: themeId, name: manifest.name });
    } catch { themeMap.set(themeId, { id: themeId, name: themeId }); }
  }
  if (isTauri) try {
    const themesDir = await getGlobalThemesDir();
    if (await exists(themesDir)) {
      for (const file of await readDir(themesDir)) {
        if (file.name.endsWith(".json")) {
          const themeId = file.name.replace(".json", "");
          const manifest = await readJson(file.path);
          if (manifest?.name) themeMap.set(themeId, { id: themeId, name: manifest.name });
        }
      }
    }
  } catch (e) { }
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
  const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
  console.log(`[theme] Applying tokens for theme "${id}"`);
  console.log(`[theme] Manifest loaded:`, manifest);
  console.log(`[theme] Tokens to apply:`, tokensToApply);
  applyTokens(tokensToApply);
  
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
  const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
  applyTokens(tokensToApply);
}

export async function applyInitialTheme() {
  const { theme } = await readGlobalVisuals();
  
  const manifest = await loadThemeManifestById(theme);
  const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
  applyTokens(tokensToApply);
}