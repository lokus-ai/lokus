/**
 * Diagram Plugin - Example editor plugin with Mermaid integration
 * 
 * This plugin demonstrates how to create rich editor extensions using the EditorAPI.
 * It provides:
 * - Custom diagram node with Mermaid rendering
 * - Slash commands for diagram insertion
 * - Toolbar integration
 * - Input rules for markdown-style diagrams
 * - Node view with interactive editing
 */

import { Node } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Plugin metadata
export const PLUGIN_ID = 'diagram-plugin'
export const PLUGIN_NAME = 'Diagram Plugin'
export const PLUGIN_VERSION = '1.0.0'

/**
 * Diagram Plugin Class
 */
export class DiagramPlugin {
  constructor() {
    this.id = PLUGIN_ID
    this.name = PLUGIN_NAME
    this.version = PLUGIN_VERSION
    this.description = 'Adds Mermaid diagram support to the editor'
    this.author = 'Lokus Team'
    
    // Plugin state
    this.mermaidLoaded = false
    this.diagramCache = new Map()
    
    console.log(`[DiagramPlugin] Initialized v${this.version}`)
  }

  /**
   * Plugin activation - called when plugin is enabled
   */
  async activate() {
    console.log('[DiagramPlugin] Activating...')
    
    try {
      // Load Mermaid library
      await this.loadMermaid()
      console.log('[DiagramPlugin] ✅ Activated successfully')
      return true
    } catch (error) {
      console.error('[DiagramPlugin] ❌ Activation failed:', error)
      throw error
    }
  }

  /**
   * Plugin deactivation - called when plugin is disabled
   */
  async deactivate() {
    console.log('[DiagramPlugin] Deactivating...')
    
    // Clear caches
    this.diagramCache.clear()
    
    console.log('[DiagramPlugin] ✅ Deactivated successfully')
  }

  /**
   * Register editor extensions with the EditorAPI
   */
  async registerEditorExtensions(editorAPI) {
    console.log('[DiagramPlugin] Registering editor extensions...')
    
    try {
      // Register the diagram node
      await this.registerDiagramNode(editorAPI)
      
      // Register slash commands
      await this.registerSlashCommands(editorAPI)
      
      // Register input rules
      await this.registerInputRules(editorAPI)
      
      // Register toolbar items
      await this.registerToolbarItems(editorAPI)
      
      // Register keyboard shortcuts
      await this.registerKeyboardShortcuts(editorAPI)
      
      console.log('[DiagramPlugin] ✅ All extensions registered successfully')
      
    } catch (error) {
      console.error('[DiagramPlugin] ❌ Failed to register extensions:', error)
      throw error
    }
  }

