/**
 * Roam Research Importer
 *
 * Converts a Roam JSON export to a Lokus workspace using the unified pipeline:
 *   RoamParser → IR → LokusTransformer → output files
 */

import { BaseImporter } from './base-importer.js';
import { parseRoamExport } from './parsers/roam-parser.js';
import { transformDocument } from './transformer/lokus-transformer.js';
import { convertBlockReferences } from './utils/block-resolver.js';
import { ProgressTracker } from './utils/progress-tracker.js';
import { invoke } from '@tauri-apps/api/core';

export class RoamImporter extends BaseImporter {
  constructor(options = {}) {
    super(options);
    this.progressTracker = new ProgressTracker();
  }

  getPlatformName() {
    return 'Roam Research';
  }

  getSupportedExtensions() {
    return ['.json'];
  }

  async validate(sourcePath) {
    const errors = [];
    const warnings = [];

    try {
      const exists = await invoke('path_exists', { path: sourcePath });
      if (!exists) {
        errors.push('Source file does not exist');
        return { valid: false, errors, warnings };
      }

      const isDir = await invoke('is_directory', { path: sourcePath });
      if (isDir) {
        errors.push('Source must be a JSON file (Roam export), not a directory');
        return { valid: false, errors, warnings };
      }

      if (!sourcePath.endsWith('.json')) {
        errors.push('Source file must be a JSON file');
        return { valid: false, errors, warnings };
      }

      const content = await invoke('read_file_content', { path: sourcePath });
      let data;
      try {
        data = JSON.parse(content);
      } catch (e) {
        errors.push('Invalid JSON file: ' + e.message);
        return { valid: false, errors, warnings };
      }

      if (!Array.isArray(data)) {
        errors.push('Invalid Roam export format: expected array of pages');
        return { valid: false, errors, warnings };
      }

      if (data.length === 0) {
        warnings.push('Export file is empty (no pages found)');
      }

      const samplePage = data[0];
      if (samplePage && !samplePage.title && !samplePage['page-title']) {
        warnings.push('Unusual Roam export structure detected');
      }

      return { valid: true, errors, warnings, pageCount: data.length };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  async preview(sourcePath, sampleSize = 5) {
    const { serializePage } = await import('./transformer/lokus-transformer.js');
    const raw = await invoke('read_file_content', { path: sourcePath });
    const roamPages = JSON.parse(raw);
    const { document } = parseRoamExport(roamPages);
    const samplePages = document.pages.slice(0, sampleSize);

    return samplePages.map(page => ({
      fileName: page.path,
      original: `(Roam page: ${page.title})`,
      converted: serializePage(page).substring(0, 500),
      properties: page.frontmatter
    }));
  }

  /**
   * Import to a separate destination folder.
   */
  async import(sourcePath, destPath) {
    return this._runPipeline(sourcePath, destPath);
  }

  /**
   * Convert in place — creates a workspace folder next to the JSON file.
   */
  async convertInPlace(jsonFilePath) {
    const parentPath = jsonFilePath.substring(0, jsonFilePath.lastIndexOf('/'));
    const jsonFileName = jsonFilePath.substring(jsonFilePath.lastIndexOf('/') + 1);
    const workspaceName = jsonFileName.replace(/\.json$/i, '') || 'Roam Import';
    const folderPath = `${parentPath}/${workspaceName}`;

    await this._runPipeline(jsonFilePath, folderPath);

    // Backup original JSON into workspace
    await this.backupJsonFile(jsonFilePath, folderPath);

    return {
      success: true,
      stats: this.getStats(),
      workspacePath: folderPath
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

      // Read JSON
      const raw = await invoke('read_file_content', { path: sourcePath });
      const roamPages = JSON.parse(raw);

      this.stats.totalFiles = roamPages.length;
      this.progressTracker.setTotal(roamPages.length);
      this.progressTracker.start();

      // Parse
      this.updateProgress(0, roamPages.length, 'Parsing Roam export...');
      const { document, blockMap } = parseRoamExport(roamPages, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Parsing: ${msg}`);
          this.progressTracker.update(msg);
        }
      });

      // Transform
      await this.ensureDestinationExists(destPath);
      const result = await transformDocument(document, destPath, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Writing: ${msg}`);
        }
      });

      this.stats.processedFiles = result.pagesWritten;

      // Resolve block references
      await this.resolveBlockRefs(destPath, document, blockMap);

      // Create .lokus marker
      await this.createLokusMarker(destPath);

      this.progressTracker.complete();

      return {
        success: true,
        stats: this.getStats(),
        blockStats: blockMap.getStats()
      };
    } catch (error) {
      this.progressTracker.error(error.message);
      throw error;
    }
  }

  async resolveBlockRefs(destPath, document, blockMap) {
    for (const page of document.pages) {
      try {
        const filePath = `${destPath}/${page.path}`;
        const content = await invoke('read_file_content', { path: filePath });
        const { content: resolved, unresolvedRefs } = convertBlockReferences(
          content, blockMap, page.sourceFile
        );

        if (resolved !== content) {
          await invoke('write_file', { path: filePath, content: resolved });
        }

        if (unresolvedRefs.length > 0) {
          this.addWarning(page.path, `${unresolvedRefs.length} unresolved block references`);
        }
      } catch {
        // non-fatal
      }
    }
  }

  // -- Helpers ---------------------------------------------------------------

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
          convertedFrom: 'roam',
          convertedAt: new Date().toISOString(),
          version: '1.0'
        }, null, 2)
      });
    } catch {
      // non-fatal
    }
  }

  async backupJsonFile(jsonFilePath, workspacePath) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const fileName = jsonFilePath.substring(jsonFilePath.lastIndexOf('/') + 1);
      const backupPath = `${workspacePath}/.lokus-backup-${date}`;

      await invoke('create_directory', { path: backupPath, recursive: true });
      const content = await invoke('read_file_content', { path: jsonFilePath });
      await invoke('write_file', { path: `${backupPath}/${fileName}`, content });
    } catch {
      // non-fatal
    }
  }

  onProgress(callback) {
    super.onProgress(callback);
    this.progressTracker.onProgress(callback);
  }
}

export default RoamImporter;
