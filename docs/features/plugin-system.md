# Plugin System

Lokus features a comprehensive plugin system that provides VS Code-level extensibility, allowing developers to create powerful extensions that integrate seamlessly with the application. The plugin system includes security sandboxing, a marketplace, and comprehensive APIs.

## Overview

The Lokus plugin system enables:
- **VS Code-level extensibility** with comprehensive APIs
- **Secure plugin execution** with runtime sandboxing
- **Marketplace integration** for plugin discovery and installation
- **Professional development experience** with TypeScript support
- **MCP (Model Context Protocol) integration** for AI assistant plugins
- **Real-time plugin management** with hot reloading capabilities

## Architecture

### Core Components
- **Plugin Manager** - Central coordination and lifecycle management
- **Security Sandbox** - Isolated execution environment for plugins
- **Plugin Registry** - Discovery and metadata management
- **API Surface** - Comprehensive plugin development APIs
- **Marketplace** - Plugin distribution and installation
- **Communication Layer** - Inter-plugin and plugin-app messaging

### Plugin Types
1. **Editor Plugins** - Extend text editing functionality
2. **UI Plugins** - Add custom interface components
3. **Theme Plugins** - Custom themes and styling
4. **Tool Plugins** - Add new tools and utilities
5. **MCP Plugins** - AI assistant integrations
6. **Workspace Plugins** - Enhance file and project management

## Plugin Development

### Getting Started

#### 1. Plugin Manifest
Every plugin requires a `plugin.json` manifest file:

```json
{
  "name": "my-awesome-plugin",
  "version": "1.0.0",
  "displayName": "My Awesome Plugin",
  "description": "A plugin that does awesome things",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.js",
  "categories": ["productivity", "editor"],
  "keywords": ["notes", "productivity"],
  "engines": {
    "lokus": "^1.0.0"
  },
  "permissions": [
    "filesystem:read",
    "filesystem:write", 
    "network:request",
    "ui:commands",
    "editor:modify"
  ],
  "contributes": {
    "commands": [
      {
        "command": "myPlugin.doSomething",
        "title": "Do Something Awesome"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "myPlugin.doSomething",
          "when": "editorFocus"
        }
      ]
    }
  }
}
```

#### 2. Plugin Entry Point
Create an `index.js` file as your plugin's main entry point:

```javascript
// index.js
export function activate(context) {
  // Register commands
  const disposable = context.commands.registerCommand('myPlugin.doSomething', () => {
    context.window.showInformationMessage('Hello from my plugin!');
  });
  
  context.subscriptions.push(disposable);
  
  // Plugin initialization logic
  console.log('My Awesome Plugin is now active!');
}

export function deactivate() {
  // Cleanup logic when plugin is deactivated
  console.log('My Awesome Plugin has been deactivated');
}
```

### Plugin API Surface

#### Core APIs
- **`context.commands`** - Register and execute commands
- **`context.editor`** - Access and modify editor content
- **`context.window`** - UI interactions and notifications
- **`context.workspace`** - File system and workspace operations
- **`context.settings`** - Plugin configuration management

#### Editor API
```javascript
// Get current editor content
const content = context.editor.getContent();

// Insert text at cursor
context.editor.insertText('Hello, World!');

// Replace selection
context.editor.replaceSelection('New text');

// Get current selection
const selection = context.editor.getSelection();

// Listen for content changes
context.editor.onDidChangeContent((event) => {
  console.log('Editor content changed:', event);
});
```

#### UI API
```javascript
// Show notification
context.window.showInformationMessage('Success!');
context.window.showWarningMessage('Warning!');
context.window.showErrorMessage('Error occurred');

// Show input dialog
const result = await context.window.showInputBox({
  prompt: 'Enter a value:',
  placeholder: 'Type here...'
});

// Show quick pick
const choice = await context.window.showQuickPick([
  'Option 1',
  'Option 2', 
  'Option 3'
], {
  placeholder: 'Choose an option'
});
```

#### Workspace API
```javascript
// Get current workspace folder
const workspaceFolder = context.workspace.getWorkspaceFolder();

// Read file
const content = await context.workspace.readFile('path/to/file.md');

// Write file
await context.workspace.writeFile('path/to/file.md', 'Content');

// Watch for file changes
context.workspace.onDidChangeFiles((event) => {
  console.log('Files changed:', event.changes);
});
```

### Security Model

