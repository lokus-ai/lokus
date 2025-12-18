import { mergeAttributes, Node, InputRule } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react'
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { fragmentManager } from '../../core/canvas/fragment-manager.js'
import { generatePreviewFromData } from '../../core/canvas/preview-generator.js'
import { useTheme } from '../../hooks/theme.jsx'
import { Pencil, Check, Trash2, GripVertical } from 'lucide-react'

// Constants
const EMBEDDED_CANVAS_CONSTANTS = {
  DEFAULT_WIDTH: 600,
  DEFAULT_HEIGHT: 400,
  MIN_WIDTH: 200,
  MIN_HEIGHT: 150,
  MAX_WIDTH: 1200,
  MAX_HEIGHT: 800
}

// Input rule regex: matches ![canvas] or ![canvas:600x400]
const CANVAS_INPUT_REGEX = /!\[canvas(?::(\d+)x(\d+))?\]$/

/**
 * Embedded Canvas TipTap Extension
 * Creates inline TLDraw canvases with iframe isolation for performance
 */
const EmbeddedCanvas = Node.create({
  name: 'embeddedCanvas',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      fragmentId: {
        default: null,
      },
      width: {
        default: EMBEDDED_CANVAS_CONSTANTS.DEFAULT_WIDTH,
      },
      height: {
        default: EMBEDDED_CANVAS_CONSTANTS.DEFAULT_HEIGHT,
      },
      isNew: {
        default: false,
      }
    }
  },

  parseHTML() {
    return [
      {
        tag: 'embedded-canvas',
        getAttrs: node => ({
          fragmentId: node.getAttribute('data-fragment-id'),
          width: parseInt(node.getAttribute('data-width')) || EMBEDDED_CANVAS_CONSTANTS.DEFAULT_WIDTH,
          height: parseInt(node.getAttribute('data-height')) || EMBEDDED_CANVAS_CONSTANTS.DEFAULT_HEIGHT,
        }),
      },
    ]
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'embedded-canvas',
      mergeAttributes(HTMLAttributes, {
        'data-fragment-id': node.attrs.fragmentId,
        'data-width': node.attrs.width,
        'data-height': node.attrs.height,
      }),
    ]
  },

  addInputRules() {
    return [
      new InputRule({
        find: CANVAS_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const nodeType = state.schema.nodes.embeddedCanvas
          if (!nodeType) return null

          const width = match[1] ? parseInt(match[1]) : EMBEDDED_CANVAS_CONSTANTS.DEFAULT_WIDTH
          const height = match[2] ? parseInt(match[2]) : EMBEDDED_CANVAS_CONSTANTS.DEFAULT_HEIGHT

          const clampedWidth = Math.max(
            EMBEDDED_CANVAS_CONSTANTS.MIN_WIDTH,
            Math.min(EMBEDDED_CANVAS_CONSTANTS.MAX_WIDTH, width)
          )
          const clampedHeight = Math.max(
            EMBEDDED_CANVAS_CONSTANTS.MIN_HEIGHT,
            Math.min(EMBEDDED_CANVAS_CONSTANTS.MAX_HEIGHT, height)
          )

          const fragmentId = generateUUID()

          const tr = state.tr.replaceRangeWith(
            range.from,
            range.to,
            nodeType.create({
              fragmentId,
              width: clampedWidth,
              height: clampedHeight,
              isNew: true,
            })
          )

          return tr
        },
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbeddedCanvasComponent)
  },
})

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Embedded Canvas React Component
 * Uses iframe isolation for smooth TLDraw performance
 */
