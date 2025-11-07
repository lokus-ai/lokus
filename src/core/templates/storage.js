/**
 * Template Storage
 *
 * File-based template storage system with backup and import/export
 * Uses Tauri's fs plugin for persistent storage in AppData directory
 */

import { BaseDirectory, writeTextFile, readTextFile, exists, mkdir, readDir, remove } from '@tauri-apps/plugin-fs';

export class TemplateStorage {
  constructor(options = {}) {
    this.filename = options.filename || 'templates.json';
    this.dir = options.dir || BaseDirectory.AppData;
    this.backupDir = 'templates-backups';
    this.maxBackups = options.maxBackups || 5;
    this.autoSave = options.autoSave !== false;
    this.cache = new Map(); // In-memory cache for performance
    this.initialized = false;
  }

  /**
   * Initialize storage system
   */
  async initialize() {
    if (this.initialized) return;

    try {
      // Ensure backup directory exists
      await this.ensureBackupDir();

      // Load existing templates
      await this.load();

      this.initialized = true;
    } catch (error) {
      throw new Error(`Storage initialization failed: ${error.message}`);
    }
  }

  /**
   * Save templates to file
   */
  async save(templates) {
    try {
      // Convert Map to array for serialization
      const templatesArray = templates instanceof Map
        ? Array.from(templates.entries())
        : Object.entries(templates);

      const data = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        templates: templatesArray.map(([id, template]) => ({
          ...template,
          id // Ensure ID is included
        })),
        metadata: {
          count: templatesArray.length,
          savedAt: new Date().toISOString()
        }
      };

      // Create backup before saving
      if (await this.fileExists()) {
        await this.backup();
      }

      // Write to file
      const content = JSON.stringify(data, null, 2);
      await writeTextFile(this.filename, content, { baseDir: this.dir });

      // Update cache
      this.cache = new Map(templatesArray);

      return {
        success: true,
        count: templatesArray.length,
        timestamp: data.timestamp
      };
    } catch (error) {
      throw new Error(`Failed to save templates: ${error.message}`);
    }
  }

  /**
   * Load templates from file
   */
  async load() {
    try {
      // Check if file exists
      if (!await this.fileExists()) {
        // Initialize with empty storage
        this.cache = new Map();
        return {
          success: true,
          count: 0,
          templates: new Map()
        };
      }

      // Read file content
      const content = await readTextFile(this.filename, { baseDir: this.dir });
      const data = JSON.parse(content);

      // Validate data structure
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid template data structure');
      }

      // Convert array back to Map
      const templatesMap = new Map(
        data.templates.map(template => [template.id, template])
      );

      // Update cache
      this.cache = templatesMap;

      return {
        success: true,
        count: templatesMap.size,
        templates: templatesMap,
        metadata: data.metadata,
        version: data.version
      };
    } catch (error) {
      if (error.message.includes('No such file')) {
        // File doesn't exist yet, return empty
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
   * Create backup of current templates
   */
  async backup() {
    try {
      if (!await this.fileExists()) {
        return { success: false, reason: 'No file to backup' };
      }

      // Ensure backup directory exists
      await this.ensureBackupDir();

      // Read current content
      const content = await readTextFile(this.filename, { baseDir: this.dir });

      // Generate backup filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilename = `${this.backupDir}/templates-backup-${timestamp}.json`;

      // Write backup
      await writeTextFile(backupFilename, content, { baseDir: this.dir });

      // Clean old backups
      await this.cleanOldBackups();

      return {
        success: true,
        filename: backupFilename,
        timestamp
      };
    } catch (error) {
      throw new Error(`Backup failed: ${error.message}`);
    }
  }

  /**
   * Restore templates from backup
   */
  async restore(backupFilename) {
    try {
      // Read backup file
      const content = await readTextFile(backupFilename, { baseDir: this.dir });
      const data = JSON.parse(content);

      // Validate backup data
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid backup data structure');
      }

      // Create backup of current state before restoring
      if (await this.fileExists()) {
        await this.backup();
      }

      // Write restored content to main file
      await writeTextFile(this.filename, content, { baseDir: this.dir });

      // Reload cache
      await this.load();

      return {
        success: true,
        count: data.templates.length,
        restoredFrom: backupFilename,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Restore failed: ${error.message}`);
    }
  }

  /**
   * List all available backups
   */
  async listBackups() {
    try {
      await this.ensureBackupDir();

      const entries = await readDir(this.backupDir, { baseDir: this.dir });

      const backups = entries
        .filter(entry => entry.name.startsWith('templates-backup-') && entry.name.endsWith('.json'))
        .map(entry => ({
          filename: `${this.backupDir}/${entry.name}`,
          name: entry.name,
          // Extract timestamp from filename
          timestamp: entry.name.replace('templates-backup-', '').replace('.json', '')
        }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp)); // Most recent first

      return backups;
    } catch (error) {
      // If backup dir doesn't exist or is empty, return empty array
      return [];
    }
  }

  /**
   * Export templates to external file
   */
  async export(templates, exportPath) {
    try {
      const templatesArray = templates instanceof Map
        ? Array.from(templates.entries())
        : Object.entries(templates);

      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        templates: templatesArray.map(([id, template]) => ({
          ...template,
          id
        })),
        metadata: {
          count: templatesArray.length,
          exported: true
        }
      };

      const content = JSON.stringify(exportData, null, 2);

      if (exportPath) {
        // Export to specified path (requires Tauri dialog)
        await writeTextFile(exportPath, content);
      }

      return {
        success: true,
        data: exportData,
        content,
        count: templatesArray.length
      };
    } catch (error) {
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  /**
   * Import templates from external file
   */
  async import(importPath) {
    try {
      const content = await readTextFile(importPath);
      const data = JSON.parse(content);

      // Validate import data
      if (!data.templates || !Array.isArray(data.templates)) {
        throw new Error('Invalid import data structure');
      }

      return {
        success: true,
        templates: data.templates,
        count: data.templates.length,
        metadata: data.metadata
      };
    } catch (error) {
      throw new Error(`Import failed: ${error.message}`);
    }
  }

  /**
   * Migrate from in-memory storage to file-based storage
   */
  async migrate(inMemoryStorage) {
    try {
      if (!inMemoryStorage || !(inMemoryStorage instanceof Map)) {
        throw new Error('Invalid in-memory storage provided');
      }

      // Create backup if file already exists
      if (await this.fileExists()) {
        await this.backup();
      }

      // Save in-memory data to file
      const result = await this.save(inMemoryStorage);

      return {
        success: true,
        migrated: result.count,
        timestamp: result.timestamp
      };
    } catch (error) {
      throw new Error(`Migration failed: ${error.message}`);
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
   * Clear all templates (with backup)
   */
  async clear() {
    try {
      // Create backup before clearing
      if (await this.fileExists()) {
        await this.backup();
      }

      // Clear cache
      this.cache = new Map();

      // Save empty storage
      await this.save(new Map());

      return {
        success: true,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Clear failed: ${error.message}`);
    }
  }

  /**
   * Get storage statistics
   */
  async getStatistics() {
    try {
      const backups = await this.listBackups();

      return {
        templates: this.cache.size,
        backups: backups.length,
        initialized: this.initialized,
        filename: this.filename,
        lastBackup: backups.length > 0 ? backups[0].timestamp : null
      };
    } catch (error) {
      return {
        templates: this.cache.size,
        backups: 0,
        initialized: this.initialized,
        error: error.message
      };
    }
  }

  // Private helper methods

  /**
   * Check if templates file exists
   */
  async fileExists() {
    try {
      return await exists(this.filename, { baseDir: this.dir });
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure backup directory exists
   */
  async ensureBackupDir() {
    try {
      const dirExists = await exists(this.backupDir, { baseDir: this.dir });
      if (!dirExists) {
        await mkdir(this.backupDir, { baseDir: this.dir, recursive: true });
      }
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }

  /**
   * Clean old backups (keep only maxBackups)
   */
  async cleanOldBackups() {
    try {
      const backups = await this.listBackups();

      // Remove oldest backups if we exceed maxBackups
      if (backups.length > this.maxBackups) {
        const toRemove = backups.slice(this.maxBackups);

        for (const backup of toRemove) {
          try {
            await remove(backup.filename, { baseDir: this.dir });
          } catch (error) {
            // Ignore errors when removing old backups
          }
        }
      }
    } catch (error) {
      // Ignore errors in cleanup
    }
  }
}

export default TemplateStorage;
