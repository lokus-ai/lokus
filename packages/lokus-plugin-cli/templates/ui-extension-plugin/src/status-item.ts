import { PluginContext, StatusBarItem, Disposable } from '@lokus/plugin-sdk';

export class {{pluginNamePascalCase}}StatusItem implements Disposable {
  private statusBarItem: StatusBarItem;
  private isVisible = false;
  private disposables: Disposable[] = [];

  constructor(private context: PluginContext) {
    // Create status bar item
    this.statusBarItem = this.context.ui.createStatusBarItem('left', 100);
    this.setupStatusItem();
    this.setupEventListeners();
  }

  public show(): void {
    if (!this.isVisible) {
      this.statusBarItem.show();
      this.isVisible = true;
      this.update();
    }
  }

  public hide(): void {
    if (this.isVisible) {
      this.statusBarItem.hide();
      this.isVisible = false;
    }
  }

  public toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }

  public update(): void {
    if (!this.isVisible) return;

    const config = this.context.config.get('{{pluginNameCamelCase}}', {});
    const isEnabled = config.enableFeature !== false;
    
    // Update status based on configuration
    if (isEnabled) {
      this.statusBarItem.text = '$(check) {{pluginNamePascalCase}}';
      this.statusBarItem.tooltip = '{{pluginNamePascalCase}} is enabled';
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = '$(x) {{pluginNamePascalCase}}';
      this.statusBarItem.tooltip = '{{pluginNamePascalCase}} is disabled';
      this.statusBarItem.backgroundColor = 'statusBarItem.warningBackground';
    }
  }

  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.statusBarItem.dispose();
  }

  private setupStatusItem(): void {
    this.statusBarItem.text = '$(gear) {{pluginNamePascalCase}}';
    this.statusBarItem.tooltip = 'Click to open {{pluginNamePascalCase}} panel';
    this.statusBarItem.command = '{{pluginNameCamelCase}}.showPanel';
  }

  private setupEventListeners(): void {
    // Listen for configuration changes
    const configDisposable = this.context.config.onDidChange('{{pluginNameCamelCase}}', () => {
      this.update();
    });

    // Listen for workspace changes
    const workspaceDisposable = this.context.workspace.onDidChangeWorkspace(() => {
      this.update();
    });

    this.disposables.push(configDisposable, workspaceDisposable);
  }
}