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
  "--editor-placeholder"
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
const DEFAULT_THEMES = ["dracula", "nord", "one-dark-pro"];
const DEFAULT_THEME_CONTENT = {
  "dracula": `{"name": "Dracula", "tokens": {"--bg": "#282a36", "--text": "#f8f8f2", "--panel": "#21222c", "--border": "#44475a", "--muted": "#6272a4", "--accent": "#bd93f9", "--accent-fg": "#ffffff", "--task-todo": "#6272a4", "--task-progress": "#8be9fd", "--task-urgent": "#ff5555", "--task-question": "#f1fa8c", "--task-completed": "#50fa7b", "--task-cancelled": "#6272a4", "--task-delegated": "#bd93f9", "--danger": "#ff5555", "--success": "#50fa7b", "--warning": "#f1fa8c", "--info": "#8be9fd", "--editor-placeholder": "#6272a4"}}`,
  "nord": `{"name": "Nord", "tokens": {"--bg": "#2E3440", "--text": "#ECEFF4", "--panel": "#3B4252", "--border": "#4C566A", "--muted": "#D8DEE9", "--accent": "#88C0D0", "--accent-fg": "#2E3440", "--task-todo": "#4C566A", "--task-progress": "#5E81AC", "--task-urgent": "#BF616A", "--task-question": "#EBCB8B", "--task-completed": "#A3BE8C", "--task-cancelled": "#4C566A", "--task-delegated": "#B48EAD", "--danger": "#BF616A", "--success": "#A3BE8C", "--warning": "#EBCB8B", "--info": "#5E81AC", "--editor-placeholder": "#4C566A"}}`,
  "one-dark-pro": `{"name": "One Dark Pro", "tokens": {"--bg": "#282c34", "--text": "#abb2bf", "--panel": "#21252b", "--border": "#3a3f4b", "--muted": "#5c6370", "--accent": "#61afef", "--accent-fg": "#ffffff", "--task-todo": "#5c6370", "--task-progress": "#61afef", "--task-urgent": "#e06c75", "--task-question": "#d19a66", "--task-completed": "#98c379", "--task-cancelled": "#5c6370", "--task-delegated": "#c678dd", "--danger": "#e06c75", "--success": "#98c379", "--warning": "#d19a66", "--info": "#61afef", "--editor-placeholder": "#5c6370"}}`
};

// --- File System & JSON Helpers ---
// Enhanced with retry logic and better error handling
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

// Theme cache for custom themes
let themeCache = new Map();
let themeCacheTimestamp = 0;
const THEME_CACHE_TTL = 10000; // 10 seconds for theme files

// Lazy-loaded Tauri modules
let tauriThemeModules = {
  initialized: false,
  join: null,
  exists: null,
  readDir: null,
  readTextFile: null,
  writeTextFile: null,
  appDataDir: null,
  mkdir: null
};

// Initialize Tauri modules for themes
async function initializeTauriThemeModules(maxRetries = 3) {
  if (!isTauri || tauriThemeModules.initialized) return tauriThemeModules.initialized;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const pathModule = await import("@tauri-apps/api/path");
      const fsModule = await import("@tauri-apps/plugin-fs");
      
      tauriThemeModules.join = pathModule.join;
      tauriThemeModules.appDataDir = pathModule.appDataDir;
      tauriThemeModules.exists = fsModule.exists;
      tauriThemeModules.readDir = fsModule.readDir;
      tauriThemeModules.readTextFile = fsModule.readTextFile;
      tauriThemeModules.writeTextFile = fsModule.writeTextFile;
      tauriThemeModules.mkdir = fsModule.mkdir;
      tauriThemeModules.initialized = true;
      
      console.log('[theme] Tauri theme modules initialized successfully');
      return true;
    } catch (e) {
      console.warn(`[theme] Module init attempt ${i + 1}/${maxRetries} failed:`, e);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
  }
  
  console.warn('[theme] Failed to initialize Tauri theme modules, disabling FS features');
  isTauri = false;
  return false;
}

if (isTauri) {
  initializeTauriThemeModules();
}
async function ensureDir(p) {
  if (!isTauri) return;
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) return;
  
  try {
    if (!(await tauriThemeModules.exists(p))) {
      await tauriThemeModules.mkdir(p, { recursive: true });
    }
  } catch (e) {
    console.error('[theme] Failed to ensure directory:', e);
  }
}

