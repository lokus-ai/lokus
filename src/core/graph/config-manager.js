/**
 * Graph Config Manager - Handles loading and saving graph visualization settings
 *
 * Stores settings in .lokus/graph-config.json per workspace
 * Provides Obsidian-style configuration for graph customization
 */

import { BaseDirectory, exists, readTextFile, writeTextFile, mkdir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

/**
 * Default graph configuration (Obsidian-style)
 */
export function getDefaultConfig() {
  return {
    version: '1.0',
    // Collapsible section states
    'collapse-filter': false,
    'collapse-display': false,
    'collapse-forces': false,
    'collapse-animation': false,
    // Filter settings
    search: '',
    showTags: true,
    showAttachments: false,
    hideUnresolved: false,  // Hide placeholder WikiLinks
    showOrphans: true,      // Show nodes with no connections
    // Display settings
    showArrow: true,
    textFadeMultiplier: 1.3,
    nodeSizeMultiplier: 1.0,
    lineSizeMultiplier: 1.0,
    // Force settings
    centerStrength: 0.3,     // Lower center pull = more spread
    repelStrength: 15,       // Higher repel = more separation
    linkStrength: 0.5,       // Lower link = more flexible
    linkDistance: 250,       // Longer links = more space
    // Color customization
    'collapse-groups': false,
    colorScheme: 'type', // 'type', 'folder', 'tag', 'creation-date', 'modification-date', 'custom'
    colorGroups: []
  };
}

/**
 * Get the config file path for a workspace
 */
async function getConfigPath(workspacePath) {
  return await join(workspacePath, '.lokus', 'graph-config.json');
}

/**
 * Ensure .lokus directory exists
 */
async function ensureLokusDir(workspacePath) {
  const lokusDir = await join(workspacePath, '.lokus');

  try {
    const dirExists = await exists(lokusDir);
    if (!dirExists) {
      await mkdir(lokusDir, { recursive: true });
    }
  } catch (error) {
    console.error('[GraphConfig] Failed to create .lokus directory:', error);
  }
}

/**
 * Load graph configuration for a workspace
 */
export async function loadGraphConfig(workspacePath) {
  if (!workspacePath) {
    console.warn('[GraphConfig] No workspace path provided, using defaults');
    return getDefaultConfig();
  }

  try {
    const configPath = await getConfigPath(workspacePath);
    const fileExists = await exists(configPath);

    if (!fileExists) {
      console.log('[GraphConfig] No config found, using defaults');
      return getDefaultConfig();
    }

    const content = await readTextFile(configPath);
    const config = JSON.parse(content);

    // Merge with defaults to ensure all keys exist
    const defaultConfig = getDefaultConfig();
    const mergedConfig = { ...defaultConfig, ...config };

    console.log('[GraphConfig] ✅ Loaded config from', configPath);
    return mergedConfig;
  } catch (error) {
    console.error('[GraphConfig] Failed to load config:', error);
    return getDefaultConfig();
  }
}

/**
 * Save graph configuration for a workspace
 */
export async function saveGraphConfig(workspacePath, config) {
  if (!workspacePath) {
    console.warn('[GraphConfig] No workspace path provided, cannot save');
    return false;
  }

  try {
    // Ensure .lokus directory exists
    await ensureLokusDir(workspacePath);

    // Get config path
    const configPath = await getConfigPath(workspacePath);

    // Validate config has version
    if (!config.version) {
      config.version = '1.0';
    }

    // Write config to file
    const content = JSON.stringify(config, null, 2);
    await writeTextFile(configPath, content);

    console.log('[GraphConfig] ✅ Saved config to', configPath);
    return true;
  } catch (error) {
    console.error('[GraphConfig] Failed to save config:', error);
    return false;
  }
}

/**
 * Validate and sanitize config
 */
export function validateConfig(config) {
  const defaultConfig = getDefaultConfig();
  const validated = { ...defaultConfig };

  // Validate boolean fields
  const boolFields = [
    'collapse-filter', 'collapse-display', 'collapse-forces', 'collapse-groups', 'collapse-animation',
    'showTags', 'showAttachments', 'hideUnresolved', 'showOrphans', 'showArrow'
  ];

  boolFields.forEach(field => {
    if (typeof config[field] === 'boolean') {
      validated[field] = config[field];
    }
  });

  // Validate string fields
  if (typeof config.search === 'string') {
    validated.search = config.search;
  }
  if (typeof config.version === 'string') {
    validated.version = config.version;
  }
  if (typeof config.colorScheme === 'string') {
    const validSchemes = ['type', 'folder', 'tag', 'creation-date', 'modification-date', 'custom'];
    validated.colorScheme = validSchemes.includes(config.colorScheme) ? config.colorScheme : 'type';
  }

  // Validate numeric fields with ranges
  const numericFields = [
    { key: 'textFadeMultiplier', min: 0, max: 3, default: 1.3 },
    { key: 'nodeSizeMultiplier', min: 0.5, max: 2, default: 1.0 },
    { key: 'lineSizeMultiplier', min: 0.5, max: 3, default: 1.0 },
    { key: 'centerStrength', min: 0, max: 1, default: 0.3 },
    { key: 'repelStrength', min: 0, max: 20, default: 15 },
    { key: 'linkStrength', min: 0, max: 2, default: 0.5 },
    { key: 'linkDistance', min: 50, max: 500, default: 250 }
  ];

  numericFields.forEach(({ key, min, max, default: defaultVal }) => {
    if (typeof config[key] === 'number') {
      validated[key] = Math.max(min, Math.min(max, config[key]));
    } else {
      validated[key] = defaultVal;
    }
  });

  // Validate arrays
  if (Array.isArray(config.colorGroups)) {
    validated.colorGroups = config.colorGroups;
  }

  return validated;
}

/**
 * Debounce helper for auto-save
 */
let saveTimeout = null;

export function debouncedSaveGraphConfig(workspacePath, config, delay = 500) {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
  }

  saveTimeout = setTimeout(() => {
    saveGraphConfig(workspacePath, config);
  }, delay);
}

export default {
  getDefaultConfig,
  loadGraphConfig,
  saveGraphConfig,
  validateConfig,
  debouncedSaveGraphConfig
};
