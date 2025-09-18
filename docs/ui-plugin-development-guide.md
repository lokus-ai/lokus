# UI Plugin Development Guide for Lokus

## Overview

Lokus provides a comprehensive UI extension system that allows plugins to seamlessly integrate custom panels, toolbars, context menus, and other UI components into the application. This guide covers everything you need to know to create powerful UI extensions.

## Table of Contents

1. [Quick Start](#quick-start)
2. [UI API Reference](#ui-api-reference)
3. [Panel System](#panel-system)
4. [Toolbar System](#toolbar-system)
5. [Context Menus](#context-menus)
6. [Status Bar Integration](#status-bar-integration)
7. [Command Palette](#command-palette)
8. [Theme Integration](#theme-integration)
9. [Best Practices](#best-practices)
10. [Example Plugins](#example-plugins)

## Quick Start

### Basic Plugin Structure

```javascript
import { uiAPI, PANEL_POSITIONS, PANEL_TYPES } from '../api/UIAPI.js';

export const MyPlugin = {
  id: 'my-plugin',
  name: 'My Awesome Plugin',
  version: '1.0.0',
  description: 'A plugin that does awesome things',
  author: 'Your Name',

  activate() {
    console.log('Activating My Plugin...');
    
    // Register UI components here
    this.registerComponents();
    
    console.log('My Plugin activated successfully');
  },

  deactivate() {
    console.log('Deactivating My Plugin...');
    
    // Cleanup - unregister all components
    uiAPI.unregisterPlugin('my-plugin');
    
    console.log('My Plugin deactivated successfully');
  },

  registerComponents() {
    // Register panels, toolbars, etc.
  }
};
```

### Simple Panel Example

```javascript
import React from 'react';

const MyPanel = ({ panel }) => {
  return (
    <div className="p-4">
      <h2 className="text-lg font-medium text-app-text mb-4">My Panel</h2>
      <p className="text-sm text-app-muted">This is my custom panel content!</p>
    </div>
  );
};

// In your plugin's registerComponents method:
uiAPI.registerPanel('my-plugin', {
  id: 'my-panel',
  title: 'My Panel',
  type: PANEL_TYPES.REACT,
  position: PANEL_POSITIONS.SIDEBAR_LEFT,
  component: MyPanel,
  icon: <MyIcon className="w-4 h-4" />,
  resizable: true,
  closable: true,
  visible: false
});
```

## UI API Reference

### Core Classes

#### `UIAPI`
The main class for managing UI extensions.

```javascript
import { uiAPI } from '../api/UIAPI.js';

// Register components
uiAPI.registerPanel(pluginId, panelDefinition);
uiAPI.registerToolbar(pluginId, toolbarDefinition);
uiAPI.registerContextMenu(pluginId, menuDefinition);
uiAPI.registerStatusBarItem(pluginId, itemDefinition);

// Manage panels
uiAPI.showPanel(panelId);
uiAPI.hidePanel(panelId);
uiAPI.togglePanel(panelId);
uiAPI.activatePanel(panelId);
uiAPI.resizePanel(panelId, size);
uiAPI.movePanel(panelId, newPosition, coordinates);

// Get components
uiAPI.getPanel(panelId);
uiAPI.getPanelsForPosition(position);
uiAPI.getToolbarsForLocation(location);

// Cleanup
uiAPI.unregisterPlugin(pluginId);
```

#### Constants

```javascript
// Panel positions
PANEL_POSITIONS = {
  SIDEBAR_LEFT: 'sidebar-left',
  SIDEBAR_RIGHT: 'sidebar-right',
  BOTTOM: 'bottom',
  FLOATING: 'floating',
  MODAL: 'modal',
  EDITOR_OVERLAY: 'editor-overlay'
};

// Panel types
PANEL_TYPES = {
  WEBVIEW: 'webview',
  REACT: 'react',
  IFRAME: 'iframe',
  CUSTOM: 'custom'
};
```

## Panel System

### Panel Definition

```javascript
const panelDefinition = {
  id: 'unique-panel-id',               // Required: Unique identifier
  title: 'Panel Title',               // Required: Display title
  type: PANEL_TYPES.REACT,             // Panel type
  position: PANEL_POSITIONS.SIDEBAR_LEFT, // Panel position
  component: MyComponent,              // React component (for REACT type)
  icon: <Icon className="w-4 h-4" />, // Panel icon
  initialSize: { width: 300, height: 400 }, // Initial dimensions
  minSize: { width: 200, height: 200 },     // Minimum dimensions
  maxSize: { width: 800, height: 600 },     // Maximum dimensions
  resizable: true,                     // Can be resized
  closable: true,                      // Can be closed
  visible: false,                      // Initially visible
  order: 100,                          // Display order
  when: 'condition',                   // Conditional visibility
  settings: {},                        // Panel-specific settings
  persistence: {                       // What to persist
    savePosition: true,
    saveSize: true,
    saveVisibility: true
  }
};
```

### Panel Component Props

Your React components receive these props:

```javascript
const MyPanel = ({ panel, ...otherProps }) => {
  // panel.id - Panel ID
  // panel.title - Panel title
  // panel.settings - Panel settings
  // panel.isActive - Is panel active
  // panel.visible - Is panel visible
  // panel.currentSize - Current size
  
  return (
    <div className="h-full flex flex-col">
      {/* Your panel content */}
    </div>
  );
};
```

### Panel Positions

#### Sidebar Left/Right
- Docked to the left or right side of the workspace
- Automatically stacked if multiple panels
- Resizable horizontally

#### Bottom Panel
- Docked to the bottom of the workspace
- Resizable vertically
- Good for status information, logs, terminals

#### Floating Panels
- Free-floating windows
- Can be moved anywhere
- Resizable in both dimensions
- Support for multiple floating panels

#### Modal Panels
- Overlay the entire workspace
- Block interaction with main content
- Good for settings, dialogs, full-screen views

#### Editor Overlay
- Positioned over the editor
- Good for in-context tools, previews, tooltips

### Panel Lifecycle Events

```javascript
// Listen to panel events
panel.events.on('visibility-changed', ({ visible }) => {
  console.log('Panel visibility changed:', visible);
});

panel.events.on('resized', (size) => {
  console.log('Panel resized:', size);
});

panel.events.on('activated', () => {
  console.log('Panel activated');
});

panel.events.on('settings-changed', (settings) => {
  console.log('Panel settings changed:', settings);
});
```

## Toolbar System

### Toolbar Definition

```javascript
const toolbarDefinition = {
  id: 'my-toolbar',
  title: 'My Toolbar',
  location: 'main',           // 'main', 'editor', 'floating'
  items: [],                  // Toolbar items (or use component)
  component: MyToolbarComponent, // Custom React component
  order: 100,                 // Display order
  visible: true,              // Initially visible
  when: 'condition',          // Conditional visibility
  orientation: 'horizontal'   // 'horizontal', 'vertical'
};
```

### Toolbar Component Example

```javascript
const MyToolbar = () => {
  return (
    <div className="flex items-center gap-2 px-2 py-1 bg-app-panel border-b border-app-border">
      <button className="toolbar-button" title="Save">
        <Save className="w-4 h-4" />
      </button>
      <div className="w-px h-4 bg-app-border" />
      <button className="toolbar-button" title="Copy">
        <Copy className="w-4 h-4" />
      </button>
      <div className="flex-1" />
      <input
        type="text"
        placeholder="Search..."
        className="px-2 py-1 text-xs bg-app-bg border border-app-border rounded"
      />
    </div>
  );
};
```

### Toolbar Locations

- **Main**: Top-level application toolbar
- **Editor**: Editor-specific toolbar
- **Floating**: Floating toolbar that can be moved

## Context Menus

### Context Menu Definition

```javascript
const contextMenuDefinition = {
  id: 'my-context-menu',
  target: '.file-item',        // CSS selector or function
  items: [
    {
      id: 'action1',
      label: 'My Action',
      icon: <Icon className="w-4 h-4" />,
      action: (target) => {
        // Handle action
      },
      when: 'condition'          // Optional condition
    }
  ],
  order: 100
};
```

### Dynamic Context Menus

```javascript
const contextMenuDefinition = {
  id: 'dynamic-menu',
  target: (element) => {
    // Return true if this menu applies to the element
    return element.classList.contains('my-element');
  },
  items: (target) => {
    // Return dynamic items based on target
    return [
      {
        id: 'dynamic-action',
        label: `Action for ${target.textContent}`,
        action: () => { /* ... */ }
      }
    ];
  }
};
```

## Status Bar Integration

### Status Bar Item Definition

```javascript
const statusBarItemDefinition = {
  id: 'my-status',
  text: 'Ready',
  tooltip: 'Plugin status',
  command: 'my-plugin.toggle',    // Command to run on click
  icon: <Icon className="w-4 h-4" />,
  alignment: 'left',              // 'left', 'center', 'right'
  priority: 100,                  // Display order
  when: 'condition',              // Conditional visibility
  style: { color: 'green' }       // Custom styles
};
```

### Dynamic Status Bar Items

```javascript
const statusItem = uiAPI.registerStatusBarItem('my-plugin', statusBarItemDefinition);

// Update text dynamically
statusItem.updateText('Updated status');

// Update tooltip
statusItem.updateTooltip('New tooltip');

// Update styles
statusItem.updateStyle({ color: 'red' });
```

## Command Palette

### Command Registration

```javascript
const commandDefinition = {
  id: 'my-command',
  title: 'My Command',
  description: 'Does something awesome',
  category: 'My Plugin',
  keywords: ['keyword1', 'keyword2'],
  handler: () => {
    // Command implementation
  },
  when: 'condition'               // Optional condition
};

uiAPI.registerCommandPaletteItem('my-plugin', commandDefinition);
```

### Search Integration

The command palette automatically searches through:
- Command titles
- Command descriptions
- Keywords

Commands are ranked by relevance and usage frequency.

## Theme Integration

### Using CSS Custom Properties

Lokus uses CSS custom properties for theming. Always use these in your components:

```css
.my-component {
  background-color: rgb(var(--bg));
  color: rgb(var(--text));
  border: 1px solid rgb(var(--border));
}

.my-component:hover {
  background-color: rgb(var(--panel-secondary));
}

.my-component.active {
  background-color: rgb(var(--accent) / 0.2);
  color: rgb(var(--accent));
}
```

### Available CSS Variables

```css
/* Core colors */
--bg              /* Main background */
--text            /* Primary text */
--panel           /* Panel background */
--border          /* Border color */
--muted           /* Muted text */
--accent          /* Accent color */
--accent-fg       /* Accent foreground */

/* Semantic colors */
--danger          /* Error/danger */
--success         /* Success */
--warning         /* Warning */
--info            /* Information */

/* Extended palette */
--panel-secondary /* Secondary panel bg */
--text-secondary  /* Secondary text */
--border-hover    /* Hover border */
--accent-hover    /* Hover accent */
```

### Responsive Design

Use Tailwind CSS classes for responsive design:

```javascript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Your content */}
</div>
```

## Best Practices

### Performance

1. **Lazy Loading**: Load panel content only when needed
2. **Virtualization**: Use virtualization for large lists
3. **Debouncing**: Debounce search and filter operations
4. **Memoization**: Use React.memo for expensive components

```javascript
const MyPanel = React.memo(({ panel }) => {
  const [data, setData] = useState([]);
  
  // Lazy load data when panel becomes visible
  useEffect(() => {
    if (panel.visible && data.length === 0) {
      loadData();
    }
  }, [panel.visible]);
  
  return (
    <div>
      {/* Panel content */}
    </div>
  );
});
```

### Accessibility

1. **Keyboard Navigation**: Support keyboard navigation
2. **ARIA Labels**: Use proper ARIA labels
3. **Focus Management**: Manage focus properly
4. **Color Contrast**: Ensure good color contrast

```javascript
<button
  className="toolbar-button"
  aria-label="Save document"
  onKeyDown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      handleSave();
    }
  }}
>
  <Save className="w-4 h-4" />
</button>
```

### State Management

1. **Local State**: Use React state for component-specific data
2. **Panel Settings**: Use panel.settings for persistent settings
3. **Global State**: Use localStorage or external state management

```javascript
const MyPanel = ({ panel }) => {
  // Get setting with default value
  const showDetails = panel.getSetting('showDetails', true);
  
  const toggleDetails = () => {
    panel.updateSettings({ showDetails: !showDetails });
  };
  
  return (
    <div>
      <button onClick={toggleDetails}>
        {showDetails ? 'Hide' : 'Show'} Details
      </button>
    </div>
  );
};
```

### Error Handling

1. **Graceful Degradation**: Handle errors gracefully
2. **User Feedback**: Provide clear error messages
3. **Logging**: Log errors for debugging

```javascript
const MyPanel = ({ panel }) => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchData();
      setData(data);
    } catch (err) {
      setError('Failed to load data');
      console.error('Data loading error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (error) {
    return (
      <div className="p-4 text-center text-app-danger">
        <p>{error}</p>
        <button onClick={loadData} className="mt-2 toolbar-button">
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div>
      {/* Normal content */}
    </div>
  );
};
```

## Example Plugins

### File Explorer Plugin
**Location**: `/src/plugins/examples/FileExplorerPlugin.js`

Features:
- Enhanced file tree with bookmarks
- Recent files tracking
- Advanced search
- File operations

### Calendar Timeline Plugin
**Location**: `/src/plugins/examples/CalendarTimelinePlugin.js`

Features:
- Calendar view for notes and events
- Timeline view with filtering
- Date-based navigation
- Event creation and editing

### Task Management Plugin
**Location**: `/src/plugins/examples/TaskManagementPlugin.js`

Features:
- Task lists with priorities
- Due date tracking
- Project organization
- Progress analytics

### Custom Toolbar Plugin
**Location**: `/src/plugins/examples/CustomToolbarPlugin.js`

Features:
- Quick action toolbar
- Formatting toolbar
- Theme switcher
- Status toolbar

## Testing Your Plugins

### Development Workflow

1. **Create Your Plugin**: Follow the plugin structure
2. **Register Components**: Use the UI API to register components
3. **Test in Browser**: Use browser dev tools to debug
4. **Handle Edge Cases**: Test error conditions
5. **Performance Testing**: Test with large datasets

### Debugging Tips

1. **Console Logging**: Use console.log for debugging
2. **React DevTools**: Use React DevTools for component debugging
3. **Event Monitoring**: Monitor UI API events
4. **State Inspection**: Inspect panel and component state

```javascript
// Debug panel state
console.log('Panel state:', panel.serialize());

// Monitor UI API events
uiAPI.on('panel-activated', (event) => {
  console.log('Panel activated:', event);
});
```

## Conclusion

The Lokus UI extension system provides powerful capabilities for creating rich, integrated user interfaces. By following the patterns and best practices outlined in this guide, you can create plugins that feel native to the Lokus experience while providing unique and valuable functionality.

For more examples and inspiration, check out the included example plugins and explore the Lokus source code. Happy plugin development!

---

*Last Updated: September 2025*
*Lokus UI Plugin Development Guide v1.0*