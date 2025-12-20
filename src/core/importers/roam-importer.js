/**
 * Roam Research Importer
 *
 * Imports notes from Roam Research JSON export to Lokus format
 */

import { BaseImporter } from './base-importer.js';
import { addFrontmatter } from './utils/frontmatter.js';
import { transformRoamContent, convertRoamBlocks } from './utils/markdown-transformer.js';
import { BlockReferenceMap, convertBlockReferences, generateBlockId } from './utils/block-resolver.js';
import { ProgressTracker } from './utils/progress-tracker.js';
import { invoke } from '@tauri-apps/api/core';

export class RoamImporter extends BaseImporter {
  constructor(options = {}) {
    super(options);
    this.blockMap = new BlockReferenceMap();
    this.progressTracker = new ProgressTracker();
  }

  /**
   * Get platform name
   */
  getPlatformName() {
    return 'Roam Research';
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions() {
    return ['.json'];
  }

  /**
   * Validate Roam JSON export file
   */
  async validate(sourcePath) {
    const errors = [];
    const warnings = [];

    try {
      // Check if file exists
      const exists = await invoke('path_exists', { path: sourcePath });
      if (!exists) {
        errors.push('Source file does not exist');
        return { valid: false, errors, warnings };
      }

      // Check if it's a file (not directory)
      const isDir = await invoke('is_directory', { path: sourcePath });
      if (isDir) {
        errors.push('Source must be a JSON file (Roam export), not a directory');
        return { valid: false, errors, warnings };
      }

      // Check file extension
      if (!sourcePath.endsWith('.json')) {
        errors.push('Source file must be a JSON file');
        return { valid: false, errors, warnings };
      }

      // Try to parse JSON
      const content = await invoke('read_file_content', { path: sourcePath });
      let data;

      try {
        data = JSON.parse(content);
      } catch (e) {
        errors.push('Invalid JSON file: ' + e.message);
        return { valid: false, errors, warnings };
      }

      // Validate Roam JSON structure
      if (!Array.isArray(data)) {
        errors.push('Invalid Roam export format: expected array of pages');
        return { valid: false, errors, warnings };
      }

      if (data.length === 0) {
        warnings.push('Export file is empty (no pages found)');
      }

      // Check if pages have expected structure
      const samplePage = data[0];
      if (!samplePage.title && !samplePage['page-title']) {
        warnings.push('Unusual Roam export structure detected');
      }

      return {
        valid: true,
        errors,
        warnings,
        pageCount: data.length
      };
    } catch (error) {
      errors.push(`Validation error: ${error.message}`);
      return { valid: false, errors, warnings };
    }
  }

  /**
   * Parse Roam JSON export
   */
  async parseRoamExport(sourcePath) {
    try {
      const content = await invoke('read_file_content', { path: sourcePath });
      const data = JSON.parse(content);
      return data;
    } catch (error) {
      throw new Error(`Failed to parse Roam export: ${error.message}`);
    }
  }

  /**
   * Extract page title from Roam page object
   */
  getPageTitle(page) {
    return page.title || page['page-title'] || 'Untitled';
  }

  /**
   * Build block map from entire export
   * First pass: register all blocks with their UIDs
   */
  buildBlockMap(pages) {
    for (const page of pages) {
      const pageTitle = this.getPageTitle(page);
      const fileName = this.sanitizeFileName(pageTitle);

      if (page.children) {
        this.registerBlocksRecursive(page.children, fileName);
      }
    }
  }

  /**
   * Register blocks recursively
   */
  registerBlocksRecursive(blocks, fileName) {
    for (const block of blocks) {
      if (block.uid) {
        const content = block.string || block.content || '';
        this.blockMap.registerBlock(block.uid, content, fileName);
      }

      if (block.children && block.children.length > 0) {
        this.registerBlocksRecursive(block.children, fileName);
      }
    }
  }

  /**
   * Convert a Roam page to markdown
   */
  convertPage(page) {
    const title = this.getPageTitle(page);
    const children = page.children || [];

    // Build properties from page metadata
    const properties = {};

    if (page['create-time']) {
      properties.created = new Date(page['create-time']).toISOString();
    }

    if (page['edit-time']) {
      properties.modified = new Date(page['edit-time']).toISOString();
    }

    // Extract tags if present
    const tags = this.extractTags(page);
    if (tags.length > 0) {
      properties.tags = tags;
    }

    // Convert blocks to markdown
    let content = '';

    if (children.length > 0) {
      content = convertRoamBlocks(children);
    } else {
      content = ''; // Empty page
    }

    // Transform content
    content = transformRoamContent(content);

    // Add frontmatter
    if (Object.keys(properties).length > 0) {
      content = addFrontmatter(content, properties);
    }

    return {
      title,
      content,
      properties
    };
  }

  /**
   * Extract tags from page
   */
  extractTags(page) {
    const tags = [];

    // Check if page itself is tagged
    if (page.tags && Array.isArray(page.tags)) {
      tags.push(...page.tags);
    }

    // Extract from title if it contains #tags
    const title = this.getPageTitle(page);
    const tagMatches = title.match(/#(\w+)/g);
    if (tagMatches) {
      tags.push(...tagMatches.map(t => t.slice(1)));
    }

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Sanitize file name for file system
   */
  sanitizeFileName(name) {
    return name
      .replace(/[<>:"/\\|?*]/g, '-') // Replace invalid chars
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim()
      .substring(0, 200); // Limit length
  }

  /**
   * Preview conversion
   */
  async preview(sourcePath, sampleSize = 5) {
    const pages = await this.parseRoamExport(sourcePath);
    const samplePages = pages.slice(0, sampleSize);
    const previews = [];

    // Build block map for reference resolution
    this.buildBlockMap(pages);

    for (const page of samplePages) {
      try {
        const converted = this.convertPage(page);
        const fileName = this.sanitizeFileName(converted.title) + '.md';

        previews.push({
          fileName,
          original: JSON.stringify(page, null, 2).substring(0, 500) + '...',
          converted: converted.content.substring(0, 500) + (converted.content.length > 500 ? '...' : ''),
          properties: converted.properties
        });
      } catch (error) {
        this.addError(this.getPageTitle(page), error);
      }
    }

    return previews;
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

      // Step 2: Parse JSON export
      const pages = await this.parseRoamExport(sourcePath);
      this.stats.totalFiles = pages.length;
      this.progressTracker.setTotal(pages.length);
      this.progressTracker.start();

      // Step 3: Build block map (first pass)
      this.updateProgress(0, pages.length, 'Building block reference map...');
      this.buildBlockMap(pages);

      // Step 4: Convert all pages
      const convertedPages = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        try {
          const title = this.getPageTitle(page);
          this.updateProgress(i + 1, pages.length, `Converting ${title}`);
          this.progressTracker.update(title);

          const converted = this.convertPage(page);
          const fileName = this.sanitizeFileName(converted.title) + '.md';

          convertedPages.push({
            fileName,
            ...converted
          });
        } catch (error) {
          this.addError(this.getPageTitle(page), error);
        }
      }

      // Step 5: Resolve block references (second pass)
      for (const page of convertedPages) {
        try {
          const { content, unresolvedRefs } = convertBlockReferences(
            page.content,
            this.blockMap,
            page.fileName
          );

          page.content = content;

          if (unresolvedRefs.length > 0) {
            this.addWarning(page.fileName, `${unresolvedRefs.length} unresolved block references`);
          }
        } catch (error) {
          this.addError(page.fileName, error);
        }
      }

      // Step 6: Write files to destination
      await this.ensureDestinationExists(destPath);

      for (const page of convertedPages) {
        try {
          const destFilePath = `${destPath}/${page.fileName}`;
          await invoke('write_file', {
            path: destFilePath,
            content: page.content
          });

          this.stats.processedFiles++;
        } catch (error) {
          this.addError(page.fileName, error);
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
   * Convert Roam JSON export to a new workspace folder
   * Creates a new folder and puts converted markdown files there
   * @param {string} jsonFilePath - Path to the Roam JSON export file
   * @returns {Promise<Object>} Conversion results
   */
  async convertInPlace(jsonFilePath) {
    this.resetStats();
    this.blockMap = new BlockReferenceMap();

    try {
      // Step 1: Validate source
      const validation = await this.validate(jsonFilePath);
      if (!validation.valid) {
        throw new Error(`Invalid source: ${validation.errors.join(', ')}`);
      }

      // Get the parent folder and create a new workspace folder
      const parentPath = jsonFilePath.substring(0, jsonFilePath.lastIndexOf('/'));
      const jsonFileName = jsonFilePath.substring(jsonFilePath.lastIndexOf('/') + 1);
      const workspaceName = jsonFileName.replace(/\.json$/i, '') || 'Roam Import';

      // Create workspace folder
      const folderPath = `${parentPath}/${workspaceName}`;
      await invoke('create_directory', { path: folderPath, recursive: true });

      // Step 2: Parse JSON export
      const pages = await this.parseRoamExport(jsonFilePath);
      this.stats.totalFiles = pages.length;
      this.progressTracker.setTotal(pages.length);
      this.progressTracker.start();

      // Step 3: Build block map (first pass)
      this.updateProgress(0, pages.length, 'Building block reference map...');
      this.buildBlockMap(pages);

      // Step 4: Convert all pages
      const convertedPages = [];
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        try {
          const title = this.getPageTitle(page);
          this.updateProgress(i + 1, pages.length, `Converting ${title}`);
          this.progressTracker.update(title);

          const converted = this.convertPage(page);
          const fileName = this.sanitizeFileName(converted.title) + '.md';

          convertedPages.push({
            fileName,
            ...converted
          });
        } catch (error) {
          this.addError(this.getPageTitle(page), error);
        }
      }

      // Step 5: Resolve block references (second pass)
      for (const page of convertedPages) {
        try {
          const { content, unresolvedRefs } = convertBlockReferences(
            page.content,
            this.blockMap,
            page.fileName
          );

          page.content = content;

          if (unresolvedRefs.length > 0) {
            this.addWarning(page.fileName, `${unresolvedRefs.length} unresolved block references`);
          }
        } catch (error) {
          this.addError(page.fileName, error);
        }
      }

      // Step 6: Write files to the same folder
      for (const page of convertedPages) {
        try {
          const destFilePath = `${folderPath}/${page.fileName}`;
          await invoke('write_file', {
            path: destFilePath,
            content: page.content
          });

          this.stats.processedFiles++;
        } catch (error) {
          this.addError(page.fileName, error);
        }
      }

      // Step 7: Create .lokus folder to mark as Lokus workspace
      await this.createLokusMarker(folderPath);

      // Step 8: Move original JSON to backup folder inside workspace
      await this.backupJsonFile(jsonFilePath, folderPath);

      this.progressTracker.complete();

      return {
        success: true,
        stats: this.getStats(),
        blockStats: this.blockMap.getStats(),
        workspacePath: folderPath
      };
    } catch (error) {
      this.progressTracker.error(error.message);
      throw error;
    }
  }

  /**
   * Create .lokus folder to mark as Lokus workspace
   */
  async createLokusMarker(folderPath) {
    const lokusPath = `${folderPath}/.lokus`;
    try {
      const exists = await invoke('path_exists', { path: lokusPath });
      if (!exists) {
        await invoke('create_directory', { path: lokusPath, recursive: true });
      }

      // Write a marker file
      await invoke('write_file', {
        path: `${lokusPath}/converted.json`,
        content: JSON.stringify({
          convertedFrom: 'roam',
          convertedAt: new Date().toISOString(),
          version: '1.0'
        }, null, 2)
      });
    } catch (error) {
      // Non-fatal, just log
      console.error('Failed to create Lokus marker:', error);
    }
  }

  /**
   * Backup original JSON file to workspace backup folder
   */
  async backupJsonFile(jsonFilePath, workspacePath) {
    try {
      const date = new Date().toISOString().split('T')[0];
      const fileName = jsonFilePath.substring(jsonFilePath.lastIndexOf('/') + 1);
      const backupPath = `${workspacePath}/.lokus-backup-${date}`;

      await invoke('create_directory', { path: backupPath, recursive: true });

      const content = await invoke('read_file_content', { path: jsonFilePath });
      await invoke('write_file', {
        path: `${backupPath}/${fileName}`,
        content
      });
    } catch (error) {
      // Non-fatal
      console.error('Failed to backup JSON file:', error);
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

export default RoamImporter;
