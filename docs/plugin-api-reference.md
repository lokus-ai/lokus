# Lokus Plugin API Reference

## Overview

The Lokus Plugin API provides a comprehensive interface for plugins to interact with the editor, UI, filesystem, and other core features. All API operations are permission-controlled and provide safe, sandboxed access to system resources.

## API Structure

The Plugin API is organized into several modules:

- **Editor API**: Text manipulation, extensions, and editor state
- **UI API**: User interface components and dialogs
- **Filesystem API**: File operations with permission checking
- **Settings API**: Plugin-specific configuration management
- **Event System**: Event handling and communication
- **Utility Methods**: Helper functions and common operations

## Getting Started

All plugins receive an initialized API instance through the BasePlugin class:

```javascript
import { BasePlugin } from '@lokus/plugin-base';

export default class MyPlugin extends BasePlugin {
  async activate() {
    // API is available as this.api
    const content = this.api.getEditorContent();
    this.api.showNotification('Plugin activated!');
  }
}
```

## Editor API

### Content Operations

#### `getEditorContent(): string`

Returns the current editor content as HTML.

```javascript
const content = this.api.getEditorContent();
console.log('Current content:', content);
```

#### `setEditorContent(content: string): void`

Sets the editor content. Replaces all existing content.

```javascript
this.api.setEditorContent('<h1>New Document</h1><p>Starting fresh!</p>');
```

#### `insertContent(content: string): void`

Inserts content at the current cursor position.

```javascript
// Insert text at cursor
this.api.insertContent('Hello, world!');

// Insert HTML content
this.api.insertContent('<strong>Bold text</strong>');

// Insert complex content
this.api.insertContent(`
  <table>
    <tr><th>Name</th><th>Value</th></tr>
    <tr><td>Item 1</td><td>100</td></tr>
  </table>
`);
```

#### `getSelection(): SelectionInfo`

Returns information about the current selection.

```javascript
const selection = this.api.getSelection();

// SelectionInfo interface
interface SelectionInfo {
  text: string;        // Selected text content
  html: string;        // Selected HTML content
  from: number;        // Start position
  to: number;          // End position
  empty: boolean;      // True if no selection
}

if (!selection.empty) {
  console.log('Selected text:', selection.text);
}
```

### Extension Management

#### `addExtension(extension: Extension, options?: ExtensionOptions): string`

Registers a TipTap extension with the editor.

```javascript
import { Extension } from '@tiptap/core';

const MyExtension = Extension.create({
  name: 'myExtension',
  
  addCommands() {
    return {
      insertTimestamp: () => ({ commands }) => {
        const timestamp = new Date().toISOString();
        return commands.insertContent(`[${timestamp}]`);
      }
    };
  },
  
  addKeyboardShortcuts() {
    return {
      'Mod-Shift-t': () => this.editor.commands.insertTimestamp()
    };
  }
});

// Register extension
const extensionId = this.api.addExtension(MyExtension, {
  priority: 100,
  group: 'formatting'
});
```

#### `removeExtension(extensionId: string): void`

Removes a previously registered extension.

```javascript
// Extension is automatically removed when plugin deactivates
// Manual removal:
this.api.removeExtension(extensionId);
```

### Command Registration

#### `addSlashCommand(command: SlashCommand): string`

Registers a slash command in the editor.

```javascript
const commandId = this.api.addSlashCommand({
  name: 'insert-quote',
  description: 'Insert inspirational quote',
  icon: '💬',
  shortcut: 'Mod+Shift+Q',
  action: () => {
    const quotes = [
      'The best time to plant a tree was 20 years ago. The second best time is now.',
      'Your limitation—it\'s only your imagination.',
      'Great things never come from comfort zones.'
    ];
    const quote = quotes[Math.floor(Math.random() * quotes.length)];
    this.api.insertContent(`<blockquote>${quote}</blockquote>`);
  }
});
```

#### `removeSlashCommand(commandId: string): void`

Removes a slash command.

```javascript
this.api.removeSlashCommand(commandId);
```

### Toolbar Integration

#### `addToolbarButton(button: ToolbarButton): string`

Adds a button to the editor toolbar.

```javascript
const buttonId = this.api.addToolbarButton({
  name: 'word-count',
  title: 'Show Word Count',
  icon: '📊',
  action: () => {
    const content = this.api.getEditorContent();
    const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
    this.api.showNotification(`Word count: ${wordCount}`, 'info');
  },
  position: 'right',
  priority: 10
});
```

## UI API

### Panel Management

#### `registerPanel(panel: PanelConfig): string`

Registers a UI panel in the sidebar or other locations.

