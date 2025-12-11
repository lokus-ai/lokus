import { BasePlugin, PluginContext, PluginActivationContext } from 'lokus-plugin-sdk';
import { {{ pluginNamePascalCase }}Panel } from './panel';
import { {{ pluginNamePascalCase }}StatusItem } from './status-item';

/**
 * {{pluginNamePascalCase}} - {{description}}
 * 
 * A UI extension plugin that demonstrates custom panels, status bar items,
 * and user interface integration with Lokus.
 * 
 * @author {{author}}
 * @version 0.1.0
 */
export class {{ pluginNamePascalCase }} extends BasePlugin {
  private panel ?: {{ pluginNamePascalCase }
} Panel;
  private statusItem ?: {{ pluginNamePascalCase }}StatusItem;

constructor(context: PluginContext) {
  super(context);
  this.logger.info('{{pluginNamePascalCase}} UI plugin initialized');
}

  async activate(context: PluginActivationContext): Promise < void> {
  this.logger.info('Activating {{pluginNamePascalCase}} UI plugin...');

  try {
    // Register commands
    await this.registerCommands(context);

    // Initialize UI components
    await this.initializeUI(context);

    // Register webview panel
    await this.registerWebviewPanel(context);

    this.logger.info('{{pluginNamePascalCase}} UI plugin activated successfully');
  } catch(error) {
    this.logger.error('Failed to activate UI plugin:', error);
    throw error;
  }
}

  async deactivate(): Promise < void> {
  this.logger.info('Deactivating {{pluginNamePascalCase}} UI plugin...');

  try {
    // Clean up UI components
    if(this.panel) {
  this.panel.dispose();
}

if (this.statusItem) {
  this.statusItem.dispose();
}

this.logger.info('{{pluginNamePascalCase}} UI plugin deactivated successfully');
    } catch (error) {
  this.logger.error('Error during UI plugin deactivation:', error);
}
  }

  private async registerCommands(context: PluginActivationContext): Promise < void> {
  // Register show panel command
  const showPanelDisposable = context.commands.registerCommand(
    '{{pluginNameCamelCase}}.showPanel',
    () => this.showPanel()
  );

  // Register toggle status command
  const toggleStatusDisposable = context.commands.registerCommand(
    '{{pluginNameCamelCase}}.toggleStatus',
    () => this.toggleStatusItem()
  );

  // Register refresh command
  const refreshDisposable = context.commands.registerCommand(
    '{{pluginNameCamelCase}}.refresh',
    () => this.refreshData()
  );

  this.disposables.add(showPanelDisposable, toggleStatusDisposable, refreshDisposable);
}

  private async initializeUI(context: PluginActivationContext): Promise < void> {
  // Create status bar item
  this.statusItem = new {{ pluginNamePascalCase }}StatusItem(this.context);
this.statusItem.show();

// Initialize panel (but don't show it yet)
this.panel = new {{ pluginNamePascalCase }}Panel(this.context);
  }

  private async registerWebviewPanel(context: PluginActivationContext): Promise < void> {
  // Register webview panel provider
  const panelProvider = context.ui.registerWebviewPanelProvider(
    '{{pluginNameCamelCase}}.panel',
    {
      title: '{{pluginNamePascalCase}}',
      iconPath: 'assets/icon.svg',
      enableScripts: true,
      retainContextWhenHidden: true
    },
    (panel) => {
      if (this.panel) {
        this.panel.setWebviewPanel(panel);
      }
    }
  );

  this.disposables.add(panelProvider);
}

  private showPanel(): void {
  if(this.panel) {
  this.panel.show();
  this.logger.info('{{pluginNamePascalCase}} panel shown');
}
  }

  private toggleStatusItem(): void {
  if(this.statusItem) {
  this.statusItem.toggle();
  this.logger.info('Status item toggled');
}
  }

  private refreshData(): void {
  if(this.panel) {
  this.panel.refresh();
}

if (this.statusItem) {
  this.statusItem.update();
}

this.context.ui.showInformationMessage('{{pluginNamePascalCase}} data refreshed');
this.logger.info('Data refreshed');
  }
}

export default {{ pluginNamePascalCase }};