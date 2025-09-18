/**
 * Mermaid Node for TipTap Editor
 * 
 * A sophisticated editor node that provides:
 * - Syntax-highlighted code editing
 * - Live diagram preview
 * - Error handling and validation
 * - Multiple diagram type support
 * - Export capabilities
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react'
import { NodeViewProps } from '@tiptap/core'
import mermaid from 'mermaid'
import { MermaidEditor } from '../components/MermaidEditor'
import { MermaidPreview } from '../components/MermaidPreview'
import { MermaidToolbar } from '../components/MermaidToolbar'
import { useMermaidValidator } from '../hooks/useMermaidValidator'
import { useMermaidRenderer } from '../hooks/useMermaidRenderer'
import './MermaidNode.css'

export interface MermaidOptions {
  HTMLAttributes: Record<string, any>
  onUpdate?: (content: string, node: any) => void
  onValidate?: (content: string) => Promise<{ valid: boolean; errors: string[] }>
  autoPreview?: boolean
  enableToolbar?: boolean
  allowedTypes?: string[]
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      insertMermaidDiagram: (attributes?: { content?: string; type?: string }) => ReturnType
    }
  }
}

/**
 * Mermaid Node View Component
 */
const MermaidNodeView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  deleteNode,
  selected,
  extension
}) => {
  const [isEditing, setIsEditing] = useState(!node.attrs.content)
  const [content, setContent] = useState(node.attrs.content || '')
  const [diagramType, setDiagramType] = useState(node.attrs.type || 'flowchart')
  const [isPreviewVisible, setIsPreviewVisible] = useState(node.attrs.showPreview !== false)
  const [isToolbarVisible, setIsToolbarVisible] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<any>(null)
  
  // Custom hooks for validation and rendering
  const { validate, validation, isValidating } = useMermaidValidator()
  const { renderDiagram, isRendering, renderError } = useMermaidRenderer()

  // Get options from extension
  const options = extension.options as MermaidOptions

  /**
   * Handle content changes
   */
  const handleContentChange = useCallback(async (newContent: string) => {
    setContent(newContent)
    
    // Update node attributes
    updateAttributes({
      content: newContent,
      lastModified: Date.now()
    })

    // Validate content
    if (newContent.trim()) {
      await validate(newContent)
    }

    // Notify parent component
    if (options.onUpdate) {
      options.onUpdate(newContent, { updateAttributes, deleteNode })
    }
  }, [updateAttributes, deleteNode, options, validate])

  /**
   * Handle diagram type changes
   */
  const handleTypeChange = useCallback((newType: string) => {
    setDiagramType(newType)
    updateAttributes({
      type: newType,
      lastModified: Date.now()
    })
  }, [updateAttributes])

  /**
   * Toggle editing mode
   */
  const toggleEditing = useCallback(() => {
    setIsEditing(!isEditing)
    
    // Focus editor when entering edit mode
    if (!isEditing && editorRef.current) {
      setTimeout(() => editorRef.current?.focus(), 100)
    }
  }, [isEditing])

  /**
   * Toggle preview visibility
   */
  const togglePreview = useCallback(() => {
    const newVisibility = !isPreviewVisible
    setIsPreviewVisible(newVisibility)
    updateAttributes({
      showPreview: newVisibility,
      lastModified: Date.now()
    })
  }, [isPreviewVisible, updateAttributes])

  /**
   * Handle export
   */
  const handleExport = useCallback(async (format: 'png' | 'svg' | 'pdf' = 'png') => {
    if (!content.trim()) return

    try {
      // Get the rendered SVG
      const element = containerRef.current?.querySelector('.mermaid-preview svg')
      if (!element) {
        throw new Error('No diagram to export')
      }

      // Use the MermaidExporter service
      const { MermaidExporter } = await import('../services/MermaidExporter')
      const exporter = new MermaidExporter()
      
      await exporter.exportElement(element as SVGElement, format, {
        filename: `diagram-${diagramType}-${Date.now()}`,
        theme: node.attrs.theme || 'default'
      })

    } catch (error) {
      console.error('Export failed:', error)
      // Show error notification
    }
  }, [content, diagramType, node.attrs.theme])

  /**
   * Handle delete
   */
  const handleDelete = useCallback(() => {
    deleteNode()
  }, [deleteNode])

  /**
   * Effect to sync with node attributes
   */
  useEffect(() => {
    if (node.attrs.content !== content) {
      setContent(node.attrs.content || '')
    }
    if (node.attrs.type !== diagramType) {
      setDiagramType(node.attrs.type || 'flowchart')
    }
  }, [node.attrs.content, node.attrs.type])

  /**
   * Effect to handle auto-preview
   */
  useEffect(() => {
    if (options.autoPreview && content.trim() && !isEditing) {
      setIsPreviewVisible(true)
    }
  }, [content, isEditing, options.autoPreview])

  /**
   * Effect to show toolbar on selection
   */
  useEffect(() => {
    setIsToolbarVisible(selected && options.enableToolbar !== false)
  }, [selected, options.enableToolbar])

  return (
    <NodeViewWrapper
      className={`mermaid-node ${selected ? 'selected' : ''} ${isEditing ? 'editing' : ''}`}
      ref={containerRef}
    >
      {/* Toolbar */}
      {isToolbarVisible && (
        <MermaidToolbar
          diagramType={diagramType}
          onTypeChange={handleTypeChange}
          onToggleEdit={toggleEditing}
          onTogglePreview={togglePreview}
          onExport={handleExport}
          onDelete={handleDelete}
          isEditing={isEditing}
          isPreviewVisible={isPreviewVisible}
          allowedTypes={options.allowedTypes}
        />
      )}

      <div className="mermaid-node__content">
        {/* Editor */}
        {isEditing && (
          <div className="mermaid-node__editor">
            <MermaidEditor
              ref={editorRef}
              content={content}
              diagramType={diagramType}
              onChange={handleContentChange}
              validation={validation}
              isValidating={isValidating}
              placeholder={`Enter ${diagramType} diagram code...`}
            />
            
            {/* Validation feedback */}
            {validation && !validation.valid && (
              <div className="mermaid-node__validation-errors">
                <div className="validation-errors__header">
                  <span className="validation-errors__icon">⚠️</span>
                  <span className="validation-errors__title">Syntax Errors</span>
                </div>
                <ul className="validation-errors__list">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="validation-errors__item">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Preview */}
        {isPreviewVisible && !isEditing && content.trim() && (
          <div className="mermaid-node__preview">
            <MermaidPreview
              content={content}
              diagramType={diagramType}
              theme={node.attrs.theme}
              onRenderError={(error) => console.error('Render error:', error)}
              onDoubleClick={toggleEditing}
            />
          </div>
        )}

        {/* Empty state */}
        {!content.trim() && !isEditing && (
          <div className="mermaid-node__empty" onClick={toggleEditing}>
            <div className="mermaid-node__empty-icon">📊</div>
            <div className="mermaid-node__empty-text">
              Click to add a {diagramType} diagram
            </div>
          </div>
        )}

        {/* Loading state */}
        {(isValidating || isRendering) && (
          <div className="mermaid-node__loading">
            <div className="loading-spinner"></div>
            <span>
              {isValidating ? 'Validating...' : 'Rendering...'}
            </span>
          </div>
        )}

        {/* Render error */}
        {renderError && (
          <div className="mermaid-node__error">
            <div className="error-icon">❌</div>
            <div className="error-message">
              Failed to render diagram: {renderError}
            </div>
            <button 
              className="error-retry-btn"
              onClick={() => renderDiagram(content, diagramType)}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Resize handle (for future enhancement) */}
      <div className="mermaid-node__resize-handle" />
    </NodeViewWrapper>
  )
}

/**
 * Mermaid Node Extension
 */
export const MermaidNode = Node.create<MermaidOptions>({
  name: 'mermaid',

  addOptions() {
    return {
      HTMLAttributes: {},
      autoPreview: true,
      enableToolbar: true,
      allowedTypes: [
        'flowchart',
        'sequence',
        'gantt',
        'pie',
        'git',
        'erd',
        'journey',
        'requirement',
        'state',
        'class'
      ]
    }
  },

  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: {
        default: '',
        parseHTML: element => element.getAttribute('data-content') || '',
        renderHTML: attributes => {
          if (!attributes.content) return {}
          return { 'data-content': attributes.content }
        },
      },
      type: {
        default: 'flowchart',
        parseHTML: element => element.getAttribute('data-type') || 'flowchart',
        renderHTML: attributes => {
          return { 'data-type': attributes.type }
        },
      },
      theme: {
        default: 'default',
        parseHTML: element => element.getAttribute('data-theme') || 'default',
        renderHTML: attributes => {
          return { 'data-theme': attributes.theme }
        },
      },
      showPreview: {
        default: true,
        parseHTML: element => element.getAttribute('data-show-preview') !== 'false',
        renderHTML: attributes => {
          return { 'data-show-preview': attributes.showPreview.toString() }
        },
      },
      lastModified: {
        default: Date.now(),
        parseHTML: element => parseInt(element.getAttribute('data-last-modified') || '0'),
        renderHTML: attributes => {
          return { 'data-last-modified': attributes.lastModified.toString() }
        },
      },
      valid: {
        default: true,
        parseHTML: element => element.getAttribute('data-valid') !== 'false',
        renderHTML: attributes => {
          return { 'data-valid': attributes.valid.toString() }
        },
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
      {
        tag: 'pre[class*="language-mermaid"]',
        getAttrs: element => {
          const content = element.textContent || ''
          return { content }
        }
      },
      {
        tag: 'code[class*="language-mermaid"]',
        getAttrs: element => {
          const content = element.textContent || ''
          return { content }
        }
      }
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mermaid',
        'data-content': node.attrs.content,
        'data-diagram-type': node.attrs.type,
        'data-theme': node.attrs.theme,
        'data-show-preview': node.attrs.showPreview.toString(),
        'data-last-modified': node.attrs.lastModified.toString(),
        'data-valid': node.attrs.valid.toString(),
      }),
      0
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView)
  },

  addCommands() {
    return {
      insertMermaidDiagram: (attributes = {}) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            content: attributes.content || '',
            type: attributes.type || 'flowchart',
            showPreview: true,
            lastModified: Date.now(),
            valid: true,
            ...attributes
          },
        })
      },
    }
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-m': () => this.editor.commands.insertMermaidDiagram(),
      'Escape': ({ editor }) => {
        // Exit editing mode when escape is pressed
        const { selection } = editor.state
        const node = editor.state.doc.nodeAt(selection.from)
        if (node?.type.name === this.name) {
          // This would need to communicate with the NodeView
          // Implementation depends on your state management approach
          return true
        }
        return false
      }
    }
  },

  addInputRules() {
    return [
      // Rule for ```mermaid code blocks
      {
        find: /^```mermaid\s+$/,
        handler: ({ state, range }) => {
          const { tr } = state
          tr.replaceWith(
            range.from - 1,
            range.to,
            this.type.create({
              content: '',
              type: 'flowchart'
            })
          )
          return tr
        }
      }
    ]
  },

  addProseMirrorPlugins() {
    return [
      // Add custom plugins for enhanced functionality
      // e.g., collaboration, auto-save, etc.
    ]
  }
})

export default MermaidNode