async function readJson(p, useCache = true) {
  if (!isTauri) return null;
  
  // Check cache first for theme files
  if (useCache && themeCache.has(p) && (Date.now() - themeCacheTimestamp) < THEME_CACHE_TTL) {
    return themeCache.get(p);
  }
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) return null;
  
  try {
    const content = await tauriThemeModules.readTextFile(p);
    const parsed = JSON.parse(content);
    
    // Cache the result
    if (useCache) {
      themeCache.set(p, parsed);
      themeCacheTimestamp = Date.now();
    }
    
    return parsed;
  } catch (e) {
    console.warn('[theme] Failed to read JSON file:', p, e);
    return themeCache.get(p) || null; // Return cached version if available
  }
}

async function writeJson(p, data) {
  if (!isTauri) return;
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) {
    console.error('[theme] Cannot write theme - Tauri not initialized');
    return;
  }
  
  try {
    await tauriThemeModules.writeTextFile(p, JSON.stringify(data, null, 2));
    // Update cache
    themeCache.set(p, data);
    themeCacheTimestamp = Date.now();
    console.log('[theme] Successfully wrote theme file:', p);
  } catch (e) {
    console.error('[theme] Failed to write theme file:', e);
    throw e;
  }
}
export async function getGlobalDir() {
  if (!isTauri) return APP_DIR;
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) return APP_DIR;
  
  try {
    const d = await tauriThemeModules.join(await tauriThemeModules.appDataDir(), APP_DIR);
    await ensureDir(d);
    return d;
  } catch (e) {
    console.error('[theme] Failed to get global dir:', e);
    return APP_DIR;
  }
}

export async function getGlobalConfigPath() {
  if (!isTauri) return GLOBAL_CONFIG;
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) return GLOBAL_CONFIG;
  
  try {
    return await tauriThemeModules.join(await getGlobalDir(), GLOBAL_CONFIG);
  } catch (e) {
    console.error('[theme] Failed to get config path:', e);
    return GLOBAL_CONFIG;
  }
}

export async function getGlobalThemesDir() {
  if (!isTauri) return THEMES_DIRNAME;
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) return THEMES_DIRNAME;
  
  try {
    const t = await tauriThemeModules.join(await getGlobalDir(), THEMES_DIRNAME);
    await ensureDir(t);
    return t;
  } catch (e) {
    console.error('[theme] Failed to get themes dir:', e);
    return THEMES_DIRNAME;
  }
}

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
      catch (e) { console.error(`[theme] failed to write default theme '${themeId}':`, e); }
    }
  }
}

export async function loadThemeManifestById(id) {
  if (!id) return null;
  
  try {
    // Check for user custom theme first
    if (isTauri) {
      await initializeTauriThemeModules();
      if (tauriThemeModules.initialized) {
        const userThemePath = await tauriThemeModules.join(await getGlobalThemesDir(), `${id}.json`);
        if (await tauriThemeModules.exists(userThemePath)) {
          const j = await readJson(userThemePath);
          if (j?.tokens) {
            console.log(`[theme] Loaded custom theme: ${id}`);
            return j;
          }
        }
      }
    }
    
    // Fall back to default themes
    if (DEFAULT_THEME_CONTENT[id]) {
      const parsed = JSON.parse(DEFAULT_THEME_CONTENT[id]);
      console.log(`[theme] Loaded built-in theme: ${id}`);
      return parsed;
    }
    
    console.warn(`[theme] Theme '${id}' not found`);
    return null;
  } catch (e) {
    console.error(`[theme] Failed to load theme '${id}':`, e);
    return null;
  }
}

