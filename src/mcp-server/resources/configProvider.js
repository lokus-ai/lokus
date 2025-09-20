/**
 * Configuration Resource Provider for Lokus
 * Integrates with Lokus's configuration system to provide access to:
 * - Global configuration settings
 * - Workspace-specific configurations
 * - User preferences and customizations
 * - Application settings and state
 */

import { 
  readConfig, 
  writeConfig, 
  updateConfig, 
  getGlobalDir, 
  getGlobalConfigPath 
} from '../../core/config/store.js';

export class ConfigProvider {
  constructor() {
    this.globalConfig = {};
    this.workspaceConfigs = new Map();
    this.subscribers = new Set();
    this.configPaths = {
      global: null,
      globalDir: null
    };
    
    // Initialize configuration monitoring
    this.initializeConfigMonitoring();
  }

  /**
   * Initialize configuration monitoring
   */
  async initializeConfigMonitoring() {
    try {
      // Get configuration paths
      this.configPaths.globalDir = await getGlobalDir();
      this.configPaths.global = await getGlobalConfigPath();
      
      // Load global configuration
      await this.loadGlobalConfig();
      
      // Setup configuration change monitoring
      this.setupConfigListeners();
    } catch (error) {
      console.warn('[ConfigProvider] Failed to initialize config monitoring:', error);
    }
  }

  /**
   * Load global configuration
   */
  async loadGlobalConfig() {
    try {
      this.globalConfig = await readConfig();
      this.notifySubscribers('config:global-loaded');
    } catch (error) {
      console.error('[ConfigProvider] Failed to load global config:', error);
      this.globalConfig = {};
    }
  }

  /**
   * Load workspace-specific configuration
   */
  async loadWorkspaceConfig(workspacePath) {
    if (!workspacePath) return null;

    try {
      // Check if already cached
      if (this.workspaceConfigs.has(workspacePath)) {
        return this.workspaceConfigs.get(workspacePath);
      }

      // In Lokus, workspace configs are stored in .lokus/config.json within the workspace
      // For now, we'll simulate this or use the workspace-specific settings
      const workspaceConfig = {
        workspacePath,
        theme: 'inherit', // Default to inherit from global
        preferences: {},
        lastAccessed: new Date().toISOString()
      };

      this.workspaceConfigs.set(workspacePath, workspaceConfig);
      this.notifySubscribers('config:workspace-loaded', { workspacePath });
      
      return workspaceConfig;
    } catch (error) {
      console.error(`[ConfigProvider] Failed to load workspace config for ${workspacePath}:`, error);
      return null;
    }
  }

  /**
   * Setup configuration change listeners
   */
  setupConfigListeners() {
    try {
      // Monitor global config changes
      if (typeof window !== 'undefined') {
        // Watch for config-related window events
        window.addEventListener('config:updated', async () => {
          await this.loadGlobalConfig();
        });
        
        // Periodically check for config changes
        setInterval(async () => {
          const currentConfig = await readConfig();
          if (JSON.stringify(currentConfig) !== JSON.stringify(this.globalConfig)) {
            this.globalConfig = currentConfig;
            this.notifySubscribers('config:global-changed');
          }
        }, 5000);
      }
    } catch (error) {
      console.warn('[ConfigProvider] Failed to setup config listeners:', error);
    }
  }

  /**
   * Get all available resources
   */
  async listResources() {
    const resources = [
      {
        uri: 'lokus://config/global',
        name: 'Global Configuration',
        description: 'Global application configuration and settings',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://config/paths',
        name: 'Configuration Paths',
        description: 'Paths to configuration files and directories',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://config/preferences',
        name: 'User Preferences',
        description: 'User preferences and customizations',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://config/environment',
        name: 'Environment Information',
        description: 'Runtime environment and system information',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://config/features',
        name: 'Feature Flags',
        description: 'Enabled features and experimental settings',
        mimeType: 'application/json'
      }
    ];

    // Add workspace-specific configurations
    for (const [workspacePath, config] of this.workspaceConfigs) {
      resources.push({
        uri: `lokus://config/workspace/${encodeURIComponent(workspacePath)}`,
        name: `Workspace Config: ${workspacePath.split('/').pop()}`,
        description: `Configuration for workspace: ${workspacePath}`,
        mimeType: 'application/json'
      });
    }

    return resources;
  }

