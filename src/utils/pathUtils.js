/**
 * Cross-platform path utilities
 * 
 * Provides consistent path handling across Windows, macOS, and Linux
 */

import { isWindows, getPathSeparator } from '../platform/index.js';

/**
 * Get the filename from a path (cross-platform)
 * @param {string} path - The file path
 * @returns {string} The filename
 */
export function getFilename(path) {
  if (!path) return '';
  
  // Split by both forward and backslash to handle cross-platform paths
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || '';
}

/**
 * Get the filename without extension
 * @param {string} path - The file path
 * @returns {string} The filename without extension
 */
export function getBasename(path) {
  const filename = getFilename(path);
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(0, lastDot) : filename;
}

/**
 * Get the file extension
 * @param {string} path - The file path
 * @returns {string} The file extension (without dot)
 */
export function getExtension(path) {
  const filename = getFilename(path);
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot + 1) : '';
}

/**
 * Get the directory path
 * @param {string} path - The file path
 * @returns {string} The directory path
 */
export function getDirname(path) {
  if (!path) return '';
  
  // Split by both forward and backslash
  const parts = path.split(/[/\\]/);
  parts.pop(); // Remove filename
  
  // Rejoin with the appropriate separator
  const separator = getPathSeparator();
  return parts.join(separator);
}

/**
 * Join path segments
 * @param {...string} segments - Path segments to join
 * @returns {string} The joined path
 */
export function joinPath(...segments) {
  const separator = getPathSeparator();
  
  // Filter out empty segments and join
  return segments
    .filter(segment => segment && segment.length > 0)
    .join(separator)
    .replace(/[/\\]+/g, separator); // Normalize separators
}

/**
 * Normalize a path for the current platform
 * @param {string} path - The path to normalize
 * @returns {string} The normalized path
 */
export function normalizePath(path) {
  if (!path) return '';
  
  const separator = getPathSeparator();
  
  // Replace all separators with the platform separator
  let normalized = path.replace(/[/\\]+/g, separator);
  
  // Remove trailing separator unless it's the root
  if (normalized.length > 1 && normalized.endsWith(separator)) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

/**
 * Check if a path is absolute
 * @param {string} path - The path to check
 * @returns {boolean} True if the path is absolute
 */
export function isAbsolutePath(path) {
  if (!path) return false;
  
  if (isWindows()) {
    // Windows: Check for drive letter (C:) or UNC path (\\server)
    return /^[A-Za-z]:/.test(path) || path.startsWith('\\\\');
  } else {
    // Unix: Check for leading slash
    return path.startsWith('/');
  }
}

/**
 * Get relative path from one path to another
 * @param {string} from - The source path
 * @param {string} to - The target path
 * @returns {string} The relative path
 */
export function getRelativePath(from, to) {
  const separator = getPathSeparator();
  
  // Normalize paths
  const normalizedFrom = normalizePath(from).split(separator);
  const normalizedTo = normalizePath(to).split(separator);
  
  // Find common base
  let commonLength = 0;
  for (let i = 0; i < Math.min(normalizedFrom.length, normalizedTo.length); i++) {
    if (normalizedFrom[i] === normalizedTo[i]) {
      commonLength++;
    } else {
      break;
    }
  }
  
  // Build relative path
  const upCount = normalizedFrom.length - commonLength;
  const relativeParts = [];
  
  // Add '..' for each level up
  for (let i = 0; i < upCount; i++) {
    relativeParts.push('..');
  }
  
  // Add the remaining path to target
  relativeParts.push(...normalizedTo.slice(commonLength));
  
  return relativeParts.join(separator) || '.';
}

/**
 * Ensure a path has the correct extension
 * @param {string} path - The file path
 * @param {string} extension - The desired extension (with or without dot)
 * @returns {string} The path with the correct extension
 */
export function ensureExtension(path, extension) {
  if (!path) return '';
  
  // Ensure extension starts with dot
  const ext = extension.startsWith('.') ? extension : '.' + extension;
  
  // Check if path already has the extension
  if (path.toLowerCase().endsWith(ext.toLowerCase())) {
    return path;
  }
  
  // Add the extension
  return path + ext;
}

/**
 * Sanitize a filename for the current platform
 * @param {string} filename - The filename to sanitize
 * @returns {string} The sanitized filename
 */
export function sanitizeFilename(filename) {
  if (!filename) return '';
  
  // Common invalid characters across platforms
  let sanitized = filename.replace(/[<>:"|?*]/g, '_');
  
  // Windows-specific: Remove trailing dots and spaces
  if (isWindows()) {
    sanitized = sanitized.replace(/[\s.]+$/, '');
    
    // Check for reserved names
    const reserved = [
      'CON', 'PRN', 'AUX', 'NUL',
      'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
      'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'
    ];
    
    const nameWithoutExt = sanitized.split('.')[0].toUpperCase();
    if (reserved.includes(nameWithoutExt)) {
      sanitized = '_' + sanitized;
    }
  }
  
  return sanitized;
}