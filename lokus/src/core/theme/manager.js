import { appDataDir, join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile, mkdir, exists, readDir } from "@tauri-apps/plugin-fs";
import { emit } from "@tauri-apps/api/event";

// --- Constants ---
const APP_DIR = "Lokus";
const GLOBAL_CONFIG = "config.json";
const THEMES_DIRNAME = "themes";
const WS_CONFIG_REL = ".lokus/config.json";
const THEME_TOKEN_KEYS = ["--app-bg", "--app-text", "--app-panel", "--app-border", "--app-muted", "--app-accent"];
const BUILT_IN_THEME_TOKENS = { "--app-bg": "15 23 42", "--app-text": "241 245 249", "--app-panel": "30 41 59", "--app-border": "51 65 85", "--app-muted": "148 163 184", "--app-accent": "139 92 246" };

// NEW: High-quality, professional default themes
const DEFAULT_THEMES = ["dracula", "nord", "one-dark-pro"];
const DEFAULT_THEME_CONTENT = {
  "dracula": `{"name": "Dracula", "tokens": {"--app-bg": "#282a36", "--app-text": "#f8f8f2", "--app-panel": "#21222c", "--app-border": "#44475a", "--app-muted": "#6272a4", "--app-accent": "#bd93f9"}}`,
  "nord": `{"name": "Nord", "tokens": {"--app-bg": "#2E3440", "--app-text": "#ECEFF4", "--app-panel": "#3B4252", "--app-border": "#4C566A", "--app-muted": "#D8DEE9", "--app-accent": "#88C0D0"}}`,
  "one-dark-pro": `{"name": "One Dark Pro", "tokens": {"--app-bg": "#282c34", "--app-text": "#abb2bf", "--app-panel": "#21252b", "--app-border": "#3a3f4b", "--app-muted": "#5c6370", "--app-accent": "#61afef"}}`
};

// --- File System & JSON Helpers ---
async function ensureDir(p) { if (!(await exists(p))) await mkdir(p, { recursive: true }); }
async function readJson(p) { try { return JSON.parse(await readTextFile(p)); } catch { return null; } }
async function writeJson(p, data) { await writeTextFile(p, JSON.stringify(data, null, 2)); }

// --- Path Helpers ---
export async function getGlobalDir() { const d = await join(await appDataDir(), APP_DIR); await ensureDir(d); return d; }
export async function getGlobalConfigPath() { return await join(await getGlobalDir(), GLOBAL_CONFIG); }
export async function getGlobalThemesDir() { const t = await join(await getGlobalDir(), THEMES_DIRNAME); await ensureDir(t); return t; }

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
  const root = document.documentElement;
  for (const key of THEME_TOKEN_KEYS) {
    const value = tokens[key];
    if (value) {
      root.style.setProperty(key, normalize(value));
    } else {
      root.style.removeProperty(key);
    }
  }
}

export async function broadcastTheme(payload) {
  try { await emit("theme:apply", payload); }
  catch (e) { console.error("[theme] broadcast failed:", e); }
}

export async function installDefaultThemes() {
  const themesDir = await getGlobalThemesDir();
  for (const themeId of DEFAULT_THEMES) {
    const themeJsonPath = await join(themesDir, `${themeId}.json`);
    if (!(await exists(themeJsonPath))) {
      try { await writeTextFile(themeJsonPath, DEFAULT_THEME_CONTENT[themeId]); }
      catch (e) { console.error(`[theme] failed to write default theme '${themeId}':`, e); }
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
    catch (e) { console.error(`[theme] Failed to parse embedded theme '${id}':`, e); }
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
  try {
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
  } catch (e) { console.error("[theme] Failed to read user themes directory:", e); }
  return Array.from(themeMap.values());
}

// --- Public API ---
export async function readGlobalVisuals() {
  const cfg = await readJson(await getGlobalConfigPath()) || {};
  return { mode: cfg.mode || null, accent: cfg.accent || null, theme: cfg.theme || null };
}

export async function setGlobalActiveTheme(id) {
  await writeJson(await getGlobalConfigPath(), { ...(await readGlobalVisuals()), theme: id });
  const manifest = await loadThemeManifestById(id);
  const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
  applyTokens(tokensToApply);
  await broadcastTheme({ tokens: tokensToApply });
}

export async function setGlobalVisuals(visuals) {
  const current = await readGlobalVisuals();
  await writeJson(await getGlobalConfigPath(), { ...current, ...visuals });
  await broadcastTheme({ visuals });
}

export async function loadThemeForWorkspace(workspacePath) {
  const wsCfgPath = await join(workspacePath, WS_CONFIG_REL);
  const wsCfg = await readJson(wsCfgPath);
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