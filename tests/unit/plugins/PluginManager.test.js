import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginManager } from '../../../src/plugins/PluginManager.js'
import { PluginAPI } from '../../../src/plugins/PluginAPI.js'
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
  readTextFile: vi.fn()
}))

describe('PluginManager', () => {
  let pluginManager
  let mockInvoke, mockExists, mockReadDir, mockReadTextFile, mockJoin

  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks()
    
    // Get mock functions
    mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke)
    mockExists = await import('@tauri-apps/api/fs').then(m => m.exists)
    mockReadDir = await import('@tauri-apps/api/fs').then(m => m.readDir)
    mockReadTextFile = await import('@tauri-apps/api/fs').then(m => m.readTextFile)
    mockJoin = await import('@tauri-apps/api/path').then(m => m.join)
    
    // Setup default mocks
    mockExists.mockResolvedValue(true)
    mockInvoke.mockResolvedValue()
    mockJoin.mockImplementation((...paths) => paths.join('/'))
    
    pluginManager = new PluginManager()
  })
  
  afterEach(async () => {
    if (pluginManager) {
      await pluginManager.shutdown()
    }
  })

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockReadDir.mockResolvedValue([])
      
      await pluginManager.initialize()
      
      expect(pluginManager.isInitialized).toBe(true)
      expect(mockInvoke).toHaveBeenCalledWith('create_directory', {
        path: '/mock/home/.lokus/plugins'
      })
    })

    it('should setup plugin directories', async () => {
      await pluginManager.setupPluginDirectories()
      
      expect(mockJoin).toHaveBeenCalledWith('/mock/home', '.lokus', 'plugins')
      expect(pluginManager.pluginDirs.has('/mock/home/.lokus/plugins')).toBe(true)
    })
    
    it('should create plugin directory if it does not exist', async () => {
      mockExists.mockResolvedValue(false)
      
      await pluginManager.setupPluginDirectories()
      
      expect(mockInvoke).toHaveBeenCalledWith('create_directory', {
        path: '/mock/home/.lokus/plugins'
      })
    })
  })

    it('should reject plugin without required manifest fields', async () => {
      const invalidManifest = {
        id: 'invalid-plugin'
        // missing required fields
      }

      await expect(pluginManager.validatePluginManifest(invalidManifest))
        .rejects.toThrow('Missing required field')
    })

    it('should validate manifest version format', async () => {
      const invalidVersionManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: 'invalid-version',
        main: 'index.js',
        lokusVersion: '1.0.0'
      }

      await expect(pluginManager.validatePluginManifest(invalidVersionManifest))
        .rejects.toThrow('Invalid version format')
    })
    
    it('should validate manifest dependencies', async () => {
      const invalidDepsManifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '1.0.0',
        dependencies: 'invalid-deps'
      }

      await expect(pluginManager.validatePluginManifest(invalidDepsManifest))
        .rejects.toThrow('Dependencies must be an object')
    })
  })

  describe('Plugin Discovery', () => {
    it('should discover plugins from directories', async () => {
      const mockEntries = [
        {
          name: 'plugin1',
          path: '/mock/home/.lokus/plugins/plugin1',
          children: []
        },
        {
          name: 'plugin2', 
          path: '/mock/home/.lokus/plugins/plugin2',
          children: []
        }
      ]
      
      mockReadDir.mockResolvedValue(mockEntries)
      mockReadTextFile.mockResolvedValue(JSON.stringify({
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '1.0.0'
      }))
      
      await pluginManager.setupPluginDirectories()
      await pluginManager.discoverPlugins()
      
      expect(mockReadDir).toHaveBeenCalledWith('/mock/home/.lokus/plugins', { recursive: false })
      expect(pluginManager.registry.size).toBe(2)
    })

    it('should handle missing plugin manifests gracefully', async () => {
      const mockEntries = [
        {
          name: 'invalid-plugin',
          path: '/mock/home/.lokus/plugins/invalid-plugin',
          children: []
        }
      ]
      
      mockReadDir.mockResolvedValue(mockEntries)
      mockExists.mockImplementation(path => 
        path.includes('plugin.json') ? Promise.resolve(false) : Promise.resolve(true)
      )
      
      await pluginManager.setupPluginDirectories()
      await pluginManager.discoverPlugins()
      
      expect(pluginManager.registry.size).toBe(0)
    })

    it('should skip directories without valid manifests', async () => {
      const mockEntries = [
        {
          name: 'plugin-with-bad-manifest',
          path: '/mock/home/.lokus/plugins/plugin-with-bad-manifest',
          children: []
        }
      ]
      
      mockReadDir.mockResolvedValue(mockEntries)
      mockReadTextFile.mockRejectedValue(new Error('File read error'))
      
      await pluginManager.setupPluginDirectories()
      await pluginManager.discoverPlugins()
      
      expect(pluginManager.registry.size).toBe(0)
    })
  })

  describe('Dependency Management', () => {
    it('should build dependency graph correctly', () => {
      const plugin1 = {
        manifest: {
          id: 'plugin1',
          dependencies: { 'plugin2': '^1.0.0' }
        }
      }
      
      const plugin2 = {
        manifest: {
          id: 'plugin2',
          dependencies: {}
        }
      }
      
      pluginManager.registry.set('plugin1', plugin1)
      pluginManager.registry.set('plugin2', plugin2)
      
      pluginManager.buildDependencyGraph()
      
      expect(pluginManager.dependencies.get('plugin1').has('plugin2')).toBe(true)
      expect(pluginManager.dependents.get('plugin2').has('plugin1')).toBe(true)
    })

    it('should resolve load order using topological sort', () => {
      const plugin1 = {
        manifest: {
          id: 'plugin1',
          dependencies: { 'plugin2': '^1.0.0' }
        }
      }
      
      const plugin2 = {
        manifest: {
          id: 'plugin2',
          dependencies: {}
        }
      }
      
      pluginManager.registry.set('plugin1', plugin1)
      pluginManager.registry.set('plugin2', plugin2)
      
      pluginManager.buildDependencyGraph()
      pluginManager.resolveLoadOrder()
      
      expect(pluginManager.loadOrder.indexOf('plugin2')).toBeLessThan(
        pluginManager.loadOrder.indexOf('plugin1')
      )
    })
    
    it('should detect circular dependencies', () => {
      const plugin1 = {
        manifest: {
          id: 'plugin1',
          dependencies: { 'plugin2': '^1.0.0' }
        }
      }
      
      const plugin2 = {
        manifest: {
          id: 'plugin2',
          dependencies: { 'plugin1': '^1.0.0' }
        }
      }
      
      pluginManager.registry.set('plugin1', plugin1)
      pluginManager.registry.set('plugin2', plugin2)
      
      pluginManager.buildDependencyGraph()
      
      expect(() => pluginManager.resolveLoadOrder())
        .toThrow('Circular dependency detected')
    })
  })

  describe('Plugin Loading', () => {
    it('should handle missing plugin files', async () => {
      const pluginInfo = {
        path: '/mock/plugins/test-plugin',
        manifest: {
          id: 'test-plugin',
          main: 'index.js'
        }
      }
      
      pluginManager.registry.set('test-plugin', pluginInfo)
      mockExists.mockResolvedValue(false)
      
      await expect(pluginManager.loadPlugin('test-plugin'))
        .rejects.toThrow('Main file not found')
        
      expect(pluginManager.registry.get('test-plugin').status).toBe('error')
    })

    it('should handle plugin loading errors', async () => {
      const pluginInfo = {
        path: '/mock/plugins/test-plugin',
        manifest: {
          id: 'test-plugin',
          main: 'index.js'
        }
      }
      
      pluginManager.registry.set('test-plugin', pluginInfo)
      pluginManager.dependencies.set('test-plugin', new Set())
      mockExists.mockResolvedValue(true)
      
      // Mock dynamic import to throw error
      const originalImport = global.import
      global.import = vi.fn().mockRejectedValue(new Error('Import failed'))
      
      await expect(pluginManager.loadPlugin('test-plugin'))
        .rejects.toThrow()
        
      global.import = originalImport
    })
  })

  describe('Plugin Activation/Deactivation', () => {
    let mockPlugin
    
    beforeEach(() => {
      mockPlugin = {
        id: 'test-plugin',
        activate: vi.fn(),
        deactivate: vi.fn(),
        cleanup: vi.fn()
      }
      
      pluginManager.plugins.set('test-plugin', mockPlugin)
      pluginManager.loadedPlugins.add('test-plugin')
      pluginManager.registry.set('test-plugin', {
        status: 'loaded',
        manifest: { id: 'test-plugin' }
      })
      pluginManager.dependencies.set('test-plugin', new Set())
    })
    
    it('should activate plugin successfully', async () => {
      await pluginManager.activatePlugin('test-plugin')
      
      expect(mockPlugin.activate).toHaveBeenCalled()
      expect(pluginManager.activePlugins.has('test-plugin')).toBe(true)
      expect(pluginManager.registry.get('test-plugin').status).toBe('active')
    })
    
    it('should not activate already active plugin', async () => {
      pluginManager.activePlugins.add('test-plugin')
      
      await pluginManager.activatePlugin('test-plugin')
      
      expect(mockPlugin.activate).not.toHaveBeenCalled()
    })
    
    it('should deactivate plugin successfully', async () => {
      pluginManager.activePlugins.add('test-plugin')
      pluginManager.registry.get('test-plugin').status = 'active'
      
      await pluginManager.deactivatePlugin('test-plugin')
      
      expect(mockPlugin.deactivate).toHaveBeenCalled()
      expect(pluginManager.activePlugins.has('test-plugin')).toBe(false)
      expect(pluginManager.registry.get('test-plugin').status).toBe('loaded')
    })
    
    it('should unload plugin successfully', async () => {
      await pluginManager.unloadPlugin('test-plugin')
      
      expect(mockPlugin.cleanup).toHaveBeenCalled()
      expect(pluginManager.plugins.has('test-plugin')).toBe(false)
      expect(pluginManager.loadedPlugins.has('test-plugin')).toBe(false)
      expect(pluginManager.registry.get('test-plugin').status).toBe('discovered')
    })
  })

    it('should reload plugin successfully', async () => {
      pluginManager.activePlugins.add('test-plugin')
      
      const spy = vi.spyOn(pluginManager, 'loadPlugin').mockResolvedValue(mockPlugin)
      
      await pluginManager.reloadPlugin('test-plugin')
      
      expect(mockPlugin.cleanup).toHaveBeenCalled()
      expect(spy).toHaveBeenCalledWith('test-plugin')
      expect(mockPlugin.activate).toHaveBeenCalled()
    })
  })
  
  describe('Plugin Information', () => {
    it('should get plugin info correctly', () => {
      const pluginInfo = {
        id: 'test-plugin',
        manifest: { name: 'Test Plugin' },
        status: 'loaded'
      }
      
      pluginManager.registry.set('test-plugin', pluginInfo)
      
      expect(pluginManager.getPluginInfo('test-plugin')).toBe(pluginInfo)
    })
    
    it('should get all plugins correctly', () => {
      const plugin1Info = { id: 'plugin1', manifest: {} }
      const plugin2Info = { id: 'plugin2', manifest: {} }
      
      pluginManager.registry.set('plugin1', plugin1Info)
      pluginManager.registry.set('plugin2', plugin2Info)
      
      const allPlugins = pluginManager.getAllPlugins()
      
      expect(allPlugins).toHaveLength(2)
      expect(allPlugins[0].id).toBe('plugin1')
      expect(allPlugins[1].id).toBe('plugin2')
    })
    
    it('should get active plugins correctly', () => {
      const mockPlugin = { id: 'active-plugin' }
      const pluginInfo = { id: 'active-plugin', manifest: {} }
      
      pluginManager.plugins.set('active-plugin', mockPlugin)
      pluginManager.registry.set('active-plugin', pluginInfo)
      pluginManager.activePlugins.add('active-plugin')
      
      const activePlugins = pluginManager.getActivePlugins()
      
      expect(activePlugins).toHaveLength(1)
      expect(activePlugins[0].id).toBe('active-plugin')
    })
    
    it('should check plugin status correctly', () => {
      pluginManager.loadedPlugins.add('loaded-plugin')
      pluginManager.activePlugins.add('active-plugin')
      
      expect(pluginManager.isPluginLoaded('loaded-plugin')).toBe(true)
      expect(pluginManager.isPluginLoaded('not-loaded')).toBe(false)
      expect(pluginManager.isPluginActive('active-plugin')).toBe(true)
      expect(pluginManager.isPluginActive('not-active')).toBe(false)
    })
    
    it('should get plugin statistics correctly', () => {
      pluginManager.registry.set('plugin1', { status: 'loaded' })
      pluginManager.registry.set('plugin2', { status: 'active' })
      pluginManager.registry.set('plugin3', { status: 'error', error: 'Test error' })
      pluginManager.loadedPlugins.add('plugin1')
      pluginManager.loadedPlugins.add('plugin2')
      pluginManager.activePlugins.add('plugin2')
      
      const stats = pluginManager.getStats()
      
      expect(stats.total).toBe(3)
      expect(stats.loaded).toBe(2)
      expect(stats.active).toBe(1)
      expect(stats.byStatus.loaded).toBe(1)
      expect(stats.byStatus.active).toBe(1)
      expect(stats.byStatus.error).toBe(1)
      expect(stats.errors).toHaveLength(1)
      expect(stats.errors[0].pluginId).toBe('plugin3')
    })
  })
  
  describe('Cleanup and Shutdown', () => {
    it('should shutdown gracefully', async () => {
      const mockPlugin = {
        deactivate: vi.fn()
      }
      
      pluginManager.plugins.set('test-plugin', mockPlugin)
      pluginManager.activePlugins.add('test-plugin')
      
      const removeAllListenersSpy = vi.spyOn(pluginManager, 'removeAllListeners')
      
      await pluginManager.shutdown()
      
      expect(mockPlugin.deactivate).toHaveBeenCalled()
      expect(removeAllListenersSpy).toHaveBeenCalled()
    })
    
    it('should handle plugin deactivation errors during shutdown', async () => {
      const mockPlugin = {
        deactivate: vi.fn().mockRejectedValue(new Error('Deactivation failed'))
      }
      
      pluginManager.plugins.set('error-plugin', mockPlugin)
      pluginManager.activePlugins.add('error-plugin')
      
      // Should not throw even if deactivation fails
      await expect(pluginManager.shutdown()).resolves.toBeUndefined()
    })
  })
  
  describe('Error Handling', () => {
    it('should handle activation errors gracefully', async () => {
      const mockPlugin = {
        activate: vi.fn().mockRejectedValue(new Error('Activation failed'))
      }
      
      pluginManager.plugins.set('error-plugin', mockPlugin)
      pluginManager.loadedPlugins.add('error-plugin')
      pluginManager.registry.set('error-plugin', { status: 'loaded' })
      pluginManager.dependencies.set('error-plugin', new Set())
      
      await expect(pluginManager.activatePlugin('error-plugin'))
        .rejects.toThrow('Activation failed')
        
      expect(pluginManager.registry.get('error-plugin').status).toBe('error')
    })
    
    it('should handle deactivation errors gracefully', async () => {
      const mockPlugin = {
        deactivate: vi.fn().mockRejectedValue(new Error('Deactivation failed'))
      }
      
      pluginManager.plugins.set('error-plugin', mockPlugin)
      pluginManager.activePlugins.add('error-plugin')
      pluginManager.registry.set('error-plugin', { status: 'active' })
      pluginManager.dependents.set('error-plugin', new Set())
      
      await expect(pluginManager.deactivatePlugin('error-plugin'))
        .rejects.toThrow('Deactivation failed')
    })
    
    it('should handle plugin loading with invalid export', async () => {
      const pluginInfo = {
        path: '/mock/plugins/invalid-plugin',
        manifest: { id: 'invalid-plugin', main: 'index.js' }
      }
      
      pluginManager.registry.set('invalid-plugin', pluginInfo)
      pluginManager.dependencies.set('invalid-plugin', new Set())
      mockExists.mockResolvedValue(true)
      
      // Mock import with invalid export (no default or Plugin class)
      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ someOtherExport: () => {} })
      
      await expect(pluginManager.loadPlugin('invalid-plugin'))
        .rejects.toThrow('Plugin must export a default class or Plugin class')
        
      expect(pluginManager.registry.get('invalid-plugin').status).toBe('error')
      
      global.import = originalImport
    })
    
    it('should handle missing dependency gracefully', () => {
      const plugin1 = {
        manifest: {
          id: 'plugin1',
          dependencies: { 'missing-plugin': '^1.0.0' }
        }
      }
      
      pluginManager.registry.set('plugin1', plugin1)
      pluginManager.buildDependencyGraph()
      
      expect(() => pluginManager.resolveLoadOrder())
        .toThrow('Missing dependency: missing-plugin required by plugin1')
    })
    
    it('should handle plugin not found errors', async () => {
      await expect(pluginManager.loadPlugin('non-existent-plugin'))
        .rejects.toThrow('Plugin not found: non-existent-plugin')
        
      await expect(pluginManager.activatePlugin('non-existent-plugin'))
        .rejects.toThrow('Plugin not loaded: non-existent-plugin')
    })
    
    it('should handle filesystem errors during discovery', async () => {
      mockReadDir.mockRejectedValue(new Error('Permission denied'))
      
      await pluginManager.setupPluginDirectories()
      
      // Should not throw, just log warning
      await expect(pluginManager.discoverPlugins()).resolves.toBeUndefined()
      expect(pluginManager.registry.size).toBe(0)
    })
  })
  
  describe('Advanced Plugin Operations', () => {
    it('should install plugin from package', async () => {
      const packagePath = '/mock/plugin-package.zip'
      
      await expect(pluginManager.installPlugin(packagePath))
        .rejects.toThrow('Plugin installation not yet implemented')
    })
    
    it('should uninstall plugin', async () => {
      const pluginId = 'test-plugin'
      
      await expect(pluginManager.uninstallPlugin(pluginId))
        .rejects.toThrow('Plugin uninstallation not yet implemented')
    })
    
    it('should handle version compatibility checking', () => {
      // Test version compatibility (currently always returns true)
      expect(pluginManager.isVersionCompatible('1.0.0')).toBe(true)
      expect(pluginManager.isVersionCompatible('^1.0.0')).toBe(true)
      expect(pluginManager.isVersionCompatible('>=2.0.0')).toBe(true)
    })
  })
  
  describe('Event System', () => {
    it('should emit plugin lifecycle events', async () => {
      const events = []
      
      pluginManager.on('plugin_loaded', (data) => events.push('loaded'))
      pluginManager.on('plugin_activated', (data) => events.push('activated'))
      pluginManager.on('plugin_deactivated', (data) => events.push('deactivated'))
      pluginManager.on('plugin_unloaded', (data) => events.push('unloaded'))
      
      const mockPlugin = {
        activate: vi.fn(),
        deactivate: vi.fn(),
        cleanup: vi.fn()
      }
      
      const pluginInfo = {
        path: '/mock/plugins/test-plugin',
        manifest: { id: 'test-plugin', main: 'index.js' }
      }
      
      pluginManager.registry.set('test-plugin', pluginInfo)
      pluginManager.dependencies.set('test-plugin', new Set())
      mockExists.mockResolvedValue(true)
      
      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ default: vi.fn(() => mockPlugin) })
      
      // Load plugin
      await pluginManager.loadPlugin('test-plugin')
      expect(events).toContain('loaded')
      
      // Activate plugin
      await pluginManager.activatePlugin('test-plugin')
      expect(events).toContain('activated')
      
      // Deactivate plugin
      await pluginManager.deactivatePlugin('test-plugin')
      expect(events).toContain('deactivated')
      
      // Unload plugin
      await pluginManager.unloadPlugin('test-plugin')
      expect(events).toContain('unloaded')
      
      global.import = originalImport
    })
    
    it('should emit initialization and shutdown events', async () => {
      const events = []
      
      pluginManager.on('initialized', () => events.push('initialized'))
      pluginManager.on('shutdown', () => events.push('shutdown'))
      
      mockReadDir.mockResolvedValue([])
      
      await pluginManager.initialize()
      expect(events).toContain('initialized')
      
      await pluginManager.shutdown()
      expect(events).toContain('shutdown')
    })
  })
  
  describe('Memory Management', () => {
    it('should properly clean up plugin references on unload', async () => {
      const mockPlugin = {
        activate: vi.fn(),
        deactivate: vi.fn(),
        cleanup: vi.fn()
      }
      
      pluginManager.plugins.set('test-plugin', mockPlugin)
      pluginManager.loadedPlugins.add('test-plugin')
      pluginManager.activePlugins.add('test-plugin')
      pluginManager.registry.set('test-plugin', { status: 'active' })
      
      await pluginManager.unloadPlugin('test-plugin')
      
      expect(pluginManager.plugins.has('test-plugin')).toBe(false)
      expect(pluginManager.loadedPlugins.has('test-plugin')).toBe(false)
      expect(pluginManager.activePlugins.has('test-plugin')).toBe(false)
      expect(mockPlugin.cleanup).toHaveBeenCalled()
    })
    
    it('should clean up event listeners on shutdown', async () => {
      const removeAllListenersSpy = vi.spyOn(pluginManager, 'removeAllListeners')
      
      await pluginManager.shutdown()
      
      expect(removeAllListenersSpy).toHaveBeenCalled()
    })
  })
})