/**
 * Mermaid Diagrams Plugin for Lokus
 * 
 * A comprehensive Mermaid integration that provides:
 * - Custom editor node for Mermaid diagrams
 * - Live preview with syntax highlighting
 * - Export to PNG, SVG, and PDF
 * - Theme integration
 * - Collaborative editing support
 */

import { Plugin } from '@lokus/plugin-api'
import { MermaidNode } from './nodes/MermaidNode'
import { MermaidPreviewPanel } from './panels/MermaidPreviewPanel'
import { MermaidToolbar } from './toolbar/MermaidToolbar'
import { MermaidExporter } from './services/MermaidExporter'
import { MermaidThemeManager } from './services/MermaidThemeManager'
import { MermaidValidator } from './services/MermaidValidator'
import mermaid from 'mermaid'

export interface MermaidPluginConfig {
  theme: 'default' | 'dark' | 'forest' | 'neutral'
  autoPreview: boolean
  exportFormat: 'png' | 'svg' | 'pdf'
  maxWidth: number
  enableCollaboration: boolean
  syntaxHighlighting: boolean
}

export class MermaidPlugin extends Plugin<MermaidPluginConfig> {
  private exporter: MermaidExporter
  private themeManager: MermaidThemeManager
  private validator: MermaidValidator
  private previewPanel: MermaidPreviewPanel | null = null

  constructor() {
    super({
      id: 'mermaid-diagrams',
      name: 'Mermaid Diagrams',
      version: '1.2.0'
    })

    this.exporter = new MermaidExporter()
    this.themeManager = new MermaidThemeManager()
    this.validator = new MermaidValidator()
  }

  /**
   * Initialize the plugin
   */
  async activate(): Promise<void> {
    try {
      // Initialize Mermaid
      await this.initializeMermaid()

      // Register editor extensions
      this.registerEditorExtensions()

      // Register UI components
      this.registerUIComponents()

      // Register commands
      this.registerCommands()

      // Set up event listeners
      this.setupEventListeners()

      // Initialize theme integration
      await this.initializeThemeIntegration()

      console.log('Mermaid Diagrams plugin activated successfully')
    } catch (error) {
      console.error('Failed to activate Mermaid plugin:', error)
      throw error
    }
  }

