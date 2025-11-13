# Lokus Plugin System Architecture

## Overview

Lokus has a **three-layer plugin architecture** designed for separation of concerns and extensibility. Each layer serves a distinct purpose and should not be confused with one another.

## The Three Plugin Systems

### 1. Core Plugin Manager (`src/plugins/PluginManager.js`)

**Purpose:** Central plugin lifecycle and dependency management system

**Responsibilities:**
- Plugin discovery and registration
- Manifest validation (v1 and v2 formats)
- Dependency resolution with topological sorting
- Plugin lifecycle management (load, activate, deactivate, unload, reload)
- Plugin security validation
- API provisioning via `LokusPluginAPI`
- Mock plugin support for browser testing
- Error handling and recovery

**Key Features:**
- 762 lines of comprehensive plugin management
- EventEmitter-based architecture
- Browser AND Tauri environment support
- Integration with `PluginSecurityManager` for sandboxing
- MCP (Model Context Protocol) integration

**When to Use:**
- Implementing core plugin functionality
- Adding new plugin lifecycle hooks
- Modifying plugin loading behavior
- Enhancing security features

**Key Files:**
- `src/plugins/PluginManager.js` - Main manager class
- `src/plugins/core/PluginLoader.js` - Plugin loading logic
- `src/plugins/security/PluginSecurityManager.js` - Security policies
- `src/plugins/security/PluginSandbox.js` - JavaScript sandbox

---

### 2. UI State Adapter (`src/core/plugins/PluginStateAdapter.js`)

**Purpose:** React UI state management facade

**Responsibilities:**
- Manage plugin list UI state (loading, error states)
- Call Tauri backend commands for plugin operations
- Delegate plugin loading to `PluginLoader`
- Provide event-based state synchronization for React components
- Cache plugin data for UI performance (5-minute cache)

**Key Features:**
- 301 lines of UI-focused state management
- Event listener system for React integration
- Tauri command delegation (install, uninstall, enable, disable)
- Browser mode fallback for development

**When to Use:**
- Building plugin UI components
- Displaying plugin lists in preferences
- Showing plugin installation progress
- Managing plugin panel display

**Key Files:**
- `src/core/plugins/PluginStateAdapter.js` - UI state manager
- `src/hooks/usePlugins.jsx` - React hook integration

**Important:** This is NOT a general plugin manager. It's a specialized adapter for the React UI layer.

---

### 3. Editor Plugin API (`src/plugins/api/EditorAPI.js`)

**Purpose:** TipTap editor extension integration system

**Responsibilities:**
- Register custom TipTap nodes, marks, and extensions
- Manage slash commands, input rules, keyboard shortcuts
- Handle toolbar items, node views, custom rendering
- Provide hot-reloading for editor extensions
- Security validation for editor modifications
- Performance monitoring for editor plugins

**Key Features:**
- 1,309 lines of TipTap-specific integration
- Plugin contribution tracking for cleanup
- Hot-reload validation and error handling
- Security integration via `ErrorHandler`

**When to Use:**
- Creating custom editor extensions (Math, WikiLinks, etc.)
- Adding new slash commands
- Implementing custom node rendering
- Building toolbar integrations

**Key Files:**
- `src/plugins/api/EditorAPI.js` - Editor extension API
- `src/editor/components/Editor.jsx` - Editor integration
- `src/editor/lib/slash-command.jsx` - Slash command system

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────┐
│         Application Layer (App.jsx)             │
└───────────┬─────────────────────┬───────────────┘
            │                     │
            │                     │
