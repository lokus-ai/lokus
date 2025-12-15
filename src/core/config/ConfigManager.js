import { readConfig, updateConfig } from './store.js';

class ConfigManager {
    async get(key, defaultValue) {
        const config = await readConfig();
        return config[key] !== undefined ? config[key] : defaultValue;
    }

    async has(key) {
        const config = await readConfig();
        return config[key] !== undefined;
    }

    async update(key, value, target) {
        // Target is ignored for now, always global
        await updateConfig({ [key]: value });
    }
}

export const configManager = new ConfigManager();
