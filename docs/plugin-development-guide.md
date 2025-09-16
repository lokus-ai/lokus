# Lokus Plugin Development Guide

## Overview

The Lokus Plugin System provides a powerful, extensible framework for enhancing the editor with custom functionality. Plugins can add new editor extensions, UI components, commands, and integrate with external services while maintaining security and performance.

## Getting Started

### Prerequisites

- Node.js 16+ or compatible JavaScript environment
- Basic understanding of JavaScript ES6+ modules
- Familiarity with TipTap editor extensions (for editor plugins)
- Understanding of React components (for UI plugins)

### Plugin Architecture

Lokus plugins follow a modular architecture with clear boundaries:

```
plugin-directory/
├── plugin.json          # Plugin manifest
├── index.js             # Main plugin entry point
├── lib/                 # Plugin modules
├── assets/              # Static assets
└── README.md            # Plugin documentation
```

### Core Components

1. **Plugin Manifest** (`plugin.json`) - Declares plugin metadata, permissions, and dependencies
2. **Main Module** (`index.js`) - Plugin entry point exporting the plugin class
3. **Plugin API** - Standardized interface for interacting with Lokus
4. **Base Plugin Class** - Foundation class providing common functionality

## Development Workflow

### 1. Initialize Plugin Structure

Create a new plugin directory:

```bash
mkdir my-plugin
cd my-plugin
```

Create the basic plugin structure:

```javascript
// plugin.json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A sample Lokus plugin",
  "main": "index.js",
  "lokusVersion": "^1.0.0",
  "author": "Your Name",
  "license": "MIT",
  "permissions": ["editor:read", "ui:sidebar"],
  "activationEvents": ["onStartup"],
  "categories": ["Other"]
}
```

### 2. Create Plugin Class

Create your main plugin file:

```javascript
// index.js
import { BasePlugin } from '@lokus/plugin-base';

export default class MyPlugin extends BasePlugin {
  async activate() {
    await super.activate();
    
    // Initialize your plugin
    this.logger.info('My Plugin activated');
    
    // Register commands, extensions, UI components, etc.
    this.registerCommand({
      name: 'hello-world',
      description: 'Say hello',
      action: () => {
        this.showNotification('Hello from My Plugin!', 'info');
      }
    });
  }

  async deactivate() {
    // Cleanup resources
    await super.deactivate();
  }
}
```

### 3. Implement Plugin Features

#### Adding Editor Extensions

```javascript
import { Extension } from '@tiptap/core';

// Create a custom extension
const MyExtension = Extension.create({
  name: 'myExtension',
  
  addCommands() {
    return {
      insertCustomContent: () => ({ commands }) => {
        return commands.insertContent('Custom content inserted!');
      }
    };
  }
});

// Register in your plugin
this.registerExtension(MyExtension);
```

#### Adding UI Components

```javascript
// Register a sidebar panel
this.registerPanel({
  name: 'my-panel',
  title: 'My Panel',
  position: 'sidebar',
  content: this.createPanelContent(),
  icon: '🔧'
});
```

#### Adding Slash Commands

```javascript
this.registerCommand({
  name: 'my-command',
  description: 'Execute my custom command',
  icon: '⚡',
  action: () => {
    // Command implementation
    const content = this.getEditorContent();
    this.insertContent('Command executed!');
  }
});
```

### 4. Handle Settings and Configuration

```javascript
// Get plugin settings
const setting = await this.getSetting('mySetting', 'defaultValue');

// Set plugin settings
await this.setSetting('mySetting', 'newValue');

// Listen for settings changes
this.addEventListener('settings:changed', (event) => {
  if (event.key === 'mySetting') {
    this.updatePluginBehavior(event.value);
  }
});
```

### 5. File System Operations

```javascript
// Read files (requires 'read_files' permission)
try {
  const content = await this.readFile('/path/to/file.txt');
  console.log('File content:', content);
} catch (error) {
  this.logger.error('Failed to read file:', error);
}

// Write files (requires 'write_files' permission)
try {
  await this.writeFile('/path/to/output.txt', 'Content to write');
  this.showNotification('File saved successfully', 'success');
} catch (error) {
  this.logger.error('Failed to write file:', error);
}
```

### 6. Event Handling

```javascript
// Listen to editor events
this.addEventListener('editor:content-change', () => {
  this.updateAnalysis();
});

this.addEventListener('editor:selection-change', () => {
  this.updateSelectionInfo();
});

// Emit custom events
this.emitEvent('my-plugin:data-updated', { data: 'updated' });
```

