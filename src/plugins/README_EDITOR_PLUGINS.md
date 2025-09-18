# Editor Plugin System - Developer Guide

This guide covers how to create powerful editor plugins using Lokus's enhanced TipTap integration system.

## Overview

The Lokus editor plugin system provides comprehensive extensibility for the TipTap editor, allowing plugins to:

- **Custom Nodes & Marks**: Create new content types and text formatting
- **Extensions**: Add functionality and behavior to the editor
- **Slash Commands**: Integrate with the command palette
- **Toolbar Integration**: Add custom toolbar buttons and dropdowns
- **Input Rules**: Define markdown-style shortcuts
- **Keyboard Shortcuts**: Add custom key bindings
- **Node Views**: Create interactive, custom-rendered content
- **Hot Reloading**: Develop with instant feedback
- **Error Recovery**: Robust error handling and security

## Quick Start

### Basic Plugin Structure

```javascript
// src/plugins/my-plugin/index.js
export class MyEditorPlugin {
  constructor() {
    this.id = 'my-editor-plugin'
    this.name = 'My Editor Plugin'
    this.version = '1.0.0'
    this.description = 'Adds awesome editor functionality'
  }

  async activate() {
    console.log('Plugin activated')
    return true
  }

  async deactivate() {
    console.log('Plugin deactivated')
  }

  async registerEditorExtensions(editorAPI) {
    // Register your extensions here
    await this.registerNodes(editorAPI)
    await this.registerSlashCommands(editorAPI)
    await this.registerToolbarItems(editorAPI)
  }

  async registerNodes(editorAPI) {
    editorAPI.registerNode(this.id, {
      name: 'myCustomNode',
      group: 'block',
      content: 'text*',
      parseHTML: () => [{ tag: 'div.my-custom-node' }],
      renderHTML: () => ['div', { class: 'my-custom-node' }, 0],
      commands: {
        setMyCustomNode: () => ({ commands }) => {
          return commands.insertContent({
            type: 'myCustomNode',
            content: [{ type: 'text', text: 'Hello World!' }]
          })
        }
      }
    })
  }

  async registerSlashCommands(editorAPI) {
    editorAPI.registerSlashCommand(this.id, {
      id: 'my-command',
      title: 'My Custom Command',
      description: 'Insert my custom content',
      icon: '🎉',
      group: 'Custom',
      handler: ({ editor, range }) => {
        editor.chain()
          .focus()
          .deleteRange(range)
          .setMyCustomNode()
          .run()
      }
    })
  }

  async registerToolbarItems(editorAPI) {
    editorAPI.registerToolbarItem(this.id, {
      id: 'my-toolbar-button',
      type: 'button',
      title: 'My Custom Button',
      icon: '🎨',
      group: 'formatting',
      handler: ({ editor }) => {
        editor.commands.setMyCustomNode()
      }
    })
  }
}

export default new MyEditorPlugin()
```

## Core Concepts

### 1. EditorAPI

The `EditorAPI` is your main interface for registering extensions:

```javascript
import { editorAPI } from '../../plugins/api/EditorAPI.js'

// Register different types of extensions
editorAPI.registerNode(pluginId, nodeConfig)
editorAPI.registerMark(pluginId, markConfig) 
editorAPI.registerExtension(pluginId, extensionConfig)
editorAPI.registerSlashCommand(pluginId, commandConfig)
editorAPI.registerToolbarItem(pluginId, toolbarConfig)
editorAPI.registerInputRule(pluginId, ruleConfig)
editorAPI.registerKeyboardShortcut(pluginId, shortcutConfig)
```

### 2. Hot Reloading

Extensions are automatically hot-reloaded when plugins are enabled/disabled or updated:

```javascript
// Trigger manual hot reload (for development)
await editorAPI.hotReloadExtensions()

// Listen for hot reload events
editorAPI.on('hot-reload-requested', ({ extensions, content }) => {
  console.log('Hot reload in progress...')
})
```

### 3. Error Handling

The system includes comprehensive error handling:

```javascript
import { errorHandler } from '../../plugins/api/ErrorHandler.js'

// Monitor plugin health
const healthReport = errorHandler.getHealthReport(pluginId)
console.log('Plugin health:', healthReport.overall.status)

// Handle errors in your plugin
try {
  // Plugin code
} catch (error) {
  errorHandler.handleError(pluginId, error, { 
    operation: 'my-operation',
    context: 'additional context'
  })
}
```

## Extension Types

### Nodes

Nodes represent content blocks in the editor:

