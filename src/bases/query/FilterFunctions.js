/**
 * Filter Functions for Lokus Bases
 * Built-in filter functions for querying note collections
 */

/**
 * Built-in filter functions implementation
 */
class BaseFilterFunctions {
  constructor() {
    this.functions = new Map();
    this.registerBuiltinFunctions();
  }

  /**
   * Register all built-in filter functions
   */
  registerBuiltinFunctions() {
    // File metadata functions
    this.register('taggedWith', this.taggedWith.bind(this), {
      description: 'Check if file has a specific tag',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'tag', type: 'string', description: 'Tag to check for' }
      ]
    });

    this.register('inFolder', this.inFolder.bind(this), {
      description: 'Check if file is in a specific folder path',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'path', type: 'string', description: 'Folder path to check' }
      ]
    });

    this.register('hasLink', this.hasLink.bind(this), {
      description: 'Check if file contains a link to target',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'target', type: 'string', description: 'Link target to check for' }
      ]
    });

    this.register('linksTo', this.linksTo.bind(this), {
      description: 'Check if file links to target (alias for hasLink)',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'target', type: 'string', description: 'Link target to check for' }
      ]
    });

    // Content analysis functions
    this.register('hasProperty', this.hasProperty.bind(this), {
      description: 'Check if file has a specific property',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'property', type: 'string', description: 'Property name' }
      ]
    });

    this.register('isEmpty', this.isEmpty.bind(this), {
      description: 'Check if file content is empty',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' }
      ]
    });

    this.register('hasContent', this.hasContent.bind(this), {
      description: 'Check if file contains specific content',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'content', type: 'string', description: 'Content to search for' }
      ]
    });

    this.register('wordCount', this.wordCount.bind(this), {
      description: 'Get word count of file content',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' }
      ]
    });

    // Date and time functions
    this.register('createdAfter', this.createdAfter.bind(this), {
      description: 'Check if file was created after a specific date',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'date', type: 'string|Date', description: 'Date to compare against' }
      ]
    });

    this.register('createdBefore', this.createdBefore.bind(this), {
      description: 'Check if file was created before a specific date',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'date', type: 'string|Date', description: 'Date to compare against' }
      ]
    });

    this.register('modifiedAfter', this.modifiedAfter.bind(this), {
      description: 'Check if file was modified after a specific date',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'date', type: 'string|Date', description: 'Date to compare against' }
      ]
    });

    this.register('modifiedBefore', this.modifiedBefore.bind(this), {
      description: 'Check if file was modified before a specific date',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'date', type: 'string|Date', description: 'Date to compare against' }
      ]
    });

    this.register('isToday', this.isToday.bind(this), {
      description: 'Check if file was created or modified today',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'field', type: 'string', description: 'Field to check (created, modified)', optional: true }
      ]
    });

    this.register('isThisWeek', this.isThisWeek.bind(this), {
      description: 'Check if file was created or modified this week',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'field', type: 'string', description: 'Field to check (created, modified)', optional: true }
      ]
    });

    // File type functions
    this.register('isMarkdown', this.isMarkdown.bind(this), {
      description: 'Check if file is a markdown file',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' }
      ]
    });

    this.register('hasExtension', this.hasExtension.bind(this), {
      description: 'Check if file has a specific extension',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'extension', type: 'string', description: 'File extension to check' }
      ]
    });

    // Size and metadata functions
    this.register('largerThan', this.largerThan.bind(this), {
      description: 'Check if file size is larger than specified bytes',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'size', type: 'number', description: 'Size in bytes' }
      ]
    });

    this.register('smallerThan', this.smallerThan.bind(this), {
      description: 'Check if file size is smaller than specified bytes',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'size', type: 'number', description: 'Size in bytes' }
      ]
    });

    // Collection functions
    this.register('hasAnyTag', this.hasAnyTag.bind(this), {
      description: 'Check if file has any of the specified tags',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'tags', type: 'array', description: 'Array of tags to check' }
      ]
    });

    this.register('hasAllTags', this.hasAllTags.bind(this), {
      description: 'Check if file has all of the specified tags',
      arguments: [
        { name: 'file', type: 'object', description: 'File object' },
        { name: 'tags', type: 'array', description: 'Array of tags to check' }
      ]
    });
  }

  // Built-in function implementations

  /**
   * Check if file has a specific tag
   */
  taggedWith(file, tag) {
    if (!file || !tag) return false;

    const tags = this.getFileTags(file);
    return tags.includes(String(tag).toLowerCase());
  }

  /**
   * Check if file is in a specific folder
   */
  inFolder(file, folderPath) {
    if (!file || !folderPath) return false;

    const filePath = this.getFilePath(file);
    const normalizedPath = String(folderPath).replace(/\\/g, '/').toLowerCase();

    return filePath.startsWith(normalizedPath + '/') || filePath === normalizedPath;
  }

  /**
   * Check if file has a link to target
   */
  hasLink(file, target) {
    if (!file || !target) return false;

    const content = this.getFileContent(file);
    const targetStr = String(target);

    // Check for wiki links [[target]]
    const wikiLinkPattern = new RegExp(`\\[\\[\\s*${this.escapeRegex(targetStr)}\\s*\\]\\]`, 'i');
    if (wikiLinkPattern.test(content)) return true;

    // Check for markdown links [text](target)
    const markdownLinkPattern = new RegExp(`\\]\\(\\s*${this.escapeRegex(targetStr)}\\s*\\)`, 'i');
    if (markdownLinkPattern.test(content)) return true;

    // Check for plain URLs
    if (content.toLowerCase().includes(targetStr.toLowerCase())) return true;

    return false;
  }

  /**
   * Alias for hasLink
   */
  linksTo(file, target) {
    return this.hasLink(file, target);
  }

  /**
   * Check if file has a specific property
   */
  hasProperty(file, property) {
    if (!file || !property) return false;

    return property in file && file[property] != null;
  }

  /**
   * Check if file content is empty
   */
  isEmpty(file) {
    if (!file) return true;

    const content = this.getFileContent(file);
    return !content || content.trim().length === 0;
  }

  /**
   * Check if file contains specific content
   */
  hasContent(file, searchContent) {
    if (!file || !searchContent) return false;

    const content = this.getFileContent(file);
    return content.toLowerCase().includes(String(searchContent).toLowerCase());
  }

  /**
   * Get word count of file content
   */
  wordCount(file) {
    if (!file) return 0;

    const content = this.getFileContent(file);
    if (!content) return 0;

    // Remove markdown syntax and count words
    const cleanContent = content
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove links
      .replace(/#+\s/g, '') // Remove headers
      .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold
      .replace(/\*([^*]+)\*/g, '$1') // Remove italic
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/```[\s\S]*?```/g, '') // Remove code blocks
      .trim();

    if (!cleanContent) return 0;

    return cleanContent.split(/\s+/).filter(word => word.length > 0).length;
  }

  /**
   * Check if file was created after a specific date
   */
  createdAfter(file, date) {
    if (!file) return false;

    const createdDate = this.getFileDate(file, 'created');
    const compareDate = new Date(date);

    return createdDate && compareDate && createdDate > compareDate;
  }

  /**
   * Check if file was created before a specific date
   */
  createdBefore(file, date) {
    if (!file) return false;

    const createdDate = this.getFileDate(file, 'created');
    const compareDate = new Date(date);

    return createdDate && compareDate && createdDate < compareDate;
  }

  /**
   * Check if file was modified after a specific date
   */
  modifiedAfter(file, date) {
    if (!file) return false;

    const modifiedDate = this.getFileDate(file, 'modified');
    const compareDate = new Date(date);

    return modifiedDate && compareDate && modifiedDate > compareDate;
  }

  /**
   * Check if file was modified before a specific date
   */
  modifiedBefore(file, date) {
    if (!file) return false;

    const modifiedDate = this.getFileDate(file, 'modified');
    const compareDate = new Date(date);

    return modifiedDate && compareDate && modifiedDate < compareDate;
  }

  /**
   * Check if file was created or modified today
   */
  isToday(file, field = 'modified') {
    if (!file) return false;

    const fileDate = this.getFileDate(file, field);
    if (!fileDate) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return fileDate >= today && fileDate < tomorrow;
  }

  /**
   * Check if file was created or modified this week
   */
  isThisWeek(file, field = 'modified') {
    if (!file) return false;

    const fileDate = this.getFileDate(file, field);
    if (!fileDate) return false;

    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return fileDate >= startOfWeek && fileDate < endOfWeek;
  }

  /**
   * Check if file is a markdown file
   */
  isMarkdown(file) {
    if (!file) return false;

    const path = this.getFilePath(file);
    return /\.(md|markdown)$/i.test(path);
  }

  /**
   * Check if file has a specific extension
   */
  hasExtension(file, extension) {
    if (!file || !extension) return false;

    const path = this.getFilePath(file);
    const ext = String(extension).toLowerCase();
    const normalizedExt = ext.startsWith('.') ? ext : '.' + ext;

    return path.toLowerCase().endsWith(normalizedExt);
  }

  /**
   * Check if file size is larger than specified
   */
  largerThan(file, size) {
    if (!file || size == null) return false;

    const fileSize = this.getFileSize(file);
    return fileSize > Number(size);
  }

  /**
   * Check if file size is smaller than specified
   */
  smallerThan(file, size) {
    if (!file || size == null) return false;

    const fileSize = this.getFileSize(file);
    return fileSize < Number(size);
  }

  /**
   * Check if file has any of the specified tags
   */
  hasAnyTag(file, tags) {
    if (!file || !Array.isArray(tags)) return false;

    const fileTags = this.getFileTags(file);
    const targetTags = tags.map(tag => String(tag).toLowerCase());

    return targetTags.some(tag => fileTags.includes(tag));
  }

  /**
   * Check if file has all of the specified tags
   */
  hasAllTags(file, tags) {
    if (!file || !Array.isArray(tags)) return false;

    const fileTags = this.getFileTags(file);
    const targetTags = tags.map(tag => String(tag).toLowerCase());

    return targetTags.every(tag => fileTags.includes(tag));
  }

  // Utility methods

  /**
   * Get file tags as normalized array
   */
  getFileTags(file) {
    if (!file) return [];

    let tags = [];

    // Check multiple possible tag properties
    if (Array.isArray(file.tags)) {
      tags = file.tags;
    } else if (typeof file.tags === 'string') {
      tags = file.tags.split(',').map(tag => tag.trim());
    } else if (file.metadata && Array.isArray(file.metadata.tags)) {
      tags = file.metadata.tags;
    } else if (file.frontmatter && Array.isArray(file.frontmatter.tags)) {
      tags = file.frontmatter.tags;
    }

    return tags.map(tag => String(tag).toLowerCase()).filter(tag => tag.length > 0);
  }

  /**
   * Get file path with normalization
   */
  getFilePath(file) {
    if (!file) return '';

    const path = file.path || file.filePath || file.name || '';
    return String(path).replace(/\\/g, '/').toLowerCase();
  }

  /**
   * Get file content
   */
  getFileContent(file) {
    if (!file) return '';

    return String(file.content || file.body || file.text || '');
  }

  /**
   * Get file date
   */
  getFileDate(file, field) {
    if (!file) return null;

    const dateValue = file[field] ||
                     (file.metadata && file.metadata[field]) ||
                     (file.frontmatter && file.frontmatter[field]);

    if (!dateValue) return null;

    const date = new Date(dateValue);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Get file size
   */
  getFileSize(file) {
    if (!file) return 0;

    if (typeof file.size === 'number') {
      return file.size;
    }

    if (file.stats && typeof file.stats.size === 'number') {
      return file.stats.size;
    }

    // Estimate size from content
    const content = this.getFileContent(file);
    return new Blob([content]).size;
  }

  /**
   * Escape string for regex
   */
  escapeRegex(str) {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Function registration and management

  /**
   * Register a new filter function
   */
  register(name, fn, metadata = {}) {
    if (typeof name !== 'string' || !name) {
      throw new Error('Function name must be a non-empty string');
    }

    if (typeof fn !== 'function') {
      throw new Error('Function must be callable');
    }

    this.functions.set(name, {
      fn,
      metadata: {
        name,
        description: metadata.description || '',
        arguments: metadata.arguments || [],
        custom: metadata.custom !== false
      }
    });
  }

  /**
   * Unregister a function
   */
  unregister(name) {
    return this.functions.delete(name);
  }

  /**
   * Check if function exists
   */
  hasFunction(name) {
    return this.functions.has(name);
  }

  /**
   * Call a registered function
   */
  call(name, ...args) {
    const funcData = this.functions.get(name);
    if (!funcData) {
      throw new Error(`Unknown filter function: ${name}`);
    }

    try {
      return funcData.fn(...args);
    } catch (error) {
      throw new Error(`Error calling filter function '${name}': ${error.message}`);
    }
  }

  /**
   * Get all registered function names
   */
  getRegisteredFunctions() {
    return Array.from(this.functions.keys());
  }

  /**
   * Get function metadata
   */
  getFunctionMetadata(name) {
    const funcData = this.functions.get(name);
    return funcData ? funcData.metadata : null;
  }

  /**
   * Get all functions with metadata
   */
  getAllFunctions() {
    const functions = {};
    for (const [name, data] of this.functions.entries()) {
      functions[name] = data.metadata;
    }
    return functions;
  }

  /**
   * Get function documentation
   */
  getDocumentation() {
    const docs = {};

    for (const [name, data] of this.functions.entries()) {
      const meta = data.metadata;
      docs[name] = {
        name: meta.name,
        description: meta.description,
        arguments: meta.arguments,
        custom: meta.custom,
        usage: this.generateUsageExample(meta)
      };
    }

    return docs;
  }

  /**
   * Generate usage example for function
   */
  generateUsageExample(metadata) {
    if (!metadata.arguments || metadata.arguments.length === 0) {
      return `${metadata.name}()`;
    }

    const args = metadata.arguments.map(arg => {
      if (arg.optional) {
        return `[${arg.name}]`;
      }
      return arg.name;
    });

    return `${metadata.name}(${args.join(', ')})`;
  }
}

export { BaseFilterFunctions };
export { BaseFilterFunctions as FilterFunctions };
export default BaseFilterFunctions;