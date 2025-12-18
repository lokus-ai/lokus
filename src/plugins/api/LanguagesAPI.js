/**
 * Languages API - Language features support
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

export class LanguagesAPI extends EventEmitter {
    constructor(languageManager) {
        super();
        this.languageManager = languageManager;
        this.providers = new Map();
        this.languages = new Map();
        this.configurations = new Map();
    }

    /**
     * Register completion provider
     */
    registerCompletionProvider(selector, provider, ...triggerCharacters) {
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
        const unsubscribe = this.on('did_change_languages', listener);
        return new Disposable(unsubscribe);
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