  /**
   * Register the diagram node
   */
  async registerDiagramNode(editorAPI) {
    const nodeConfig = {
      name: 'diagram',
      group: 'block',
      atom: true,
      selectable: true,
      draggable: true,
      
      attributes: {
        type: {
          default: 'flowchart',
          parseHTML: element => element.getAttribute('data-diagram-type'),
          renderHTML: attributes => ({ 'data-diagram-type': attributes.type })
        },
        source: {
          default: '',
          parseHTML: element => element.getAttribute('data-source'),
          renderHTML: attributes => ({ 'data-source': attributes.source })
        },
        id: {
          default: '',
          parseHTML: element => element.getAttribute('data-diagram-id'),
          renderHTML: attributes => ({ 'data-diagram-id': attributes.id })
        }
      },
      
      parseHTML: () => [
        {
          tag: 'div[data-type="diagram"]',
          getAttrs: element => ({
            type: element.getAttribute('data-diagram-type'),
            source: element.getAttribute('data-source'),
            id: element.getAttribute('data-diagram-id')
          })
        }
      ],
      
      renderHTML: ({ HTMLAttributes }) => {
        return [
          'div',
          {
            'data-type': 'diagram',
            'data-diagram-type': HTMLAttributes.type,
            'data-source': HTMLAttributes.source,
            'data-diagram-id': HTMLAttributes.id,
            class: 'diagram-container'
          },
          ['div', { class: 'diagram-content' }, HTMLAttributes.source]
        ]
      },
      
      nodeView: (props) => this.createDiagramNodeView(props),
      
      commands: {
        setDiagram: (attributes = {}) => ({ commands }) => {
          const id = attributes.id || this.generateDiagramId()
          return commands.insertContent({
            type: 'diagram',
            attrs: {
              type: attributes.type || 'flowchart',
              source: attributes.source || this.getDefaultDiagramSource(attributes.type),
              id
            }
          })
        },
        
        updateDiagram: (id, attributes) => ({ state, tr, dispatch }) => {
          let found = false
          state.doc.descendants((node, pos) => {
            if (found) return false
            
            if (node.type.name === 'diagram' && node.attrs.id === id) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, ...attributes })
              found = true
              return false
            }
            return true
          })
          
          if (found && dispatch) {
            dispatch(tr)
            return true
          }
          return false
        }
      },
      
      inputRules: [
        {
          find: /^```mermaid\s*$/,
          handler: ({ state, range, match, chain }) => {
            const id = this.generateDiagramId()
            chain()
              .deleteRange(range)
              .setDiagram({
                type: 'flowchart',
                source: 'graph TD\n    A[Start] --> B[End]',
                id
              })
              .run()
          }
        },
        {
          find: /^```diagram\s*$/,
          handler: ({ state, range, match, chain }) => {
            const id = this.generateDiagramId()
            chain()
              .deleteRange(range)
              .setDiagram({
                type: 'flowchart',
                source: 'graph TD\n    A[Start] --> B[End]',
                id
              })
              .run()
          }
        }
      ],
      
      keyboardShortcuts: {
        'Mod-Shift-d': ({ commands }) => {
          return commands.setDiagram({
            type: 'flowchart',
            source: 'graph TD\n    A[Start] --> B[End]'
          })
        }
      },
      
      // Lifecycle hooks
      onCreate: () => {
        console.log('[DiagramPlugin] Diagram node created')
      },
      
      onUpdate: () => {
        // Re-render diagrams when content updates
        this.invalidateDiagramCache()
      }
    }
    
    editorAPI.registerNode(PLUGIN_ID, nodeConfig)
    console.log('[DiagramPlugin] ✅ Diagram node registered')
  }

  /**
   * Register slash commands
   */
  async registerSlashCommands(editorAPI) {
    const commands = [
      {
        id: 'flowchart',
        title: 'Flowchart',
        description: 'Insert a flowchart diagram',
        icon: '📊',
        group: 'Diagrams',
        order: 1,
        keywords: ['diagram', 'flowchart', 'chart', 'flow'],
        handler: ({ editor, range }) => {
          editor.chain()
            .focus()
            .deleteRange(range)
            .setDiagram({
              type: 'flowchart',
              source: 'graph TD\n    A[Start] --> B[Process] --> C[End]'
            })
            .run()
        }
      },
      {
        id: 'sequence',
        title: 'Sequence Diagram',
        description: 'Insert a sequence diagram',
        icon: '🔄',
        group: 'Diagrams',
        order: 2,
        keywords: ['sequence', 'diagram', 'interaction'],
        handler: ({ editor, range }) => {
          editor.chain()
            .focus()
            .deleteRange(range)
            .setDiagram({
              type: 'sequence',
              source: 'sequenceDiagram\n    A->>B: Hello\n    B-->>A: Hi'
            })
            .run()
        }
      },
      {
        id: 'gantt',
        title: 'Gantt Chart',
        description: 'Insert a Gantt chart',
        icon: '📅',
        group: 'Diagrams',
        order: 3,
        keywords: ['gantt', 'chart', 'timeline', 'project'],
        handler: ({ editor, range }) => {
          editor.chain()
            .focus()
            .deleteRange(range)
            .setDiagram({
              type: 'gantt',
              source: 'gantt\n    title Project Timeline\n    Task A: a1, 2023-01-01, 30d\n    Task B: a2, after a1, 20d'
            })
            .run()
        }
      }
    ]
    
    for (const command of commands) {
      editorAPI.registerSlashCommand(PLUGIN_ID, command)
    }
    
    console.log(`[DiagramPlugin] ✅ Registered ${commands.length} slash commands`)
  }

  /**
   * Register input rules
   */
  async registerInputRules(editorAPI) {
    const inputRules = [
      {
        id: 'mermaid-block',
        pattern: /^```mermaid\s*$/,
        handler: ({ state, range, match, chain }) => {
          const id = this.generateDiagramId()
          chain()
            .deleteRange(range)
            .setDiagram({
              type: 'flowchart',
              source: 'graph TD\n    A[Start] --> B[End]',
              id
            })
            .run()
        }
      }
    ]
    
    for (const rule of inputRules) {
      editorAPI.registerInputRule(PLUGIN_ID, rule)
    }
    
    console.log(`[DiagramPlugin] ✅ Registered ${inputRules.length} input rules`)
  }

  /**
   * Register toolbar items
   */
  async registerToolbarItems(editorAPI) {
    const toolbarItem = {
      id: 'diagram-dropdown',
      type: 'dropdown',
      title: 'Insert Diagram',
      icon: '📊',
      group: 'insert',
      order: 50,
      items: [
        {
          id: 'flowchart',
          title: 'Flowchart',
          icon: '📊',
          handler: ({ editor }) => {
            editor.commands.setDiagram({
              type: 'flowchart',
              source: 'graph TD\n    A[Start] --> B[Process] --> C[End]'
            })
          }
        },
        {
          id: 'sequence',
          title: 'Sequence Diagram',
          icon: '🔄',
          handler: ({ editor }) => {
            editor.commands.setDiagram({
              type: 'sequence',
              source: 'sequenceDiagram\n    A->>B: Hello\n    B-->>A: Hi'
            })
          }
        },
        {
          id: 'gantt',
          title: 'Gantt Chart',
          icon: '📅',
          handler: ({ editor }) => {
            editor.commands.setDiagram({
              type: 'gantt',
              source: 'gantt\n    title Project Timeline\n    Task A: a1, 2023-01-01, 30d'
            })
          }
        }
      ]
    }
    
    editorAPI.registerToolbarItem(PLUGIN_ID, toolbarItem)
    console.log('[DiagramPlugin] ✅ Registered toolbar items')
  }

  /**
   * Register keyboard shortcuts
   */
  async registerKeyboardShortcuts(editorAPI) {
    const shortcuts = [
      {
        key: 'Mod-Shift-d',
        handler: ({ editor }) => {
          return editor.commands.setDiagram({
            type: 'flowchart',
            source: 'graph TD\n    A[Start] --> B[End]'
          })
        }
      }
    ]
    
    for (const shortcut of shortcuts) {
      editorAPI.registerKeyboardShortcut(PLUGIN_ID, shortcut)
    }
    
    console.log(`[DiagramPlugin] ✅ Registered ${shortcuts.length} keyboard shortcuts`)
  }

  /**
   * Create diagram node view with interactive editing
   */
  createDiagramNodeView({ node, view, getPos, editor }) {
    const dom = document.createElement('div')
    dom.className = 'diagram-node-view'
    dom.style.cssText = `
      position: relative;
      border: 2px solid transparent;
      border-radius: 8px;
      margin: 16px 0;
      background: rgb(var(--panel));
      transition: border-color 0.2s ease;
    `
    
    // Create diagram container
    const diagramContainer = document.createElement('div')
    diagramContainer.className = 'diagram-display'
    diagramContainer.style.cssText = `
      min-height: 200px;
      padding: 16px;
      text-align: center;
      position: relative;
    `
    
    // Create edit overlay
    const editOverlay = document.createElement('div')
    editOverlay.className = 'diagram-edit-overlay'
    editOverlay.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      opacity: 0;
      transition: opacity 0.2s ease;
    `
    
    // Create edit button
    const editButton = document.createElement('button')
    editButton.innerHTML = '✏️'
    editButton.title = 'Edit diagram'
    editButton.style.cssText = `
      background: rgb(var(--accent));
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px;
      cursor: pointer;
      font-size: 14px;
    `
    
    editButton.addEventListener('click', () => {
      this.openDiagramEditor(node, getPos, editor)
    })
    
    editOverlay.appendChild(editButton)
    
    // Add hover effects
    dom.addEventListener('mouseenter', () => {
      dom.style.borderColor = 'rgb(var(--accent))'
      editOverlay.style.opacity = '1'
    })
    
    dom.addEventListener('mouseleave', () => {
      dom.style.borderColor = 'transparent'
      editOverlay.style.opacity = '0'
    })
    
    // Render initial diagram
    this.renderDiagram(diagramContainer, node.attrs)
    
    // Assemble node view
    dom.appendChild(diagramContainer)
    dom.appendChild(editOverlay)
    
    return {
      dom,
      update: (updatedNode) => {
        if (updatedNode.type.name !== 'diagram') return false
        
        // Re-render diagram if source changed
        if (updatedNode.attrs.source !== node.attrs.source) {
          this.renderDiagram(diagramContainer, updatedNode.attrs)
        }
        
        return true
      },
      selectNode: () => {
        dom.style.borderColor = 'rgb(var(--accent))'
        editOverlay.style.opacity = '1'
      },
      deselectNode: () => {
        dom.style.borderColor = 'transparent'
        editOverlay.style.opacity = '0'
      }
    }
  }

  /**
   * Render diagram using Mermaid
   */
  async renderDiagram(container, attrs) {
    const { type, source, id } = attrs
    
    try {
      // Check cache first
      const cacheKey = `${type}:${source}`
      if (this.diagramCache.has(cacheKey)) {
        container.innerHTML = this.diagramCache.get(cacheKey)
        return
      }
      
      // Show loading state
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: rgb(var(--muted));">
          <div>
            <div style="margin-bottom: 8px;">📊</div>
            <div>Rendering diagram...</div>
          </div>
        </div>
      `
      
      // Ensure Mermaid is loaded
      if (!this.mermaidLoaded) {
        await this.loadMermaid()
      }
      
      // Render with Mermaid
      const mermaid = window.mermaid
      if (!mermaid) {
        throw new Error('Mermaid not loaded')
      }
      
      // Create unique element ID
      const elementId = `diagram-${id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      
      // Render diagram
      const { svg } = await mermaid.render(elementId, source)
      
      // Cache result
      this.diagramCache.set(cacheKey, svg)
      
      // Update container
      container.innerHTML = svg
      
    } catch (error) {
      console.error('[DiagramPlugin] Failed to render diagram:', error)
      
      // Show error state
      container.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: center; height: 200px; color: rgb(var(--danger));">
          <div style="text-align: center;">
            <div style="margin-bottom: 8px;">⚠️</div>
            <div>Diagram Error</div>
            <div style="font-size: 12px; margin-top: 4px; color: rgb(var(--muted));">
              ${error.message}
            </div>
          </div>
        </div>
      `
    }
  }

  /**
   * Open diagram editor modal
   */
  openDiagramEditor(node, getPos, editor) {
    const overlay = document.createElement('div')
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      backdrop-filter: blur(4px);
    `
    
    const modal = document.createElement('div')
    modal.style.cssText = `
      background: rgb(var(--panel));
      border: 1px solid rgb(var(--border));
      border-radius: 12px;
      width: 80vw;
      max-width: 1000px;
      height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `
    
    // Create header
    const header = document.createElement('div')
    header.style.cssText = `
      padding: 20px;
      border-bottom: 1px solid rgb(var(--border));
      background: rgb(var(--bg));
    `
    
    header.innerHTML = `
      <h3 style="margin: 0; color: rgb(var(--text)); font-size: 18px; font-weight: 600;">
        Edit Diagram
      </h3>
      <p style="margin: 4px 0 0 0; color: rgb(var(--muted)); font-size: 14px;">
        Modify your Mermaid diagram source code
      </p>
    `
    
    // Create content area
    const content = document.createElement('div')
    content.style.cssText = `
      flex: 1;
      display: flex;
      overflow: hidden;
    `
    
    // Create editor panel
    const editorPanel = document.createElement('div')
    editorPanel.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
      border-right: 1px solid rgb(var(--border));
    `
    
    const editorHeader = document.createElement('div')
    editorHeader.style.cssText = `
      padding: 12px 16px;
      background: rgb(var(--bg));
      border-bottom: 1px solid rgb(var(--border));
      font-size: 14px;
      font-weight: 500;
      color: rgb(var(--text));
    `
    editorHeader.textContent = 'Source Code'
    
    const textarea = document.createElement('textarea')
    textarea.value = node.attrs.source
    textarea.style.cssText = `
      flex: 1;
      border: none;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
      line-height: 1.5;
      background: rgb(var(--panel));
      color: rgb(var(--text));
      resize: none;
      outline: none;
    `
    
    editorPanel.appendChild(editorHeader)
    editorPanel.appendChild(textarea)
    
    // Create preview panel
    const previewPanel = document.createElement('div')
    previewPanel.style.cssText = `
      flex: 1;
      display: flex;
      flex-direction: column;
    `
    
    const previewHeader = document.createElement('div')
    previewHeader.style.cssText = `
      padding: 12px 16px;
      background: rgb(var(--bg));
      border-bottom: 1px solid rgb(var(--border));
      font-size: 14px;
      font-weight: 500;
      color: rgb(var(--text));
    `
    previewHeader.textContent = 'Preview'
    
    const previewContent = document.createElement('div')
    previewContent.style.cssText = `
      flex: 1;
      padding: 16px;
      background: rgb(var(--bg));
      overflow: auto;
    `
    
    previewPanel.appendChild(previewHeader)
    previewPanel.appendChild(previewContent)
    
    content.appendChild(editorPanel)
    content.appendChild(previewPanel)
    
    // Create footer
    const footer = document.createElement('div')
    footer.style.cssText = `
      padding: 16px 20px;
      border-top: 1px solid rgb(var(--border));
      background: rgb(var(--bg));
      display: flex;
      justify-content: space-between;
      align-items: center;
    `
    
    const typeSelect = document.createElement('select')
    typeSelect.value = node.attrs.type
    typeSelect.style.cssText = `
      padding: 8px 12px;
      border: 1px solid rgb(var(--border));
      border-radius: 6px;
      background: rgb(var(--panel));
      color: rgb(var(--text));
    `
    
    const diagramTypes = [
      { value: 'flowchart', label: 'Flowchart' },
      { value: 'sequence', label: 'Sequence' },
      { value: 'gantt', label: 'Gantt' },
      { value: 'pie', label: 'Pie Chart' },
      { value: 'gitgraph', label: 'Git Graph' }
    ]
    
    diagramTypes.forEach(type => {
      const option = document.createElement('option')
      option.value = type.value
      option.textContent = type.label
      typeSelect.appendChild(option)
    })
    
    const buttonGroup = document.createElement('div')
    buttonGroup.style.cssText = 'display: flex; gap: 12px;'
    
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = 'Cancel'
    cancelBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid rgb(var(--border));
      border-radius: 6px;
      background: transparent;
      color: rgb(var(--muted));
      cursor: pointer;
    `
    
    const saveBtn = document.createElement('button')
    saveBtn.textContent = 'Save'
    saveBtn.style.cssText = `
      padding: 8px 16px;
      border: 1px solid rgb(var(--accent));
      border-radius: 6px;
      background: rgb(var(--accent));
      color: white;
      cursor: pointer;
    `
    
    buttonGroup.appendChild(cancelBtn)
    buttonGroup.appendChild(saveBtn)
    
    footer.appendChild(typeSelect)
    footer.appendChild(buttonGroup)
    
    // Assemble modal
    modal.appendChild(header)
    modal.appendChild(content)
    modal.appendChild(footer)
    overlay.appendChild(modal)
    
    // Add to DOM
    document.body.appendChild(overlay)
    
    // Live preview update
    let previewTimeout
    const updatePreview = () => {
      clearTimeout(previewTimeout)
      previewTimeout = setTimeout(() => {
        this.renderDiagram(previewContent, {
          type: typeSelect.value,
          source: textarea.value,
          id: node.attrs.id
        })
      }, 500)
    }
    
    textarea.addEventListener('input', updatePreview)
    typeSelect.addEventListener('change', updatePreview)
    
    // Initial preview
    updatePreview()
    
    // Event handlers
    cancelBtn.addEventListener('click', () => {
      document.body.removeChild(overlay)
    })
    
    saveBtn.addEventListener('click', () => {
      const pos = getPos()
      if (pos !== undefined) {
        editor.commands.updateDiagram(node.attrs.id, {
          type: typeSelect.value,
          source: textarea.value
        })
      }
      document.body.removeChild(overlay)
    })
    
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay)
      }
    })
    
    // Focus textarea
    setTimeout(() => textarea.focus(), 100)
  }

  /**
   * Load Mermaid library
   */
  async loadMermaid() {
    if (this.mermaidLoaded) return
    
    try {
      console.log('[DiagramPlugin] Loading Mermaid library...')
      
      // Check if already loaded
      if (window.mermaid) {
        this.mermaidLoaded = true
        return
      }
      
      // Load from CDN
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js'
      
      const loadPromise = new Promise((resolve, reject) => {
        script.onload = resolve
        script.onerror = reject
      })
      
      document.head.appendChild(script)
      await loadPromise
      
      // Initialize Mermaid
      window.mermaid.initialize({
        startOnLoad: false,
        theme: 'default',
        themeVariables: {
          primaryColor: '#3b82f6',
          primaryTextColor: '#1f2937',
          primaryBorderColor: '#1f2937',
          lineColor: '#6b7280',
          sectionBkgColor: '#f3f4f6',
          altSectionBkgColor: '#ffffff',
          gridColor: '#e5e7eb',
          secondaryColor: '#f9fafb',
          tertiaryColor: '#ffffff'
        }
      })
      
      this.mermaidLoaded = true
      console.log('[DiagramPlugin] ✅ Mermaid loaded successfully')
      
    } catch (error) {
      console.error('[DiagramPlugin] ❌ Failed to load Mermaid:', error)
      throw new Error(`Failed to load Mermaid: ${error.message}`)
    }
  }

  /**
   * Generate unique diagram ID
   */
  generateDiagramId() {
    return `diagram-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get default diagram source for type
   */
  getDefaultDiagramSource(type) {
    const defaults = {
      flowchart: 'graph TD\n    A[Start] --> B[Process] --> C[End]',
      sequence: 'sequenceDiagram\n    participant A\n    participant B\n    A->>B: Hello\n    B-->>A: Hi',
      gantt: 'gantt\n    title Project Timeline\n    dateFormat  YYYY-MM-DD\n    section Planning\n    Task A: a1, 2023-01-01, 30d\n    Task B: a2, after a1, 20d',
      pie: 'pie title Sample Data\n    "A" : 42\n    "B" : 50\n    "C" : 8',
      gitgraph: 'gitGraph\n    commit\n    branch develop\n    commit\n    commit\n    checkout main\n    commit\n    merge develop'
    }
    
    return defaults[type] || defaults.flowchart
  }

  /**
   * Invalidate diagram cache
   */
  invalidateDiagramCache() {
    this.diagramCache.clear()
  }

  /**
   * Get plugin statistics
   */
  getStats() {
    return {
      name: this.name,
      version: this.version,
      mermaidLoaded: this.mermaidLoaded,
      cachedDiagrams: this.diagramCache.size
    }
  }
}

// Export plugin instance
export default new DiagramPlugin()