```javascript
editorAPI.registerNode(pluginId, {
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  
  attributes: {
    type: {
      default: 'info',
      parseHTML: element => element.getAttribute('data-type'),
      renderHTML: attributes => ({ 'data-type': attributes.type })
    }
  },
  
  parseHTML: () => [
    { tag: 'div.callout' }
  ],
  
  renderHTML: ({ HTMLAttributes }) => [
    'div', 
    { class: 'callout', ...HTMLAttributes }, 
    0
  ],
  
  commands: {
    setCallout: (type = 'info') => ({ commands }) => {
      return commands.setNode('callout', { type })
    }
  },
  
  inputRules: [
    {
      find: /^:::(info|warning|error)\s*$/,
      handler: ({ state, range, match, chain }) => {
        const type = match[1]
        chain().deleteRange(range).setCallout(type).run()
      }
    }
  ],
  
  keyboardShortcuts: {
    'Mod-Shift-c': ({ commands }) => commands.setCallout()
  }
})
```

### Marks

Marks represent text formatting:

```javascript
editorAPI.registerMark(pluginId, {
  name: 'customHighlight',
  
  attributes: {
    color: {
      default: 'yellow',
      parseHTML: element => element.style.backgroundColor,
      renderHTML: attributes => ({ 
        style: `background-color: ${attributes.color}` 
      })
    }
  },
  
  parseHTML: () => [
    { tag: 'mark' },
    { style: 'background-color' }
  ],
  
  renderHTML: ({ HTMLAttributes }) => [
    'mark', 
    HTMLAttributes, 
    0
  ],
  
  commands: {
    setCustomHighlight: (color = 'yellow') => ({ commands }) => {
      return commands.setMark('customHighlight', { color })
    },
    
    toggleCustomHighlight: (color = 'yellow') => ({ commands }) => {
      return commands.toggleMark('customHighlight', { color })
    }
  }
})
```

### Extensions

Extensions add general functionality:

```javascript
editorAPI.registerExtension(pluginId, {
  name: 'autoComplete',
  
  options: {
    suggestions: [],
    debounceTime: 300
  },
  
  commands: {
    triggerAutoComplete: () => ({ state, dispatch }) => {
      // Auto-complete logic
      return true
    }
  },
  
  keyboardShortcuts: {
    'Ctrl-Space': ({ commands }) => commands.triggerAutoComplete()
  },
  
  proseMirrorPlugins: [
    () => new Plugin({
      key: new PluginKey('autoComplete'),
      // Plugin implementation
    })
  ]
})
```

### Slash Commands

Add commands to the slash command palette:

```javascript
editorAPI.registerSlashCommand(pluginId, {
  id: 'insert-table',
  title: 'Table',
  description: 'Insert a data table',
  icon: '📊',
  group: 'Content',
  order: 10,
  keywords: ['table', 'data', 'grid'],
  
  handler: ({ editor, range }) => {
    editor.chain()
      .focus()
      .deleteRange(range)
      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
      .run()
  },
  
  // Optional: conditional availability
  when: ({ editor }) => editor.can().insertTable()
})
```

### Toolbar Items

Add custom toolbar functionality:

```javascript
// Button
editorAPI.registerToolbarItem(pluginId, {
  id: 'my-button',
  type: 'button',
  title: 'My Action',
  icon: '🎯',
  group: 'formatting',
  order: 50,
  
  handler: ({ editor }) => {
    editor.commands.myCustomCommand()
  },
  
  isActive: ({ editor }) => editor.isActive('myNode'),
  isDisabled: ({ editor }) => !editor.can().myCustomCommand(),
  
  when: ({ editor }) => editor.isEditable
})

// Dropdown
editorAPI.registerToolbarItem(pluginId, {
  id: 'my-dropdown',
  type: 'dropdown',
  title: 'Text Style',
  icon: '🎨',
  group: 'formatting',
  
  items: [
    {
      id: 'heading1',
      title: 'Heading 1',
      icon: 'H1',
      handler: ({ editor }) => editor.commands.setHeading({ level: 1 })
    },
    {
      id: 'heading2', 
      title: 'Heading 2',
      icon: 'H2',
      handler: ({ editor }) => editor.commands.setHeading({ level: 2 })
    },
    { id: 'separator', type: 'separator' },
    {
      id: 'paragraph',
      title: 'Paragraph',
      icon: 'P',
      handler: ({ editor }) => editor.commands.setParagraph()
    }
  ]
})
```

### Input Rules

Define markdown-style input shortcuts:

