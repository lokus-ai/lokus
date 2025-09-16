// Tauri + Browser-safe config store with retry and caching
let isTauri = false;
try {
  const w = typeof window !== 'undefined' ? window : undefined;
  isTauri = !!(
    w && (
      (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
      w.__TAURI_METADATA__ ||
      (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
    )
  );
} catch {}

// Config cache for reliability
let configCache = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5000; // 5 seconds cache TTL

// Lazy-loaded Tauri modules with retry
let tauriModules = {
  initialized: false,
  appDataDir: null,
  join: null,
  readTextFile: null,
  writeTextFile: null,
  mkdir: null,
  exists: null
};

// Initialize Tauri modules with retry logic
async function initializeTauriModules(maxRetries = 3, retryDelay = 100) {
  if (!isTauri || tauriModules.initialized) return tauriModules.initialized;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const pathModule = await import("@tauri-apps/api/path");
      const fsModule = await import("@tauri-apps/plugin-fs");
      
      tauriModules.appDataDir = pathModule.appDataDir;
      tauriModules.join = pathModule.join;
      tauriModules.readTextFile = fsModule.readTextFile;
      tauriModules.writeTextFile = fsModule.writeTextFile;
      tauriModules.mkdir = fsModule.mkdir;
      tauriModules.exists = fsModule.exists;
      tauriModules.initialized = true;
      
      console.log('[config] Tauri modules initialized successfully');
      return true;
    } catch (e) {
      console.warn(`[config] Tauri module init attempt ${i + 1}/${maxRetries} failed:`, e);
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * Math.pow(2, i)));
      }
    }
  }
  
  console.error('[config] Failed to initialize Tauri modules after all retries');
  isTauri = false;
  return false;
}

// Ensure Tauri is ready before use
if (isTauri) {
  initializeTauriModules();
}

const APP_DIR = "Lokus";
const GLOBAL_CONFIG = "config.json";
const BROWSER_KEY = "lokus:config";

async function ensureDir(p) {
  if (!isTauri) return;
  await initializeTauriModules();
  if (!tauriModules.initialized) return;
  
  try {
    if (!(await tauriModules.exists(p))) {
      await tauriModules.mkdir(p, { recursive: true });
    }
  } catch (e) {
    console.error('[config] Failed to ensure directory:', e);
  }
}

async function readJson(p, retries = 3) {
  if (!isTauri) {
    try {
      const data = localStorage.getItem(BROWSER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[config] Failed to read from localStorage:', e);
      return null;
    }
  }
  
  await initializeTauriModules();
  if (!tauriModules.initialized) {
    console.warn('[config] Tauri not initialized, returning cached config');
    return configCache;
  }
  
  // Try to read with retries
  for (let i = 0; i < retries; i++) {
    try {
      const content = await tauriModules.readTextFile(p);
      const parsed = JSON.parse(content);
      
      // Update cache on successful read
      configCache = parsed;
      cacheTimestamp = Date.now();
      
      return parsed;
    } catch (e) {
      console.warn(`[config] Read attempt ${i + 1}/${retries} failed:`, e);
      
      if (i < retries - 1) {
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, 50 * Math.pow(2, i)));
      }
    }
  }
  
  // Return cache if all retries failed
  console.warn('[config] All read attempts failed, returning cache:', configCache);
  return configCache;
}

async function writeJson(p, data) {
  if (!isTauri) {
    localStorage.setItem(BROWSER_KEY, JSON.stringify(data ?? {}));
    configCache = data;
    cacheTimestamp = Date.now();
    return;
  }
  
  await initializeTauriModules();
  if (!tauriModules.initialized) {
    console.error('[config] Cannot write - Tauri not initialized');
    return;
  }
  
  try {
    await tauriModules.writeTextFile(p, JSON.stringify(data, null, 2));
    
    // Update cache on successful write
    configCache = data;
    cacheTimestamp = Date.now();
    
    console.log('[config] Successfully wrote config:', data);
  } catch (e) {
    console.error('[config] Failed to write config:', e);
    throw e;
  }
}

export async function getGlobalDir() {
  if (!isTauri) return APP_DIR;
  
  await initializeTauriModules();
  if (!tauriModules.initialized) return APP_DIR;
  
  try {
    const d = await tauriModules.join(await tauriModules.appDataDir(), APP_DIR);
    await ensureDir(d);
    return d;
  } catch (e) {
    console.error('[config] Failed to get global dir:', e);
    return APP_DIR;
  }
}

export async function getGlobalConfigPath() {
  if (!isTauri) return GLOBAL_CONFIG;
  
  await initializeTauriModules();
  if (!tauriModules.initialized) return GLOBAL_CONFIG;
  
  try {
    return await tauriModules.join(await getGlobalDir(), GLOBAL_CONFIG);
  } catch (e) {
    console.error('[config] Failed to get config path:', e);
    return GLOBAL_CONFIG;
  }
}

export async function readConfig() {
  // Check cache first if it's fresh
  if (configCache && (Date.now() - cacheTimestamp) < CACHE_TTL) {
    console.log('[config] Returning fresh cached config:', configCache);
    return configCache;
  }
  
  const configPath = await getGlobalConfigPath();
  
  // Ensure directory exists before reading
  if (isTauri) {
    const dir = await getGlobalDir();
    await ensureDir(dir);
  }
  
  let result = await readJson(configPath);
  
  // If config file doesn't exist or failed to read, check cache or initialize
  if (result === null) {
    if (configCache) {
      console.log('[config] Read failed, returning stale cache:', configCache);
      return configCache;
    }
    
    result = {};
    console.log('[config] No config found, returning empty object');
  }
  
  return result;
}

export async function writeConfig(next) {
  const configPath = await getGlobalConfigPath();
  
  // Ensure directory exists before writing
  if (isTauri) {
    const dir = await getGlobalDir();
    await ensureDir(dir);
  }
  
  const result = await writeJson(configPath, next);
  return result;
}

export async function updateConfig(patch) {
  const cur = await readConfig();
  const next = { ...cur, ...patch };
  await writeConfig(next);
  return next;
}

// Export cache utilities for debugging
export function getConfigCache() {
  return { cache: configCache, timestamp: cacheTimestamp };
}

export function clearConfigCache() {
  configCache = null;
  cacheTimestamp = 0;
}
