import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginManager } from '../../../src/core/plugins/PluginManager'
import { PluginAPI } from '../../../src/core/plugins/PluginAPI'
import { PluginLoader } from '../../../src/core/plugins/PluginLoader'

describe('Plugin Lifecycle Integration', () => {
  let pluginManager
  let pluginLoader
  let mockEditor
  let testPlugin

  beforeEach(async () => {
    mockEditor = createMockEditor()
    pluginManager = new PluginManager()
    pluginLoader = new PluginLoader()
    
    testPlugin = createTestPlugin()
  })

  afterEach(async () => {
    if (pluginManager.isRegistered('test-plugin')) {
      await pluginManager.unregister('test-plugin')
    }
  })

  describe('Complete Plugin Registration Flow', () => {
    it('should complete full plugin registration workflow', async () => {
      // 1. Load plugin
      const loadedPlugin = await pluginLoader.loadFromManifest(testPlugin.manifest, testPlugin.code)
      expect(loadedPlugin).toBeDefined()
      
      // 2. Register plugin
      await pluginManager.register(loadedPlugin)
      expect(pluginManager.isRegistered('test-plugin')).toBe(true)
      
      // 3. Verify activation
      expect(loadedPlugin.activate).toHaveBeenCalledWith(expect.any(PluginAPI))
      
      // 4. Check plugin state
      const registeredPlugin = pluginManager.getPlugin('test-plugin')
      expect(registeredPlugin.state).toBe('active')
    })

    it('should handle plugin registration errors gracefully', async () => {
      const faultyPlugin = createTestPlugin({
        activate: vi.fn().mockRejectedValue(new Error('Activation failed'))
      })

      const loadedPlugin = await pluginLoader.loadFromManifest(faultyPlugin.manifest, faultyPlugin.code)
      
      await expect(pluginManager.register(loadedPlugin))
        .rejects.toThrow('Failed to activate plugin')
      
      expect(pluginManager.isRegistered('test-plugin')).toBe(false)
    })
  })

  describe('Plugin API Integration', () => {
    it('should provide working editor API to plugin', async () => {
      const plugin = createTestPlugin({
        activate: vi.fn().mockImplementation((api) => {
          // Test editor API functionality
          api.editor.insertContent('Hello from plugin!')
          api.editor.focus()
        })
      })

      const loadedPlugin = await pluginLoader.loadFromManifest(plugin.manifest, plugin.code)
      await pluginManager.register(loadedPlugin)
      
      expect(mockEditor.commands.insertContent).toHaveBeenCalledWith('Hello from plugin!')
      expect(mockEditor.commands.focus).toHaveBeenCalled()
    })

    it('should enable plugin command registration and execution', async () => {
      const commandHandler = vi.fn().mockResolvedValue('Command executed')
      
      const plugin = createTestPlugin({
        activate: vi.fn().mockImplementation((api) => {
          api.commands.registerCommand('test.command', commandHandler)
        })
      })

      const loadedPlugin = await pluginLoader.loadFromManifest(plugin.manifest, plugin.code)
      await pluginManager.register(loadedPlugin)
      
      // Execute the registered command
      const result = await pluginManager.executeCommand('test.command', { param: 'value' })
      
      expect(commandHandler).toHaveBeenCalledWith({ param: 'value' })
      expect(result).toBe('Command executed')
    })

    it('should support plugin storage operations', async () => {
      const plugin = createTestPlugin({
        activate: vi.fn().mockImplementation(async (api) => {
          await api.storage.set('test-key', { data: 'test-value' })
          const retrieved = await api.storage.get('test-key')
          expect(retrieved.data).toBe('test-value')
        })
      })

      const loadedPlugin = await pluginLoader.loadFromManifest(plugin.manifest, plugin.code)
      await pluginManager.register(loadedPlugin)
      
      // Verify the storage operations worked
      expect(plugin.activate).toHaveBeenCalled()
    })
  })

  describe('Plugin Communication', () => {
    it('should enable inter-plugin communication via events', async () => {
      const senderPlugin = createTestPlugin({
        manifest: { ...testPlugin.manifest, id: 'sender-plugin' },
        activate: vi.fn().mockImplementation((api) => {
          // Send event after short delay
          setTimeout(() => {
            api.events.emit('test-message', { from: 'sender', data: 'hello' })
          }, 10)
        })
      })

      const receiverPlugin = createTestPlugin({
        manifest: { ...testPlugin.manifest, id: 'receiver-plugin' },
        activate: vi.fn().mockImplementation((api) => {
          api.events.subscribe('test-message', (data) => {
            expect(data.from).toBe('sender')
            expect(data.data).toBe('hello')
          })
        })
      })

      const loadedSender = await pluginLoader.loadFromManifest(senderPlugin.manifest, senderPlugin.code)
      const loadedReceiver = await pluginLoader.loadFromManifest(receiverPlugin.manifest, receiverPlugin.code)
      
      await pluginManager.register(loadedReceiver)
      await pluginManager.register(loadedSender)
      
      // Wait for event transmission
      await new Promise(resolve => setTimeout(resolve, 50))
      
      expect(senderPlugin.activate).toHaveBeenCalled()
      expect(receiverPlugin.activate).toHaveBeenCalled()
    })
  })

  describe('Plugin Dependency Management', () => {
    it('should load plugins in dependency order', async () => {
      const dependencyPlugin = createTestPlugin({
        manifest: {
          id: 'dependency-plugin',
          name: 'Dependency Plugin',
          version: '1.0.0',
          main: 'index.js'
        }
      })

      const mainPlugin = createTestPlugin({
        manifest: {
          ...testPlugin.manifest,
          id: 'main-plugin',
          dependencies: ['dependency-plugin@^1.0.0']
        }
      })

      const loadedDependency = await pluginLoader.loadFromManifest(dependencyPlugin.manifest, dependencyPlugin.code)
      const loadedMain = await pluginLoader.loadFromManifest(mainPlugin.manifest, mainPlugin.code)
      
      // Register in reverse order to test dependency resolution
      await pluginManager.register(loadedMain)
      await pluginManager.register(loadedDependency)
      
      expect(pluginManager.isRegistered('dependency-plugin')).toBe(true)
      expect(pluginManager.isRegistered('main-plugin')).toBe(true)
    })
  })

  describe('Plugin Deactivation', () => {
    it('should properly deactivate and clean up plugins', async () => {
      const cleanupSpy = vi.fn()
      
      const plugin = createTestPlugin({
        activate: vi.fn().mockImplementation((api) => {
          // Register some resources
          api.commands.registerCommand('cleanup-test', () => {})
          api.events.subscribe('test-event', () => {})
        }),
        deactivate: vi.fn().mockImplementation(() => {
          cleanupSpy()
        })
      })

      const loadedPlugin = await pluginLoader.loadFromManifest(plugin.manifest, plugin.code)
      await pluginManager.register(loadedPlugin)
      
      // Verify plugin is active
      expect(pluginManager.isRegistered('test-plugin')).toBe(true)
      
      // Deactivate plugin
      await pluginManager.unregister('test-plugin')
      
      // Verify cleanup
      expect(plugin.deactivate).toHaveBeenCalled()
      expect(cleanupSpy).toHaveBeenCalled()
      expect(pluginManager.isRegistered('test-plugin')).toBe(false)
    })
  })

  describe('Error Recovery', () => {
    it('should isolate plugin errors from system', async () => {
      const buggyPlugin = createTestPlugin({
        activate: vi.fn().mockImplementation((api) => {
          // Register a command that throws
          api.commands.registerCommand('buggy-command', () => {
            throw new Error('Plugin command failed')
          })
        })
      })

      const goodPlugin = createTestPlugin({
        manifest: { ...testPlugin.manifest, id: 'good-plugin' },
        activate: vi.fn().mockImplementation((api) => {
          api.commands.registerCommand('good-command', () => 'success')
        })
      })

      const loadedBuggy = await pluginLoader.loadFromManifest(buggyPlugin.manifest, buggyPlugin.code)
      const loadedGood = await pluginLoader.loadFromManifest(goodPlugin.manifest, goodPlugin.code)
      
      await pluginManager.register(loadedBuggy)
      await pluginManager.register(loadedGood)
      
      // Buggy command should fail
      await expect(pluginManager.executeCommand('buggy-command'))
        .rejects.toThrow('Plugin command failed')
      
      // Good command should still work
      const result = await pluginManager.executeCommand('good-command')
      expect(result).toBe('success')
    })
  })

  // Helper functions
  function createMockEditor() {
    return {
      commands: {
        insertContent: vi.fn(),
        focus: vi.fn(),
        selectAll: vi.fn()
      },
      state: {
        selection: { from: 0, to: 0 },
        doc: { content: [] }
      },
      view: {
        state: {},
        dispatch: vi.fn()
      }
    }
  }

  function createTestPlugin(overrides = {}) {
    return {
      manifest: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['editor.read', 'editor.write', 'storage.write'],
        ...overrides.manifest
      },
      code: 'export default { activate() {}, deactivate() {} }',
      activate: vi.fn(),
      deactivate: vi.fn(),
      state: 'inactive',
      ...overrides
    }
  }
})