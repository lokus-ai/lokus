import React from 'react';
import { createRoot } from 'react-dom/client';
import { PluginContext, WebviewPanel } from 'lokus-plugin-sdk';
import { {{pluginNamePascalCase}}Panel } from './components/{{pluginNamePascalCase}}Panel';
import { {{pluginNamePascalCase}}Provider } from './contexts/{{pluginNamePascalCase}}Context';
import { GlobalStyles } from './styles/GlobalStyles';

/**
 * {{description}}
 *
 * @author {{author}}
 * @version 0.1.0
 */
export class {{pluginNamePascalCase}} {
  private context: PluginContext;
  private panel: WebviewPanel | null = null;

  constructor(context: PluginContext) {
    this.context = context;
    this.context.api.log(1, '{{pluginNamePascalCase}} plugin initialized');
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.context.api.log(1, 'Activating {{pluginName}} plugin...');

    try {
      // Register commands
      await this.registerCommands();

      // Create UI panel
      await this.createPanel();

      this.context.api.log(1, '{{pluginName}} plugin activated successfully');
    } catch (error: any) {
      this.context.api.log(4, 'Failed to activate plugin:', error);
      throw error;
    }
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.context.api.log(1, 'Deactivating {{pluginName}} plugin...');

    try {
      // Cleanup UI panel
      if (this.panel) {
        this.panel.dispose();
        this.panel = null;
      }

      this.context.api.log(1, '{{pluginName}} plugin deactivated successfully');
    } catch (error: any) {
      this.context.api.log(4, 'Failed to deactivate plugin:', error);
      throw error;
    }
  }

  /**
   * Register plugin commands
   */
  private async registerCommands(): Promise<void> {
    this.context.api.commands.register({
      id: '{{pluginName}}.showPanel',
      title: 'Show {{pluginNamePascalCase}} Panel',
      handler: () => this.showPanel()
    });

    this.context.api.commands.register({
      id: '{{pluginName}}.hidePanel',
      title: 'Hide {{pluginNamePascalCase}} Panel',
      handler: () => this.hidePanel()
    });

    this.context.api.commands.register({
      id: '{{pluginName}}.togglePanel',
      title: 'Toggle {{pluginNamePascalCase}} Panel',
      handler: () => this.togglePanel()
    });
  }

  /**
   * Create the UI panel
   */
  private async createPanel(): Promise<void> {
    this.panel = this.context.api.ui.registerWebviewPanel({
      id: '{{pluginName}}-panel',
      title: '{{pluginNamePascalCase}}',
      type: 'webview',
      location: 'sidebar',
      icon: 'extension',
      html: '<div>Loading...</div>' // TODO: Inject React app here
    });

    // TODO: Implement React rendering via Webview HTML injection
    /*
    // Render React component in the panel
    const container = this.panel.getContainer();
    this.root = createRoot(container);

    this.root.render(
      <{{pluginNamePascalCase}}Provider context={this.context}>
        <GlobalStyles />
        <{{pluginNamePascalCase}}Panel />
      </{{pluginNamePascalCase}}Provider>
    );
    */
  }

  /**
   * Show the panel
   */
  private showPanel(): void {
    if (this.panel) {
      this.panel.reveal();
      this.context.api.log(1, 'Panel shown');
    }
  }

  /**
   * Hide the panel
   */
  private hidePanel(): void {
    if (this.panel) {
      // WebviewPanel doesn't have hide(), only dispose() or close?
      // Assuming dispose for now or just ignore
      // this.panel.dispose();
      this.context.api.log(1, 'Panel hidden');
    }
  }

  /**
   * Toggle panel visibility
   */
  private togglePanel(): void {
    if (this.panel) {
      if (this.panel.visible) {
        this.hidePanel();
      } else {
        this.showPanel();
      }
    }
  }
}

export function activate(context: PluginContext): {{pluginNamePascalCase}} {
  const plugin = new {{pluginNamePascalCase}}(context);
  plugin.activate();
  return plugin;
}

// Export for deactivation
export function deactivate(plugin: {{pluginNamePascalCase}}): void {
  plugin.deactivate();
}
