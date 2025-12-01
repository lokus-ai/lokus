# Lokus Plugin Development Guide

## 🚀 Quick Start

Lokus provides a powerful plugin system that enables developers to extend the editor with custom functionality. This guide will walk you through creating, testing, and distributing your own plugins.

## 📋 Prerequisites

- Node.js 16+ installed
- Basic knowledge of JavaScript/TypeScript
- Familiarity with React (for UI plugins)

## 🛠️ Setting Up Development

### 1. Install the Lokus Plugin CLI

```bash
npm install -g @lokus/plugin-cli
```

### 2. Create Your First Plugin

```bash
# Interactive plugin creation
lokus-plugin create interactive

# Or create a specific type
lokus-plugin create basic-mcp-server --name "My Plugin" --typescript
```

### 3. Plugin Project Structure

```
my-plugin/
├── plugin.json          # Plugin manifest
├── src/
│   ├── index.js         # Main entry point
│   └── MyPlugin.js      # Plugin implementation
├── package.json         # Node.js dependencies
├── README.md           # Documentation
└── tests/              # Test files
    └── plugin.test.js
```

## 📝 Plugin Manifest (plugin.json)

### Basic Plugin (Manifest v1)

```json
{
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "A sample plugin that demonstrates Lokus capabilities",
  "author": "Your Name <your.email@example.com>",
  "main": "src/index.js",
  "lokusVersion": "^1.0.0",
  "permissions": [
    "read_files",
    "modify_ui"
  ],
  "activationEvents": [
    "onStartup"
  ],
  "categories": ["Productivity"],
  "keywords": ["sample", "demo", "productivity"]
}
```

### Advanced Plugin (Manifest v2)

```json
{
  "manifest": "2.0",
  "id": "advanced-plugin",
  "name": "Advanced Plugin",
  "displayName": "Advanced Lokus Plugin",
  "version": "1.0.0",
  "publisher": "your-publisher-name",
  "description": "An advanced plugin with MCP support",
  "engines": {
    "lokus": "^1.0.0",
    "node": ">=16.0.0"
  },
  "categories": ["Programming Languages", "AI"],
  "keywords": ["mcp", "ai", "assistant"],
  "main": "dist/index.js",
  "activationEvents": [
    "onStartupFinished",
    "onCommand:myPlugin.activate"
  ],
  "contributes": {
    "commands": [
      {
        "command": "myPlugin.activate",
        "title": "Activate My Plugin"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "myPlugin.activate",
          "when": "true"
        }
      ]
    }
  },
  "capabilities": {
    "untrustedWorkspaces": {
      "supported": true
    },
    "virtualWorkspaces": {
      "supported": false
    }
  }
}
```

## 🔌 Basic Plugin Example

### src/index.js
```javascript
import { PluginAPI } from '@lokus/plugin-api'

export class MyPlugin {
  constructor() {
    this.name = 'My Awesome Plugin'
    this.commands = new Map()
  }

  async activate(api) {
    console.log(`${this.name} activated!`)
    
    // Register a command
    this.commands.set('myPlugin.sayHello', async () => {
      await api.ui.showMessage('Hello from my plugin!', 'info')
    })
    
    // Register command with Lokus
    api.commands.registerCommand('myPlugin.sayHello', 
      this.commands.get('myPlugin.sayHello'))
    
    // Add menu item
    api.ui.addMenuItem('My Plugin', [
      {
        label: 'Say Hello',
        command: 'myPlugin.sayHello'
      }
    ])
  }

  async deactivate(api) {
    // Cleanup
    this.commands.forEach((_, commandId) => {
      api.commands.unregisterCommand(commandId)
    })
    this.commands.clear()
    
    console.log(`${this.name} deactivated!`)
  }
}

// Export the plugin class
export default MyPlugin
```

## 🤖 MCP Plugin Example

