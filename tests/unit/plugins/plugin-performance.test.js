import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginManager } from '../../../src/plugins/PluginManager.js'
import { PluginAPI, PluginAPIFactory } from '../../../src/plugins/PluginAPI.js'
import { BasePlugin } from '../../../src/plugins/core/BasePlugin.js'

// Mock Tauri APIs for performance testing
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...paths) => paths.join('/')),
  homeDir: vi.fn(() => Promise.resolve('/mock/home'))
}))

vi.mock('@tauri-apps/api/fs', () => ({
  readDir: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn(),
  writeTextFile: vi.fn()
}))

describe('Plugin System Performance Tests', () => {
  let pluginManager
  let apiFactory
  let mockEditorAPI
  let mockInvoke, mockExists, mockReadDir, mockReadTextFile

  beforeEach(async () => {
    // Setup mocks
    mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke)
    mockExists = await import('@tauri-apps/api/fs').then(m => m.exists)
    mockReadDir = await import('@tauri-apps/api/fs').then(m => m.readDir)
    mockReadTextFile = await import('@tauri-apps/api/fs').then(m => m.readTextFile)

    vi.clearAllMocks()

    mockExists.mockResolvedValue(true)
    mockInvoke.mockResolvedValue()
    mockReadDir.mockResolvedValue([])

    mockEditorAPI = {
      addExtension: vi.fn().mockReturnValue('ext-id'),
      removeExtension: vi.fn(),
      addSlashCommand: vi.fn().mockReturnValue('cmd-id'),
      removeSlashCommand: vi.fn(),
      addToolbarButton: vi.fn().mockReturnValue('btn-id'),
      removeToolbarButton: vi.fn(),
      getContent: vi.fn().mockReturnValue('content'),
      setContent: vi.fn(),
      insertContent: vi.fn(),
      getSelection: vi.fn().mockReturnValue({ from: 0, to: 10 })
    }

    pluginManager = new PluginManager()
    apiFactory = new PluginAPIFactory(mockEditorAPI)
  })

  afterEach(async () => {
    if (pluginManager) {
      await pluginManager.shutdown()
    }
    if (apiFactory) {
      await apiFactory.cleanupAll()
    }
  })

  describe('Plugin Loading Performance', () => {
    it('should load multiple plugins efficiently', async () => {
      const pluginCount = 50
      const plugins = []

      // Create mock plugins
      for (let i = 0; i < pluginCount; i++) {
        plugins.push({
          id: `plugin-${i}`,
          name: `Plugin ${i}`,
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: {}
        })
      }

      // Setup mock file system
      const mockEntries = plugins.map(plugin => ({
        name: plugin.id,
        path: `/mock/plugins/${plugin.id}`,
        children: []
      }))

      mockReadDir.mockResolvedValue(mockEntries)
      mockReadTextFile.mockImplementation((path) => {
        const pluginId = plugins.find(p => path.includes(p.id))?.id
        const plugin = plugins.find(p => p.id === pluginId)
        return Promise.resolve(JSON.stringify(plugin))
      })

      // Mock plugin class creation
      class TestPlugin extends BasePlugin {}
      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ default: TestPlugin })

      // Measure discovery time
      const discoveryStart = performance.now()
      await pluginManager.initialize()
      const discoveryTime = performance.now() - discoveryStart

      expect(pluginManager.registry.size).toBe(pluginCount)
      expect(discoveryTime).toBeLessThan(1000) // Should complete within 1 second

      // Measure loading time
      const loadingStart = performance.now()
      await pluginManager.loadAllPlugins()
      const loadingTime = performance.now() - loadingStart

      expect(pluginManager.loadedPlugins.size).toBe(pluginCount)
      expect(loadingTime).toBeLessThan(2000) // Should complete within 2 seconds

      global.import = originalImport
    })

    it('should handle plugin dependency resolution efficiently', async () => {
      // Create a complex dependency chain: A -> B -> C -> D -> E
      const plugins = [
        { id: 'plugin-e', dependencies: {} },
        { id: 'plugin-d', dependencies: { 'plugin-e': '^1.0.0' } },
        { id: 'plugin-c', dependencies: { 'plugin-d': '^1.0.0' } },
        { id: 'plugin-b', dependencies: { 'plugin-c': '^1.0.0' } },
        { id: 'plugin-a', dependencies: { 'plugin-b': '^1.0.0' } }
      ]

      plugins.forEach((plugin, index) => {
        pluginManager.registry.set(plugin.id, {
          manifest: {
            id: plugin.id,
            name: `Plugin ${plugin.id}`,
            version: '1.0.0',
            dependencies: plugin.dependencies
          }
        })
      })

      // Measure dependency resolution time
      const resolutionStart = performance.now()
      pluginManager.buildDependencyGraph()
      pluginManager.resolveLoadOrder()
      const resolutionTime = performance.now() - resolutionStart

      expect(resolutionTime).toBeLessThan(100) // Should be very fast
      expect(pluginManager.loadOrder).toEqual(['plugin-e', 'plugin-d', 'plugin-c', 'plugin-b', 'plugin-a'])
    })
  })

  describe('Memory Usage Tests', () => {
    it('should properly clean up plugin memory on unload', async () => {
      class ResourceIntensivePlugin extends BasePlugin {
        constructor() {
          super()
          this.largeData = new Array(10000).fill(0).map((_, i) => ({ id: i, data: `data-${i}` }))
          this.timers = []
          this.listeners = []
        }

        async activate() {
          await super.activate()
          
          // Create multiple resources
          for (let i = 0; i < 10; i++) {
            const timer = this.setInterval(() => {}, 1000)
            this.timers.push(timer)
            
            const listener = this.addEventListener('test', () => {})
            this.listeners.push(listener)
          }
        }

        async cleanup() {
          await super.cleanup()
          this.largeData = null
          this.timers = []
          this.listeners = []
        }
      }

      const manifest = {
        id: 'resource-plugin',
        name: 'Resource Plugin',
        version: '1.0.0'
      }

      // Create and activate plugin
      const api = apiFactory.createAPI('resource-plugin', manifest)
      const plugin = new ResourceIntensivePlugin()
      plugin.id = 'resource-plugin'
      plugin.manifest = manifest
      plugin.api = api

      await plugin.initialize(api)
      await plugin.activate()

      // Verify resources are allocated
      expect(plugin.largeData).toHaveLength(10000)
      expect(plugin.disposables.length).toBeGreaterThan(0)

      // Cleanup and verify memory is released
      await plugin.cleanup()
      await apiFactory.cleanupAPI('resource-plugin')

      expect(plugin.largeData).toBeNull()
      expect(plugin.disposables).toHaveLength(0)
      expect(plugin.timers).toHaveLength(0)
      expect(plugin.listeners).toHaveLength(0)
    })

    it('should handle memory pressure with many plugins', async () => {
      const pluginCount = 100
      const plugins = []
      const apis = []

      // Create many plugin instances
      for (let i = 0; i < pluginCount; i++) {
        const manifest = {
          id: `memory-plugin-${i}`,
          name: `Memory Plugin ${i}`,
          version: '1.0.0'
        }

        const api = apiFactory.createAPI(`memory-plugin-${i}`, manifest)
        const plugin = new BasePlugin()
        plugin.id = `memory-plugin-${i}`
        plugin.manifest = manifest
        plugin.api = api

        await plugin.initialize(api)
        
        // Add some memory usage
        plugin.data = new Array(1000).fill(i)
        plugin.addDisposable(() => { plugin.data = null })

        plugins.push(plugin)
        apis.push(api)
      }

      // Verify all plugins are created
      expect(plugins).toHaveLength(pluginCount)
      expect(apiFactory.apis.size).toBe(pluginCount)

      // Cleanup all at once
      const cleanupStart = performance.now()
      
      await Promise.all(plugins.map(plugin => plugin.cleanup()))
      await apiFactory.cleanupAll()
      
      const cleanupTime = performance.now() - cleanupStart

      // Cleanup should be efficient even with many plugins
      expect(cleanupTime).toBeLessThan(1000)
      expect(apiFactory.apis.size).toBe(0)

      // Verify memory is released
      plugins.forEach(plugin => {
        expect(plugin.disposables).toHaveLength(0)
        expect(plugin.data).toBeNull()
      })
    })
  })

  describe('API Call Performance', () => {
    it('should handle rapid API calls efficiently', async () => {
      const manifest = { id: 'perf-plugin', permissions: ['read_files', 'write_files'] }
      const api = apiFactory.createAPI('perf-plugin', manifest)

      // Mock file operations to be fast
      mockReadTextFile.mockResolvedValue('file content')

      // Perform many rapid API calls
      const callCount = 1000
      const promises = []

      const start = performance.now()
      
      for (let i = 0; i < callCount; i++) {
        promises.push(api.readFile(`/test/file-${i}.txt`))
      }

      await Promise.all(promises)
      
      const duration = performance.now() - start

      // Should handle all calls within reasonable time
      expect(duration).toBeLessThan(500)
      expect(mockReadTextFile).toHaveBeenCalledTimes(callCount)
    })

    it('should batch settings operations efficiently', async () => {
      const manifest = { id: 'settings-plugin' }
      const api = apiFactory.createAPI('settings-plugin', manifest)

      let settingsStore = {}
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'get_plugin_settings') {
          return Promise.resolve(settingsStore)
        } else if (command === 'save_plugin_settings') {
          settingsStore = args.settings
          return Promise.resolve()
        }
        return Promise.resolve()
      })

      // Perform many setting operations rapidly
      const settingCount = 100
      const promises = []

      const start = performance.now()

      for (let i = 0; i < settingCount; i++) {
        promises.push(api.setSetting(`key-${i}`, `value-${i}`))
      }

      await Promise.all(promises)

      const duration = performance.now() - start

      // Should complete within reasonable time
      expect(duration).toBeLessThan(1000)
      
      // Verify all settings were saved
      expect(Object.keys(settingsStore)).toHaveLength(settingCount)
    })
  })

  describe('Event System Performance', () => {
    it('should handle high-frequency events efficiently', async () => {
      const manifest = { id: 'event-plugin' }
      const api = apiFactory.createAPI('event-plugin', manifest)

      const eventHandlers = []
      const eventCount = 1000

      // Register many event handlers
      for (let i = 0; i < 100; i++) {
        const handler = vi.fn()
        api.on('test-event', handler)
        eventHandlers.push(handler)
      }

      // Emit many events rapidly
      const start = performance.now()

      for (let i = 0; i < eventCount; i++) {
        api.emit('test-event', { index: i })
      }

      const duration = performance.now() - start

      // Should handle all events quickly
      expect(duration).toBeLessThan(100)

      // Verify all handlers were called for each event
      eventHandlers.forEach(handler => {
        expect(handler).toHaveBeenCalledTimes(eventCount)
      })
    })

    it('should handle event listener cleanup efficiently', async () => {
      const manifest = { id: 'cleanup-plugin' }
      const api = apiFactory.createAPI('cleanup-plugin', manifest)

      const unsubscribeFunctions = []

      // Register many event listeners
      for (let i = 0; i < 1000; i++) {
        const unsubscribe = api.on(`event-${i}`, () => {})
        unsubscribeFunctions.push(unsubscribe)
      }

      // Cleanup should be fast
      const start = performance.now()
      
      unsubscribeFunctions.forEach(unsub => unsub())
      await api.cleanup()
      
      const duration = performance.now() - start

      expect(duration).toBeLessThan(100)
    })
  })

  describe('Concurrent Operations Performance', () => {
    it('should handle concurrent plugin operations efficiently', async () => {
      const pluginCount = 20
      const operations = []

      // Create multiple plugins and perform concurrent operations
      for (let i = 0; i < pluginCount; i++) {
        const manifest = {
          id: `concurrent-plugin-${i}`,
          permissions: ['read_files', 'write_files']
        }
        
        const api = apiFactory.createAPI(`concurrent-plugin-${i}`, manifest)
        
        // Concurrent operations for each plugin
        operations.push(
          api.getSetting('test-key', 'default'),
          api.setSetting('test-key', `value-${i}`),
          api.showNotification({ message: `Plugin ${i} notification` }),
          api.addExtension({ name: `Extension-${i}` })
        )
      }

      const start = performance.now()
      await Promise.all(operations)
      const duration = performance.now() - start

      // Should handle all concurrent operations efficiently
      expect(duration).toBeLessThan(1000)
      expect(operations).toHaveLength(pluginCount * 4)
    })

    it('should handle plugin lifecycle concurrency', async () => {
      const pluginCount = 10
      const plugins = []

      // Create plugins
      for (let i = 0; i < pluginCount; i++) {
        const manifest = { id: `lifecycle-plugin-${i}` }
        const api = apiFactory.createAPI(`lifecycle-plugin-${i}`, manifest)
        const plugin = new BasePlugin()
        plugin.id = `lifecycle-plugin-${i}`
        plugin.manifest = manifest
        plugin.api = api
        plugins.push(plugin)
      }

      // Concurrent initialization
      const initStart = performance.now()
      await Promise.all(plugins.map(plugin => plugin.initialize(plugin.api)))
      const initDuration = performance.now() - initStart

      expect(initDuration).toBeLessThan(500)

      // Concurrent activation
      const activateStart = performance.now()
      await Promise.all(plugins.map(plugin => plugin.activate()))
      const activateDuration = performance.now() - activateStart

      expect(activateDuration).toBeLessThan(500)

      // Concurrent cleanup
      const cleanupStart = performance.now()
      await Promise.all(plugins.map(plugin => plugin.cleanup()))
      const cleanupDuration = performance.now() - cleanupStart

      expect(cleanupDuration).toBeLessThan(500)
    })
  })

  describe('Resource Monitoring', () => {
    it('should track plugin resource usage', async () => {
      class MonitoredPlugin extends BasePlugin {
        constructor() {
          super()
          this.resourceUsage = {
            memoryAllocated: 0,
            timersCreated: 0,
            listenersRegistered: 0,
            apiCallsMade: 0
          }
        }

        async activate() {
          await super.activate()
          
          // Simulate resource allocation
          this.data = new Array(1000).fill(0)
          this.resourceUsage.memoryAllocated += 1000

          // Create timers
          for (let i = 0; i < 5; i++) {
            this.setInterval(() => {}, 1000)
            this.resourceUsage.timersCreated++
          }

          // Register listeners
          for (let i = 0; i < 3; i++) {
            this.addEventListener('test', () => {})
            this.resourceUsage.listenersRegistered++
          }
        }

        async apiCall(method, ...args) {
          this.resourceUsage.apiCallsMade++
          return await this.api[method](...args)
        }

        getResourceUsage() {
          return {
            ...this.resourceUsage,
            disposablesCount: this.disposables.length,
            isActive: this.isActive
          }
        }
      }

      const manifest = { id: 'monitored-plugin' }
      const api = apiFactory.createAPI('monitored-plugin', manifest)
      const plugin = new MonitoredPlugin()
      plugin.id = 'monitored-plugin'
      plugin.manifest = manifest
      plugin.api = api

      await plugin.initialize(api)
      await plugin.activate()

      // Check resource usage
      const usage = plugin.getResourceUsage()
      expect(usage.memoryAllocated).toBe(1000)
      expect(usage.timersCreated).toBe(5)
      expect(usage.listenersRegistered).toBe(3)
      expect(usage.disposablesCount).toBeGreaterThan(0)
      expect(usage.isActive).toBe(true)

      // Cleanup and verify resource release
      await plugin.cleanup()
      const finalUsage = plugin.getResourceUsage()
      expect(finalUsage.disposablesCount).toBe(0)
      expect(finalUsage.isActive).toBe(false)
    })
  })
})