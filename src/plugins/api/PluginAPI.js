/**
 * Standardized Plugin API - Defines consistent interfaces between frontend and Rust backend
 * This file ensures type safety and consistent data formats across the plugin system.
 */
import { invoke } from '@tauri-apps/api/core';

// === Type Definitions ===

/**
 * Plugin manifest structure that matches backend PluginManifest
 */
export class PluginManifest {
  constructor(data = {}) {
    this.name = data.name || '';
    this.version = data.version || '0.0.0';
    this.description = data.description || '';
    this.author = data.author || '';
    this.main = data.main || '';
    this.permissions = Array.isArray(data.permissions) ? data.permissions : [];
    this.dependencies = data.dependencies || {};
    this.keywords = Array.isArray(data.keywords) ? data.keywords : [];
    this.repository = data.repository || null;
    this.homepage = data.homepage || null;
    this.license = data.license || null;
  }

  /**
   * Validate the manifest structure
   */
  validate() {
    const errors = [];
    const warnings = [];

    if (!this.name || this.name.trim() === '') {
      errors.push({ field: 'name', message: 'Plugin name is required' });
    }

    if (!this.version || this.version.trim() === '') {
      errors.push({ field: 'version', message: 'Plugin version is required' });
    }

    if (!this.main || this.main.trim() === '') {
      errors.push({ field: 'main', message: 'Main entry point is required' });
    }

    if (!this.description || this.description.trim() === '') {
      warnings.push('Plugin description is empty');
    }

    if (!this.author || this.author.trim() === '') {
      warnings.push('Plugin author is empty');
    }

    // Validate permissions
    for (const permission of this.permissions) {
      if (!this.isValidPermission(permission)) {
        errors.push({ 
          field: 'permissions', 
          message: `Invalid permission: ${permission}` 
        });
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Check if a permission is valid
   */
  isValidPermission(permission) {
    const validPermissions = [
      'read:files', 'write:files', 'read:workspace', 'write:workspace',
      'execute:commands', 'network:http', 'network:https',
      'ui:editor', 'ui:sidebar', 'ui:toolbar',
      'storage:local', 'clipboard:read', 'clipboard:write'
    ];
    return validPermissions.includes(permission);
  }
}

/**
 * Plugin information structure that matches backend PluginInfo
 */
export class PluginInfo {
  constructor(data = {}) {
    this.manifest = new PluginManifest(data.manifest);
    this.path = data.path || '';
    this.enabled = Boolean(data.enabled); // Ensure boolean type
    this.installed_at = data.installed_at || new Date().toISOString();
    this.size = Number(data.size) || 0;
  }

  /**
   * Convert to frontend plugin format
   */
  toFrontendFormat() {
    return {
      id: this.manifest.name,
      name: this.manifest.name,
      version: this.manifest.version,
      description: this.manifest.description,
      author: this.manifest.author,
      enabled: this.enabled, // Guaranteed to be boolean
      permissions: this.manifest.permissions,
      lastUpdated: this.installed_at,
      path: this.path,
      size: this.size,
      main: this.manifest.main,
      dependencies: this.manifest.dependencies,
      keywords: this.manifest.keywords,
      repository: this.manifest.repository,
      homepage: this.manifest.homepage,
      license: this.manifest.license,
      // Frontend-specific properties with defaults
      rating: 0,
      downloads: 0,
      settings: {},
      conflicts: [],
      ui: {
        panels: []
      }
    };
  }
}

/**
 * Standardized API error structure
 */
export class PluginAPIError extends Error {
  constructor(message, code = 'PLUGIN_ERROR', details = null) {
    super(message);
    this.name = 'PluginAPIError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Plugin settings structure
 */
export class PluginSettings {
  constructor(data = {}) {
    this.enabled_plugins = Array.isArray(data.enabled_plugins) ? data.enabled_plugins : [];
    this.plugin_permissions = data.plugin_permissions || {};
    this.plugin_settings = data.plugin_settings || {};
  }
}

// === Standardized Plugin API Class ===

/**
 * Standardized Plugin API that ensures consistent data formats between frontend and backend
 */
export class StandardizedPluginAPI {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5000; // 5 seconds cache TTL
  }

  /**
   * List all plugins with validated data format
   */
  async listPlugins(useCache = true) {
    const cacheKey = 'plugins_list';
    const cached = this.getFromCache(cacheKey);
    
    if (useCache && cached) {
      return cached;
    }

    try {
      const backendPlugins = await invoke('list_plugins');
      
      if (!Array.isArray(backendPlugins)) {
        throw new PluginAPIError(
          'Backend returned invalid plugin list format',
          'INVALID_FORMAT',
          { received: typeof backendPlugins, expected: 'array' }
        );
      }

      // Convert and validate each plugin
      const plugins = backendPlugins.map((pluginData, index) => {
        try {
          const pluginInfo = new PluginInfo(pluginData);
          const validation = pluginInfo.manifest.validate();
          
          if (!validation.valid) {
          }
          
          return pluginInfo.toFrontendFormat();
        } catch (error) {
          throw new PluginAPIError(
            `Invalid plugin data at index ${index}`,
            'PLUGIN_DATA_INVALID',
            { index, error: error.message, data: pluginData }
          );
        }
      });

      this.setCache(cacheKey, plugins);
      return plugins;

    } catch (error) {
      if (error instanceof PluginAPIError) {
        throw error;
      }
      throw new PluginAPIError(
        `Failed to load plugins: ${error.message}`,
        'BACKEND_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Get enabled plugins list
   */
  async getEnabledPlugins(useCache = true) {
    const cacheKey = 'enabled_plugins';
    const cached = this.getFromCache(cacheKey);
    
    if (useCache && cached) {
      return cached;
    }

    try {
      const enabledPlugins = await invoke('get_enabled_plugins');
      
      if (!Array.isArray(enabledPlugins)) {
        throw new PluginAPIError(
          'Backend returned invalid enabled plugins format',
          'INVALID_FORMAT',
          { received: typeof enabledPlugins, expected: 'array' }
        );
      }

      // Validate plugin names
      const validatedPlugins = enabledPlugins.filter(name => {
        if (typeof name !== 'string' || name.trim() === '') {
          return false;
        }
        return true;
      });

      this.setCache(cacheKey, validatedPlugins);
      return validatedPlugins;

    } catch (error) {
      if (error instanceof PluginAPIError) {
        throw error;
      }
      throw new PluginAPIError(
        `Failed to load enabled plugins: ${error.message}`,
        'BACKEND_ERROR',
        { originalError: error }
      );
    }
  }

  /**
   * Enable a plugin with validation and error handling
   */
  async enablePlugin(pluginName) {
    this.validatePluginName(pluginName);

    try {
      await invoke('enable_plugin', { name: pluginName });
      
      // Clear cache to force reload
      this.clearCache();
      
      return { success: true, message: `Plugin '${pluginName}' enabled successfully` };

    } catch (error) {
      const errorMessage = `Failed to enable plugin '${pluginName}': ${error.message || error}`;
      throw new PluginAPIError(
        errorMessage,
        'ENABLE_FAILED',
        { pluginName, originalError: error }
      );
    }
  }

  /**
   * Disable a plugin with validation and error handling
   */
  async disablePlugin(pluginName) {
    this.validatePluginName(pluginName);

    try {
      await invoke('disable_plugin', { name: pluginName });
      
      // Clear cache to force reload
      this.clearCache();
      
      return { success: true, message: `Plugin '${pluginName}' disabled successfully` };

    } catch (error) {
      const errorMessage = `Failed to disable plugin '${pluginName}': ${error.message || error}`;
      throw new PluginAPIError(
        errorMessage,
        'DISABLE_FAILED',
        { pluginName, originalError: error }
      );
    }
  }

  /**
   * Toggle plugin state with atomic operation
   */
  async togglePlugin(pluginName, enabled) {
    this.validatePluginName(pluginName);
    
    if (typeof enabled !== 'boolean') {
      throw new PluginAPIError(
        `Invalid enabled state: expected boolean, got ${typeof enabled}`,
        'INVALID_PARAMETER',
        { pluginName, enabled }
      );
    }

    return enabled 
      ? await this.enablePlugin(pluginName)
      : await this.disablePlugin(pluginName);
  }

  /**
   * Get plugin information by name
   */
  async getPluginInfo(pluginName) {
    this.validatePluginName(pluginName);

    try {
      const pluginData = await invoke('get_plugin_info', { name: pluginName });
      
      const pluginInfo = new PluginInfo(pluginData);
      const validation = pluginInfo.manifest.validate();
      
      if (!validation.valid) {
      }

      return pluginInfo.toFrontendFormat();

    } catch (error) {
      throw new PluginAPIError(
        `Failed to get plugin info for '${pluginName}': ${error.message || error}`,
        'GET_INFO_FAILED',
        { pluginName, originalError: error }
      );
    }
  }

  /**
   * Install plugin from path
   */
  async installPluginFromPath(path) {
    if (!path || typeof path !== 'string' || path.trim() === '') {
      throw new PluginAPIError(
        'Invalid path: path must be a non-empty string',
        'INVALID_PARAMETER',
        { path }
      );
    }

    try {
      const result = await invoke('install_plugin_from_path', { path });
      
      // Clear cache to force reload
      this.clearCache();
      
      return result;

    } catch (error) {
      throw new PluginAPIError(
        `Failed to install plugin from path '${path}': ${error.message || error}`,
        'INSTALL_FAILED',
        { path, originalError: error }
      );
    }
  }

  /**
   * Install plugin from URL
   */
  async installPluginFromUrl(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new PluginAPIError(
        'Invalid URL: URL must be a non-empty string',
        'INVALID_PARAMETER',
        { url }
      );
    }

    try {
      const result = await invoke('install_plugin_from_url', { url });
      
      // Clear cache to force reload
      this.clearCache();
      
      return result;

    } catch (error) {
      throw new PluginAPIError(
        `Failed to install plugin from URL '${url}': ${error.message || error}`,
        'INSTALL_FAILED',
        { url, originalError: error }
      );
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginName) {
    this.validatePluginName(pluginName);

    try {
      await invoke('uninstall_plugin', { name: pluginName });
      
      // Clear cache to force reload
      this.clearCache();
      
      return { success: true, message: `Plugin '${pluginName}' uninstalled successfully` };

    } catch (error) {
      throw new PluginAPIError(
        `Failed to uninstall plugin '${pluginName}': ${error.message || error}`,
        'UNINSTALL_FAILED',
        { pluginName, originalError: error }
      );
    }
  }

  // === Utility Methods ===

  /**
   * Validate plugin name
   */
  validatePluginName(pluginName) {
    if (!pluginName || typeof pluginName !== 'string' || pluginName.trim() === '') {
      throw new PluginAPIError(
        'Invalid plugin name: name must be a non-empty string',
        'INVALID_PARAMETER',
        { pluginName }
      );
    }

    if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\')) {
      throw new PluginAPIError(
        'Invalid plugin name: name contains invalid characters',
        'INVALID_PARAMETER',
        { pluginName }
      );
    }
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const item = this.cache.get(key);
    if (item && Date.now() - item.timestamp < this.cacheTTL) {
      return item.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }

  /**
   * Check if running in Tauri environment
   */
  isTauri() {
    try {
      const w = window;
      return !!(
        (w.__TAURI_INTERNALS__ && typeof w.__TAURI_INTERNALS__.invoke === 'function') ||
        w.__TAURI_METADATA__ ||
        (navigator?.userAgent || '').includes('Tauri')
      );
    } catch {
      return false;
    }
  }
}

// === Export Singleton Instance ===

/**
 * Singleton instance of the standardized plugin API
 */
export const pluginAPI = new StandardizedPluginAPI();

// Export default
export default {
  StandardizedPluginAPI,
  PluginManifest,
  PluginInfo,
  PluginSettings,
  PluginAPIError,
  pluginAPI
};