┌───────────▼──────────┐  ┌───────▼──────────────────┐
│ Core Plugin Manager  │  │  UI State Adapter        │
│ (PluginManager.js)   │  │  (PluginStateAdapter.js) │
│                      │  │                          │
│ • Lifecycle          │  │ • React state sync       │
│ • Dependencies       │  │ • UI display logic       │
│ • Security           │  │ • Event system           │
│ • API provisioning   │  │ • Cache management       │
└───────────┬──────────┘  └───────┬──────────────────┘
            │                     │
            │                     │
    ┌───────▼─────────┐   ┌───────▼──────────┐
    │ PluginLoader    │   │ usePlugins Hook  │
    │ (Load/Activate) │   │ (React Context)  │
    └───────┬─────────┘   └──────────────────┘
            │
            │
    ┌───────▼──────────────────────────────┐
    │      Plugin API Layer                │
    │  (LokusPluginAPI, EditorAPI, etc.)   │
    └───────┬──────────────────────────────┘
            │
            │
    ┌───────▼──────────────────────────────┐
    │       Plugin Sandbox                 │
    │   (Isolated JavaScript Context)      │
    └───────┬──────────────────────────────┘
            │
            │
    ┌───────▼──────────────────────────────┐
    │         Loaded Plugins               │
    │  (Math, WikiLinks, Tasks, etc.)      │
    └──────────────────────────────────────┘
```

## Communication Flow

### Plugin Installation Flow

1. **User Action** → Click "Install Plugin" in UI
2. **UI State Adapter** → Calls `installPlugin(pluginId, data)`
3. **Tauri Backend** → `invoke('install_plugin', { path })`
4. **Core Plugin Manager** → Validates manifest, checks dependencies
5. **Plugin Loader** → Loads plugin code into sandbox
6. **Plugin Security Manager** → Applies security policies
7. **UI State Adapter** → Reloads plugin list (force refresh)
8. **React UI** → Updates to show installed plugin

### Plugin Activation Flow

1. **Core Plugin Manager** → Detects activation event (e.g., `onStartupFinished`)
2. **Plugin Loader** → Loads plugin into sandbox
3. **Plugin Sandbox** → Creates isolated JavaScript context
4. **Plugin API** → Provides APIs based on permissions
5. **Plugin Code** → Calls `activate()` lifecycle method
6. **Editor API** (if editor plugin) → Registers TipTap extensions
7. **Plugin State** → Marked as active, available to app

### Editor Extension Registration Flow

1. **Plugin Code** → Calls `api.editor.registerExtension(config)`
2. **Editor API** → Validates extension configuration
3. **Security Check** → Verifies `editor:write` permission
4. **TipTap Editor** → Registers node/mark/extension
5. **Hot Reload** (dev mode) → Watches for changes and re-registers
6. **Cleanup** → Tracks registration for proper disposal

---

## Plugin Manifest Structure

### Manifest v2 (Current Standard)

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": "Author Name",
  "license": "MIT",

  "engines": {
    "lokus": "^1.0.0"
  },

  "main": "index.js",

  "permissions": [
    "editor:read",
    "editor:write",
    "ui:notifications",
    "fs:read"
  ],

  "capabilities": {
    "editor": true,
    "commands": true,
    "ui": true
  },

  "contributes": {
    "commands": [
      {
        "id": "myPlugin.doSomething",
        "title": "Do Something",
        "category": "My Plugin"
      }
    ],
    "menus": {
      "commandPalette": [
        {
          "command": "myPlugin.doSomething",
          "when": "editorHasFocus"
        }
      ]
    },
    "keybindings": [
      {
        "key": "ctrl+shift+p",
        "command": "myPlugin.doSomething",
        "when": "editorHasFocus"
      }
    ]
  },

  "activationEvents": [
    "onStartupFinished",
    "onCommand:myPlugin.doSomething"
  ],

  "dependencies": {},
  "devDependencies": {}
}
```

---

## Extension Points

### Available Extension Points

1. **Editor Extensions** - TipTap nodes, marks, extensions
2. **Commands** - Command palette entries
3. **Menus** - Context menus, editor menus, menubar items
4. **Keybindings** - Keyboard shortcuts
5. **Panels** - Sidebar panels, bottom panels
6. **Views** - Custom views and webviews
7. **Themes** - Color themes and icon themes
8. **Languages** - Syntax highlighting, formatters
9. **Status Bar** - Status bar items
10. **Slash Commands** - Editor slash commands
11. **Configuration** - Plugin settings
12. **Storage** - Persistent storage APIs

