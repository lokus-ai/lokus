import { PluginContext } from '@lokus/plugin-sdk';
import { {{pluginNamePascalCase}}Config, {{pluginNamePascalCase}}Options } from '../types';

/**
 * Configuration manager for {{pluginName}}
 */
export class {{pluginNamePascalCase}}ConfigManager {
  private context: PluginContext;
  private configKey = '{{pluginName}}.config';

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Get plugin configuration
   */
  getConfig(): {{pluginNamePascalCase}}Config {
    const defaultConfig: {{pluginNamePascalCase}}Config = {
      enabled: true,
      options: {
        autoActivate: true,
        logLevel: 'info'
      }
    };

    const userConfig = this.context.configuration.get<Partial<{{pluginNamePascalCase}}Config>>(this.configKey);
    
    return {
      ...defaultConfig,
      ...userConfig,
      options: {
        ...defaultConfig.options,
        ...userConfig?.options
      }
    };
  }

  /**
   * Update plugin configuration
   */
  async updateConfig(config: Partial<{{pluginNamePascalCase}}Config>): Promise<void> {
    const currentConfig = this.getConfig();
    const newConfig = {
      ...currentConfig,
      ...config,
      options: {
        ...currentConfig.options,
        ...config.options
      }
    };

    await this.context.configuration.update(this.configKey, newConfig);
  }

  /**
   * Get specific option value
   */
  getOption<K extends keyof {{pluginNamePascalCase}}Options>(
    key: K
  ): {{pluginNamePascalCase}}Options[K] {
    const config = this.getConfig();
    return config.options[key];
  }

  /**
   * Update specific option
   */
  async updateOption<K extends keyof {{pluginNamePascalCase}}Options>(
    key: K,
    value: {{pluginNamePascalCase}}Options[K]
  ): Promise<void> {
    const config = this.getConfig();
    await this.updateConfig({
      options: {
        ...config.options,
        [key]: value
      }
    });
  }

  /**
   * Reset configuration to defaults
   */
  async resetConfig(): Promise<void> {
    await this.context.configuration.update(this.configKey, undefined);
  }

  /**
   * Watch for configuration changes
   */
  onConfigChange(callback: (config: {{pluginNamePascalCase}}Config) => void): void {
    this.context.configuration.onDidChange(this.configKey, () => {
      const config = this.getConfig();
      callback(config);
    });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<{{pluginNamePascalCase}}Config>): boolean {
    try {
      // Add your validation logic here
      if (config.options?.logLevel) {
        const validLevels = ['debug', 'info', 'warn', 'error'];
        if (!validLevels.includes(config.options.logLevel)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }
}