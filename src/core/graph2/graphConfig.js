/**
 * graphConfig — persisted per-workspace graph settings, wired to the engine.
 *
 * Stored at `.lokus/graph-config.json` (same location the old graph used, so
 * existing vault settings carry over). Every mutation pushes straight into the
 * engine — settings are live, never applied "at boot".
 */
import { create } from 'zustand';
import { exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import { getGraphEngine } from './graphEngine.js';

export function getDefaultConfig() {
  return {
    version: '2.0',

    // section collapse state
    'collapse-filter': false,
    'collapse-display': false,
    'collapse-forces': true,
    'collapse-groups': true,
    'collapse-background': true,

    // filters
    search: '',
    showTags: true,
    showAttachments: false,
    hideUnresolved: false,
    showOrphans: true,

    // local graph
    localMode: false,
    localDepth: 1,

    // display
    showArrow: true,
    highlightNeighbors: true,   // hover dims everything not adjacent
    followFocus: true,          // camera glides to the active file
    textFadeMultiplier: 1.3,
    nodeSizeMultiplier: 1.0,
    lineSizeMultiplier: 1.0,

    // forces
    centerStrength: 0.1,
    repelStrength: 100,
    linkStrength: 0.3,
    linkDistance: 80,

    // color
    colorScheme: 'type',
    colorGroups: [],

    // background
    backgroundType: 'none',
    backgroundColor: '#1e1b4b',
    backgroundSecondary: '#6366f1',
    backgroundOpacity: 0.1,
    backgroundDotSize: 2,
    backgroundDotSpacing: 30,
  };
}

const NUMERIC = [
  ['textFadeMultiplier', 0, 3], ['nodeSizeMultiplier', 0.5, 2], ['lineSizeMultiplier', 0.5, 3],
  ['centerStrength', 0, 1], ['repelStrength', 10, 500], ['linkStrength', 0, 1], ['linkDistance', 20, 300],
  ['backgroundOpacity', 0, 1], ['backgroundDotSize', 1, 10], ['backgroundDotSpacing', 10, 100],
  ['localDepth', 1, 5],
];

export function validateConfig(raw = {}) {
  const out = { ...getDefaultConfig() };
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in out)) continue;
    if (typeof out[k] === 'boolean' && typeof v === 'boolean') out[k] = v;
    else if (typeof out[k] === 'string' && typeof v === 'string') out[k] = v;
  }
  for (const [key, min, max] of NUMERIC) {
    const v = raw[key];
    if (typeof v === 'number' && Number.isFinite(v)) out[key] = Math.max(min, Math.min(max, v));
  }
  if (!['type', 'folder', 'tag', 'creation-date', 'modification-date'].includes(out.colorScheme)) {
    out.colorScheme = 'type';
  }
  if (!['none', 'solid', 'gradient', 'radial', 'dots', 'grid'].includes(out.backgroundType)) {
    out.backgroundType = 'none';
  }
  if (Array.isArray(raw.colorGroups)) {
    out.colorGroups = raw.colorGroups
      .filter((g) => g && typeof g.query === 'string' && typeof g.color === 'string')
      .map((g) => ({ query: g.query, color: /^#[0-9a-f]{6}$/i.test(g.color) ? g.color : '#6366f1' }));
  }
  return out;
}

async function configPath(workspacePath) {
  return join(workspacePath, '.lokus', 'graph-config.json');
}

let saveTimer = null;
async function persist(workspacePath, config) {
  if (!workspacePath) return;
  try {
    const dir = await join(workspacePath, '.lokus');
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });
    await writeTextFile(await configPath(workspacePath), JSON.stringify(config, null, 2));
  } catch { /* settings are best-effort — never block the UI */ }
}

export const useGraphConfig = create((set, get) => ({
  workspacePath: null,
  config: getDefaultConfig(),
  loaded: false,

  async load(workspacePath) {
    if (get().workspacePath === workspacePath && get().loaded) return;
    let config = getDefaultConfig();
    try {
      const path = await configPath(workspacePath);
      if (await exists(path)) config = validateConfig(JSON.parse(await readTextFile(path)));
    } catch { /* fall back to defaults */ }
    set({ workspacePath, config, loaded: true });
    getGraphEngine().setConfig(config);
  },

  /** Patch settings: engine updates immediately, disk write is debounced. */
  update(patch) {
    const config = { ...get().config, ...patch };
    set({ config });
    getGraphEngine().setConfig(patch);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(get().workspacePath, get().config), 400);
  },

  reset() {
    const config = getDefaultConfig();
    set({ config });
    getGraphEngine().setConfig(config);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => persist(get().workspacePath, config), 400);
  },
}));
