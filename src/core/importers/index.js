/**
 * Importer Registry
 *
 * Central registry for all note importers
 */

// Import importers as they are created
import LogseqImporter from './logseq-importer.js';
import RoamImporter from './roam-importer.js';

/**
 * Available importers registry
 */
const importers = new Map();

/**
 * Register an importer
 * @param {string} name - Importer name (e.g., 'logseq', 'roam')
 * @param {Class} ImporterClass - Importer class
 */
export function registerImporter(name, ImporterClass) {
  importers.set(name.toLowerCase(), ImporterClass);
}

/**
 * Get importer by name
 * @param {string} name
 * @returns {Class|null}
 */
export function getImporter(name) {
  return importers.get(name.toLowerCase()) || null;
}

/**
 * Get all available importers
 * @returns {Array} Array of {name, importer} objects
 */
export function getAllImporters() {
  return Array.from(importers.entries()).map(([name, importer]) => ({
    name,
    importer
  }));
}

/**
 * Check if importer exists
 * @param {string} name
 * @returns {boolean}
 */
export function hasImporter(name) {
  return importers.has(name.toLowerCase());
}

/**
 * Get importer info
 * @param {string} name
 * @returns {Object|null} {name, platformName, extensions}
 */
export function getImporterInfo(name) {
  const ImporterClass = getImporter(name);
  if (!ImporterClass) return null;

  const instance = new ImporterClass();

  return {
    name,
    platformName: instance.getPlatformName(),
    extensions: instance.getSupportedExtensions()
  };
}

/**
 * Get all importer info
 * @returns {Array}
 */
export function getAllImporterInfo() {
  return getAllImporters().map(({ name }) => getImporterInfo(name)).filter(Boolean);
}

// Register importers when they're created
registerImporter('logseq', LogseqImporter);
registerImporter('roam', RoamImporter);

export default {
  registerImporter,
  getImporter,
  getAllImporters,
  hasImporter,
  getImporterInfo,
  getAllImporterInfo
};