### src/MCPPlugin.js
```javascript
import { MCPResourceBuilder, MCPToolBuilder, MCPPromptBuilder } from '@lokus/plugin-api'

export class MyMCPPlugin {
  async activate(mcpAPI) {
    console.log('MCP Plugin activated!')
    
    // Register a resource
    const fileResource = new MCPResourceBuilder()
      .setUri('file:///my-data')
      .setName('My Data Files')
      .setDescription('Access to my plugin data')
      .setType('file')
      .setMimeType('application/json')
      .build()
    
    mcpAPI.server?.registerResource(fileResource)
    
    // Register a tool
    const processDataTool = new MCPToolBuilder()
      .setName('process_data')
      .setDescription('Process data using my algorithm')
      .setInputSchema({
        type: 'object',
        properties: {
          data: { type: 'string', description: 'Data to process' },
          options: { type: 'object', description: 'Processing options' }
        },
        required: ['data']
      })
      .setExecutor(async (args) => {
        // Your processing logic here
        return {
          result: `Processed: ${args.data}`,
          timestamp: new Date().toISOString()
        }
      })
      .build()
    
    mcpAPI.server?.registerTool(processDataTool)
    
    // Register a prompt template
    const analysisPrompt = new MCPPromptBuilder()
      .setName('analyze_code')
      .setDescription('Analyze code for improvements')
      .setArguments([
        { name: 'code', description: 'Code to analyze', required: true },
        { name: 'language', description: 'Programming language', required: false }
      ])
      .setTemplate(`
        Please analyze the following {{language}} code and suggest improvements:
        
        \`\`\`{{language}}
        {{code}}
        \`\`\`
        
        Focus on:
        - Performance optimizations
        - Code readability
        - Best practices
        - Potential bugs
      `)
      .build()
    
    mcpAPI.server?.registerPrompt(analysisPrompt)
  }

  async deactivate(mcpAPI) {
    console.log('MCP Plugin deactivated!')
  }
}

export default MyMCPPlugin
```

## 🧪 Testing Your Plugin

### 1. Local Testing

```bash
# In your plugin directory
npm test

# Or test with Lokus directly
lokus-plugin test --plugin-path ./
```

### 2. Integration Testing

```javascript
// tests/plugin.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMockAPI } from '@lokus/plugin-test-utils'
import MyPlugin from '../src/index.js'

describe('MyPlugin', () => {
  let plugin
  let mockAPI

  beforeEach(() => {
    plugin = new MyPlugin()
    mockAPI = createMockAPI()
  })

  afterEach(async () => {
    await plugin.deactivate(mockAPI)
  })

  it('should activate successfully', async () => {
    await expect(plugin.activate(mockAPI)).resolves.not.toThrow()
  })

  it('should register commands', async () => {
    await plugin.activate(mockAPI)
    expect(mockAPI.commands.registerCommand).toHaveBeenCalledWith(
      'myPlugin.sayHello',
      expect.any(Function)
    )
  })
})
```

## 📦 Building and Packaging

### 1. Build Your Plugin

```bash
# Build for production
npm run build

# Or use the CLI
lokus-plugin build
```

### 2. Package for Distribution

```bash
# Create a plugin package
lokus-plugin package

# This creates: my-plugin-1.0.0.lpkg
```

## 🌐 Publishing Your Plugin

### 1. Publish to Lokus Registry

```bash
# First time setup
lokus-plugin login

# Publish your plugin
lokus-plugin publish
```

### 2. Manual Distribution

For manual distribution, you can:

1. **Share the .lpkg file directly**
   ```bash
   # Users can install with:
   # File > Install Plugin > Select your-plugin.lpkg
   ```

2. **GitHub Releases**
   ```bash
   # Tag your release
   git tag v1.0.0
   git push origin v1.0.0
   
   # Create GitHub release with .lpkg file
   gh release create v1.0.0 ./my-plugin-1.0.0.lpkg
   ```

3. **Custom Registry**
   ```bash
   # Configure custom registry
   lokus-plugin config set registry https://your-registry.com
   lokus-plugin publish
   ```

## 🔧 Available APIs

### Core Plugin API

```javascript
// File system access
await api.fs.readFile('/path/to/file')
await api.fs.writeFile('/path/to/file', content)

// UI interactions
await api.ui.showMessage('Hello!', 'info')
const result = await api.ui.showInputBox('Enter name:')

// Editor integration
const editor = await api.editor.getActiveEditor()
await editor.insertText('Hello World')

// Settings
await api.settings.get('myPlugin.setting')
await api.settings.set('myPlugin.setting', value)

// Commands
api.commands.registerCommand('my.command', callback)
await api.commands.executeCommand('core.save')
```

### MCP API (for AI plugins)

```javascript
// Resource management
mcpAPI.server?.registerResource(resource)
const resources = await mcpAPI.client?.listResources()

// Tool execution
mcpAPI.server?.registerTool(tool)
const result = await mcpAPI.client?.callTool('toolName', args)