```javascript
const panelId = this.api.registerPanel({
  name: 'my-panel',
  title: 'My Plugin Panel',
  position: 'sidebar', // 'sidebar', 'bottom', 'modal'
  icon: '🔧',
  content: this.createPanelHTML(),
  resizable: true,
  defaultSize: { width: 300, height: 400 },
  actions: [
    {
      id: 'refresh',
      title: 'Refresh',
      icon: '🔄',
      action: () => this.refreshPanelContent()
    }
  ]
});
```

#### `unregisterPanel(panelId: string): void`

Removes a registered panel.

```javascript
this.api.unregisterPanel(panelId);
```

### Menu Integration

#### `addMenuItem(menuItem: MenuItem): string`

Adds items to application menus.

```javascript
const menuId = this.api.addMenuItem({
  menu: 'editor/context', // Context menu location
  command: 'my-plugin.action',
  title: 'My Plugin Action',
  icon: '⚡',
  group: 'editing',
  when: 'editorTextFocus', // Condition for showing
  order: 10
});
```

### Notifications

#### `showNotification(notification: NotificationConfig): void`

Displays notifications to the user.

```javascript
// Simple notification
this.api.showNotification('Operation completed successfully', 'success');

// Advanced notification
this.api.showNotification({
  message: 'Processing file...',
  type: 'info', // 'info', 'success', 'warning', 'error'
  duration: 5000, // Auto-hide after 5 seconds
  actions: [
    {
      text: 'Cancel',
      action: () => this.cancelOperation()
    },
    {
      text: 'Details',
      action: () => this.showDetails()
    }
  ]
});
```

### Dialogs

#### `showDialog(dialog: DialogConfig): Promise<DialogResult>`

Shows modal dialogs for user interaction.

```javascript
// Confirmation dialog
const result = await this.api.showDialog({
  type: 'confirm',
  title: 'Delete File',
  message: 'Are you sure you want to delete this file?',
  buttons: ['Cancel', 'Delete']
});

if (result.button === 'Delete') {
  // Proceed with deletion
}

// Input dialog
const input = await this.api.showDialog({
  type: 'input',
  title: 'Enter Name',
  message: 'Please enter a name for the new item:',
  placeholder: 'Item name',
  validation: (value) => {
    if (!value.trim()) return 'Name is required';
    if (value.length > 50) return 'Name too long';
    return null;
  }
});

if (input.confirmed) {
  console.log('User entered:', input.value);
}

// Custom dialog
const custom = await this.api.showDialog({
  type: 'custom',
  title: 'Advanced Settings',
  content: this.createCustomDialogContent(),
  size: { width: 600, height: 400 },
  buttons: [
    { text: 'Cancel', role: 'cancel' },
    { text: 'Apply', role: 'confirm', primary: true }
  ]
});
```

## Filesystem API

**Note**: All filesystem operations require appropriate permissions in the plugin manifest.

### File Operations

#### `readFile(filePath: string): Promise<string>`

Reads a text file from the filesystem.

**Required Permission**: `read_files`

```javascript
try {
  const content = await this.api.readFile('/path/to/file.txt');
  console.log('File content:', content);
} catch (error) {
  this.logger.error('Failed to read file:', error);
}
```

#### `writeFile(filePath: string, content: string): Promise<void>`

Writes content to a file.

**Required Permission**: `write_files`

```javascript
try {
  await this.api.writeFile('/path/to/output.txt', 'Hello, world!');
  this.api.showNotification('File saved successfully', 'success');
} catch (error) {
  this.logger.error('Failed to write file:', error);
  this.api.showNotification('Failed to save file', 'error');
}
```

#### `fileExists(filePath: string): Promise<boolean>`

Checks if a file exists.

**Required Permission**: `read_files`

```javascript
const exists = await this.api.fileExists('/path/to/file.txt');
if (exists) {
  console.log('File exists');
} else {
  console.log('File not found');
}
```

## Settings API

### Configuration Management

#### `getSetting(key: string, defaultValue?: any): Promise<any>`

Retrieves a plugin setting value.

```javascript
// Get setting with default
const theme = await this.api.getSetting('theme', 'default');
const autoSave = await this.api.getSetting('autoSave', true);
const maxItems = await this.api.getSetting('maxItems', 10);

// Handle different types
const config = await this.api.getSetting('advancedConfig', {
  enabled: true,
  options: []
});
```

#### `setSetting(key: string, value: any): Promise<void>`

Sets a plugin setting value.

