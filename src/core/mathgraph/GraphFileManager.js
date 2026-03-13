/**
 * GraphFileManager.js — Disk I/O for .graph files in the Lokus mathematical graphing system.
 *
 * Uses the same Tauri invoke pattern as the canvas manager: `read_file_content`
 * and `write_file_content` commands with absolute paths.
 *
 * Conventions:
 * - `loadGraphFile` is forgiving: it returns a default graph on any read/parse
 *   error so the UI never hard-crashes on a corrupt or missing file.
 * - `saveGraphFile` and `createNewGraphFile` throw on failure — the caller is
 *   responsible for showing an error toast / retry logic.
 */

import { invoke } from '@tauri-apps/api/core';
import {
  createDefaultGraph,
  validateGraph,
  migrateGraph,
  SCHEMA_VERSION,
} from './schema.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveAbsolutePath(filePath) {
  if (filePath.startsWith('/')) return filePath;
  const ws = window.__WORKSPACE_PATH__ || globalThis.__LOKUS_WORKSPACE_PATH__ || '';
  return ws ? `${ws}/${filePath}` : filePath;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reads a .graph file from disk, validates and migrates it.
 *
 * Failure modes that return a default graph (never throw):
 * - File does not exist
 * - File exists but is empty or contains only whitespace
 * - File contains invalid JSON
 * - File fails schema validation (logged as a warning)
 *
 * @param {string} filePath - Path to the .graph file (absolute or relative to workspace).
 * @returns {Promise<object>} Parsed, validated graph data object.
 */
export async function loadGraphFile(filePath) {
  let raw;

  try {
    raw = await invoke('read_file_content', {
      path: resolveAbsolutePath(filePath),
    });
  } catch (err) {
    // File not found or unreadable — return a blank graph silently.
    console.warn(`[GraphFileManager] Could not read "${filePath}":`, err?.message ?? err);
    return createDefaultGraph();
  }

  if (!raw || raw.trim().length === 0) {
    console.warn(`[GraphFileManager] File is empty, returning default graph: "${filePath}"`);
    return createDefaultGraph();
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn(
      `[GraphFileManager] JSON parse error in "${filePath}", returning default graph:`,
      err?.message ?? err
    );
    return createDefaultGraph();
  }

  // Migrate before validating so the validator always sees the current shape.
  const migrated = migrateGraph(parsed);

  const { valid, errors } = validateGraph(migrated);
  if (!valid) {
    console.warn(
      `[GraphFileManager] Schema validation failed for "${filePath}" (${errors.length} error(s)):`,
      errors
    );
    // Still return the migrated data — it may be usable despite minor issues.
  }

  return migrated;
}

/**
 * Persists a graph data object to disk.
 *
 * Updates `metadata.modified` to the current time and stamps the version
 * before writing so the file is always self-describing.
 *
 * @param {string} filePath   - Path to the .graph file (absolute or relative to workspace).
 * @param {object} graphData  - Graph data object (will not be mutated; a copy is written).
 * @returns {Promise<void>}
 * @throws {Error} If the Tauri write call fails.
 */
export async function saveGraphFile(filePath, graphData) {
  const dataToWrite = {
    ...graphData,
    version: SCHEMA_VERSION,
    metadata: {
      ...graphData.metadata,
      modified: new Date().toISOString(),
    },
  };

  const serialized = JSON.stringify(dataToWrite, null, 2);

  try {
    await invoke('write_file_content', {
      path: resolveAbsolutePath(filePath),
      content: serialized,
    });
  } catch (err) {
    throw new Error(
      `[GraphFileManager] Failed to save "${filePath}": ${err?.message ?? String(err)}`
    );
  }
}

/**
 * Creates a brand-new .graph file on disk with default content.
 *
 * If a file already exists at `filePath` it will be overwritten.
 *
 * @param {string}  filePath      - Path where the file should be created (absolute or relative).
 * @param {string}  [title]       - Optional title for the graph (defaults to 'Untitled Graph').
 * @returns {Promise<object>} The graph data object that was written to disk.
 * @throws {Error} If the Tauri write call fails.
 */
export async function createNewGraphFile(filePath, title) {
  const graphData = createDefaultGraph(title);
  await saveGraphFile(filePath, graphData);
  return graphData;
}

/**
 * Returns the human-readable title from a graph data object.
 *
 * @param {object} graphData - A graph data object (or any value).
 * @returns {string} The title string.
 */
export function getGraphTitle(graphData) {
  return graphData?.metadata?.title?.trim() || 'Untitled Graph';
}
