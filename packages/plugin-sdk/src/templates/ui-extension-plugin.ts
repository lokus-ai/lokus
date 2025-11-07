/**
 * @fileoverview UI Extension plugin template
 */

import type { TemplateGenerator, TemplateConfig, TemplateValidationResult, TemplateDescription, TemplateOption } from './index.js'

/**
 * UI Extension plugin template generator
 */
export class UIExtensionPluginTemplate implements TemplateGenerator {
  async generate(config: TemplateConfig): Promise<void> {
    const { outputDir, name, id, description, author, version = '1.0.0', typescript = true } = config
    
    // Generate files
    const packageJson = this.generatePackageJson(config)
    const manifest = this.generateManifest(config)
    const mainFile = typescript 
      ? this.generateTypeScriptMain(config)
      : this.generateJavaScriptMain(config)
    const webviewHtml = this.generateWebviewHtml(config)
    const styles = this.generateStyles(config)
    const script = this.generateWebviewScript(config)
    
    console.log('Generating UI extension plugin template:', {
      outputDir,
      name,
      files: {
        'package.json': packageJson,
        'plugin.json': manifest,
        [`src/index.${typescript ? 'ts' : 'js'}`]: mainFile,
        'src/webview/index.html': webviewHtml,
        'src/webview/styles.css': styles,
        'src/webview/script.js': script,
        ...(typescript && { 'tsconfig.json': this.generateTsConfig() }),
        'README.md': this.generateReadme(config)
      }
    })
  }

  async validate(config: TemplateConfig): Promise<TemplateValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []

    if (!config.name) {
      errors.push('Plugin name is required')
    }

    if (!config.id) {
      errors.push('Plugin ID is required')
    }

