import React, { useState, useEffect, useCallback } from 'react'
import { Tldraw, loadSnapshot, getSnapshot, createTLStore, defaultShapeUtils, defaultBindingUtils, defaultTools } from 'tldraw'
import 'tldraw/tldraw.css'
import '../styles/canvas.css'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { X, Save, Download, Maximize2, Minimize2 } from 'lucide-react'
import { jsonCanvasToTldraw, tldrawToJsonCanvas, migrateCanvasFormat } from '../core/canvas/parser.js'
import { canvasConfigs, themeConfigs } from '../core/canvas/config.js'
import { useTheme } from '../hooks/theme.jsx'
import { isValidCanvasData, isValidFilePath } from '../core/security/index.js'

export default function Canvas({ 
  canvasPath = null,
  canvasName = null,
  onSave,
  onContentChange,
  initialData = null,
  isFullscreen = false,
  onToggleFullscreen,
  onClose
}) {
  const [isLoading, setIsLoading] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [isDirty, setIsDirty] = useState(false)
  const [store, setStore] = useState(null)
  const { theme } = useTheme()
  
  // Determine theme mode
  const isDarkMode = theme?.name === 'dark' || theme?.mode === 'dark'
  const currentThemeConfig = isDarkMode ? themeConfigs.dark : themeConfigs.light

  // Initialize store
  useEffect(() => {
    const newStore = createTLStore({ 
      shapeUtils: defaultShapeUtils, 
      bindingUtils: defaultBindingUtils 
    })
    setStore(newStore)
  }, [])

  // Load canvas file content
  useEffect(() => {
    if (!canvasPath || !store) return
    
    const loadCanvas = async () => {
      setIsLoading(true)
      try {
        // Validate canvas path
        if (!isValidFilePath(canvasPath)) {
          throw new Error('Invalid canvas file path');
        }
        
        const content = await invoke('read_file_content', { path: canvasPath })
        const canvasData = JSON.parse(content)
        
        // Security validation for canvas data
        if (!isValidCanvasData(canvasData)) {
          console.warn('Invalid canvas data detected, using empty canvas');
          const emptyTldrawData = jsonCanvasToTldraw({ nodes: [], edges: [] })
          loadSnapshot(store, emptyTldrawData)
          setIsDirty(false)
          return;
        }
        
        // Migrate and convert to tldraw format
        const migratedData = migrateCanvasFormat(canvasData)
        const tldrawData = jsonCanvasToTldraw(migratedData)
        
        // Use new loadSnapshot API
        loadSnapshot(store, tldrawData)
        
        // Mark as clean after loading
        setIsDirty(false)
        
        console.log('Canvas loaded successfully')
      } catch (error) {
        console.error('Failed to load canvas:', error)
        // Initialize with empty canvas on error
        try {
          const emptyTldrawData = jsonCanvasToTldraw({ nodes: [], edges: [] })
          loadSnapshot(store, emptyTldrawData)
        } catch (loadError) {
          console.error('Failed to load empty canvas:', loadError)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadCanvas()
  }, [canvasPath, store])

  // Save canvas content
  const handleSave = useCallback(async () => {
    if (!canvasPath || !store) return

    setIsLoading(true)
    try {
      // Validate canvas path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas file path');
      }
      
      const snapshot = getSnapshot(store)
      
      // Convert tldraw format to JSON Canvas format
      const canvasData = tldrawToJsonCanvas(snapshot)
      
      // Security validation for canvas data before saving
      if (!isValidCanvasData(canvasData)) {
        throw new Error('Invalid canvas data - security validation failed');
      }
      
      console.log('Saving canvas data:', canvasData)

      // Save directly to file first, then call callback
      await invoke('write_file_content', {
        path: canvasPath,
        content: JSON.stringify(canvasData, null, 2)
      })

      // Call the onSave callback with canvas data
      if (onSave) {
        await onSave(canvasData)
      }
      
      setLastSaved(new Date())
      setIsDirty(false)
      console.log('Canvas saved successfully to:', canvasPath)
    } catch (error) {
      console.error('Failed to save canvas:', error)
      // Show error to user
      alert(`Failed to save canvas: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }, [canvasPath, onSave, store])

  // Auto-save on changes (only real content changes)
  useEffect(() => {
    if (!store) return
    
    let initialSnapshot = null
    let changeTimeout = null
    
    const handleStoreChange = () => {
      // Clear any pending timeout
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }
      
      // Debounce changes to avoid mouse move false positives
      changeTimeout = setTimeout(() => {
        const currentSnapshot = getSnapshot(store)
        
        // Compare with initial snapshot to detect real changes
        if (initialSnapshot && hasRealChanges(initialSnapshot, currentSnapshot)) {
          setIsDirty(true)
          
          // Call onContentChange if provided
          if (onContentChange) {
            const canvasData = tldrawToJsonCanvas(currentSnapshot)
            onContentChange(canvasData)
          }
          
          // Auto-save after 2 seconds of inactivity
          setTimeout(() => {
            if (canvasPath) {
              handleSave()
            }
          }, 2000)
        }
      }, 500) // 500ms debounce
    }

    // Capture initial snapshot after loading
    setTimeout(() => {
      initialSnapshot = getSnapshot(store)
    }, 1000)

    const unsubscribe = store.listen(handleStoreChange)
    
    return () => {
      unsubscribe()
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }
    }
  }, [store, onContentChange])
  
  // Helper to detect real content changes vs just mouse moves
  const hasRealChanges = (oldSnapshot, newSnapshot) => {
    if (!oldSnapshot || !newSnapshot) return false
    
    const oldRecords = oldSnapshot.records || []
    const newRecords = newSnapshot.records || []
    
    // Check if number of shapes changed
    const oldShapes = oldRecords.filter(r => r.typeName === 'shape')
    const newShapes = newRecords.filter(r => r.typeName === 'shape')
    
    if (oldShapes.length !== newShapes.length) return true
    
    // Check if any shape properties changed (excluding position updates from mouse moves)
    for (let i = 0; i < oldShapes.length; i++) {
      const oldShape = oldShapes[i]
      const newShape = newShapes.find(s => s.id === oldShape.id)
      
      if (!newShape) return true
      
      // Compare meaningful properties (not just x,y which change on mouse over)
      if (oldShape.type !== newShape.type || 
          JSON.stringify(oldShape.props) !== JSON.stringify(newShape.props)) {
        return true
      }
    }
    
    return false
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            handleSave()
            break
          case 'Escape':
            e.preventDefault()
            onClose && onClose()
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, onClose])

  return (
    <div className={`flex flex-col h-full bg-app-bg ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Canvas Area - Full height like Editor */}
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-app-bg/50 flex items-center justify-center z-10">
            <div className="text-app-muted">Loading canvas...</div>
          </div>
        )}
        
        {store && (
          <Tldraw
            store={store}
            tools={defaultTools}
            className="tldraw-canvas"
            forceMobile={false}
            theme={theme?.name === 'dark' || theme?.mode === 'dark' ? 'dark' : 'light'}
            background={{
              grid: true,
              size: 'small'
            }}
          />
        )}
        
        {/* Floating save indicator */}
        {isDirty && (
          <div className="absolute top-4 right-4 bg-app-panel border border-app-border rounded px-2 py-1 text-xs text-app-muted z-20">
            Unsaved changes • Auto-saving...
          </div>
        )}
        
        {lastSaved && !isDirty && (
          <div className="absolute top-4 right-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded px-2 py-1 text-xs text-green-800 dark:text-green-200 z-20">
            Saved at {lastSaved.toLocaleTimeString()}
          </div>
        )}
      </div>
    </div>
  )
}