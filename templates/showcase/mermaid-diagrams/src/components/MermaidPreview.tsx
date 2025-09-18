/**
 * Mermaid Preview Component
 * 
 * Renders Mermaid diagrams with:
 * - High-quality SVG rendering
 * - Interactive elements
 * - Zoom and pan capabilities
 * - Export functionality
 * - Error handling
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import mermaid from 'mermaid'
import { useTheme } from '@lokus/theme-system'
import './MermaidPreview.css'

export interface MermaidPreviewProps {
  content: string
  diagramType: string
  theme?: string
  maxWidth?: number
  maxHeight?: number
  interactive?: boolean
  zoomable?: boolean
  onRenderSuccess?: (svg: string) => void
  onRenderError?: (error: Error) => void
  onDoubleClick?: () => void
  onElementClick?: (elementId: string, element: Element) => void
}

const MermaidPreview: React.FC<MermaidPreviewProps> = ({
  content,
  diagramType,
  theme,
  maxWidth = 800,
  maxHeight = 600,
  interactive = true,
  zoomable = true,
  onRenderSuccess,
  onRenderError,
  onDoubleClick,
  onElementClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGElement | null>(null)
  const [isRendering, setIsRendering] = useState(false)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  
  const { theme: lokusTheme } = useTheme()

  /**
   * Generate unique ID for the diagram
   */
  const getDiagramId = useCallback(() => {
    return `mermaid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }, [])

  /**
   * Render the Mermaid diagram
   */
  const renderDiagram = useCallback(async () => {
    if (!content.trim() || !containerRef.current) return

    setIsRendering(true)
    setRenderError(null)

    try {
      const diagramId = getDiagramId()
      
      // Configure Mermaid for this render
      const mermaidTheme = theme || (lokusTheme.mode === 'dark' ? 'dark' : 'default')
      
      mermaid.initialize({
        startOnLoad: false,
        theme: mermaidTheme,
        maxWidth,
        fontFamily: getComputedStyle(document.documentElement).getPropertyValue('--font-family-sans') || 'sans-serif',
        fontSize: 14,
        securityLevel: 'strict',
        // Diagram-specific configurations
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
          curve: 'basis'
        },
        sequence: {
          useMaxWidth: true,
          showSequenceNumbers: true,
          wrap: true,
          width: 150,
          height: 65,
          boxMargin: 10,
          boxTextMargin: 5,
          noteMargin: 10,
          messageMargin: 35
        },
        gantt: {
          useMaxWidth: true,
          leftPadding: 75,
          gridLineStartPadding: 35,
          fontSize: 11,
          sectionFontSize: 24,
          numberSectionStyles: 4
        },
        pie: {
          useMaxWidth: true,
          textPosition: 0.75
        },
        git: {
          useMaxWidth: true,
          mainBranchName: 'main',
          showBranches: true,
          showCommitLabel: true
        },
        er: {
          useMaxWidth: true,
          fontSize: 12
        }
      })

      // Validate content before rendering
      await mermaid.parse(content)

      // Render the diagram
      const { svg } = await mermaid.render(diagramId, content)
      
      if (containerRef.current) {
        containerRef.current.innerHTML = svg
        
        const svgElement = containerRef.current.querySelector('svg')
        if (svgElement) {
          svgRef.current = svgElement
          
          // Set up SVG attributes
          svgElement.setAttribute('width', '100%')
          svgElement.setAttribute('height', 'auto')
          svgElement.style.maxWidth = `${maxWidth}px`
          svgElement.style.maxHeight = `${maxHeight}px`
          
          // Add zoom and pan functionality
          if (zoomable) {
            setupZoomAndPan(svgElement)
          }
          
          // Add click handlers for interactive elements
          if (interactive) {
            setupInteractivity(svgElement)
          }
          
          // Add accessibility attributes
          setupAccessibility(svgElement, diagramType)
          
          onRenderSuccess?.(svg)
        }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown rendering error'
      setRenderError(errorMessage)
      onRenderError?.(error instanceof Error ? error : new Error(errorMessage))
    } finally {
      setIsRendering(false)
    }
  }, [content, diagramType, theme, lokusTheme.mode, maxWidth, maxHeight, zoomable, interactive, onRenderSuccess, onRenderError])

  /**
   * Setup zoom and pan functionality
   */
  const setupZoomAndPan = (svgElement: SVGElement) => {
    // Mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      const newZoom = Math.max(0.1, Math.min(5, zoomLevel * delta))
      setZoomLevel(newZoom)
      
      // Apply transform
      applyTransform(svgElement, newZoom, panOffset)
    }

    // Mouse drag pan
    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // Only left mouse button
      setIsDragging(true)
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }
      setPanOffset(newOffset)
      applyTransform(svgElement, zoomLevel, newOffset)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    svgElement.addEventListener('wheel', handleWheel, { passive: false })
    svgElement.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    // Cleanup function
    return () => {
      svgElement.removeEventListener('wheel', handleWheel)
      svgElement.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }

  /**
   * Apply zoom and pan transform
   */
  const applyTransform = (svgElement: SVGElement, zoom: number, offset: { x: number; y: number }) => {
    const g = svgElement.querySelector('g')
    if (g) {
      g.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`
      g.style.transformOrigin = 'center'
    }
  }

  /**
   * Setup interactive click handlers
   */
  const setupInteractivity = (svgElement: SVGElement) => {
    // Add click handlers to interactive elements
    const clickableElements = svgElement.querySelectorAll('[data-id], .node, .edgeLabel, .actor')
    
    clickableElements.forEach(element => {
      element.addEventListener('click', (e) => {
        e.stopPropagation()
        const elementId = element.getAttribute('data-id') || element.id || 'unknown'
        onElementClick?.(elementId, element)
      })
      
      // Add hover effects
      element.addEventListener('mouseenter', () => {
        element.classList.add('hover')
      })
      
      element.addEventListener('mouseleave', () => {
        element.classList.remove('hover')
      })
    })
  }

  /**
   * Setup accessibility attributes
   */
  const setupAccessibility = (svgElement: SVGElement, type: string) => {
    svgElement.setAttribute('role', 'img')
    svgElement.setAttribute('aria-label', `${type} diagram`)
    
    // Add description based on content
    const description = generateAccessibilityDescription(content, type)
    if (description) {
      const desc = document.createElementNS('http://www.w3.org/2000/svg', 'desc')
      desc.textContent = description
      svgElement.insertBefore(desc, svgElement.firstChild)
    }
  }

  /**
   * Generate accessibility description
   */
  const generateAccessibilityDescription = (content: string, type: string): string => {
    const lines = content.split('\n').filter(line => line.trim())
    
    switch (type) {
      case 'flowchart':
        const nodes = lines.filter(line => line.includes('[') || line.includes('(') || line.includes('{'))
        const connections = lines.filter(line => line.includes('-->') || line.includes('-.->'))
        return `Flowchart with ${nodes.length} nodes and ${connections.length} connections`
      
      case 'sequence':
        const participants = lines.filter(line => line.includes('participant'))
        const messages = lines.filter(line => line.includes('->>') || line.includes('-->>'))
        return `Sequence diagram with ${participants.length} participants and ${messages.length} messages`
      
      case 'gantt':
        const sections = lines.filter(line => line.startsWith('section'))
        const tasks = lines.filter(line => line.includes(':'))
        return `Gantt chart with ${sections.length} sections and ${tasks.length} tasks`
      
      default:
        return `${type} diagram with ${lines.length} elements`
    }
  }

  /**
   * Reset zoom and pan
   */
  const resetView = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
    if (svgRef.current) {
      applyTransform(svgRef.current, 1, { x: 0, y: 0 })
    }
  }

  /**
   * Fit diagram to container
   */
  const fitToContainer = () => {
    if (!svgRef.current || !containerRef.current) return
    
    const svgBounds = svgRef.current.getBBox()
    const containerBounds = containerRef.current.getBoundingClientRect()
    
    const scaleX = containerBounds.width / svgBounds.width
    const scaleY = containerBounds.height / svgBounds.height
    const scale = Math.min(scaleX, scaleY, 1) * 0.9 // Add 10% padding
    
    setZoomLevel(scale)
    setPanOffset({ x: 0, y: 0 })
    applyTransform(svgRef.current, scale, { x: 0, y: 0 })
  }

  // Re-render when content or theme changes
  useEffect(() => {
    renderDiagram()
  }, [renderDiagram])

  // Handle double-click for editing
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    if (onDoubleClick && !isDragging) {
      onDoubleClick()
    }
  }, [onDoubleClick, isDragging])

  return (
    <div className="mermaid-preview">
      {/* Controls */}
      {zoomable && (
        <div className="mermaid-preview__controls">
          <button 
            className="control-btn"
            onClick={() => setZoomLevel(Math.min(5, zoomLevel * 1.2))}
            title="Zoom in"
          >
            🔍+
          </button>
          <button 
            className="control-btn"
            onClick={() => setZoomLevel(Math.max(0.1, zoomLevel * 0.8))}
            title="Zoom out"
          >
            🔍-
          </button>
          <button 
            className="control-btn"
            onClick={resetView}
            title="Reset view"
          >
            ⌂
          </button>
          <button 
            className="control-btn"
            onClick={fitToContainer}
            title="Fit to container"
          >
            ⛶
          </button>
          <span className="zoom-level">
            {Math.round(zoomLevel * 100)}%
          </span>
        </div>
      )}

      {/* Diagram container */}
      <div 
        ref={containerRef}
        className={`mermaid-preview__content ${isRendering ? 'rendering' : ''} ${renderError ? 'error' : ''}`}
        onDoubleClick={handleDoubleClick}
        style={{
          cursor: isDragging ? 'grabbing' : zoomable ? 'grab' : 'default'
        }}
      />

      {/* Loading state */}
      {isRendering && (
        <div className="mermaid-preview__loading">
          <div className="loading-spinner"></div>
          <span>Rendering diagram...</span>
        </div>
      )}

      {/* Error state */}
      {renderError && (
        <div className="mermaid-preview__error">
          <div className="error-icon">⚠️</div>
          <div className="error-message">
            <strong>Rendering Error:</strong>
            <br />
            {renderError}
          </div>
          <button 
            className="error-retry-btn"
            onClick={renderDiagram}
          >
            Retry
          </button>
        </div>
      )}

      {/* Instructions */}
      {!content.trim() && (
        <div className="mermaid-preview__empty">
          <div className="empty-icon">📊</div>
          <div className="empty-message">
            Add diagram content to see preview
          </div>
        </div>
      )}
    </div>
  )
}

export default MermaidPreview