#### Sandboxed Execution
All plugins run in a secure sandbox with:
- **Isolated global scope** - Plugins cannot access each other's variables
- **Permission-based access** - Explicit permissions required for system access
- **API restrictions** - Limited to approved plugin APIs
- **Resource limits** - CPU and memory usage monitoring

#### Permission System
Plugins must declare required permissions in their manifest:

```json
{
  "permissions": [
    "filesystem:read",     // Read files from workspace
    "filesystem:write",    // Write files to workspace  
    "network:request",     // Make HTTP requests
    "ui:commands",         // Register UI commands
    "ui:menus",           // Contribute to menus
    "editor:modify",       // Modify editor content
    "settings:read",       // Read plugin settings
    "settings:write",      // Write plugin settings
    "clipboard:read",      // Read clipboard content
    "clipboard:write"      // Write to clipboard
  ]
}
```

#### Content Security Policy
Plugins are subject to strict CSP rules:
- No inline scripts or styles
- No eval() or dynamic code execution
- Restricted external resource loading
- Sandboxed iframe execution

## Plugin Installation & Management

### From Marketplace
1. **Browse Plugins** - Discover plugins in the integrated marketplace
2. **View Details** - Read descriptions, reviews, and permissions
3. **Install** - One-click installation with dependency resolution
4. **Enable/Disable** - Toggle plugin activation without uninstalling
5. **Auto-Updates** - Automatic updates with user consent

### Manual Installation
1. **Download Plugin** - Get plugin package (.lokus-plugin file)
2. **Install via Command Palette** - Use "Install Plugin from VSIX" command
3. **Local Development** - Install from local folder for development

### Plugin Settings
Access plugin settings through:
- **Settings UI** - Dedicated plugin settings panel
- **Command Palette** - "Plugin Settings" command
- **Right-click menu** - Context menu on installed plugins

## Marketplace

### Plugin Discovery
The integrated marketplace provides:
- **Featured Plugins** - Curated selection of high-quality plugins
- **Categories** - Organized by functionality (Editor, Themes, Tools, etc.)
- **Search** - Full-text search across plugin metadata
- **Trending** - Popular and recently updated plugins
- **Ratings & Reviews** - Community feedback and ratings

### Plugin Information
Each plugin listing includes:
- **Description** - Detailed plugin functionality
- **Version History** - Change log and version information
- **Dependencies** - Required plugin dependencies
- **Permissions** - Security permissions requested
- **Installation Count** - Usage statistics
- **Rating** - User ratings and reviews
- **Screenshots** - Visual demonstration of plugin features

### Installation Process
1. **Permission Review** - User reviews requested permissions
2. **Dependency Resolution** - Automatic dependency installation
3. **Download & Verify** - Secure download with signature verification
4. **Installation** - Plugin files extracted to secure location
5. **Activation** - Plugin initialized and activated
6. **Configuration** - Optional post-installation setup

## MCP Integration

### Model Context Protocol Support
Lokus supports MCP for AI assistant integrations:

#### MCP Plugin Structure
```json
{
  "name": "ai-assistant-plugin",
  "type": "mcp",
  "mcp": {
    "server": {
      "command": "python",
      "args": ["-m", "my_mcp_server"],
      "env": {
        "API_KEY": "${config:apiKey}"
      }
    },
    "capabilities": ["resources", "tools", "prompts"]
  }
}
```

#### MCP Integration Features
- **Resource Access** - AI can access notes and files through MCP
- **Tool Execution** - AI can execute plugin-defined tools
- **Prompt Templates** - Predefined prompts for common tasks
- **Context Awareness** - AI understands current editor context

## Advanced Features

### Hot Reloading
During development, plugins support hot reloading:
```javascript
// Enable hot reload in development
if (process.env.NODE_ENV === 'development') {
  context.subscriptions.push(
    context.workspace.onDidChangeFiles((event) => {
      if (event.changes.some(change => change.uri.endsWith('.js'))) {
        context.runtime.reload();
      }
    })
  );
}
```

### Inter-Plugin Communication
Plugins can communicate through the message bus:
```javascript
// Send message to another plugin
context.messaging.sendMessage('other-plugin-id', {
  type: 'data-request',
  payload: { query: 'user data' }
});

// Listen for messages
context.messaging.onMessage((message) => {
  if (message.type === 'data-request') {
    // Handle request
    return { data: 'response data' };
  }
});
```

### Plugin State Management
Plugins can persist state across sessions:
```javascript
// Store state
await context.state.set('myKey', { value: 'data' });

// Retrieve state
const data = await context.state.get('myKey');

// Clear state
await context.state.clear();
```