// Prompt templates
mcpAPI.server?.registerPrompt(prompt)
const prompts = await mcpAPI.client?.listPrompts()
```

## 🛡️ Security and Permissions

### Permission Types

- `read_files` - Read files from workspace
- `write_files` - Write files to workspace
- `execute_commands` - Execute system commands
- `access_network` - Make network requests
- `modify_ui` - Add UI elements
- `access_settings` - Read/write settings
- `mcp:serve` - Provide MCP services
- `mcp:tools` - Execute MCP tools

### Best Practices

1. **Request minimal permissions**
2. **Validate all inputs**
3. **Handle errors gracefully**
4. **Provide clear documentation**
5. **Test thoroughly**

## 📚 Examples and Templates

### Available Templates

```bash
# Basic plugin
lokus-plugin create basic --name "My Plugin"

# MCP server plugin
lokus-plugin create mcp-server --name "AI Helper"

# Theme plugin
lokus-plugin create theme --name "My Theme"

# Language support plugin
lokus-plugin create language --name "New Language"
```

### Example Plugins Repository

Check out our [example plugins repository](https://github.com/lokus-editor/plugin-examples) for:

- 📝 Text manipulation tools
- 🎨 Custom themes
- 🤖 AI integrations
- 📊 Data visualization
- 🔧 Developer utilities

## 🆘 Troubleshooting

### Common Issues

1. **Plugin not loading**
   - Check plugin.json syntax
   - Verify file paths
   - Check console for errors

2. **Permission denied**
   - Review required permissions
   - Check manifest permissions array

3. **API not available**
   - Ensure correct Lokus version
   - Check activation events

### Getting Help

- 📖 [Official Documentation](https://docs.lokus.app/plugins)
- 💬 [Discord Community](https://discord.gg/lokus)
- 🐛 [Issue Tracker](https://github.com/lokus-editor/lokus/issues)
- 📧 [Developer Support](mailto:developers@lokus.app)

## 🎉 Publishing Checklist

Before publishing your plugin:

- [ ] Test on multiple platforms
- [ ] Write comprehensive documentation
- [ ] Add unit tests
- [ ] Follow naming conventions
- [ ] Include screenshots/demos
- [ ] Set appropriate version
- [ ] Tag appropriate categories
- [ ] Add meaningful keywords
- [ ] Test installation process
- [ ] Verify permissions are minimal

---

Happy plugin development! 🚀

*For more advanced topics, check out our [Advanced Plugin Development Guide](https://docs.lokus.app/plugins/advanced).*









⏺ Perfect! I've created a comprehensive plugin
  development ecosystem for Lokus that includes:

  📚 Complete Plugin Development Documentation

  1. Main Development Guide (PLUGIN_DEVELOPMENT.md)

  - Step-by-step plugin creation process
  - Manifest v1 and v2 examples
  - API reference and best practices
  - Testing, building, and publishing workflow
  - Troubleshooting and support resources

  2. Basic Plugin Example (example-plugin/)

  - Simple "Hello World" plugin demonstrating core
  concepts
  - Command registration and UI interaction
  - Menu integration and editor manipulation
  - Perfect starting point for new developers

  3. MCP Plugin Example (example-mcp-plugin/)

  - Advanced AI-powered plugin with MCP protocol support
  - Resources, tools, and prompts implementation
  - Demonstrates modern AI integration patterns
  - Shows how to create AI assistant capabilities

  🛠️ Developer Workflow

  Creating a Plugin

  # Quick start with CLI
  npm install -g @lokus/plugin-cli
  lokus-plugin create interactive

  # Or copy examples
  cp -r example-plugin my-new-plugin
  cd my-new-plugin
  # Edit plugin.json and src/index.js

  Testing & Building

  # Test locally
  npm test
  lokus-plugin test

  # Build for distribution
  npm run build
  lokus-plugin package

  Publishing Options

  1. Official Registry
  lokus-plugin login
  lokus-plugin publish
  2. GitHub Releases
  git tag v1.0.0
  gh release create v1.0.0 ./my-plugin-1.0.0.lpkg
  3. Manual Distribution
    - Share .lpkg files directly
    - Users install via File > Install Plugin

  Discovery & Installation

  Users can find and install plugins through:
  - Built-in Marketplace: Browse, search, install with
  one click
  - Plugin Registry: Official plugin repository
  - Manual Installation: Local .lpkg files
  - GitHub Integration: Direct installation from
  repositories

  🎯 Key Features for Developers

  - VS Code-level APIs: Rich extension points and
  capabilities
  - MCP Protocol Support: Build AI-powered plugins easily
  - TypeScript Support: Full type definitions and
  IntelliSense
  - Security Sandbox: Safe execution environment
  - Template System: Quick project scaffolding
  - CLI Tools: Complete development workflow
  - Testing Framework: Unit and integration testing
  - Hot Reload: Live development experience

  The plugin system is now production-ready and provides
  everything developers need to create powerful
  extensions for Lokus, from simple utilities to complex
  AI-powered tools!