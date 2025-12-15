# @lokus/plugin-sdk

[![npm version](https://badge.fury.io/js/%40lokus%2Fplugin-sdk.svg)](https://badge.fury.io/js/%40lokus%2Fplugin-sdk)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Official Plugin Development Kit (PDK) for Lokus** - Build powerful plugins with TypeScript-first development experience.

## 🚀 Quick Start

### Installation

```bash
npm install lokus-plugin-sdk
```

> **Tip:** The easiest way to start is using the **CLI**, which sets up the SDK for you:
> ```bash
> npx lokus-plugin-cli create my-plugin
> ```

### Create Your First Plugin

```typescript
import { BasePlugin, PluginContext } from '@lokus/plugin-sdk'

export default class MyPlugin extends BasePlugin {
  async activate(context: PluginContext): Promise<void> {
    await this.initialize(context)
    
    // Register a command
    this.registerCommand('my-plugin.hello', () => {
      this.showNotification('Hello from my plugin! 👋')
    }, {
      title: 'Say Hello',
      category: 'My Plugin'
    })
    
    this.getLogger().info('Plugin activated successfully!')
  }
}
```

## 📦 What's Included

### 🔧 **Development Tools**
- **Base Classes**: `BasePlugin`, `EnhancedBasePlugin` with common functionality
- **Utilities**: Logger, Config Manager, Event Bus, Disposable Store
- **Validators**: Manifest validation, dependency checking
- **Hot Reload**: Development server with live reloading

### 🎨 **Plugin Templates** 
- **Basic Plugin**: Simple starter template
- **UI Extension**: Custom panels, webviews, status bars
- **Language Support**: Syntax highlighting, completions, diagnostics
- **Task Provider**: Custom build tasks and runners
- **Debug Adapter**: Debugging support for languages
- **Theme Plugin**: Custom editor themes
- **Command Plugin**: Command palette extensions

### 🧪 **Testing Framework**
- **Mocks**: Complete API mocking for unit tests
- **Fixtures**: Pre-built test data and scenarios
- **Assertions**: Plugin-specific test assertions
- **Test Utils**: Helper functions for plugin testing

### 📚 **TypeScript Definitions**
- **Complete API Coverage**: All Lokus APIs with full type safety
- **Extension Points**: Commands, UI, Editor, Workspace, etc.
- **Event System**: Type-safe event handling
- **Configuration**: Strongly-typed plugin configuration

## 🏗️ Project Templates

### Create from Template

```bash
# Using npm
npx @lokus/plugin-sdk create my-awesome-plugin

# Using the SDK directly
import { PluginSDK } from '@lokus/plugin-sdk'

await PluginSDK.createFromTemplate('ui-extension', {
  name: 'My Awesome Plugin',
  id: 'my-awesome-plugin',
  description: 'An awesome plugin for Lokus',
  author: 'Your Name',
  outputDir: './my-awesome-plugin',
  typescript: true,
  includeTests: true
})
```

### Available Templates

| Template | Description | Complexity | Use Cases |
|----------|-------------|------------|-----------|
| `basic` | Simple plugin structure | Beginner | Learning, simple automation |
| `ui-extension` | Custom UI components | Intermediate | Dashboards, tools, panels |
| `language-support` | Language features | Advanced | Syntax highlighting, LSP |
| `task-provider` | Build system integration | Intermediate | Custom tasks, runners |
| `debug-adapter` | Debugging support | Advanced | Language debugging |
| `theme` | Editor themes | Beginner | Visual customization |
| `command` | Command palette | Beginner | Shortcuts, automation |

## 📖 API Reference

### Core APIs

```typescript
import type { 
  LokusAPI,
  CommandAPI,
  EditorAPI, 
  UIAPI,
  WorkspaceAPI 
} from '@lokus/plugin-sdk'

// Access APIs through plugin context
export default class MyPlugin extends BasePlugin {
  async activate(context: PluginContext) {
    const api = context.api
    
    // Commands
    await api.commands.execute('workbench.action.quickOpen')
    
    // Editor
    const content = await api.editor.getContent()
    await api.editor.insertContent('Hello World!')
    
    // UI
    await api.ui.showNotification('Plugin loaded!', 'success')
    const result = await api.ui.showDialog({
      title: 'Confirm Action',
      message: 'Do you want to continue?',
      buttons: [
        { id: 'yes', label: 'Yes', primary: true },
        { id: 'no', label: 'No' }
      ]
    })
    
    // Workspace  
    const folders = await api.workspace.getFolders()
    const files = await api.workspace.findFiles('**/*.js')
  }
}
```

### Base Plugin Features

```typescript
export default class MyPlugin extends BasePlugin {
  async activate(context: PluginContext) {
    await this.initialize(context)
    
    // Automatic cleanup with disposables
    this.registerCommand('my.command', this.handleCommand.bind(this))
    
    // Configuration management
    this.watchConfig('mySettings.enabled', (newValue, oldValue) => {
      this.getLogger().info(`Setting changed: ${oldValue} -> ${newValue}`)
    })
    
    // Safe error handling
    await this.safeExecute(async () => {
      await this.performRiskyOperation()
    }, 'Failed to perform operation')
    
    // Performance measurement
    await this.measurePerformance(async () => {
      await this.heavyOperation()
    }, 'Heavy operation')
  }
  
  private async handleCommand() {
    if (!this.validateState()) return
    
    const config = this.getConfig()
    const enabled = config.get('enabled', true)
    
    if (enabled) {
      this.showNotification('Command executed!', 'success')
    }
  }
}
```

## 🧪 Testing Your Plugin

### Unit Testing

```typescript
import { createMockContext, MockLokusAPI } from '@lokus/plugin-sdk/testing'
import MyPlugin from '../src/MyPlugin'

describe('MyPlugin', () => {
  let plugin: MyPlugin
  let mockContext: PluginContext
  
  beforeEach(() => {
    mockContext = createMockContext('my-plugin', {
      id: 'my-plugin',
      name: 'My Plugin',
      version: '1.0.0'
    })
    plugin = new MyPlugin()
  })
  
  test('should activate successfully', async () => {
    await plugin.activate(mockContext)
    expect(plugin.isActive()).toBe(true)
  })
  
  test('should register commands', async () => {
    await plugin.activate(mockContext)
    
    const mockAPI = mockContext.api as MockLokusAPI
    const commands = await mockAPI.commands.getAll()
    
    expect(commands).toHaveLength(1)
    expect(commands[0].id).toBe('my-plugin.hello')
  })
})
```

### Integration Testing

```typescript
import { TestUtils } from '@lokus/plugin-sdk/testing'

describe('MyPlugin Integration', () => {
  test('should work with real API', async () => {
    const result = await TestUtils.withRealAPI(async (api) => {
      await api.commands.execute('my-plugin.hello')
      return api.ui.getNotifications()
    })
    
    expect(result).toContainEqual(
      expect.objectContaining({
        message: expect.stringContaining('Hello')
      })
    )
  })
})
```

## 🔧 Development Workflow

### Development Mode

```typescript
import { DevMode } from '@lokus/plugin-sdk'

export default class MyPlugin extends BasePlugin {
  async activate(context: PluginContext) {
    await this.initialize(context)
    
    if (DevMode.isEnabled()) {
      // Enable hot reload
      DevMode.enableHotReload(this)
      
      // Enhanced development logging
      const devLogger = DevMode.createLogger(this.pluginId)
      devLogger?.devLog('Plugin loaded in development mode')
    }
  }
}
```

### Configuration

Create a `plugin.json` manifest:

```json
{
  "id": "my-awesome-plugin",
  "version": "1.0.0",
  "name": "My Awesome Plugin",
  "description": "Does awesome things",
  "author": "Your Name",
  "main": "dist/index.js",
  "activationEvents": ["*"],
  "permissions": [
    "commands:register",
    "ui:notifications",
    "editor:read",
    "editor:write"
  ],
  "contributes": {
    "commands": [
      {
        "command": "my-awesome-plugin.hello",
        "title": "Say Hello",
        "category": "My Awesome Plugin"
      }
    ]
  }
}
```

### Build Configuration

#### TypeScript (`tsconfig.json`)

```json
{
  "extends": "@lokus/plugin-sdk/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

#### Package Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "build:watch": "tsc --watch",
    "dev": "lokus-plugin-dev --watch",
    "test": "jest",
    "test:watch": "jest --watch",
    "package": "lokus-plugin-package",
    "publish": "lokus-plugin-publish"
  }
}
```

## 🎯 Best Practices

### 1. Use TypeScript
- Leverage full type safety
- Better IntelliSense and error detection
- Easier refactoring and maintenance

### 2. Extend Base Classes
```typescript
// ✅ Good
export default class MyPlugin extends BasePlugin {
  // Automatic resource management and utilities
}

// ❌ Avoid
export default class MyPlugin implements Plugin {
  // Manual resource management required
}
```

### 3. Handle Errors Gracefully
```typescript
// ✅ Good
await this.safeExecute(async () => {
  await riskyOperation()
}, 'Operation failed')

// ❌ Avoid
try {
  await riskyOperation()
} catch (error) {
  console.error(error) // Poor error handling
}
```

### 4. Use Configuration
```typescript
// ✅ Good
const enabled = this.getConfig().get('feature.enabled', true)

// ❌ Avoid
const enabled = true // Hardcoded values
```

### 5. Test Thoroughly
```typescript
// ✅ Good - Use mocks for fast unit tests
const mockContext = createMockContext('my-plugin', manifest)

// ✅ Good - Integration tests for critical paths
await TestUtils.withRealAPI(async (api) => {
  // Test real integration
})
```

## 📚 Examples

### Basic Command Plugin
```typescript
import { BasePlugin, PluginContext } from '@lokus/plugin-sdk'

export default class HelloWorldPlugin extends BasePlugin {
  async activate(context: PluginContext) {
    await this.initialize(context)
    
    this.registerCommand('hello-world.greet', async () => {
      const name = await this.getAPI().ui.showInputBox({
        placeholder: 'Enter your name',
        prompt: 'What is your name?'
      })
      
      if (name) {
        this.showNotification(`Hello, ${name}! 👋`, 'success')
      }
    }, {
      title: 'Say Hello',
      category: 'Hello World'
    })
  }
}
```

### UI Extension Plugin
```typescript
import { EnhancedBasePlugin, PluginContext } from '@lokus/plugin-sdk'

export default class DashboardPlugin extends EnhancedBasePlugin {
  async activate(context: PluginContext) {
    await this.initialize(context)
    
    // Create status bar item
    this.createStatusBarItem('dashboard.status', '$(dashboard) Dashboard', {
      tooltip: 'Open Dashboard',
      command: 'dashboard.open'
    })
    
    // Register command with palette
    this.registerCommandWithPalette({
      id: 'dashboard.open',
      title: 'Open Dashboard',
      category: 'Dashboard',
      handler: () => this.openDashboard()
    })
  }
  
  private async openDashboard() {
    const panel = this.getAPI().ui.registerWebviewPanel({
      id: 'dashboard.panel',
      title: 'Dashboard',
      type: 'webview',
      location: 'editor',
      html: this.getDashboardHTML(),
      options: { enableScripts: true }
    })
    
    panel.webview.onDidReceiveMessage((message) => {
      this.handleDashboardMessage(message)
    })
  }
  
  private getDashboardHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Dashboard</title>
          <style>
            body { font-family: system-ui; padding: 20px; }
            .card { border: 1px solid #ddd; padding: 16px; margin: 8px 0; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>My Dashboard</h1>
          <div class="card">
            <h3>Project Stats</h3>
            <p>Files: <span id="fileCount">Loading...</span></p>
            <button onclick="refreshStats()">Refresh</button>
          </div>
          
          <script>
            const vscode = acquireVsCodeApi()
            
            function refreshStats() {
              vscode.postMessage({ command: 'refresh-stats' })
            }
            
            window.addEventListener('message', event => {
              const message = event.data
              if (message.command === 'update-stats') {
                document.getElementById('fileCount').textContent = message.fileCount
              }
            })
            
            refreshStats() // Initial load
          </script>
        </body>
      </html>
    `
  }
  
  private async handleDashboardMessage(message: any) {
    if (message.command === 'refresh-stats') {
      const files = await this.getAPI().workspace.findFiles('**/*')
      this.sendToDashboard('update-stats', { fileCount: files.length })
    }
  }
}
```

## 🔍 Debugging

### Debug Configuration
```json
{
  "type": "node",
  "request": "launch",
  "name": "Debug Plugin",
  "program": "${workspaceFolder}/node_modules/@lokus/plugin-sdk/bin/debug.js",
  "args": ["--plugin", "${workspaceFolder}"],
  "env": {
    "NODE_ENV": "development",
    "LOKUS_DEV": "true"
  }
}
```

### Logging
```typescript
// Different log levels
this.getLogger().trace('Detailed debug information')
this.getLogger().debug('Debug information')
this.getLogger().info('General information')
this.getLogger().warn('Warning message')
this.getLogger().error('Error occurred', error)

// Performance logging
const perfLogger = new PerformanceLogger(this.getLogger())
await perfLogger.measure('operation-name', async () => {
  await performOperation()
})
```

## 🚀 Publishing

### Package Your Plugin
```bash
npm run package
# Creates my-plugin-1.0.0.vsix
```

### Publish to Marketplace
```bash
npm run publish
# Publishes to Lokus Plugin Marketplace
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

MIT © [Lokus Team](https://lokus.dev)

## 🔗 Links

- [Documentation](https://lokus.dev/docs/plugin-development)
- [API Reference](https://lokus.dev/api)
- [Plugin Marketplace](https://marketplace.lokus.dev)
- [GitHub Repository](https://github.com/lokus/lokus)
- [Community Discord](https://discord.gg/lokus)

---

**Happy Plugin Development! 🎉**