## Debugging & Development Tools

### Development Console
Built-in development tools include:
- **Plugin Console** - Dedicated console for plugin logs
- **Error Tracking** - Automatic error capture and reporting
- **Performance Monitoring** - CPU and memory usage tracking
- **API Call Tracing** - Monitor plugin API usage

### Debug Configuration
Add debugging support to your plugin:
```json
{
  "debug": {
    "enabled": true,
    "logLevel": "debug",
    "breakpoints": true,
    "sourceMaps": true
  }
}
```

### Testing Framework
Plugins can include unit tests:
```javascript
// test/index.test.js
import { test, expect } from '@lokus/plugin-test-framework';

test('plugin command execution', async () => {
  const result = await executeCommand('myPlugin.doSomething');
  expect(result).toBe('expected output');
});
```

## Publishing Plugins

### Preparation
1. **Test Thoroughly** - Ensure plugin works across different scenarios
2. **Documentation** - Include comprehensive README and examples
3. **Version Management** - Follow semantic versioning
4. **Security Review** - Minimize permissions and validate security

### Publishing Process
1. **Package Plugin** - Create .lokus-plugin bundle
2. **Submit to Marketplace** - Upload through developer portal
3. **Review Process** - Automated and manual security review
4. **Publication** - Plugin becomes available in marketplace
5. **Maintenance** - Regular updates and bug fixes

### Marketplace Guidelines
- **Quality Standards** - Plugins must meet quality and functionality standards
- **Security Requirements** - Must pass security review process
- **Documentation** - Complete documentation required
- **Maintenance** - Active maintenance and support expected

## Troubleshooting

### Common Issues

**Plugin not loading:**
- Check plugin manifest syntax
- Verify main entry file exists
- Review console for error messages
- Ensure all dependencies are installed

**Permission errors:**
- Add required permissions to manifest
- Check sandbox restrictions
- Verify API usage matches declared permissions

**API not working:**
- Verify API method exists in current version
- Check parameter types and formats
- Review API documentation for changes

### Performance Issues
- **Memory leaks** - Properly dispose of event listeners
- **CPU usage** - Optimize background tasks
- **Startup time** - Lazy load heavy dependencies
- **File access** - Cache frequently accessed files

## Examples

### Simple Editor Plugin
```javascript
export function activate(context) {
  // Command to insert current date
  const insertDate = context.commands.registerCommand(
    'datePlugin.insertDate',
    () => {
      const date = new Date().toLocaleDateString();
      context.editor.insertText(date);
    }
  );
  
  context.subscriptions.push(insertDate);
}
```

### File Processing Plugin
```javascript
export function activate(context) {
  // Command to count words in current file
  const wordCount = context.commands.registerCommand(
    'wordCounter.count',
    async () => {
      const content = context.editor.getContent();
      const words = content.split(/\s+/).filter(word => word.length > 0);
      context.window.showInformationMessage(`Word count: ${words.length}`);
    }
  );
  
  context.subscriptions.push(wordCount);
}
```

### UI Extension Plugin
```javascript
export function activate(context) {
  // Add custom sidebar panel
  const panel = context.ui.createPanel({
    id: 'myPanel',
    title: 'My Custom Panel',
    iconPath: 'icons/panel.svg'
  });
  
  panel.webview.html = `
    <h3>Custom Panel</h3>
    <button onclick="sendMessage()">Click me</button>
    <script>
      function sendMessage() {
        window.parent.postMessage({ action: 'buttonClicked' });
      }
    </script>
  `;
  
  panel.webview.onDidReceiveMessage((message) => {
    if (message.action === 'buttonClicked') {
      context.window.showInformationMessage('Button was clicked!');
    }
  });
  
  context.subscriptions.push(panel);
}
```

## Related Features

- **[Marketplace](./marketplace.md)** - Plugin discovery and installation
- **[Plugin Settings](./plugin-settings.md)** - Plugin configuration and management
- **[Command Palette](./command-palette.md)** - Command registration and execution
- **[Editor API](../api/editor.md)** - Editor manipulation interfaces
- **[Security Model](../developer/plugin-security.md)** - Plugin security and sandboxing

## API Reference

Complete API documentation is available in the [Plugin API Reference](../api/plugins.md).

---

*For more information on plugin development, see the [Plugin Development Guide](../developer/plugin-development.md).*