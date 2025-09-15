import { BasePlugin, PluginContext, PluginActivationContext } from '@lokus/plugin-sdk';

/**
 * {{pluginNamePascalCase}} - {{description}}
 * 
 * A basic Lokus plugin that demonstrates the fundamental plugin structure
 * and lifecycle methods.
 * 
 * @author {{author}}
 * @version 0.1.0
 */
export class {{pluginNamePascalCase}} extends BasePlugin {
  constructor(context: PluginContext) {
    super(context);
    this.logger.info('{{pluginNamePascalCase}} plugin initialized');
  }

  /**
   * Plugin activation lifecycle method.
   * Called when the plugin is activated by Lokus.
   */
  async activate(context: PluginActivationContext): Promise<void> {
    this.logger.info('Activating {{pluginNamePascalCase}} plugin...');

    try {
      // Register any commands, menu items, or other contributions here
      await this.registerContributions(context);
      
      // Initialize plugin-specific features
      await this.initializeFeatures();
      
      this.logger.info('{{pluginNamePascalCase}} plugin activated successfully');
    } catch (error) {
      this.logger.error('Failed to activate plugin:', error);
      throw error;
    }
  }

  /**
   * Plugin deactivation lifecycle method.
   * Called when the plugin is deactivated or Lokus is shutting down.
   */
  async deactivate(): Promise<void> {
    this.logger.info('Deactivating {{pluginNamePascalCase}} plugin...');

    try {
      // Clean up resources, remove event listeners, etc.
      await this.cleanup();
      
      this.logger.info('{{pluginNamePascalCase}} plugin deactivated successfully');
    } catch (error) {
      this.logger.error('Error during plugin deactivation:', error);
    }
  }

  /**
   * Register plugin contributions (commands, menus, etc.)
   */
  private async registerContributions(context: PluginActivationContext): Promise<void> {
    // Example: Register a command
    const disposable = context.commands.registerCommand('{{pluginNameCamelCase}}.helloWorld', () => {
      this.showHelloWorldMessage();
    });

    // Add to disposables for automatic cleanup
    this.disposables.add(disposable);
  }

  /**
   * Initialize plugin-specific features
   */
  private async initializeFeatures(): Promise<void> {
    // Add your plugin initialization logic here
    this.logger.debug('Initializing plugin features...');
    
    // Example: Set up configuration listeners
    this.config.onDidChange('{{pluginNameCamelCase}}', (newValue, oldValue) => {
      this.logger.info('Configuration changed:', { newValue, oldValue });
    });
  }

  /**
   * Clean up plugin resources
   */
  private async cleanup(): Promise<void> {
    this.logger.debug('Cleaning up plugin resources...');
    // All disposables are automatically cleaned up by the base class
  }

  /**
   * Show a hello world message to the user
   */
  private showHelloWorldMessage(): void {
    const message = 'Hello from {{pluginNamePascalCase}} plugin!';
    
    // Show notification
    this.context.ui.showInformationMessage(message);
    
    // Log the action
    this.logger.info('Hello World command executed');
  }
}

// Export the plugin class as default for dynamic loading
export default {{pluginNamePascalCase}};