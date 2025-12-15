/**
 * Configuration API - Plugin configuration access
 */
import { EventEmitter } from '../../utils/EventEmitter.js';

export class ConfigurationAPI extends EventEmitter {
    constructor(configManager) {
        super();
        this.configManager = configManager;
    }

    /**
     * Get configuration for a section
     */
    getConfiguration(section) {
        // Return a configuration object wrapper
        return {
            get: (key, defaultValue) => {
                if (!this.configManager) return defaultValue;

                const fullKey = section ? `${section}.${key}` : key;
                return this.configManager.get(fullKey, defaultValue);
            },

            has: (key) => {
                if (!this.configManager) return false;

                const fullKey = section ? `${section}.${key}` : key;
                return this.configManager.has(fullKey);
            },

            update: async (key, value, target) => {
                if (!this.configManager) return;

                const fullKey = section ? `${section}.${key}` : key;
                await this.configManager.update(fullKey, value, target);
            }
        };
    }
}
