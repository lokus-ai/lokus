/**
 * PathUtils - Centralized path normalization and node ID generation
 * 
 * This utility ensures consistent node IDs across all graph systems
 * to prevent duplicate nodes for the same file.
 */

/**
 * Normalize a file path for consistent processing
 * @param {string} path - Raw file path
 * @returns {string} Normalized path
 */
export function normalizePath(path) {
  if (!path || typeof path !== 'string') {
    return '';
  }
  
  // Remove leading/trailing whitespace
  let normalized = path.trim();
  
  // Convert backslashes to forward slashes (Windows compatibility)
  normalized = normalized.replace(/\\/g, '/');
  
  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');
  
  // Remove leading slash if present (for relative paths)
  if (normalized.startsWith('/')) {
    normalized = normalized.substring(1);
  }
  
  // Ensure consistent file extension handling
  // Convert .md extensions to lowercase
  normalized = normalized.replace(/\.MD$/i, '.md');
  
  return normalized;
}

/**
 * Create a consistent node ID from a file path
 * Uses the raw path directly instead of hashing for better debugging
 * @param {string} filePath - File path to create ID from
 * @returns {string} Consistent node ID
 */
export function createNodeId(filePath) {
  const normalizedPath = normalizePath(filePath);
  
  // Use the normalized path directly as the ID
  // This makes debugging easier and ensures consistency
  return normalizedPath;
}

/**
 * Extract filename from a path without extension
 * @param {string} path - File path
 * @returns {string} Filename without extension
 */
export function getFileNameWithoutExtension(path) {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  const fileName = lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
}

/**
 * Extract just the filename from a path (with extension)
 * @param {string} path - File path
 * @returns {string} Filename with extension
 */
export function getFileName(path) {
  const normalized = normalizePath(path);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(lastSlash + 1) : normalized;
}

/**
 * Get file extension from a path
 * @param {string} path - File path
 * @returns {string} File extension including the dot
 */
export function getFileExtension(path) {
  const fileName = getFileName(path);
  const lastDot = fileName.lastIndexOf('.');
  return lastDot > 0 ? fileName.substring(lastDot).toLowerCase() : '';
}

/**
 * Convert a WikiLink target to a normalized file path
 * @param {string} target - WikiLink target (e.g., "Test1", "Test1.md", "folder/Test1")
 * @param {string} sourcePath - Path of the file containing the link (for relative resolution)
 * @returns {string} Normalized path that would be used for node ID
 */
export function wikiLinkToPath(target, sourcePath = '') {
  if (!target) return '';
  
  // Clean the target
  let cleanTarget = target.trim();
  
  // Remove alias part if present (for [[Page|Alias]] format)
  if (cleanTarget.includes('|')) {
    cleanTarget = cleanTarget.split('|')[0].trim();
  }
  
  // If target already includes path separators, normalize it
  if (cleanTarget.includes('/') || cleanTarget.includes('\\')) {
    return normalizePath(cleanTarget.endsWith('.md') ? cleanTarget : cleanTarget + '.md');
  }
  
  // For simple targets like "Test1", add .md extension
  if (!cleanTarget.endsWith('.md')) {
    cleanTarget += '.md';
  }
  
  return normalizePath(cleanTarget);
}

/**
 * Check if two paths refer to the same file
 * @param {string} path1 - First path
 * @param {string} path2 - Second path
 * @returns {boolean} True if paths refer to same file
 */
export function pathsMatch(path1, path2) {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);
  
  // Direct match
  if (norm1 === norm2) return true;
  
  // Check with/without .md extension
  const withoutExt1 = norm1.replace(/\.md$/i, '');
  const withoutExt2 = norm2.replace(/\.md$/i, '');
  
  return withoutExt1 === withoutExt2;
}

/**
 * Generate a phantom node ID for unresolved WikiLinks
 * @param {string} target - WikiLink target that couldn't be resolved
 * @returns {string} Phantom node ID
 */
export function createPhantomNodeId(target) {
  const normalizedTarget = wikiLinkToPath(target);
  return `phantom:${normalizedTarget}`;
}

/**
 * Check if a node ID represents a phantom node
 * @param {string} nodeId - Node ID to check
 * @returns {boolean} True if phantom node
 */
export function isPhantomNodeId(nodeId) {
  return typeof nodeId === 'string' && nodeId.startsWith('phantom:');
}

/**
 * Extract the original target from a phantom node ID
 * @param {string} phantomNodeId - Phantom node ID
 * @returns {string} Original target
 */
export function getPhantomTarget(phantomNodeId) {
  if (!isPhantomNodeId(phantomNodeId)) return '';
  return phantomNodeId.replace('phantom:', '');
}

export default {
  normalizePath,
  createNodeId,
  getFileNameWithoutExtension,
  getFileName,
  getFileExtension,
  wikiLinkToPath,
  pathsMatch,
  createPhantomNodeId,
  isPhantomNodeId,
  getPhantomTarget
};