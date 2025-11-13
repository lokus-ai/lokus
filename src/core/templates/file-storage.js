/**
 * File-Based Template Storage
 *
 * Stores templates as individual .md files with frontmatter
 * Templates directory: /Users/pratham/Desktop/My Knowledge Base/templates/
 */

import { readTextFile, writeTextFile, readDir, exists, mkdir, remove } from '@tauri-apps/plugin-fs';

export class FileBasedTemplateStorage {
  constructor(options = {}) {
    // Use absolute path for templates directory
    this.templateDir = options.templateDir || '/Users/pratham/Desktop/My Knowledge Base/templates';
    this.cache = new Map(); // In-memory cache for performance
    this.initialized = false;
  }

  /**
   * Initialize storage system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure templates directory exists
      await this.ensureTemplateDir();

      // Load existing templates from files
      await this.load();

      this.initialized = true;
    } catch (error) {
      console.error('[FileStorage] Initialization error:', error);
      throw new Error(`Storage initialization failed: ${error.message}`);
    }
  }

  /**
   * Save a single template as .md file
   */
  async saveTemplate(template) {
    try {
      console.log('[FileStorage] Saving template:', template.id, template.name);

      // Validate template
      if (!template.id) {
        throw new Error('Template ID is required');
      }
      if (!template.name) {
        throw new Error('Template name is required');
      }

      const filename = this.generateFilename(template.id);
      const filepath = `${this.templateDir}/${filename}`;

      console.log('[FileStorage] Target file path:', filepath);

      // Ensure directory exists before writing
      const dirExists = await exists(this.templateDir);
      if (!dirExists) {
        console.log('[FileStorage] Template directory does not exist, creating...');
        await this.ensureTemplateDir();
      }

      // Create frontmatter
      const frontmatter = this.createFrontmatter(template);

      // Combine frontmatter and content
      const fileContent = `---\n${frontmatter}---\n\n${template.content || ''}`;

      console.log('[FileStorage] Writing file, content length:', fileContent.length);

      // Write to file
      await writeTextFile(filepath, fileContent);

      // Verify file was written
      const fileExists = await exists(filepath);
      if (!fileExists) {
        throw new Error('File write succeeded but file does not exist');
      }

      console.log('[FileStorage] File written successfully:', filepath);

      // Update cache
      this.cache.set(template.id, template);
      console.log('[FileStorage] Cache updated, total templates:', this.cache.size);

      return {
        success: true,
        filepath,
        id: template.id
      };
    } catch (error) {
      console.error('[FileStorage] Save error for template:', template?.id, template?.name);
      console.error('[FileStorage] Error details:', error);
      console.error('[FileStorage] Error message:', error.message);
      console.error('[FileStorage] Stack trace:', error.stack);
      throw new Error(`Failed to save template "${template?.name || template?.id}": ${error.message}`);
    }
  }