```javascript
// Set simple values
await this.api.setSetting('theme', 'dark');
await this.api.setSetting('autoSave', false);

// Set complex objects
await this.api.setSetting('userPreferences', {
  notifications: true,
  shortcuts: {
    'save': 'Ctrl+S',
    'export': 'Ctrl+E'
  }
});

// Trigger UI update after setting change
this.api.emit('settings:changed', { key: 'theme', value: 'dark' });
```

#### `getAllSettings(): Promise<object>`

Gets all plugin settings as an object.

```javascript
const allSettings = await this.api.getAllSettings();
console.log('Current settings:', allSettings);
```

## Event System

### Event Listening

#### `on(event: string, listener: Function): Function`

Subscribes to events. Returns unsubscribe function.

```javascript
// Listen to editor events
const unsubscribe = this.api.on('editor:content-change', (event) => {
  console.log('Content changed:', event.content);
  this.updateWordCount();
});

// Listen to selection changes
this.api.on('editor:selection-change', (selection) => {
  this.updateSelectionInfo(selection);
});

// Listen to file events
this.api.on('file:opened', (fileInfo) => {
  console.log('File opened:', fileInfo.path);
});

// Listen to UI events
this.api.on('panel:resized', (event) => {
  if (event.panelId === this.panelId) {
    this.handlePanelResize(event.size);
  }
});

// Cleanup when plugin deactivates
this.addDisposable(unsubscribe);
```

#### `off(event: string, listener: Function): void`

Unsubscribes from events.

```javascript
this.api.off('editor:content-change', this.contentChangeHandler);
```

#### `once(event: string, listener: Function): void`

Listens to an event once.

```javascript
this.api.once('plugin:loaded', () => {
  console.log('Plugin system fully loaded');
  this.initializeFeatures();
});
```

### Event Emission

#### `emit(event: string, data?: any): void`

Emits custom events.

```javascript
// Emit plugin-specific events
this.api.emit('my-plugin:data-updated', {
  timestamp: Date.now(),
  data: this.processedData
});

// Other plugins can listen to these events
this.api.on('my-plugin:data-updated', (event) => {
  console.log('Data updated by my-plugin:', event.data);
});
```

### Available Events

#### Editor Events

```javascript
// Content changes
'editor:content-change' // { content: string, delta: object }
'editor:selection-change' // { selection: SelectionInfo }
'editor:focus' // { focused: boolean }
'editor:blur' // { focused: boolean }

// Document events
'document:saved' // { path: string, content: string }
'document:opened' // { path: string, content: string }
'document:closed' // { path: string }

// Extension events
'extension:added' // { extensionId: string, name: string }
'extension:removed' // { extensionId: string, name: string }
```

#### UI Events

```javascript
// Panel events
'panel:opened' // { panelId: string }
'panel:closed' // { panelId: string }
'panel:resized' // { panelId: string, size: { width, height } }

// Menu events
'menu:item-clicked' // { menuId: string, command: string }

// Theme events
'theme:changed' // { theme: string, colors: object }
```

#### Plugin Events

```javascript
// Plugin lifecycle
'plugin:loaded' // { pluginId: string, manifest: object }
'plugin:activated' // { pluginId: string }
'plugin:deactivated' // { pluginId: string }
'plugin:error' // { pluginId: string, error: Error }

// Settings events
'settings:changed' // { key: string, value: any, pluginId: string }
```

## Utility Methods

### Permission Management

#### `hasPermission(permission: string): boolean`

Checks if the plugin has a specific permission.

```javascript
if (this.api.hasPermission('write_files')) {
  await this.saveDataToFile();
} else {
  this.api.showNotification('File write permission required', 'warning');
}
```

#### `grantPermission(permission: string): void`

Grants a permission to the plugin (admin only).

#### `revokePermission(permission: string): void`

Revokes a permission from the plugin (admin only).

### Resource Management

#### `cleanup(): Promise<void>`

Cleans up all plugin registrations and resources.

```javascript
// Called automatically when plugin deactivates
await this.api.cleanup();
```

#### `getRegistrations(): object`

Gets information about what the plugin has registered.

```javascript
const registrations = this.api.getRegistrations();
console.log('Registered extensions:', registrations.extensions);
console.log('Registered commands:', registrations.slashCommands);
```

### Logging

#### `log(level: string, ...args: any[]): void`

Logs messages with plugin context.

```javascript
this.api.log('info', 'Plugin operation completed');
this.api.log('warn', 'Deprecated feature used');
this.api.log('error', 'Operation failed:', error);
this.api.log('debug', 'Debug information:', debugData);
```

## BasePlugin Helper Methods

The BasePlugin class provides additional helper methods:

### Resource Tracking

#### `addDisposable(disposable: Function | object): any`

Tracks resources for automatic cleanup.

