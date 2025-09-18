# Complete Plugin Development Guide for Lokus

This comprehensive guide covers everything you need to know about developing plugins for Lokus, from basic concepts to advanced techniques.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Plugin Architecture](#plugin-architecture)
3. [Template System](#template-system)
4. [Editor Extensions](#editor-extensions)
5. [UI Components](#ui-components)
6. [Data Providers](#data-providers)
7. [Theme Development](#theme-development)
8. [Testing & Debugging](#testing--debugging)
9. [Performance Optimization](#performance-optimization)
10. [Security Best Practices](#security-best-practices)
11. [Publishing & Distribution](#publishing--distribution)

## Getting Started

### Prerequisites

- **Node.js** 18+ with npm/yarn
- **TypeScript** knowledge (recommended)
- **React** familiarity for UI components
- **Lokus** 1.0+ installed

### Environment Setup

```bash
# Install Lokus CLI
npm install -g @lokus/cli

# Create development workspace
lokus workspace create my-plugin-workspace
cd my-plugin-workspace

# Initialize plugin project
lokus plugin init my-awesome-plugin
```

### Project Structure

```
my-awesome-plugin/
├── plugin.json              # Plugin manifest
├── src/
│   ├── index.ts             # Main entry point
│   ├── components/          # React components
│   ├── services/            # Business logic
│   ├── types/               # TypeScript definitions
│   └── styles/              # CSS/styling
├── test/                    # Test files
├── docs/                    # Documentation
├── assets/                  # Static assets
├── package.json
├── tsconfig.json
├── vite.config.js
└── README.md
```

## Plugin Architecture

### Core Concepts

#### 1. Plugin Lifecycle

```typescript
export class MyPlugin extends Plugin {
  async activate(): Promise<void> {
    // Plugin initialization
    await this.initializeServices()
    this.registerExtensions()
    this.setupEventListeners()
  }

  async deactivate(): Promise<void> {
    // Cleanup resources
    this.removeEventListeners()
    await this.cleanup()
  }
}
```

#### 2. Plugin API Access

```typescript
export class MyPlugin extends Plugin {
  activate() {
    // Access editor API
    const { editor } = this.api
    
    // Access UI API
    const { ui } = this.api
    
    // Access workspace API
    const { workspace } = this.api
    
    // Access theme API
    const { theme } = this.api
  }
}
```

#### 3. Event System

```typescript
// Listen to events
this.api.editor.on('document-changed', (doc) => {
  this.handleDocumentChange(doc)
})

// Emit custom events
this.emit('my-plugin:data-updated', data)

// Listen to custom events
this.api.plugins.on('other-plugin:event', handler)
```

### Plugin Manifest

```json
{
  "manifestVersion": "2.0",
  "id": "my-awesome-plugin",
  "name": "My Awesome Plugin",
  "version": "1.0.0",
  "description": "An amazing plugin that does awesome things",
  "author": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "main": "dist/index.js",
  "permissions": [
    "editor:extensions",
    "ui:panels",
    "storage:local"
  ],
  "activationEvents": [
    "onLanguage:markdown",
    "onCommand:my-plugin.activate"
  ],
  "contributes": {
    "commands": [...],
    "menus": {...},
    "configuration": {...}
  }
}
```

## Template System

### Using Templates

#### Quick Start with Templates

```bash
# List available templates
lokus template list

# Create from template
lokus template create custom-node MyDiagramNode

# With custom options
lokus template create custom-node MyDiagramNode \
  --has-content=true \
  --is-inline=false \
  --typescript=true
```

#### Template Categories

| Template | Use Case | Complexity |
|----------|----------|------------|
| `custom-node` | Editor nodes | Intermediate |
| `custom-mark` | Text formatting | Beginner |
| `sidebar-panel` | UI panels | Intermediate |
| `data-provider` | Data services | Advanced |
| `api-connector` | External APIs | Advanced |
| `theme-template` | Custom themes | Intermediate |

### Creating Custom Templates

```typescript
// template.config.ts
export const templateConfig = {
  id: 'my-template',
  name: 'My Custom Template',
  description: 'Template for creating awesome plugins',
  category: 'custom',
  complexity: 'intermediate',
  
  customization: {
    componentName: {
      type: 'string',
      required: true,
      description: 'Name of the component'
    },
    hasState: {
      type: 'boolean',
      default: true,
      description: 'Include state management'
    }
  },
  
  files: {
    'src/{{componentName}}.tsx': componentTemplate,
    'test/{{componentName}}.test.ts': testTemplate,
    'docs/{{componentName}}.md': docsTemplate
  }
}
```

## Editor Extensions

### Custom Nodes

#### Basic Node Structure

```typescript
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'

export const MyCustomNode = Node.create({
  name: 'myCustomNode',
  
  group: 'block',
  atom: true,
  
  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: element => element.getAttribute('data-content'),
        renderHTML: attributes => ({ 'data-content': attributes.content })
      }
    }
  },
  
  parseHTML() {
    return [{ tag: 'div[data-type="my-custom-node"]' }]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, {
      'data-type': 'my-custom-node'
    }), 0]
  },
  
  addNodeView() {
    return ReactNodeViewRenderer(MyCustomNodeView)
  },
  
  addCommands() {
    return {
      insertMyCustomNode: (attributes) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes
        })
      }
    }
  }
})
```

#### React Node View

```typescript
import React, { useState } from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'

export const MyCustomNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected
}) => {
  const [isEditing, setIsEditing] = useState(false)
  
  return (
    <NodeViewWrapper className={`my-custom-node ${selected ? 'selected' : ''}`}>
      <div className="node-toolbar">
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Save' : 'Edit'}
        </button>
        <button onClick={deleteNode}>Delete</button>
      </div>
      
      {isEditing ? (
        <div className="node-editor">
          <textarea
            value={node.attrs.content}
            onChange={(e) => updateAttributes({ content: e.target.value })}
          />
        </div>
      ) : (
        <div className="node-display">
          <NodeViewContent />
        </div>
      )}
    </NodeViewWrapper>
  )
}
```

### Custom Marks

```typescript
import { Mark, mergeAttributes } from '@tiptap/core'

export const HighlightMark = Mark.create({
  name: 'highlight',
  
  addOptions() {
    return {
      multicolor: true,
      HTMLAttributes: {}
    }
  },
  
  addAttributes() {
    return {
      color: {
        default: 'yellow',
        parseHTML: element => element.style.backgroundColor,
        renderHTML: attributes => ({
          style: `background-color: ${attributes.color}`
        })
      }
    }
  },
  
  parseHTML() {
    return [
      { tag: 'mark' },
      { style: 'background-color' }
    ]
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['mark', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
  
  addCommands() {
    return {
      setHighlight: (attributes) => ({ commands }) => {
        return commands.setMark(this.name, attributes)
      },
      toggleHighlight: (attributes) => ({ commands }) => {
        return commands.toggleMark(this.name, attributes)
      },
      unsetHighlight: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      }
    }
  }
})
```

### Slash Commands

```typescript
// Register slash command
this.api.editor.registerSlashCommand({
  name: 'diagram',
  description: 'Insert a diagram',
  icon: 'chart',
  keywords: ['diagram', 'flowchart', 'mermaid'],
  command: ({ editor, range }) => {
    editor.chain()
      .focus()
      .deleteRange(range)
      .insertMyCustomNode({ type: 'flowchart' })
      .run()
  }
})
```

### Input Rules

```typescript
import { InputRule } from '@tiptap/core'

// Auto-convert text patterns
const diagramInputRule = new InputRule({
  find: /^```diagram\s$/,
  handler: ({ state, range, match }) => {
    const { tr } = state
    tr.replaceWith(
      range.from,
      range.to,
      state.schema.nodes.myCustomNode.create({ type: 'flowchart' })
    )
    return tr
  }
})

// Register input rule
this.api.editor.registerInputRule(diagramInputRule)
```

## UI Components

### Sidebar Panels

```typescript
import React from 'react'
import { Panel } from '@lokus/ui-components'

export const MyPanel: React.FC = () => {
  const [isVisible, setIsVisible] = useState(true)
  const [data, setData] = useState([])
  
  return (
    <Panel
      title="My Panel"
      icon="panel"
      position="left"
      width={300}
      collapsible
      visible={isVisible}
      onVisibilityChange={setIsVisible}
    >
      <div className="panel-content">
        <div className="panel-header">
          <h3>Panel Title</h3>
          <button onClick={refreshData}>Refresh</button>
        </div>
        
        <div className="panel-body">
          {data.map(item => (
            <div key={item.id} className="panel-item">
              {item.name}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  )
}

// Register panel
this.api.ui.registerPanel({
  id: 'my-panel',
  title: 'My Panel',
  component: MyPanel,
  position: 'left',
  defaultVisible: false
})
```

### Modal Dialogs

```typescript
import React from 'react'
import { Dialog, DialogContent, DialogHeader } from '@lokus/ui-components'

export const MyDialog: React.FC<MyDialogProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({})
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="my-dialog">
        <DialogHeader>
          <h2>My Dialog</h2>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="form-fields">
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                name: e.target.value
              }))}
            />
          </div>
          
          <div className="dialog-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">
              Save
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

### Toolbar Components

```typescript
// Register toolbar button
this.api.ui.registerToolbarButton({
  id: 'my-button',
  title: 'My Action',
  icon: 'action',
  command: 'my-plugin.my-action',
  position: 'editor',
  group: 'custom'
})

// Register toolbar dropdown
this.api.ui.registerToolbarDropdown({
  id: 'my-dropdown',
  title: 'My Options',
  icon: 'dropdown',
  items: [
    {
      id: 'option1',
      title: 'Option 1',
      command: 'my-plugin.option1'
    },
    {
      id: 'option2',
      title: 'Option 2',
      command: 'my-plugin.option2'
    }
  ]
})
```

## Data Providers

### API Integration

```typescript
export class MyAPIProvider extends DataProvider {
  private baseUrl: string
  private apiKey: string
  private cache: Map<string, any>
  
  constructor(config: MyAPIConfig) {
    super()
    this.baseUrl = config.baseUrl
    this.apiKey = config.apiKey
    this.cache = new Map()
  }
  
  async fetchData(query: string): Promise<MyData[]> {
    const cacheKey = `query_${query}`
    
    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)
    }
    
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query })
      })
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }
      
      const data = await response.json()
      
      // Cache the result
      this.cache.set(cacheKey, data)
      
      return data
    } catch (error) {
      console.error('API request failed:', error)
      throw error
    }
  }
  
  async updateData(id: string, updates: Partial<MyData>): Promise<MyData> {
    const response = await fetch(`${this.baseUrl}/items/${id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    })
    
    if (!response.ok) {
      throw new Error(`Update failed: ${response.status}`)
    }
    
    const updatedData = await response.json()
    
    // Invalidate cache
    this.cache.clear()
    
    return updatedData
  }
}
```

### Local Storage Provider

```typescript
export class LocalStorageProvider extends DataProvider {
  private storageKey: string
  
  constructor(storageKey: string) {
    super()
    this.storageKey = storageKey
  }
  
  async getData(): Promise<any[]> {
    const stored = localStorage.getItem(this.storageKey)
    return stored ? JSON.parse(stored) : []
  }
  
  async setData(data: any[]): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(data))
    this.emit('data-changed', data)
  }
  
  async addItem(item: any): Promise<void> {
    const current = await this.getData()
    const updated = [...current, { ...item, id: generateId() }]
    await this.setData(updated)
  }
  
  async updateItem(id: string, updates: any): Promise<void> {
    const current = await this.getData()
    const updated = current.map(item => 
      item.id === id ? { ...item, ...updates } : item
    )
    await this.setData(updated)
  }
  
  async deleteItem(id: string): Promise<void> {
    const current = await this.getData()
    const updated = current.filter(item => item.id !== id)
    await this.setData(updated)
  }
}
```

## Theme Development

### Theme Structure

```typescript
export class MyTheme extends Theme {
  constructor() {
    super({
      id: 'my-theme',
      name: 'My Awesome Theme',
      description: 'A beautiful theme for Lokus',
      version: '1.0.0',
      author: 'Your Name',
      baseTheme: 'light' // or 'dark' or 'auto'
    })
  }
  
  getVariables(): Record<string, string> {
    return {
      // Color System
      '--primary-color': '#007acc',
      '--primary-color-hover': '#005a9e',
      '--secondary-color': '#6c757d',
      
      // Background Colors
      '--bg-primary': '#ffffff',
      '--bg-secondary': '#f8f9fa',
      '--bg-tertiary': '#e9ecef',
      
      // Text Colors
      '--text-primary': '#212529',
      '--text-secondary': '#6c757d',
      '--text-muted': '#adb5bd',
      
      // Border Colors
      '--border-color': '#dee2e6',
      '--border-hover': '#adb5bd',
      
      // Component Specific
      '--editor-bg': 'var(--bg-primary)',
      '--editor-text': 'var(--text-primary)',
      '--editor-selection': 'rgba(0, 123, 255, 0.25)',
      
      // Spacing
      '--spacing-xs': '0.25rem',
      '--spacing-sm': '0.5rem',
      '--spacing-md': '1rem',
      '--spacing-lg': '1.5rem',
      '--spacing-xl': '2rem',
      
      // Typography
      '--font-family-sans': 'system-ui, sans-serif',
      '--font-family-mono': 'SF Mono, Monaco, monospace',
      '--font-size-sm': '0.875rem',
      '--font-size-base': '1rem',
      '--font-size-lg': '1.125rem',
      
      // Shadows
      '--shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
      '--shadow-md': '0 4px 6px rgba(0, 0, 0, 0.1)',
      '--shadow-lg': '0 10px 15px rgba(0, 0, 0, 0.1)',
      
      // Transitions
      '--transition-fast': '150ms ease-in-out',
      '--transition-normal': '300ms ease-in-out'
    }
  }
  
  apply(): void {
    const variables = this.getVariables()
    const root = document.documentElement
    
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value)
    })
    
    root.setAttribute('data-theme', this.id)
    this.emit('applied')
  }
  
  remove(): void {
    const variables = this.getVariables()
    const root = document.documentElement
    
    Object.keys(variables).forEach(property => {
      root.style.removeProperty(property)
    })
    
    root.removeAttribute('data-theme')
    this.emit('removed')
  }
}
```

### CSS Architecture

```css
/* Theme CSS Structure */

