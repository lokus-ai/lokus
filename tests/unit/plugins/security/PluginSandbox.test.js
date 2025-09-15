/**
 * Plugin Sandbox Security Tests
 * 
 * Tests the security isolation and resource management of plugin sandboxes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import PluginSandbox from '../../../../src/plugins/security/PluginSandbox.js'

// Mock Web Worker
global.Worker = vi.fn().mockImplementation((url, options) => {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null
  }
  
  // Simulate async initialization
  setTimeout(() => {
    if (worker.onmessage) {
      worker.onmessage({ data: { type: 'initialized' } })
    }
  }, 100)
  
  return worker
})

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
}

// Mock Blob
global.Blob = vi.fn().mockImplementation((parts, options) => ({
  size: parts.join('').length,
  type: options?.type || ''
}))

describe('PluginSandbox', () => {
  let sandbox
  let mockManifest

  beforeEach(() => {
    mockManifest = {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      permissions: ['editor:read', 'ui:notifications']
    }
    
    sandbox = new PluginSandbox('test-plugin', mockManifest, {
      memoryLimit: 10 * 1024 * 1024, // 10MB
      cpuTimeLimit: 500,
      maxApiCalls: 100
    })
  })

  afterEach(async () => {
    if (sandbox) {
      await sandbox.terminate()
    }
    vi.clearAllMocks()
  })

  describe('Initialization', () => {
    it('should create sandbox with security constraints', async () => {
      expect(sandbox.pluginId).toBe('test-plugin')
      expect(sandbox.manifest).toEqual(mockManifest)
      expect(sandbox.permissions.has('editor:read')).toBe(true)
      expect(sandbox.permissions.has('ui:notifications')).toBe(true)
    })

    it('should initialize worker with secure environment', async () => {
      await sandbox.initialize()
      
      expect(global.Worker).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'module',
          credentials: 'same-origin'
        })
      )
      
      expect(sandbox.isRunning).toBe(true)
    })

    it('should reject initialization if signature required but missing', async () => {
      sandbox.options.requireSignature = true
      
      await expect(sandbox.initialize()).rejects.toThrow('Plugin signature required but not found')
    })
  })

  describe('Resource Monitoring', () => {
    beforeEach(async () => {
      await sandbox.initialize()
    })

    it('should track memory usage', () => {
      // Mock performance.memory
      global.performance = {
        memory: {
          usedJSHeapSize: 5 * 1024 * 1024 // 5MB
        }
      }

      sandbox.checkResourceUsage()
      expect(sandbox.stats.memoryUsage).toBe(5 * 1024 * 1024)
    })

    it('should emit quota-exceeded when memory limit is reached', (done) => {
      global.performance = {
        memory: {
          usedJSHeapSize: 15 * 1024 * 1024 // 15MB > 10MB limit
        }
      }

      sandbox.on('quota-exceeded', (event) => {
        expect(event.type).toBe('memory')
        expect(event.usage).toBe(15 * 1024 * 1024)
        expect(event.limit).toBe(10 * 1024 * 1024)
        done()
      })

      sandbox.checkResourceUsage()
    })

    it('should enforce API call limits', (done) => {
      sandbox.stats.apiCalls = 150 // > 100 limit

      sandbox.on('quota-exceeded', (event) => {
        expect(event.type).toBe('api-calls')
        expect(event.usage).toBe(150)
        expect(event.limit).toBe(100)
        done()
      })

      sandbox.checkResourceUsage()
    })
  })

  describe('Permission Checking', () => {
    beforeEach(async () => {
      await sandbox.initialize()
    })

    it('should allow API calls with proper permissions', () => {
      expect(sandbox.hasPermissionForAPI('editor.getContent')).toBe(true)
      expect(sandbox.hasPermissionForAPI('ui.showNotification')).toBe(true)
    })

    it('should deny API calls without proper permissions', () => {
      expect(sandbox.hasPermissionForAPI('storage.set')).toBe(false)
      expect(sandbox.hasPermissionForAPI('network.fetch')).toBe(false)
    })

    it('should handle API requests with permission checking', async () => {
      const mockAPICall = vi.fn()
      sandbox.on('api-call', mockAPICall)

      await sandbox.handleAPIRequest('req1', 'editor.getContent', {})
      expect(mockAPICall).toHaveBeenCalled()

      // Should fail for unauthorized API
      sandbox.worker.postMessage = vi.fn()
      await sandbox.handleAPIRequest('req2', 'storage.set', {})
      
      expect(sandbox.worker.postMessage).toHaveBeenCalledWith({
        type: 'api-response',
        id: 'req2',
        error: 'Permission denied for API: storage.set'
      })
    })
  })

  describe('Secure Worker Code Generation', () => {
    it('should generate worker code with security restrictions', () => {
      const workerCode = sandbox.generateSecureWorkerCode()
      
      // Should remove dangerous globals
      expect(workerCode).toContain('delete self.importScripts')
      expect(workerCode).toContain('delete self.fetch')
      expect(workerCode).toContain('delete self.XMLHttpRequest')
      expect(workerCode).toContain('delete self.localStorage')
      
      // Should include API rate limiting
      expect(workerCode).toContain('checkApiLimit')
      expect(workerCode).toContain('maxApiCalls')
      
      // Should include secure API proxy
      expect(workerCode).toContain('secureAPI')
      expect(workerCode).toContain('sendSecureRequest')
    })

    it('should include proper API methods in secure proxy', () => {
      const workerCode = sandbox.generateSecureWorkerCode()
      
      // Editor API
      expect(workerCode).toContain('editor.getContent')
      expect(workerCode).toContain('editor.setContent')
      
      // UI API
      expect(workerCode).toContain('ui.showNotification')
      expect(workerCode).toContain('ui.showDialog')
      
      // Storage API
      expect(workerCode).toContain('storage.get')
      expect(workerCode).toContain('storage.set')
    })
  })

  describe('Plugin Execution', () => {
    beforeEach(async () => {
      await sandbox.initialize()
    })

    it('should execute plugin methods through worker', async () => {
      const mockWorker = sandbox.worker
      mockWorker.postMessage = vi.fn()

      // Mock successful response
      setTimeout(() => {
        sandbox.handleWorkerMessage({
          type: 'execution-result',
          id: 1,
          result: 'success'
        })
      }, 50)

      const result = await sandbox.execute('testMethod', 'arg1', 'arg2')
      
      expect(mockWorker.postMessage).toHaveBeenCalledWith({
        type: 'execute',
        id: 1,
        method: 'testMethod',
        args: ['arg1', 'arg2']
      })
      
      expect(result).toBe('success')
    })

    it('should timeout plugin execution', async () => {
      sandbox.options.cpuTimeLimit = 100 // Very short timeout
      
      // Don't send response to trigger timeout
      sandbox.worker.postMessage = vi.fn()

      await expect(sandbox.execute('slowMethod')).rejects.toThrow('Plugin execution timeout')
    })

    it('should handle plugin execution errors', async () => {
      const mockWorker = sandbox.worker
      mockWorker.postMessage = vi.fn()

      // Mock error response
      setTimeout(() => {
        sandbox.handleWorkerMessage({
          type: 'error',
          id: 1,
          error: 'Plugin method failed'
        })
      }, 50)

      await expect(sandbox.execute('failingMethod')).rejects.toThrow('Plugin method failed')
    })
  })

  describe('Statistics and Monitoring', () => {
    beforeEach(async () => {
      await sandbox.initialize()
    })

    it('should track execution statistics', () => {
      sandbox.stats.apiCalls = 50
      sandbox.stats.errors = 2
      sandbox.stats.memoryUsage = 1024 * 1024

      const stats = sandbox.getStats()
      
      expect(stats.apiCalls).toBe(50)
      expect(stats.errors).toBe(2)
      expect(stats.memoryUsage).toBe(1024 * 1024)
      expect(stats.uptime).toBeGreaterThan(0)
      expect(stats.quotaExceeded).toBe(false)
    })

    it('should emit worker errors', (done) => {
      const mockError = new Error('Worker crashed')

      sandbox.on('worker-error', (event) => {
        expect(event.pluginId).toBe('test-plugin')
        expect(event.error).toBe(mockError)
        expect(sandbox.stats.errors).toBe(1)
        done()
      })

      // Simulate worker error
      if (sandbox.worker.onerror) {
        sandbox.worker.onerror(mockError)
      }
    })
  })

  describe('Termination and Cleanup', () => {
    beforeEach(async () => {
      await sandbox.initialize()
    })

    it('should terminate worker and cleanup resources', async () => {
      const mockWorker = sandbox.worker
      mockWorker.terminate = vi.fn()
      mockWorker.postMessage = vi.fn()

      // Add pending request
      const pendingPromise = sandbox.execute('testMethod')

      await sandbox.terminate()

      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'deactivate' })
      expect(mockWorker.terminate).toHaveBeenCalled()
      expect(sandbox.isRunning).toBe(false)
      expect(sandbox.worker).toBeNull()

      // Pending requests should be rejected
      await expect(pendingPromise).rejects.toThrow('Plugin sandbox terminated')
    })

    it('should clear resource monitoring on termination', async () => {
      const resourceMonitor = sandbox.resourceMonitor
      expect(resourceMonitor).toBeDefined()

      await sandbox.terminate()

      expect(sandbox.resourceMonitor).toBeNull()
    })

    it('should emit termination event', (done) => {
      sandbox.on('terminated', (event) => {
        expect(event.pluginId).toBe('test-plugin')
        done()
      })

      sandbox.terminate()
    })
  })

  describe('Security Edge Cases', () => {
    it('should handle malformed worker messages', async () => {
      await sandbox.initialize()

      // Should not throw on invalid message
      expect(() => {
        sandbox.handleWorkerMessage(null)
      }).not.toThrow()

      expect(() => {
        sandbox.handleWorkerMessage({ type: 'unknown' })
      }).not.toThrow()
    })

    it('should prevent execution when not running', async () => {
      // Don't initialize sandbox
      await expect(sandbox.execute('testMethod')).rejects.toThrow('Plugin sandbox is not running')
    })

    it('should handle quota exceeded state', async () => {
      await sandbox.initialize()
      
      sandbox.quotaExceeded = true

      sandbox.worker.postMessage = vi.fn()
      await sandbox.handleAPIRequest('req1', 'editor.getContent', {})

      expect(sandbox.worker.postMessage).toHaveBeenCalledWith({
        type: 'api-response',
        id: 'req1',
        error: 'Resource quota exceeded'
      })
    })
  })
})