```javascript
// Track event listeners
const unsubscribe = this.api.on('editor:change', this.handler);
this.addDisposable(unsubscribe);

// Track timers
const timer = setInterval(this.updateStats, 1000);
this.addDisposable(() => clearInterval(timer));

// Track objects with dispose method
const resource = new SomeResource();
this.addDisposable(resource); // Must have dispose() method
```

### Async Utilities

#### `safeAsync(operation: Function, fallback?: any): Promise<any>`

Safely executes async operations with error handling.

```javascript
const result = await this.safeAsync(async () => {
  const data = await this.api.readFile('/config.json');
  return JSON.parse(data);
}, {}); // fallback to empty object on error
```

#### `debounce(func: Function, delay: number): Function`

Creates a debounced function.

```javascript
const debouncedSave = this.debounce(async () => {
  await this.saveSettings();
}, 500);

// Use in event handlers
this.api.on('editor:content-change', debouncedSave);
```

#### `throttle(func: Function, limit: number): Function`

Creates a throttled function.

```javascript
const throttledUpdate = this.throttle(() => {
  this.updateUI();
}, 100);

this.api.on('editor:selection-change', throttledUpdate);
```

## Error Handling

### Best Practices

```javascript
export default class MyPlugin extends BasePlugin {
  async activate() {
    try {
      await super.activate();
      
      // Wrap potentially failing operations
      await this.safeAsync(async () => {
        await this.loadConfiguration();
        this.setupUI();
        this.registerCommands();
      });
      
    } catch (error) {
      this.logger.error('Plugin activation failed:', error);
      this.showNotification('Plugin failed to activate', 'error');
      throw error; // Re-throw to prevent incomplete activation
    }
  }

  async loadConfiguration() {
    try {
      const config = await this.api.readFile('./config.json');
      this.config = JSON.parse(config);
    } catch (error) {
      this.logger.warn('Could not load config, using defaults:', error);
      this.config = this.getDefaultConfig();
    }
  }

  registerCommands() {
    try {
      this.registerCommand({
        name: 'my-action',
        action: async () => {
          try {
            await this.performAction();
            this.showNotification('Action completed', 'success');
          } catch (error) {
            this.logger.error('Action failed:', error);
            this.showNotification('Action failed', 'error');
          }
        }
      });
    } catch (error) {
      this.logger.error('Failed to register commands:', error);
    }
  }
}
```

## TypeScript Support

For TypeScript plugins, use the provided type definitions:

```typescript
import { BasePlugin, PluginAPI } from '@lokus/plugin-base';
import { SelectionInfo, PanelConfig, NotificationConfig } from '@lokus/plugin-types';

export default class MyPlugin extends BasePlugin {
  private config: PluginConfig;
  private panelId: string;

  async activate(): Promise<void> {
    await super.activate();
    
    const selection: SelectionInfo = this.api.getSelection();
    
    const panelConfig: PanelConfig = {
      name: 'my-panel',
      title: 'My Panel',
      position: 'sidebar',
      content: this.createPanelContent()
    };
    
    this.panelId = this.api.registerPanel(panelConfig);
  }
}

interface PluginConfig {
  enabled: boolean;
  theme: string;
  options: Record<string, any>;
}
```

## Performance Considerations

### Best Practices

1. **Lazy Loading**: Load resources only when needed
2. **Debouncing**: Use debounced handlers for frequent events
3. **Memory Management**: Clean up event listeners and resources
4. **Efficient DOM Updates**: Minimize DOM manipulations
5. **Async Operations**: Use async/await for file operations

### Example: Efficient Event Handling

```javascript
export default class EfficientPlugin extends BasePlugin {
  constructor() {
    super();
    this.debouncedUpdate = this.debounce(this.updateWordCount, 300);
    this.throttledRender = this.throttle(this.renderUI, 100);
  }

  async activate() {
    await super.activate();
    
    // Debounce content updates
    this.addEventListener('editor:content-change', this.debouncedUpdate);
    
    // Throttle UI updates
    this.addEventListener('editor:selection-change', this.throttledRender);
    
    // Use efficient DOM updates
    this.setupVirtualScrolling();
  }

  updateWordCount() {
    const content = this.getEditorContent();
    const stats = this.calculateStats(content);
    
    // Update only changed values
    this.updateStatsDisplay(stats);
  }

  setupVirtualScrolling() {
    // Implement virtual scrolling for large lists
    // Only render visible items
  }
}
```

## Related Documentation

- [Plugin Development Guide](./plugin-development-guide.md)
- [Plugin Manifest Schema](./plugin-manifest-schema.md)
- [Sample Plugins](./sample-plugins/)
- [Troubleshooting Guide](./plugin-troubleshooting.md)