import React, { useEffect, useRef, useState, useCallback } from 'react'
import Sigma from 'sigma'
import Graph from 'graphology'
import forceAtlas2 from 'graphology-layout-forceatlas2'
import { buildWorkspaceGraph } from '../core/wiki/graph.js'

const COLORS = {
  light: {
    node: '#6366f1',
    nodeHover: '#4f46e5',
    nodeSelected: '#3730a3',
    edge: '#e5e7eb',
    edgeHover: '#9ca3af',
    background: '#ffffff',
    text: '#374151'
  },
  dark: {
    node: '#818cf8',
    nodeHover: '#a5b4fc',
    nodeSelected: '#c7d2fe',
    edge: '#374151',
    edgeHover: '#6b7280',
    background: '#111827',
    text: '#f3f4f6'
  }
}

export default function GraphView({ workspacePath, onOpenFile }) {
  const containerRef = useRef(null)
  const sigmaRef = useRef(null)
  const graphRef = useRef(null)
  const layoutWorkerRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [nodeCount, setNodeCount] = useState(0)
  const [edgeCount, setEdgeCount] = useState(0)
  const [selectedNode, setSelectedNode] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      return document.documentElement.classList.contains('dark')
    } catch {
      return true
    }
  })

  // Initialize graph and sigma
  const initGraph = useCallback(async (data) => {
    if (!containerRef.current || !data.nodes.length) return

    try {
      // Clean up previous instances
      if (layoutWorkerRef.current) {
        layoutWorkerRef.current.kill()
        layoutWorkerRef.current = null
      }
      if (sigmaRef.current) {
        sigmaRef.current.kill()
        sigmaRef.current = null
      }

      // Create new graph
      const graph = new Graph({ multi: false, type: 'undirected' })
      graphRef.current = graph

      // Memory optimization: Pre-calculate degree centrality for better performance
      const degreeMap = new Map()
      data.edges.forEach(edge => {
        degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1)
        degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1)
      })

      // Add nodes with optimized positioning and sizing
      data.nodes.forEach((node, index) => {
        // Initial circular layout to prevent overlaps
        const angle = (index / data.nodes.length) * 2 * Math.PI
        const radius = Math.min(300, Math.max(100, Math.sqrt(data.nodes.length) * 20))
        const degree = degreeMap.get(node.id) || 0
        
        graph.addNode(node.id, {
          label: node.title,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: Math.max(3, Math.min(15, Math.log(1 + degree * 2))),
          color: COLORS[isDarkMode ? 'dark' : 'light'].node,
          originalColor: COLORS[isDarkMode ? 'dark' : 'light'].node,
          path: node.path,
          degree: degree // Store for later use
        })
      })

      // Add edges with memory-efficient batching
      const BATCH_SIZE = 1000
      for (let i = 0; i < data.edges.length; i += BATCH_SIZE) {
        const batch = data.edges.slice(i, i + BATCH_SIZE)
        
        batch.forEach((edge, batchIndex) => {
          try {
            if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
              graph.addEdge(`edge_${i + batchIndex}`, edge.source, edge.target, {
                color: COLORS[isDarkMode ? 'dark' : 'light'].edge,
                size: 1
              })
            }
          } catch (e) {
            console.warn('Failed to add edge:', edge, e)
          }
        })
        
        // Yield control between batches to prevent blocking
        if (i + BATCH_SIZE < data.edges.length) {
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      }

      setNodeCount(graph.order)
      setEdgeCount(graph.size)

      // Initialize Sigma with performance optimizations
      const sigma = new Sigma(graph, containerRef.current, {
        // Performance settings for large graphs
        renderEdgeLabels: false,
        defaultNodeColor: COLORS[isDarkMode ? 'dark' : 'light'].node,
        defaultEdgeColor: COLORS[isDarkMode ? 'dark' : 'light'].edge,
        minCameraRatio: 0.05, // Allow more zoom out for large graphs
        maxCameraRatio: 5, // Limit zoom in for performance
        labelDensity: data.nodes.length > 500 ? 1 : 2, // Reduce label density for large graphs
        labelRenderedSizeThreshold: data.nodes.length > 1000 ? 15 : 8, // Higher threshold for large graphs
        enableEdgeClickEvents: data.nodes.length < 1000, // Disable for performance on large graphs
        enableEdgeHoverEvents: data.nodes.length < 1000, // Disable for performance on large graphs
        
        // Level-of-detail optimizations
        hideEdgesOnMove: data.nodes.length > 200,
        hideLabelsOnMove: data.nodes.length > 100,
        
        // Rendering optimizations
        stagePadding: 50,
        edgeReducer: (edge, data) => {
          const res = { ...data }
          if (selectedNode && (edge.source === selectedNode || edge.target === selectedNode)) {
            res.color = COLORS[isDarkMode ? 'dark' : 'light'].edgeHover
            res.size = 2
          }
          return res
        },
        nodeReducer: (node, data) => {
          const res = { ...data }
          if (selectedNode === node) {
            res.color = COLORS[isDarkMode ? 'dark' : 'light'].nodeSelected
            res.size = Math.max(data.size * 1.5, 8)
          } else if (selectedNode && graph.hasEdge(selectedNode, node)) {
            res.color = COLORS[isDarkMode ? 'dark' : 'light'].nodeHover
          }
          
          // Search highlighting
          if (searchQuery && data.label.toLowerCase().includes(searchQuery.toLowerCase())) {
            res.color = '#ef4444' // red highlight for search results
            res.size = Math.max(data.size * 1.2, 6)
          }
          
          return res
        }
      })

      sigmaRef.current = sigma

      // Event handlers
      sigma.on('clickNode', ({ node }) => {
        const nodeData = graph.getNodeAttributes(node)
        setSelectedNode(selectedNode === node ? null : node)
        
        if (onOpenFile && nodeData.path) {
          onOpenFile(nodeData.path)
        }
      })

      sigma.on('clickStage', () => {
        setSelectedNode(null)
      })

      // Adaptive layout based on graph size
      if (data.nodes.length > 1) {
        if (data.nodes.length < 2000) {
          // Use ForceAtlas2 for medium graphs
          const settings = forceAtlas2.inferSettings(graph)
          const sensibleSettings = {
            ...settings,
            iterations: Math.min(200, Math.max(30, Math.sqrt(data.nodes.length) * 10)),
            settings: {
              ...settings.settings,
              barnesHutOptimize: data.nodes.length > 50, // Enable optimization earlier
              strongGravityMode: data.nodes.length < 100, // Only for small graphs
              gravity: data.nodes.length > 500 ? 0.01 : 0.05, // Reduce gravity for large graphs
              scalingRatio: Math.max(1, Math.min(20, data.nodes.length / 50)),
              slowDown: data.nodes.length > 500 ? 5 : 2, // More slowdown for stability
              outboundAttractionDistribution: data.nodes.length > 200,
              linLogMode: data.nodes.length > 200 // Better for large graphs
            }
          }

          // Progressive layout rendering with memory management
          let currentIteration = 0
          const maxIterations = sensibleSettings.iterations
          const batchSize = Math.max(5, Math.min(30, Math.floor(200 / Math.sqrt(data.nodes.length))))
          
          const runLayoutBatch = (iterations) => {
            try {
              forceAtlas2.assign(graph, { iterations, settings: sensibleSettings.settings })
              sigma.refresh()
              currentIteration += iterations
              
              // Progress indicator for large graphs
              if (data.nodes.length > 200 && currentIteration < maxIterations) {
                console.log(`[Graph] Layout progress: ${Math.round((currentIteration / maxIterations) * 100)}%`)
              }
              
              if (currentIteration < maxIterations) {
                const remaining = Math.min(batchSize, maxIterations - currentIteration)
                requestAnimationFrame(() => runLayoutBatch(remaining))
              } else {
                console.log('[Graph] Layout completed')
              }
            } catch (error) {
              console.warn('[Graph] Layout error:', error)
            }
          }

          // Start layout
          requestAnimationFrame(() => runLayoutBatch(batchSize))
        } else {
          // For very large graphs, use simple grid/cluster layout
          console.log('[Graph] Using simplified layout for large graph')
          const cols = Math.ceil(Math.sqrt(data.nodes.length))
          const spacing = 50
          
          graph.forEachNode((node, attributes, index) => {
            const row = Math.floor(index / cols)
            const col = index % cols
            graph.setNodeAttribute(node, 'x', (col - cols / 2) * spacing)
            graph.setNodeAttribute(node, 'y', (row - cols / 2) * spacing)
          })
          
          sigma.refresh()
        }
      }

      setLoading(false)
    } catch (error) {
      console.error('Failed to initialize graph:', error)
      setLoading(false)
    }
  }, [isDarkMode, selectedNode, searchQuery, onOpenFile])

  // Load graph data
  useEffect(() => {
    if (!workspacePath) return
    
    let mounted = true
    setLoading(true)
    
    buildWorkspaceGraph(workspacePath)
      .then(data => {
        if (mounted && data) {
          console.log('[GraphView] Loaded graph:', data.nodes.length, 'nodes,', data.edges.length, 'edges')
          initGraph(data)
        }
      })
      .catch(error => {
        console.error('[GraphView] Failed to build graph:', error)
        if (mounted) setLoading(false)
      })
      
    return () => { mounted = false }
  }, [workspacePath, initGraph])

  // Theme change handler
  useEffect(() => {
    const handleThemeChange = () => {
      const dark = document.documentElement.classList.contains('dark')
      if (dark !== isDarkMode) {
        setIsDarkMode(dark)
      }
    }
    
    const observer = new MutationObserver(handleThemeChange)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    
    return () => observer.disconnect()
  }, [isDarkMode])

  // Cleanup
  useEffect(() => {
    return () => {
      if (layoutWorkerRef.current) {
        layoutWorkerRef.current.kill()
      }
      if (sigmaRef.current) {
        sigmaRef.current.kill()
      }
    }
  }, [])

  // Search functionality
  const handleSearch = useCallback((query) => {
    setSearchQuery(query)
    if (sigmaRef.current) {
      sigmaRef.current.refresh()
    }
  }, [])

  // Reset view
  const handleResetView = useCallback(() => {
    if (sigmaRef.current) {
      sigmaRef.current.getCamera().animate({ x: 0, y: 0, ratio: 1 }, { duration: 300 })
      setSelectedNode(null)
      setSearchQuery('')
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-app-bg text-app-text">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-app-accent mx-auto"></div>
          <p className="text-app-muted">Building graph...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative h-full bg-app-bg">
      {/* Controls */}
      <div className="absolute top-4 left-4 z-10 bg-app-panel border border-app-border rounded-lg shadow-lg p-3 space-y-2">
        <div className="text-xs text-app-muted">
          {nodeCount} nodes • {edgeCount} edges
        </div>
        
        <div className="flex items-center space-x-2">
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="px-2 py-1 text-xs bg-app-bg border border-app-border rounded focus:outline-none focus:border-app-accent text-app-text"
          />
          <button
            onClick={handleResetView}
            className="px-2 py-1 text-xs bg-app-accent text-app-accent-fg rounded hover:bg-app-accent/90 transition-colors"
          >
            Reset
          </button>
        </div>

        {selectedNode && (
          <div className="text-xs text-app-text pt-2 border-t border-app-border">
            <strong>Selected:</strong> {graphRef.current?.getNodeAttribute(selectedNode, 'label') || selectedNode}
          </div>
        )}
      </div>

      {/* Graph Container */}
      <div 
        ref={containerRef} 
        className="w-full h-full" 
        style={{ 
          background: COLORS[isDarkMode ? 'dark' : 'light'].background,
          cursor: selectedNode ? 'pointer' : 'grab'
        }}
      />

      {/* Help */}
      <div className="absolute bottom-4 right-4 text-xs text-app-muted bg-app-panel border border-app-border rounded-lg p-2 max-w-xs">
        <div><strong>Click</strong> node to select/open</div>
        <div><strong>Drag</strong> to pan • <strong>Scroll</strong> to zoom</div>
        {searchQuery && <div><strong>Search:</strong> Highlighted in red</div>}
      </div>
    </div>
  )
}