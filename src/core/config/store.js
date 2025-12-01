// Tauri + Browser-safe config store
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
} catch { }

let appDataDir, join, readTextFile, writeTextFile, mkdir, exists;

// Initialize Tauri modules lazily
async function initTauriModules() {
  if (isTauri && !appDataDir) {
    try {
      ({ appDataDir, join } = await import("@tauri-apps/api/path"));
      ({ readTextFile, writeTextFile, mkdir, exists } = await import("@tauri-apps/plugin-fs"));
    } catch (e) {
      console.error("Failed to load Tauri modules:", e);
      isTauri = false;
    }
  }
}

const APP_DIR = "Lokus";
const GLOBAL_CONFIG = "config.json";
const BROWSER_KEY = "lokus:config";

async function ensureDir(p) {
  await initTauriModules();
  if (!isTauri) return;
  if (!(await exists(p))) await mkdir(p, { recursive: true });
}

async function readJson(p) {
  await initTauriModules();
  if (!isTauri) {
    try { return JSON.parse(localStorage.getItem(BROWSER_KEY) || "null"); } catch { return null; }
  }
  try { return JSON.parse(await readTextFile(p)); } catch { return null; }
}

async function writeJson(p, data) {
  await initTauriModules();
  if (!isTauri) { localStorage.setItem(BROWSER_KEY, JSON.stringify(data ?? {})); return; }
  await writeTextFile(p, JSON.stringify(data, null, 2));
}

export async function getGlobalDir() {
  await initTauriModules();
  if (!isTauri) return APP_DIR;
  const d = await join(await appDataDir(), APP_DIR);
  await ensureDir(d);
  return d;
}

export async function getGlobalConfigPath() {
  await initTauriModules();
  if (!isTauri) return GLOBAL_CONFIG;
  return await join(await getGlobalDir(), GLOBAL_CONFIG);
}

export async function readConfig() {
  const configPath = await getGlobalConfigPath();

  // Ensure directory exists before reading
  if (isTauri) {
    const dir = await getGlobalDir();
    await ensureDir(dir);
  }

  let result = await readJson(configPath);

  // If config file doesn't exist or failed to read, initialize with empty config
  if (result === null) {
    result = {};
    // Don't save empty config - let it be created when user actually changes settings
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