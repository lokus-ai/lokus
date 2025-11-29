/**
 * Clipboard Manager for File Operations
 *
 * Handles cut/copy/paste operations for files and folders
 */

import { logger } from './logger';

const CLIPBOARD_STORAGE_KEY = 'lokus_clipboard';

export const ClipboardOperation = {
  COPY: 'copy',
  CUT: 'cut'
};

/**
 * Get current clipboard state
 * @returns {Object|null} Clipboard data or null
 */
export function getClipboardState() {
  try {
    const data = sessionStorage.getItem(CLIPBOARD_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Clipboard', 'Failed to get clipboard state:', error);
    return null;
  }
}

/**
 * Set clipboard state
 * @param {string} operation - 'copy' or 'cut'
 * @param {Array<Object>} files - Array of file objects
 */
export function setClipboardState(operation, files) {
  try {
    const data = {
      operation,
      files,
      timestamp: Date.now()
    };
    sessionStorage.setItem(CLIPBOARD_STORAGE_KEY, JSON.stringify(data));
    logger.debug('Clipboard', `Clipboard set: ${operation} ${files.length} file(s)`);
  } catch (error) {
    logger.error('Clipboard', 'Failed to set clipboard state:', error);
  }
}

/**
 * Clear clipboard state
 */
export function clearClipboardState() {
  try {
    sessionStorage.removeItem(CLIPBOARD_STORAGE_KEY);
    logger.debug('Clipboard', 'Clipboard cleared');
  } catch (error) {
    logger.error('Clipboard', 'Failed to clear clipboard:', error);
  }
}

/**
 * Copy files to clipboard
 * @param {Array<Object>} files - Array of file objects
 */
export function copyFiles(files) {
  if (!files || files.length === 0) {
    logger.warn('Clipboard', 'No files to copy');
    return;
  }
  setClipboardState(ClipboardOperation.COPY, files);
}

/**
 * Cut files to clipboard
 * @param {Array<Object>} files - Array of file objects
 */
export function cutFiles(files) {
  if (!files || files.length === 0) {
    logger.warn('Clipboard', 'No files to cut');
    return;
  }
  setClipboardState(ClipboardOperation.CUT, files);
}

/**
 * Check if clipboard has files
 * @returns {boolean}
 */
export function hasClipboardFiles() {
  const state = getClipboardState();
  return state !== null && Array.isArray(state.files) && state.files.length > 0;
}

/**
 * Get clipboard operation type
 * @returns {string|null} 'copy', 'cut', or null
 */
export function getClipboardOperation() {
  const state = getClipboardState();
  return state ? state.operation : null;
}

/**
 * Calculate relative path from workspace root
 * @param {string} absolutePath - Absolute file path
 * @param {string} workspacePath - Workspace root path
 * @returns {string} Relative path
 */
export function getRelativePath(absolutePath, workspacePath) {
  if (!absolutePath || !workspacePath) {
    return absolutePath;
  }

  // Normalize paths
  const normalizedAbsolute = absolutePath.replace(/\\/g, '/');
  const normalizedWorkspace = workspacePath.replace(/\\/g, '/');

  // Ensure workspace path ends without trailing slash
  const workspace = normalizedWorkspace.endsWith('/')
    ? normalizedWorkspace.slice(0, -1)
    : normalizedWorkspace;

  // Check if path starts with workspace
  if (normalizedAbsolute.startsWith(workspace)) {
    const relative = normalizedAbsolute.slice(workspace.length);
    return relative.startsWith('/') ? relative.slice(1) : relative;
  }

  // If not in workspace, return absolute path
  return absolutePath;
}
