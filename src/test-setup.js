import { beforeEach, beforeAll, afterEach, afterAll, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Global test setup
beforeAll(() => {
  // Mock HTML elements that don't exist in jsdom
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: vi.fn(),
    writable: true,
  })

  Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
    value: vi.fn(() => ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      top: 0,
      width: 0,
      x: 0,
      y: 0,
    })),
    writable: true,
  })

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock PointerEvent
  global.PointerEvent = class PointerEvent extends MouseEvent {
    constructor(type, props) {
      super(type, props);
    }
  };

  // Mock setPointerCapture/releasePointerCapture
  Object.defineProperty(Element.prototype, 'setPointerCapture', {
    value: vi.fn(),
    writable: true,
  });
  Object.defineProperty(Element.prototype, 'releasePointerCapture', {
    value: vi.fn(),
    writable: true,
  });

  // Mock matchMedia
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock localStorage
  const localStorageMock = (function () {
    let store = {}
    return {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => {
        store[key] = String(value)
      }),
      removeItem: vi.fn((key) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      // Helper to inspect store in tests if needed
      _getStore: () => store
    }
  })()
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
    writable: true,
  })

  // Mock console methods to reduce noise in tests
  vi.spyOn(console, 'warn').mockImplementation(() => { })
  vi.spyOn(console, 'error').mockImplementation(() => { })
})

// Clean up after each test
afterEach(() => {
  cleanup()
  vi.clearAllMocks()

  // Clear localStorage
  localStorage.clear()
})

// Clean up after all tests
afterAll(() => {
  vi.restoreAllMocks()
})

// Global mocks that all tests need
beforeEach(() => {
  // Reset localStorage before each test
  localStorage.clear()

  // Mock window.getComputedStyle
  window.getComputedStyle = vi.fn(() => ({
    getPropertyValue: vi.fn(() => ''),
  }))
})