### Coming Soon

- File System Providers
- Import/Export Handlers
- Search Providers
- Authentication Providers
- Debug Adapters
- Webview API

---

## Best Practices

### For Plugin Developers

1. **Use the Right System:**
   - Editor features → Use `EditorAPI`
   - UI components → Use `UIAPI` from core manager
   - Commands → Use `CommandAPI` from core manager

2. **Follow Lifecycle:**
   - Implement `activate()` and `deactivate()` methods
   - Clean up resources in `deactivate()`
   - Return disposables for cleanup

3. **Declare Permissions:**
   - Request only necessary permissions
   - Document why each permission is needed
   - Use fine-grained permissions when possible

4. **Handle Errors:**
   - Wrap API calls in try-catch
   - Provide helpful error messages
   - Don't crash the app

5. **Test in Isolation:**
   - Test with minimum permissions
   - Test hot reload functionality
   - Test activation events

### For Core Developers

1. **Adding New APIs:**
   - Add to `LokusPluginAPI` or specialized API class
   - Define required permissions
   - Document in JSDoc
   - Add TypeScript types to SDK

2. **Modifying Plugin Manager:**
   - Maintain backward compatibility
   - Update manifest schema version if needed
   - Test with existing plugins

3. **UI Integration:**
   - Use `PluginStateAdapter` for UI state
   - Don't bypass the adapter
   - Use event system for updates

---

## Security Model

### Permission System

- **Declared Permissions:** Plugins declare permissions in manifest
- **Runtime Checking:** All API calls check permissions
- **User Consent:** Users review permissions before installation
- **Sandboxing:** Plugins run in isolated JavaScript context
- **Resource Limits:** CPU, memory, network quotas enforced

### Threat Mitigation

1. **Code Injection:** Sandboxed execution with limited globals
2. **Data Exfiltration:** Network permissions required
3. **Filesystem Access:** Scoped to workspace by default
4. **Privilege Escalation:** Permission checks at API boundary
5. **Malicious Code:** Plugin review process (future marketplace)

---

## Migration Guide

### From Old API to New API

If you're updating plugins that use the old plugin system:

1. **Update Imports:**
   ```javascript
   // Old
   import { uiAPI } from '../api/UIAPI.js'

   // New
   import { BasePlugin } from '@lokus/plugin-sdk'
   ```

2. **Use Base Class:**
   ```javascript
   export default class MyPlugin extends BasePlugin {
     async activate() {
       // Use this.api instead of direct imports
       this.api.ui.showNotification('Activated!')
     }
   }
   ```

3. **Update Manifest:**
   - Migrate from v1 to v2 format
   - Add `engines.lokus` field
   - Declare permissions explicitly

---

## Troubleshooting

### Plugin Not Loading

1. Check manifest validation errors in console
2. Verify all dependencies are available
3. Check activation events are correct
4. Ensure permissions are declared

### Permission Denied Errors

1. Add required permission to manifest
2. Reinstall plugin to prompt for permission
3. Check permission scope (workspace vs global)

### Hot Reload Not Working

1. Verify dev mode is enabled
2. Check file watcher is running
3. Ensure plugin is properly registered
4. Check for syntax errors in plugin code

### Editor Extension Not Appearing

1. Verify `editor:write` permission
2. Check extension registration in `EditorAPI`
3. Ensure TipTap extension is valid
4. Check for conflicts with other extensions

---

## References

- Main Plugin Manager: `src/plugins/PluginManager.js`
- UI State Adapter: `src/core/plugins/PluginStateAdapter.js`
- Editor API: `src/plugins/api/EditorAPI.js`
- Plugin Loader: `src/plugins/core/PluginLoader.js`
- Plugin Security: `src/plugins/security/PluginSecurityManager.js`
- Manifest Schema: `src/plugins/schemas/manifest-v2.schema.json`
- Plugin SDK: `packages/plugin-sdk/`
- Plugin CLI: `packages/lokus-plugin-cli/`

---

*Last Updated: [Current Date]*
*Version: 1.0*
