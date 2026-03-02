import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Excalidraw, serializeAsJSON } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs'
import { useTheme } from '../hooks/theme.jsx'

const AUTO_SAVE_DEBOUNCE_MS = 1500

// Determine if the current app theme is dark by checking the --bg CSS variable luminance
function detectDarkMode() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  if (bg) {
    const parts = bg.split(/\s+/).map(Number)
    if (parts.length === 3) {
      const [r, g, b] = parts
      return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5
    }
  }
  return true // default dark
}

export default function Canvas({
  canvasPath = null,
  canvasName = null,
  onSave,
  onContentChange,
  isFullscreen = false,
  onClose
}) {
  const [isLoading, setIsLoading] = useState(true)
  const [initialData, setInitialData] = useState(null)
  const { theme } = useTheme()

  const apiRef = useRef(null)
  const saveTimerRef = useRef(null)
  const isSavingRef = useRef(false)

  const [isDark, setIsDark] = useState(detectDarkMode)

  // Re-detect dark mode when theme changes
  useEffect(() => {
    // Small delay to let CSS variables update after theme switch
    const t = setTimeout(() => setIsDark(detectDarkMode()), 50)
    return () => clearTimeout(t)
  }, [theme])

  // Load file on mount / path change
  useEffect(() => {
    if (!canvasPath) {
      setIsLoading(false)
      return
    }

    let cancelled = false

    ;(async () => {
      setIsLoading(true)
      try {
        const text = await readTextFile(canvasPath)
        const data = JSON.parse(text)
        if (!cancelled) {
          setInitialData({
            elements: data.elements || [],
            appState: {
              ...(data.appState || {}),
              collaborators: new Map(),
            },
            files: data.files || {},
          })
        }
      } catch {
        // New or corrupt file — start with empty canvas
        if (!cancelled) {
          setInitialData({ elements: [], appState: { collaborators: new Map() }, files: {} })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => { cancelled = true }
  }, [canvasPath])

  // Save helper
  const doSave = useCallback(async () => {
    const api = apiRef.current
    if (!api || !canvasPath || isSavingRef.current) return

    isSavingRef.current = true
    try {
      const elements = api.getSceneElements()
      const appState = api.getAppState()
      const files = api.getFiles()
      const json = serializeAsJSON(elements, appState, files, 'local')

      await writeTextFile(canvasPath, json)

      onSave?.()
    } catch (err) {
      console.error('Canvas save failed:', err)
    } finally {
      isSavingRef.current = false
    }
  }, [canvasPath, onSave])

  // Debounced onChange → auto-save
  const handleChange = useCallback((elements, appState, files) => {
    onContentChange?.()
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(doSave, AUTO_SAVE_DEBOUNCE_MS)
  }, [doSave, onContentChange])

  // Cmd+S shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        doSave()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [doSave])

  // Cleanup timer on unmount
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  return (
    <div className={`flex flex-col h-full bg-app-bg ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      <div className="flex-1 relative">
        {isLoading && (
          <div className="absolute inset-0 bg-app-bg flex items-center justify-center z-10">
            <div className="text-app-muted text-sm">Loading canvas...</div>
          </div>
        )}

        {!isLoading && initialData && (
          <Excalidraw
            excalidrawAPI={(api) => {
              apiRef.current = api
              // Auto-fit content into viewport on open
              setTimeout(() => {
                const els = api.getSceneElements()
                if (els.length > 0) {
                  api.scrollToContent(els, { fitToViewport: true, animate: false })
                }
              }, 100)
            }}
            initialData={initialData}
            onChange={handleChange}
            theme={isDark ? 'dark' : 'light'}
            UIOptions={{
              canvasActions: {
                saveToActiveFile: false,
                loadScene: false,
                export: false,
              },
            }}
          />
        )}

      </div>
    </div>
  )
}
