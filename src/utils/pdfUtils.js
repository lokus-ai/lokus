/**
 * PDF utility functions for Lokus
 */

export const PDF_EXTENSIONS = ['pdf'];

/**
 * Check if a file path is a PDF file
 * @param {string} filePath - The file path to check
 * @returns {boolean} - True if the file is a PDF
 */
export function isPDFFile(filePath) {
  if (!filePath) return false;

  const extension = getExtension(filePath);
  return PDF_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Get file extension from a file path
 * @param {string} filePath - The file path
 * @returns {string} - The file extension (without dot)
 */
export function getExtension(filePath) {
  if (!filePath) return '';

  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return '';

  return filePath.substring(lastDot + 1);
}

/**
 * Format PDF file size
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatPDFFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
