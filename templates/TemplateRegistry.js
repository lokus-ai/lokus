/**
 * Enhanced Template Registry for Lokus Plugin Development
 * 
 * Provides a comprehensive library of production-ready plugin templates
 * and examples that demonstrate the full capabilities of the Lokus plugin system.
 */

import { 
  TEMPLATE_TYPES, 
  TEMPLATE_CATEGORIES, 
  TEMPLATE_COMPLEXITY, 
  TEMPLATE_FEATURES 
} from '../src/plugins/templates/TemplateConfig.js'

/**
 * Extended template types for comprehensive coverage
 */
export const EXTENDED_TEMPLATE_TYPES = {
  ...TEMPLATE_TYPES,
  
  // Editor Extensions
  CUSTOM_NODE: 'custom-node',
  CUSTOM_MARK: 'custom-mark',
  SYNTAX_HIGHLIGHTER: 'syntax-highlighter',
  SLASH_COMMAND: 'slash-command',
  INPUT_RULE: 'input-rule',
  
  // UI Panels
  SIDEBAR_PANEL: 'sidebar-panel',
  MODAL_DIALOG: 'modal-dialog',
  TOOLBAR_BUTTON: 'toolbar-button',
  CONTEXT_MENU: 'context-menu',
  STATUS_BAR: 'status-bar',
  
  // Data Providers
  GRAPH_ALGORITHM: 'graph-algorithm',
  SEARCH_PROVIDER: 'search-provider',
  FILE_SYSTEM: 'file-system',
  DATABASE_CONNECTOR: 'database-connector',
  
  // Themes
  COLOR_SCHEME: 'color-scheme',
  LAYOUT_MODIFIER: 'layout-modifier',
  COMPONENT_STYLING: 'component-styling',
  
  // Integrations
  API_CONNECTOR: 'api-connector',
  WORKFLOW_AUTOMATION: 'workflow-automation',
  EXTERNAL_SYNC: 'external-sync',
  NOTIFICATION_SYSTEM: 'notification-system'
}

/**
 * Extended template categories
 */
export const EXTENDED_TEMPLATE_CATEGORIES = {
  ...TEMPLATE_CATEGORIES,
  EDITOR_EXTENSIONS: 'editor-extensions',
  UI_COMPONENTS: 'ui-components',
  DATA_PROCESSING: 'data-processing',
  VISUALIZATION: 'visualization',
  PRODUCTIVITY: 'productivity',
  DEVELOPER_TOOLS: 'developer-tools'
}

/**
 * Enhanced Template Registry with production-quality templates
 */
export class EnhancedTemplateRegistry {
  constructor() {
    this.templates = new Map()
    this.categories = new Map()
    this.showcaseExamples = new Map()
    this.documentation = new Map()
    
    this.initializeTemplates()
    this.initializeShowcaseExamples()
  }