### 7. Testing Your Plugin

Create a test directory structure:

```
my-plugin/
├── tests/
│   ├── unit/
│   │   └── plugin.test.js
│   └── integration/
│       └── features.test.js
├── package.json
└── jest.config.js
```

Basic test example:

```javascript
// tests/unit/plugin.test.js
import MyPlugin from '../index.js';
import { MockPluginAPI } from '@lokus/plugin-testing';

describe('MyPlugin', () => {
  let plugin;
  let mockAPI;

  beforeEach(() => {
    mockAPI = new MockPluginAPI();
    plugin = new MyPlugin();
    plugin.api = mockAPI;
  });

  test('should activate successfully', async () => {
    await plugin.activate();
    expect(plugin.isActive).toBe(true);
  });

  test('should register commands', async () => {
    await plugin.activate();
    expect(mockAPI.getRegisteredCommands()).toContain('hello-world');
  });
});
```

## Best Practices

### Security

1. **Minimal Permissions** - Only request permissions your plugin actually needs
2. **Input Validation** - Validate all user inputs and external data
3. **Safe File Operations** - Use plugin API methods instead of direct file system access
4. **Secure Dependencies** - Audit third-party dependencies for vulnerabilities

### Performance

1. **Lazy Loading** - Load resources only when needed
2. **Debounced Updates** - Use debouncing for frequent operations
3. **Memory Management** - Clean up event listeners and resources in `deactivate()`
4. **Efficient Rendering** - Minimize DOM updates and use virtual scrolling for large lists

### Code Quality

1. **Error Handling** - Wrap operations in try-catch blocks
2. **Logging** - Use the plugin logger for debugging and monitoring
3. **Documentation** - Document your plugin's API and usage
4. **Type Safety** - Consider using TypeScript for larger plugins

### Example: Robust Error Handling

```javascript
async activate() {
  try {
    await super.activate();
    
    // Wrap plugin initialization
    await this.safeAsync(async () => {
      await this.initializeUI();
      await this.loadSettings();
      this.setupEventListeners();
    });
    
    this.logger.info('Plugin activated successfully');
  } catch (error) {
    this.logger.error('Plugin activation failed:', error);
    this.showNotification('Plugin failed to activate', 'error');
    throw error;
  }
}

async initializeUI() {
  try {
    this.panelId = this.registerPanel({
      name: 'my-panel',
      title: 'My Panel',
      content: await this.createPanelContent()
    });
  } catch (error) {
    this.logger.error('UI initialization failed:', error);
    throw new Error('Failed to initialize plugin UI');
  }
}
```

## Publishing Your Plugin

### 1. Prepare for Publication

- Ensure all tests pass
- Update version in `plugin.json`
- Create comprehensive README
- Add license file
- Test on different Lokus versions

### 2. Package Structure

```
my-plugin-1.0.0/
├── plugin.json
├── index.js
├── lib/
├── assets/
├── README.md
├── LICENSE
└── CHANGELOG.md
```

### 3. Version Management

Follow semantic versioning:
- **Major** (1.0.0): Breaking changes
- **Minor** (1.1.0): New features, backward compatible
- **Patch** (1.0.1): Bug fixes, backward compatible

### 4. Distribution

Plugins can be distributed as:
- ZIP archives
- Git repositories
- npm packages
- Through the Lokus Plugin Marketplace

## Plugin Lifecycle

### Loading Phase
1. Plugin discovery
2. Manifest validation
3. Dependency resolution
4. Module loading

### Activation Phase
1. Plugin instantiation
2. API initialization
3. `activate()` method call
4. Registration of extensions/commands

### Runtime Phase
1. Event handling
2. API operations
3. User interactions
4. Background tasks

### Deactivation Phase
1. `deactivate()` method call
2. Resource cleanup
3. Event listener removal
4. Extension unregistration

## Next Steps

- Review the [Plugin API Reference](./plugin-api-reference.md)
- Explore [Plugin Manifest Schema](./plugin-manifest-schema.md)
- Check out [Sample Plugins](./sample-plugins/)
- Read the [Troubleshooting Guide](./plugin-troubleshooting.md)

## Resources

- [Lokus Plugin API Documentation](./plugin-api-reference.md)
- [TipTap Extension Guide](https://tiptap.dev/guide/custom-extensions)
- [Plugin Development Examples](https://github.com/lokus-app/plugin-examples)
- [Community Forum](https://community.lokus.app)