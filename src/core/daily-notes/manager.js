/**
 * Daily Notes Manager
 *
 * Manages daily notes functionality including creation, navigation, and configuration
 */

import { format, parse, isValid, subDays, addDays, getWeek } from 'date-fns';
import { invoke } from '@tauri-apps/api/core';
import { mkdir, exists, readDir } from '@tauri-apps/plugin-fs';
import { updateConfig, readConfig } from '../config/store.js';
import { joinPath } from '../../utils/pathUtils.js';

export class DailyNotesManager {
  constructor(options = {}) {
    this.workspacePath = options.workspacePath || null;
    this.config = {
      format: 'yyyy-MM-dd',
      folder: 'Daily Notes',
      template: null,
      openOnStartup: false,
      ...options.config
    };
  }

  /**
   * Initialize manager with workspace path and load config
   */
  async init(workspacePath) {
    this.workspacePath = workspacePath;
    await this.loadConfig();
  }

  /**
   * Load configuration from global config
   */
  async loadConfig() {
    try {
      const globalConfig = await readConfig();
      if (globalConfig.dailyNotes) {
        this.config = {
          ...this.config,
          ...globalConfig.dailyNotes
        };
      }
    } catch { }
  }

  /**
   * Save configuration to global config
   */
  async saveConfig(updates) {
    try {
      this.config = {
        ...this.config,
        ...updates
      };

      await updateConfig({
        dailyNotes: this.config
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Format a date according to the configured format
   */
  formatDate(date = new Date()) {
    try {
      return format(date, this.config.format);
    } catch (error) {
      // Fallback to ISO format
      return format(date, 'yyyy-MM-dd');
    }
  }

  /**
   * Parse a date string according to the configured format
   */
  parseDate(dateString) {
    try {
      const parsed = parse(dateString, this.config.format, new Date());
      return isValid(parsed) ? parsed : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the file path for a daily note
   */
  getDailyNotePath(date = new Date()) {
    if (!this.workspacePath) {
      throw new Error('Workspace path not initialized');
    }

    const fileName = `${this.formatDate(date)}.md`;
    const folderPath = joinPath(this.workspacePath, this.config.folder);
    return joinPath(folderPath, fileName);
  }

  /**
   * Check if a file exists
   */
  async fileExists(path) {
    try {
      return await exists(path);
    } catch (error) {
      return false;
    }
  }

  /**
   * Ensure the daily notes folder exists
   */
  async ensureFolder() {
    if (!this.workspacePath) {
      throw new Error('Workspace path not initialized');
    }

    const folderPath = joinPath(this.workspacePath, this.config.folder);

    try {
      // Check if folder exists first
      const folderExists = await exists(folderPath);
      if (!folderExists) {
        // Create the folder with recursive option to create parent directories if needed
        await mkdir(folderPath, { recursive: true });
      }
    } catch (error) {
      // If folder exists, that's fine, otherwise log the error
    }
  }

  /**
   * Get the content for a new daily note
   */
  async getDailyNoteContent(date = new Date()) {
    const formattedDate = this.formatDate(date);

    // Use template if configured
    if (this.config.template) {
      try {
        // Calculate related dates
        const yesterday = subDays(date, 1);
        const tomorrow = addDays(date, 1);
        const weekNumber = getWeek(date);

        // Process template with date variables
        let content = this.config.template;

        // Basic date variable
        content = content.replace(/\{\{date\}\}/g, formattedDate);

        // Custom date format: {{date:FORMAT}}
        content = content.replace(/\{\{date:([^}]+)\}\}/g, (match, formatStr) => {
          try {
            return format(date, formatStr);
          } catch (e) {
            return formattedDate;
          }
        });

        // Yesterday variable
        content = content.replace(/\{\{yesterday\}\}/g, this.formatDate(yesterday));
        content = content.replace(/\{\{yesterday:([^}]+)\}\}/g, (match, formatStr) => {
          try {
            return format(yesterday, formatStr);
          } catch (e) {
            return this.formatDate(yesterday);
          }
        });

        // Tomorrow variable
        content = content.replace(/\{\{tomorrow\}\}/g, this.formatDate(tomorrow));
        content = content.replace(/\{\{tomorrow:([^}]+)\}\}/g, (match, formatStr) => {
          try {
            return format(tomorrow, formatStr);
          } catch (e) {
            return this.formatDate(tomorrow);
          }
        });

        // Day name (Monday, Tuesday, etc.)
        content = content.replace(/\{\{day_name\}\}/g, format(date, 'EEEE'));
        content = content.replace(/\{\{day\}\}/g, format(date, 'EEEE'));

        // Day name short (Mon, Tue, etc.)
        content = content.replace(/\{\{day_short\}\}/g, format(date, 'EEE'));

        // Month name (January, February, etc.)
        content = content.replace(/\{\{month_name\}\}/g, format(date, 'MMMM'));
        content = content.replace(/\{\{month\}\}/g, format(date, 'MMMM'));

        // Month name short (Jan, Feb, etc.)
        content = content.replace(/\{\{month_short\}\}/g, format(date, 'MMM'));

        // Week number
        content = content.replace(/\{\{week_number\}\}/g, weekNumber.toString());
        content = content.replace(/\{\{week\}\}/g, weekNumber.toString());

        // Year
        content = content.replace(/\{\{year\}\}/g, format(date, 'yyyy'));

        // Time
        content = content.replace(/\{\{time\}\}/g, format(new Date(), 'HH:mm'));
        content = content.replace(/\{\{time:([^}]+)\}\}/g, (match, formatStr) => {
          try {
            return format(new Date(), formatStr);
          } catch (e) {
            return format(new Date(), 'HH:mm');
          }
        });

        return content;
      } catch (error) {
        // Fall through to default content
      }
    }

    // Default content
    const dayName = format(date, 'EEEE');
    return `# ${formattedDate} - ${dayName}\n\n`;
  }

  /**
   * Create a daily note
   */
  async createDailyNote(date = new Date()) {
    await this.ensureFolder();

    const filePath = this.getDailyNotePath(date);
    const content = await this.getDailyNoteContent(date);

    try {
      await invoke('write_file_content', { path: filePath, content });
      return filePath;
    } catch (error) {
      throw new Error(`Failed to create daily note: ${error.message}`);
    }
  }

  /**
   * Open today's daily note (create if doesn't exist)
   */
  async openToday() {
    const today = new Date();
    const filePath = this.getDailyNotePath(today);

    // Check if file exists
    const exists = await this.fileExists(filePath);

    if (!exists) {
      // Create the daily note
      await this.createDailyNote(today);
    }

    return {
      path: filePath,
      created: !exists
    };
  }

  /**
   * Open daily note for a specific date
   */
  async openDate(date) {
    if (!isValid(date)) {
      throw new Error('Invalid date provided');
    }

    const filePath = this.getDailyNotePath(date);
    const exists = await this.fileExists(filePath);

    if (!exists) {
      await this.createDailyNote(date);
    }

    return {
      path: filePath,
      created: !exists
    };
  }

  /**
   * Get yesterday's daily note path
   */
  async openYesterday() {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return await this.openDate(yesterday);
  }

  /**
   * Get tomorrow's daily note path
   */
  async openTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return await this.openDate(tomorrow);
  }

  /**
   * List all daily notes
   */
  async listDailyNotes() {
    if (!this.workspacePath) {
      throw new Error('Workspace path not initialized');
    }

    try {
      const folderPath = joinPath(this.workspacePath, this.config.folder);
      const entries = await readDir(folderPath);

      // Filter markdown files and parse dates
      const dailyNotes = entries
        .filter(entry => entry.isFile && entry.name.endsWith('.md'))
        .map(entry => {
          const nameWithoutExt = entry.name.replace(/\.md$/, '');
          const date = this.parseDate(nameWithoutExt);
          const filePath = joinPath(folderPath, entry.name);
          return {
            path: filePath,
            name: entry.name,
            date: date,
            dateString: nameWithoutExt,
            isValid: date !== null
          };
        })
        .filter(note => note.isValid)
        .sort((a, b) => b.date - a.date); // Sort by date descending

      return dailyNotes;
    } catch (error) {
      // Folder might not exist yet
      return [];
    }
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  async updateConfig(updates) {
    await this.saveConfig(updates);
  }
}

// Create singleton instance
const dailyNotesManager = new DailyNotesManager();

export default dailyNotesManager;
