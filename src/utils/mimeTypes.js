/**
 * MIME type mapping for common image file extensions
 */
export const IMAGE_MIME_TYPES = {
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'bmp': 'image/bmp',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
  'ico': 'image/x-icon',
  'tiff': 'image/tiff',
  'tif': 'image/tiff'
};

/**
 * Get MIME type from file extension
 * @param {string} filePath - Path to the file
 * @param {string} defaultType - Default MIME type if extension not found
 * @returns {string} MIME type string
 */
export function getMimeTypeFromPath(filePath, defaultType = 'image/png') {
  const extension = filePath.split('.').pop().toLowerCase();
  return IMAGE_MIME_TYPES[extension] || defaultType;
}

/**
 * Convert image file data to base64 data URL
 * @param {Uint8Array} imageData - Raw image data
 * @param {string} filePath - Path to determine MIME type
 * @returns {string} Data URL string
 */
export function imageDataToDataURL(imageData, filePath) {
  const mimeType = getMimeTypeFromPath(filePath);
  const base64 = btoa(String.fromCharCode(...imageData));
  return `data:${mimeType};base64,${base64}`;
}
