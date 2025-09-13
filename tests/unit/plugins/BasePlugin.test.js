import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BasePlugin, PluginUtils } from '../../../src/plugins/core/BasePlugin.js'

describe('BasePlugin', () => {
  let plugin
  let mockAPI

  beforeEach(() => {
    mockAPI = {
      addSlashCommand: vi.fn().mockReturnValue('cmd-id'),
      addExtension: vi.fn().mockReturnValue('ext-id'),
      addToolbarButton: vi.fn().mockReturnValue('btn-id'),
      registerPanel: vi.fn().mockReturnValue('panel-id'),
      showNotification: vi.fn(),
      showDialog: vi.fn().mockResolvedValue('OK'),
      getSetting: vi.fn().mockResolvedValue('value'),
      setSetting: vi.fn().mockResolvedValue(),
      on: vi.fn().mockReturnValue(() => {}),
      emit: vi.fn(),
      readFile: vi.fn().mockResolvedValue('file content'),
      writeFile: vi.fn().mockResolvedValue(),
      fileExists: vi.fn().mockResolvedValue(true),
      getEditorContent: vi.fn().mockReturnValue('<p>editor content</p>'),
      setEditorContent: vi.fn(),
      insertContent: vi.fn(),
      getSelection: vi.fn().mockReturnValue({ from: 0, to: 10 }),
      hasPermission: vi.fn().mockReturnValue(true),
      log: vi.fn()
    }

    plugin = new BasePlugin()
    plugin.id = 'test-plugin'
    plugin.manifest = {
      name: 'Test Plugin',
      version: '1.0.0',
      permissions: ['read_files']
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Initialization and Lifecycle', () => {
    it('should initialize with default values', () => {
      expect(plugin.id).toBe('test-plugin')
      expect(plugin.api).toBeNull()
      expect(plugin.isActive).toBe(false)
      expect(plugin.disposables).toEqual([])
    })

    it('should initialize with API', async () => {
      await plugin.initialize(mockAPI)
      
      expect(plugin.api).toBe(mockAPI)
      expect(plugin.logger).toBeDefined()
      expect(plugin.logger.info).toBeInstanceOf(Function)
    })

    it('should activate successfully', async () => {
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(plugin.isActive).toBe(true)
    })

    it('should deactivate successfully', async () => {
      await plugin.initialize(mockAPI)
      await plugin.activate()
      await plugin.deactivate()
      
      expect(plugin.isActive).toBe(false)
    })

    it('should cleanup disposables on cleanup', async () => {
      const disposable1 = vi.fn()
      const disposable2 = { dispose: vi.fn() }
      
      await plugin.initialize(mockAPI)
      plugin.addDisposable(disposable1)
      plugin.addDisposable(disposable2)
      
      await plugin.cleanup()
      
      expect(disposable1).toHaveBeenCalled()
      expect(disposable2.dispose).toHaveBeenCalled()
      expect(plugin.disposables).toHaveLength(0)
      expect(plugin.isActive).toBe(false)
    })

    it('should handle cleanup errors gracefully', async () => {
      const errorDisposable = () => { throw new Error('Cleanup error') }
      const validDisposable = vi.fn()
      
      await plugin.initialize(mockAPI)
      plugin.addDisposable(errorDisposable)
      plugin.addDisposable(validDisposable)
      
      // Should not throw even if one disposable fails
      await expect(plugin.cleanup()).resolves.toBeUndefined()
      expect(validDisposable).toHaveBeenCalled()
    })
  })

  describe('Disposable Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should add disposables', () => {
      const disposable = vi.fn()
      const result = plugin.addDisposable(disposable)
      
      expect(result).toBe(disposable)
      expect(plugin.disposables).toContain(disposable)
    })

    it('should remove disposables', () => {
      const disposable = vi.fn()
      plugin.addDisposable(disposable)
      plugin.removeDisposable(disposable)
      
      expect(plugin.disposables).not.toContain(disposable)
    })

    it('should handle removing non-existent disposables', () => {
      const disposable = vi.fn()
      
      // Should not throw
      expect(() => plugin.removeDisposable(disposable)).not.toThrow()
    })
  })

  describe('Command Registration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should register commands', () => {
      const command = {
        name: 'testCommand',
        description: 'Test command',
        action: vi.fn()
      }
      
      const commandId = plugin.registerCommand(command)
      
      expect(mockAPI.addSlashCommand).toHaveBeenCalledWith({
        name: 'testCommand',
        description: 'Test command',
        icon: undefined,
        action: command.action,
        shortcut: undefined
      })
      expect(commandId).toBe('cmd-id')
      expect(plugin.disposables).toHaveLength(1)
    })

    it('should throw error if API not available', () => {
      plugin.api = null
      
      expect(() => {
        plugin.registerCommand({ name: 'test' })
      }).toThrow('Plugin API not available')
    })

    it('should register command with all options', () => {
      const command = {
        name: 'testCommand',
        description: 'Test command',
        icon: 'test-icon',
        action: vi.fn(),
        shortcut: 'Ctrl+T'
      }
      
      plugin.registerCommand(command)
      
      expect(mockAPI.addSlashCommand).toHaveBeenCalledWith({
        name: 'testCommand',
        description: 'Test command',
        icon: 'test-icon',
        action: command.action,
        shortcut: 'Ctrl+T'
      })
    })
  })

  describe('Extension Registration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should register extensions', () => {
      const extension = { name: 'TestExtension' }
      const options = { priority: 100 }
      
      const extensionId = plugin.registerExtension(extension, options)
      
      expect(mockAPI.addExtension).toHaveBeenCalledWith(extension, options)
      expect(extensionId).toBe('ext-id')
      expect(plugin.disposables).toHaveLength(1)
    })

    it('should register extension without options', () => {
      const extension = { name: 'TestExtension' }
      
      plugin.registerExtension(extension)
      
      expect(mockAPI.addExtension).toHaveBeenCalledWith(extension, {})
    })
  })

  describe('Toolbar Button Registration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should register toolbar buttons', () => {
      const button = {
        name: 'testButton',
        icon: 'test-icon',
        action: vi.fn()
      }
      
      const buttonId = plugin.registerToolbarButton(button)
      
      expect(mockAPI.addToolbarButton).toHaveBeenCalledWith(button)
      expect(buttonId).toBe('btn-id')
      expect(plugin.disposables).toHaveLength(1)
    })
  })

  describe('Panel Registration', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should register panels', () => {
      const panel = {
        name: 'testPanel',
        title: 'Test Panel',
        component: 'TestComponent'
      }
      
      const panelId = plugin.registerPanel(panel)
      
      expect(mockAPI.registerPanel).toHaveBeenCalledWith(panel)
      expect(panelId).toBe('panel-id')
      expect(plugin.disposables).toHaveLength(1)
    })
  })

  describe('Notifications and Dialogs', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should show notifications with default options', () => {
      plugin.showNotification('Test message')
      
      expect(mockAPI.showNotification).toHaveBeenCalledWith({
        message: 'Test message',
        type: 'info',
        duration: 5000,
        source: 'test-plugin'
      })
    })

    it('should show notifications with custom options', () => {
      plugin.showNotification('Error message', 'error', 10000)
      
      expect(mockAPI.showNotification).toHaveBeenCalledWith({
        message: 'Error message',
        type: 'error',
        duration: 10000,
        source: 'test-plugin'
      })
    })

    it('should show dialogs', async () => {
      const options = {
        title: 'Test Dialog',
        message: 'Test message'
      }
      
      const result = await plugin.showDialog(options)
      
      expect(mockAPI.showDialog).toHaveBeenCalledWith({
        ...options,
        source: 'test-plugin'
      })
      expect(result).toBe('OK')
    })
  })

  describe('Settings Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should get settings', async () => {
      const result = await plugin.getSetting('testKey', 'defaultValue')
      
      expect(mockAPI.getSetting).toHaveBeenCalledWith('testKey', 'defaultValue')
      expect(result).toBe('value')
    })

    it('should set settings', async () => {
      await plugin.setSetting('testKey', 'testValue')
      
      expect(mockAPI.setSetting).toHaveBeenCalledWith('testKey', 'testValue')
    })
  })

  describe('Event Management', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should add event listeners', () => {
      const listener = vi.fn()
      const unsubscribe = vi.fn()
      mockAPI.on.mockReturnValue(unsubscribe)
      
      const result = plugin.addEventListener('test-event', listener)
      
      expect(mockAPI.on).toHaveBeenCalledWith('test-event', listener)
      expect(result).toBe(unsubscribe)
      expect(plugin.disposables).toContain(unsubscribe)
    })

    it('should emit events', () => {
      const data = { test: 'data' }
      plugin.emitEvent('test-event', data)
      
      expect(mockAPI.emit).toHaveBeenCalledWith('test-event', data)
    })
  })

  describe('File Operations', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should read files', async () => {
      const content = await plugin.readFile('/test/file.txt')
      
      expect(mockAPI.readFile).toHaveBeenCalledWith('/test/file.txt')
      expect(content).toBe('file content')
    })

    it('should write files', async () => {
      await plugin.writeFile('/test/file.txt', 'new content')
      
      expect(mockAPI.writeFile).toHaveBeenCalledWith('/test/file.txt', 'new content')
    })

    it('should check file existence', async () => {
      const exists = await plugin.fileExists('/test/file.txt')
      
      expect(mockAPI.fileExists).toHaveBeenCalledWith('/test/file.txt')
      expect(exists).toBe(true)
    })
  })

  describe('Editor Operations', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should get editor content', () => {
      const content = plugin.getEditorContent()
      
      expect(mockAPI.getEditorContent).toHaveBeenCalled()
      expect(content).toBe('<p>editor content</p>')
    })

    it('should set editor content', () => {
      plugin.setEditorContent('<p>new content</p>')
      
      expect(mockAPI.setEditorContent).toHaveBeenCalledWith('<p>new content</p>')
    })

    it('should insert content', () => {
      plugin.insertContent('inserted text')
      
      expect(mockAPI.insertContent).toHaveBeenCalledWith('inserted text')
    })

    it('should get selection', () => {
      const selection = plugin.getSelection()
      
      expect(mockAPI.getSelection).toHaveBeenCalled()
      expect(selection).toEqual({ from: 0, to: 10 })
    })
  })

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should create setTimeout with cleanup', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      
      const timeoutId = plugin.setTimeout(callback, 1000)
      
      expect(timeoutId).toBeDefined()
      expect(plugin.disposables).toHaveLength(1)
      
      vi.advanceTimersByTime(1000)
      expect(callback).toHaveBeenCalled()
      
      vi.useRealTimers()
    })

    it('should create setInterval with cleanup', () => {
      vi.useFakeTimers()
      const callback = vi.fn()
      
      const intervalId = plugin.setInterval(callback, 500)
      
      expect(intervalId).toBeDefined()
      expect(plugin.disposables).toHaveLength(1)
      
      vi.advanceTimersByTime(1500)
      expect(callback).toHaveBeenCalledTimes(3)
      
      vi.useRealTimers()
    })

    it('should create debounced function', () => {
      vi.useFakeTimers()
      const originalFn = vi.fn()
      const debouncedFn = plugin.debounce(originalFn, 300)
      
      expect(plugin.disposables).toHaveLength(1)
      
      debouncedFn('arg1')
      debouncedFn('arg2')
      debouncedFn('arg3')
      
      // Should not have been called yet
      expect(originalFn).not.toHaveBeenCalled()
      
      vi.advanceTimersByTime(300)
      
      // Should be called only once with the last arguments
      expect(originalFn).toHaveBeenCalledTimes(1)
      expect(originalFn).toHaveBeenCalledWith('arg3')
      
      vi.useRealTimers()
    })

    it('should create throttled function', () => {
      vi.useFakeTimers()
      const originalFn = vi.fn()
      const throttledFn = plugin.throttle(originalFn, 300)
      
      throttledFn('arg1')
      throttledFn('arg2')
      throttledFn('arg3')
      
      // Should be called immediately with first call
      expect(originalFn).toHaveBeenCalledTimes(1)
      expect(originalFn).toHaveBeenCalledWith('arg1')
      
      vi.advanceTimersByTime(300)
      
      throttledFn('arg4')
      expect(originalFn).toHaveBeenCalledTimes(2)
      expect(originalFn).toHaveBeenCalledWith('arg4')
      
      vi.useRealTimers()
    })
  })

  describe('Information Methods', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should get plugin info', () => {
      const info = plugin.getPluginInfo()
      
      expect(info).toEqual({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: '',
        author: 'Unknown',
        isActive: false,
        permissions: ['read_files'],
        dependencies: {}
      })
    })

    it('should check permissions', () => {
      const hasPermission = plugin.hasPermission('read_files')
      
      expect(mockAPI.hasPermission).toHaveBeenCalledWith('read_files')
      expect(hasPermission).toBe(true)
    })

    it('should validate readiness', () => {
      expect(() => plugin.validateReady()).not.toThrow()
      
      plugin.api = null
      expect(() => plugin.validateReady()).toThrow('Plugin API not available')
      
      plugin.api = mockAPI
      plugin.id = null
      expect(() => plugin.validateReady()).toThrow('Plugin ID not set')
      
      plugin.id = 'test-plugin'
      plugin.manifest = null
      expect(() => plugin.validateReady()).toThrow('Plugin manifest not available')
    })

    it('should get status', () => {
      const status = plugin.getStatus()
      
      expect(status).toEqual({
        initialized: true,
        active: false,
        disposableCount: 0
      })
    })
  })

  describe('Safe Async Operations', () => {
    beforeEach(async () => {
      await plugin.initialize(mockAPI)
    })

    it('should handle successful operations', async () => {
      const operation = vi.fn().mockResolvedValue('success')
      
      const result = await plugin.safeAsync(operation)
      
      expect(operation).toHaveBeenCalled()
      expect(result).toBe('success')
    })

    it('should handle failed operations with fallback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))
      
      const result = await plugin.safeAsync(operation, 'fallback')
      
      expect(operation).toHaveBeenCalled()
      expect(result).toBe('fallback')
    })

    it('should handle failed operations without fallback', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Test error'))
      
      const result = await plugin.safeAsync(operation)
      
      expect(operation).toHaveBeenCalled()
      expect(result).toBeNull()
    })
  })

  describe('API Not Available Errors', () => {
    it('should throw errors when API not available', () => {
      // Test various methods that require API
      expect(() => plugin.registerCommand({ name: 'test' })).toThrow('Plugin API not available')
      expect(() => plugin.registerExtension({ name: 'test' })).toThrow('Plugin API not available')
      expect(() => plugin.registerToolbarButton({ name: 'test' })).toThrow('Plugin API not available')
      expect(() => plugin.registerPanel({ name: 'test' })).toThrow('Plugin API not available')
      expect(() => plugin.showNotification('test')).toThrow('Plugin API not available')
      expect(() => plugin.showDialog({})).toThrow('Plugin API not available')
      expect(() => plugin.getSetting('test')).toThrow('Plugin API not available')
      expect(() => plugin.setSetting('test', 'value')).toThrow('Plugin API not available')
      expect(() => plugin.addEventListener('test', vi.fn())).toThrow('Plugin API not available')
      expect(() => plugin.emitEvent('test', {})).toThrow('Plugin API not available')
      expect(() => plugin.readFile('test')).toThrow('Plugin API not available')
      expect(() => plugin.writeFile('test', 'content')).toThrow('Plugin API not available')
      expect(() => plugin.fileExists('test')).toThrow('Plugin API not available')
      expect(() => plugin.getEditorContent()).toThrow('Plugin API not available')
      expect(() => plugin.setEditorContent('content')).toThrow('Plugin API not available')
      expect(() => plugin.insertContent('content')).toThrow('Plugin API not available')
      expect(() => plugin.getSelection()).toThrow('Plugin API not available')
    })
  })
})

