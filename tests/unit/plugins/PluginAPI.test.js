import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginAPI, PluginAPIFactory } from '../../../src/plugins/PluginAPI.js'
import { EventEmitter } from '../../../src/utils/EventEmitter.js'

// Mock Tauri APIs
vi.mock('@tauri-apps/api/fs', () => ({
  readTextFile: vi.fn(),
  writeTextFile: vi.fn(),
  exists: vi.fn()
}))

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

describe('PluginAPI', () => {
  let pluginAPI
  let mockEditorAPI
  let mockInvoke, mockReadTextFile, mockWriteTextFile, mockExists

  beforeEach(async () => {
    // Setup mocks
    mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke)
    mockReadTextFile = await import('@tauri-apps/api/fs').then(m => m.readTextFile)
    mockWriteTextFile = await import('@tauri-apps/api/fs').then(m => m.writeTextFile)
    mockExists = await import('@tauri-apps/api/fs').then(m => m.exists)

    // Reset mocks
    vi.clearAllMocks()

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

    pluginAPI = new PluginAPI('test-plugin', mockEditorAPI)
  })

  describe('Editor Integration', () => {
    it('should add extension to editor', () => {
      const mockExtension = { name: 'TestExtension' }
      const options = { priority: 100 }
      
      const extensionId = pluginAPI.addExtension(mockExtension, options)
      
      expect(mockEditorAPI.addExtension).toHaveBeenCalledWith(
        mockExtension,
        { ...options, pluginId: 'test-plugin' }
      )
      expect(extensionId).toBe('ext-id')
      expect(pluginAPI.registrations.get('extensions').has('ext-id')).toBe(true)
    })
    
    it('should handle missing editor API gracefully', () => {
      const apiWithoutEditor = new PluginAPI('test-plugin', null)
      const mockExtension = { name: 'TestExtension' }
      
      expect(() => {
        apiWithoutEditor.addExtension(mockExtension)
      }).toThrow('Editor API not available')
    })

    it('should add slash command to editor', () => {
      const mockCommand = {
        name: 'testCommand',
        description: 'Test command',
        action: vi.fn()
      }
      
      const commandId = pluginAPI.addSlashCommand(mockCommand)
      
      expect(mockEditorAPI.addSlashCommand).toHaveBeenCalledWith({
        ...mockCommand,
        id: 'test-plugin_testCommand',
        pluginId: 'test-plugin'
      })
      expect(commandId).toBe('cmd-id')
      expect(pluginAPI.registrations.get('slashCommands').has('cmd-id')).toBe(true)
    })
    
    it('should handle slash command errors', () => {
      mockEditorAPI.addSlashCommand.mockImplementation(() => {
        throw new Error('Command registration failed')
      })
      
      const mockCommand = { name: 'failingCommand' }
      
      expect(() => {
        pluginAPI.addSlashCommand(mockCommand)
      }).toThrow('Command registration failed')
    })

    it('should add toolbar button to editor', () => {
      const mockButton = {
        name: 'testButton',
        icon: 'test-icon',
        action: vi.fn()
      }
      
      const buttonId = pluginAPI.addToolbarButton(mockButton)
      
      expect(mockEditorAPI.addToolbarButton).toHaveBeenCalledWith({
        ...mockButton,
        id: 'test-plugin_testButton',
        pluginId: 'test-plugin'
      })
      expect(buttonId).toBe('btn-id')
      expect(pluginAPI.registrations.get('toolbarButtons').has('btn-id')).toBe(true)
    })
    
    it('should get editor content', () => {
      const content = pluginAPI.getEditorContent()
      
      expect(mockEditorAPI.getContent).toHaveBeenCalled()
      expect(content).toBe('editor content')
    })
    
    it('should set editor content', () => {
      const newContent = 'new content'
      pluginAPI.setEditorContent(newContent)
      
      expect(mockEditorAPI.setContent).toHaveBeenCalledWith(newContent)
    })
    
    it('should insert content at cursor', () => {
      const content = 'inserted content'
      pluginAPI.insertContent(content)
      
      expect(mockEditorAPI.insertContent).toHaveBeenCalledWith(content)
    })
    
    it('should get selection', () => {
      const selection = pluginAPI.getSelection()
      
      expect(mockEditorAPI.getSelection).toHaveBeenCalled()
      expect(selection).toEqual({ from: 0, to: 10 })
    })
  })
  
  describe('UI Integration', () => {
    it('should register panel successfully', () => {
      const mockPanel = {
        name: 'testPanel',
        title: 'Test Panel',
        component: 'TestPanelComponent'
      }
      
      const panelId = pluginAPI.registerPanel(mockPanel)
      
      expect(panelId).toBe('test-plugin_testPanel')
      expect(pluginAPI.registrations.get('panels').has(panelId)).toBe(true)
    })
    
    it('should add menu item successfully', () => {
      const mockMenuItem = {
        name: 'testMenuItem',
        label: 'Test Menu Item',
        action: vi.fn()
      }
      
      const menuId = pluginAPI.addMenuItem(mockMenuItem)
      
      expect(menuId).toBe('test-plugin_testMenuItem')
      expect(pluginAPI.registrations.get('menuItems').has(menuId)).toBe(true)
    })
    
    it('should show notification', () => {
      const notification = {
        message: 'Test notification',
        type: 'info'
      }
      
      const emitSpy = vi.spyOn(pluginAPI, 'emit')
      
      pluginAPI.showNotification(notification)
      
      expect(emitSpy).toHaveBeenCalledWith('notification', expect.objectContaining({
        ...notification,
        pluginId: 'test-plugin',
        timestamp: expect.any(Number)
      }))
    })
    
    it('should show dialog and return promise', async () => {
      const dialog = {
        title: 'Test Dialog',
        message: 'Test message',
        buttons: ['OK', 'Cancel']
      }
      
      const emitSpy = vi.spyOn(pluginAPI, 'emit')
      
      const dialogPromise = pluginAPI.showDialog(dialog)
      
      expect(emitSpy).toHaveBeenCalledWith('dialog', expect.objectContaining({
        ...dialog,
        pluginId: 'test-plugin',
        resolve: expect.any(Function)
      }))
      
      // Simulate dialog resolution
      const emitCall = emitSpy.mock.calls[0][1]
      emitCall.resolve('OK')
      
      const result = await dialogPromise
      expect(result).toBe('OK')
    })
  })

  describe('File System Operations', () => {
    beforeEach(() => {
      // Grant file permissions for these tests
      pluginAPI.grantPermission('read_files')
      pluginAPI.grantPermission('write_files')
    })

    it('should read file with proper permissions', async () => {
      const filePath = '/test/path.txt'
      const fileContent = 'test content'
      
      mockReadTextFile.mockResolvedValue(fileContent)
      
      const result = await pluginAPI.readFile(filePath)
      
      expect(mockReadTextFile).toHaveBeenCalledWith(filePath)
      expect(result).toBe(fileContent)
    })
    
    it('should reject file read without permission', async () => {
      pluginAPI.revokePermission('read_files')
      
      await expect(pluginAPI.readFile('/test/path.txt'))
        .rejects.toThrow('Plugin does not have file read permission')
    })
    
    it('should reject invalid file paths', async () => {
      await expect(pluginAPI.readFile('/test/../../../etc/passwd'))
        .rejects.toThrow('Invalid file path')
        
      await expect(pluginAPI.readFile('~/sensitive/file'))
        .rejects.toThrow('Invalid file path')
    })

    it('should write file with proper permissions', async () => {
      const filePath = '/test/output.txt'
      const content = 'output content'
      
      mockWriteTextFile.mockResolvedValue()
      
      await pluginAPI.writeFile(filePath, content)
      
      expect(mockWriteTextFile).toHaveBeenCalledWith(filePath, content)
    })
    
    it('should reject file write without permission', async () => {
      pluginAPI.revokePermission('write_files')
      
      await expect(pluginAPI.writeFile('/test/path.txt', 'content'))
        .rejects.toThrow('Plugin does not have file write permission')
    })

    it('should check file existence with proper permissions', async () => {
      const filePath = '/test/check.txt'
      
      mockExists.mockResolvedValue(true)
      
      const result = await pluginAPI.fileExists(filePath)
      
      expect(mockExists).toHaveBeenCalledWith(filePath)
      expect(result).toBe(true)
    })
    
    it('should handle file system errors gracefully', async () => {
      mockReadTextFile.mockRejectedValue(new Error('File not found'))
      
      await expect(pluginAPI.readFile('/nonexistent/file.txt'))
        .rejects.toThrow('File not found')
    })

    it('should deny file existence check without permission', async () => {
      pluginAPI.revokePermission('read_files')
      
      await expect(pluginAPI.fileExists('/test/path.txt'))
        .rejects.toThrow('Plugin does not have file read permission')
    })
  })

  describe('Settings Management', () => {
    beforeEach(() => {
      mockInvoke.mockClear()
    })

    it('should get plugin setting', async () => {
      const settings = { key1: 'value1', key2: 'value2' }
      mockInvoke.mockResolvedValue(settings)
      
      const result = await pluginAPI.getSetting('key1')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin_settings', {
        pluginId: 'test-plugin'
      })
      expect(result).toBe('value1')
    })
    
    it('should return default value when setting not found', async () => {
      mockInvoke.mockResolvedValue({})
      
      const result = await pluginAPI.getSetting('nonexistent', 'default')
      
      expect(result).toBe('default')
    })
    
    it('should return default when settings retrieval fails', async () => {
      mockInvoke.mockRejectedValue(new Error('Settings not found'))
      
      const result = await pluginAPI.getSetting('key1', 'fallback')
      
      expect(result).toBe('fallback')
    })

    it('should set plugin setting', async () => {
      const currentSettings = { existing: 'value' }
      mockInvoke.mockResolvedValueOnce(currentSettings) // getAllSettings call
      mockInvoke.mockResolvedValueOnce() // saveAllSettings call
      
      const emitSpy = vi.spyOn(pluginAPI, 'emit')
      
      await pluginAPI.setSetting('newKey', 'newValue')
      
      expect(mockInvoke).toHaveBeenCalledWith('save_plugin_settings', {
        pluginId: 'test-plugin',
        settings: {
          existing: 'value',
          newKey: 'newValue'
        }
      })
      expect(emitSpy).toHaveBeenCalledWith('setting_changed', {
        key: 'newKey',
        value: 'newValue',
        pluginId: 'test-plugin'
      })
    })
    
    it('should handle setting save errors', async () => {
      mockInvoke.mockResolvedValueOnce({}) // getAllSettings call
      mockInvoke.mockRejectedValueOnce(new Error('Save failed')) // saveAllSettings call
      
      await expect(pluginAPI.setSetting('key', 'value'))
        .rejects.toThrow('Save failed')
    })

    it('should get all plugin settings', async () => {
      const settings = { key1: 'value1', key2: 'value2' }
      mockInvoke.mockResolvedValue(settings)
      
      const result = await pluginAPI.getAllSettings()
      
      expect(result).toEqual(settings)
    })
    
    it('should return empty object when no settings exist', async () => {
      mockInvoke.mockRejectedValue(new Error('No settings found'))
      
      const result = await pluginAPI.getAllSettings()
      
      expect(result).toEqual({})
    })
  })

  describe('Permission Management', () => {
    it('should check permissions correctly', () => {
      pluginAPI.grantPermission('test_permission')
      
      expect(pluginAPI.hasPermission('test_permission')).toBe(true)
      expect(pluginAPI.hasPermission('other_permission')).toBe(false)
    })
    
    it('should handle all permission', () => {
      pluginAPI.grantPermission('all')
      
      expect(pluginAPI.hasPermission('any_permission')).toBe(true)
      expect(pluginAPI.hasPermission('another_permission')).toBe(true)
    })

    it('should grant and revoke permissions', () => {
      pluginAPI.grantPermission('test_permission')
      expect(pluginAPI.hasPermission('test_permission')).toBe(true)
      
      pluginAPI.revokePermission('test_permission')
      expect(pluginAPI.hasPermission('test_permission')).toBe(false)
    })
    
    it('should validate file paths for security', () => {
      expect(pluginAPI.isValidPath('/safe/path')).toBe(true)
      expect(pluginAPI.isValidPath('/safe/path/../unsafe')).toBe(false)
      expect(pluginAPI.isValidPath('~/home/file')).toBe(false)
    })
  })

  describe('Cleanup', () => {
    beforeEach(() => {
      // Add some registrations
      pluginAPI.addExtension({ name: 'test' })
      pluginAPI.addSlashCommand({ name: 'test' })
      pluginAPI.addToolbarButton({ name: 'test' })
    })

    it('should cleanup all registrations', async () => {
      expect(pluginAPI.registrations.size).toBeGreaterThan(0)
      
      await pluginAPI.cleanup()
      
      expect(mockEditorAPI.removeExtension).toHaveBeenCalled()
      expect(mockEditorAPI.removeSlashCommand).toHaveBeenCalled()
      expect(mockEditorAPI.removeToolbarButton).toHaveBeenCalled()
      expect(pluginAPI.registrations.size).toBe(0)
    })
    
    it('should handle cleanup errors gracefully', async () => {
      mockEditorAPI.removeExtension.mockImplementation(() => {
        throw new Error('Cleanup failed')
      })
      
      // Should not throw even if cleanup fails
      await expect(pluginAPI.cleanup()).resolves.toBeUndefined()
    })
    
    it('should get registration information', () => {
      const registrations = pluginAPI.getRegistrations()
      
      expect(registrations).toHaveProperty('extensions')
      expect(registrations).toHaveProperty('slashCommands')
      expect(registrations).toHaveProperty('toolbarButtons')
      expect(registrations.extensions.length).toBeGreaterThan(0)
    })
    
    it('should log messages with plugin context', () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {})
      
      pluginAPI.log('info', 'test message')
      
      expect(consoleSpy).toHaveBeenCalledWith('[test-plugin]', 'test message')
      
      consoleSpy.mockRestore()
    })
  })

  describe('Security and Permissions', () => {
    it('should enforce file read permissions', async () => {
      pluginAPI.permissions.clear() // Remove all permissions
      
      await expect(pluginAPI.readFile('/test/file.txt'))
        .rejects.toThrow('Plugin does not have file read permission')
    })
    
    it('should enforce file write permissions', async () => {
      pluginAPI.permissions.clear() // Remove all permissions
      
      await expect(pluginAPI.writeFile('/test/file.txt', 'content'))
        .rejects.toThrow('Plugin does not have file write permission')
    })
    
    it('should enforce file exists permissions', async () => {
      pluginAPI.permissions.clear() // Remove all permissions
      
      await expect(pluginAPI.fileExists('/test/file.txt'))
        .rejects.toThrow('Plugin does not have file read permission')
    })
    
    it('should validate file paths for security', async () => {
      pluginAPI.grantPermission('read_files')
      
      // Test directory traversal prevention
      await expect(pluginAPI.readFile('../../../etc/passwd'))
        .rejects.toThrow('Invalid file path')
        
      await expect(pluginAPI.readFile('~/secrets.txt'))
        .rejects.toThrow('Invalid file path')
    })
    
    it('should allow access with proper permissions', async () => {
      pluginAPI.grantPermission('read_files')
      pluginAPI.grantPermission('write_files')
      mockExists.mockResolvedValue(true)
      mockReadTextFile.mockResolvedValue('file content')
      
      const content = await pluginAPI.readFile('/valid/path/file.txt')
      expect(content).toBe('file content')
      
      await pluginAPI.writeFile('/valid/path/file.txt', 'new content')
      expect(mockWriteTextFile).toHaveBeenCalledWith('/valid/path/file.txt', 'new content')
      
      const exists = await pluginAPI.fileExists('/valid/path/file.txt')
      expect(exists).toBe(true)
    })
    
    it('should check permissions correctly', () => {
      expect(pluginAPI.hasPermission('read_files')).toBe(false)
      
      pluginAPI.grantPermission('read_files')
      expect(pluginAPI.hasPermission('read_files')).toBe(true)
      
      pluginAPI.grantPermission('all')
      expect(pluginAPI.hasPermission('any_permission')).toBe(true)
      
      pluginAPI.revokePermission('all')
      expect(pluginAPI.hasPermission('write_files')).toBe(false)
      expect(pluginAPI.hasPermission('read_files')).toBe(true) // Still has this one
    })
    
    it('should track and cleanup plugin registrations', async () => {
      const mockExtension = { name: 'TestExtension' }
      const mockCommand = { name: 'testCommand' }
      
      pluginAPI.addExtension(mockExtension)
      pluginAPI.addSlashCommand(mockCommand)
      
      expect(pluginAPI.registrations.get('extensions').size).toBe(1)
      expect(pluginAPI.registrations.get('slashCommands').size).toBe(1)
      
      await pluginAPI.cleanup()
      
      expect(mockEditorAPI.removeExtension).toHaveBeenCalled()
      expect(mockEditorAPI.removeSlashCommand).toHaveBeenCalled()
      expect(pluginAPI.registrations.size).toBe(0)
    })
  })
  
  describe('Settings Management', () => {
    beforeEach(() => {
      mockInvoke.mockResolvedValue({ testKey: 'testValue' })
    })
    
    it('should get plugin settings', async () => {
      const value = await pluginAPI.getSetting('testKey', 'default')
      
      expect(mockInvoke).toHaveBeenCalledWith('get_plugin_settings', { 
        pluginId: 'test-plugin' 
      })
      expect(value).toBe('testValue')
    })
    
    it('should return default value when setting not found', async () => {
      const value = await pluginAPI.getSetting('nonExistentKey', 'default')
      expect(value).toBe('default')
    })
    
    it('should handle settings storage errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Storage error'))
      
      const value = await pluginAPI.getSetting('testKey', 'default')
      expect(value).toBe('default')
    })
    
    it('should set plugin settings', async () => {
      mockInvoke.mockResolvedValueOnce({ existingKey: 'existingValue' }) // getAllSettings
      mockInvoke.mockResolvedValueOnce() // saveAllSettings
      
      await pluginAPI.setSetting('newKey', 'newValue')
      
      expect(mockInvoke).toHaveBeenCalledWith('save_plugin_settings', {
        pluginId: 'test-plugin',
        settings: { existingKey: 'existingValue', newKey: 'newValue' }
      })
    })
    
    it('should emit setting change events', async () => {
      const events = []
      pluginAPI.on('setting_changed', (data) => events.push(data))
      
      mockInvoke.mockResolvedValueOnce({}) // getAllSettings
      mockInvoke.mockResolvedValueOnce() // saveAllSettings
      
      await pluginAPI.setSetting('testKey', 'testValue')
      
      expect(events).toHaveLength(1)
      expect(events[0]).toEqual({
        key: 'testKey',
        value: 'testValue',
        pluginId: 'test-plugin'
      })
    })
  })
  
  describe('UI Integration', () => {
    it('should register panels with proper IDs', () => {
      const panel = { name: 'TestPanel', component: 'div' }
      
      const panelId = pluginAPI.registerPanel(panel)
      
      expect(panelId).toBe('test-plugin_TestPanel')
      expect(pluginAPI.registrations.get('panels').has(panelId)).toBe(true)
    })
    
    it('should add menu items with proper IDs', () => {
      const menuItem = { name: 'TestMenuItem', action: vi.fn() }
      
      const menuId = pluginAPI.addMenuItem(menuItem)
      
      expect(menuId).toBe('test-plugin_TestMenuItem')
      expect(pluginAPI.registrations.get('menuItems').has(menuId)).toBe(true)
    })
    
    it('should show notifications with plugin context', () => {
      const events = []
      pluginAPI.on('notification', (data) => events.push(data))
      
      pluginAPI.showNotification({
        message: 'Test notification',
        type: 'info'
      })
      
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        message: 'Test notification',
        type: 'info',
        pluginId: 'test-plugin'
      })
      expect(events[0].timestamp).toBeDefined()
    })
    
    it('should show dialogs with plugin context', async () => {
      const events = []
      pluginAPI.on('dialog', (data) => events.push(data))
      
      const dialogPromise = pluginAPI.showDialog({
        title: 'Test Dialog',
        message: 'Test message'
      })
      
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        title: 'Test Dialog',
        message: 'Test message',
        pluginId: 'test-plugin'
      })
      expect(events[0].resolve).toBeInstanceOf(Function)
      
      // Simulate dialog resolution
      events[0].resolve('user_response')
      const result = await dialogPromise
      expect(result).toBe('user_response')
    })
  })
  
  describe('Error Handling and Edge Cases', () => {
    it('should handle editor API errors gracefully', () => {
      mockEditorAPI.addExtension.mockImplementation(() => {
        throw new Error('Editor error')
      })
      
      const mockExtension = { name: 'FailingExtension' }
      
      expect(() => {
        pluginAPI.addExtension(mockExtension)
      }).toThrow('Editor error')
    })
    
    it('should handle file operation errors', async () => {
      pluginAPI.grantPermission('read_files')
      mockReadTextFile.mockRejectedValue(new Error('File read error'))
      
      await expect(pluginAPI.readFile('/valid/path.txt'))
        .rejects.toThrow('File read error')
    })
    
    it('should handle settings operation errors', async () => {
      mockInvoke.mockRejectedValue(new Error('Settings error'))
      
      await expect(pluginAPI.setSetting('key', 'value'))
        .rejects.toThrow('Settings error')
    })
    
    it('should handle missing editor API methods', () => {
      const apiWithoutMethods = new PluginAPI('test-plugin', {})
      
      expect(() => {
        apiWithoutMethods.addExtension({ name: 'Test' })
      }).toThrow('Editor API not available')
      
      expect(() => {
        apiWithoutMethods.getEditorContent()
      }).toThrow('Editor API not available')
    })
    
    it('should provide registration information', () => {
      pluginAPI.addExtension({ name: 'Ext1' })
      pluginAPI.addSlashCommand({ name: 'Cmd1' })
      
      const registrations = pluginAPI.getRegistrations()
      
      expect(registrations).toHaveProperty('extensions')
      expect(registrations).toHaveProperty('slashCommands')
      expect(registrations.extensions).toBeInstanceOf(Array)
      expect(registrations.slashCommands).toBeInstanceOf(Array)
    })
  })
})