/* Base Variables (inherited by all themes) */
:root {
  /* Layout */
  --header-height: 60px;
  --sidebar-width: 300px;
  --panel-min-width: 200px;
  
  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-modal: 1050;
  --z-tooltip: 1070;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}

/* Theme-specific variables */
:root[data-theme="my-theme"] {
  /* Color overrides */
  --primary-color: #007acc;
  /* ... other variables */
}

/* Component Styles */
.my-component {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  font-family: var(--font-family-sans);
  transition: all var(--transition-fast);
}

.my-component:hover {
  border-color: var(--border-hover);
  box-shadow: var(--shadow-sm);
}

/* Dark theme adaptations */
:root[data-theme="my-theme-dark"] {
  --bg-primary: #1e1e1e;
  --text-primary: #ffffff;
  /* ... dark theme variables */
}

/* High contrast mode */
@media (prefers-contrast: high) {
  :root[data-theme="my-theme"] {
    --border-color: #000000;
    --text-primary: #000000;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Testing & Debugging

### Unit Testing

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { createEditor } from '@tiptap/core'
import { MyCustomNode } from '../src/MyCustomNode'

describe('MyCustomNode', () => {
  let editor: Editor
  
  beforeEach(() => {
    editor = createEditor({
      extensions: [MyCustomNode]
    })
  })
  
  it('should be defined', () => {
    expect(MyCustomNode).toBeDefined()
  })
  
  it('should have correct name', () => {
    expect(MyCustomNode.name).toBe('myCustomNode')
  })
  
  it('should insert node with command', () => {
    editor.commands.insertMyCustomNode({ content: 'test' })
    
    expect(editor.getHTML()).toContain('data-type="my-custom-node"')
    expect(editor.isActive('myCustomNode')).toBe(true)
  })
  
  it('should update node attributes', () => {
    editor.commands.insertMyCustomNode({ content: 'initial' })
    editor.commands.updateAttributes('myCustomNode', { content: 'updated' })
    
    const node = editor.state.doc.firstChild
    expect(node?.attrs.content).toBe('updated')
  })
})
```

### Integration Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import { MyPanel } from '../src/components/MyPanel'

describe('MyPanel Integration', () => {
  it('should render panel with data', async () => {
    const mockData = [
      { id: '1', name: 'Item 1' },
      { id: '2', name: 'Item 2' }
    ]
    
    render(<MyPanel data={mockData} />)
    
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })
  
  it('should handle refresh action', async () => {
    const mockRefresh = vi.fn()
    
    render(<MyPanel onRefresh={mockRefresh} />)
    
    fireEvent.click(screen.getByText('Refresh'))
    
    expect(mockRefresh).toHaveBeenCalled()
  })
})
```

### E2E Testing

```typescript
import { test, expect } from '@playwright/test'

test.describe('Plugin E2E Tests', () => {
  test('should insert and edit custom node', async ({ page }) => {
    await page.goto('/editor')
    
    // Insert custom node via slash command
    await page.fill('[data-testid="editor"]', '/')
    await page.click('[data-testid="slash-command-my-node"]')
    
    // Check if node was inserted
    await expect(page.locator('[data-type="my-custom-node"]')).toBeVisible()
    
    // Edit node content
    await page.click('[data-type="my-custom-node"]')
    await page.fill('[data-testid="node-content-input"]', 'Test content')
    
    // Verify content was saved
    await expect(page.locator('[data-content="Test content"]')).toBeVisible()
  })
  
  test('should open and interact with panel', async ({ page }) => {
    await page.goto('/editor')
    
    // Open panel
    await page.click('[data-testid="open-my-panel"]')
    
    // Check if panel is visible
    await expect(page.locator('[data-testid="my-panel"]')).toBeVisible()
    
    // Interact with panel
    await page.click('[data-testid="panel-refresh-button"]')
    
    // Verify panel updated
    await expect(page.locator('[data-testid="panel-loading"]')).toBeVisible()
  })
})
```

### Debug Tools

```typescript
// Debug utility for development
export class PluginDebugger {
  private plugin: Plugin
  private logs: DebugLog[] = []
  
  constructor(plugin: Plugin) {
    this.plugin = plugin
    this.setupLogging()
  }
  
  log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const log: DebugLog = {
      timestamp: Date.now(),
      level,
      message,
      data,
      stack: new Error().stack
    }
    
    this.logs.push(log)
    
    if (process.env.NODE_ENV === 'development') {
      console[level](`[${this.plugin.id}] ${message}`, data)
    }
  }
  
  getLogs(level?: string): DebugLog[] {
    return level 
      ? this.logs.filter(log => log.level === level)
      : this.logs
  }
  
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }
  
  private setupLogging() {
    // Override console methods to capture logs
    const originalConsole = { ...console }
    
    console.log = (...args) => {
      this.log('info', args.join(' '))
      originalConsole.log(...args)
    }
    
    console.warn = (...args) => {
      this.log('warn', args.join(' '))
      originalConsole.warn(...args)
    }
    
    console.error = (...args) => {
      this.log('error', args.join(' '))
      originalConsole.error(...args)
    }
  }
}

// Usage in plugin
export class MyPlugin extends Plugin {
  private debugger: PluginDebugger
  
  activate() {
    if (process.env.NODE_ENV === 'development') {
      this.debugger = new PluginDebugger(this)
    }
    
    this.debugger?.log('info', 'Plugin activated', { version: this.version })
  }
}
```

## Performance Optimization

### Code Splitting

```typescript
// Lazy load heavy components
const MyHeavyComponent = React.lazy(() => import('./MyHeavyComponent'))

// Use with Suspense
function MyPanel() {
  return (
    <div>
      <Suspense fallback={<div>Loading...</div>}>
        <MyHeavyComponent />
      </Suspense>
    </div>
  )
}
```

### Memory Management

```typescript
export class MyPlugin extends Plugin {
  private subscriptions: Subscription[] = []
  private timeouts: NodeJS.Timeout[] = []
  private observers: Observer[] = []
  
  activate() {
    // Track subscriptions for cleanup
    this.subscriptions.push(
      this.api.editor.on('update', this.handleUpdate.bind(this))
    )
    
    // Track timeouts for cleanup
    const timeout = setTimeout(() => {
      this.doSomething()
    }, 1000)
    this.timeouts.push(timeout)
  }
  
  deactivate() {
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe())
    this.subscriptions = []
    
    // Clear timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout))
    this.timeouts = []
    
    // Disconnect observers
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
  }
}
```

### Efficient Rendering

```typescript
// Use React.memo for expensive components
export const MyExpensiveComponent = React.memo(({
  data,
  onUpdate
}: MyExpensiveComponentProps) => {
  const memoizedValue = useMemo(() => {
    return expensiveCalculation(data)
  }, [data])
  
  const handleUpdate = useCallback((newData) => {
    onUpdate(newData)
  }, [onUpdate])
  
  return (
    <div>
      {memoizedValue}
      <button onClick={() => handleUpdate(data)}>
        Update
      </button>
    </div>
  )
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data.id === nextProps.data.id
})
```

### Virtualization for Large Lists

```typescript
import { FixedSizeList as List } from 'react-window'

export const VirtualizedList: React.FC<{ items: any[] }> = ({ items }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <MyListItem item={items[index]} />
    </div>
  )
  
  return (
    <List
      height={400}
      itemCount={items.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

## Security Best Practices

### Input Sanitization

```typescript
import DOMPurify from 'dompurify'

export class SecurityUtils {
  static sanitizeHTML(html: string): string {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['class', 'id']
    })
  }
  
  static sanitizeText(text: string): string {
    return text
      .replace(/[<>]/g, '') // Remove angle brackets
      .trim()
  }
  
  static validateURL(url: string): boolean {
    try {
      const parsed = new URL(url)
      return ['http:', 'https:'].includes(parsed.protocol)
    } catch {
      return false
    }
  }
}
```

### Permission Checking

```typescript
export class MyPlugin extends Plugin {
  async performAction() {
    // Check permission before executing
    if (!this.hasPermission('storage:write')) {
      throw new Error('Insufficient permissions')
    }
    
    // Safe to proceed
    await this.writeToStorage()
  }
  
