/**
 * Base Importer Class
 *
 * Abstract base class for all note importers.
 * Provides common functionality for converting notes from different platforms.
 */

export class BaseImporter {
  constructor(options = {}) {
    this.options = {
      preserveStructure: true,
      convertLinks: true,
      downloadAttachments: true,
      generateBlockIds: true,
      ...options
    };

    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      warnings: [],
      skipped: []
    };

    this.progressCallbacks = [];
  }

  /**
   * Register a progress callback
   * @param {Function} callback - Called with (current, total, message)
   */
  onProgress(callback) {
    this.progressCallbacks.push(callback);
  }

  /**
   * Emit progress update
   */
  updateProgress(current, total, message = '') {
    this.progressCallbacks.forEach(cb => cb(current, total, message));
  }

  /**
   * Main import method - must be implemented by subclasses
   * @param {string} sourcePath - Path to source files/export
   * @param {string} destPath - Destination folder in Lokus
   * @returns {Promise<Object>} Import results
   */
  async import(sourcePath, destPath) {
    throw new Error('import() must be implemented by subclass');
  }

  /**
   * Validate source before import
   * @param {string} sourcePath
   * @returns {Promise<Object>} Validation result {valid, errors, warnings}
   */
  async validate(sourcePath) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Preview conversion without writing files
   * @param {string} sourcePath
   * @param {number} sampleSize - Number of files to preview
   * @returns {Promise<Array>} Sample converted files
   */
  async preview(sourcePath, sampleSize = 5) {
    throw new Error('preview() must be implemented by subclass');
  }

  /**
   * Get platform name
   */
  getPlatformName() {
    throw new Error('getPlatformName() must be implemented by subclass');
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return ['.md', '.markdown'];
  }

  /**
   * Add error to stats
   */
  addError(file, error) {
    this.stats.errors.push({ file, error: error.message || error });
  }

  /**
   * Add warning to stats
   */
  addWarning(file, warning) {
    this.stats.warnings.push({ file, warning });
  }

  /**
   * Get import statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalFiles > 0
        ? ((this.stats.processedFiles / this.stats.totalFiles) * 100).toFixed(1)
        : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      errors: [],
      warnings: [],
      skipped: []
    };
  }
}

export default BaseImporter;