  /**
   * Initialize core plugin templates
   */
  initializeTemplates() {
    // Editor Extensions Templates
    this.registerTemplate('custom-node-template', {
      id: 'custom-node-template',
      name: 'Custom Editor Node',
      description: 'Create custom TipTap editor nodes with full functionality',
      category: EXTENDED_TEMPLATE_CATEGORIES.EDITOR_EXTENSIONS,
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      features: [
        TEMPLATE_FEATURES.TYPESCRIPT,
        TEMPLATE_FEATURES.TESTING,
        TEMPLATE_FEATURES.DOCUMENTATION
      ],
      language: 'typescript',
      version: '1.0.0',
      author: {
        name: 'Lokus Development Team',
        email: 'dev@lokus.dev'
      },
      license: 'MIT',
      customization: {
        nodeName: {
          type: 'string',
          required: true,
          description: 'Name of the custom node',
          validation: { pattern: '^[A-Z][a-zA-Z0-9]*$' }
        },
        hasContent: {
          type: 'boolean',
          default: true,
          description: 'Whether the node can contain content'
        },
        isInline: {
          type: 'boolean',
          default: false,
          description: 'Whether the node is inline or block'
        },
        attributes: {
          type: 'array',
          default: [],
          description: 'List of node attributes'
        }
      },
      files: {
        'src/{{nodeName}}Node.ts': `
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { {{nodeName}}NodeView } from './{{nodeName}}NodeView'

export interface {{nodeName}}Options {
  HTMLAttributes: Record<string, any>
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    {{nodeName.toLowerCase()}}: {
      set{{nodeName}}: (attributes?: Record<string, any>) => ReturnType
    }
  }
}

export const {{nodeName}}Node = Node.create<{{nodeName}}Options>({
  name: '{{nodeName.toLowerCase()}}',
  
  addOptions() {
    return {
      HTMLAttributes: {},
    }
  },

  group: '{{#if isInline}}inline{{else}}block{{/if}}',
  
  {{#if hasContent}}
  content: 'text*',
  {{/if}}
  
  {{#if isInline}}
  inline: true,
  {{else}}
  block: true,
  {{/if}}

  addAttributes() {
    return {
      {{#each attributes}}
      {{name}}: {
        default: {{#if default}}'{{default}}'{{else}}null{{/if}},
        parseHTML: element => element.getAttribute('{{name}}'),
        renderHTML: attributes => {
          if (!attributes.{{name}}) return {}
          return { '{{name}}': attributes.{{name}} }
        },
      },
      {{/each}}
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="{{nodeName.toLowerCase()}}"]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
      'data-type': '{{nodeName.toLowerCase()}}'
    }), 0]
  },

  addNodeView() {
    return ReactNodeViewRenderer({{nodeName}}NodeView)
  },

  addCommands() {
    return {
      set{{nodeName}}: (attributes = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: attributes,
        })
      },
    }
  },
})
`,
        'src/{{nodeName}}NodeView.tsx': `
import React from 'react'
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { NodeViewProps } from '@tiptap/core'

export const {{nodeName}}NodeView: React.FC<NodeViewProps> = ({ 
  node, 
  updateAttributes, 
  deleteNode 
}) => {
  return (
    <NodeViewWrapper className="{{nodeName.toLowerCase()}}-node">
      <div className="{{nodeName.toLowerCase()}}-node__content">
        {{#if hasContent}}
        <NodeViewContent />
        {{else}}
        <div className="{{nodeName.toLowerCase()}}-node__placeholder">
          {{nodeName}} content goes here
        </div>
        {{/if}}
      </div>
      
      <div className="{{nodeName.toLowerCase()}}-node__controls">
        <button 
          onClick={() => deleteNode()}
          className="{{nodeName.toLowerCase()}}-node__delete"
        >
          Delete
        </button>
      </div>
    </NodeViewWrapper>
  )
}
`,
        'src/{{nodeName}}NodeView.css': `
.{{nodeName.toLowerCase()}}-node {
  border: 2px solid var(--editor-border-color);
  border-radius: 8px;
  padding: 16px;
  margin: 8px 0;
  position: relative;
  background: var(--editor-node-bg);
}

.{{nodeName.toLowerCase()}}-node__content {
  min-height: 40px;
}

.{{nodeName.toLowerCase()}}-node__placeholder {
  color: var(--editor-placeholder-color);
  font-style: italic;
}

.{{nodeName.toLowerCase()}}-node__controls {
  position: absolute;
  top: 8px;
  right: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.{{nodeName.toLowerCase()}}-node:hover .{{nodeName.toLowerCase()}}-node__controls {
  opacity: 1;
}

.{{nodeName.toLowerCase()}}-node__delete {
  background: var(--error-color);
  color: white;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
}
`,
        'test/{{nodeName}}Node.test.ts': `
import { describe, it, expect } from 'vitest'
import { createEditor } from '@tiptap/core'
import { {{nodeName}}Node } from '../src/{{nodeName}}Node'

describe('{{nodeName}}Node', () => {
  it('should be defined', () => {
    expect({{nodeName}}Node).toBeDefined()
  })

  it('should have correct name', () => {
    expect({{nodeName}}Node.name).toBe('{{nodeName.toLowerCase()}}')
  })

  it('should create editor with {{nodeName}}Node', () => {
    const editor = createEditor({
      extensions: [{{nodeName}}Node],
    })

    expect(editor.isActive('{{nodeName.toLowerCase()}}')).toBe(false)
  })

  it('should insert {{nodeName}} content', () => {
    const editor = createEditor({
      extensions: [{{nodeName}}Node],
    })

    editor.commands.set{{nodeName}}()
    
    const html = editor.getHTML()
    expect(html).toContain('data-type="{{nodeName.toLowerCase()}}"')
  })
})
`,
        'README.md': `# {{nodeName}} Node Extension

A custom TipTap editor node for {{nodeName}} functionality.

## Features

- {{#if hasContent}}Content editable{{/if}}
- {{#if isInline}}Inline display{{else}}Block display{{/if}}
- Custom attributes support
- React-based node view
- Full TypeScript support

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`typescript
import { {{nodeName}}Node } from './{{nodeName}}Node'

const editor = new Editor({
  extensions: [
    // ... other extensions
    {{nodeName}}Node,
  ],
})

// Insert {{nodeName}}
editor.commands.set{{nodeName}}()
\`\`\`

## Customization

The node supports the following attributes:

{{#each attributes}}
- **{{name}}**: {{description}} (default: {{default}})
{{/each}}

## Testing

\`\`\`bash
npm test
\`\`\`

## License

MIT
`
      },
      metadata: {
        tags: ['editor', 'node', 'tiptap', 'custom'],
        keywords: ['editor-extension', 'custom-node', 'tiptap'],
        icon: 'node',
        documentation: 'https://docs.lokus.dev/templates/custom-node'
      }
    })

    // UI Panel Template
    this.registerTemplate('sidebar-panel-template', {
      id: 'sidebar-panel-template',
      name: 'Sidebar Panel Component',
      description: 'Create beautiful, responsive sidebar panels with advanced functionality',
      category: EXTENDED_TEMPLATE_CATEGORIES.UI_COMPONENTS,
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      features: [
        TEMPLATE_FEATURES.PANEL_UI,
        TEMPLATE_FEATURES.STATE_MANAGEMENT,
        TEMPLATE_FEATURES.TYPESCRIPT,
        TEMPLATE_FEATURES.TESTING
      ],
      language: 'typescript',
      version: '1.0.0',
      customization: {
        panelName: {
          type: 'string',
          required: true,
          description: 'Name of the panel component'
        },
        position: {
          type: 'enum',
          required: true,
          default: 'left',
          validation: { options: ['left', 'right'] },
          description: 'Panel position'
        },
        collapsible: {
          type: 'boolean',
          default: true,
          description: 'Whether panel can be collapsed'
        },
        resizable: {
          type: 'boolean',
          default: true,
          description: 'Whether panel can be resized'
        }
      },
      files: {
        'src/{{panelName}}Panel.tsx': `
import React, { useState, useEffect } from 'react'
import { Panel } from '@lokus/ui-components'
import { usePluginState } from '@lokus/plugin-api'
import { {{panelName}}PanelContent } from './{{panelName}}PanelContent'
import './{{panelName}}Panel.css'

export interface {{panelName}}PanelProps {
  isVisible: boolean
  onToggleVisibility: (visible: boolean) => void
  width?: number
  onWidthChange?: (width: number) => void
}

export const {{panelName}}Panel: React.FC<{{panelName}}PanelProps> = ({
  isVisible,
  onToggleVisibility,
  width = 300,
  onWidthChange
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const { state, updateState } = usePluginState('{{panelName.toLowerCase()}}-panel')

  useEffect(() => {
    // Initialize panel state
    if (!state.initialized) {
      updateState({
        initialized: true,
        preferences: {
          width,
          collapsed: false
        }
      })
    }
  }, [state.initialized, updateState, width])

  const handleToggleCollapse = () => {
    const newCollapsed = !isCollapsed
    setIsCollapsed(newCollapsed)
    updateState({
      preferences: {
        ...state.preferences,
        collapsed: newCollapsed
      }
    })
  }

  const handleResize = (newWidth: number) => {
    onWidthChange?.(newWidth)
    updateState({
      preferences: {
        ...state.preferences,
        width: newWidth
      }
    })
  }

  if (!isVisible) return null

  return (
    <Panel
      className="{{panelName.toLowerCase()}}-panel"
      position="{{position}}"
      width={isCollapsed ? 50 : width}
      {{#if resizable}}
      resizable
      onResize={handleResize}
      {{/if}}
      {{#if collapsible}}
      collapsible
      collapsed={isCollapsed}
      onToggleCollapse={handleToggleCollapse}
      {{/if}}
    >
      <div className="{{panelName.toLowerCase()}}-panel__header">
        <h3 className="{{panelName.toLowerCase()}}-panel__title">
          {{panelName}}
        </h3>
        
        <div className="{{panelName.toLowerCase()}}-panel__actions">
          {{#if collapsible}}
          <button
            className="{{panelName.toLowerCase()}}-panel__collapse-btn"
            onClick={handleToggleCollapse}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? '→' : '←'}
          </button>
          {{/if}}
          
          <button
            className="{{panelName.toLowerCase()}}-panel__close-btn"
            onClick={() => onToggleVisibility(false)}
            title="Close panel"
          >
            ×
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="{{panelName.toLowerCase()}}-panel__content">
          <{{panelName}}PanelContent />
        </div>
      )}
    </Panel>
  )
}
`,
        'src/{{panelName}}PanelContent.tsx': `
import React from 'react'
import { usePluginAPI } from '@lokus/plugin-api'

export const {{panelName}}PanelContent: React.FC = () => {
  const { editor, workspace } = usePluginAPI()

  return (
    <div className="{{panelName.toLowerCase()}}-panel-content">
      <div className="{{panelName.toLowerCase()}}-panel-content__section">
        <h4>{{panelName}} Features</h4>
        <p>This is your custom {{panelName}} panel. Add your functionality here.</p>
      </div>

      <div className="{{panelName.toLowerCase()}}-panel-content__actions">
        <button className="btn btn-primary">
          Primary Action
        </button>
        <button className="btn btn-secondary">
          Secondary Action
        </button>
      </div>
    </div>
  )
}
`,
        'src/{{panelName}}Panel.css': `
.{{panelName.toLowerCase()}}-panel {
  background: var(--panel-bg);
  border-right: 1px solid var(--panel-border);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.{{panelName.toLowerCase()}}-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel-header-bg);
}

.{{panelName.toLowerCase()}}-panel__title {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--panel-title-color);
}

.{{panelName.toLowerCase()}}-panel__actions {
  display: flex;
  gap: 8px;
}

.{{panelName.toLowerCase()}}-panel__collapse-btn,
.{{panelName.toLowerCase()}}-panel__close-btn {
  background: none;
  border: none;
  color: var(--panel-action-color);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.{{panelName.toLowerCase()}}-panel__collapse-btn:hover,
.{{panelName.toLowerCase()}}-panel__close-btn:hover {
  background: var(--panel-action-hover-bg);
}

.{{panelName.toLowerCase()}}-panel__content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.{{panelName.toLowerCase()}}-panel-content__section {
  margin-bottom: 24px;
}

.{{panelName.toLowerCase()}}-panel-content__section h4 {
  margin: 0 0 12px 0;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--panel-section-title-color);
  letter-spacing: 0.5px;
}

.{{panelName.toLowerCase()}}-panel-content__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.{{panelName.toLowerCase()}}-panel-content__actions .btn {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.{{panelName.toLowerCase()}}-panel-content__actions .btn-primary {
  background: var(--primary-color);
  color: white;
}

.{{panelName.toLowerCase()}}-panel-content__actions .btn-primary:hover {
  background: var(--primary-color-hover);
}

.{{panelName.toLowerCase()}}-panel-content__actions .btn-secondary {
  background: var(--secondary-bg);
  color: var(--secondary-color);
  border: 1px solid var(--secondary-border);
}

.{{panelName.toLowerCase()}}-panel-content__actions .btn-secondary:hover {
  background: var(--secondary-bg-hover);
}

/* Responsive design */
@media (max-width: 768px) {
  .{{panelName.toLowerCase()}}-panel {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }
}
`
      }
    })

    // Data Provider Template
    this.registerTemplate('data-provider-template', {
      id: 'data-provider-template',
      name: 'Data Provider Service',
      description: 'Create powerful data providers with caching, real-time updates, and error handling',
      category: EXTENDED_TEMPLATE_CATEGORIES.DATA_PROCESSING,
      complexity: TEMPLATE_COMPLEXITY.ADVANCED,
      features: [
        TEMPLATE_FEATURES.DATABASE,
        TEMPLATE_FEATURES.API_CLIENT,
        TEMPLATE_FEATURES.CACHING,
        TEMPLATE_FEATURES.STATE_MANAGEMENT,
        TEMPLATE_FEATURES.TYPESCRIPT
      ],
      language: 'typescript',
      version: '1.0.0',
      customization: {
        providerName: {
          type: 'string',
          required: true,
          description: 'Name of the data provider'
        },
        dataSource: {
          type: 'enum',
          required: true,
          validation: { options: ['api', 'database', 'file', 'memory'] },
          description: 'Type of data source'
        },
        caching: {
          type: 'boolean',
          default: true,
          description: 'Enable caching'
        },
        realTimeUpdates: {
          type: 'boolean',
          default: false,
          description: 'Enable real-time updates'
        }
      },
      files: {
        'src/{{providerName}}DataProvider.ts': `
import { DataProvider, CacheManager, EventEmitter } from '@lokus/data-core'
import { {{providerName}}Config, {{providerName}}Data } from './types'

export class {{providerName}}DataProvider extends DataProvider<{{providerName}}Data> {
  private cache: CacheManager
  private eventEmitter: EventEmitter
  private config: {{providerName}}Config

  constructor(config: {{providerName}}Config) {
    super()
    this.config = config
    {{#if caching}}
    this.cache = new CacheManager({
      ttl: config.cacheTTL || 300000, // 5 minutes default
      maxSize: config.cacheMaxSize || 1000
    })
    {{/if}}
    {{#if realTimeUpdates}}
    this.eventEmitter = new EventEmitter()
    this.setupRealTimeUpdates()
    {{/if}}
  }

  /**
   * Initialize the data provider
   */
  async initialize(): Promise<void> {
    try {
      await this.connect()
      this.emit('initialized')
      console.log('{{providerName}} data provider initialized')
    } catch (error) {
      this.emit('error', error)
      throw new Error(\`Failed to initialize {{providerName}} provider: \${error.message}\`)
    }
  }

  /**
   * Connect to data source
   */
  private async connect(): Promise<void> {
    switch (this.config.source) {
      {{#switch dataSource}}
      {{#case 'api'}}
      case 'api':
        await this.connectToAPI()
        break
      {{/case}}
      {{#case 'database'}}
      case 'database':
        await this.connectToDatabase()
        break
      {{/case}}
      {{#case 'file'}}
      case 'file':
        await this.connectToFileSystem()
        break
      {{/case}}
      {{#case 'memory'}}
      case 'memory':
        this.initializeMemoryStore()
        break
      {{/case}}
      {{/switch}}
      default:
        throw new Error(\`Unsupported data source: \${this.config.source}\`)
    }
  }

  {{#if dataSource === 'api'}}
  /**
   * Connect to API
   */
  private async connectToAPI(): Promise<void> {
    // API connection logic
    if (!this.config.apiUrl) {
      throw new Error('API URL is required')
    }

    try {
      const response = await fetch(\`\${this.config.apiUrl}/health\`)
      if (!response.ok) {
        throw new Error(\`API health check failed: \${response.status}\`)
      }
    } catch (error) {
      throw new Error(\`Failed to connect to API: \${error.message}\`)
    }
  }
  {{/if}}

  /**
   * Fetch data with caching support
   */
  async fetchData(query?: string): Promise<{{providerName}}Data[]> {
    const cacheKey = \`{{providerName.toLowerCase()}}_\${query || 'all'}\`
    
    {{#if caching}}
    // Check cache first
    const cached = this.cache.get(cacheKey)
    if (cached) {
      this.emit('data:cached', cached)
      return cached
    }
    {{/if}}

    try {
      this.emit('data:loading')
      const data = await this.performFetch(query)
      
      {{#if caching}}
      // Cache the result
      this.cache.set(cacheKey, data)
      {{/if}}
      
      this.emit('data:loaded', data)
      return data
    } catch (error) {
      this.emit('data:error', error)
      throw error
    }
  }

  /**
   * Perform actual data fetch based on source type
   */
  private async performFetch(query?: string): Promise<{{providerName}}Data[]> {
    switch (this.config.source) {
      {{#switch dataSource}}
      {{#case 'api'}}
      case 'api':
        return this.fetchFromAPI(query)
      {{/case}}
      {{#case 'database'}}
      case 'database':
        return this.fetchFromDatabase(query)
      {{/case}}
      {{#case 'file'}}
      case 'file':
        return this.fetchFromFile(query)
      {{/case}}
      {{#case 'memory'}}
      case 'memory':
        return this.fetchFromMemory(query)
      {{/case}}
      {{/switch}}
      default:
        throw new Error(\`Unsupported source: \${this.config.source}\`)
    }
  }

  {{#if realTimeUpdates}}
  /**
   * Setup real-time updates
   */
  private setupRealTimeUpdates(): void {
    // WebSocket or polling setup for real-time updates
    if (this.config.websocketUrl) {
      this.setupWebSocket()
    } else if (this.config.pollingInterval) {
      this.setupPolling()
    }
  }

  private setupWebSocket(): void {
    const ws = new WebSocket(this.config.websocketUrl!)
    
    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data)
        this.handleRealTimeUpdate(update)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onerror = (error) => {
      this.emit('realtime:error', error)
    }
  }

  private handleRealTimeUpdate(update: any): void {
    {{#if caching}}
    // Invalidate relevant cache entries
    this.cache.invalidatePattern(\`{{providerName.toLowerCase()}}_\`)
    {{/if}}
    
    this.emit('data:updated', update)
  }
  {{/if}}

  /**
   * Update data
   */
  async updateData(id: string, data: Partial<{{providerName}}Data>): Promise<{{providerName}}Data> {
    try {
      this.emit('data:updating', { id, data })
      const updated = await this.performUpdate(id, data)
      
      {{#if caching}}
      // Invalidate cache
      this.cache.invalidatePattern(\`{{providerName.toLowerCase()}}_\`)
      {{/if}}
      
      this.emit('data:updated', updated)
      return updated
    } catch (error) {
      this.emit('data:update-error', error)
      throw error
    }
  }

  /**
   * Delete data
   */
  async deleteData(id: string): Promise<void> {
    try {
      this.emit('data:deleting', id)
      await this.performDelete(id)
      
      {{#if caching}}
      // Invalidate cache
      this.cache.invalidatePattern(\`{{providerName.toLowerCase()}}_\`)
      {{/if}}
      
      this.emit('data:deleted', id)
    } catch (error) {
      this.emit('data:delete-error', error)
      throw error
    }
  }

  /**
   * Get provider statistics
   */
  getStats() {
    return {
      {{#if caching}}
      cache: this.cache.getStats(),
      {{/if}}
      {{#if realTimeUpdates}}
      realTimeConnected: this.isRealTimeConnected(),
      {{/if}}
      totalRequests: this.getTotalRequests(),
      lastUpdate: this.getLastUpdateTime()
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    {{#if caching}}
    this.cache.clear()
    {{/if}}
    this.removeAllListeners()
    this.emit('cleanup')
  }
}
`,
        'src/types.ts': `
export interface {{providerName}}Data {
  id: string
  name: string
  // Add your data structure here
  createdAt: Date
  updatedAt: Date
}

export interface {{providerName}}Config {
  source: 'api' | 'database' | 'file' | 'memory'
  {{#if dataSource === 'api'}}
  apiUrl?: string
  apiKey?: string
  {{/if}}
  {{#if dataSource === 'database'}}
  databaseUrl?: string
  {{/if}}
  {{#if dataSource === 'file'}}
  filePath?: string
  {{/if}}
  {{#if caching}}
  cacheTTL?: number
  cacheMaxSize?: number
  {{/if}}
  {{#if realTimeUpdates}}
  websocketUrl?: string
  pollingInterval?: number
  {{/if}}
}
`
      }
    })

    // Theme Template
    this.registerTemplate('theme-template', {
      id: 'theme-template',
      name: 'Custom Theme',
      description: 'Create beautiful, accessible themes with comprehensive styling options',
      category: EXTENDED_TEMPLATE_CATEGORIES.ADVANCED,
      complexity: TEMPLATE_COMPLEXITY.INTERMEDIATE,
      features: [
        TEMPLATE_FEATURES.COMPONENT_STYLING,
        TEMPLATE_FEATURES.DOCUMENTATION
      ],
      language: 'typescript',
      version: '1.0.0',
      customization: {
        themeName: {
          type: 'string',
          required: true,
          description: 'Name of the theme'
        },
        baseTheme: {
          type: 'enum',
          required: true,
          validation: { options: ['light', 'dark', 'auto'] },
          description: 'Base theme to extend'
        },
        colorScheme: {
          type: 'string',
          required: true,
          description: 'Primary color for the theme (hex)'
        }
      },
      files: {
        'src/{{themeName}}Theme.css': `
/* {{themeName}} Theme */
:root[data-theme="{{themeName.toLowerCase()}}"] {
  /* Color System */
  --primary-color: {{colorScheme}};
  --primary-color-hover: {{colorScheme}}dd;
  --primary-color-active: {{colorScheme}}bb;
  
  {{#if baseTheme === 'light'}}
  /* Light Theme Colors */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-tertiary: #e9ecef;
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-muted: #adb5bd;
  --border-color: #dee2e6;
  --shadow-color: rgba(0, 0, 0, 0.1);
  {{else}}
  /* Dark Theme Colors */
  --bg-primary: #1a1a1a;
  --bg-secondary: #2d2d2d;
  --bg-tertiary: #404040;
  --text-primary: #ffffff;
  --text-secondary: #b3b3b3;
  --text-muted: #808080;
  --border-color: #404040;
  --shadow-color: rgba(0, 0, 0, 0.3);
  {{/if}}
  
  /* Semantic Colors */
  --success-color: #28a745;
  --warning-color: #ffc107;
  --error-color: #dc3545;
  --info-color: #17a2b8;
  
  /* Editor Colors */
  --editor-bg: var(--bg-primary);
  --editor-text: var(--text-primary);
  --editor-border: var(--border-color);
  --editor-selection: {{colorScheme}}33;
  --editor-cursor: var(--primary-color);
  --editor-placeholder: var(--text-muted);
  
  /* Panel Colors */
  --panel-bg: var(--bg-secondary);
  --panel-border: var(--border-color);
  --panel-header-bg: var(--bg-tertiary);
  --panel-title-color: var(--text-primary);
  --panel-action-color: var(--text-secondary);
  --panel-action-hover-bg: var(--bg-tertiary);
  
  /* Button Colors */
  --btn-primary-bg: var(--primary-color);
  --btn-primary-text: #ffffff;
  --btn-primary-hover: var(--primary-color-hover);
  --btn-secondary-bg: var(--bg-tertiary);
  --btn-secondary-text: var(--text-primary);
  --btn-secondary-hover: var(--border-color);
  
  /* Typography */
  --font-family-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  --font-family-mono: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
  --font-size-xs: 0.75rem;
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-size-xl: 1.25rem;
  --font-size-2xl: 1.5rem;
  --font-size-3xl: 1.875rem;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-loose: 1.75;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  --spacing-2xl: 3rem;
  
  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
  --radius-xl: 0.75rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 var(--shadow-color);
  --shadow-md: 0 4px 6px -1px var(--shadow-color);
  --shadow-lg: 0 10px 15px -3px var(--shadow-color);
  --shadow-xl: 0 20px 25px -5px var(--shadow-color);
  
  /* Transitions */
  --transition-fast: 0.15s ease-in-out;
  --transition-normal: 0.3s ease-in-out;
  --transition-slow: 0.5s ease-in-out;
  
  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
}

/* Component Overrides */
:root[data-theme="{{themeName.toLowerCase()}}"] .editor {
  background: var(--editor-bg);
  color: var(--editor-text);
  font-family: var(--font-family-sans);
  line-height: var(--line-height-normal);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .editor .ProseMirror {
  outline: none;
  caret-color: var(--editor-cursor);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .editor .ProseMirror::selection {
  background: var(--editor-selection);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .sidebar {
  background: var(--panel-bg);
  border-right: 1px solid var(--panel-border);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .button {
  border-radius: var(--radius-md);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .button-primary {
  background: var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: none;
}

:root[data-theme="{{themeName.toLowerCase()}}"] .button-primary:hover {
  background: var(--btn-primary-hover);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .button-secondary {
  background: var(--btn-secondary-bg);
  color: var(--btn-secondary-text);
  border: 1px solid var(--border-color);
}

:root[data-theme="{{themeName.toLowerCase()}}"] .button-secondary:hover {
  background: var(--btn-secondary-hover);
}

/* Accessibility Enhancements */
:root[data-theme="{{themeName.toLowerCase()}}"] *:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  :root[data-theme="{{themeName.toLowerCase()}}"] * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Print Styles */
@media print {
  :root[data-theme="{{themeName.toLowerCase()}}"] {
    --bg-primary: white;
    --text-primary: black;
    --border-color: #ccc;
  }
}
`,
        'src/{{themeName}}Theme.ts': `
import { Theme } from '@lokus/theme-system'
import './{{themeName}}Theme.css'

export class {{themeName}}Theme extends Theme {
  constructor() {
    super({
      id: '{{themeName.toLowerCase()}}',
      name: '{{themeName}}',
      description: 'A beautiful {{baseTheme}} theme with {{colorScheme}} accents',
      version: '1.0.0',
      author: 'Your Name',
      baseTheme: '{{baseTheme}}',
      colorScheme: '{{colorScheme}}'
    })
  }

  /**
   * Apply the theme
   */
  apply(): void {
    document.documentElement.setAttribute('data-theme', this.id)
    this.emit('applied')
  }

  /**
   * Remove the theme
   */
  remove(): void {
    if (document.documentElement.getAttribute('data-theme') === this.id) {
      document.documentElement.removeAttribute('data-theme')
    }
    this.emit('removed')
  }

  /**
   * Get theme variables
   */
  getVariables(): Record<string, string> {
    const computedStyle = getComputedStyle(document.documentElement)
    const variables: Record<string, string> = {}
    
    const cssText = document.documentElement.style.cssText
    const matches = cssText.match(/--[a-zA-Z-]+:\s*[^;]+/g) || []
    
    matches.forEach(match => {
      const [property, value] = match.split(':').map(s => s.trim())
      variables[property] = value
    })
    
    return variables
  }

  /**
   * Update theme variables
   */
  updateVariables(variables: Record<string, string>): void {
    Object.entries(variables).forEach(([property, value]) => {
      document.documentElement.style.setProperty(property, value)
    })
    this.emit('updated', variables)
  }

  /**
   * Export theme configuration
   */
  export(): object {
    return {
      ...this.config,
      variables: this.getVariables(),
      exportedAt: new Date().toISOString()
    }
  }

  /**
   * Check if theme supports dark mode
   */
  supportsDarkMode(): boolean {
    return this.config.baseTheme === 'dark' || this.config.baseTheme === 'auto'
  }

  /**
   * Check accessibility compliance
   */
  checkAccessibility(): object {
    const variables = this.getVariables()
    const issues: string[] = []
    const warnings: string[] = []

    // Check contrast ratios (simplified)
    const primaryBg = variables['--bg-primary']
    const primaryText = variables['--text-primary']
    
    if (primaryBg && primaryText) {
      // In a real implementation, you'd calculate actual contrast ratios
      if (primaryBg === primaryText) {
        issues.push('Primary background and text colors are the same')
      }
    }

    // Check for required variables
    const requiredVars = [
      '--primary-color', '--bg-primary', '--text-primary',
      '--border-color', '--success-color', '--error-color'
    ]
    
    requiredVars.forEach(varName => {
      if (!variables[varName]) {
        issues.push(\`Required variable \${varName} is missing\`)
      }
    })

    return {
      compliant: issues.length === 0,
      issues,
      warnings,
      checkedAt: new Date().toISOString()
    }
  }
}

export default {{themeName}}Theme
`
      }
    })
  }

