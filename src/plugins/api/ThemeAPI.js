/**
 * ThemeAPI - Theme registration and management
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

export class ThemeAPI extends EventEmitter {
    constructor(themeManager) {
        super();
        this.themeManager = themeManager;
        this.themes = new Map();
        this.activeThemeId = null;
    }

    /**
     * Register a theme
     * @param {Object} theme - Theme contribution
     * @param {string} theme.id - Unique theme identifier
     * @param {string} theme.label - Display name
     * @param {string} theme.uiTheme - Base theme type ('vs', 'vs-dark', 'hc-black', 'hc-light')
     * @param {string} [theme.path] - Path to theme file
     * @param {Record<string, string>} [theme.colors] - Color customizations
     * @param {Array} [theme.tokenColors] - Token color rules
     * @returns {Disposable} Disposable to unregister the theme
     */
    registerTheme(theme) {
        if (!theme.id) {
            throw new Error('Theme must have an id');
        }

        if (!theme.label) {
            throw new Error('Theme must have a label');
        }

        if (!theme.uiTheme || !['vs', 'vs-dark', 'hc-black', 'hc-light'].includes(theme.uiTheme)) {
            throw new Error("Theme uiTheme must be one of: 'vs', 'vs-dark', 'hc-black', 'hc-light'");
        }

        if (this.themes.has(theme.id)) {
            throw new Error(`Theme '${theme.id}' already exists`);
        }

        const themeContribution = {
            id: theme.id,
            label: theme.label,
            uiTheme: theme.uiTheme,
            path: theme.path,
            colors: theme.colors || {},
            tokenColors: theme.tokenColors || [],
            pluginId: this.currentPluginId
        };

        this.themes.set(theme.id, themeContribution);

        // Register with theme manager if available
        if (this.themeManager && typeof this.themeManager.registerTheme === 'function') {
            this.themeManager.registerTheme(themeContribution);
        }

        this.emit('theme_registered', { id: theme.id, theme: themeContribution });

        return new Disposable(() => {
            this.themes.delete(theme.id);
            if (this.themeManager && typeof this.themeManager.unregisterTheme === 'function') {
                this.themeManager.unregisterTheme(theme.id);
            }
            this.emit('theme_unregistered', { id: theme.id });
        });
    }

    /**
     * Get the active theme ID
     * @returns {Promise<string>} The active theme ID
     */
    async getActiveTheme() {
        if (this.themeManager && typeof this.themeManager.getActiveTheme === 'function') {
            return this.themeManager.getActiveTheme();
        }
        return this.activeThemeId || 'vs-dark';
    }

    /**
     * Set the active theme
     * @param {string} themeId - Theme ID to activate
     * @returns {Promise<void>}
     */
    async setActiveTheme(themeId) {
        if (!this.themes.has(themeId)) {
            throw new Error(`Theme '${themeId}' not found`);
        }

        const previousThemeId = this.activeThemeId;
        this.activeThemeId = themeId;

        if (this.themeManager && typeof this.themeManager.setActiveTheme === 'function') {
            await this.themeManager.setActiveTheme(themeId);
        }

        this.emit('did_change_active_theme', {
            themeId,
            previousThemeId
        });
    }

    /**
     * Get all registered themes
     * @returns {Array<Object>} Array of theme contributions
     */
    getThemes() {
        return Array.from(this.themes.values()).map(theme => ({
            id: theme.id,
            label: theme.label,
            uiTheme: theme.uiTheme,
            pluginId: theme.pluginId
        }));
    }

    /**
     * Get a specific theme by ID
     * @param {string} themeId - Theme ID
     * @returns {Object|undefined} Theme contribution or undefined
     */
    getTheme(themeId) {
        return this.themes.get(themeId);
    }

    /**
     * Subscribe to active theme changes
     * @param {Function} listener - Callback function
     * @returns {Disposable} Disposable to unsubscribe
     */
    onDidChangeActiveTheme(listener) {
        const unsubscribe = this.on('did_change_active_theme', listener);
        return new Disposable(unsubscribe);
    }

    /**
     * Cleanup all themes for a plugin
     * @param {string} pluginId - Plugin ID
     */
    unregisterAll(pluginId) {
        for (const [id, theme] of this.themes) {
            if (theme.pluginId === pluginId) {
                this.themes.delete(id);
                if (this.themeManager && typeof this.themeManager.unregisterTheme === 'function') {
                    this.themeManager.unregisterTheme(id);
                }
                this.emit('theme_unregistered', { id });
            }
        }
    }
}