```javascript
editorAPI.registerInputRule(pluginId, {
  id: 'youtube-embed',
  pattern: /^youtube:\s*(https?:\/\/(?:www\.)?youtube\.com\/watch\?v=[\w-]+)\s*$/,
  
  handler: ({ state, range, match, chain }) => {
    const url = match[1]
    const videoId = url.split('v=')[1]
    
    chain()
      .deleteRange(range)
      .insertContent({
        type: 'youtubeEmbed',
        attrs: { videoId }
      })
      .run()
  }
})
```

### Keyboard Shortcuts

Add custom keyboard shortcuts:

```javascript
editorAPI.registerKeyboardShortcut(pluginId, {
  key: 'Mod-Shift-d',
  handler: ({ editor }) => {
    return editor.commands.duplicateCurrentLine()
  },
  priority: 100
})
```

### Node Views

Create interactive, custom-rendered content:

```javascript
editorAPI.registerNode(pluginId, {
  name: 'interactiveChart',
  
  nodeView: ({ node, view, getPos, editor }) => {
    // Create DOM element
    const dom = document.createElement('div')
    dom.className = 'interactive-chart'
    
    // Create chart using your preferred library
    const chart = new ChartLibrary(dom, {
      data: node.attrs.data,
      type: node.attrs.chartType
    })
    
    // Update handler
    const update = (newNode) => {
      if (newNode.attrs.data !== node.attrs.data) {
        chart.updateData(newNode.attrs.data)
      }
      return true
    }
    
    // Selection handlers
    const selectNode = () => {
      dom.classList.add('ProseMirror-selectednode')
    }
    
    const deselectNode = () => {
      dom.classList.remove('ProseMirror-selectednode')
    }
    
    return {
      dom,
      update,
      selectNode,
      deselectNode,
      destroy: () => chart.destroy()
    }
  }
})
```

## Advanced Features

### Custom Formats

Register custom import/export formats:

```javascript
editorAPI.registerFormat(pluginId, {
  name: 'confluence',
  displayName: 'Confluence Wiki',
  extensions: ['.confluence'],
  mimeTypes: ['text/confluence'],
  
  export: (content) => {
    // Convert HTML to Confluence format
    return convertToConfluence(content)
  },
  
  import: (confluenceContent) => {
    // Convert Confluence format to HTML
    return convertFromConfluence(confluenceContent)
  }
})
```

### Plugin Communication

Plugins can communicate through events:

```javascript
// In plugin A
editorAPI.emit('my-custom-event', { data: 'hello' })

// In plugin B
editorAPI.on('my-custom-event', ({ data }) => {
  console.log('Received:', data)
})
```

### Performance Optimization

Monitor and optimize your plugin performance:

```javascript
import { errorHandler } from '../../plugins/api/ErrorHandler.js'

// Monitor specific operations
const startTime = performance.now()
await myExpensiveOperation()
const duration = performance.now() - startTime

errorHandler.monitorPerformance(pluginId, 'expensiveOperation', duration, {
  operationType: 'data-processing',
  itemCount: items.length
})

// Optimize based on performance metrics
const stats = errorHandler.getPerformanceStats(pluginId)
if (stats.averageDuration > 1000) {
  // Switch to faster algorithm
}
```

### Security Validation

The system automatically validates security aspects:

```javascript
// Security violations are automatically detected
// - Suspicious DOM operations
// - Unsafe network requests
// - Sensitive storage access

// Check security status
const securityStats = errorHandler.getSecurityStats(pluginId)
console.log('Security violations:', securityStats.totalViolations)
```

## Development Workflow

### 1. Plugin Development Setup

```bash
# Create plugin directory
mkdir src/plugins/my-plugin
cd src/plugins/my-plugin

# Create plugin files
touch index.js
touch manifest.json
touch README.md
```

### 2. Manifest File

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "author": "Your Name",
  "main": "index.js",
  "permissions": [
    "ui:editor",
    "ui:toolbar"
  ],
  "dependencies": {},
  "keywords": ["editor", "productivity"]
}
```

### 3. Development and Testing

```javascript
// Enable hot reloading during development
if (import.meta.env.DEV) {
  // Auto-reload on file changes
  import.meta.hot?.accept()
}

// Test your plugin
import { compatibilityTester } from '../../plugins/api/PluginCompatibilityTester.js'

const testResults = await compatibilityTester.runAllTests({
  hotReloadTests: true,
  compatibilityTests: true,
  performanceTests: true
})