  /**
   * Save all templates (legacy compatibility)
   */
  async save(templates) {
    try {
      const templatesArray = templates instanceof Map
        ? Array.from(templates.values())
        : Object.values(templates);

      const results = [];
      for (const template of templatesArray) {
        const result = await this.saveTemplate(template);
        results.push(result);
      }

      // Update cache
      this.cache = templates instanceof Map ? templates : new Map(Object.entries(templates));

      return {
        success: true,
        count: results.length,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to save templates: ${error.message}`);
    }
  }

  /**
   * Load all templates from .md files
   */
  async load() {
    try {
      // Ensure directory exists
      const dirExists = await exists(this.templateDir);
      if (!dirExists) {
        await this.ensureTemplateDir();
        this.cache = new Map();
        return {
          success: true,
          count: 0,
          templates: new Map()
        };
      }

      // Read all files in templates directory
      const entries = await readDir(this.templateDir);

      const templatesMap = new Map();

      for (const entry of entries) {
        // Only process .md files
        if (!entry.name.endsWith('.md') || !entry.isFile) {
          continue;
        }

        try {
          const filepath = `${this.templateDir}/${entry.name}`;
          const content = await readTextFile(filepath);

          // Parse frontmatter and content
          const template = this.parseTemplate(content, entry.name);

          if (template && template.id) {
            templatesMap.set(template.id, template);
          }
        } catch (error) {
          console.error(`[FileStorage] Error loading ${entry.name}:`, error);
          // Continue loading other templates
        }
      }

      // Update cache
      this.cache = templatesMap;

      return {
        success: true,
        count: templatesMap.size,
        templates: templatesMap
      };
    } catch (error) {
      console.error('[FileStorage] Load error:', error);

      // If directory doesn't exist, return empty
      if (error.message.includes('No such file') || error.message.includes('not found')) {
        this.cache = new Map();
        return {
          success: true,
          count: 0,
          templates: new Map()
        };
      }

      throw new Error(`Failed to load templates: ${error.message}`);
    }
  }

  /**
   * Delete a template file
   */
  async deleteTemplate(id) {
    try {
      const filename = this.generateFilename(id);
      const filepath = `${this.templateDir}/${filename}`;

      // Check if file exists
      const fileExists = await exists(filepath);

      if (fileExists) {
        await remove(filepath);
      }

      // Remove from cache
      const removed = this.cache.delete(id);

      return {
        success: true,
        removed,
        filepath
      };
    } catch (error) {
      console.error('[FileStorage] Delete error:', error);
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }

  /**
   * Get cached templates
   */
  getCache() {
    return this.cache;
  }

  /**
   * Check if storage has been initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Refresh templates from file system (re-scan directory)
   */
  async refresh() {
    return await this.load();
  }

  /**
   * Get storage statistics
   */
  async getStatistics() {
    try {
      return {
        templates: this.cache.size,
        initialized: this.initialized,
        templateDir: this.templateDir
      };
    } catch (error) {
      return {
        templates: this.cache.size,
        initialized: this.initialized,
        error: error.message
      };
    }
  }

  // Private helper methods

  /**
   * Ensure templates directory exists
   */
  async ensureTemplateDir() {
    try {
      const dirExists = await exists(this.templateDir);
      if (!dirExists) {
        await mkdir(this.templateDir, { recursive: true });
      }
    } catch (error) {
      console.error('[FileStorage] Error creating directory:', error);
      // Directory might already exist, or we need to create parent dirs
      throw error;
    }
  }

  /**
   * Generate filename from template ID
   */
  generateFilename(id) {
    // Ensure safe filename
    const safeName = id.replace(/[^a-z0-9-_]/gi, '-');
    return `${safeName}.md`;
  }

  /**
   * Create YAML frontmatter from template metadata
   */
  createFrontmatter(template) {
    const metadata = {
      id: template.id,
      name: template.name,
      category: template.category || 'Personal',
      tags: template.tags || [],
      createdAt: template.metadata?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Convert to YAML format (simple key: value)
    let yaml = '';
    yaml += `id: ${metadata.id}\n`;
    yaml += `name: "${metadata.name}"\n`;
    yaml += `category: ${metadata.category}\n`;

    if (metadata.tags.length > 0) {
      yaml += `tags:\n`;
      metadata.tags.forEach(tag => {
        yaml += `  - ${tag}\n`;
      });
    } else {
      yaml += `tags: []\n`;
    }

    yaml += `createdAt: ${metadata.createdAt}\n`;
    yaml += `updatedAt: ${metadata.updatedAt}\n`;

    return yaml;
  }

  /**
   * Parse template from .md file content
   */
  parseTemplate(content, filename) {
    try {
      // Extract frontmatter
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      if (!match) {
        // No frontmatter, treat entire content as template
        // Generate ID from filename
        const id = filename.replace('.md', '');
        return {
          id,
          name: id,
          content: content.trim(),
          category: 'Personal',
          tags: [],
          metadata: {
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };
      }

      const frontmatterText = match[1];
      const templateContent = match[2].trim();

      // Parse frontmatter (simple YAML parser)
      const metadata = this.parseFrontmatter(frontmatterText);

      return {
        id: metadata.id || filename.replace('.md', ''),
        name: metadata.name || metadata.id || filename.replace('.md', ''),
        content: templateContent,
        category: metadata.category || 'Personal',
        tags: metadata.tags || [],
        metadata: {
          createdAt: metadata.createdAt || new Date().toISOString(),
          updatedAt: metadata.updatedAt || new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('[FileStorage] Parse error:', error);
      return null;
    }
  }

  /**
   * Simple YAML frontmatter parser
   */
  parseFrontmatter(text) {
    const lines = text.split('\n');
    const metadata = {};
    let currentKey = null;
    let currentArray = [];

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) continue;

      // Array item
      if (trimmed.startsWith('- ')) {
        if (currentKey) {
          currentArray.push(trimmed.substring(2).trim());
        }
        continue;
      }

      // Save previous array
      if (currentKey && currentArray.length > 0) {
        metadata[currentKey] = currentArray;
        currentArray = [];
        currentKey = null;
      }

      // Key-value pair
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > -1) {
        const key = trimmed.substring(0, colonIndex).trim();
        let value = trimmed.substring(colonIndex + 1).trim();

        // Remove quotes if present
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        }

        // Empty array
        if (value === '[]') {
          metadata[key] = [];
        }
        // Start of array
        else if (!value) {
          currentKey = key;
          currentArray = [];
        }
        // Simple value
        else {
          metadata[key] = value;
        }
      }
    }

    // Save last array if exists
    if (currentKey && currentArray.length > 0) {
      metadata[currentKey] = currentArray;
    }

    return metadata;
  }
}

export default FileBasedTemplateStorage;
