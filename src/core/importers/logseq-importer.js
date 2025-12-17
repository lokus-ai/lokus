/**
 * Logseq Importer
 *
 * Imports notes from Logseq to Lokus format
 */

import { BaseImporter } from './base-importer.js';
import { parseLogseqProperties, addFrontmatter } from './utils/frontmatter.js';
import { transformLogseqContent } from './utils/markdown-transformer.js';
import { BlockReferenceMap, convertBlockReferences, extractUUIDs } from './utils/block-resolver.js';
import { ProgressTracker } from './utils/progress-tracker.js';
import { invoke } from '@tauri-apps/api/core';

export class LogseqImporter extends BaseImporter {
  constructor(options = {}) {
    super(options);
    this.blockMap = new BlockReferenceMap();
    this.progressTracker = new ProgressTracker();
  }

  /**
   * Get platform name
   */
  getPlatformName() {
    return 'Logseq';
  }

  /**
   * Validate Logseq source folder
   */
  async validate(sourcePath) {
    const errors = [];
    const warnings = [];

    try {
      // Check if path exists and is a directory
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

      // Check for Logseq markers
      const hasLogseqFolder = await invoke('path_exists', { path: `${sourcePath}/logseq` });
      const hasConfig = await invoke('path_exists', { path: `${sourcePath}/logseq/config.edn` });

      if (!hasLogseqFolder || !hasConfig) {
        warnings.push('This may not be a Logseq graph folder (missing logseq/config.edn)');
      }

      // Count markdown files
      const files = await this.findMarkdownFiles(sourcePath);
      if (files.length === 0) {
        errors.push('No markdown files found in source folder');
        return { valid: false, errors, warnings };
      }

      return {
        valid: true,
        errors,
        warnings,
        fileCount: files.length
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Find all markdown files in directory
   */
  async findMarkdownFiles(dirPath) {
    try {
      const entries = await invoke('read_directory', { path: dirPath });
      const files = [];

      for (const entry of entries) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.is_dir) {
          // Skip logseq system folders
          if (entry.name === 'logseq' || entry.name === '.logseq') {
            continue;
          }
          // Recursively find files in subdirectories
          const subFiles = await this.findMarkdownFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }

      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Preview conversion
   */
  async preview(sourcePath, sampleSize = 5) {
    const files = await this.findMarkdownFiles(sourcePath);
    const sampleFiles = files.slice(0, sampleSize);
    const previews = [];

    for (const filePath of sampleFiles) {
      try {
        const content = await invoke('read_file_content', { path: filePath });
        const converted = await this.convertFile(content, filePath);

        const fileName = filePath.split('/').pop();
        previews.push({
          fileName,
          original: content.substring(0, 500) + (content.length > 500 ? '...' : ''),
          converted: converted.content.substring(0, 500) + (converted.content.length > 500 ? '...' : ''),
          properties: converted.properties
        });
      } catch (error) {
        this.addError(filePath, error);
      }
    }

    return previews;
  }

  /**
   * Convert a single file's content
   */
  async convertFile(content, filePath) {
    // Step 1: Parse Logseq properties
    const { properties, content: contentWithoutProps } = parseLogseqProperties(content);

    // Step 2: Extract and register block references
    const uuids = extractUUIDs(contentWithoutProps);
    for (const uuid of uuids) {
      if (!this.blockMap.hasUUID(uuid)) {
        // Register placeholder, will be resolved in second pass
        this.blockMap.registerBlock(uuid, '[Referenced block]', filePath);
      }
    }

    // Step 3: Transform markdown structure
    let transformedContent = transformLogseqContent(contentWithoutProps);

    // Step 4: Add frontmatter if properties exist
    if (Object.keys(properties).length > 0) {
      transformedContent = addFrontmatter(transformedContent, properties);
    }

    return {
      content: transformedContent,
      properties,
      uuids
    };
  }

  /**
   * Main import method
   */
  async import(sourcePath, destPath) {
    this.resetStats();
    this.blockMap = new BlockReferenceMap(); // Reset block map

    try {
      // Step 1: Validate source
      const validation = await this.validate(sourcePath);
      if (!validation.valid) {
        throw new Error(`Invalid source: ${validation.errors.join(', ')}`);
      }

      // Step 2: Find all markdown files
      const files = await this.findMarkdownFiles(sourcePath);
      this.stats.totalFiles = files.length;
      this.progressTracker.setTotal(files.length);
      this.progressTracker.start();

      // Step 3: First pass - Convert all files and build block map
      const convertedFiles = [];
      for (const filePath of files) {
        try {
          const fileName = filePath.split('/').pop();
          this.updateProgress(convertedFiles.length + 1, files.length, `Converting ${fileName}`);
          this.progressTracker.update(fileName);

          const content = await invoke('read_file_content', { path: filePath });
          const converted = await this.convertFile(content, filePath);

          convertedFiles.push({
            originalPath: filePath,
            fileName,
            ...converted
          });
        } catch (error) {
          this.addError(filePath, error);
        }
      }

      // Step 4: Second pass - Resolve block references
      for (const file of convertedFiles) {
        try {
          const { content, unresolvedRefs } = convertBlockReferences(
            file.content,
            this.blockMap,
            file.originalPath
          );

          file.content = content;

          if (unresolvedRefs.length > 0) {
            this.addWarning(file.fileName, `${unresolvedRefs.length} unresolved block references`);
          }
        } catch (error) {
          this.addError(file.fileName, error);
        }
      }

      // Step 5: Write files to destination
      await this.ensureDestinationExists(destPath);

      for (const file of convertedFiles) {
        try {
          const destFilePath = `${destPath}/${file.fileName}`;
          await invoke('write_file', {
            path: destFilePath,
            content: file.content
          });

          this.stats.processedFiles++;
        } catch (error) {
          this.addError(file.fileName, error);
        }
      }

      this.progressTracker.complete();

      return {
        success: true,
        stats: this.getStats(),
        blockStats: this.blockMap.getStats()
      };
    } catch (error) {
      this.progressTracker.error(error.message);
      throw error;
    }
  }

  /**
   * Ensure destination directory exists
   */
  async ensureDestinationExists(destPath) {
    try {
      const exists = await invoke('path_exists', { path: destPath });
      if (!exists) {
        await invoke('create_directory', { path: destPath, recursive: true });
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Register progress callback for tracker
   */
  onProgress(callback) {
    super.onProgress(callback);
    this.progressTracker.onProgress(callback);
  }
}

export default LogseqImporter;
