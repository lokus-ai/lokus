/**
 * Image utility functions for the image viewer
 */

/**
 * Supported image file extensions
 */
export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'];

/**
 * Check if a file is an image based on its extension
 * @param {string} filePath - The file path to check
 * @returns {boolean} - True if the file is an image
 */
export function isImageFile(filePath) {
  if (!filePath) return false;
  const extension = getExtension(filePath);
  return IMAGE_EXTENSIONS.includes(extension.toLowerCase());
}

/**
 * Get file extension without the dot
 * @param {string} filePath - The file path
 * @returns {string} - The extension without dot
 */
function getExtension(filePath) {
  const lastDot = filePath.lastIndexOf('.');
  return lastDot === -1 ? '' : filePath.substring(lastDot + 1);
}

/**
 * Format file size for display
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size
 */
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Format date for display
 * @param {number} timestamp - Unix timestamp in seconds
 * @returns {string} - Formatted date string
 */
export function formatDate(timestamp) {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get image dimensions from an image element
 * @param {HTMLImageElement} img - The image element
 * @returns {Object} - Width and height
 */
export function getImageDimensions(img) {
  return {
    width: img.naturalWidth,
    height: img.naturalHeight
  };
}

/**
 * Find all image files in a file tree
 * @param {Array} files - The file tree array
 * @returns {Array} - Array of image file paths
 */
export function findImageFiles(files) {
  const imageFiles = [];

  function traverse(fileList) {
    for (const file of fileList) {
      if (file.is_directory && file.children) {
        traverse(file.children);
      } else if (isImageFile(file.path)) {
        imageFiles.push(file);
      }
    }
  }

  traverse(files);
  return imageFiles;
}

/**
 * Get the next/previous image file in a list
 * @param {Array} imageFiles - Array of image file objects
 * @param {string} currentPath - Current image file path
 * @param {string} direction - 'next' or 'prev'
 * @returns {Object|null} - Next/previous image file or null
 */
export function getAdjacentImage(imageFiles, currentPath, direction) {
  const currentIndex = imageFiles.findIndex(f => f.path === currentPath);
  if (currentIndex === -1) return null;

  if (direction === 'next') {
    return imageFiles[currentIndex + 1] || imageFiles[0];
  } else if (direction === 'prev') {
    return imageFiles[currentIndex - 1] || imageFiles[imageFiles.length - 1];
  }

  return null;
}