console.log('Test results:', testResults)
```

### 4. Error Handling Best Practices

```javascript
export class MyPlugin {
  async registerEditorExtensions(editorAPI) {
    try {
      // Wrap registrations in try-catch
      await this.registerNodes(editorAPI)
      await this.registerCommands(editorAPI)
    } catch (error) {
      console.error('Plugin registration failed:', error)
      // Plugin will be automatically disabled if too many errors occur
      throw error
    }
  }
  
  // Provide fallback functionality
  createFallbackNode() {
    return {
      name: 'fallbackNode',
      group: 'block',
      content: 'text*',
      parseHTML: () => [{ tag: 'div.fallback' }],
      renderHTML: () => ['div', { class: 'fallback' }, 0]
    }
  }
}
```

## Examples

See the example plugins for complete implementations:

- **DiagramPlugin** (`src/plugins/examples/DiagramPlugin.js`): Mermaid diagram integration
- **SyntaxHighlightPlugin** (`src/plugins/examples/SyntaxHighlightPlugin.js`): Enhanced code blocks
- **ToolbarCustomizationPlugin** (`src/plugins/examples/ToolbarCustomizationPlugin.js`): Custom toolbar functionality

## API Reference

### EditorAPI Methods

```javascript
// Node registration
registerNode(pluginId, nodeConfig) -> extensionId
registerMark(pluginId, markConfig) -> extensionId
registerExtension(pluginId, extensionConfig) -> extensionId

// UI registration
registerSlashCommand(pluginId, commandConfig) -> commandId
registerToolbarItem(pluginId, toolbarConfig) -> itemId
registerInputRule(pluginId, ruleConfig) -> ruleId
registerKeyboardShortcut(pluginId, shortcutConfig) -> shortcutId

// Utility methods
getAllExtensions() -> Array<Extension>
getSlashCommands() -> Array<CommandGroup>
getToolbarItems(group?) -> Array<ToolbarItem>
hotReloadExtensions() -> Promise<void>
unregisterPlugin(pluginId) -> void

// Statistics
getStats() -> PluginStats
```

### Error Handler Methods

```javascript
// Error handling
handleError(pluginId, error, context) -> ErrorInfo
monitorPerformance(pluginId, operation, duration, metadata) -> void
validateSecurity(pluginId, operation, context) -> Array<Violation>

// Health monitoring
getHealthReport(pluginId) -> HealthReport
getSystemStats() -> SystemStats
```

### Extension Manager Methods

```javascript
// Plugin lifecycle
loadPluginExtensions(plugin) -> Promise<LoadResult>
unloadPluginExtensions(pluginId) -> Promise<void>
hotReloadPlugin(pluginId) -> Promise<void>
hotReloadAll() -> Promise<void>

// Statistics
getStats() -> ExtensionStats
```

## Best Practices

### 1. Performance

- Keep extension registration fast (< 5 seconds)
- Minimize memory usage in node views
- Use lazy loading for heavy resources
- Monitor performance metrics

### 2. Security

- Validate all user inputs
- Avoid unsafe DOM operations
- Limit network requests
- Don't access sensitive storage keys

### 3. Compatibility

- Test with existing plugins
- Provide fallback functionality
- Handle errors gracefully
- Follow semantic versioning

### 4. User Experience

- Provide clear command descriptions
- Use intuitive keyboard shortcuts
- Add helpful icons and tooltips
- Test accessibility

### 5. Development

- Use TypeScript for better development experience
- Write comprehensive tests
- Document your API
- Follow the plugin template structure

## Troubleshooting

### Common Issues

**Plugin not loading:**
- Check manifest.json syntax
- Verify plugin permissions
- Check console for errors
- Ensure all dependencies are available

**Hot reload not working:**
- Verify editor instance is set
- Check for plugin errors
- Ensure extensions are properly registered

**Performance issues:**
- Check performance metrics
- Optimize expensive operations
- Reduce memory usage
- Use performance monitoring

**Security violations:**
- Review security validation errors
- Avoid suspicious operations
- Follow security best practices

### Debug Mode

Enable debug mode for detailed logging:

```javascript
// Set debug flag
window.__LOKUS_DEBUG_PLUGINS__ = true

// Enable verbose logging
console.log('Plugin debug mode enabled')
```

### Getting Help

- Check the console for detailed error messages
- Review the example plugins for reference patterns
- Use the compatibility tester to identify issues
- Check the health reports for system status

---

This guide covers the core concepts and features of the Lokus editor plugin system. For more advanced use cases and detailed API documentation, refer to the source code and example implementations.