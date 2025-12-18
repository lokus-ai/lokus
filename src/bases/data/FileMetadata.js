// src/bases/data/FileMetadata.js
/**
 * FileMetadata - Extract file metadata, provide file-based properties for filtering,
 * and support file relationships like links and backlinks
 */

import { readTextFile, stat, readDir } from '@tauri-apps/plugin-fs';
import { join, dirname, basename, extname } from '@tauri-apps/api/path';
import { invoke } from '@tauri-apps/api/core';
import { getFilename, getDirname, normalizePath, joinPath } from '../../utils/pathUtils.js';

export class FileMetadata {
  constructor() {
    this.cache = new Map(); // filePath -> metadata
    this.linkIndex = new Map(); // filePath -> Set of linked files
    this.backlinkIndex = new Map(); // filePath -> Set of files that link to this
    this.listeners = new Set();
    this.wikiLinkPattern = /\[\[([^\]]+)\]\]/g;
    this.markdownLinkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
  }

  /**
   * Extract comprehensive metadata for a file
   * @param {string} filePath - Path to the file
   * @param {Object} options - Extraction options
   * @returns {Promise<Object>} File metadata
   */
  async extractMetadata(filePath, options = {}) {
    const {
      includeContent = false,
      includeLinks = true,
      includeStats = true,
      contentPreviewLength = 500
    } = options;

    try {
      // Check cache first
      const cached = this.cache.get(filePath);
      if (cached && !options.forceRefresh) {
        return cached;
      }

      const metadata = {
        path: filePath,
        name: await basename(filePath),
        directory: await dirname(filePath),
        extension: await extname(filePath),
        timestamp: Date.now()
      };

      // Get file stats
      if (includeStats) {
        try {
          const fileStats = await stat(filePath);
          metadata.size = fileStats.size;

          // Convert timestamps to milliseconds if needed (Tauri might return seconds)
          const parseTimestamp = (timestamp) => {
            if (!timestamp) return null;
            // If timestamp is in seconds (less than a reasonable millisecond timestamp)
            // multiply by 1000 to convert to milliseconds
            const ts = typeof timestamp === 'number' ? timestamp : timestamp.secs || timestamp;
            const multiplier = ts < 10000000000 ? 1000 : 1;
            return new Date(ts * multiplier);
          };

          metadata.created = parseTimestamp(fileStats.birthtime || fileStats.createdAt || fileStats.created);
          metadata.modified = parseTimestamp(fileStats.mtime || fileStats.modifiedAt || fileStats.modified);
          metadata.accessed = parseTimestamp(fileStats.atime || fileStats.accessedAt || fileStats.accessed);
          metadata.isDirectory = fileStats.isDirectory;
          metadata.isFile = fileStats.isFile;

          // Calculate human-readable size
          metadata.sizeHuman = this.formatFileSize(fileStats.size);
        } catch (error) {
          metadata.size = 0;
          metadata.sizeHuman = '0 B';
        }
      }

      // Read content for text files
      if (this.isTextFile(filePath)) {
        try {
          const content = await readTextFile(filePath);
          metadata.encoding = 'utf-8';
          metadata.lineCount = content.split('\n').length;
          metadata.characterCount = content.length;
          metadata.wordCount = this.countWords(content);

          if (includeContent) {
            metadata.content = content;
            metadata.preview = content.length > contentPreviewLength
              ? content.substring(0, contentPreviewLength) + '...'
              : content;
          } else {
            metadata.preview = content.length > contentPreviewLength
              ? content.substring(0, contentPreviewLength) + '...'
              : content;
          }

          // Extract markdown-specific metadata
          if (this.isMarkdownFile(filePath)) {
            metadata.markdownMetadata = this.extractMarkdownMetadata(content);

            if (includeLinks) {
              metadata.links = this.extractLinks(content, filePath);
              this.updateLinkIndexes(filePath, metadata.links);
            }
          }
        } catch (error) {
          metadata.encoding = 'unknown';
          metadata.lineCount = 0;
          metadata.characterCount = 0;
          metadata.wordCount = 0;
        }
      } else {
        // Handle binary files
        metadata.encoding = 'binary';
        metadata.isBinary = true;

        // Special handling for images
        if (this.isImageFile(filePath)) {
          metadata.mediaType = 'image';
          // In a real implementation, you might extract image dimensions
          metadata.imageMetadata = await this.extractImageMetadata(filePath);
        }
      }

      // Calculate file hash for change detection
      try {
        metadata.hash = await this.calculateFileHash(filePath);
      } catch (error) {
        metadata.hash = null;
      }

      // Add computed properties
      metadata.age = metadata.modified ? Date.now() - metadata.modified.getTime() : null;
      metadata.ageHuman = metadata.age ? this.formatTimeAgo(metadata.age) : null;

      // Cache the result
      this.cache.set(filePath, metadata);

      this.emitChange({
        type: 'metadata_extracted',
        filePath,
        metadata
      });

      return metadata;

    } catch (error) {
      return this.getDefaultMetadata(filePath);
    }
  }

  /**
   * Extract markdown-specific metadata
   * @private
   */
  extractMarkdownMetadata(content) {
    const metadata = {
      hasYamlFrontmatter: false,
      headings: [],
      taskCount: 0,
      completedTaskCount: 0,
      codeBlockCount: 0,
      mathBlockCount: 0,
      tableCount: 0
    };

    // Check for YAML frontmatter
    if (content.startsWith('---\n')) {
      const endMatch = content.indexOf('\n---\n');
      if (endMatch > -1) {
        metadata.hasYamlFrontmatter = true;
        metadata.frontmatterLength = endMatch + 5; // Include delimiters
      }
    }

    // Extract headings
    const headingMatches = content.matchAll(/^(#{1,6})\s+(.+)$/gm);
    for (const match of headingMatches) {
      metadata.headings.push({
        level: match[1].length,
        text: match[2].trim(),
        line: content.substring(0, match.index).split('\n').length
      });
    }

    // Count tasks
    const taskMatches = content.matchAll(/^[\s]*- \[([x\s])\]/gm);
    for (const match of taskMatches) {
      metadata.taskCount++;
      if (match[1] === 'x') {
        metadata.completedTaskCount++;
      }
    }

    // Count code blocks
    const codeBlockMatches = content.matchAll(/```[\s\S]*?```/g);
    metadata.codeBlockCount = Array.from(codeBlockMatches).length;

    // Count math blocks
    const mathBlockMatches = content.matchAll(/\$\$[\s\S]*?\$\$/g);
    metadata.mathBlockCount = Array.from(mathBlockMatches).length;

    // Count tables
    const tableMatches = content.matchAll(/^\|.+\|$/gm);
    if (tableMatches) {
      // Group consecutive table rows
      const tableRows = Array.from(tableMatches);
      let currentTable = [];
      let tableCount = 0;

      for (let i = 0; i < tableRows.length; i++) {
        const currentLine = content.substring(0, tableRows[i].index).split('\n').length;
        const nextLine = i < tableRows.length - 1
          ? content.substring(0, tableRows[i + 1].index).split('\n').length
          : -1;

        currentTable.push(currentLine);

        if (nextLine === -1 || nextLine > currentLine + 1) {
          if (currentTable.length >= 2) { // At least header + separator
            tableCount++;
          }
          currentTable = [];
        }
      }

      metadata.tableCount = tableCount;
    }

    return metadata;
  }

  /**
   * Extract links from markdown content
   * @private
   */
  extractLinks(content, sourcePath) {
    const links = {
      wikiLinks: [],
      markdownLinks: [],
      all: []
    };

    // Extract wiki links [[link]]
    const wikiLinkMatches = content.matchAll(this.wikiLinkPattern);
    for (const match of wikiLinkMatches) {
      const linkText = match[1].trim();
      const link = {
        type: 'wiki',
        text: linkText,
        target: linkText,
        position: match.index,
        raw: match[0]
      };
      links.wikiLinks.push(link);
      links.all.push(link);
    }

    // Extract markdown links [text](url)
    const markdownLinkMatches = content.matchAll(this.markdownLinkPattern);
    for (const match of markdownLinkMatches) {
      const linkText = match[1].trim();
      const linkUrl = match[2].trim();
      const link = {
        type: 'markdown',
        text: linkText,
        target: linkUrl,
        position: match.index,
        raw: match[0],
        isExternal: this.isExternalLink(linkUrl),
        isRelative: this.isRelativeLink(linkUrl)
      };
      links.markdownLinks.push(link);
      links.all.push(link);
    }

    // Sort all links by position
    links.all.sort((a, b) => a.position - b.position);

    return links;
  }

  /**
   * Update link indexes for backlink tracking
   * @private
   */
  updateLinkIndexes(sourcePath, links) {
    // Clear old links for this file
    const oldLinks = this.linkIndex.get(sourcePath) || new Set();
    for (const oldTarget of oldLinks) {
      const backlinks = this.backlinkIndex.get(oldTarget);
      if (backlinks) {
        backlinks.delete(sourcePath);
        if (backlinks.size === 0) {
          this.backlinkIndex.delete(oldTarget);
        }
      }
    }

    // Add new links
    const newLinks = new Set();
    for (const link of links.all) {
      if (link.type === 'wiki' || (link.type === 'markdown' && !link.isExternal)) {
        const target = this.resolveLink(link.target, sourcePath);
        newLinks.add(target);

        // Update backlinks
        if (!this.backlinkIndex.has(target)) {
          this.backlinkIndex.set(target, new Set());
        }
        this.backlinkIndex.get(target).add(sourcePath);
      }
    }

    this.linkIndex.set(sourcePath, newLinks);
  }

  /**
   * Resolve a link target to a file path
   * @private
   */
  resolveLink(target, sourcePath) {
    // For wiki links, assume they refer to files in the same workspace
    if (!target.includes('/') && !target.includes('\\')) {
      // Simple filename - search in workspace
      return target.endsWith('.md') ? target : target + '.md';
    }

    // For relative paths, resolve relative to source file
    if (this.isRelativeLink(target)) {
      const sourceDir = getDirname(normalizePath(sourcePath));
      return joinPath(sourceDir, target);
    }

    return normalizePath(target);
  }

  /**
   * Check if a link is external
   * @private
   */
  isExternalLink(url) {
    return /^https?:\/\//.test(url) || /^ftp:\/\//.test(url);
  }

  /**
   * Check if a link is relative
   * @private
   */
  isRelativeLink(url) {
    return !this.isExternalLink(url) && !url.startsWith('/');
  }

  /**
   * Extract image metadata (placeholder implementation)
   * @private
   */
  async extractImageMetadata(filePath) {
    // In a real implementation, you might use a library to extract
    // image dimensions, EXIF data, etc.
    const extension = (await extname(filePath)).toLowerCase();
    return {
      format: extension.substring(1), // Remove the dot
      hasExif: ['.jpg', '.jpeg', '.tiff'].includes(extension)
    };
  }

  /**
   * Calculate file hash for change detection
   * @private
   */
  async calculateFileHash(filePath) {
    try {
      // Use Tauri's built-in hashing if available, or implement simple hash
      // For now, we'll use a simple implementation
      const content = await readTextFile(filePath);
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      return hash.toString(16);
    } catch (error) {
      // For binary files or errors, return null
      return null;
    }
  }

  /**
   * Check if file is a text file
   * @private
   */
  isTextFile(filePath) {
    const textExtensions = [
      '.md', '.markdown', '.txt', '.text', '.rtf',
      '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss',
      '.json', '.yaml', '.yml', '.xml', '.csv',
      '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
      '.sh', '.bash', '.zsh', '.fish', '.ps1',
      '.sql', '.log', '.ini', '.cfg', '.conf'
    ];

    return textExtensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()));
  }

  /**
   * Check if file is a markdown file
   * @private
   */
  isMarkdownFile(filePath) {
    const markdownExtensions = ['.md', '.markdown', '.mdown', '.mkd', '.mkdown'];
    return markdownExtensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()));
  }

  /**
   * Check if file is an image file
   * @private
   */
  isImageFile(filePath) {
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.svg', '.webp', '.tiff', '.ico'];
    return imageExtensions.some(ext => filePath.toLowerCase().endsWith(ext.toLowerCase()));
  }

  /**
   * Count words in text
   * @private
   */
  countWords(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Remove markdown syntax and count words
    const cleanText = text
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .replace(/`[^`]+`/g, '') // Remove inline code
      .replace(/\$\$[\s\S]*?\$\$/g, '') // Remove math blocks
      .replace(/\$[^$]+\$/g, '') // Remove inline math
      .replace(/\[[^\]]+\]\([^)]+\)/g, '') // Remove markdown links
      .replace(/\[\[[^\]]+\]\]/g, '') // Remove wiki links
      .replace(/[#*_~=`]/g, ' ') // Remove markdown formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    if (!cleanText) return 0;

    return cleanText.split(' ').filter(word => word.length > 0).length;
  }

  /**
   * Format file size in human-readable format
   * @private
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';

    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);

    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  /**
   * Format time ago in human-readable format
   * @private
   */
  formatTimeAgo(milliseconds) {
    const seconds = Math.floor(milliseconds / 1000);

    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

    const months = Math.floor(days / 30);
    if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

    const years = Math.floor(months / 12);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }

  /**
   * Get default metadata for a file
   * @private
   */
  getDefaultMetadata(filePath) {
    const normalizedPath = normalizePath(filePath);
    return {
      path: normalizedPath,
      name: getFilename(normalizedPath) || filePath,
      directory: getDirname(normalizedPath) || '/',
      extension: filePath.includes('.') ? '.' + getFilename(normalizedPath).split('.').pop() : '',
      size: 0,
      sizeHuman: '0 B',
      created: null,
      modified: null,
      accessed: null,
      encoding: 'unknown',
      timestamp: Date.now(),
      error: 'Failed to extract metadata'
    };
  }

  /**
   * Get file metadata with caching
   * @param {string} filePath - File path
   * @param {Object} options - Options
   * @returns {Promise<Object>} File metadata
   */
  async getMetadata(filePath, options = {}) {
    return this.extractMetadata(filePath, options);
  }

  /**
   * Get metadata for multiple files
   * @param {Array} filePaths - Array of file paths
   * @param {Object} options - Options
   * @returns {Promise<Map>} Map of filePath -> metadata
   */
  async getMultipleMetadata(filePaths, options = {}) {
    const results = new Map();
    const { batchSize = 10 } = options;

    // Process files in batches
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      const batchPromises = batch.map(async filePath => {
        const metadata = await this.getMetadata(filePath, options);
        return { filePath, metadata };
      });

      const batchResults = await Promise.all(batchPromises);
      batchResults.forEach(({ filePath, metadata }) => {
        results.set(filePath, metadata);
      });
    }

    return results;
  }

  /**
   * Get backlinks for a file
   * @param {string} filePath - File path to get backlinks for
   * @returns {Array} Array of file paths that link to this file
   */
  getBacklinks(filePath) {
    const backlinks = this.backlinkIndex.get(filePath);
    return backlinks ? Array.from(backlinks) : [];
  }

  /**
   * Get outgoing links for a file
   * @param {string} filePath - File path to get links from
   * @returns {Array} Array of target file paths
   */
  getOutgoingLinks(filePath) {
    const links = this.linkIndex.get(filePath);
    return links ? Array.from(links) : [];
  }

  /**
   * Get all files that link to or from a file
   * @param {string} filePath - File path
   * @returns {Object} Object with incoming and outgoing links
   */
  getRelatedFiles(filePath) {
    return {
      backlinks: this.getBacklinks(filePath),
      outgoingLinks: this.getOutgoingLinks(filePath)
    };
  }

  /**
   * Find broken links across all files
   * @param {Array} allFilePaths - Array of all valid file paths
   * @returns {Array} Array of broken link objects
   */
  findBrokenLinks(allFilePaths) {
    const brokenLinks = [];
    const validFiles = new Set(allFilePaths);

    for (const [sourcePath, targets] of this.linkIndex) {
      for (const target of targets) {
        if (!validFiles.has(target) && !this.isExternalLink(target)) {
          brokenLinks.push({
            source: sourcePath,
            target: target,
            type: 'broken_link'
          });
        }
      }
    }

    return brokenLinks;
  }

  /**
   * Get file-based properties for filtering
   * @param {string} filePath - File path
   * @returns {Object} File properties for filtering
   */
  getFileProperties(filePath) {
    const metadata = this.cache.get(filePath);
    if (!metadata) return {};

    return {
      // Basic file properties
      name: metadata.name,
      extension: metadata.extension,
      size: metadata.size,
      sizeHuman: metadata.sizeHuman,
      created: metadata.created,
      modified: metadata.modified,
      age: metadata.age,

      // Content properties
      lineCount: metadata.lineCount || 0,
      wordCount: metadata.wordCount || 0,
      characterCount: metadata.characterCount || 0,

      // Markdown properties
      headingCount: metadata.markdownMetadata?.headings?.length || 0,
      taskCount: metadata.markdownMetadata?.taskCount || 0,
      completedTaskCount: metadata.markdownMetadata?.completedTaskCount || 0,
      hasYamlFrontmatter: metadata.markdownMetadata?.hasYamlFrontmatter || false,

      // Link properties
      backlinkCount: this.getBacklinks(filePath).length,
      outgoingLinkCount: this.getOutgoingLinks(filePath).length,

      // Type flags
      isMarkdown: this.isMarkdownFile(filePath),
      isImage: this.isImageFile(filePath),
      isText: this.isTextFile(filePath)
    };
  }

  /**
   * Clear metadata cache
   * @param {string} [filePath] - Specific file to clear, or all if not provided
   */
  clearCache(filePath) {
    if (filePath) {
      this.cache.delete(filePath);
      this.linkIndex.delete(filePath);

      // Remove from backlinks
      for (const [target, backlinks] of this.backlinkIndex) {
        if (backlinks.has(filePath)) {
          backlinks.delete(filePath);
          if (backlinks.size === 0) {
            this.backlinkIndex.delete(target);
          }
        }
      }
    } else {
      this.cache.clear();
      this.linkIndex.clear();
      this.backlinkIndex.clear();
    }
  }

  /**
   * Add change event listener
   * @param {Function} callback - Callback function
   */
  onChange(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove change event listener
   * @param {Function} callback - Callback function
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Emit change event
   * @private
   */
  emitChange(event) {
    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch { }
    }
  }

  /**
   * Get statistics about cached metadata
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      cachedFiles: this.cache.size,
      totalLinks: Array.from(this.linkIndex.values()).reduce((sum, links) => sum + links.size, 0),
      totalBacklinks: Array.from(this.backlinkIndex.values()).reduce((sum, backlinks) => sum + backlinks.size, 0),
      averageLinksPerFile: 0,
      averageBacklinksPerFile: 0
    };

    if (stats.cachedFiles > 0) {
      stats.averageLinksPerFile = stats.totalLinks / stats.cachedFiles;
      stats.averageBacklinksPerFile = stats.totalBacklinks / stats.cachedFiles;
    }

    return stats;
  }

  /**
   * Dispose of resources
   */
  dispose() {
    this.clearCache();
    this.listeners.clear();
  }
}

export default FileMetadata;