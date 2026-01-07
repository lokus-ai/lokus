import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useImageViewer } from './useImageViewer.js'

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}))

import { invoke } from '@tauri-apps/api/core'

describe('useImageViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('initialization', () => {
    it('should initialize with default values', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/path/to/image.png'))

      expect(result.current.imagePath).toBe('/path/to/image.png')
      expect(result.current.loading).toBe(true)
      expect(result.current.error).toBeNull()
      expect(result.current.zoom).toBe(1)
      expect(result.current.position).toEqual({ x: 0, y: 0 })
      expect(result.current.isDragging).toBe(false)
    })

    it('should handle null initial path', () => {
      const { result } = renderHook(() => useImageViewer(null))

      expect(result.current.imagePath).toBeNull()
      expect(result.current.imageData).toBeNull()
    })
  })

  describe('loading local files', () => {
    it('should load local image via Tauri invoke', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/workspace/image.png'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(invoke).toHaveBeenCalledWith('read_image_file', { path: '/workspace/image.png' })
      expect(result.current.imageData).toBe('data:image/png;base64,abc123')
    })

    it('should set error on load failure', async () => {
      const error = new Error('File not found')
      invoke.mockRejectedValue(error)

      const { result } = renderHook(() => useImageViewer('/workspace/missing.png'))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.error).toBe(error)
      expect(result.current.imageData).toBeNull()
    })
  })

  describe('loading data URLs', () => {
    it('should use data URL directly without invoking backend', async () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo='

      const { result } = renderHook(() => useImageViewer(dataUrl))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(invoke).not.toHaveBeenCalled()
      expect(result.current.imageData).toBe(dataUrl)
    })

    it('should set embedded image info for data URLs', async () => {
      const dataUrl = 'data:image/png;base64,abc123'

      const { result } = renderHook(() => useImageViewer(dataUrl))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(result.current.imageInfo).toEqual({
        name: 'Embedded Image',
        path: null,
        size: null,
        modified: null,
        created: null,
      })
    })
  })

  describe('loading external URLs', () => {
    it('should handle https URLs directly', async () => {
      const url = 'https://example.com/image.png'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(invoke).not.toHaveBeenCalled()
      expect(result.current.imageData).toBe(url)
    })

    it('should handle http URLs directly', async () => {
      const url = 'http://example.com/image.png'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(invoke).not.toHaveBeenCalled()
      expect(result.current.imageData).toBe(url)
    })

    it('should extract filename from external URL', async () => {
      const url = 'https://example.com/path/to/my-image.png'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.imageInfo).toBeDefined()
      })

      expect(result.current.imageInfo.name).toBe('my-image.png')
      expect(result.current.imageInfo.path).toBe(url)
    })

    it('should handle external URLs with encoded characters', async () => {
      const url = 'https://example.com/my%20image%20file.png'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.imageInfo).toBeDefined()
      })

      expect(result.current.imageInfo.name).toBe('my image file.png')
    })

    it('should handle invalid URLs gracefully', async () => {
      // This is actually a valid enough URL for the regex, but let's test edge case
      const url = 'https://example.com/'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      // Should not crash
      expect(result.current.imageData).toBe(url)
    })

    it('should handle HTTPS with uppercase', async () => {
      const url = 'HTTPS://EXAMPLE.COM/image.png'

      const { result } = renderHook(() => useImageViewer(url))

      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })

      expect(invoke).not.toHaveBeenCalled()
      expect(result.current.imageData).toBe(url)
    })
  })

  describe('zoom controls', () => {
    it('should zoom in', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.zoomIn()
      })

      expect(result.current.zoom).toBe(1.25)
    })

    it('should zoom out', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.zoomIn() // zoom to 1.25
        result.current.zoomIn() // zoom to 1.5
        result.current.zoomOut() // zoom back to 1.25
      })

      expect(result.current.zoom).toBe(1.25)
    })

    it('should not zoom beyond max (5)', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        // Zoom in many times
        for (let i = 0; i < 20; i++) {
          result.current.zoomIn()
        }
      })

      expect(result.current.zoom).toBe(5)
    })

    it('should not zoom below min (0.25)', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        // Zoom out many times
        for (let i = 0; i < 10; i++) {
          result.current.zoomOut()
        }
      })

      expect(result.current.zoom).toBe(0.25)
    })

    it('should reset zoom and position', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.zoomIn()
        result.current.zoomIn()
        result.current.resetZoom()
      })

      expect(result.current.zoom).toBe(1)
      expect(result.current.position).toEqual({ x: 0, y: 0 })
    })
  })

  describe('pan controls', () => {
    it('should not allow dragging when zoom is 1', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.handleMouseDown({ clientX: 100, clientY: 100 })
      })

      expect(result.current.isDragging).toBe(false)
    })

    it('should allow dragging when zoomed in', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      // First zoom in
      act(() => {
        result.current.zoomIn() // zoom to 1.25
      })

      // Then start dragging (separate act)
      act(() => {
        result.current.handleMouseDown({ clientX: 100, clientY: 100 })
      })

      expect(result.current.isDragging).toBe(true)
    })

    it('should update position on mouse move while dragging', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.zoomIn()
      })

      act(() => {
        result.current.handleMouseDown({ clientX: 100, clientY: 100 })
      })

      act(() => {
        result.current.handleMouseMove({ clientX: 150, clientY: 120 })
      })

      expect(result.current.position.x).toBe(50)
      expect(result.current.position.y).toBe(20)
    })

    it('should stop dragging on mouse up', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.zoomIn()
      })

      act(() => {
        result.current.handleMouseDown({ clientX: 100, clientY: 100 })
      })

      expect(result.current.isDragging).toBe(true)

      act(() => {
        result.current.handleMouseUp()
      })

      expect(result.current.isDragging).toBe(false)
    })

    it('should not update position when not dragging', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))
      const initialPosition = { ...result.current.position }

      act(() => {
        result.current.handleMouseMove({ clientX: 200, clientY: 200 })
      })

      expect(result.current.position).toEqual(initialPosition)
    })
  })

  describe('wheel zoom', () => {
    it('should zoom in on wheel up', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.handleWheel({
          preventDefault: vi.fn(),
          deltaY: -100 // scroll up
        })
      })

      expect(result.current.zoom).toBeGreaterThan(1)
    })

    it('should zoom out on wheel down', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))

      act(() => {
        result.current.handleWheel({
          preventDefault: vi.fn(),
          deltaY: 100 // scroll down
        })
      })

      expect(result.current.zoom).toBeLessThan(1)
    })

    it('should call preventDefault', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() => useImageViewer('/image.png'))
      const preventDefault = vi.fn()

      act(() => {
        result.current.handleWheel({ preventDefault, deltaY: 100 })
      })

      expect(preventDefault).toHaveBeenCalled()
    })
  })

  describe('navigation', () => {
    const allImageFiles = [
      { path: '/images/image1.png', name: 'image1.png' },
      { path: '/images/image2.png', name: 'image2.png' },
      { path: '/images/image3.png', name: 'image3.png' },
    ]

    it('should navigate to next image', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', allImageFiles)
      )

      act(() => {
        result.current.goToNext()
      })

      expect(result.current.imagePath).toBe('/images/image2.png')
    })

    it('should wrap around to first image after last', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image3.png', allImageFiles)
      )

      act(() => {
        result.current.goToNext()
      })

      expect(result.current.imagePath).toBe('/images/image1.png')
    })

    it('should navigate to previous image', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image2.png', allImageFiles)
      )

      act(() => {
        result.current.goToPrev()
      })

      expect(result.current.imagePath).toBe('/images/image1.png')
    })

    it('should wrap around to last image before first', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', allImageFiles)
      )

      act(() => {
        result.current.goToPrev()
      })

      expect(result.current.imagePath).toBe('/images/image3.png')
    })

    it('should handle empty allImageFiles', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', [])
      )

      act(() => {
        result.current.goToNext()
        result.current.goToPrev()
      })

      // Should not crash, path unchanged
      expect(result.current.imagePath).toBe('/images/image1.png')
    })

    it('should handle undefined allImageFiles', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', undefined)
      )

      act(() => {
        result.current.goToNext()
      })

      // Should not crash
      expect(result.current.imagePath).toBe('/images/image1.png')
    })

    it('should handle image not in allImageFiles', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/unknown.png', allImageFiles)
      )

      act(() => {
        result.current.goToNext()
      })

      // Should not crash, path unchanged
      expect(result.current.imagePath).toBe('/images/unknown.png')
    })

    it('should call onPathChange when navigating', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')
      const onPathChange = vi.fn()

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', allImageFiles, onPathChange)
      )

      act(() => {
        result.current.goToNext()
      })

      expect(onPathChange).toHaveBeenCalledWith('/images/image2.png')
    })

    it('should reset zoom when navigating', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png', allImageFiles)
      )

      act(() => {
        result.current.zoomIn()
        result.current.zoomIn()
      })

      expect(result.current.zoom).toBeGreaterThan(1)

      act(() => {
        result.current.goToNext()
      })

      expect(result.current.zoom).toBe(1)
    })
  })

  describe('navigateToImage', () => {
    it('should navigate to specific image', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png')
      )

      act(() => {
        result.current.navigateToImage('/images/other.png')
      })

      expect(result.current.imagePath).toBe('/images/other.png')
    })

    it('should reset zoom and position', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const { result } = renderHook(() =>
        useImageViewer('/images/image1.png')
      )

      act(() => {
        result.current.zoomIn()
        result.current.navigateToImage('/images/other.png')
      })

      expect(result.current.zoom).toBe(1)
      expect(result.current.position).toEqual({ x: 0, y: 0 })
    })
  })

  describe('imageInfo for local files', () => {
    it('should extract image info from allImageFiles', async () => {
      invoke.mockResolvedValue('data:image/png;base64,abc123')

      const allImageFiles = [
        {
          path: '/images/photo.png',
          name: 'photo.png',
          size: 12345,
          modified: '2024-01-01',
          created: '2023-12-01',
        }
      ]

      const { result } = renderHook(() =>
        useImageViewer('/images/photo.png', allImageFiles)
      )

      await waitFor(() => {
        expect(result.current.imageInfo).toBeDefined()
      })

      expect(result.current.imageInfo).toEqual({
        name: 'photo.png',
        path: '/images/photo.png',
        size: 12345,
        modified: '2024-01-01',
        created: '2023-12-01',
      })
    })
  })
})
