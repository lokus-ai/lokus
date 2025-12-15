import { PluginContext, Logger } from '@lokus/plugin-sdk';

/**
 * A word count plugin for Lokus
 * 
 * @author Lokus Dev
 * @version 0.1.0
 */
export class LokusWordCount {
  private logger: Logger;
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
    this.logger = context.logger;
    
    this.logger.info('LokusWordCount plugin initialized');
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.logger.info('Activating lokus-word-count plugin...');
    
    try {
      // Register plugin commands
      await this.registerCommands();
      
      // Initialize plugin features
      await this.initialize();
      
      this.logger.info('lokus-word-count plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate plugin:', error);
      throw error;
    }
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.logger.info('Deactivating lokus-word-count plugin...');
    
    try {
      // Cleanup plugin resources
      await this.cleanup();
      
      this.logger.info('lokus-word-count plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Failed to deactivate plugin:', error);
      throw error;
    }
  }

  /**
   * Register plugin commands
   */
  private async registerCommands(): Promise<void> {
    // Register your plugin commands here
    this.context.commands.register('lokus-word-count.helloWorld', {
      title: 'Hello World',
      callback: () => this.helloWorld()
    });
  }

  /**
   * Initialize plugin features
   */
  private async initialize(): Promise<void> {
    // Initialize your plugin features here
    this.logger.debug('Plugin features initialized');
  }

  /**
   * Cleanup plugin resources
   */
  private async cleanup(): Promise<void> {
    // Cleanup your plugin resources here
    this.logger.debug('Plugin resources cleaned up');
  }

  /**
   * Example command: Hello World
   */
  private helloWorld(): void {
    this.context.ui.showMessage('Hello World from lokus-word-count!', 'info');
    this.logger.info('Hello World command executed');
  }
}

// Plugin entry point
export default function activate(context: PluginContext): LokusWordCount {
  const plugin = new LokusWordCount(context);
  plugin.activate();
  return plugin;
}

// Export for deactivation
export function deactivate(plugin: LokusWordCount): void {
  plugin.deactivate();
}