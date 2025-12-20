/**
 * Languages API - Language features support
 *
 * SECURITY: All methods are permission-gated
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';
import { permissionEnforcer } from '../security/PermissionEnforcer.js';

export class LanguagesAPI extends EventEmitter {
    constructor(languageManager) {
        super();
        this.languageManager = languageManager;
        this.providers = new Map();
        this.languages = new Map();
        this.configurations = new Map();

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
     * Register completion provider
     */
    registerCompletionProvider(selector, provider, ...triggerCharacters) {
        this._requirePermission('languages.registerCompletionProvider', 'languages:register');

        const id = `completion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'completion',
            selector,
            provider,
            triggerCharacters,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        // TODO: Register with actual language service/TipTap

        return {
            dispose: () => {
                this.providers.delete(id);
            }
        };
    }

    /**
     * Register hover provider
     */
    registerHoverProvider(selector, provider) {
        this._requirePermission('languages.registerHoverProvider', 'languages:register');

        const id = `hover_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'hover',
            selector,
            provider,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        return {
            dispose: () => {
                this.providers.delete(id);
            }
        };
    }

    /**
     * Register definition provider
     */
    registerDefinitionProvider(selector, provider) {
        this._requirePermission('languages.registerDefinitionProvider', 'languages:register');

        const id = `definition_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'definition',
            selector,
            provider,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        return {
            dispose: () => {
                this.providers.delete(id);
            }
        };
    }

    /**
     * Register code action provider
     */
    registerCodeActionProvider(selector, provider, metadata) {
        this._requirePermission('languages.registerCodeActionProvider', 'languages:register');

        const id = `codeaction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'codeAction',
            selector,
            provider,
            metadata,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        return {
            dispose: () => {
                this.providers.delete(id);
            }
        };
    }

    /**
     * Register document formatting provider
     * @param {DocumentSelector} selector - Document selector
     * @param {Object} provider - Formatting provider
     * @returns {Disposable} Disposable to unregister
     */
    registerDocumentFormattingProvider(selector, provider) {
        this._requirePermission('languages.registerDocumentFormattingProvider', 'languages:register');

        const id = `formatting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'formatting',
            selector,
            provider,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        return new Disposable(() => {
            this.providers.delete(id);
        });
    }

    /**
     * Register range formatting provider
     * @param {DocumentSelector} selector - Document selector
     * @param {Object} provider - Range formatting provider
     * @returns {Disposable} Disposable to unregister
     */
    registerRangeFormattingProvider(selector, provider) {
        this._requirePermission('languages.registerRangeFormattingProvider', 'languages:register');

        const id = `rangeformatting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const registration = {
            id,
            type: 'rangeFormatting',
            selector,
            provider,
            pluginId: this.currentPluginId
        };

        this.providers.set(id, registration);

        return new Disposable(() => {
            this.providers.delete(id);
        });
    }

    /**
     * Get all registered languages
     * @returns {Array<Object>} Array of language definitions
     */
    getLanguages() {
        this._requirePermission('languages.getLanguages', 'languages:read');

        return Array.from(this.languages.values()).map(lang => ({
            id: lang.id,
            extensions: lang.extensions,
            aliases: lang.aliases,
            configuration: lang.configuration
        }));
    }

    /**
     * Set language configuration
     * @param {string} languageId - Language identifier
     * @param {Object} configuration - Language configuration
     * @param {Object} [configuration.comments] - Comment configuration
     * @param {Object} [configuration.brackets] - Bracket configuration
     * @param {Object} [configuration.autoClosingPairs] - Auto-closing pairs
     * @param {Object} [configuration.surroundingPairs] - Surrounding pairs
     * @param {string} [configuration.wordPattern] - Word pattern regex
     * @returns {Disposable} Disposable to unregister
     */
    setLanguageConfiguration(languageId, configuration) {
        this._requirePermission('languages.setLanguageConfiguration', 'languages:register');

        if (!languageId) {
            throw new Error('Language ID is required');
        }

        const config = {
            languageId,
            configuration,
            pluginId: this.currentPluginId
        };

        this.configurations.set(languageId, config);

        if (this.languageManager && typeof this.languageManager.setLanguageConfiguration === 'function') {
            this.languageManager.setLanguageConfiguration(languageId, configuration);
        }

        this.emit('language_configuration_set', { languageId, configuration });

        return new Disposable(() => {
            this.configurations.delete(languageId);
            if (this.languageManager && typeof this.languageManager.removeLanguageConfiguration === 'function') {
                this.languageManager.removeLanguageConfiguration(languageId);
            }
            this.emit('language_configuration_removed', { languageId });
        });
    }

    /**
     * Register a language
     * @param {Object} language - Language definition
     * @param {string} language.id - Language identifier
     * @param {Array<string>} [language.extensions] - File extensions
     * @param {Array<string>} [language.aliases] - Language aliases
     * @param {Object} [language.configuration] - Language configuration
     * @returns {Disposable} Disposable to unregister
     */
    registerLanguage(language) {
        this._requirePermission('languages.registerLanguage', 'languages:register');

        if (!language.id) {
            throw new Error('Language must have an id');
        }

        if (this.languages.has(language.id)) {
            throw new Error(`Language '${language.id}' already exists`);
        }

        const languageDefinition = {
            id: language.id,
            extensions: language.extensions || [],
            aliases: language.aliases || [],
            configuration: language.configuration,
            pluginId: this.currentPluginId
        };

        this.languages.set(language.id, languageDefinition);

        if (this.languageManager && typeof this.languageManager.registerLanguage === 'function') {
            this.languageManager.registerLanguage(languageDefinition);
        }

        this.emit('language_registered', { language: languageDefinition });
        this.emit('did_change_languages');

        return new Disposable(() => {
            this.languages.delete(language.id);
            if (this.languageManager && typeof this.languageManager.unregisterLanguage === 'function') {
                this.languageManager.unregisterLanguage(language.id);
            }
            this.emit('language_unregistered', { languageId: language.id });
            this.emit('did_change_languages');
        });
    }

    /**
     * Subscribe to language changes
     * @param {Function} listener - Callback function
     * @returns {Disposable} Disposable to unsubscribe
     */
    onDidChangeLanguages(listener) {
        this._requirePermission('languages.onDidChangeLanguages', 'events:listen');

        const handler = () => listener();
        this.on('did_change_languages', handler);
        return new Disposable(() => this.off('did_change_languages', handler));
    }

    /**
     * Cleanup all providers and languages for a plugin
     * @param {string} pluginId - Plugin ID
     */
    unregisterAll(pluginId) {
        // Remove providers
        for (const [id, provider] of this.providers) {
            if (provider.pluginId === pluginId) {
                this.providers.delete(id);
            }
        }

        // Remove languages
        for (const [id, language] of this.languages) {
            if (language.pluginId === pluginId) {
                this.languages.delete(id);
                if (this.languageManager && typeof this.languageManager.unregisterLanguage === 'function') {
                    this.languageManager.unregisterLanguage(id);
                }
            }
        }

        // Remove configurations
        for (const [id, config] of this.configurations) {
            if (config.pluginId === pluginId) {
                this.configurations.delete(id);
                if (this.languageManager && typeof this.languageManager.removeLanguageConfiguration === 'function') {
                    this.languageManager.removeLanguageConfiguration(id);
                }
            }
        }

        this.emit('did_change_languages');
    }
}
