import { PluginContext, WebviewPanel, Disposable } from 'lokus-plugin-sdk';

export class {{ pluginNamePascalCase }}Panel implements Disposable {
  private webviewPanel ?: WebviewPanel;
  private disposables: Disposable[] = [];

  constructor(private context: PluginContext) {
    this.setupEventListeners();
  }

  public setWebviewPanel(panel: WebviewPanel): void {
    this.webviewPanel = panel;
    this.setupWebview();
  }

  public show(): void {
    if(this.webviewPanel) {
    this.webviewPanel.reveal();
  } else {
    // Create new panel if none exists
    this.context.ui.createWebviewPanel(
      '{{pluginNameCamelCase}}.panel',
      '{{pluginNamePascalCase}}',
      'aside',
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    ).then(panel => {
      this.setWebviewPanel(panel);
      panel.reveal();
    });
  }
}

  public refresh(): void {
  if(this.webviewPanel) {
  this.updateWebviewContent();
}
  }

  public dispose(): void {
  this.disposables.forEach(d => d.dispose());
  this.disposables = [];

  if(this.webviewPanel) {
  this.webviewPanel.dispose();
}
  }

  private setupEventListeners(): void {
  // Listen for configuration changes
  const configDisposable = this.context.config.onDidChange('{{pluginNameCamelCase}}', () => {
    this.refresh();
  });

  this.disposables.push(configDisposable);
}

  private setupWebview(): void {
  if(!this.webviewPanel) return;

  // Handle messages from webview
  const messageDisposable = this.webviewPanel.onDidReceiveMessage(message => {
    this.handleWebviewMessage(message);
  });

  // Handle panel disposal
  const disposeDisposable = this.webviewPanel.onDidDispose(() => {
    this.webviewPanel = undefined;
  });

  this.disposables.push(messageDisposable, disposeDisposable);

  // Set initial content
  this.updateWebviewContent();
}

  private updateWebviewContent(): void {
  if(!this.webviewPanel) return;

  const config = this.context.config.get('{{pluginNameCamelCase}}', {});

  this.webviewPanel.webview.html = this.getWebviewContent(config);
}

  private getWebviewContent(config: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{pluginNamePascalCase}}</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
            margin: 0;
        }
        
        .header {
            border-bottom: 1px solid var(--vscode-panel-border);
            padding-bottom: 15px;
            margin-bottom: 20px;
        }
        
        .header h1 {
            margin: 0;
            color: var(--vscode-titleBar-activeForeground);
        }
        
        .content {
            display: flex;
            flex-direction: column;
            gap: 15px;
        }
        
        .card {
            background-color: var(--vscode-editor-inactiveSelectionBackground);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 15px;
        }
        
        .card h3 {
            margin-top: 0;
            color: var(--vscode-textPreformat-foreground);
        }
        
        .button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: var(--vscode-font-size);
        }
        
        .button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }
        
        .input {
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 10px;
            border-radius: 3px;
            font-size: var(--vscode-font-size);
            width: 100%;
            box-sizing: border-box;
        }
        
        .status {
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
        }
        
        .status.info {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textLink-foreground);
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{pluginNamePascalCase}}</h1>
        <p>{{description}}</p>
    </div>
    
    <div class="content">
        <div class="card">
            <h3>Status</h3>
            <div class="status info" id="status">
                Plugin is active and running
            </div>
            <button class="button" onclick="refreshStatus()">Refresh</button>
        </div>
        
        <div class="card">
            <h3>Configuration</h3>
            <label for="enableFeature">Enable Feature:</label>
            <input type="checkbox" id="enableFeature" ${config.enableFeature ? 'checked' : ''} 
                   onchange="updateConfig()">
            <br><br>
            <label for="messageText">Custom Message:</label>
            <input type="text" class="input" id="messageText" 
                   value="${config.message || 'Hello from {{pluginNamePascalCase}}!'}"
                   onchange="updateConfig()">
        </div>
        
        <div class="card">
            <h3>Actions</h3>
            <button class="button" onclick="sendMessage()">Send Message</button>
            <button class="button" onclick="showData()">Show Data</button>
            <button class="button" onclick="exportData()">Export Data</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        function refreshStatus() {
            vscode.postMessage({
                type: 'refresh'
            });
        }
        
        function updateConfig() {
            const enableFeature = document.getElementById('enableFeature').checked;
            const message = document.getElementById('messageText').value;
            
            vscode.postMessage({
                type: 'updateConfig',
                data: {
                    enableFeature,
                    message
                }
            });
        }
        
        function sendMessage() {
            const message = document.getElementById('messageText').value;
            vscode.postMessage({
                type: 'sendMessage',
                data: { message }
            });
        }
        
        function showData() {
            vscode.postMessage({
                type: 'showData'
            });
        }
        
        function exportData() {
            vscode.postMessage({
                type: 'exportData'
            });
        }
        
        // Update status based on current time
        function updateStatusDisplay() {
            const statusEl = document.getElementById('status');
            const now = new Date().toLocaleTimeString();
            statusEl.textContent = \`Plugin is active (Last updated: \${now})\`;
        }
        
        // Update status every 30 seconds
        setInterval(updateStatusDisplay, 30000);
        updateStatusDisplay();
    </script>
</body>
</html>`;
}

  private handleWebviewMessage(message: any): void {
  switch(message.type) {
      case 'refresh':
  this.refresh();
  break;
        
      case 'updateConfig':
  this.updateConfiguration(message.data);
  break;
        
      case 'sendMessage':
  this.sendMessage(message.data.message);
  break;
        
      case 'showData':
  this.showData();
  break;
        
      case 'exportData':
  this.exportData();
  break;
        
      default:
  this.context.logger.warning('Unknown webview message type:', message.type);
}
  }

  private async updateConfiguration(data: any): Promise < void> {
  try {
    await this.context.config.update('{{pluginNameCamelCase}}', data);
    this.context.ui.showInformationMessage('Configuration updated');
  } catch(error: any) {
    this.context.logger.error('Failed to update configuration:', error);
    this.context.ui.showErrorMessage('Failed to update configuration');
  }
}

  private sendMessage(message: string): void {
  this.context.ui.showInformationMessage(message);
  this.context.logger.info('Message sent:', message);
}

  private showData(): void {
  const data = {
    timestamp: new Date().toISOString(),
    config: this.context.config.get('{{pluginNameCamelCase}}', {}),
    plugin: '{{pluginName}}'
  };

  this.context.logger.json('Plugin data:', data);
  this.context.ui.showInformationMessage('Data logged to console');
}

  private async exportData(): Promise < void> {
  try {
    const data = {
      timestamp: new Date().toISOString(),
      config: this.context.config.get('{{pluginNameCamelCase}}', {}),
      plugin: '{{pluginName}}',
      version: '0.1.0'
    };

    const content = JSON.stringify(data, null, 2);

    // Show save dialog and write file
    const uri = await this.context.ui.showSaveDialog({
      defaultUri: 'plugin-data.json',
      filters: {
        'JSON': ['json']
      }
    });

    if(uri) {
      await this.context.fs.writeFile(uri, content);
      this.context.ui.showInformationMessage('Data exported successfully');
    }
  } catch(error: any) {
    this.context.logger.error('Failed to export data:', error);
    this.context.ui.showErrorMessage('Failed to export data');
  }
}
}