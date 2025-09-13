/**
 * Custom Theme Plugin for Lokus
 * 
 * This plugin demonstrates:
 * - CSS injection and theme switching
 * - Custom theme definition and management
 * - System theme integration (light/dark mode)
 * - UI panel for theme selection
 * - Settings persistence and restoration
 * - Dynamic styling and animations
 */

import { BasePlugin } from '../../src/plugins/core/BasePlugin.js';

export default class CustomThemePlugin extends BasePlugin {
  constructor() {
    super();
    this.currentTheme = null;
    this.themes = new Map();
    this.injectedStylesId = 'custom-theme-styles';
    this.panelId = null;
    this.systemThemeWatcher = null;
  }

  /**
   * Plugin activation - setup themes and UI
   */
  async activate() {
    await super.activate();
    
    try {
      // Initialize themes
      this.initializeThemes();
      
      // Register commands
      this.registerCommands();
      
      // Setup UI panel
      this.setupUI();
      
      // Setup system theme watching if enabled
      const autoSwitch = await this.getSetting('autoSwitchTheme', false);
      if (autoSwitch) {
        this.setupSystemThemeWatcher();
      }
      
      // Restore saved theme
      await this.restoreSavedTheme();
      
      // Inject custom CSS if any
      await this.injectCustomCSS();
      
      this.showNotification('Custom Theme plugin activated', 'info');
      
    } catch (error) {
      this.logger.error('Failed to activate Custom Theme plugin:', error);
      this.showNotification('Failed to activate Custom Theme plugin', 'error');
      throw error;
    }
  }

  /**
   * Plugin deactivation - cleanup themes and watchers
   */
  async deactivate() {
    try {
      // Remove injected styles
      this.removeInjectedStyles();
      
      // Cleanup system theme watcher
      if (this.systemThemeWatcher) {
        this.systemThemeWatcher.removeEventListener('change', this.handleSystemThemeChange);
      }
      
      await super.deactivate();
      
    } catch (error) {
      this.logger.error('Error during deactivation:', error);
    }
  }

  /**
   * Initialize built-in themes
   */
  initializeThemes() {
    // Nord Theme
    this.themes.set('nord', {
      name: 'Nord',
      description: 'Arctic, north-bluish clean and elegant theme',
      type: 'dark',
      colors: {
        primary: '#88C0D0',
        secondary: '#81A1C1',
        background: '#2E3440',
        surface: '#3B4252',
        accent: '#5E81AC',
        text: '#ECEFF4',
        textMuted: '#D8DEE9',
        border: '#434C5E',
        success: '#A3BE8C',
        warning: '#EBCB8B',
        error: '#BF616A'
      },
      styles: this.getNordStyles()
    });

    // Dracula Theme
    this.themes.set('dracula', {
      name: 'Dracula',
      description: 'Dark theme with vibrant colors',
      type: 'dark',
      colors: {
        primary: '#BD93F9',
        secondary: '#8BE9FD',
        background: '#282A36',
        surface: '#44475A',
        accent: '#FF79C6',
        text: '#F8F8F2',
        textMuted: '#6272A4',
        border: '#44475A',
        success: '#50FA7B',
        warning: '#F1FA8C',
        error: '#FF5555'
      },
      styles: this.getDraculaStyles()
    });

    // Monokai Theme
    this.themes.set('monokai', {
      name: 'Monokai',
      description: 'Classic dark theme with warm colors',
      type: 'dark',
      colors: {
        primary: '#A6E22E',
        secondary: '#66D9EF',
        background: '#272822',
        surface: '#383830',
        accent: '#F92672',
        text: '#F8F8F2',
        textMuted: '#75715E',
        border: '#49483E',
        success: '#A6E22E',
        warning: '#E6DB74',
        error: '#F92672'
      },
      styles: this.getMonokaiStyles()
    });

    // Light Theme
    this.themes.set('light-custom', {
      name: 'Custom Light',
      description: 'Clean and minimal light theme',
      type: 'light',
      colors: {
        primary: '#2563EB',
        secondary: '#7C3AED',
        background: '#FFFFFF',
        surface: '#F8FAFC',
        accent: '#DC2626',
        text: '#1F2937',
        textMuted: '#6B7280',
        border: '#E5E7EB',
        success: '#059669',
        warning: '#D97706',
        error: '#DC2626'
      },
      styles: this.getLightCustomStyles()
    });

    this.logger.info(`Initialized ${this.themes.size} themes`);
  }