  /**
   * Initialize showcase examples
   */
  initializeShowcaseExamples() {
    // These are complete, production-ready plugin examples
    this.registerShowcaseExample('mermaid-diagrams', {
      id: 'mermaid-diagrams',
      name: 'Mermaid Diagrams Plugin',
      description: 'Full-featured Mermaid diagram integration with live preview, editing, and export',
      category: EXTENDED_TEMPLATE_CATEGORIES.VISUALIZATION,
      complexity: TEMPLATE_COMPLEXITY.ADVANCED,
      features: [
        'Live diagram preview',
        'Syntax highlighting',
        'Export to PNG/SVG',
        'Multiple diagram types',
        'Theme integration',
        'Collaborative editing'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/mermaid',
      sourceUrl: 'https://github.com/lokus-dev/plugin-mermaid',
      downloadSize: '2.3MB',
      downloads: 15420,
      rating: 4.8
    })

    this.registerShowcaseExample('task-manager', {
      id: 'task-manager',
      name: 'Advanced Task Manager',
      description: 'Complete kanban-style task management with drag-and-drop, filtering, and team collaboration',
      category: EXTENDED_TEMPLATE_CATEGORIES.PRODUCTIVITY,
      complexity: TEMPLATE_COMPLEXITY.ADVANCED,
      features: [
        'Kanban board interface',
        'Drag and drop tasks',
        'Advanced filtering',
        'Due date management',
        'Team collaboration',
        'Progress tracking',
        'Custom task types'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/task-manager',
      sourceUrl: 'https://github.com/lokus-dev/plugin-task-manager',
      downloadSize: '3.1MB',
      downloads: 8932,
      rating: 4.6
    })

    this.registerShowcaseExample('github-integration', {
      id: 'github-integration',
      name: 'GitHub Integration Suite',
      description: 'Complete GitHub integration with repository management, issue tracking, and PR workflows',
      category: EXTENDED_TEMPLATE_CATEGORIES.DEVELOPER_TOOLS,
      complexity: TEMPLATE_COMPLEXITY.EXPERT,
      features: [
        'Repository browsing',
        'Issue management',
        'Pull request workflows',
        'Code review tools',
        'Branch management',
        'Commit history',
        'GitHub Actions integration'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/github',
      sourceUrl: 'https://github.com/lokus-dev/plugin-github',
      downloadSize: '4.7MB',
      downloads: 12043,
      rating: 4.9
    })

    this.registerShowcaseExample('advanced-search', {
      id: 'advanced-search',
      name: 'Semantic Search Engine',
      description: 'AI-powered semantic search with vector indexing, natural language queries, and smart suggestions',
      category: EXTENDED_TEMPLATE_CATEGORIES.DATA_PROCESSING,
      complexity: TEMPLATE_COMPLEXITY.EXPERT,
      features: [
        'Semantic search',
        'Vector embeddings',
        'Natural language queries',
        'Smart suggestions',
        'Search analytics',
        'Custom indexing',
        'Real-time search'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/search',
      sourceUrl: 'https://github.com/lokus-dev/plugin-search',
      downloadSize: '5.2MB',
      downloads: 6721,
      rating: 4.7
    })

    this.registerShowcaseExample('3d-graph', {
      id: '3d-graph',
      name: '3D Knowledge Graph',
      description: 'Immersive 3D graph visualization with WebGL rendering, physics simulation, and VR support',
      category: EXTENDED_TEMPLATE_CATEGORIES.VISUALIZATION,
      complexity: TEMPLATE_COMPLEXITY.EXPERT,
      features: [
        '3D graph rendering',
        'WebGL acceleration',
        'Physics simulation',
        'VR/AR support',
        'Interactive navigation',
        'Custom node shapes',
        'Performance optimization'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/3d-graph',
      sourceUrl: 'https://github.com/lokus-dev/plugin-3d-graph',
      downloadSize: '6.8MB',
      downloads: 4156,
      rating: 4.5
    })

    this.registerShowcaseExample('theme-studio', {
      id: 'theme-studio',
      name: 'Theme Studio Pro',
      description: 'Professional theme editor with visual designer, color palette tools, and marketplace integration',
      category: EXTENDED_TEMPLATE_CATEGORIES.DEVELOPER_TOOLS,
      complexity: TEMPLATE_COMPLEXITY.EXPERT,
      features: [
        'Visual theme editor',
        'Color palette tools',
        'Real-time preview',
        'Theme marketplace',
        'Export/import themes',
        'Accessibility checker',
        'Custom CSS injection'
      ],
      demoUrl: 'https://demo.lokus.dev/plugins/theme-studio',
      sourceUrl: 'https://github.com/lokus-dev/plugin-theme-studio',
      downloadSize: '3.9MB',
      downloads: 7834,
      rating: 4.8
    })
  }

  /**
   * Register a template in the registry
   */
  registerTemplate(id, config) {
    this.templates.set(id, {
      ...config,
      registeredAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    })
  }

  /**
   * Register a showcase example
   */
  registerShowcaseExample(id, config) {
    this.showcaseExamples.set(id, {
      ...config,
      type: 'showcase',
      registeredAt: new Date().toISOString()
    })
  }

  /**
   * Get all templates
   */
  getAllTemplates() {
    return Array.from(this.templates.values())
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category) {
    return this.getAllTemplates().filter(template => template.category === category)
  }

  /**
   * Get templates by complexity
   */
  getTemplatesByComplexity(complexity) {
    return this.getAllTemplates().filter(template => template.complexity === complexity)
  }

  /**
   * Get all showcase examples
   */
  getAllShowcaseExamples() {
    return Array.from(this.showcaseExamples.values())
  }

  /**
   * Search templates and examples
   */
  search(query) {
    const lowerQuery = query.toLowerCase()
    
    const templates = this.getAllTemplates().filter(template =>
      template.name.toLowerCase().includes(lowerQuery) ||
      template.description.toLowerCase().includes(lowerQuery) ||
      (template.metadata?.keywords || []).some(keyword => 
        keyword.toLowerCase().includes(lowerQuery)
      )
    )

    const examples = this.getAllShowcaseExamples().filter(example =>
      example.name.toLowerCase().includes(lowerQuery) ||
      example.description.toLowerCase().includes(lowerQuery) ||
      example.features.some(feature => 
        feature.toLowerCase().includes(lowerQuery)
      )
    )

    return { templates, examples }
  }

  /**
   * Get template statistics
   */
  getStatistics() {
    const templates = this.getAllTemplates()
    const examples = this.getAllShowcaseExamples()

    return {
      templates: {
        total: templates.length,
        byCategory: this.groupBy(templates, 'category'),
        byComplexity: this.groupBy(templates, 'complexity'),
        byLanguage: this.groupBy(templates, 'language')
      },
      examples: {
        total: examples.length,
        byCategory: this.groupBy(examples, 'category'),
        totalDownloads: examples.reduce((sum, ex) => sum + (ex.downloads || 0), 0),
        averageRating: examples.reduce((sum, ex) => sum + (ex.rating || 0), 0) / examples.length
      }
    }
  }

  /**
   * Helper method to group items by property
   */
  groupBy(items, property) {
    return items.reduce((groups, item) => {
      const key = item[property]
      groups[key] = (groups[key] || 0) + 1
      return groups
    }, {})
  }

  /**
   * Export template registry
   */
  export() {
    return {
      templates: Object.fromEntries(this.templates),
      showcaseExamples: Object.fromEntries(this.showcaseExamples),
      statistics: this.getStatistics(),
      exportedAt: new Date().toISOString(),
      version: '1.0.0'
    }
  }
}

/**
 * Default enhanced template registry instance
 */
export const enhancedTemplateRegistry = new EnhancedTemplateRegistry()

export default EnhancedTemplateRegistry