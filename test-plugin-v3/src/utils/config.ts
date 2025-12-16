import { PluginContext } from '@lokus/plugin-sdk';
import { TestPluginV3Config, TestPluginV3Options } from '../types';

/**
 * Configuration manager for test-plugin-v3
 */
export class TestPluginV3ConfigManager {
  private context: PluginContext;
  private configKey = 'test-plugin-v3.config';

  constructor(context: PluginContext) {
    this.context = context;
  }

  /**
   * Get plugin configuration
   */
  getConfig(): TestPluginV3Config {
    const defaultConfig: TestPluginV3Config = {
      enabled: true,
      options: {
        autoActivate: true,
        logLevel: 'info'
      }
    };

    const userConfig = this.context.configuration.get<Partial<TestPluginV3Config>>(this.configKey);
    
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
  async updateConfig(config: Partial<TestPluginV3Config>): Promise<void> {
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
  getOption<K extends keyof TestPluginV3Options>(
    key: K
  ): TestPluginV3Options[K] {
    const config = this.getConfig();
    return config.options[key];
  }

  /**
   * Update specific option
   */
  async updateOption<K extends keyof TestPluginV3Options>(
    key: K,
    value: TestPluginV3Options[K]
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
  onConfigChange(callback: (config: TestPluginV3Config) => void): void {
    this.context.configuration.onDidChange(this.configKey, () => {
      const config = this.getConfig();
      callback(config);
    });
  }

  /**
   * Validate configuration
   */
  validateConfig(config: Partial<TestPluginV3Config>): boolean {
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