  private hasPermission(permission: string): boolean {
    return this.manifest.permissions.includes(permission)
  }
}
```

### Secure API Communication

```typescript
export class SecureAPIClient {
  private apiKey: string
  private baseUrl: string
  
  constructor(config: SecureAPIConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl
    
    // Validate API key format
    if (!this.isValidApiKey(this.apiKey)) {
      throw new Error('Invalid API key format')
    }
  }
  
  async request(endpoint: string, options: RequestOptions = {}) {
    const url = new URL(endpoint, this.baseUrl)
    
    // Validate URL
    if (!this.isAllowedUrl(url)) {
      throw new Error('URL not allowed')
    }
    
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
      ...options.headers
    }
    
    try {
      const response = await fetch(url.toString(), {
        ...options,
        headers
      })
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('API request error:', error)
      throw error
    }
  }
  
  private isValidApiKey(key: string): boolean {
    // Validate API key format (example)
    return /^[a-zA-Z0-9]{32}$/.test(key)
  }
  
  private isAllowedUrl(url: URL): boolean {
    // Only allow HTTPS
    if (url.protocol !== 'https:') {
      return false
    }
    
    // Check against allowlist
    const allowedDomains = ['api.example.com', 'secure-api.example.org']
    return allowedDomains.includes(url.hostname)
  }
}
```

## Publishing & Distribution

### Plugin Packaging

```bash
# Build plugin for production
npm run build

