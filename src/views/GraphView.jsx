import React, { useEffect, useRef, useState } from 'react'
import { buildWorkspaceGraph } from '@/core/wiki/graph.js'

export default function GraphView({ workspacePath, onOpenFile }) {
  const [graph, setGraph] = useState({ nodes: [], edges: [] })
  const [selectedNode, setSelectedNode] = useState(null)
  const [isDarkMode, setIsDarkMode] = useState(true)
  const [loading, setLoading] = useState(true)
  const [nodePositions, setNodePositions] = useState(new Map())
  const canvasRef = useRef(null)
  const viewRef = useRef({ scale: 1, tx: 0, ty: 0, dragging: false, dragNode: null, lastX: 0, lastY: 0 })
  const hoverRef = useRef({ id: null })
  const animationRef = useRef(null)

  // Simple circle layout function
  const createLayout = (nodes, edges, width = 1200, height = 800) => {
    const positions = new Map()
    const centerX = width / 2, centerY = height / 2
    
    if (nodes.length === 0) return positions
    if (nodes.length === 1) {
      positions.set(nodes[0].id, { x: centerX, y: centerY })
      return positions
    }
    
    // Simple circular layout - works instantly
    const radius = Math.min(width, height) * 0.35
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI
      positions.set(node.id, {
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      })
    })
    
    return positions
  }

  useEffect(() => {
    let mounted = true
    setLoading(true)
    
    buildWorkspaceGraph(workspacePath)
      .then(g => { 
        if (mounted) {
          setGraph(g)
          // Create layout immediately - no physics needed
          const canvas = canvasRef.current
          const w = canvas?.clientWidth || 1200
          const h = canvas?.clientHeight || 800
          const positions = createLayout(g.nodes, g.edges, w, h)
          setNodePositions(positions)
          setLoading(false)
        }
      })
      .catch(e => {
        console.error('[GraphView] Failed to build graph:', e)
        if (mounted) setLoading(false)
      })
    
    return () => { mounted = false }
  }, [workspacePath])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw(w, h)
    }


    const draw = (w, h) => {
      const v = viewRef.current
      
      // Clear canvas with dark background
      const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff'
      ctx.fillStyle = bgColor
      ctx.fillRect(0, 0, w, h)
      
      // Early return if no nodes
      if (graph.nodes.length === 0) return
      
      // Use our simple static positions
      const pos = new Map()
      for (const n of graph.nodes) {
        const staticPos = nodePositions.get(n.id)
        if (staticPos) {
          pos.set(n.id, { 
            x: staticPos.x * v.scale + v.tx, 
            y: staticPos.y * v.scale + v.ty 
          })
        }
      }
      
      // Get connection counts for node sizing
      const connections = new Map()
      graph.nodes.forEach(n => connections.set(n.id, 0))
      graph.edges.forEach(e => {
        connections.set(e.source, (connections.get(e.source) || 0) + 1)
        connections.set(e.target, (connections.get(e.target) || 0) + 1)
      })
      
      const hover = hoverRef.current.id
      const selected = selectedNode
      const neighbors = new Set()
      const connectedEdges = new Set()
      
      // Find neighbors of hovered/selected node
      if (hover || selected) {
        const activeNode = hover || selected
        for (const e of graph.edges) {
          if (e.source === activeNode) {
            neighbors.add(e.target)
            connectedEdges.add(`${e.source}-${e.target}`)
          }
          if (e.target === activeNode) {
            neighbors.add(e.source)
            connectedEdges.add(`${e.source}-${e.target}`)
          }
        }
      }
      
      // Draw edges
      ctx.lineCap = 'round'
      for (const e of graph.edges) {
        const s = pos.get(e.source)
        const t = pos.get(e.target)
        if (!s || !t) continue
        
        const edgeKey = `${e.source}-${e.target}`
        const isConnected = connectedEdges.has(edgeKey)
        const isHighlighted = isConnected || (!hover && !selected)
        
        if (isHighlighted) {
          ctx.strokeStyle = isDarkMode ? 'rgba(147, 197, 253, 0.6)' : 'rgba(59, 130, 246, 0.6)'
          ctx.lineWidth = 2
        } else {
          ctx.strokeStyle = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(156, 163, 175, 0.3)'
          ctx.lineWidth = 1
        }
        
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(t.x, t.y)
        ctx.stroke()
      }
      
      // Draw nodes
      for (const n of graph.nodes) {
        const p = pos.get(n.id)
        if (!p) continue
        
        const isHover = n.id === hover
        const isSelected = n.id === selected
        const isNeighbor = neighbors.has(n.id)
        const connectionCount = connections.get(n.id) || 0
        
        // Node size based on connections
        let radius = Math.max(6, Math.min(12, 6 + connectionCount * 0.5))
        if (isHover || isSelected) radius *= 1.2
        
        // Node colors
        let fillColor, strokeColor
        if (isHover) {
          fillColor = isDarkMode ? '#60a5fa' : '#3b82f6'
          strokeColor = isDarkMode ? '#93c5fd' : '#1d4ed8'
        } else if (isSelected) {
          fillColor = isDarkMode ? '#a855f7' : '#8b5cf6'
          strokeColor = isDarkMode ? '#c084fc' : '#7c3aed'
        } else if (isNeighbor) {
          fillColor = isDarkMode ? '#34d399' : '#10b981'
          strokeColor = isDarkMode ? '#6ee7b7' : '#047857'
        } else {
          fillColor = isDarkMode ? '#6b7280' : '#9ca3af'
          strokeColor = isDarkMode ? '#9ca3af' : '#6b7280'
        }
        
        // Draw node
        ctx.fillStyle = fillColor
        ctx.strokeStyle = strokeColor
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
      
      // Draw labels
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
      
      for (const n of graph.nodes) {
        const p = pos.get(n.id)
        if (!p) continue
        
        const isHover = n.id === hover
        const isSelected = n.id === selected
        const isNeighbor = neighbors.has(n.id)
        const shouldShowLabel = true // Always show labels for simplicity
        
        if (shouldShowLabel) {
          const title = n.title.replace(/\.(md|markdown)$/i, '') || 'Untitled'
          const connectionCount = connections.get(n.id) || 0
          const yOffset = Math.max(6, Math.min(12, 6 + connectionCount * 0.5)) + 12
          
          // Text with shadow for readability
          ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'
          ctx.fillText(title, p.x + 1, p.y + yOffset + 1)
          
          ctx.fillStyle = isDarkMode ? '#f1f5f9' : '#1e293b'
          if (isHover || isSelected) {
            ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000'
          }
          ctx.fillText(title, p.x, p.y + yOffset)
        }
      }
      // Enhanced click handler with selection
      const onClick = (e) => {
        const r = canvas.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top
        let best = null, dmin = 1e9
        for (const n of graph.nodes) {
          const p = pos.get(n.id); if (!p) continue
          const connectionCount = connections.get(n.id) || 0
          const radius = Math.max(4, Math.min(12, 4 + connectionCount * 0.8)) * v.scale
          const d = Math.hypot(p.x - x, p.y - y)
          if (d < dmin) { dmin = d; best = n }
        }
        const clickRadius = 20 * v.scale
        if (best && dmin < clickRadius) {
          if (e.detail === 2 && onOpenFile) { // Double click to open
            onOpenFile(best.path)
          } else { // Single click to select
            setSelectedNode(selectedNode === best.id ? null : best.id)
          }
        } else {
          setSelectedNode(null) // Click on empty space deselects
        }
      }
      const onWheel = (e) => {
        e.preventDefault()
        const delta = e.deltaY < 0 ? 1.1 : 0.9
        const v2 = viewRef.current
        v2.scale = Math.max(0.4, Math.min(2.5, v2.scale * delta))
        draw(canvas.clientWidth, canvas.clientHeight)
      }
      const onDown = (e) => {
        const r = canvas.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top
        const v2 = viewRef.current
        
        // Check if clicking on a node (using current positions)
        let clickedNode = null
        let dmin = 1e9
        for (const n of graph.nodes) {
          const staticPos = nodePositions.get(n.id)
          if (!staticPos) continue
          const p = { 
            x: staticPos.x * v2.scale + v2.tx, 
            y: staticPos.y * v2.scale + v2.ty 
          }
          const d = Math.hypot(p.x - x, p.y - y)
          if (d < 20 && d < dmin) { dmin = d; clickedNode = n.id }
        }
        
        if (clickedNode) {
          v2.dragNode = clickedNode
        } else {
          v2.dragging = true
        }
        
        v2.lastX = e.clientX
        v2.lastY = e.clientY
      }
      
      const onMove = (e) => {
        const v2 = viewRef.current
        const dx = e.clientX - v2.lastX, dy = e.clientY - v2.lastY
        v2.lastX = e.clientX; v2.lastY = e.clientY
        
        if (v2.dragNode) {
          // Drag node - update its static position
          const currentPos = nodePositions.get(v2.dragNode)
          if (currentPos) {
            const newPos = {
              x: currentPos.x + dx / v2.scale,
              y: currentPos.y + dy / v2.scale
            }
            setNodePositions(prev => new Map(prev).set(v2.dragNode, newPos))
          }
        } else if (v2.dragging) {
          // Pan view
          v2.tx += dx
          v2.ty += dy
        }
        
        draw(canvas.clientWidth, canvas.clientHeight)
      }
      
      const onUp = () => {
        const v2 = viewRef.current
        v2.dragNode = null
        v2.dragging = false
      }
      const onHover = (e) => {
        const r = canvas.getBoundingClientRect()
        const x = e.clientX - r.left, y = e.clientY - r.top
        const v2 = viewRef.current
        let best = null, dmin = 1e9
        
        for (const n of graph.nodes) {
          const staticPos = nodePositions.get(n.id)
          if (!staticPos) continue
          const p = { 
            x: staticPos.x * v2.scale + v2.tx, 
            y: staticPos.y * v2.scale + v2.ty 
          }
          const d = Math.hypot(p.x - x, p.y - y)
          if (d < dmin) { dmin = d; best = n.id }
        }
        
        const prevHover = hoverRef.current.id
        hoverRef.current.id = dmin < 20 ? best : null
        
        // Only redraw if hover changed
        if (prevHover !== hoverRef.current.id) {
          draw(canvas.clientWidth, canvas.clientHeight)
        }
      }
      canvas.addEventListener('click', onClick)
      canvas.addEventListener('wheel', onWheel, { passive: false })
      canvas.addEventListener('mousedown', onDown)
      canvas.addEventListener('mousemove', onHover)
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
      return () => {
        canvas.removeEventListener('click', onClick)
        canvas.removeEventListener('wheel', onWheel)
        canvas.removeEventListener('mousedown', onDown)
        canvas.removeEventListener('mousemove', onHover)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
    }
    const cleanup = resize()
    window.addEventListener('resize', resize)
    
    return () => { 
      window.removeEventListener('resize', resize)
      if (cleanup) cleanup()
    }
  }, [graph.nodes.length, isDarkMode, selectedNode]) // Only depend on length, not the whole nodePositions map

  // Redraw when positions change (without causing infinite loop)
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas && nodePositions.size > 0) {
      const ctx = canvas.getContext('2d')
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      
      // Simple redraw without recreating positions
      const draw = (w, h) => {
        const v = viewRef.current
        
        // Clear canvas
        const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff'
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, w, h)
        
        if (graph.nodes.length === 0) return
        
        // Get current positions
        const pos = new Map()
        for (const n of graph.nodes) {
          const staticPos = nodePositions.get(n.id)
          if (staticPos) {
            pos.set(n.id, { 
              x: staticPos.x * v.scale + v.tx, 
              y: staticPos.y * v.scale + v.ty 
            })
          }
        }
        
        // Get connection counts
        const connections = new Map()
        graph.nodes.forEach(n => connections.set(n.id, 0))
        graph.edges.forEach(e => {
          connections.set(e.source, (connections.get(e.source) || 0) + 1)
          connections.set(e.target, (connections.get(e.target) || 0) + 1)
        })
        
        const hover = hoverRef.current.id
        const selected = selectedNode
        const neighbors = new Set()
        const connectedEdges = new Set()
        
        if (hover || selected) {
          const activeNode = hover || selected
          for (const e of graph.edges) {
            if (e.source === activeNode) {
              neighbors.add(e.target)
              connectedEdges.add(`${e.source}-${e.target}`)
            }
            if (e.target === activeNode) {
              neighbors.add(e.source)
              connectedEdges.add(`${e.source}-${e.target}`)
            }
          }
        }
        
        // Draw edges
        ctx.lineCap = 'round'
        for (const e of graph.edges) {
          const s = pos.get(e.source)
          const t = pos.get(e.target)
          if (!s || !t) continue
          
          const edgeKey = `${e.source}-${e.target}`
          const isConnected = connectedEdges.has(edgeKey)
          const isHighlighted = isConnected || (!hover && !selected)
          
          if (isHighlighted) {
            ctx.strokeStyle = isDarkMode ? 'rgba(147, 197, 253, 0.6)' : 'rgba(59, 130, 246, 0.6)'
            ctx.lineWidth = 2
          } else {
            ctx.strokeStyle = isDarkMode ? 'rgba(75, 85, 99, 0.3)' : 'rgba(156, 163, 175, 0.3)'
            ctx.lineWidth = 1
          }
          
          ctx.beginPath()
          ctx.moveTo(s.x, s.y)
          ctx.lineTo(t.x, t.y)
          ctx.stroke()
        }
        
        // Draw nodes
        for (const n of graph.nodes) {
          const p = pos.get(n.id)
          if (!p) continue
          
          const isHover = n.id === hover
          const isSelected = n.id === selected
          const isNeighbor = neighbors.has(n.id)
          const connectionCount = connections.get(n.id) || 0
          
          let radius = Math.max(6, Math.min(12, 6 + connectionCount * 0.5))
          if (isHover || isSelected) radius *= 1.2
          
          let fillColor, strokeColor
          if (isHover) {
            fillColor = isDarkMode ? '#60a5fa' : '#3b82f6'
            strokeColor = isDarkMode ? '#93c5fd' : '#1d4ed8'
          } else if (isSelected) {
            fillColor = isDarkMode ? '#a855f7' : '#8b5cf6'
            strokeColor = isDarkMode ? '#c084fc' : '#7c3aed'
          } else if (isNeighbor) {
            fillColor = isDarkMode ? '#34d399' : '#10b981'
            strokeColor = isDarkMode ? '#6ee7b7' : '#047857'
          } else {
            fillColor = isDarkMode ? '#6b7280' : '#9ca3af'
            strokeColor = isDarkMode ? '#9ca3af' : '#6b7280'
          }
          
          ctx.fillStyle = fillColor
          ctx.strokeStyle = strokeColor
          ctx.lineWidth = 1.5
          ctx.beginPath()
          ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
        
        // Draw labels
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif'
        
        for (const n of graph.nodes) {
          const p = pos.get(n.id)
          if (!p) continue
          
          const title = n.title.replace(/\.(md|markdown)$/i, '') || 'Untitled'
          const connectionCount = connections.get(n.id) || 0
          const yOffset = Math.max(6, Math.min(12, 6 + connectionCount * 0.5)) + 12
          
          ctx.fillStyle = isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.7)'
          ctx.fillText(title, p.x + 1, p.y + yOffset + 1)
          
          const isHover = n.id === hover
          const isSelected = n.id === selected
          ctx.fillStyle = isDarkMode ? '#f1f5f9' : '#1e293b'
          if (isHover || isSelected) {
            ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000'
          }
          ctx.fillText(title, p.x, p.y + yOffset)
        }
      }
      
      draw(w, h)
    }
  }, [nodePositions, selectedNode, isDarkMode, graph.nodes, graph.edges])

  return (
    <div className="relative w-full h-[calc(100vh-140px)] md:h-[calc(100vh-156px)]" style={{backgroundColor: isDarkMode ? '#1a1a1a' : '#ffffff'}}>
      <canvas ref={canvasRef} className="w-full h-full block" />
      
      {/* Loading state */}
      {loading && (
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{backgroundColor: isDarkMode ? 'rgba(26, 26, 26, 0.8)' : 'rgba(255, 255, 255, 0.8)'}}
        >
          <div className="text-center">
            <div 
              className="w-8 h-8 border-2 rounded-full animate-spin mb-4 mx-auto"
              style={{
                borderColor: isDarkMode ? '#374151' : '#d1d5db',
                borderTopColor: isDarkMode ? '#60a5fa' : '#3b82f6'
              }}
            />
            <div 
              className="text-sm font-medium"
              style={{color: isDarkMode ? '#f1f5f9' : '#1e293b'}}
            >
              Building graph...
            </div>
          </div>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && graph.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div 
              className="text-6xl mb-4"
              style={{color: isDarkMode ? '#4b5563' : '#9ca3af'}}
            >
              📊
            </div>
            <div 
              className="text-lg font-medium mb-2"
              style={{color: isDarkMode ? '#9ca3af' : '#6b7280'}}
            >
              No graph to display
            </div>
            <div 
              className="text-sm"
              style={{color: isDarkMode ? '#6b7280' : '#9ca3af'}}
            >
              Create some files with [[wiki links]] to see the graph
            </div>
          </div>
        </div>
      )}
      
      {/* Obsidian-style controls */}
      <div className="absolute right-4 top-4 flex flex-col gap-2">
        <button 
          className="w-10 h-10 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 flex items-center justify-center text-lg font-medium"
          style={{
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
          }}
          onClick={() => { viewRef.current.scale = Math.min(2.5, viewRef.current.scale * 1.2); }}
        >
          +
        </button>
        <button 
          className="w-10 h-10 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-110 flex items-center justify-center text-lg font-medium"
          style={{
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
          }}
          onClick={() => { viewRef.current.scale = Math.max(0.4, viewRef.current.scale / 1.2); }}
        >
          −
        </button>
        <button 
          className="px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 text-sm font-medium"
          style={{
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
          }}
          onClick={() => { 
            const centerX = canvasRef.current.clientWidth / 2
            const centerY = canvasRef.current.clientHeight / 2
            viewRef.current.tx = centerX - (graph.nodes.length > 0 ? 0 : centerX)
            viewRef.current.ty = centerY - (graph.nodes.length > 0 ? 0 : centerY)
            viewRef.current.scale = 1
          }}
        >
          Reset
        </button>
        <button 
          className="px-3 py-2 rounded-lg shadow-lg backdrop-blur-sm transition-all duration-200 hover:scale-105 text-sm font-medium"
          style={{
            backgroundColor: isDarkMode ? 'rgba(55, 65, 81, 0.8)' : 'rgba(255, 255, 255, 0.8)',
            color: isDarkMode ? '#f1f5f9' : '#1e293b',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
          }}
          onClick={() => setIsDarkMode(!isDarkMode)}
        >
          {isDarkMode ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Node info tooltip */}
      {selectedNode && (
        <div 
          className="absolute left-4 bottom-4 p-4 rounded-lg shadow-lg backdrop-blur-sm max-w-sm"
          style={{
            backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
          }}
        >
          {(() => {
            const node = graph.nodes.find(n => n.id === selectedNode)
            const connectionCount = graph.edges.filter(e => e.source === selectedNode || e.target === selectedNode).length
            return (
              <div style={{color: isDarkMode ? '#f1f5f9' : '#1e293b'}}>
                <h3 className="font-semibold text-lg mb-2">{node?.title?.replace(/\.(md|markdown)$/i, '')}</h3>
                <p className="text-sm opacity-75 mb-2">{connectionCount} connection{connectionCount !== 1 ? 's' : ''}</p>
                <p className="text-xs opacity-50">{node?.path}</p>
                <div className="mt-3 text-xs opacity-75">
                  Double-click to open • Drag to move
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Graph stats */}
      <div 
        className="absolute left-4 top-4 p-3 rounded-lg shadow-lg backdrop-blur-sm"
        style={{
          backgroundColor: isDarkMode ? 'rgba(31, 41, 55, 0.8)' : 'rgba(255, 255, 255, 0.8)',
          border: `1px solid ${isDarkMode ? 'rgba(75, 85, 99, 0.5)' : 'rgba(203, 213, 225, 0.5)'}`
        }}
      >
        <div className="text-sm font-medium" style={{color: isDarkMode ? '#f1f5f9' : '#1e293b'}}>
          {graph.nodes.length} notes • {graph.edges.length} links
        </div>
      </div>
    </div>
  )
}
