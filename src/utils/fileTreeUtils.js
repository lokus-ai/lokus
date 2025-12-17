/**
 * File Tree Utility Functions
 *
 * Provides utilities for comparing and hashing file tree structures
 * to detect meaningful changes and maintain reference stability.
 */

/**
 * Generate a stable hash from a file tree structure
 * Uses file paths only to create a deterministic hash
 *
 * @param {Array} fileTree - The file tree structure
 * @returns {string} Hash string representing the file tree structure
 */
export function generateFileTreeHash(fileTree) {
  if (!fileTree || !Array.isArray(fileTree) || fileTree.length === 0) {
    return '';
  }

  // Extract all file paths in sorted order for stable hashing
  const paths = extractFilePaths(fileTree).sort();
  return paths.join('|');
}

/**
 * Recursively extract all file paths from a file tree structure
 *
 * @param {Array} fileTree - The file tree structure
 * @param {Array} paths - Accumulator for file paths (internal use)
 * @returns {Array<string>} Array of all file paths in the tree
 */
export function extractFilePaths(fileTree, paths = []) {
  if (!Array.isArray(fileTree)) {
    return paths;
  }

  for (const entry of fileTree) {
    if (!entry || !entry.path) continue;

    paths.push(entry.path);

    // Recursively process children
    if (entry.children && Array.isArray(entry.children)) {
      extractFilePaths(entry.children, paths);
    }
  }

  return paths;
}

/**
 * Deep equality check for file tree structures
 * Compares paths and structure, not object references
 *
 * @param {Array} tree1 - First file tree
 * @param {Array} tree2 - Second file tree
 * @returns {boolean} True if trees have same structure and paths
 */
export function areFileTreesEqual(tree1, tree2) {
  // Quick reference check
  if (tree1 === tree2) return true;

  // Null/undefined check
  if (!tree1 || !tree2) return false;

  // Array check
  if (!Array.isArray(tree1) || !Array.isArray(tree2)) return false;

  // Length check
  if (tree1.length !== tree2.length) return false;

  // Hash comparison (fast path)
  const hash1 = generateFileTreeHash(tree1);
  const hash2 = generateFileTreeHash(tree2);

  return hash1 === hash2;
}
