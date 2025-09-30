/**
 * BaseConfigManager - Manages base configuration per workspace
 * Saves to .lokus/.base-config in the workspace root
 */

import { invoke } from '@tauri-apps/api/core';

export class BaseConfigManager {
  constructor(workspacePath) {
    this.workspacePath = workspacePath;
    this.configPath = `${workspacePath}/.lokus/.base-config`;
    this.config = null;
  }

  /**
   * Load configuration from disk
   */
  async load() {
    try {
      const content = await invoke('read_file_content', { path: this.configPath });
      this.config = JSON.parse(content);
      console.log('✅ Loaded base config:', this.config);
      return this.config;
    } catch (error) {
      console.log('📝 No existing base config, creating new one');
      // Create default config
      this.config = {
        bases: {},
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
      };
      await this.save();
      return this.config;
    }
  }

  /**
   * Save configuration to disk
   */
  async save() {
    try {
      this.config.lastUpdated = new Date().toISOString();
      const content = JSON.stringify(this.config, null, 2);

      // Ensure .lokus directory exists
      try {
        await invoke('create_directory', { path: `${this.workspacePath}/.lokus` });
      } catch (e) {
        // Directory might already exist, that's fine
      }

      await invoke('write_file_content', {
        path: this.configPath,
        content: content,
      });
      console.log('💾 Saved base config');
      return true;
    } catch (error) {
      console.error('Failed to save base config:', error);
      return false;
    }
  }

  /**
   * Get config for a specific base
   */
  getBaseConfig(baseName) {
    if (!this.config || !this.config.bases) {
      return null;
    }
    return this.config.bases[baseName] || null;
  }

  /**
   * Update config for a specific base
   */
  async updateBaseConfig(baseName, updates) {
    if (!this.config) {
      await this.load();
    }

    if (!this.config.bases) {
      this.config.bases = {};
    }

    if (!this.config.bases[baseName]) {
      this.config.bases[baseName] = {};
    }

    // Merge updates
    this.config.bases[baseName] = {
      ...this.config.bases[baseName],
      ...updates,
    };

    await this.save();
  }

  /**
   * Save enabled columns
   */
  async saveEnabledColumns(baseName, enabledColumns) {
    await this.updateBaseConfig(baseName, { enabledColumns });
  }

  /**
   * Save pinned columns
   */
  async savePinnedColumns(baseName, pinnedColumns) {
    await this.updateBaseConfig(baseName, { pinnedColumns });
  }

  /**
   * Save column widths
   */
  async saveColumnWidths(baseName, columnWidths) {
    await this.updateBaseConfig(baseName, { columnWidths });
  }

  /**
   * Save column order
   */
  async saveColumnOrder(baseName, columnOrder) {
    await this.updateBaseConfig(baseName, { columnOrder });
  }

  /**
   * Save sort rules
   */
  async saveSortRules(baseName, sortRules) {
    await this.updateBaseConfig(baseName, { sortRules });
  }

  /**
   * Save filter rules
   */
  async saveFilterRules(baseName, filterRules, filterLogicOperator) {
    await this.updateBaseConfig(baseName, {
      filterRules,
      filterLogicOperator,
    });
  }

  /**
   * Get all settings for a base
   */
  getBaseSettings(baseName) {
    const baseConfig = this.getBaseConfig(baseName);
    if (!baseConfig) {
      return {
        enabledColumns: {
          name: true,
          title: false,
          created: false,
          modified: false,
          size: false,
          path: false,
          tags: false,
        },
        pinnedColumns: { name: true },
        columnWidths: {},
        columnOrder: null,
        sortRules: [],
        filterRules: [],
        filterLogicOperator: 'AND',
      };
    }

    return {
      enabledColumns: baseConfig.enabledColumns || {
        name: true,
        title: false,
        created: false,
        modified: false,
        size: false,
        path: false,
        tags: false,
      },
      pinnedColumns: baseConfig.pinnedColumns || { name: true },
      columnWidths: baseConfig.columnWidths || {},
      columnOrder: baseConfig.columnOrder || null,
      sortRules: baseConfig.sortRules || [],
      filterRules: baseConfig.filterRules || [],
      filterLogicOperator: baseConfig.filterLogicOperator || 'AND',
    };
  }
}

export default BaseConfigManager;