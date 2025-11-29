/**
 * Theme Resource Provider for Lokus
 * Integrates with Lokus's theme management system to provide access to:
 * - Current active theme and theme configurations
 * - Available themes (built-in and custom)
 * - Theme tokens and CSS variables
 * - Theme switching and customization capabilities
 */

import { logger } from '../../utils/logger.js';
import {
  readGlobalVisuals,
  listAvailableThemes,
  loadThemeManifestById,
  applyTokens,
  setGlobalActiveTheme,
  getGlobalThemesDir
} from '../../core/theme/manager.js';

export class ThemeProvider {
  constructor() {
    this.currentTheme = null;
    this.availableThemes = [];
    this.themeTokens = {};
    this.subscribers = new Set();
    
    // Initialize theme monitoring
    this.initializeThemeMonitoring();
  }

  /**
   * Initialize theme monitoring and load current state
   */
  async initializeThemeMonitoring() {
    try {
      // Load current theme
      await this.loadCurrentTheme();
      
      // Load available themes
      await this.loadAvailableThemes();
      
      // Setup theme change listeners
      this.setupThemeListeners();
    } catch (error) {
      logger.warn('ThemeProvider', Failed to initialize theme monitoring:', error);
    }
  }

  /**
   * Load current theme configuration
   */
  async loadCurrentTheme() {
    try {
      const visuals = await readGlobalVisuals();
      this.currentTheme = visuals.theme;
      
      if (this.currentTheme) {
        const manifest = await loadThemeManifestById(this.currentTheme);
        if (manifest && manifest.tokens) {
          this.themeTokens = manifest.tokens;
        }
      }
      
      // Get applied CSS variables from document
      this.currentAppliedTokens = this.getAppliedCSSVariables();
      
      this.notifySubscribers('theme:loaded');
    } catch (error) {
      logger.error('ThemeProvider', Failed to load current theme:', error);
    }
  }

  /**
   * Load available themes
   */
  async loadAvailableThemes() {
    try {
      this.availableThemes = await listAvailableThemes();
      this.notifySubscribers('themes:loaded');
    } catch (error) {
      logger.error('ThemeProvider', Failed to load available themes:', error);
    }
  }

  /**
   * Get currently applied CSS variables
   */
  getAppliedCSSVariables() {
    const appliedTokens = {};
    
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      const computedStyle = getComputedStyle(root);
      
      // Theme token keys from manager.js
      const tokenKeys = [
        '--bg', '--text', '--panel', '--border', '--muted', '--accent', '--accent-fg',
        '--task-todo', '--task-progress', '--task-urgent', '--task-question', 
        '--task-completed', '--task-cancelled', '--task-delegated',
        '--danger', '--success', '--warning', '--info',
        '--editor-placeholder'
      ];
      
      for (const key of tokenKeys) {
        const value = computedStyle.getPropertyValue(key).trim();
        if (value) {
          appliedTokens[key] = value;
        }
      }
    }
    
    return appliedTokens;
  }

  /**
   * Setup theme event listeners
   */
  setupThemeListeners() {
    try {
      // Listen for theme application events
      if (typeof window !== 'undefined') {
        // Tauri event listener
        if (window.__TAURI_INTERNALS__) {
          import('@tauri-apps/api/event').then(({ listen }) => {
            listen('theme:apply', async (event) => {
              await this.loadCurrentTheme();
            });
          });
        } else {
          // Browser event listener
          window.addEventListener('theme:apply', async (event) => {
            await this.loadCurrentTheme();
          });
        }
        
        // Monitor for manual CSS changes
        const observer = new MutationObserver((mutations) => {
          for (const mutation of mutations) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
              this.currentAppliedTokens = this.getAppliedCSSVariables();
              this.notifySubscribers('theme:applied-changed');
            }
          }
        });
        
        if (document.documentElement) {
          observer.observe(document.documentElement, { 
            attributes: true, 
            attributeFilter: ['style'] 
          });
        }
      }
    } catch (error) {
      logger.warn('ThemeProvider', Failed to setup theme listeners:', error);
    }
  }

  /**
   * Get all available resources
   */
  async listResources() {
    const resources = [
      {
        uri: 'lokus://themes/current',
        name: 'Current Theme',
        description: 'Currently active theme configuration and tokens',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://themes/available',
        name: 'Available Themes',
        description: 'List of all available themes (built-in and custom)',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://themes/tokens',
        name: 'Theme Tokens',
        description: 'Current theme tokens and CSS variables',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://themes/applied',
        name: 'Applied Theme',
        description: 'Currently applied CSS variables and their values',
        mimeType: 'application/json'
      },
      {
        uri: 'lokus://themes/directory',
        name: 'Theme Directory',
        description: 'Theme directory path and information',
        mimeType: 'application/json'
      }
    ];

    // Add individual theme resources
    for (const theme of this.availableThemes) {
      resources.push({
        uri: `lokus://themes/theme/${encodeURIComponent(theme.id)}`,
        name: `Theme: ${theme.name}`,
        description: `Configuration and tokens for theme: ${theme.name}`,
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
        case '/current':
          return this.getCurrentTheme();
        
        case '/available':
          return this.getAvailableThemes();
        
        case '/tokens':
          return this.getThemeTokens();
        
        case '/applied':
          return this.getAppliedTheme();
        
        case '/directory':
          return this.getThemeDirectory();
        
        default:
          if (path.startsWith('/theme/')) {
            const themeId = decodeURIComponent(path.substring(7));
            return this.getThemeConfiguration(themeId);
          }
          throw new Error(`Unknown resource path: ${path}`);
      }
    } catch (error) {
      logger.error('ThemeProvider', Error reading resource:', error);
      return {
        contents: [{
          type: 'text',
          text: `Error reading resource: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get current theme information
   */
  async getCurrentTheme() {
    const themeInfo = {
      activeThemeId: this.currentTheme,
      activeThemeName: null,
      tokens: this.themeTokens,
      appliedTokens: this.currentAppliedTokens,
      lastUpdated: new Date().toISOString()
    };

    // Get theme name
    if (this.currentTheme) {
      const theme = this.availableThemes.find(t => t.id === this.currentTheme);
      if (theme) {
        themeInfo.activeThemeName = theme.name;
      }
    }

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(themeInfo, null, 2)
      }]
    };
  }

  /**
   * Get available themes
   */
  async getAvailableThemes() {
    const themesInfo = {
      totalThemes: this.availableThemes.length,
      currentTheme: this.currentTheme,
      themes: this.availableThemes,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(themesInfo, null, 2)
      }]
    };
  }

  /**
   * Get theme tokens
   */
  async getThemeTokens() {
    const tokensInfo = {
      currentTheme: this.currentTheme,
      tokens: this.themeTokens,
      tokenCount: Object.keys(this.themeTokens).length,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(tokensInfo, null, 2)
      }]
    };
  }

  /**
   * Get applied theme (current CSS variables)
   */
  async getAppliedTheme() {
    const appliedInfo = {
      appliedTokens: this.currentAppliedTokens,
      appliedCount: Object.keys(this.currentAppliedTokens).length,
      sourceTheme: this.currentTheme,
      lastUpdated: new Date().toISOString()
    };

    return {
      contents: [{
        type: 'text',
        text: JSON.stringify(appliedInfo, null, 2)
      }]
    };
  }

  /**
   * Get theme directory information
   */
  async getThemeDirectory() {
    try {
      const themesDir = await getGlobalThemesDir();
      const directoryInfo = {
        themesDirectory: themesDir,
        availableThemesCount: this.availableThemes.length,
        builtInThemes: this.availableThemes.filter(t => 
          ['dracula', 'nord', 'one-dark-pro', 'minimal-light', 'neon-dark'].includes(t.id)
        ),
        customThemes: this.availableThemes.filter(t => 
          !['dracula', 'nord', 'one-dark-pro', 'minimal-light', 'neon-dark'].includes(t.id)
        ),
        lastUpdated: new Date().toISOString()
      };

      return {
        contents: [{
          type: 'text',
          text: JSON.stringify(directoryInfo, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            lastUpdated: new Date().toISOString()
          }, null, 2)
        }]
      };
    }
  }

  /**
   * Get specific theme configuration
   */
  async getThemeConfiguration(themeId) {
    try {
      const manifest = await loadThemeManifestById(themeId);
      
      if (!manifest) {
        return {
          contents: [{
            type: 'text',
            text: `Theme not found: ${themeId}`
          }]
        };
      }

      const themeConfig = {
        id: themeId,
        manifest,
        isActive: themeId === this.currentTheme,
        tokenCount: manifest.tokens ? Object.keys(manifest.tokens).length : 0,
        lastUpdated: new Date().toISOString()
      };

      return {
        contents: [{
          type: 'text',
          text: JSON.stringify(themeConfig, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: `Error loading theme ${themeId}: ${error.message}`
        }]
      };
    }
  }

  /**
   * Apply a theme (for future use with MCP tools)
   */
  async applyTheme(themeId) {
    try {
      await setGlobalActiveTheme(themeId);
      await this.loadCurrentTheme();
      this.notifySubscribers('theme:applied', { themeId });
      return true;
    } catch (error) {
      logger.error('ThemeProvider', Failed to apply theme:', error);
      return false;
    }
  }

  /**
   * Get theme preview (without applying)
   */
  async getThemePreview(themeId) {
    try {
      const manifest = await loadThemeManifestById(themeId);
      
      if (!manifest || !manifest.tokens) {
        throw new Error(`Theme ${themeId} not found or has no tokens`);
      }

      const preview = {
        id: themeId,
        name: manifest.name,
        tokens: manifest.tokens,
        preview: {
          background: manifest.tokens['--bg'],
          text: manifest.tokens['--text'],
          accent: manifest.tokens['--accent'],
          panel: manifest.tokens['--panel']
        },
        lastUpdated: new Date().toISOString()
      };

      return {
        contents: [{
          type: 'text',
          text: JSON.stringify(preview, null, 2)
        }]
      };
    } catch (error) {
      return {
        contents: [{
          type: 'text',
          text: `Error getting theme preview: ${error.message}`
        }]
      };
    }
  }

  /**
   * Subscribe to theme changes
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
        logger.error('ThemeProvider', Error notifying subscriber:', error);
      }
    }
  }

  /**
   * Refresh theme data
   */
  async refresh() {
    await this.loadCurrentTheme();
    await this.loadAvailableThemes();
    this.notifySubscribers('themes:refreshed');
  }

  /**
   * Get theme provider metadata
   */
  getMetadata() {
    return {
      name: 'Lokus Theme Provider',
      description: 'Provides access to Lokus theme configurations, tokens, and customization',
      version: '1.0.0',
      capabilities: [
        'current-theme',
        'available-themes',
        'theme-tokens',
        'applied-css-variables',
        'theme-preview',
        'theme-switching',
        'real-time-updates'
      ]
    };
  }

  /**
   * Get theme statistics
   */
  getThemeStatistics() {
    const stats = {
      totalThemes: this.availableThemes.length,
      builtInThemes: this.availableThemes.filter(t => 
        ['dracula', 'nord', 'one-dark-pro', 'minimal-light', 'neon-dark'].includes(t.id)
      ).length,
      customThemes: this.availableThemes.filter(t => 
        !['dracula', 'nord', 'one-dark-pro', 'minimal-light', 'neon-dark'].includes(t.id)
      ).length,
      currentTheme: this.currentTheme,
      tokenCount: Object.keys(this.themeTokens).length,
      appliedTokenCount: Object.keys(this.currentAppliedTokens).length
    };

    return stats;
  }
}