    if (!config.options || !config.options['uiType']) {
      warnings.push('UI type not specified, defaulting to panel')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  getDescription(): TemplateDescription {
    return {
      name: 'ui-extension',
      displayName: 'UI Extension Plugin',
      description: 'A plugin template for creating custom UI components and panels',
      category: 'UI/UX',
      tags: ['ui', 'webview', 'panel', 'interface'],
      complexity: 'intermediate',
      setupTime: '10-15 minutes',
      requiredSkills: ['JavaScript/TypeScript', 'HTML', 'CSS', 'Basic React (optional)'],
      features: [
        'Custom webview panels',
        'Status bar items',
        'Custom menus and toolbars',
        'Tree views',
        'Interactive UI components',
        'Two-way communication with host'
      ],
      useCases: [
        'Custom dashboards',
        'Data visualization',
        'Configuration panels',
        'File explorers',
        'Interactive tools'
      ]
    }
  }

  getRequiredOptions(): TemplateOption[] {
    return [
      {
        key: 'name',
        name: 'Plugin Name',
        description: 'The display name of your plugin',
        type: 'string',
        required: true
      },
      {
        key: 'id',
        name: 'Plugin ID',
        description: 'Unique identifier for your plugin',
        type: 'string',
        required: true
      },
      {
        key: 'uiType',
        name: 'UI Type',
        description: 'Primary UI component type',
        type: 'string',
        required: false,
        choices: ['panel', 'sidebar', 'statusbar', 'toolbar', 'treeview'],
        default: 'panel'
      }
    ]
  }

  private generatePackageJson(config: TemplateConfig): string {
    return JSON.stringify({
      name: config.id,
      version: config.version || '1.0.0',
      description: config.description || 'A Lokus UI extension plugin',
      main: config.typescript ? 'dist/index.js' : 'src/index.js',
      scripts: {
        ...(config.typescript && {
          build: 'tsc',
          'build:watch': 'tsc --watch',
          dev: 'npm run build:watch'
        }),
        test: 'jest',
        lint: 'eslint src/**/*.{js,ts}',
        'lint:fix': 'eslint src/**/*.{js,ts} --fix'
      },
      keywords: ['lokus', 'plugin', 'ui', 'extension'],
      author: config.author || '',
      license: 'MIT',
      dependencies: {
        '@lokus/plugin-sdk': '^1.0.0'
      },
      devDependencies: {
        ...(config.typescript && {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0'
        }),
        eslint: '^8.0.0',
        jest: '^29.0.0'
      }
    }, null, 2)
  }

  private generateManifest(config: TemplateConfig): string {
    const uiType = (config.options && config.options['uiType']) || 'panel'
    
    return JSON.stringify({
      id: config.id,
      version: config.version || '1.0.0',
      name: config.name,
      description: config.description || 'A Lokus UI extension plugin',
      author: config.author || '',
      main: config.typescript ? 'dist/index.js' : 'src/index.js',
      activationEvents: ['onView:' + config.id],
      permissions: [
        'ui:panels',
        'ui:webviews',
        'ui:statusbar',
        'ui:menus',
        'ui:toolbars',
        'commands:register'
      ],
      contributes: {
        commands: [
          {
            command: `${config.id}.show`,
            title: `Show ${config.name}`,
            category: config.name,
            icon: 'window'
          },
          {
            command: `${config.id}.refresh`,
            title: 'Refresh',
            category: config.name,
            icon: 'refresh'
          }
        ],
        views: {
          explorer: [
            {
              id: config.id,
              name: config.name,
              when: 'true'
            }
          ]
        },
        menus: {
          'view/title': [
            {
              command: `${config.id}.refresh`,
              when: `view == ${config.id}`,
              group: 'navigation'
            }
          ],
          commandPalette: [
            {
              command: `${config.id}.show`,
              when: 'true'
            }
          ]
        }
      }
    }, null, 2)
  }

  private generateTypeScriptMain(config: TemplateConfig): string {
    return `import { Plugin, PluginContext, LokusAPI, WebviewPanel } from '@lokus/plugin-sdk'
import * as path from 'path'

/**
 * ${config.name} UI Extension Plugin
 */
export default class ${this.toPascalCase(config.name || 'UIExtension')}Plugin implements Plugin {
  private api?: LokusAPI
  private context?: PluginContext
  private panel?: WebviewPanel

  async activate(context: PluginContext): Promise<void> {
    this.context = context
    this.api = context.api

    // Register commands
    this.registerCommands()

    // Register UI components
    this.registerUIComponents()

    this.api.ui.showNotification('${config.name} activated!', 'info')
  }

  async deactivate(): Promise<void> {
    this.panel?.dispose()
    this.api?.ui.showNotification('${config.name} deactivated', 'info')
  }

  private registerCommands(): void {
    if (!this.api) return

    // Show panel command
    this.api.commands.register({
      id: '${config.id}.show',
      title: 'Show ${config.name}',
      handler: () => this.showPanel()
    })

    // Refresh command
    this.api.commands.register({
      id: '${config.id}.refresh',
      title: 'Refresh',
      handler: () => this.refreshPanel()
    })
  }

  private registerUIComponents(): void {
    if (!this.api) return

    // Register status bar item
    const statusBarItem = this.api.ui.registerStatusBarItem({
      id: '${config.id}.status',
      text: '$(window) ${config.name}',
      tooltip: 'Click to show ${config.name}',
      command: '${config.id}.show',
      alignment: 'left',
      priority: 100
    })

    // Register tree data provider
    this.api.ui.registerTreeDataProvider('${config.id}', new CustomTreeDataProvider())
  }

  private async showPanel(): Promise<void> {
    if (!this.api || !this.context) return

    if (this.panel) {
      this.panel.reveal()
      return
    }

    // Create webview panel
    this.panel = this.api.ui.registerWebviewPanel({
      id: '${config.id}.panel',
      title: '${config.name}',
      type: 'webview',
      location: 'editor',
      html: this.getWebviewContent(),
      options: {
        enableScripts: true,
        localResourceRoots: [path.join(this.context.assetUri, 'webview')]
      }
    })

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message)
    })

    // Clean up when panel is disposed
    this.panel.onDidDispose(() => {
      this.panel = undefined
    })
  }

  private refreshPanel(): void {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'refresh' })
    }
  }

  private getWebviewContent(): string {
    if (!this.context) return ''

    const htmlPath = path.join(this.context.assetUri, 'webview', 'index.html')
    // In a real implementation, you would read the HTML file
    return \`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <div id="app">
        <h1>${config.name}</h1>
        <p>Welcome to your custom UI extension!</p>
        <button id="actionBtn">Click Me</button>
        <div id="content">
            <!-- Dynamic content will be loaded here -->
        </div>
    </div>
    <script src="./script.js"></script>
</body>
</html>\`
  }

  private handleWebviewMessage(message: any): void {
    switch (message.command) {
      case 'action':
        this.api?.ui.showNotification('Action triggered from webview!', 'success')
        break
      case 'getData':
        this.panel?.webview.postMessage({
          command: 'updateData',
          data: { timestamp: new Date().toISOString() }
        })
        break
    }
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }
}

/**
 * Custom tree data provider
 */
class CustomTreeDataProvider {
  getTreeItem(element: TreeItem): TreeItem {
    return element
  }

  getChildren(element?: TreeItem): TreeItem[] {
    if (!element) {
      return [
        { label: 'Item 1', collapsibleState: 'collapsed' },
        { label: 'Item 2', collapsibleState: 'none' },
        { label: 'Item 3', collapsibleState: 'expanded' }
      ]
    }
    return []
  }
}

interface TreeItem {
  label: string
  collapsibleState: 'none' | 'collapsed' | 'expanded'
  children?: TreeItem[]
}
`
  }

  private generateJavaScriptMain(config: TemplateConfig): string {
    return `const path = require('path')

/**
 * ${config.name} UI Extension Plugin
 */
class ${this.toPascalCase(config.name || 'UIExtension')}Plugin {
  async activate(context) {
    this.context = context
    this.api = context.api

    // Register commands
    this.registerCommands()

    // Register UI components
    this.registerUIComponents()

    this.api.ui.showNotification('${config.name} activated!', 'info')
  }

  async deactivate() {
    if (this.panel) {
      this.panel.dispose()
    }
    this.api?.ui.showNotification('${config.name} deactivated', 'info')
  }

  registerCommands() {
    if (!this.api) return

    this.api.commands.register({
      id: '${config.id}.show',
      title: 'Show ${config.name}',
      handler: () => this.showPanel()
    })

    this.api.commands.register({
      id: '${config.id}.refresh',
      title: 'Refresh',
      handler: () => this.refreshPanel()
    })
  }

  registerUIComponents() {
    if (!this.api) return

    const statusBarItem = this.api.ui.registerStatusBarItem({
      id: '${config.id}.status',
      text: '$(window) ${config.name}',
      tooltip: 'Click to show ${config.name}',
      command: '${config.id}.show',
      alignment: 'left',
      priority: 100
    })

    this.api.ui.registerTreeDataProvider('${config.id}', new CustomTreeDataProvider())
  }

  async showPanel() {
    if (!this.api || !this.context) return

    if (this.panel) {
      this.panel.reveal()
      return
    }

    this.panel = this.api.ui.registerWebviewPanel({
      id: '${config.id}.panel',
      title: '${config.name}',
      type: 'webview',
      location: 'editor',
      html: this.getWebviewContent(),
      options: {
        enableScripts: true,
        localResourceRoots: [path.join(this.context.assetUri, 'webview')]
      }
    })

    this.panel.webview.onDidReceiveMessage((message) => {
      this.handleWebviewMessage(message)
    })

    this.panel.onDidDispose(() => {
      this.panel = undefined
    })
  }

  refreshPanel() {
    if (this.panel) {
      this.panel.webview.postMessage({ command: 'refresh' })
    }
  }

  getWebviewContent() {
    return \`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.name}</title>
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <div id="app">
        <h1>${config.name}</h1>
        <p>Welcome to your custom UI extension!</p>
        <button id="actionBtn">Click Me</button>
        <div id="content"></div>
    </div>
    <script src="./script.js"></script>
</body>
</html>\`
  }

  handleWebviewMessage(message) {
    switch (message.command) {
      case 'action':
        this.api?.ui.showNotification('Action triggered from webview!', 'success')
        break
      case 'getData':
        this.panel?.webview.postMessage({
          command: 'updateData',
          data: { timestamp: new Date().toISOString() }
        })
        break
    }
  }
}

class CustomTreeDataProvider {
  getTreeItem(element) {
    return element
  }

  getChildren(element) {
    if (!element) {
      return [
        { label: 'Item 1', collapsibleState: 'collapsed' },
        { label: 'Item 2', collapsibleState: 'none' },
        { label: 'Item 3', collapsibleState: 'expanded' }
      ]
    }
    return []
  }
}

module.exports = ${this.toPascalCase(config.name || 'UIExtension')}Plugin
`
  }

  private generateWebviewHtml(config: TemplateConfig): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
    <title>${config.name}</title>
    <link rel="stylesheet" href="./styles.css">
</head>
<body>
    <div id="app">
        <header>
            <h1>${config.name}</h1>
            <button id="refreshBtn" class="btn btn-primary">🔄 Refresh</button>
        </header>
        
        <main>
            <section class="welcome">
                <h2>Welcome to your UI Extension!</h2>
                <p>This is a custom webview panel created by your plugin.</p>
            </section>
            
            <section class="actions">
                <h3>Actions</h3>
                <div class="button-group">
                    <button id="actionBtn" class="btn btn-secondary">Trigger Action</button>
                    <button id="dataBtn" class="btn btn-secondary">Get Data</button>
                    <button id="notifyBtn" class="btn btn-secondary">Show Notification</button>
                </div>
            </section>
            
            <section class="content">
                <h3>Dynamic Content</h3>
                <div id="content-area">
                    <p>Content will appear here...</p>
                </div>
            </section>
            
            <section class="status">
                <div id="status-bar">
                    <span>Status: Ready</span>
                    <span id="timestamp"></span>
                </div>
            </section>
        </main>
    </div>
    
    <script src="./script.js"></script>
</body>
</html>`
  }

  private generateStyles(config: TemplateConfig): string {
    return `/* ${config.name} Styles */

:root {
  --primary-color: #007acc;
  --secondary-color: #f3f3f3;
  --text-color: #333;
  --border-color: #ddd;
  --hover-color: #005a9e;
  --success-color: #28a745;
  --warning-color: #ffc107;
  --error-color: #dc3545;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-color);
  background-color: #fff;
}

#app {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid var(--border-color);
}

h1 {
  color: var(--primary-color);
  font-size: 28px;
  font-weight: 600;
}

h2 {
  color: var(--text-color);
  font-size: 22px;
  margin-bottom: 15px;
}

h3 {
  color: var(--text-color);
  font-size: 18px;
  margin-bottom: 12px;
}

section {
  margin-bottom: 30px;
  padding: 20px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background-color: #fafafa;
}

.btn {
  display: inline-block;
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.btn-primary {
  background-color: var(--primary-color);
  color: white;
}

.btn-primary:hover {
  background-color: var(--hover-color);
}

.btn-secondary {
  background-color: var(--secondary-color);
  color: var(--text-color);
  border: 1px solid var(--border-color);
}

.btn-secondary:hover {
  background-color: #e9e9e9;
}

.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

#content-area {
  min-height: 100px;
  padding: 15px;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 4px;
}

#status-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px;
  background-color: white;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  font-size: 12px;
  color: #666;
}

