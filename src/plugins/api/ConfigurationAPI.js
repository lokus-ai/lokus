/**
 * Configuration API - Plugin configuration access
 */
import { EventEmitter } from '../../utils/EventEmitter.js';
import { Disposable } from '../../utils/Disposable.js';

export class ConfigurationAPI extends EventEmitter {
    constructor(configManager) {
        super();
        this.configManager = configManager;
        this.changeListeners = new Set();
    }

    /**
     * Get a configuration value
     * @param {string} key - Configuration key (e.g., "editor.fontSize" or "theme")
     * @param {*} defaultValue - Default value if key doesn't exist
     * @returns {*} Configuration value
     */
    async get(key, defaultValue) {
        if (!this.configManager) return defaultValue;
        return await this.configManager.get(key, defaultValue);
    }

    /**
     * Set a configuration value
     * @param {string} key - Configuration key
     * @param {*} value - Value to set
     */
    async set(key, value) {
        if (!this.configManager) return;
        await this.configManager.update(key, value);
        this._notifyChange(key);
    }

    /**
     * Update a configuration value (alias for set)
     * @param {string} key - Configuration key
     * @param {*} value - Value to set
     */
    async update(key, value) {
        return await this.set(key, value);
    }

    /**
     * Check if a configuration key exists
     * @param {string} key - Configuration key
     * @returns {Promise<boolean>} True if key exists
     */
    async has(key) {
        if (!this.configManager) return false;
        return await this.configManager.has(key);
    }

    /**
     * Inspect a configuration value to see its scope and details
     * @param {string} key - Configuration key
     * @returns {Promise<object>} Configuration inspection details
     */
    async inspect(key) {
        if (!this.configManager) {
            return {
                key,
                defaultValue: undefined,
                globalValue: undefined,
                workspaceValue: undefined,
                workspaceFolderValue: undefined
            };
        }

        const value = await this.configManager.get(key);

        return {
            key,
            defaultValue: undefined,
            globalValue: value,
            workspaceValue: undefined,
            workspaceFolderValue: undefined
        };
    }

    /**
     * Register a configuration change listener
     * @param {Function} callback - Callback function that receives ConfigurationChangeEvent
     * @returns {Disposable} Disposable to unregister the listener
     */
    onDidChange(callback) {
        if (typeof callback !== 'function') {
            throw new Error('Callback must be a function');
        }

        this.changeListeners.add(callback);

        return new Disposable(() => {
            this.changeListeners.delete(callback);
        });
    }

    /**
     * Notify all listeners of a configuration change
     * @private
     */
    _notifyChange(affectedKey) {
        const event = {
            affectsConfiguration: (section) => {
                if (!affectedKey) return false;
                return affectedKey === section || affectedKey.startsWith(section + '.');
            }
        };

        for (const listener of this.changeListeners) {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in configuration change listener:', error);
            }
        }

        this.emit('configuration-changed', event);
    }

    /**
     * Get configuration for a section
     * @param {string} section - Configuration section (e.g., "editor")
     * @returns {object} Configuration object wrapper
     */
    getConfiguration(section) {
        const self = this;

        // Return a configuration object wrapper
        return {
            get: async (key, defaultValue) => {
                if (!self.configManager) return defaultValue;

                const fullKey = section ? `${section}.${key}` : key;
                return await self.configManager.get(fullKey, defaultValue);
            },

            has: async (key) => {
                if (!self.configManager) return false;

                const fullKey = section ? `${section}.${key}` : key;
                return await self.configManager.has(fullKey);
            },

            update: async (key, value, target) => {
                if (!self.configManager) return;

                const fullKey = section ? `${section}.${key}` : key;
                await self.configManager.update(fullKey, value, target);
                self._notifyChange(fullKey);
            }
        };
    }
}
