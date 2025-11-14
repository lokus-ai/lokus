import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Tldraw, getSnapshot, loadSnapshot, createTLStore, defaultShapeUtils, defaultBindingUtils, defaultTools } from 'tldraw'
import 'tldraw/tldraw.css'
import '../styles/canvas.css'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { X, Save, Download, Maximize2, Minimize2 } from 'lucide-react'
import { jsonCanvasToTldraw, tldrawToJsonCanvas, migrateCanvasFormat } from '../core/canvas/parser.js'
import { canvasConfigs, themeConfigs } from '../core/canvas/config.js'
import { useTheme } from '../hooks/theme.jsx'
import { isValidCanvasData, isValidFilePath } from '../core/security/index.js'
import { canvasManager } from '../core/canvas/manager.js'

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
  const [editor, setEditor] = useState(null)
  const [saveState, setSaveState] = useState('idle') // 'idle', 'saving', 'saved', 'error'
  const { theme } = useTheme()
  
  // Save queue system to prevent race conditions
  const saveQueueRef = useRef({
    queue: [],
    isProcessing: false,
    currentOperation: null
  })
  
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

  // Load canvas file content with robust handling
  useEffect(() => {
    if (!canvasPath || !store || !editor) return
    
    const loadCanvas = async () => {
      setIsLoading(true)
      setSaveState('idle')
      
      try {
        // Wait for any pending save operations to complete
        while (saveQueueRef.current.isProcessing) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
        
        // Load the TLDraw snapshot directly (no conversion needed!)
        const tldrawSnapshot = await canvasManager.loadCanvas(canvasPath)
        console.log(`[Canvas.jsx] SNAPSHOT LOADED FROM MANAGER:`, tldrawSnapshot);
        console.log(`[Canvas.jsx] SNAPSHOT.SCHEMA:`, tldrawSnapshot.schema);
        console.log(`[Canvas.jsx] SNAPSHOT.RECORDS:`, tldrawSnapshot.records);

        // Load into store
        console.log(`[Canvas.jsx] CALLING loadSnapshot with:`, tldrawSnapshot);
        loadSnapshot(store, tldrawSnapshot)
        console.log(`[Canvas.jsx] LOADED INTO TLDRAW STORE`);

        // Check what's actually in the store after loading
        const storeRecords = store.allRecords();
        console.log(`[Canvas.jsx] STORE RECORDS AFTER LOAD (count: ${storeRecords.length}):`, storeRecords);

        // Check specifically for shapes
        const shapes = storeRecords.filter(r => r.typeName === 'shape');
        console.log(`[Canvas.jsx] SHAPES IN STORE (count: ${shapes.length}):`, shapes);
        
        // Mark as clean after loading
        setIsDirty(false)
        
      } catch (error) {
        
        // Initialize with empty canvas on error
        try {
          const emptyTldrawData = jsonCanvasToTldraw({ nodes: [], edges: [] })
          loadSnapshot(store, emptyTldrawData)
          setIsDirty(false)
        } catch (loadError) {
        }
      } finally {
        setIsLoading(false)
      }
    }

    loadCanvas()
  }, [canvasPath, store, editor])

  // Process save queue - ensures only one save operation at a time
  const processSaveQueue = useCallback(async () => {
    const queue = saveQueueRef.current
    
    if (queue.isProcessing || queue.queue.length === 0) {
      return
    }
    
    queue.isProcessing = true
    
    while (queue.queue.length > 0) {
      const saveOperation = queue.queue.shift()
      queue.currentOperation = saveOperation
      
      try {
        await saveOperation.execute()
        saveOperation.resolve()
      } catch (error) {
        saveOperation.reject(error)
      }
    }
    
    queue.isProcessing = false
    queue.currentOperation = null
  }, [])
  
  // Add save operation to queue
  const queueSaveOperation = useCallback((operation) => {
    return new Promise((resolve, reject) => {
      saveQueueRef.current.queue.push({
        execute: operation,
        resolve,
        reject,
        timestamp: Date.now()
      })
      
      // Process queue immediately
      processSaveQueue()
    })
  }, [processSaveQueue])
  
  // Verify file content after save
  const verifyFileSave = useCallback(async (canvasPath, expectedData, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Wait a bit for filesystem flush
        await new Promise(resolve => setTimeout(resolve, 50 * attempt))
        
        const content = await invoke('read_file_content', { path: canvasPath })
        const savedData = JSON.parse(content)
        
        // Compare node and edge counts
        const expectedNodes = expectedData.nodes?.length || 0
        const expectedEdges = expectedData.edges?.length || 0
        const savedNodes = savedData.nodes?.length || 0
        const savedEdges = savedData.edges?.length || 0
        
        if (expectedNodes === savedNodes && expectedEdges === savedEdges) {
          return true
        } else {
        }
      } catch (error) {
      }
    }
    
    return false
  }, [])
  
  // Save canvas content with robust error handling
  const handleSave = useCallback(async () => {
    if (!canvasPath || !editor) {
      return
    }

    return queueSaveOperation(async () => {
      setSaveState('saving')
      setIsLoading(true)
      
      try {
        // Validate canvas path
        if (!isValidFilePath(canvasPath)) {
          throw new Error('Invalid canvas file path')
        }
        
        // Get current TLDraw snapshot (includes both records and schema!)
        const tldrawSnapshot = getSnapshot(editor.store)
        console.log(`[Canvas.jsx] SNAPSHOT TO SAVE:`, tldrawSnapshot);

        // Save the TLDraw snapshot directly (no conversion!)
        await canvasManager.saveCanvas(canvasPath, tldrawSnapshot)

        // Verify the save was successful
        const isVerified = await verifyFileSave(canvasPath, tldrawSnapshot)
        if (!isVerified) {
          throw new Error('File verification failed - data may not have been saved correctly')
        }
        
        // Call onSave callback
        if (onSave) {
          await onSave(canvasData)
        }
        
        // Update state
        setLastSaved(new Date())
        setIsDirty(false)
        setSaveState('saved')
        
        
        // Reset save state after a delay
        setTimeout(() => setSaveState('idle'), 2000)
        
      } catch (error) {
        setSaveState('error')
        setIsDirty(true)
        
        // More specific error messages
        let userMessage = 'Failed to save canvas'
        if (error.message.includes('permission')) {
          userMessage = 'Permission denied: Cannot write to this location'
        } else if (error.message.includes('Invalid canvas path')) {
          userMessage = 'Invalid file path for canvas'
        } else if (error.message.includes('validation')) {
          userMessage = 'Canvas data validation failed'
        } else if (error.message.includes('verification')) {
          userMessage = 'Save verification failed - please try again'
        } else {
          userMessage = `Save failed: ${error.message}`
        }
        
        
        // Reset error state after delay
        setTimeout(() => setSaveState('idle'), 3000)
        
        throw error // Re-throw for queue handling
      } finally {
        setIsLoading(false)
      }
    })
  }, [canvasPath, onSave, editor, queueSaveOperation, verifyFileSave])

  // Auto-save on changes (only real content changes)
  useEffect(() => {
    if (!editor) return
    
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
        
        // Use proper tldraw v3 API to get current state
        const currentSnapshot = getSnapshot(editor.store)
        const allRecords = editor.store.allRecords()
        
        // Use the method that gives us data
        const finalCurrentSnapshot = currentSnapshot.records?.length > 0 ? currentSnapshot : { records: allRecords }
        
        // Compare with initial snapshot to detect real changes
        if (initialSnapshot && hasRealChanges(initialSnapshot, finalCurrentSnapshot)) {
          setIsDirty(true)
          
          // Call onContentChange if provided
          if (onContentChange) {
            try {
              const canvasData = tldrawToJsonCanvas(finalCurrentSnapshot)
              onContentChange(canvasData)
            } catch (error) {
            }
          }
          
          // Auto-save immediately when real changes are detected
          if (canvasPath) {
            handleSave()
          }
        }
      }, 300) // Reduced from 500ms to 300ms for faster response
    }

    // Capture initial snapshot immediately after editor is ready
    const captureInitialSnapshot = () => {
      if (editor) {
        const snapshot = getSnapshot(editor.store)
        const allRecords = editor.store.allRecords()
        initialSnapshot = snapshot.records?.length > 0 ? snapshot : { records: allRecords }
      }
    }

    // Capture immediately, then also after a short delay to ensure loading is complete
    captureInitialSnapshot()
    setTimeout(captureInitialSnapshot, 100)

    const unsubscribe = editor.store.listen(handleStoreChange)
    
    return () => {
      unsubscribe()
      if (changeTimeout) {
        clearTimeout(changeTimeout)
      }
      if (saveTimeout) {
        clearTimeout(saveTimeout)
      }
    }
  }, [editor, onContentChange, canvasPath, isDirty])
  
  // Helper to detect real content changes vs just mouse moves/viewport changes
  const hasRealChanges = (oldSnapshot, newSnapshot) => {
    if (!oldSnapshot || !newSnapshot) return false
    
    
    
    const oldRecords = oldSnapshot.records || []
    const newRecords = newSnapshot.records || []
    
    // Get shapes only (exclude camera, document, page, instance records)
    const oldShapes = oldRecords.filter(r => r.typeName === 'shape')
    const newShapes = newRecords.filter(r => r.typeName === 'shape')
    
    
    // Check if number of shapes changed
    if (oldShapes.length !== newShapes.length) {
      return true
    }
    
    // Check if any shape properties changed (excluding position updates from drags)
    for (const oldShape of oldShapes) {
      const newShape = newShapes.find(s => s.id === oldShape.id)
      
      if (!newShape) {
        return true
      }
      
      // Compare type changes (shape converted to different type)
      if (oldShape.type !== newShape.type) {
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
        return true
      }
      
      // Check position changes that are more than just small drags (threshold for actual moves)
      const oldX = oldShape.x || 0
      const oldY = oldShape.y || 0
      const newX = newShape.x || 0
      const newY = newShape.y || 0
      
      const positionDiff = Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2))
      if (positionDiff > 10) { // More than 10px movement is a real change
        return true
      }
    }
    
    // Check for new shapes
    for (const newShape of newShapes) {
      if (!oldShapes.find(s => s.id === newShape.id)) {
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
            onMount={(editorInstance) => {
              setEditor(editorInstance)
            }}
          />
        )}
        
        {/* Enhanced save state indicator */}
        {saveState === 'saving' && (
          <div className="absolute top-4 right-4 bg-blue-100 dark:bg-blue-900 border border-blue-300 dark:border-blue-700 rounded px-2 py-1 text-xs text-blue-800 dark:text-blue-200 z-20 flex items-center gap-1">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            Saving...
          </div>
        )}
        
        {saveState === 'saved' && lastSaved && (
          <div className="absolute top-4 right-4 bg-green-100 dark:bg-green-900 border border-green-300 dark:border-green-700 rounded px-2 py-1 text-xs text-green-800 dark:text-green-200 z-20">
            ✅ Saved at {lastSaved.toLocaleTimeString()}
          </div>
        )}
        
        {saveState === 'error' && (
          <div className="absolute top-4 right-4 bg-red-100 dark:bg-red-900 border border-red-300 dark:border-red-700 rounded px-2 py-1 text-xs text-red-800 dark:text-red-200 z-20">
            ❌ Save failed
          </div>
        )}
        
        {isDirty && saveState === 'idle' && (
          <div className="absolute top-4 right-4 bg-yellow-100 dark:bg-yellow-900 border border-yellow-300 dark:border-yellow-700 rounded px-2 py-1 text-xs text-yellow-800 dark:text-yellow-200 z-20">
            • Unsaved changes
          </div>
        )}
      </div>
    </div>
  )
}