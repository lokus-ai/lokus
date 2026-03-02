/**
 * Logseq Importer
 *
 * Converts a Logseq graph to a Lokus workspace using the unified pipeline:
 *   LogseqParser → IR → LokusTransformer → output files
 */

import { BaseImporter } from './base-importer.js';
import { parseLogseqGraph } from './parsers/logseq-parser.js';
import { transformDocument } from './transformer/lokus-transformer.js';
import { convertBlockReferences } from './utils/block-resolver.js';
import { ProgressTracker } from './utils/progress-tracker.js';
import { invoke } from '@tauri-apps/api/core';

export class LogseqImporter extends BaseImporter {
  constructor(options = {}) {
    super(options);
    this.progressTracker = new ProgressTracker();
  }

  getPlatformName() {
    return 'Logseq';
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
        errors.push('Source path must be a directory (Logseq graph folder)');
        return { valid: false, errors, warnings };
      }

      const hasConfig = await invoke('path_exists', { path: `${sourcePath}/logseq/config.edn` });
      if (!hasConfig) {
        warnings.push('This may not be a Logseq graph folder (missing logseq/config.edn)');
      }

      const files = await this.findMarkdownFiles(sourcePath);
      if (files.length === 0) {
        errors.push('No markdown files found in source folder');
        return { valid: false, errors, warnings };
      }

      return { valid: true, errors, warnings, fileCount: files.length };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  async findMarkdownFiles(dirPath) {
    try {
      const entries = await invoke('read_directory', { path: dirPath });
      const files = [];

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;
        if (entry.is_dir) {
          if (entry.name === 'logseq' || entry.name === '.logseq' || entry.name.startsWith('.')) continue;
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
      return files;
    } catch {
      return [];
    }
  }

  async preview(sourcePath, sampleSize = 5) {
    const { serializePage } = await import('./transformer/lokus-transformer.js');
    const { document } = await parseLogseqGraph(sourcePath);
    const samplePages = document.pages.slice(0, sampleSize);

    return samplePages.map(page => ({
      fileName: page.path,
      original: `(Logseq source: ${page.sourceFile})`,
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
   * Convert in place — creates a backup then writes converted files
   * back into the original graph folder.
   */
  async convertInPlace(folderPath) {
    this.resetStats();
    this.progressTracker.reset();

    try {
      const validation = await this.validate(folderPath);
      if (!validation.valid) {
        throw new Error(`Invalid source: ${validation.errors.join(', ')}`);
      }

      // Backup
      const backupPath = await this.createBackup(folderPath);
      this.updateProgress(0, 100, 'Created backup');

      // Run pipeline writing to same folder
      await this._runPipeline(folderPath, folderPath, true);

      // Create .lokus marker
      await this.createLokusMarker(folderPath);

      this.progressTracker.complete();

      return {
        success: true,
        stats: this.getStats(),
        backupPath
      };
    } catch (error) {
      this.progressTracker.error(error.message);
      throw error;
    }
  }

  async _runPipeline(sourcePath, destPath, isInPlace = false) {
    if (!isInPlace) {
      this.resetStats();
      this.progressTracker.reset();
    }

    try {
      if (!isInPlace) {
        const validation = await this.validate(sourcePath);
        if (!validation.valid) {
          throw new Error(`Invalid source: ${validation.errors.join(', ')}`);
        }
      }

      // Parse
      this.updateProgress(0, 1, 'Parsing Logseq graph...');
      const { document, blockMap } = await parseLogseqGraph(sourcePath, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Parsing: ${msg}`);
          this.progressTracker.update(msg);
        }
      });

      this.stats.totalFiles = document.pages.length;
      this.progressTracker.setTotal(document.pages.length);
      this.progressTracker.start();

      // Transform (writes files)
      await this.ensureDestinationExists(destPath);
      const result = await transformDocument(document, destPath, {
        onProgress: (cur, tot, msg) => {
          this.updateProgress(cur, tot, `Writing: ${msg}`);
        }
      });

      this.stats.processedFiles = result.pagesWritten;

      // Second pass: resolve block references in written files
      // (block refs are left as ((uuid)) by the parser and need post-processing)
      await this.resolveBlockRefs(destPath, document, blockMap);

      if (!isInPlace) {
        await this.createLokusMarker(destPath);
        this.progressTracker.complete();
      }

      return {
        success: true,
        stats: this.getStats(),
        blockStats: blockMap.getStats()
      };
    } catch (error) {
      if (!isInPlace) {
        this.progressTracker.error(error.message);
      }
      throw error;
    }
  }

  /**
   * Post-process written files to resolve ((uuid)) block references.
   */
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

  async createBackup(folderPath) {
    const date = new Date().toISOString().split('T')[0];
    const backupPath = `${folderPath}/.lokus-backup-${date}`;

    try {
      await invoke('create_directory', { path: backupPath, recursive: true });
      const files = await this.findMarkdownFiles(folderPath);
      for (const file of files) {
        const fileName = file.split('/').pop();
        const content = await invoke('read_file_content', { path: file });
        await invoke('write_file', { path: `${backupPath}/${fileName}`, content });
      }
      return backupPath;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error.message}`);
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
          convertedFrom: 'logseq',
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

export default LogseqImporter;