  /**
   * Initialize Mermaid library
   */
  private async initializeMermaid(): Promise<void> {
    const config = await this.getConfig()
    
    mermaid.initialize({
      startOnLoad: false,
      theme: config.theme,
      themeVariables: this.themeManager.getThemeVariables(),
      maxWidth: config.maxWidth,
      fontFamily: 'inherit',
      fontSize: 16,
      darkMode: config.theme === 'dark',
      // Security settings
      securityLevel: 'strict',
      // Diagram-specific settings
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      },
      sequence: {
        useMaxWidth: true,
        wrap: true,
        width: 150,
        height: 65
      },
      gantt: {
        useMaxWidth: true,
        leftPadding: 75,
        gridLineStartPadding: 35
      }
    })
  }

  /**
   * Register editor extensions
   */
  private registerEditorExtensions(): void {
    // Register the Mermaid node
    this.api.editor.registerExtension(MermaidNode.configure({
      onUpdate: this.handleDiagramUpdate.bind(this),
      onValidate: this.validator.validate.bind(this.validator),
      autoPreview: this.config.autoPreview
    }))

    // Register slash commands
    this.api.editor.registerSlashCommand({
      name: 'mermaid',
      description: 'Insert Mermaid diagram',
      icon: 'diagram',
      keywords: ['diagram', 'flowchart', 'sequence', 'gantt'],
      command: ({ editor, range }) => {
        editor.chain()
          .focus()
          .deleteRange(range)
          .insertMermaidDiagram()
          .run()
      }
    })

    // Register input rules for quick diagram insertion
    this.api.editor.registerInputRule({
      find: /```mermaid$/,
      handler: ({ state, range, match }) => {
        const { tr } = state
        tr.replaceWith(range.from, range.to, 
          state.schema.nodes.mermaid.create({
            content: '',
            type: 'flowchart'
          })
        )
        return tr
      }
    })
  }

  /**
   * Register UI components
   */
  private registerUIComponents(): void {
    // Register preview panel
    this.previewPanel = new MermaidPreviewPanel({
      onExport: this.handleExport.bind(this),
      onThemeChange: this.handleThemeChange.bind(this)
    })

    this.api.ui.registerPanel({
      id: 'mermaid-preview',
      title: 'Mermaid Preview',
      icon: 'eye',
      position: 'right',
      component: this.previewPanel,
      defaultVisible: false
    })

    // Register toolbar
    const toolbar = new MermaidToolbar({
      onInsertDiagram: this.handleInsertDiagram.bind(this),
      onPreviewToggle: this.handlePreviewToggle.bind(this),
      onExport: this.handleExport.bind(this)
    })

    this.api.ui.registerToolbar({
      id: 'mermaid-toolbar',
      component: toolbar,
      position: 'editor',
      visible: 'when-mermaid-active'
    })
  }

  /**
   * Register commands
   */
  private registerCommands(): void {
    // Insert Mermaid diagram command
    this.api.commands.register({
      id: 'mermaid.insert',
      title: 'Insert Mermaid Diagram',
      description: 'Insert a new Mermaid diagram',
      icon: 'diagram',
      category: 'Mermaid',
      keybinding: 'Ctrl+Shift+M',
      handler: this.handleInsertDiagram.bind(this)
    })

    // Preview diagram command
    this.api.commands.register({
      id: 'mermaid.preview',
      title: 'Preview Diagram',
      description: 'Show/hide diagram preview',
      icon: 'eye',
      category: 'Mermaid',
      keybinding: 'Ctrl+Shift+P',
      handler: this.handlePreviewToggle.bind(this),
      when: 'mermaidDiagramActive'
    })

    // Export diagram command
    this.api.commands.register({
      id: 'mermaid.export',
      title: 'Export Diagram',
      description: 'Export diagram as image or PDF',
      icon: 'download',
      category: 'Mermaid',
      handler: this.handleExport.bind(this),
      when: 'mermaidDiagramActive'
    })

    // Change diagram type commands
    const diagramTypes = [
      { type: 'flowchart', title: 'Flowchart', icon: 'flowchart' },
      { type: 'sequence', title: 'Sequence Diagram', icon: 'sequence' },
      { type: 'gantt', title: 'Gantt Chart', icon: 'gantt' },
      { type: 'pie', title: 'Pie Chart', icon: 'pie' },
      { type: 'git', title: 'Git Graph', icon: 'git' },
      { type: 'erd', title: 'Entity Relationship', icon: 'database' }
    ]

    diagramTypes.forEach(({ type, title, icon }) => {
      this.api.commands.register({
        id: `mermaid.insert.${type}`,
        title: `Insert ${title}`,
        description: `Insert a new ${title.toLowerCase()}`,
        icon,
        category: 'Mermaid',
        handler: () => this.handleInsertDiagram(type)
      })
    })
  }

  /**
   * Set up event listeners
   */
  private setupEventListeners(): void {
    // Listen for editor selection changes
    this.api.editor.on('selection-change', ({ editor }) => {
      const isMermaidActive = editor.isActive('mermaid')
      this.updateUIState(isMermaidActive)
    })

    // Listen for theme changes
    this.api.theme.on('theme-changed', (theme) => {
      this.handleThemeChange(theme)
    })

    // Listen for configuration changes
    this.on('config-changed', (newConfig) => {
      this.handleConfigChange(newConfig)
    })

    // Listen for collaboration events
    if (this.config.enableCollaboration) {
      this.setupCollaborationListeners()
    }
  }

  /**
   * Initialize theme integration
   */
  private async initializeThemeIntegration(): Promise<void> {
    const currentTheme = await this.api.theme.getCurrentTheme()
    this.themeManager.setLokusTheme(currentTheme)
    
    // Update Mermaid theme based on Lokus theme
    const mermaidTheme = this.themeManager.getMermaidTheme()
    mermaid.initialize({
      theme: mermaidTheme,
      themeVariables: this.themeManager.getThemeVariables()
    })
  }

  /**
   * Handle diagram updates
   */
  private async handleDiagramUpdate(content: string, node: any): Promise<void> {
    if (!this.config.autoPreview) return

    try {
      // Validate diagram syntax
      const validation = await this.validator.validate(content)
      if (!validation.valid) {
        this.showValidationError(validation.errors)
        return
      }

      // Update preview if panel is visible
      if (this.previewPanel?.isVisible()) {
        await this.previewPanel.updateDiagram(content)
      }

      // Update node with validation status
      node.updateAttributes({
        valid: validation.valid,
        lastUpdated: Date.now()
      })

    } catch (error) {
      console.error('Error updating diagram:', error)
      this.showError('Failed to update diagram preview')
    }
  }

  /**
   * Handle insert diagram command
   */
  private handleInsertDiagram(type = 'flowchart'): void {
    const template = this.getTemplateForType(type)
    
    this.api.editor.chain()
      .focus()
      .insertMermaidDiagram({
        content: template,
        type
      })
      .run()

    // Show preview panel if auto-preview is enabled
    if (this.config.autoPreview && this.previewPanel) {
      this.previewPanel.show()
    }
  }

  /**
   * Handle preview toggle
   */
  private handlePreviewToggle(): void {
    if (!this.previewPanel) return

    if (this.previewPanel.isVisible()) {
      this.previewPanel.hide()
    } else {
      this.previewPanel.show()
      // Update with current diagram if available
      const currentDiagram = this.getCurrentDiagram()
      if (currentDiagram) {
        this.previewPanel.updateDiagram(currentDiagram.content)
      }
    }
  }

  /**
   * Handle export command
   */
  private async handleExport(format?: string): Promise<void> {
    const currentDiagram = this.getCurrentDiagram()
    if (!currentDiagram) {
      this.showError('No diagram to export')
      return
    }

    try {
      const exportFormat = format || this.config.exportFormat
      const filename = await this.promptForFilename(currentDiagram.type)
      
      await this.exporter.export(
        currentDiagram.content,
        exportFormat,
        filename,
        {
          theme: this.config.theme,
          maxWidth: this.config.maxWidth
        }
      )

      this.showSuccess(`Diagram exported as ${exportFormat.toUpperCase()}`)
    } catch (error) {
      console.error('Export failed:', error)
      this.showError('Failed to export diagram')
    }
  }

  /**
   * Handle theme changes
   */
  private async handleThemeChange(theme: any): Promise<void> {
    this.themeManager.setLokusTheme(theme)
    
    // Update Mermaid configuration
    const mermaidTheme = this.themeManager.getMermaidTheme()
    mermaid.initialize({
      theme: mermaidTheme,
      themeVariables: this.themeManager.getThemeVariables()
    })

    // Refresh all diagrams
    await this.refreshAllDiagrams()
  }

  /**
   * Handle configuration changes
   */
  private async handleConfigChange(newConfig: MermaidPluginConfig): Promise<void> {
    this.config = { ...this.config, ...newConfig }
    
    // Update Mermaid configuration
    await this.initializeMermaid()
    
    // Refresh diagrams if necessary
    if (newConfig.theme || newConfig.maxWidth) {
      await this.refreshAllDiagrams()
    }
  }

  /**
   * Setup collaboration listeners
   */
  private setupCollaborationListeners(): void {
    this.api.collaboration.on('remote-change', (change) => {
      if (change.type === 'mermaid-diagram') {
        this.handleRemoteDiagramChange(change)
      }
    })

    this.api.collaboration.on('cursor-activity', (activity) => {
      if (activity.node?.type === 'mermaid') {
        this.showCollaborativeCursor(activity)
      }
    })
  }

  /**
   * Get template for diagram type
   */
  private getTemplateForType(type: string): string {
    const templates = {
      flowchart: `graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D`,
      sequence: `sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello Bob, how are you?
    B-->>A: Great!`,
      gantt: `gantt
    title Project Timeline
    dateFormat  YYYY-MM-DD
    section Phase 1
    Task 1          :2024-01-01, 30d
    Task 2          :after task1, 20d`,
      pie: `pie title Sample Data
    "A" : 42.96
    "B" : 50.05
    "C" : 10.01`,
      git: `gitgraph
       commit
       branch develop
       commit
       commit
       checkout main
       commit
       merge develop`,
      erd: `erDiagram
    CUSTOMER {
        int id PK
        string name
        string email
    }
    ORDER {
        int id PK
        int customer_id FK
        date order_date
    }
    CUSTOMER ||--o{ ORDER : places`
    }

    return templates[type] || templates.flowchart
  }

  /**
   * Get current active diagram
   */
  private getCurrentDiagram(): { content: string; type: string } | null {
    const { editor } = this.api
    const { selection } = editor.state
    
    // Check if current selection is in a Mermaid node
    const node = editor.state.doc.nodeAt(selection.from)
    if (node?.type.name === 'mermaid') {
      return {
        content: node.attrs.content,
        type: node.attrs.type || 'flowchart'
      }
    }

    return null
  }

  /**
   * Update UI state based on context
   */
  private updateUIState(isMermaidActive: boolean): void {
    // Update toolbar visibility
    this.api.ui.setToolbarVisible('mermaid-toolbar', isMermaidActive)
    
    // Update command availability
    this.api.commands.setEnabled('mermaid.preview', isMermaidActive)
    this.api.commands.setEnabled('mermaid.export', isMermaidActive)
  }

  /**
   * Refresh all diagrams in the document
   */
  private async refreshAllDiagrams(): Promise<void> {
    const { editor } = this.api
    
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'mermaid') {
        // Trigger re-render by updating a timestamp
        editor.commands.updateAttributes('mermaid', {
          lastRendered: Date.now()
        })
      }
    })
  }

  /**
   * Show validation error
   */
  private showValidationError(errors: string[]): void {
    this.api.notifications.error({
      title: 'Mermaid Syntax Error',
      message: errors.join(', '),
      actions: [
        {
          label: 'View Documentation',
          action: () => this.openDocumentation()
        }
      ]
    })
  }

  /**
   * Prompt for export filename
   */
  private async promptForFilename(diagramType: string): Promise<string> {
    const defaultName = `diagram-${diagramType}-${Date.now()}`
    
    return await this.api.ui.prompt({
      title: 'Export Diagram',
      message: 'Enter filename (without extension):',
      defaultValue: defaultName,
      placeholder: 'my-diagram'
    })
  }

  /**
   * Show success message
   */
  private showSuccess(message: string): void {
    this.api.notifications.success({
      title: 'Mermaid Diagrams',
      message
    })
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    this.api.notifications.error({
      title: 'Mermaid Diagrams',
      message
    })
  }

  /**
   * Open documentation
   */
  private openDocumentation(): void {
    this.api.shell.openExternal('https://mermaid-js.github.io/mermaid/')
  }

  /**
   * Handle remote diagram changes (collaboration)
   */
  private handleRemoteDiagramChange(change: any): void {
    // Implement collaborative editing logic
    console.log('Remote diagram change:', change)
  }

  /**
   * Show collaborative cursor
   */
  private showCollaborativeCursor(activity: any): void {
    // Implement collaborative cursor display
    console.log('Collaborative cursor activity:', activity)
  }

  /**
   * Cleanup when plugin is deactivated
   */
  async deactivate(): Promise<void> {
    // Clean up resources
    this.previewPanel?.destroy()
    this.removeAllListeners()
    
    console.log('Mermaid Diagrams plugin deactivated')
  }
}

export default MermaidPlugin