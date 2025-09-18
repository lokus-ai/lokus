import React from 'react';
import { createRoot } from 'react-dom/client';
import { PluginContext, UIPanel } from '@lokus/plugin-sdk';
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
  private panel: UIPanel | null = null;
  private root: any = null;

  constructor(context: PluginContext) {
    this.context = context;
    this.context.logger.info('{{pluginNamePascalCase}} plugin initialized');
  }

  /**
   * Activate the plugin
   */
  async activate(): Promise<void> {
    this.context.logger.info('Activating {{pluginName}} plugin...');
    
    try {
      // Register commands
      await this.registerCommands();
      
      // Create UI panel
      await this.createPanel();
      
      this.context.logger.info('{{pluginName}} plugin activated successfully');
    } catch (error) {
      this.context.logger.error('Failed to activate plugin:', error);
      throw error;
    }
  }

  /**
   * Deactivate the plugin
   */
  async deactivate(): Promise<void> {
    this.context.logger.info('Deactivating {{pluginName}} plugin...');
    
    try {
      // Cleanup UI panel
      if (this.root) {
        this.root.unmount();
        this.root = null;
      }
      
      if (this.panel) {
        this.panel.dispose();
        this.panel = null;
      }
      
      this.context.logger.info('{{pluginName}} plugin deactivated successfully');
    } catch (error) {
      this.context.logger.error('Failed to deactivate plugin:', error);
      throw error;
    }
  }

  /**
   * Register plugin commands
   */
  private async registerCommands(): Promise<void> {
    this.context.commands.register('{{pluginName}}.showPanel', {
      title: 'Show {{pluginNamePascalCase}} Panel',
      callback: () => this.showPanel()
    });

    this.context.commands.register('{{pluginName}}.hidePanel', {
      title: 'Hide {{pluginNamePascalCase}} Panel',
      callback: () => this.hidePanel()
    });

    this.context.commands.register('{{pluginName}}.togglePanel', {
      title: 'Toggle {{pluginNamePascalCase}} Panel',
      callback: () => this.togglePanel()
    });
  }

  /**
   * Create the UI panel
   */
  private async createPanel(): Promise<void> {
    this.panel = this.context.ui.createPanel({
      id: '{{pluginName}}-panel',
      title: '{{pluginNamePascalCase}}',
      icon: 'extension',
      position: 'sidebar',
      size: {
        width: 300,
        height: 400
      }
    });

    // Render React component in the panel
    const container = this.panel.getContainer();
    this.root = createRoot(container);
    
    this.root.render(
      <{{pluginNamePascalCase}}Provider context={this.context}>
        <GlobalStyles />
        <{{pluginNamePascalCase}}Panel />
      </{{pluginNamePascalCase}}Provider>
    );
  }

  /**
   * Show the panel
   */
  private showPanel(): void {
    if (this.panel) {
      this.panel.show();
      this.context.logger.debug('Panel shown');
    }
  }

  /**
   * Hide the panel
   */
  private hidePanel(): void {
    if (this.panel) {
      this.panel.hide();
      this.context.logger.debug('Panel hidden');
    }
  }

  /**
   * Toggle panel visibility
   */
  private togglePanel(): void {
    if (this.panel) {
      if (this.panel.isVisible()) {
        this.hidePanel();
      } else {
        this.showPanel();
      }
    }
  }
}

// Plugin entry point
export default function activate(context: PluginContext): {{pluginNamePascalCase}} {
  const plugin = new {{pluginNamePascalCase}}(context);
  plugin.activate();
  return plugin;
}

// Export for deactivation
export function deactivate(plugin: {{pluginNamePascalCase}}): void {
  plugin.deactivate();
}