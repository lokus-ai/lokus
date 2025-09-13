import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PluginLoader } from '../../../src/core/plugins/PluginLoader'

describe('PluginLoader', () => {
  let pluginLoader
  let mockFileSystem

  beforeEach(() => {
    mockFileSystem = {
      readFile: vi.fn(),
      readDir: vi.fn(),
      exists: vi.fn(),
      stat: vi.fn()
    }
    
    pluginLoader = new PluginLoader(mockFileSystem)
  })

  describe('Plugin Discovery', () => {
    it('should discover plugins in directory', async () => {
      mockFileSystem.readDir.mockResolvedValue([
        { name: 'plugin1', isDirectory: true },
        { name: 'plugin2', isDirectory: true },
        { name: 'not-a-plugin.txt', isDirectory: false }
      ])
      
      mockFileSystem.exists.mockResolvedValue(true)
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.includes('plugin1')) {
          return Promise.resolve(JSON.stringify({
            id: 'plugin1',
            name: 'Plugin One',
            version: '1.0.0',
            main: 'index.js'
          }))
        }
        if (path.includes('plugin2')) {
          return Promise.resolve(JSON.stringify({
            id: 'plugin2',
            name: 'Plugin Two',
            version: '2.0.0',
            main: 'main.js'
          }))
        }
      })

      const plugins = await pluginLoader.discoverPlugins('/plugins/directory')
      
      expect(plugins).toHaveLength(2)
      expect(plugins[0].manifest.id).toBe('plugin1')
      expect(plugins[1].manifest.id).toBe('plugin2')
    })

    it('should skip directories without plugin.json', async () => {
      mockFileSystem.readDir.mockResolvedValue([
        { name: 'valid-plugin', isDirectory: true },
        { name: 'invalid-plugin', isDirectory: true }
      ])
      
      mockFileSystem.exists.mockImplementation((path) => {
        return Promise.resolve(path.includes('valid-plugin'))
      })
      
      mockFileSystem.readFile.mockResolvedValue(JSON.stringify({
        id: 'valid-plugin',
        name: 'Valid Plugin',
        version: '1.0.0',
        main: 'index.js'
      }))

      const plugins = await pluginLoader.discoverPlugins('/plugins/directory')
      
      expect(plugins).toHaveLength(1)
      expect(plugins[0].manifest.id).toBe('valid-plugin')
    })

    it('should handle malformed plugin.json files', async () => {
      mockFileSystem.readDir.mockResolvedValue([
        { name: 'broken-plugin', isDirectory: true }
      ])
      
      mockFileSystem.exists.mockResolvedValue(true)
      mockFileSystem.readFile.mockResolvedValue('{ invalid json }')

      const plugins = await pluginLoader.discoverPlugins('/plugins/directory')
      
      expect(plugins).toHaveLength(0)
    })
  })

  describe('Plugin Loading', () => {
    it('should load plugin from directory', async () => {
      const pluginPath = '/plugins/test-plugin'
      const manifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        main: 'index.js',
        permissions: ['editor.read']
      }
      
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.endsWith('plugin.json')) {
          return Promise.resolve(JSON.stringify(manifest))
        }
        if (path.endsWith('index.js')) {
          return Promise.resolve(`
            export default {
              activate(api) {
                console.log('Plugin activated')
              },
              deactivate() {
                console.log('Plugin deactivated')
              }
            }
          `)
        }
      })

      const plugin = await pluginLoader.loadPlugin(pluginPath)
      
      expect(plugin.manifest).toEqual(manifest)
      expect(plugin.code).toContain('activate')
      expect(plugin.code).toContain('deactivate')
    })

    it('should validate manifest during loading', async () => {
      const pluginPath = '/plugins/invalid-plugin'
      const invalidManifest = {
        id: 'invalid-plugin'
        // missing required fields
      }
      
      mockFileSystem.readFile.mockResolvedValue(JSON.stringify(invalidManifest))

      await expect(pluginLoader.loadPlugin(pluginPath))
        .rejects.toThrow('Invalid plugin manifest')
    })

    it('should handle missing main file', async () => {
      const pluginPath = '/plugins/missing-main'
      const manifest = {
        id: 'missing-main',
        name: 'Missing Main Plugin',
        version: '1.0.0',
        main: 'missing.js'
      }
      
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.endsWith('plugin.json')) {
          return Promise.resolve(JSON.stringify(manifest))
        }
        if (path.endsWith('missing.js')) {
          return Promise.reject(new Error('File not found'))
        }
      })

      await expect(pluginLoader.loadPlugin(pluginPath))
        .rejects.toThrow('Plugin main file not found')
    })
  })

  describe('Dependency Resolution', () => {
    it('should resolve plugin dependencies', async () => {
      const pluginA = {
        manifest: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          dependencies: ['plugin-b@^1.0.0']
        }
      }
      
      const pluginB = {
        manifest: {
          id: 'plugin-b',
          name: 'Plugin B',
          version: '1.2.0'
        }
      }

      const resolved = pluginLoader.resolveDependencies([pluginA, pluginB])
      
      expect(resolved).toHaveLength(2)
      expect(resolved[0].manifest.id).toBe('plugin-b') // Dependencies first
      expect(resolved[1].manifest.id).toBe('plugin-a')
    })

    it('should detect circular dependencies', () => {
      const pluginA = {
        manifest: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          dependencies: ['plugin-b@^1.0.0']
        }
      }
      
      const pluginB = {
        manifest: {
          id: 'plugin-b',
          name: 'Plugin B',
          version: '1.0.0',
          dependencies: ['plugin-a@^1.0.0']
        }
      }

      expect(() => {
        pluginLoader.resolveDependencies([pluginA, pluginB])
      }).toThrow('Circular dependency detected')
    })

    it('should handle missing dependencies', () => {
      const pluginA = {
        manifest: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          dependencies: ['missing-plugin@^1.0.0']
        }
      }

      expect(() => {
        pluginLoader.resolveDependencies([pluginA])
      }).toThrow('Dependency "missing-plugin" not found')
    })

    it('should validate version compatibility', () => {
      const pluginA = {
        manifest: {
          id: 'plugin-a',
          name: 'Plugin A',
          version: '1.0.0',
          dependencies: ['plugin-b@^2.0.0']
        }
      }
      
      const pluginB = {
        manifest: {
          id: 'plugin-b',
          name: 'Plugin B',
          version: '1.0.0'
        }
      }

      expect(() => {
        pluginLoader.resolveDependencies([pluginA, pluginB])
      }).toThrow('Version incompatibility')
    })
  })

  describe('Security Validation', () => {
    it('should validate plugin signatures', async () => {
      const pluginPath = '/plugins/signed-plugin'
      const manifest = {
        id: 'signed-plugin',
        name: 'Signed Plugin',
        version: '1.0.0',
        main: 'index.js',
        signature: 'valid-signature-hash'
      }
      
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.endsWith('plugin.json')) {
          return Promise.resolve(JSON.stringify(manifest))
        }
        if (path.endsWith('index.js')) {
          return Promise.resolve('export default { activate() {} }')
        }
      })

      const validateSignature = vi.spyOn(pluginLoader, 'validateSignature')
      validateSignature.mockReturnValue(true)

      const plugin = await pluginLoader.loadPlugin(pluginPath)
      
      expect(validateSignature).toHaveBeenCalled()
      expect(plugin.manifest.signature).toBe('valid-signature-hash')
    })

    it('should reject plugins with invalid signatures', async () => {
      const pluginPath = '/plugins/unsigned-plugin'
      const manifest = {
        id: 'unsigned-plugin',
        name: 'Unsigned Plugin',
        version: '1.0.0',
        main: 'index.js',
        signature: 'invalid-signature'
      }
      
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.endsWith('plugin.json')) {
          return Promise.resolve(JSON.stringify(manifest))
        }
        if (path.endsWith('index.js')) {
          return Promise.resolve('export default { activate() {} }')
        }
      })

      const validateSignature = vi.spyOn(pluginLoader, 'validateSignature')
      validateSignature.mockReturnValue(false)

      await expect(pluginLoader.loadPlugin(pluginPath))
        .rejects.toThrow('Invalid plugin signature')
    })

    it('should scan for malicious code patterns', async () => {
      const pluginPath = '/plugins/malicious-plugin'
      const manifest = {
        id: 'malicious-plugin',
        name: 'Malicious Plugin',
        version: '1.0.0',
        main: 'index.js'
      }
      
      const maliciousCode = `
        export default {
          activate() {
            eval('document.cookie');
            localStorage.clear();
          }
        }
      `
      
      mockFileSystem.readFile.mockImplementation((path) => {
        if (path.endsWith('plugin.json')) {
          return Promise.resolve(JSON.stringify(manifest))
        }
        if (path.endsWith('index.js')) {
          return Promise.resolve(maliciousCode)
        }
      })

      await expect(pluginLoader.loadPlugin(pluginPath))
        .rejects.toThrow('Potentially malicious code detected')
    })
  })

  describe('Hot Reload', () => {
    it('should detect file changes and reload plugin', async () => {
      const pluginPath = '/plugins/hot-reload-plugin'
      const watchCallback = vi.fn()
      
      pluginLoader.watchPlugin(pluginPath, watchCallback)
      
      // Simulate file change
      pluginLoader.handleFileChange(`${pluginPath}/index.js`)
      
      expect(watchCallback).toHaveBeenCalledWith({
        type: 'changed',
        path: `${pluginPath}/index.js`
      })
    })

    it('should handle plugin reload errors gracefully', async () => {
      const pluginPath = '/plugins/error-reload-plugin'
      const watchCallback = vi.fn()
      
      pluginLoader.watchPlugin(pluginPath, watchCallback)
      
      // Mock reload error
      vi.spyOn(pluginLoader, 'loadPlugin').mockRejectedValue(new Error('Reload failed'))
      
      pluginLoader.handleFileChange(`${pluginPath}/plugin.json`)
      
      // Should not crash the system
      expect(watchCallback).toHaveBeenCalled()
    })
  })
})