.status {
  background-color: #f8f9fa;
}

/* Responsive design */
@media (max-width: 768px) {
  #app {
    padding: 10px;
  }
  
  header {
    flex-direction: column;
    text-align: center;
    gap: 15px;
  }
  
  .button-group {
    justify-content: center;
  }
  
  section {
    padding: 15px;
  }
}

/* Animation for content updates */
.fade-in {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}`
  }

  private generateWebviewScript(config: TemplateConfig): string {
    return `// ${config.name} Webview Script

(function() {
    'use strict';

    // Get VS Code API
    const vscode = acquireVsCodeApi();

    // DOM elements
    const actionBtn = document.getElementById('actionBtn');
    const dataBtn = document.getElementById('dataBtn');
    const notifyBtn = document.getElementById('notifyBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const contentArea = document.getElementById('content-area');
    const timestamp = document.getElementById('timestamp');

    // Initialize
    init();

    function init() {
        setupEventListeners();
        updateTimestamp();
        setInterval(updateTimestamp, 1000);
    }

    function setupEventListeners() {
        actionBtn?.addEventListener('click', handleAction);
        dataBtn?.addEventListener('click', handleGetData);
        notifyBtn?.addEventListener('click', handleNotify);
        refreshBtn?.addEventListener('click', handleRefresh);
    }

    function handleAction() {
        updateStatus('Triggering action...');
        vscode.postMessage({
            command: 'action',
            data: { timestamp: new Date().toISOString() }
        });
    }

    function handleGetData() {
        updateStatus('Requesting data...');
        vscode.postMessage({
            command: 'getData'
        });
    }

    function handleNotify() {
        updateStatus('Sending notification...');
        vscode.postMessage({
            command: 'notify',
            message: 'Hello from webview!'
        });
    }

    function handleRefresh() {
        updateStatus('Refreshing...');
        location.reload();
    }

    function updateStatus(message) {
        const statusSpan = document.querySelector('#status-bar span');
        if (statusSpan) {
            statusSpan.textContent = \`Status: \${message}\`;
        }
    }

    function updateTimestamp() {
        if (timestamp) {
            timestamp.textContent = new Date().toLocaleTimeString();
        }
    }

    function updateContent(content) {
        if (contentArea) {
            contentArea.innerHTML = \`
                <div class="fade-in">
                    <h4>Updated Content</h4>
                    <pre>\${JSON.stringify(content, null, 2)}</pre>
                </div>
            \`;
        }
    }

    // Listen for messages from the extension
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateData':
                updateContent(message.data);
                updateStatus('Data updated');
                break;
            case 'refresh':
                handleRefresh();
                break;
            default:
                console.log('Unknown message:', message);
        }
    });

    // Save and restore state
    const state = vscode.getState();
    if (state && state.content) {
        updateContent(state.content);
    }

    // Example of saving state
    function saveState(content) {
        vscode.setState({ content });
    }

})();`
  }

  private generateTsConfig(): string {
    return JSON.stringify({
      compilerOptions: {
        target: 'ES2020',
        module: 'CommonJS',
        lib: ['ES2020'],
        outDir: './dist',
        rootDir: './src',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
        declaration: true,
        declarationMap: true,
        sourceMap: true
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist', '**/*.test.ts']
    }, null, 2)
  }

  private generateReadme(config: TemplateConfig): string {
    return `# ${config.name}

${config.description || 'A Lokus UI extension plugin'}

## Features

- Custom webview panels
- Status bar integration
- Tree view provider
- Interactive UI components
- Two-way communication between webview and extension
- Responsive design

## Commands

- **${config.id}.show**: Show the ${config.name} panel
- **${config.id}.refresh**: Refresh the current panel

## UI Components

- **Panel**: Main interactive panel with custom content
- **Status Bar**: Quick access button in the status bar
- **Tree View**: Custom tree view in the explorer
- **Webview**: Rich HTML/CSS/JS interface

## Development

The plugin includes a webview with:
- Custom HTML interface (\`src/webview/index.html\`)
- Styled CSS (\`src/webview/styles.css\`)
- Interactive JavaScript (\`src/webview/script.js\`)

### Customization

1. Modify the HTML structure in \`src/webview/index.html\`
2. Update styles in \`src/webview/styles.css\`
3. Add interactivity in \`src/webview/script.js\`
4. Handle webview messages in the main plugin file

## License

MIT
`
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[^a-zA-Z0-9]/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }
}