describe('PluginUtils', () => {
  describe('Simple Plugin Creation', () => {
    it('should create simple plugin with callbacks', async () => {
      const onActivate = vi.fn()
      const onDeactivate = vi.fn()
      
      const SimplePluginClass = PluginUtils.createSimplePlugin({
        onActivate,
        onDeactivate
      })
      
      const plugin = new SimplePluginClass()
      const mockAPI = { log: vi.fn() }
      
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(onActivate).toHaveBeenCalled()
      expect(plugin.isActive).toBe(true)
      
      await plugin.deactivate()
      
      expect(onDeactivate).toHaveBeenCalled()
      expect(plugin.isActive).toBe(false)
    })

    it('should create simple plugin without callbacks', async () => {
      const SimplePluginClass = PluginUtils.createSimplePlugin()
      
      const plugin = new SimplePluginClass()
      const mockAPI = { log: vi.fn() }
      
      await plugin.initialize(mockAPI)
      
      // Should not throw when no callbacks provided
      await expect(plugin.activate()).resolves.toBeUndefined()
      await expect(plugin.deactivate()).resolves.toBeUndefined()
    })
  })

  describe('Command Plugin Creation', () => {
    it('should create command plugin', async () => {
      const commands = [
        {
          name: 'command1',
          description: 'First command',
          action: vi.fn()
        },
        {
          name: 'command2',
          description: 'Second command',
          action: vi.fn()
        }
      ]
      
      const CommandPluginClass = PluginUtils.createCommandPlugin(commands)
      
      const plugin = new CommandPluginClass()
      const mockAPI = {
        log: vi.fn(),
        addSlashCommand: vi.fn().mockReturnValue('cmd-id')
      }
      
      plugin.api = mockAPI
      
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(mockAPI.addSlashCommand).toHaveBeenCalledTimes(2)
      expect(mockAPI.addSlashCommand).toHaveBeenCalledWith({
        name: 'command1',
        description: 'First command',
        icon: undefined,
        action: commands[0].action,
        shortcut: undefined
      })
    })

    it('should create command plugin with empty commands', async () => {
      const CommandPluginClass = PluginUtils.createCommandPlugin([])
      
      const plugin = new CommandPluginClass()
      const mockAPI = {
        log: vi.fn(),
        addSlashCommand: vi.fn()
      }
      
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(mockAPI.addSlashCommand).not.toHaveBeenCalled()
    })
  })

  describe('Extension Plugin Creation', () => {
    it('should create extension plugin', async () => {
      const extensions = [
        {
          extension: { name: 'Extension1' },
          options: { priority: 1 }
        },
        {
          extension: { name: 'Extension2' },
          options: { priority: 2 }
        }
      ]
      
      const ExtensionPluginClass = PluginUtils.createExtensionPlugin(extensions)
      
      const plugin = new ExtensionPluginClass()
      const mockAPI = {
        log: vi.fn(),
        addExtension: vi.fn().mockReturnValue('ext-id')
      }
      
      plugin.api = mockAPI
      
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(mockAPI.addExtension).toHaveBeenCalledTimes(2)
      expect(mockAPI.addExtension).toHaveBeenCalledWith(
        { name: 'Extension1' },
        { priority: 1 }
      )
      expect(mockAPI.addExtension).toHaveBeenCalledWith(
        { name: 'Extension2' },
        { priority: 2 }
      )
    })

    it('should handle extensions without options', async () => {
      const extensions = [
        {
          extension: { name: 'Extension1' }
          // No options property
        }
      ]
      
      const ExtensionPluginClass = PluginUtils.createExtensionPlugin(extensions)
      
      const plugin = new ExtensionPluginClass()
      const mockAPI = {
        log: vi.fn(),
        addExtension: vi.fn().mockReturnValue('ext-id')
      }
      
      plugin.api = mockAPI
      
      await plugin.initialize(mockAPI)
      await plugin.activate()
      
      expect(mockAPI.addExtension).toHaveBeenCalledWith(
        { name: 'Extension1' },
        undefined
      )
    })
  })
})