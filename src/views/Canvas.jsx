import React, { useState, useEffect, useCallback } from 'react'
import { Tldraw, loadSnapshot, createTLStore, defaultShapeUtils, defaultBindingUtils, defaultTools } from 'tldraw'
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
      console.log('📂 Loading canvas from:', canvasPath)
      setIsLoading(true)
      
      try {
        // Validate canvas path
        if (!isValidFilePath(canvasPath)) {
          throw new Error('Invalid canvas file path');
        }
        
        console.log('📖 Reading file content...')
        const content = await invoke('read_file_content', { path: canvasPath })
        console.log('📄 File content length:', content.length)
        
        const canvasData = JSON.parse(content)
        console.log('🔍 Parsed canvas data:', {
          hasNodes: !!canvasData.nodes,
          nodeCount: canvasData.nodes?.length || 0,
          hasEdges: !!canvasData.edges,
          edgeCount: canvasData.edges?.length || 0,
          hasMetadata: !!canvasData.metadata
        })
        
        // Security validation for canvas data
        if (!isValidCanvasData(canvasData)) {
          console.warn('⚠️ Invalid canvas data detected, using empty canvas');
          const emptyTldrawData = jsonCanvasToTldraw({ nodes: [], edges: [] })
          loadSnapshot(store, emptyTldrawData)
          setIsDirty(false)
          return;
        }
        
        console.log('✅ Canvas data validation passed')
        
        // Migrate and convert to tldraw format
        console.log('🔄 Migrating canvas format...')
        const migratedData = migrateCanvasFormat(canvasData)
        console.log('🔄 Converting to tldraw format...')
        const tldrawData = jsonCanvasToTldraw(migratedData)
        
        console.log('📊 Tldraw data prepared:', {
          records: tldrawData.records?.length || 0,
          shapes: tldrawData.records?.filter(r => r.typeName === 'shape').length || 0,
          hasSchema: !!tldrawData.schema
        })
        
        // Use new loadSnapshot API
        console.log('💾 Loading snapshot into store...')
        loadSnapshot(store, tldrawData)
        
        // Mark as clean after loading
        setIsDirty(false)
        
        console.log('✅ Canvas loaded successfully')
      } catch (error) {
        console.error('❌ Failed to load canvas:', error)
        
        // Initialize with empty canvas on error
        try {
          console.log('🔄 Loading empty canvas as fallback...')
          const emptyTldrawData = jsonCanvasToTldraw({ nodes: [], edges: [] })
          loadSnapshot(store, emptyTldrawData)
          setIsDirty(false)
        } catch (loadError) {
          console.error('❌ Failed to load empty canvas:', loadError)
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadCanvas()
  }, [canvasPath, store])

  // Save canvas content
  const handleSave = useCallback(async () => {
    if (!canvasPath || !store) {
      console.warn('💾 Save skipped: missing canvasPath or store')
      return
    }

    console.log('💾 Starting save operation for:', canvasPath)
    setIsLoading(true)
    
    try {
      // Validate canvas path
      if (!isValidFilePath(canvasPath)) {
        throw new Error('Invalid canvas file path');
      }
      
      const snapshot = store.getSnapshot()
      console.log('📊 Store snapshot taken:', {
        records: snapshot.records?.length || 0,
        shapes: snapshot.records?.filter(r => r.typeName === 'shape').length || 0
      })
      
      // Convert tldraw format to JSON Canvas format
      const canvasData = tldrawToJsonCanvas(snapshot)
      console.log('🔄 Converted to JSON Canvas format:', {
        nodes: canvasData.nodes?.length || 0,
        edges: canvasData.edges?.length || 0
      })
      
      // Security validation for canvas data before saving
      if (!isValidCanvasData(canvasData)) {
        throw new Error('Invalid canvas data - security validation failed');
      }
      
      console.log('✅ Canvas data validated, writing to file...')

      // Save directly to file first, then call callback
      await invoke('write_file_content', {
        path: canvasPath,
        content: JSON.stringify(canvasData, null, 2)
      })

      console.log('📁 File written successfully')

      // Call the onSave callback with canvas data
      if (onSave) {
        console.log('🔄 Calling onSave callback...')
        await onSave(canvasData)
      }
      
      setLastSaved(new Date())
      setIsDirty(false)
      console.log('✅ Canvas saved successfully to:', canvasPath)
    } catch (error) {
      console.error('❌ Failed to save canvas:', error)
      
      // More specific error messages for users
      let userMessage = 'Failed to save canvas'
      if (error.message.includes('permission')) {
        userMessage = 'Permission denied: Cannot write to this location'
      } else if (error.message.includes('Invalid canvas path')) {
        userMessage = 'Invalid file path for canvas'
      } else if (error.message.includes('security validation')) {
        userMessage = 'Canvas data validation failed'
      } else if (error.message.includes('network')) {
        userMessage = 'Network error: Please check your connection'
      } else {
        userMessage = `Save failed: ${error.message}`
      }
      
      // Show error to user with better UX than alert
      console.error('🚨 Showing error to user:', userMessage)
      
      // TODO: Replace with proper notification system
      alert(`❌ ${userMessage}`)
      
      // Keep dirty state so user can retry
      setIsDirty(true)
    } finally {
      setIsLoading(false)
    }
  }, [canvasPath, onSave, store])

  // Auto-save on changes (only real content changes)
  useEffect(() => {
    if (!store) return
    
    let initialSnapshot = null
    let changeTimeout = null
    let saveTimeout = null
    
    const handleStoreChange = () => {
      // Clear any pending timeouts
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
      
      // Reduced debounce for more responsive detection
      changeTimeout = setTimeout(() => {
        const currentSnapshot = store.getSnapshot()
        
        console.log('📝 Store changed, checking for real changes...')
        
        // Compare with initial snapshot to detect real changes
        if (initialSnapshot && hasRealChanges(initialSnapshot, currentSnapshot)) {
          console.log('💾 Real changes detected, marking as dirty')
          setIsDirty(true)
          
          // Call onContentChange if provided
          if (onContentChange) {
            try {
              const canvasData = tldrawToJsonCanvas(currentSnapshot)
              onContentChange(canvasData)
            } catch (error) {
              console.error('❌ Failed to convert to JSON Canvas format:', error)
            }
          }
          
          // Auto-save after shorter delay for better UX
          saveTimeout = setTimeout(() => {
            if (canvasPath && isDirty) {
              console.log('🔄 Auto-saving canvas after change detection...')
              handleSave()
            }
          }, 1500) // Reduced from 2000ms to 1500ms
        } else {
          console.log('👀 Store changed but no real changes detected')
        }
      }, 300) // Reduced from 500ms to 300ms for faster response
    }

    // Capture initial snapshot immediately after store is ready
    const captureInitialSnapshot = () => {
      if (store) {
        initialSnapshot = store.getSnapshot()
        console.log('📸 Initial snapshot captured:', {
          records: initialSnapshot.records?.length || 0,
          shapes: initialSnapshot.records?.filter(r => r.typeName === 'shape').length || 0
        })
      }
    }

    // Capture immediately, then also after a short delay to ensure loading is complete
    captureInitialSnapshot()
    setTimeout(captureInitialSnapshot, 100)

    const unsubscribe = store.listen(handleStoreChange)
    
    return () => {
      unsubscribe()
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [store, onContentChange, canvasPath, isDirty])
  
  // Helper to detect real content changes vs just mouse moves/viewport changes
  const hasRealChanges = (oldSnapshot, newSnapshot) => {
    if (!oldSnapshot || !newSnapshot) return false
    
    console.log('🔍 Checking for real changes...', {
      oldRecords: oldSnapshot.records?.length || 0,
      newRecords: newSnapshot.records?.length || 0
    })
    
    const oldRecords = oldSnapshot.records || []
    const newRecords = newSnapshot.records || []
    
    // Get shapes only (exclude camera, document, page, instance records)
    const oldShapes = oldRecords.filter(r => r.typeName === 'shape')
    const newShapes = newRecords.filter(r => r.typeName === 'shape')
    
    console.log('📊 Shape counts:', { old: oldShapes.length, new: newShapes.length })
    
    // Check if number of shapes changed
    if (oldShapes.length !== newShapes.length) {
      console.log('✅ Shape count changed - real change detected')
      return true
    }
    
    // Check if any shape properties changed (excluding position updates from drags)
    for (const oldShape of oldShapes) {
      const newShape = newShapes.find(s => s.id === oldShape.id)
      
      if (!newShape) {
        console.log('✅ Shape removed - real change detected', oldShape.id)
        return true
      }
      
      // Compare type changes (shape converted to different type)
      if (oldShape.type !== newShape.type) {
        console.log('✅ Shape type changed - real change detected', oldShape.id, oldShape.type, '->', newShape.type)
        return true
      }
      
      // Compare props but exclude volatile properties that change during interaction
      const oldProps = { ...oldShape.props }
      const newProps = { ...newShape.props }
      
      // Remove properties that change during normal interaction but aren't "real" edits
      delete oldProps.scale // Scale changes during zoom
      delete newProps.scale
      
      // For geo shapes, text changes are meaningful
      if (oldShape.type === 'geo' || oldShape.type === 'text') {
        if (oldProps.text !== newProps.text) {
          console.log('✅ Text content changed - real change detected', oldShape.id)
          return true
        }
      }
      
      // Compare other meaningful properties
      const meaningfulOldProps = JSON.stringify({
        text: oldProps.text,
        color: oldProps.color,
        size: oldProps.size,
        font: oldProps.font,
        align: oldProps.align,
        w: oldProps.w,
        h: oldProps.h,
        fill: oldProps.fill,
        dash: oldProps.dash,
        geo: oldProps.geo
      })
      
      const meaningfulNewProps = JSON.stringify({
        text: newProps.text,
        color: newProps.color,
        size: newProps.size,
        font: newProps.font,
        align: newProps.align,
        w: newProps.w,
        h: newProps.h,
        fill: newProps.fill,
        dash: newProps.dash,
        geo: newProps.geo
      })
      
      if (meaningfulOldProps !== meaningfulNewProps) {
        console.log('✅ Shape properties changed - real change detected', oldShape.id)
        console.log('  Old props:', meaningfulOldProps)
        console.log('  New props:', meaningfulNewProps)
        return true
      }
      
      // Check position changes that are more than just small drags (threshold for actual moves)
      const oldX = oldShape.x || 0
      const oldY = oldShape.y || 0
      const newX = newShape.x || 0
      const newY = newShape.y || 0
      
      const positionDiff = Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2))
      if (positionDiff > 10) { // More than 10px movement is a real change
        console.log('✅ Significant position change - real change detected', oldShape.id, `moved ${positionDiff.toFixed(1)}px`)
        return true
      }
    }
    
    // Check for new shapes
    for (const newShape of newShapes) {
      if (!oldShapes.find(s => s.id === newShape.id)) {
        console.log('✅ New shape added - real change detected', newShape.id)
        return true
      }
    }
    
    console.log('❌ No real changes detected')
    return false
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case 's':
            e.preventDefault()
            console.log('⌨️ Manual save triggered by Ctrl+S')
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