describe('PluginAPIFactory', () => {
  let factory
  let mockEditorAPI
  
  beforeEach(() => {
    mockEditorAPI = {
      addExtension: vi.fn(),
      removeExtension: vi.fn()
    }
    
    factory = new PluginAPIFactory(mockEditorAPI)
  })
  
  it('should create API instance with permissions', () => {
    const manifest = {
      permissions: ['read_files', 'write_files']
    }
    
    const api = factory.createAPI('test-plugin', manifest)
    
    expect(api).toBeInstanceOf(PluginAPI)
    expect(api.pluginId).toBe('test-plugin')
    expect(api.hasPermission('read_files')).toBe(true)
    expect(api.hasPermission('write_files')).toBe(true)
    expect(factory.apis.has('test-plugin')).toBe(true)
  })
  
  it('should return existing API instance', () => {
    const api1 = factory.createAPI('test-plugin')
    const api2 = factory.createAPI('test-plugin')
    
    expect(api1).toBe(api2)
  })
  
  it('should get existing API instance', () => {
    const api = factory.createAPI('test-plugin')
    const retrieved = factory.getAPI('test-plugin')
    
    expect(retrieved).toBe(api)
  })
  
  it('should cleanup API instance', async () => {
    const api = factory.createAPI('test-plugin')
    const cleanupSpy = vi.spyOn(api, 'cleanup').mockResolvedValue()
    
    await factory.cleanupAPI('test-plugin')
    
    expect(cleanupSpy).toHaveBeenCalled()
    expect(factory.apis.has('test-plugin')).toBe(false)
  })
  
  it('should cleanup all API instances', async () => {
    const api1 = factory.createAPI('plugin1')
    const api2 = factory.createAPI('plugin2')
    const cleanup1 = vi.spyOn(api1, 'cleanup').mockResolvedValue()
    const cleanup2 = vi.spyOn(api2, 'cleanup').mockResolvedValue()
    
    await factory.cleanupAll()
    
    expect(cleanup1).toHaveBeenCalled()
    expect(cleanup2).toHaveBeenCalled()
    expect(factory.apis.size).toBe(0)
  })
  
  it('should handle cleanup errors in cleanupAll', async () => {
    const api1 = factory.createAPI('plugin1')
    const api2 = factory.createAPI('plugin2')
    
    vi.spyOn(api1, 'cleanup').mockRejectedValue(new Error('Cleanup failed'))
    vi.spyOn(api2, 'cleanup').mockResolvedValue()
    
    // Should not throw even if one cleanup fails
    await expect(factory.cleanupAll()).resolves.toBeUndefined()
    expect(factory.apis.size).toBe(0)
  })
})