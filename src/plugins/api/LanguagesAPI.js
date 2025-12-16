/**
 * Languages API - Language features support
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class LanguagesAPI extends EventEmitter {
    constructor(languageManager) {
        super();
        this.languageManager = languageManager;
        this.providers = new Map();
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
}
