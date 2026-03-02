/**
 * Obsidian Importer
 *
 * Converts an Obsidian vault to a Lokus workspace using the unified pipeline:
 *   ObsidianParser → IR → LokusTransformer → output files
 */

import { BaseImporter } from './base-importer.js';
import { parseObsidianVault } from './parsers/obsidian-parser.js';
import { transformDocument } from './transformer/lokus-transformer.js';
import { ProgressTracker } from './utils/progress-tracker.js';
import { invoke } from '@tauri-apps/api/core';

export class ObsidianImporter extends BaseImporter {
  constructor(options = {}) {
    super(options);
    this.progressTracker = new ProgressTracker();
  }

  getPlatformName() {
    return 'Obsidian';
  }

  getSupportedExtensions() {
    return ['.md', '.canvas'];
  }

  async validate(sourcePath) {
    const errors = [];
    const warnings = [];

    try {
      const exists = await invoke('path_exists', { path: sourcePath });
      if (!exists) {
        errors.push('Source path does not exist');
        return { valid: false, errors, warnings };
      }

      const isDir = await invoke('is_directory', { path: sourcePath });
      if (!isDir) {
        errors.push('Source path must be a directory (Obsidian vault)');
        return { valid: false, errors, warnings };
      }

      const hasObsidian = await invoke('path_exists', { path: `${sourcePath}/.obsidian` });
      if (!hasObsidian) {
        warnings.push('No .obsidian folder found — this may not be an Obsidian vault');
      }

      // Count markdown files
      const files = await this.findFiles(sourcePath, '.md');
      if (files.length === 0) {
        errors.push('No markdown files found');
        return { valid: false, errors, warnings };
      }

      const canvasFiles = await this.findFiles(sourcePath, '.canvas');

      return {
        valid: true,
        errors,
        warnings,
        fileCount: files.length,
        canvasCount: canvasFiles.length
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  async preview(sourcePath, sampleSize = 5) {
    const { serializePage } = await import('./transformer/lokus-transformer.js');
    const document = await parseObsidianVault(sourcePath);
    const samplePages = document.pages.slice(0, sampleSize);

    return samplePages.map(page => ({
      fileName: page.path,
      original: `(Obsidian source: ${page.sourceFile})`,
      converted: serializePage(page).substring(0, 500),
      properties: page.frontmatter
    }));
  }

  /**
   * Import to a new destination folder.
   */
  async import(sourcePath, destPath) {
    return this._runPipeline(sourcePath, destPath);
  }

  /**
   * Convert in place — for Obsidian we still copy to a new workspace
   * (we never modify the original vault).
   */
  async convertInPlace(sourcePath) {
    const destPath = `${sourcePath}-lokus`;
    await this._runPipeline(sourcePath, destPath);

    // Return workspacePath so UI can open it
    return {
      success: true,
      stats: this.getStats(),
      workspacePath: destPath
    };
  }

  async _runPipeline(sourcePath, destPath) {
    this.resetStats();
    this.progressTracker.reset();

    try {
      const validation = await this.validate(sourcePath);
      if (!validation.valid) {
        throw new Error(`Invalid source: ${validation.errors.join(', ')}`);
      }

      this.stats.totalFiles = (validation.fileCount || 0) + (validation.canvasCount || 0);
      this.progressTracker.setTotal(this.stats.totalFiles);
      this.progressTracker.start();

      // Parse
      this.updateProgress(0, this.stats.totalFiles, 'Parsing Obsidian vault...');
      const document = await parseObsidianVault(sourcePath, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Parsing: ${msg}`);
          this.progressTracker.update(msg);
        }
      });

      // Transform
      this.updateProgress(0, this.stats.totalFiles, 'Writing Lokus workspace...');
      await this.ensureDestinationExists(destPath);

      const result = await transformDocument(document, destPath, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Writing: ${msg}`);
        }
      });

      this.stats.processedFiles = result.pagesWritten + result.canvasesWritten;

      // Create .lokus marker
      await this.createLokusMarker(destPath);

      this.progressTracker.complete();

      return {
        success: true,
        stats: this.getStats()
      };
    } catch (error) {
      this.progressTracker.error(error.message);
      throw error;
    }
  }

  // -- Helpers ---------------------------------------------------------------

  async findFiles(dirPath, ext) {
    const result = [];
    try {
      const entries = await invoke('read_directory', { path: dirPath });
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = `${dirPath}/${entry.name}`;
        if (entry.is_dir) {
          const sub = await this.findFiles(fullPath, ext);
          result.push(...sub);
        } else if (entry.name.endsWith(ext)) {
          result.push(fullPath);
        }
      }
    } catch {
      // skip
    }
    return result;
  }

  async ensureDestinationExists(destPath) {
    const exists = await invoke('path_exists', { path: destPath });
    if (!exists) {
      await invoke('create_directory', { path: destPath, recursive: true });
    }
  }

  async createLokusMarker(folderPath) {
    const lokusPath = `${folderPath}/.lokus`;
    try {
      const exists = await invoke('path_exists', { path: lokusPath });
      if (!exists) {
        await invoke('create_directory', { path: lokusPath, recursive: true });
      }
      await invoke('write_file', {
        path: `${lokusPath}/converted.json`,
        content: JSON.stringify({
          convertedFrom: 'obsidian',
          convertedAt: new Date().toISOString(),
          version: '1.0'
        }, null, 2)
      });
    } catch {
      // non-fatal
    }
  }

  onProgress(callback) {
    super.onProgress(callback);
    this.progressTracker.onProgress(callback);
  }
}

export default ObsidianImporter;