export async function listAvailableThemes() {
  const themeMap = new Map();
  
  // Add built-in themes first
  for (const themeId of DEFAULT_THEMES) {
    try {
      const manifest = JSON.parse(DEFAULT_THEME_CONTENT[themeId]);
      themeMap.set(themeId, { 
        id: themeId, 
        name: manifest.name,
        type: 'built-in',
        description: manifest.description || 'Built-in theme'
      });
    } catch (e) {
      console.warn(`[theme] Failed to parse built-in theme ${themeId}:`, e);
      themeMap.set(themeId, { id: themeId, name: themeId, type: 'built-in' });
    }
  }
  
  // Add custom user themes
  if (isTauri) {
    try {
      await initializeTauriThemeModules();
      if (tauriThemeModules.initialized) {
        const themesDir = await getGlobalThemesDir();
        if (await tauriThemeModules.exists(themesDir)) {
          const files = await tauriThemeModules.readDir(themesDir);
          
          for (const file of files) {
            if (file.name.endsWith(".json")) {
              const themeId = file.name.replace(".json", "");
              
              // Skip if it's a built-in theme file
              if (DEFAULT_THEMES.includes(themeId)) continue;
              
              try {
                const manifest = await readJson(file.path);
                if (manifest?.name && manifest?.tokens) {
                  themeMap.set(themeId, { 
                    id: themeId, 
                    name: manifest.name,
                    type: 'custom',
                    description: manifest.description || 'Custom theme',
                    author: manifest.author,
                    version: manifest.version,
                    path: file.path
                  });
                  console.log(`[theme] Found custom theme: ${themeId}`);
                }
              } catch (e) {
                console.warn(`[theme] Failed to parse custom theme ${themeId}:`, e);
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("[theme] Failed to scan custom themes directory:", e);
    }
  }
  
  const themes = Array.from(themeMap.values());
  console.log(`[theme] Found ${themes.length} themes (${themes.filter(t => t.type === 'built-in').length} built-in, ${themes.filter(t => t.type === 'custom').length} custom)`);
  return themes;
}

// --- Public API ---
export async function readGlobalVisuals(retries = 3) {
  console.log('[theme] Reading theme from config...');
  
  for (let i = 0; i < retries; i++) {
    try {
      const cfg = await readConfig();
      console.log(`[theme] Config loaded (attempt ${i + 1}):`, cfg);
      
      const themeId = cfg?.theme || null;
      const result = { theme: themeId };
      
      console.log(`[theme] Extracted theme: "${themeId}" (type: ${typeof themeId})`);
      return result;
    } catch (e) {
      console.warn(`[theme] Read attempt ${i + 1}/${retries} failed:`, e);
      
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, i)));
      }
    }
  }
  
  console.warn('[theme] All read attempts failed, returning default');
  return { theme: null };
}

export async function setGlobalActiveTheme(id) {
  console.log(`[theme] === Setting Global Active Theme: "${id}" ===`);
  
  try { 
    await updateConfig({ theme: id }); 
    console.log(`[theme] ✅ Theme "${id}" saved to config successfully`);
  } catch (e) { 
    console.error(`[theme] ❌ Failed to save theme "${id}":`, e); 
    return;
  }
  
  const manifest = await loadThemeManifestById(id);
  const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
  
  console.log(`[theme] Applying tokens for theme "${id}"`);
  applyTokens(tokensToApply);
  
  console.log(`[theme] Broadcasting theme change to other windows: "${id}"`);
  await broadcastTheme({ tokens: tokensToApply, visuals: { theme: id } });
  
  console.log(`[theme] === Theme "${id}" fully activated ===`);
}

// Removed setGlobalVisuals - themes now handle everything

export async function loadThemeForWorkspace(workspacePath) {
  console.log('[theme] === Loading Workspace Theme ===');
  
  let wsCfg = null;
  if (isTauri) {
    await initializeTauriThemeModules();
    if (tauriThemeModules.initialized) {
      try {
        const wsCfgPath = await tauriThemeModules.join(workspacePath, WS_CONFIG_REL);
        wsCfg = await readJson(wsCfgPath);
        console.log('[theme] Workspace config loaded:', wsCfg);
      } catch (e) {
        console.log('[theme] No workspace-specific theme config found');
      }
    }
  }
  
  let id = wsCfg?.theme;
  console.log(`[theme] Workspace theme setting: "${id}"`);
  
  if (!id || id === "inherit") {
    console.log('[theme] No workspace theme, checking global config...');
    const globalCfg = await readGlobalVisuals();
    id = globalCfg.theme;
    console.log(`[theme] Using global theme: "${id}"`);
  }
  
  // If still no theme, keep current theme instead of reverting to built-in
  if (!id) {
    console.log('[theme] No theme specified, keeping current theme');
    return;
  }
  
  const manifest = await loadThemeManifestById(id);
  if (!manifest) {
    console.log(`[theme] Theme "${id}" not found, keeping current theme`);
    return;
  }
  
  const tokensToApply = manifest.tokens;
  applyTokens(tokensToApply);
  console.log(`[theme] ✅ Applied workspace theme: "${id}"`);
}

export async function applyInitialTheme(maxRetries = 3) {
  console.log('[theme] === Applying Initial Theme ===');
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const { theme } = await readGlobalVisuals();
      
      if (theme) {
        console.log(`[theme] Loading saved theme: "${theme}"`);
      } else {
        console.log('[theme] No saved theme found, using built-in theme');
      }
      
      const manifest = await loadThemeManifestById(theme);
      const tokensToApply = manifest?.tokens || BUILT_IN_THEME_TOKENS;
      applyTokens(tokensToApply);
      
      const appliedTheme = theme || 'built-in';
      console.log(`[theme] ✅ Initial theme applied: "${appliedTheme}"`);
      return { success: true, theme: appliedTheme };
    } catch (e) {
      console.warn(`[theme] Initial theme application attempt ${i + 1}/${maxRetries} failed:`, e);
      
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, i)));
      }
    }
  }
  
  // Fallback to built-in theme
  console.warn('[theme] All attempts failed, applying built-in theme as fallback');
  applyTokens(BUILT_IN_THEME_TOKENS);
  return { success: false, theme: 'built-in' };
}