# Run tests before packaging
npm test

# Package plugin
lokus plugin package

# This creates:
# - my-plugin-1.0.0.lokus (plugin bundle)
# - my-plugin-1.0.0.tgz (npm package)
```

### Registry Publishing

```bash
# Login to Lokus registry
lokus registry login

# Publish plugin
lokus registry publish

# Update plugin
lokus registry update my-plugin@1.0.1
```

### Marketplace Submission

```json
{
  "marketplace": {
    "category": "productivity",
    "tags": ["editor", "diagrams", "visualization"],
    "screenshots": [
      "screenshots/main.png",
      "screenshots/settings.png"
    ],
    "demo": "https://demo.example.com",
    "documentation": "https://docs.example.com",
    "support": "https://support.example.com",
    "pricing": {
      "model": "free", // or "paid", "freemium"
      "price": 0
    }
  }
}
```

### Distribution Channels

1. **Official Marketplace**
   - Reviewed by Lokus team
   - Highest visibility
   - Quality guarantees

2. **GitHub Releases**
   - Direct distribution
   - Version control integration
   - Community feedback

3. **NPM Registry**
   - Developer-focused
   - Easy installation
   - Dependency management

4. **Private Distribution**
   - Enterprise deployments
   - Custom registries
   - Internal tools

## Conclusion

This comprehensive guide covers the essential aspects of Lokus plugin development. Key takeaways:

1. **Start with Templates** - Use the template system to bootstrap your development
2. **Follow Best Practices** - Security, performance, and accessibility are crucial
3. **Test Thoroughly** - Unit, integration, and E2E tests ensure quality
4. **Document Everything** - Good documentation helps users and contributors
5. **Optimize Performance** - Consider memory usage and rendering efficiency
6. **Plan for Distribution** - Choose the right channels for your audience

### Next Steps

1. Explore the [API Reference](./api-reference.md)
2. Check out [Example Plugins](../showcase/)
3. Join the [Developer Community](https://discord.gg/lokus-dev)
4. Contribute to [Open Source](https://github.com/lokus-dev/lokus)

### Resources

- [Plugin API Documentation](./api-reference.md)
- [Template Library](../core/)
- [Showcase Examples](../showcase/)
- [Testing Guide](./testing-guide.md)
- [Performance Guide](./performance-guide.md)
- [Security Guide](./security-guide.md)

---

**Happy Plugin Development! 🚀**