  /**
   * Register theme commands
   */
  registerCommands() {
    // Apply specific theme commands
    this.registerCommand({
      name: 'apply-nord',
      description: 'Apply Nord Theme',
      action: () => this.applyTheme('nord')
    });

    this.registerCommand({
      name: 'apply-dracula',
      description: 'Apply Dracula Theme', 
      action: () => this.applyTheme('dracula')
    });

    this.registerCommand({
      name: 'apply-monokai',
      description: 'Apply Monokai Theme',
      action: () => this.applyTheme('monokai')
    });

    // Reset theme command
    this.registerCommand({
      name: 'reset-theme',
      description: 'Reset to Default Theme',
      action: () => this.resetTheme()
    });

    // Toggle theme panel command
    this.registerCommand({
      name: 'toggle-theme-panel',
      description: 'Toggle Theme Panel',
      action: () => this.toggleThemePanel()
    });
  }

  /**
   * Setup UI components
   */
  setupUI() {
    // Register theme selection panel
    this.panelId = this.registerPanel({
      name: 'theme-selector',
      title: 'Custom Themes',
      position: 'sidebar',
      content: this.createThemePanelContent(),
      icon: '🎨'
    });
  }

  /**
   * Create theme panel content
   */
  createThemePanelContent() {
    const themeItems = Array.from(this.themes.entries())
      .map(([key, theme]) => {
        const isActive = this.currentTheme === key;
        const activeClass = isActive ? 'theme-item-active' : '';
        
        return `
          <div class="theme-item ${activeClass}" data-theme="${key}">
            <div class="theme-preview" style="background: ${theme.colors.background}; border: 2px solid ${theme.colors.border};">
              <div class="theme-colors">
                <div class="color-dot" style="background: ${theme.colors.primary};" title="Primary"></div>
                <div class="color-dot" style="background: ${theme.colors.secondary};" title="Secondary"></div>
                <div class="color-dot" style="background: ${theme.colors.accent};" title="Accent"></div>
                <div class="color-dot" style="background: ${theme.colors.text};" title="Text"></div>
              </div>
            </div>
            <div class="theme-info">
              <div class="theme-name">${theme.name}</div>
              <div class="theme-description">${theme.description}</div>
              <div class="theme-type">${theme.type}</div>
            </div>
            <div class="theme-actions">
              <button class="btn-apply" onclick="window.customThemePlugin?.applyTheme('${key}')">
                ${isActive ? '✓ Active' : 'Apply'}
              </button>
            </div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="theme-panel">
        <div class="theme-panel-header">
          <h3>Choose Theme</h3>
          <button class="btn-small" onclick="window.customThemePlugin?.resetTheme()">Reset</button>
        </div>
        
        <div class="themes-list">
          ${themeItems}
        </div>
        
        <div class="theme-settings">
          <label class="setting-item">
            <input type="checkbox" id="auto-switch-theme" ${this.getSetting('autoSwitchTheme', false) ? 'checked' : ''}>
            <span>Auto-switch with system theme</span>
          </label>
          
          <label class="setting-item">
            <input type="checkbox" id="enable-animations" ${this.getSetting('enableAnimations', true) ? 'checked' : ''}>
            <span>Enable theme animations</span>
          </label>
        </div>
        
        <div class="custom-css-section">
          <h4>Custom CSS</h4>
          <textarea id="custom-css-input" placeholder="Enter custom CSS here..." rows="4">${this.getSetting('customCSS', '')}</textarea>
          <button class="btn-apply" onclick="window.customThemePlugin?.applyCustomCSS()">Apply CSS</button>
        </div>
      </div>
    `;
  }

  /**
   * Apply a theme by key
   */
  async applyTheme(themeKey) {
    try {
      const theme = this.themes.get(themeKey);
      if (!theme) {
        this.logger.warn('Theme not found:', themeKey);
        this.showNotification(`Theme '${themeKey}' not found`, 'error');
        return;
      }

      // Remove existing theme styles
      this.removeInjectedStyles();
      
      // Apply new theme
      this.injectThemeStyles(theme);
      this.currentTheme = themeKey;
      
      // Save theme choice if persistence is enabled
      const persistTheme = await this.getSetting('persistThemeChoice', true);
      if (persistTheme) {
        await this.setSetting('currentTheme', themeKey);
      }
      
      // Update panel to reflect active theme
      this.updateThemePanel();
      
      this.showNotification(`Applied ${theme.name} theme`, 'success');
      this.logger.info('Applied theme:', themeKey);
      
    } catch (error) {
      this.logger.error('Error applying theme:', error);
      this.showNotification('Failed to apply theme', 'error');
    }
  }

  /**
   * Reset to default theme
   */
  async resetTheme() {
    try {
      this.removeInjectedStyles();
      this.currentTheme = null;
      
      // Clear saved theme
      await this.setSetting('currentTheme', null);
      
      // Update panel
      this.updateThemePanel();
      
      this.showNotification('Reset to default theme', 'success');
      
    } catch (error) {
      this.logger.error('Error resetting theme:', error);
      this.showNotification('Failed to reset theme', 'error');
    }
  }

  /**
   * Inject theme styles
   */
  injectThemeStyles(theme) {
    const enableAnimations = this.getSetting('enableAnimations', true);
    
    let css = `
      /* Custom Theme: ${theme.name} */
      :root {
        --custom-theme-primary: ${theme.colors.primary};
        --custom-theme-secondary: ${theme.colors.secondary};
        --custom-theme-background: ${theme.colors.background};
        --custom-theme-surface: ${theme.colors.surface};
        --custom-theme-accent: ${theme.colors.accent};
        --custom-theme-text: ${theme.colors.text};
        --custom-theme-text-muted: ${theme.colors.textMuted};
        --custom-theme-border: ${theme.colors.border};
        --custom-theme-success: ${theme.colors.success};
        --custom-theme-warning: ${theme.colors.warning};
        --custom-theme-error: ${theme.colors.error};
      }
      
      ${enableAnimations ? `
      * {
        transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease !important;
      }
      ` : ''}
      
      ${theme.styles}
    `;

    const styleElement = document.createElement('style');
    styleElement.id = this.injectedStylesId;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);
  }

  /**
   * Remove injected theme styles
   */
  removeInjectedStyles() {
    const existingStyles = document.getElementById(this.injectedStylesId);
    if (existingStyles) {
      existingStyles.remove();
    }
  }

  /**
   * Setup system theme watcher
   */
  setupSystemThemeWatcher() {
    if (window.matchMedia) {
      this.systemThemeWatcher = window.matchMedia('(prefers-color-scheme: dark)');
      
      this.handleSystemThemeChange = (e) => {
        if (e.matches) {
          // System is dark, apply a dark theme
          this.applyTheme('nord');
        } else {
          // System is light, apply light theme
          this.applyTheme('light-custom');
        }
      };
      
      this.systemThemeWatcher.addEventListener('change', this.handleSystemThemeChange);
      
      // Apply initial theme based on system preference
      if (this.systemThemeWatcher.matches) {
        this.applyTheme('nord');
      } else {
        this.applyTheme('light-custom');
      }
    }
  }

  /**
   * Restore saved theme on activation
   */
  async restoreSavedTheme() {
    try {
      const savedTheme = await this.getSetting('currentTheme', null);
      if (savedTheme && this.themes.has(savedTheme)) {
        await this.applyTheme(savedTheme);
      }
    } catch (error) {
      this.logger.error('Error restoring saved theme:', error);
    }
  }

  /**
   * Inject custom CSS from settings
   */
  async injectCustomCSS() {
    try {
      const customCSS = await this.getSetting('customCSS', '');
      if (customCSS.trim()) {
        const styleElement = document.createElement('style');
        styleElement.id = 'custom-theme-user-css';
        styleElement.textContent = `/* User Custom CSS */\n${customCSS}`;
        document.head.appendChild(styleElement);
      }
    } catch (error) {
      this.logger.error('Error injecting custom CSS:', error);
    }
  }

  /**
   * Apply custom CSS from user input
   */
  async applyCustomCSS() {
    try {
      const input = document.getElementById('custom-css-input');
      if (input) {
        const customCSS = input.value;
        
        // Remove existing custom CSS
        const existing = document.getElementById('custom-theme-user-css');
        if (existing) {
          existing.remove();
        }
        
        // Apply new custom CSS
        if (customCSS.trim()) {
          const styleElement = document.createElement('style');
          styleElement.id = 'custom-theme-user-css';
          styleElement.textContent = `/* User Custom CSS */\n${customCSS}`;
          document.head.appendChild(styleElement);
        }
        
        // Save to settings
        await this.setSetting('customCSS', customCSS);
        
        this.showNotification('Custom CSS applied', 'success');
      }
    } catch (error) {
      this.logger.error('Error applying custom CSS:', error);
      this.showNotification('Failed to apply custom CSS', 'error');
    }
  }

  /**
   * Toggle theme panel visibility
   */
  toggleThemePanel() {
    if (this.panelId) {
      this.api.emit('panel_toggle', { panelId: this.panelId });
    }
  }

  /**
   * Update theme panel to reflect current state
   */
  updateThemePanel() {
    // This would typically update the panel content
    // For now, we'll log the update
    this.logger.info('Theme panel updated, current theme:', this.currentTheme);
  }

  // Theme Styles Definitions

  getNordStyles() {
    return `
      body, .editor-content {
        background-color: var(--custom-theme-background) !important;
        color: var(--custom-theme-text) !important;
      }
      
      .editor-toolbar, .sidebar, .status-bar {
        background-color: var(--custom-theme-surface) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      .btn-primary {
        background-color: var(--custom-theme-primary) !important;
        color: var(--custom-theme-background) !important;
      }
      
      .btn-secondary {
        background-color: var(--custom-theme-surface) !important;
        color: var(--custom-theme-text) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      input, textarea, select {
        background-color: var(--custom-theme-surface) !important;
        color: var(--custom-theme-text) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      .link, a {
        color: var(--custom-theme-secondary) !important;
      }
      
      .text-muted {
        color: var(--custom-theme-text-muted) !important;
      }
    `;
  }

  getDraculaStyles() {
    return `
      body, .editor-content {
        background-color: var(--custom-theme-background) !important;
        color: var(--custom-theme-text) !important;
      }
      
      .editor-toolbar, .sidebar, .status-bar {
        background-color: var(--custom-theme-surface) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      .btn-primary {
        background-color: var(--custom-theme-primary) !important;
        color: var(--custom-theme-background) !important;
      }
      
      .selection {
        background-color: var(--custom-theme-accent) !important;
      }
      
      .highlight {
        background-color: var(--custom-theme-warning) !important;
        color: var(--custom-theme-background) !important;
      }
    `;
  }

  getMonokaiStyles() {
    return `
      body, .editor-content {
        background-color: var(--custom-theme-background) !important;
        color: var(--custom-theme-text) !important;
      }
      
      .editor-toolbar, .sidebar, .status-bar {
        background-color: var(--custom-theme-surface) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      code, .code {
        background-color: var(--custom-theme-surface) !important;
        color: var(--custom-theme-primary) !important;
      }
      
      .string {
        color: var(--custom-theme-warning) !important;
      }
      
      .keyword {
        color: var(--custom-theme-accent) !important;
      }
    `;
  }

  getLightCustomStyles() {
    return `
      body, .editor-content {
        background-color: var(--custom-theme-background) !important;
        color: var(--custom-theme-text) !important;
      }
      
      .editor-toolbar, .sidebar, .status-bar {
        background-color: var(--custom-theme-surface) !important;
        border-color: var(--custom-theme-border) !important;
      }
      
      .shadow {
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06) !important;
      }
      
      .btn-primary {
        background-color: var(--custom-theme-primary) !important;
        color: white !important;
      }
      
      .btn-primary:hover {
        background-color: var(--custom-theme-secondary) !important;
      }
    `;
  }
}

// Make plugin available globally for UI interactions
if (typeof window !== 'undefined') {
  window.customThemePlugin = null;
}