// --- Custom Theme Management ---

/**
 * Install a custom theme from JSON data
 */
export async function installCustomTheme(themeData) {
  if (!isTauri) {
    throw new Error('Custom themes are only available in desktop mode');
  }
  
  // Validate theme data
  if (!themeData.id || !themeData.name || !themeData.tokens) {
    throw new Error('Invalid theme data: id, name, and tokens are required');
  }
  
  // Validate tokens
  const requiredTokens = ['--bg', '--text', '--panel', '--border', '--accent'];
  for (const token of requiredTokens) {
    if (!themeData.tokens[token]) {
      throw new Error(`Missing required token: ${token}`);
    }
  }
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) {
    throw new Error('Tauri modules not available');
  }
  
  try {
    const themesDir = await getGlobalThemesDir();
    const themePath = await tauriThemeModules.join(themesDir, `${themeData.id}.json`);
    
    // Add metadata
    const themeWithMeta = {
      ...themeData,
      installedAt: new Date().toISOString(),
      version: themeData.version || '1.0.0'
    };
    
    await writeJson(themePath, themeWithMeta);
    console.log(`[theme] Custom theme '${themeData.name}' installed successfully`);
    
    return themeWithMeta;
  } catch (e) {
    console.error('[theme] Failed to install custom theme:', e);
    throw e;
  }
}

/**
 * Remove a custom theme
 */
export async function removeCustomTheme(themeId) {
  if (!isTauri) {
    throw new Error('Custom themes are only available in desktop mode');
  }
  
  if (DEFAULT_THEMES.includes(themeId)) {
    throw new Error('Cannot remove built-in themes');
  }
  
  await initializeTauriThemeModules();
  if (!tauriThemeModules.initialized) {
    throw new Error('Tauri modules not available');
  }
  
  try {
    const themesDir = await getGlobalThemesDir();
    const themePath = await tauriThemeModules.join(themesDir, `${themeId}.json`);
    
    if (await tauriThemeModules.exists(themePath)) {
      // Remove from file system
      const fs = await import('@tauri-apps/plugin-fs');
      await fs.remove(themePath);
      
      // Clear from cache
      themeCache.delete(themePath);
      
      console.log(`[theme] Custom theme '${themeId}' removed successfully`);
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('[theme] Failed to remove custom theme:', e);
    throw e;
  }
}

/**
 * Export theme data for sharing
 */
export async function exportTheme(themeId) {
  const manifest = await loadThemeManifestById(themeId);
  if (!manifest) {
    throw new Error(`Theme '${themeId}' not found`);
  }
  
  return {
    id: themeId,
    name: manifest.name,
    description: manifest.description,
    author: manifest.author,
    version: manifest.version,
    tokens: manifest.tokens,
    exportedAt: new Date().toISOString()
  };
}

/**
 * Validate theme structure
 */
export function validateTheme(themeData) {
  const errors = [];
  
  if (!themeData.id) errors.push('Missing theme id');
  if (!themeData.name) errors.push('Missing theme name');
  if (!themeData.tokens) errors.push('Missing theme tokens');
  
  if (themeData.tokens) {
    const requiredTokens = ['--bg', '--text', '--panel', '--border', '--accent'];
    for (const token of requiredTokens) {
      if (!themeData.tokens[token]) {
        errors.push(`Missing required token: ${token}`);
      }
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// --- Cache Management ---

/**
 * Clear theme cache
 */
export function clearThemeCache() {
  themeCache.clear();
  themeCacheTimestamp = 0;
  console.log('[theme] Theme cache cleared');
}

/**
 * Get theme cache info for debugging
 */
export function getThemeCacheInfo() {
  return {
    cacheSize: themeCache.size,
    lastUpdate: themeCacheTimestamp,
    cached: Array.from(themeCache.keys())
  };
}