function EmbeddedCanvasComponent({ node, updateAttributes, deleteNode, selected }) {
  const { fragmentId, width, height, isNew } = node.attrs
  const { theme } = useTheme()

  const [mode, setMode] = useState('preview') // 'preview' | 'editing'
  const [previewUrl, setPreviewUrl] = useState(null)
  const [fragmentData, setFragmentData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [iframeReady, setIframeReady] = useState(false)

  const containerRef = useRef(null)
  const iframeRef = useRef(null)
  const isMountedRef = useRef(true)

  const workspacePath = globalThis.__LOKUS_WORKSPACE_PATH__ || ''
  const isDarkMode = theme?.name === 'dark' || theme?.mode === 'dark'

  // Load fragment data and generate preview on mount
  useEffect(() => {
    if (!fragmentId || !workspacePath) return

    const loadAndPreview = async () => {
      setIsLoading(true)

      try {
        let data
        if (isNew) {
          data = fragmentManager.createEmptyFragmentData(width, height)
          await fragmentManager.saveFragment(workspacePath, fragmentId, data)
          updateAttributes({ isNew: false })
        } else {
          data = await fragmentManager.loadFragment(workspacePath, fragmentId)
        }

        setFragmentData(data)
        const preview = generatePreviewFromData(data)
        setPreviewUrl(preview)

      } catch (error) {
        console.error('[EmbeddedCanvas] Failed to load fragment:', error)
        const emptyData = fragmentManager.createEmptyFragmentData(width, height)
        setFragmentData(emptyData)
        setPreviewUrl(generatePreviewFromData(emptyData))
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false)
        }
      }
    }

    loadAndPreview()
  }, [fragmentId, workspacePath, isNew, width, height])

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = async (event) => {
      // Only handle messages from our iframe
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) {
        return
      }

      const { type, data } = event.data || {}

      switch (type) {
        case 'ready':
          setIframeReady(true)
          // Send fragment data to iframe
          if (iframeRef.current && fragmentData) {
            iframeRef.current.contentWindow.postMessage({
              type: 'load',
              data: fragmentData
            }, '*')
            iframeRef.current.contentWindow.postMessage({
              type: 'theme',
              data: { dark: isDarkMode }
            }, '*')
          }
          break

        case 'save':
          // Auto-save from iframe
          if (data && workspacePath && fragmentId) {
            try {
              await fragmentManager.saveFragment(workspacePath, fragmentId, data)
              setFragmentData(data)
            } catch (error) {
              console.error('[EmbeddedCanvas] Auto-save failed:', error)
            }
          }
          break

        case 'done':
          // User clicked Done - exit edit mode
          if (fragmentData) {
            const newPreview = generatePreviewFromData(fragmentData)
            setPreviewUrl(newPreview)
          }
          setMode('preview')
          setIframeReady(false)
          break
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [fragmentData, workspacePath, fragmentId, isDarkMode])

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Enter edit mode
  const enterEditMode = useCallback(() => {
    setMode('editing')
    setIframeReady(false)
  }, [])

  // Handle delete
  const handleDelete = useCallback(async () => {
    if (workspacePath && fragmentId) {
      await fragmentManager.deleteFragment(workspacePath, fragmentId)
    }
    deleteNode()
  }, [workspacePath, fragmentId, deleteNode])

  return (
    <NodeViewWrapper
      ref={containerRef}
      className={`embedded-canvas-wrapper relative my-4 rounded-lg border-2 transition-all ${
        selected ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
      } ${mode === 'editing' ? 'ring-2 ring-blue-400' : ''}`}
      style={{
        width: width + 4,
        backgroundColor: isDarkMode ? '#1e1e2e' : '#f5f5f5',
      }}
      data-drag-handle
    >
      {/* Toolbar - only show in preview mode */}
      {mode === 'preview' && (
        <div
          className="absolute top-2 right-2 flex gap-1 z-10"
          style={{
            opacity: selected ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
          onMouseLeave={(e) => e.currentTarget.style.opacity = selected ? '1' : '0'}
        >
          <button
            onClick={enterEditMode}
            className="p-1.5 rounded bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-80"
            title="Edit canvas"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            onClick={handleDelete}
            className="p-1.5 rounded bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
            title="Delete canvas"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Drag handle */}
      {mode === 'preview' && (
        <div
          className="absolute top-2 left-2 z-10 cursor-grab p-1 rounded bg-gray-200 dark:bg-gray-700"
          style={{
            opacity: selected ? 0.8 : 0,
            transition: 'opacity 0.2s',
          }}
          data-drag-handle
        >
          <GripVertical className="w-4 h-4 text-gray-500" />
        </div>
      )}

      {/* Canvas container */}
      <div
        className="overflow-hidden rounded-lg"
        style={{ width, height }}
      >
        {/* Loading state */}
        {isLoading && (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
            <span className="text-gray-500">Loading canvas...</span>
          </div>
        )}

        {/* Preview mode - static SVG image */}
        {!isLoading && mode === 'preview' && (
          <div
            className="w-full h-full cursor-pointer relative"
            onClick={enterEditMode}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt="Canvas preview"
                className="w-full h-full object-contain"
                style={{ backgroundColor: isDarkMode ? '#1e1e2e' : '#f5f5f5' }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800">
                <span className="text-gray-500">Empty canvas</span>
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-transparent hover:bg-black/5 transition-colors">
              <span
                className="px-3 py-1.5 rounded-full text-sm font-medium opacity-0 hover:opacity-100 transition-opacity"
                style={{
                  backgroundColor: isDarkMode ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)',
                  color: isDarkMode ? '#1e1e2e' : '#fff',
                }}
              >
                Click to edit
              </span>
            </div>
          </div>
        )}

        {/* Edit mode - iframe with TLDraw */}
        {!isLoading && mode === 'editing' && (
          <div className="w-full h-full relative">
            {!iframeReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-800 z-10">
                <span className="text-gray-500">Loading editor...</span>
              </div>
            )}
            <iframe
              ref={iframeRef}
              src="/canvas-editor.html"
              className="w-full h-full border-0"
              style={{ opacity: iframeReady ? 1 : 0 }}
              title="Canvas Editor"
            />
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}

export default EmbeddedCanvas
