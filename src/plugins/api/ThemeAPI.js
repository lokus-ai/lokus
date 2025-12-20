/**
 * ThemeAPI - Theme registration and management
 *
 * SECURITY: All methods are permission-gated
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';
import { permissionEnforcer } from '../security/PermissionEnforcer.js';

export class ThemeAPI extends EventEmitter {
    constructor(themeManager) {
        super();
        this.themeManager = themeManager;
        this.themes = new Map();
        this.activeThemeId = null;

        // Permission context
        this.currentPluginId = null;
        this.grantedPermissions = new Set();
        this.workspacePath = null;
    }

    /**
     * Set permission context for this API instance
     * @param {string} pluginId - Plugin identifier
     * @param {Set<string>} permissions - Granted permissions
     * @param {string} workspacePath - Workspace root path for scoping
     */
    _setPermissionContext(pluginId, permissions, workspacePath) {
        this.currentPluginId = pluginId;
        this.grantedPermissions = permissions || new Set();
        this.workspacePath = workspacePath;
    }

    /**
     * Require a permission - throws if not granted
     * @param {string} apiMethod - API method name for logging
     * @param {string} permission - Required permission
     */
    _requirePermission(apiMethod, permission) {
        permissionEnforcer.requirePermission(
            this.currentPluginId,
            this.grantedPermissions,
            permission,
            apiMethod
        );
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
        this._requirePermission('themes.registerTheme', 'themes:register');

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
        this._requirePermission('themes.getActiveTheme', 'themes:read');

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
        this._requirePermission('themes.setActiveTheme', 'themes:set');

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
        this._requirePermission('themes.getThemes', 'themes:read');

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
        this._requirePermission('themes.getTheme', 'themes:read');

        return this.themes.get(themeId);
    }

    /**
     * Subscribe to active theme changes
     * @param {Function} listener - Callback function
     * @returns {Disposable} Disposable to unsubscribe
     */
    onDidChangeActiveTheme(listener) {
        this._requirePermission('themes.onDidChangeActiveTheme', 'events:listen');

        const handler = (event) => listener(event);
        this.on('did_change_active_theme', handler);
        return new Disposable(() => this.off('did_change_active_theme', handler));
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