  /**
   * Read a specific resource
   */
  async readResource(uri) {
    try {
      const url = new URL(uri);
      const path = url.pathname;

      switch (path) {
        case '/global':
          return this.getGlobalConfig();
        
        case '/paths':
          return this.getConfigPaths();
        
        case '/preferences':
          return this.getUserPreferences();
        
        case '/environment':
          return this.getEnvironmentInfo();
        
        case '/features':
          return this.getFeatureFlags();
        
        default:
          if (path.startsWith('/workspace/')) {
            const workspacePath = decodeURIComponent(path.substring(11));
            return this.getWorkspaceConfig(workspacePath);
          }
          throw new Error(`Unknown resource path: ${path}`);
      }
    } catch (error) {
      console.error('[ConfigProvider] Error reading resource:', error);
      return {
        contents: [{
          type: 'text',
          text: `Error reading resource: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get global configuration
   */
  async getGlobalConfig() {
    const configInfo = {
      config: this.globalConfig,
      configPath: this.configPaths.global,
      configDirectory: this.configPaths.globalDir,
      configKeys: Object.keys(this.globalConfig),
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(configInfo, null, 2)
      }]
    };
  }

  /**
   * Get configuration paths
   */
  async getConfigPaths() {
    const pathsInfo = {
      globalConfigPath: this.configPaths.global,
      globalConfigDirectory: this.configPaths.globalDir,
      workspaceConfigPaths: Array.from(this.workspaceConfigs.keys()),
      isTauriEnvironment: this.isTauriEnvironment(),
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(pathsInfo, null, 2)
      }]
    };
  }

  /**
   * Get user preferences
   */
  async getUserPreferences() {
    const preferences = {
      theme: this.globalConfig.theme || null,
      lastWorkspace: this.globalConfig.lastWorkspace || null,
      editorPreferences: this.globalConfig.editor || {},
      uiPreferences: this.globalConfig.ui || {},
      pluginPreferences: this.globalConfig.plugins || {},
      shortcuts: this.globalConfig.shortcuts || {},
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(preferences, null, 2)
      }]
    };
  }

  /**
   * Get environment information
   */
  async getEnvironmentInfo() {
    const envInfo = {
      isTauriEnvironment: this.isTauriEnvironment(),
      platform: this.getPlatform(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      configurationFormat: this.isTauriEnvironment() ? 'JSON file' : 'localStorage',
      globalConfigExists: Object.keys(this.globalConfig).length > 0,
      workspaceConfigCount: this.workspaceConfigs.size,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(envInfo, null, 2)
      }]
    };
  }

  /**
   * Get feature flags and experimental settings
   */
  async getFeatureFlags() {
    const features = {
      experimentalFeatures: this.globalConfig.experimental || {},
      enabledFeatures: this.globalConfig.features || {},
      pluginsEnabled: this.globalConfig.plugins?.enabled !== false,
      debugMode: this.globalConfig.debug === true,
      devMode: this.globalConfig.development === true,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(features, null, 2)
      }]
    };
  }

  /**
   * Get workspace-specific configuration
   */
  async getWorkspaceConfig(workspacePath) {
    try {
      let workspaceConfig = this.workspaceConfigs.get(workspacePath);
      
      if (!workspaceConfig) {
        workspaceConfig = await this.loadWorkspaceConfig(workspacePath);
      }

      const configInfo = {
        workspacePath,
        config: workspaceConfig,
        inheritedFromGlobal: {
          theme: this.globalConfig.theme,
          preferences: this.globalConfig.editor
        },
        lastUpdated: new Date().toISOString()
      };

      return {
        contents: [{
          type: 'text',
          text: JSON.stringify(configInfo, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: `Error loading workspace config: ${error.message}`
        }]
      };
    }
  }

  /**
   * Update global configuration (for future use with MCP tools)
   */
  async updateGlobalConfig(updates) {
    try {
      const updatedConfig = await updateConfig(updates);
      this.globalConfig = updatedConfig;
      this.notifySubscribers('config:global-updated', updates);
      return true;
    } catch (error) {
      console.error('[ConfigProvider] Failed to update global config:', error);
      return false;
    }
  }

  /**
   * Get configuration by key path (dot notation)
   */
  getConfigValue(keyPath, config = this.globalConfig) {
    const keys = keyPath.split('.');
    let value = config;
    
    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * Set configuration by key path (dot notation)
   */
  async setConfigValue(keyPath, value) {
    try {
      const keys = keyPath.split('.');
      const updates = {};
      let current = updates;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = {};
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      
      return await this.updateGlobalConfig(updates);
    } catch (error) {
      console.error('[ConfigProvider] Failed to set config value:', error);
      return false;
    }
  }

  /**
   * Check if running in Tauri environment
   */
  isTauriEnvironment() {
    try {
      return !!(
        typeof window !== 'undefined' && (
          (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
          window.__TAURI_METADATA__ ||
          (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
        )
      );
    } catch {
      return false;
    }
  }

  /**
   * Get platform information
   */
  getPlatform() {
    if (typeof navigator !== 'undefined') {
      const userAgent = navigator.userAgent;
      if (userAgent.includes('Mac')) return 'macOS';
      if (userAgent.includes('Win')) return 'Windows';
      if (userAgent.includes('Linux')) return 'Linux';
    }
    return 'Unknown';
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  /**
   * Notify subscribers of changes
   */
  notifySubscribers(event, data = null) {
    for (const callback of this.subscribers) {
      try {
        callback(event, data);
      } catch (error) {
        console.error('[ConfigProvider] Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Refresh configuration data
   */
  async refresh() {
    await this.loadGlobalConfig();
    
    // Refresh workspace configs
    for (const workspacePath of this.workspaceConfigs.keys()) {
      await this.loadWorkspaceConfig(workspacePath);
    }
    
    this.notifySubscribers('config:refreshed');
  }

  /**
   * Get configuration provider metadata
   */
  getMetadata() {
    return {
      name: 'Lokus Configuration Provider',
      description: 'Provides access to Lokus configuration settings and preferences',
      version: '1.0.0',
      capabilities: [
        'global-config',
        'workspace-config',
        'user-preferences',
        'environment-info',
        'feature-flags',
        'config-updates',
        'real-time-monitoring'
      ]
    };
  }

  /**
   * Get configuration statistics
   */
  getConfigStatistics() {
    const stats = {
      globalConfigKeys: Object.keys(this.globalConfig).length,
      workspaceConfigs: this.workspaceConfigs.size,
      hasThemeConfig: !!this.globalConfig.theme,
      hasEditorConfig: !!this.globalConfig.editor,
      hasPluginConfig: !!this.globalConfig.plugins,
      isTauriEnvironment: this.isTauriEnvironment(),
      platform: this.getPlatform()
    };

    return stats;
  }

  /**
   * Validate configuration structure
   */
  validateConfig(config) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    // Basic validation rules
    if (config.theme && typeof config.theme !== 'string') {
      validation.errors.push('Theme must be a string');
      validation.isValid = false;
    }

    if (config.editor && typeof config.editor !== 'object') {
      validation.errors.push('Editor config must be an object');
      validation.isValid = false;
    }

    if (config.plugins && typeof config.plugins !== 'object') {
      validation.errors.push('Plugins config must be an object');
      validation.isValid = false;
    }

    return validation;
  }
}