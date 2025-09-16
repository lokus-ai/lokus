import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginManager } from '../../../src/plugins/PluginManager.js'
import { PluginAPI, PluginAPIFactory } from '../../../src/plugins/PluginAPI.js'
import { BasePlugin } from '../../../src/plugins/core/BasePlugin.js'

// Mock Tauri APIs
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

describe('Plugin System Integration', () => {
  let pluginManager
  let apiFactory
  let mockEditorAPI
  let mockInvoke, mockExists, mockReadDir, mockReadTextFile, mockWriteTextFile

  beforeEach(async () => {
    // Setup mocks
    mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke)
    mockExists = await import('@tauri-apps/api/fs').then(m => m.exists)
    mockReadDir = await import('@tauri-apps/api/fs').then(m => m.readDir)
    mockReadTextFile = await import('@tauri-apps/api/fs').then(m => m.readTextFile)
    mockWriteTextFile = await import('@tauri-apps/api/fs').then(m => m.writeTextFile)

    vi.clearAllMocks()

    // Setup default mock responses
    mockExists.mockResolvedValue(true)
    mockInvoke.mockResolvedValue()
    mockReadDir.mockResolvedValue([])

    // Mock editor API
    mockEditorAPI = {
      addExtension: vi.fn().mockReturnValue('ext-id'),
      removeExtension: vi.fn(),
      addSlashCommand: vi.fn().mockReturnValue('cmd-id'),
      removeSlashCommand: vi.fn(),
      addToolbarButton: vi.fn().mockReturnValue('btn-id'),
      removeToolbarButton: vi.fn(),
      getContent: vi.fn().mockReturnValue('editor content'),
      setContent: vi.fn(),
      insertContent: vi.fn(),
      getSelection: vi.fn().mockReturnValue({ from: 0, to: 10 })
    }

    // Create instances
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

  describe('Complete Plugin Installation Workflow', () => {
    it('should handle complete plugin installation, activation, and cleanup', async () => {
      // Step 1: Setup plugin discovery
      const pluginManifest = {
        id: 'test-integration-plugin',
        name: 'Test Integration Plugin',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '1.0.0',
        permissions: ['read_files', 'write_files'],
        dependencies: {}
      }

      const mockPluginEntries = [{
        name: 'test-integration-plugin',
        path: '/mock/home/.lokus/plugins/test-integration-plugin',
        children: []
      }]

      mockReadDir.mockResolvedValue(mockPluginEntries)
      mockReadTextFile.mockResolvedValue(JSON.stringify(pluginManifest))

      // Step 2: Create mock plugin class
      class TestPlugin extends BasePlugin {
        async activate() {
          await super.activate()
          this.registerCommand({
            name: 'testCommand',
            description: 'Test command from integration test',
            action: () => this.insertContent('Test content')
          })
          this.registerExtension({ name: 'TestExtension' })
        }
      }

      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ default: TestPlugin })

      // Step 3: Initialize and discover plugins
      await pluginManager.initialize()

      expect(pluginManager.registry.size).toBe(1)
      expect(pluginManager.registry.has('test-integration-plugin')).toBe(true)

      // Step 4: Load plugin
      await pluginManager.loadPlugin('test-integration-plugin')

      expect(pluginManager.loadedPlugins.has('test-integration-plugin')).toBe(true)
      const plugin = pluginManager.getPlugin('test-integration-plugin')
      expect(plugin).toBeInstanceOf(TestPlugin)

      // Step 5: Create and assign API
      const api = apiFactory.createAPI('test-integration-plugin', pluginManifest)
      plugin.api = api
      await plugin.initialize(api)

      // Step 6: Activate plugin
      await pluginManager.activatePlugin('test-integration-plugin')

      expect(pluginManager.activePlugins.has('test-integration-plugin')).toBe(true)
      expect(plugin.isActive).toBe(true)

      // Verify command and extension were registered
      expect(mockEditorAPI.addSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'testCommand',
          description: 'Test command from integration test'
        })
      )
      expect(mockEditorAPI.addExtension).toHaveBeenCalledWith({ name: 'TestExtension' }, {})

      // Step 7: Test plugin functionality
      const registrations = api.getRegistrations()
      expect(registrations.slashCommands).toHaveLength(1)
      expect(registrations.extensions).toHaveLength(1)

      // Step 8: Deactivate plugin
      await pluginManager.deactivatePlugin('test-integration-plugin')

      expect(pluginManager.activePlugins.has('test-integration-plugin')).toBe(false)
      expect(plugin.isActive).toBe(false)

      // Step 9: Unload plugin
      await pluginManager.unloadPlugin('test-integration-plugin')

      expect(pluginManager.loadedPlugins.has('test-integration-plugin')).toBe(false)
      expect(pluginManager.plugins.has('test-integration-plugin')).toBe(false)

      // Step 10: Cleanup
      await apiFactory.cleanupAPI('test-integration-plugin')

      expect(apiFactory.apis.has('test-integration-plugin')).toBe(false)

      global.import = originalImport
    })

    it('should handle plugin installation failure recovery', async () => {
      const pluginManifest = {
        id: 'failing-plugin',
        name: 'Failing Plugin',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '1.0.0'
      }

      const mockPluginEntries = [{
        name: 'failing-plugin',
        path: '/mock/home/.lokus/plugins/failing-plugin',
        children: []
      }]

      mockReadDir.mockResolvedValue(mockPluginEntries)
      mockReadTextFile.mockResolvedValue(JSON.stringify(pluginManifest))

      // Mock plugin that throws during activation
      class FailingPlugin extends BasePlugin {
        async activate() {
          throw new Error('Plugin activation failed')
        }
      }

      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ default: FailingPlugin })

      await pluginManager.initialize()
      await pluginManager.loadPlugin('failing-plugin')

      // Create API for the failing plugin
      const api = apiFactory.createAPI('failing-plugin', pluginManifest)
      const plugin = pluginManager.getPlugin('failing-plugin')
      plugin.api = api
      await plugin.initialize(api)

      // Activation should fail
      await expect(pluginManager.activatePlugin('failing-plugin'))
        .rejects.toThrow('Plugin activation failed')

      // Plugin should be marked as error
      expect(pluginManager.getPluginInfo('failing-plugin').status).toBe('error')
      expect(pluginManager.activePlugins.has('failing-plugin')).toBe(false)

      // System should still be functional for other plugins
      expect(pluginManager.loadedPlugins.has('failing-plugin')).toBe(true)

      global.import = originalImport
    })
  })

  describe('Plugin Dependency Resolution Integration', () => {
    it('should handle complex dependency chains', async () => {
      const plugins = {
        'core-plugin': {
          id: 'core-plugin',
          name: 'Core Plugin',
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: {}
        },
        'feature-plugin': {
          id: 'feature-plugin',
          name: 'Feature Plugin',
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: { 'core-plugin': '^1.0.0' }
        },
        'ui-plugin': {
          id: 'ui-plugin',
          name: 'UI Plugin',
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: { 'feature-plugin': '^1.0.0', 'core-plugin': '^1.0.0' }
        }
      }

      const loadOrder = []
      const activationOrder = []

      const createMockPlugin = (id) => {
        return class MockPlugin extends BasePlugin {
          async activate() {
            await super.activate()
            activationOrder.push(id)
          }
        }
      }

      // Setup mock entries
      const mockEntries = Object.keys(plugins).map(id => ({
        name: id,
        path: `/mock/home/.lokus/plugins/${id}`,
        children: []
      }))

      mockReadDir.mockResolvedValue(mockEntries)
      mockReadTextFile.mockImplementation((path) => {
        const pluginId = Object.keys(plugins).find(id => path.includes(id))
        return Promise.resolve(JSON.stringify(plugins[pluginId]))
      })

      const originalImport = global.import
      global.import = vi.fn().mockImplementation((path) => {
        const pluginId = Object.keys(plugins).find(id => path.includes(id))
        loadOrder.push(pluginId)
        return Promise.resolve({ default: createMockPlugin(pluginId) })
      })

      // Initialize and load all plugins
      await pluginManager.initialize()

      // Verify dependency order in loading
      expect(loadOrder.indexOf('core-plugin')).toBeLessThan(loadOrder.indexOf('feature-plugin'))
      expect(loadOrder.indexOf('feature-plugin')).toBeLessThan(loadOrder.indexOf('ui-plugin'))

      // Create APIs for all plugins
      for (const [id, manifest] of Object.entries(plugins)) {
        const api = apiFactory.createAPI(id, manifest)
        const plugin = pluginManager.getPlugin(id)
        plugin.api = api
        await plugin.initialize(api)
      }

      // Activate main plugin (should activate dependencies first)
      await pluginManager.activatePlugin('ui-plugin')

      // Verify activation order
      expect(activationOrder.indexOf('core-plugin')).toBeLessThan(activationOrder.indexOf('feature-plugin'))
      expect(activationOrder.indexOf('feature-plugin')).toBeLessThan(activationOrder.indexOf('ui-plugin'))

      // All should be active
      expect(pluginManager.activePlugins.has('core-plugin')).toBe(true)
      expect(pluginManager.activePlugins.has('feature-plugin')).toBe(true)
      expect(pluginManager.activePlugins.has('ui-plugin')).toBe(true)

      global.import = originalImport
    })

    it('should handle circular dependency detection', async () => {
      const plugins = {
        'plugin-a': {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: { 'plugin-b': '^1.0.0' }
        },
        'plugin-b': {
          id: 'plugin-b',
          name: 'Plugin B',
          version: '1.0.0',
          main: 'index.js',
          lokusVersion: '1.0.0',
          dependencies: { 'plugin-a': '^1.0.0' }
        }
      }

      const mockEntries = Object.keys(plugins).map(id => ({
        name: id,
        path: `/mock/home/.lokus/plugins/${id}`,
        children: []
      }))

      mockReadDir.mockResolvedValue(mockEntries)
      mockReadTextFile.mockImplementation((path) => {
        const pluginId = Object.keys(plugins).find(id => path.includes(id))
        return Promise.resolve(JSON.stringify(plugins[pluginId]))
      })

      await pluginManager.initialize()

      // Should detect circular dependency
      expect(() => pluginManager.resolveLoadOrder())
        .toThrow('Circular dependency detected')
    })
  })

  describe('Plugin API Integration with Editor', () => {
    it('should integrate plugin with editor functionality', async () => {
      class EditorPlugin extends BasePlugin {
        async activate() {
          await super.activate()
          
          // Register various editor integrations
          this.registerCommand({
            name: 'insertText',
            description: 'Insert text at cursor',
            action: () => this.insertContent('Hello from plugin!')
          })

          this.registerExtension({
            name: 'TestExtension',
            create: () => ({ /* extension implementation */ })
          })

          this.registerToolbarButton({
            name: 'testButton',
            icon: 'test-icon',
            tooltip: 'Test Button',
            onClick: () => this.showNotification('Button clicked!')
          })

          // Test editor content manipulation
          const content = this.getEditorContent()
          this.setEditorContent(content + '\\n\\nModified by plugin')
        }
      }

      const manifest = {
        id: 'editor-plugin',
        name: 'Editor Plugin',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '1.0.0',
        permissions: ['read_files', 'write_files']
      }

      // Setup plugin
      const api = apiFactory.createAPI('editor-plugin', manifest)
      const plugin = new EditorPlugin()
      plugin.id = 'editor-plugin'
      plugin.manifest = manifest
      plugin.api = api

      await plugin.initialize(api)
      await plugin.activate()

      // Verify editor integrations
      expect(mockEditorAPI.addSlashCommand).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'insertText',
          description: 'Insert text at cursor'
        })
      )

      expect(mockEditorAPI.addExtension).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'TestExtension' }),
        {}
      )

      expect(mockEditorAPI.addToolbarButton).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'testButton',
          icon: 'test-icon',
          tooltip: 'Test Button'
        })
      )

      // Verify editor content manipulation
      expect(mockEditorAPI.getContent).toHaveBeenCalled()
      expect(mockEditorAPI.setContent).toHaveBeenCalledWith(
        'editor content\\n\\nModified by plugin'
      )

      // Test plugin cleanup
      await plugin.cleanup()

      expect(mockEditorAPI.removeSlashCommand).toHaveBeenCalled()
      expect(mockEditorAPI.removeExtension).toHaveBeenCalled()
      expect(mockEditorAPI.removeToolbarButton).toHaveBeenCalled()
    })
  })

  describe('Plugin Settings Integration', () => {
    it('should handle plugin settings persistence', async () => {
      const manifest = {
        id: 'settings-plugin',
        name: 'Settings Plugin',
        version: '1.0.0',
        permissions: ['read_files', 'write_files']
      }

      const api = apiFactory.createAPI('settings-plugin', manifest)

      // Mock settings storage
      let storedSettings = {}
      mockInvoke.mockImplementation((command, args) => {
        if (command === 'get_plugin_settings') {
          return Promise.resolve(storedSettings)
        } else if (command === 'save_plugin_settings') {
          storedSettings = args.settings
          return Promise.resolve()
        }
        return Promise.resolve()
      })

      // Test setting values
      await api.setSetting('theme', 'dark')
      await api.setSetting('fontSize', 14)

      expect(storedSettings).toEqual({
        theme: 'dark',
        fontSize: 14
      })

      // Test getting values
      const theme = await api.getSetting('theme')
      const fontSize = await api.getSetting('fontSize')
      const unknown = await api.getSetting('unknown', 'default')

      expect(theme).toBe('dark')
      expect(fontSize).toBe(14)
      expect(unknown).toBe('default')
    })
  })

  describe('Plugin Performance and Memory Management', () => {
    it('should properly cleanup resources during plugin lifecycle', async () => {
      const pluginInstances = []
      const apiInstances = []

      // Create multiple plugin instances
      for (let i = 0; i < 5; i++) {
        const manifest = {
          id: `plugin-${i}`,
          name: `Plugin ${i}`,
          version: '1.0.0',
          permissions: ['read_files']
        }

        const api = apiFactory.createAPI(`plugin-${i}`, manifest)
        apiInstances.push(api)

        const plugin = new BasePlugin()
        plugin.id = `plugin-${i}`
        plugin.manifest = manifest
        plugin.api = api

        await plugin.initialize(api)
        pluginInstances.push(plugin)

        // Add some disposables to track cleanup
        plugin.addDisposable(() => {})
        plugin.addDisposable({ dispose: vi.fn() })
      }

      // Verify instances created
      expect(pluginInstances).toHaveLength(5)
      expect(apiInstances).toHaveLength(5)
      expect(apiFactory.apis.size).toBe(5)

      // Cleanup all instances
      for (const plugin of pluginInstances) {
        await plugin.cleanup()
      }

      await apiFactory.cleanupAll()

      // Verify cleanup
      pluginInstances.forEach(plugin => {
        expect(plugin.disposables).toHaveLength(0)
      })

      expect(apiFactory.apis.size).toBe(0)
    })

    it('should handle memory cleanup during plugin unloading', async () => {
      const cleanupSpies = []

      class ResourcePlugin extends BasePlugin {
        async activate() {
          await super.activate()
          
          // Simulate resource allocation
          this.timer = this.setInterval(() => {}, 1000)
          this.listener = this.addEventListener('test', () => {})
          
          // Track cleanup calls
          const cleanupSpy = vi.fn()
          cleanupSpies.push(cleanupSpy)
          this.addDisposable(cleanupSpy)
        }
      }

      const manifest = {
        id: 'resource-plugin',
        name: 'Resource Plugin',
        version: '1.0.0'
      }

      const api = apiFactory.createAPI('resource-plugin', manifest)
      const plugin = new ResourcePlugin()
      plugin.id = 'resource-plugin'
      plugin.manifest = manifest
      plugin.api = api

      await plugin.initialize(api)
      await plugin.activate()

      // Verify resources were allocated
      expect(plugin.disposables.length).toBeGreaterThan(0)

      // Cleanup plugin
      await plugin.cleanup()

      // Verify all cleanup functions were called
      cleanupSpies.forEach(spy => {
        expect(spy).toHaveBeenCalled()
      })

      expect(plugin.disposables).toHaveLength(0)
    })
  })

  describe('Error Recovery and Resilience', () => {
    it('should handle plugin errors without affecting other plugins', async () => {
      class StablePlugin extends BasePlugin {
        async activate() {
          await super.activate()
          this.registerCommand({
            name: 'stableCommand',
            action: () => this.insertContent('Stable plugin works')
          })
        }
      }

      class ErrorPlugin extends BasePlugin {
        async activate() {
          await super.activate()
          throw new Error('Plugin error')
        }
      }

      // Create APIs and plugins
      const stableAPI = apiFactory.createAPI('stable-plugin', { id: 'stable-plugin' })
      const errorAPI = apiFactory.createAPI('error-plugin', { id: 'error-plugin' })

      const stablePlugin = new StablePlugin()
      stablePlugin.id = 'stable-plugin'
      stablePlugin.api = stableAPI

      const errorPlugin = new ErrorPlugin()
      errorPlugin.id = 'error-plugin'
      errorPlugin.api = errorAPI

      await stablePlugin.initialize(stableAPI)
      await errorPlugin.initialize(errorAPI)

      // Stable plugin should activate successfully
      await stablePlugin.activate()
      expect(stablePlugin.isActive).toBe(true)
      expect(mockEditorAPI.addSlashCommand).toHaveBeenCalled()

      // Error plugin should fail but not affect stable plugin
      await expect(errorPlugin.activate()).rejects.toThrow('Plugin error')
      expect(errorPlugin.isActive).toBe(false)
      expect(stablePlugin.isActive).toBe(true)

      // Stable plugin should still work
      expect(stablePlugin.getStatus().active).toBe(true)
    })
  })
})