import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PluginManager } from '../../src/plugins/PluginManager.js'
import { PluginAPI, PluginAPIFactory } from '../../src/plugins/PluginAPI.js'
import { BasePlugin } from '../../src/plugins/core/BasePlugin.js'
import { validateManifest, createManifestTemplate } from '../../src/plugins/core/PluginManifest.js'
import { EventEmitter } from '../../src/utils/EventEmitter.js'
import { promises as fs } from 'fs'
import path from 'path'
import { tmpdir } from 'os'

// Mock Tauri APIs for integration tests
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

vi.mock('@tauri-apps/api/path', () => ({
  join: vi.fn((...paths) => path.join(...paths)),
  homeDir: vi.fn(() => Promise.resolve('/mock/home'))
}))

vi.mock('@tauri-apps/api/fs', () => ({
  readDir: vi.fn(),
  exists: vi.fn(),
  readTextFile: vi.fn()
}))

describe('Plugin Filesystem Integration', () => {
  let testDir
  let pluginManager
  let apiFactory
  let mockInvoke, mockExists, mockReadDir, mockReadTextFile

  beforeEach(async () => {
    // Create temporary test directory
    testDir = await fs.mkdtemp(path.join(tmpdir(), 'lokus-plugin-test-'))
    
    // Setup mocks
    mockInvoke = await import('@tauri-apps/api/core').then(m => m.invoke)
    mockExists = await import('@tauri-apps/api/fs').then(m => m.exists)
    mockReadDir = await import('@tauri-apps/api/fs').then(m => m.readDir)
    mockReadTextFile = await import('@tauri-apps/api/fs').then(m => m.readTextFile)
    
    // Reset mocks
    vi.clearAllMocks()
    
    // Setup basic mocks
    mockInvoke.mockResolvedValue()
    mockExists.mockImplementation(async (filePath) => {
      if (typeof filePath === 'string' && filePath.includes(testDir)) {
        try {
          await fs.access(filePath)
          return true
        } catch {
          return false
        }
      }
      return true // Default for non-test paths
    })
    
    // Initialize plugin system
    pluginManager = new PluginManager()
    apiFactory = new PluginAPIFactory({
      addExtension: vi.fn(),
      removeExtension: vi.fn()
    })
  })

  afterEach(async () => {
    // Cleanup test directory
    if (testDir) {
      try {
        await fs.rm(testDir, { recursive: true, force: true })
      } catch (error) {
        console.warn('Failed to cleanup test directory:', error)
      }
    }
    
    // Cleanup plugin manager
    if (pluginManager) {
      await pluginManager.shutdown()
    }
  })

  describe('Plugin Directory Discovery', () => {
    it('should discover valid plugin directories', async () => {
      // Create test plugin directories
      const plugin1Dir = path.join(testDir, 'plugin1')
      const plugin2Dir = path.join(testDir, 'plugin2')
      
      await fs.mkdir(plugin1Dir, { recursive: true })
      await fs.mkdir(plugin2Dir, { recursive: true })
      
      // Create plugin manifests
      const manifest1 = createManifestTemplate({
        id: 'plugin1',
        name: 'Plugin 1',
        main: 'index.js'
      })
      
      const manifest2 = createManifestTemplate({
        id: 'plugin2',
        name: 'Plugin 2',
        main: 'plugin.js'
      })
      
      await fs.writeFile(
        path.join(plugin1Dir, 'plugin.json'),
        JSON.stringify(manifest1, null, 2)
      )
      
      await fs.writeFile(
        path.join(plugin2Dir, 'plugin.json'),
        JSON.stringify(manifest2, null, 2)
      )
      
      // Create main files
      await fs.writeFile(path.join(plugin1Dir, 'index.js'), 'export default class Plugin1 {}')
      await fs.writeFile(path.join(plugin2Dir, 'plugin.js'), 'export default class Plugin2 {}')
      
      // Mock readDir to return our test directories
      mockReadDir.mockResolvedValue([
        {
          name: 'plugin1',
          path: plugin1Dir,
          children: []
        },
        {
          name: 'plugin2',
          path: plugin2Dir,
          children: []
        }
      ])
      
      // Mock readTextFile to return our manifests
      mockReadTextFile.mockImplementation(async (filePath) => {
        if (filePath.includes('plugin1')) {
          return JSON.stringify(manifest1)
        } else if (filePath.includes('plugin2')) {
          return JSON.stringify(manifest2)
        }
        throw new Error('File not found')
      })
      
      // Override plugin directory setup
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      await pluginManager.discoverPlugins()
      
      expect(pluginManager.registry.size).toBe(2)
      expect(pluginManager.registry.has('plugin1')).toBe(true)
      expect(pluginManager.registry.has('plugin2')).toBe(true)
      
      const plugin1Info = pluginManager.registry.get('plugin1')
      expect(plugin1Info.manifest.name).toBe('Plugin 1')
      expect(plugin1Info.status).toBe('discovered')
    })

    it('should skip directories without valid manifests', async () => {
      // Create directories with invalid/missing manifests
      const validDir = path.join(testDir, 'valid-plugin')
      const invalidDir = path.join(testDir, 'invalid-plugin')
      const noManifestDir = path.join(testDir, 'no-manifest')
      
      await fs.mkdir(validDir, { recursive: true })
      await fs.mkdir(invalidDir, { recursive: true })
      await fs.mkdir(noManifestDir, { recursive: true })
      
      // Valid manifest
      const validManifest = createManifestTemplate({
        id: 'valid-plugin',
        name: 'Valid Plugin'
      })
      
      await fs.writeFile(
        path.join(validDir, 'plugin.json'),
        JSON.stringify(validManifest, null, 2)
      )
      
      // Invalid manifest (missing required fields)
      await fs.writeFile(
        path.join(invalidDir, 'plugin.json'),
        JSON.stringify({ name: 'Incomplete' }, null, 2)
      )
      
      // No manifest file for noManifestDir
      
      mockReadDir.mockResolvedValue([
        { name: 'valid-plugin', path: validDir, children: [] },
        { name: 'invalid-plugin', path: invalidDir, children: [] },
        { name: 'no-manifest', path: noManifestDir, children: [] }
      ])
      
      mockReadTextFile.mockImplementation(async (filePath) => {
        if (filePath.includes('valid-plugin')) {
          return JSON.stringify(validManifest)
        } else if (filePath.includes('invalid-plugin')) {
          return JSON.stringify({ name: 'Incomplete' })
        }
        throw new Error('File not found')
      })
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      await pluginManager.discoverPlugins()
      
      // Only valid plugin should be registered
      expect(pluginManager.registry.size).toBe(1)
      expect(pluginManager.registry.has('valid-plugin')).toBe(true)
    })

    it('should handle filesystem errors gracefully', async () => {
      mockReadDir.mockRejectedValue(new Error('Access denied'))
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add('/nonexistent/path')
      
      // Should not throw
      await expect(pluginManager.discoverPlugins()).resolves.toBeUndefined()
      expect(pluginManager.registry.size).toBe(0)
    })
  })

  describe('Plugin Loading from Files', () => {
    let pluginDir

    beforeEach(async () => {
      pluginDir = path.join(testDir, 'test-plugin')
      await fs.mkdir(pluginDir, { recursive: true })
    })

    it('should load valid plugin files', async () => {
      const manifest = createManifestTemplate({
        id: 'test-plugin',
        name: 'Test Plugin',
        main: 'index.js'
      })
      
      // Create manifest
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      // Create main file
      const pluginCode = `
        import { BasePlugin } from '../../../src/plugins/core/BasePlugin.js'
        
        export default class TestPlugin extends BasePlugin {
          async activate() {
            await super.activate()
            this.testProperty = 'active'
          }
        }
      `
      
      await fs.writeFile(path.join(pluginDir, 'index.js'), pluginCode)
      
      // Register plugin in manager
      pluginManager.registry.set('test-plugin', {
        path: pluginDir,
        manifest,
        status: 'discovered'
      })
      
      pluginManager.dependencies.set('test-plugin', new Set())
      
      // Mock dynamic import since we can't actually import in test environment
      const mockPluginClass = class TestPlugin extends BasePlugin {
        async activate() {
          await super.activate()
          this.testProperty = 'active'
        }
      }
      
      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({ default: mockPluginClass })
      
      try {
        const plugin = await pluginManager.loadPlugin('test-plugin')
        
        expect(plugin).toBeInstanceOf(BasePlugin)
        expect(plugin.id).toBe('test-plugin')
        expect(plugin.manifest).toBe(manifest)
        expect(pluginManager.isPluginLoaded('test-plugin')).toBe(true)
        expect(pluginManager.registry.get('test-plugin').status).toBe('loaded')
      } finally {
        global.import = originalImport
      }
    })

    it('should handle missing main files', async () => {
      const manifest = createManifestTemplate({
        id: 'missing-main',
        name: 'Missing Main Plugin',
        main: 'nonexistent.js'
      })
      
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      pluginManager.registry.set('missing-main', {
        path: pluginDir,
        manifest,
        status: 'discovered'
      })
      
      pluginManager.dependencies.set('missing-main', new Set())
      
      // Override exists mock for this test
      mockExists.mockImplementation(async (filePath) => {
        return !filePath.includes('nonexistent.js')
      })
      
      await expect(pluginManager.loadPlugin('missing-main'))
        .rejects.toThrow('Main file not found')
      
      expect(pluginManager.registry.get('missing-main').status).toBe('error')
    })

    it('should handle malformed plugin files', async () => {
      const manifest = createManifestTemplate({
        id: 'malformed-plugin',
        name: 'Malformed Plugin',
        main: 'broken.js'
      })
      
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      // Create a malformed JavaScript file
      await fs.writeFile(path.join(pluginDir, 'broken.js'), 'syntax error {{{')
      
      pluginManager.registry.set('malformed-plugin', {
        path: pluginDir,
        manifest,
        status: 'discovered'
      })
      
      pluginManager.dependencies.set('malformed-plugin', new Set())
      
      // Mock dynamic import to simulate syntax error
      const originalImport = global.import
      global.import = vi.fn().mockRejectedValue(new SyntaxError('Unexpected token'))
      
      try {
        await expect(pluginManager.loadPlugin('malformed-plugin'))
          .rejects.toThrow()
        
        expect(pluginManager.registry.get('malformed-plugin').status).toBe('error')
      } finally {
        global.import = originalImport
      }
    })

    it('should validate plugin class exports', async () => {
      const manifest = createManifestTemplate({
        id: 'no-export-plugin',
        name: 'No Export Plugin',
        main: 'index.js'
      })
      
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      await fs.writeFile(
        path.join(pluginDir, 'index.js'),
        'console.log("No plugin class exported")'
      )
      
      pluginManager.registry.set('no-export-plugin', {
        path: pluginDir,
        manifest,
        status: 'discovered'
      })
      
      pluginManager.dependencies.set('no-export-plugin', new Set())
      
      // Mock import with no default export
      const originalImport = global.import
      global.import = vi.fn().mockResolvedValue({})
      
      try {
        await expect(pluginManager.loadPlugin('no-export-plugin'))
          .rejects.toThrow('Plugin must export a default class or Plugin class')
        
        expect(pluginManager.registry.get('no-export-plugin').status).toBe('error')
      } finally {
        global.import = originalImport
      }
    })
  })

  describe('Plugin Manifest File Operations', () => {
    it('should validate manifest files before loading', async () => {
      const pluginDir = path.join(testDir, 'validation-test')
      await fs.mkdir(pluginDir, { recursive: true })
      
      // Test various manifest validation scenarios
      const testCases = [
        {
          name: 'valid-manifest',
          manifest: createManifestTemplate({
            id: 'valid-test',
            name: 'Valid Test Plugin'
          }),
          shouldPass: true
        },
        {
          name: 'missing-id',
          manifest: {
            name: 'Test Plugin',
            version: '1.0.0',
            main: 'index.js',
            lokusVersion: '^1.0.0'
          },
          shouldPass: false
        },
        {
          name: 'invalid-version',
          manifest: {
            id: 'invalid-version',
            name: 'Invalid Version',
            version: 'not-a-version',
            main: 'index.js',
            lokusVersion: '^1.0.0'
          },
          shouldPass: false
        }
      ]
      
      for (const testCase of testCases) {
        const manifestPath = path.join(pluginDir, `${testCase.name}.json`)
        await fs.writeFile(manifestPath, JSON.stringify(testCase.manifest, null, 2))
        
        const result = validateManifest(testCase.manifest)
        
        if (testCase.shouldPass) {
          expect(result.valid).toBe(true)
        } else {
          expect(result.valid).toBe(false)
          expect(result.errors.length).toBeGreaterThan(0)
        }
      }
    })

    it('should handle corrupted manifest files', async () => {
      const pluginDir = path.join(testDir, 'corrupted-manifest')
      await fs.mkdir(pluginDir, { recursive: true })
      
      // Create corrupted JSON
      await fs.writeFile(
        path.join(pluginDir, 'plugin.json'),
        '{ "id": "corrupted", "name": "Corrupted" invalid json }'
      )
      
      mockReadTextFile.mockImplementation(async (filePath) => {
        if (filePath.includes('corrupted-manifest')) {
          return '{ "id": "corrupted", "name": "Corrupted" invalid json }'
        }
        return '{}'
      })
      
      mockReadDir.mockResolvedValue([
        { name: 'corrupted-manifest', path: pluginDir, children: [] }
      ])
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      await pluginManager.discoverPlugins()
      
      // Corrupted plugin should not be registered
      expect(pluginManager.registry.has('corrupted')).toBe(false)
    })
  })

  describe('Plugin File System Security', () => {
    it('should validate file permissions through API', async () => {
      const api = apiFactory.createAPI('test-plugin', {
        permissions: ['read_files']
      })
      
      expect(api.hasPermission('read_files')).toBe(true)
      expect(api.hasPermission('write_files')).toBe(false)
    })

    it('should prevent path traversal in file operations', async () => {
      const api = apiFactory.createAPI('security-test', {
        permissions: ['read_files']
      })
      
      // Mock the file operations to test path validation
      mockReadTextFile.mockRejectedValue(new Error('Invalid file path'))
      
      await expect(api.readFile('../../../etc/passwd'))
        .rejects.toThrow('Invalid file path')
        
      await expect(api.readFile('~/sensitive/file'))
        .rejects.toThrow('Invalid file path')
    })
  })

  describe('Plugin Directory Structure', () => {
    it('should handle complex plugin directory structures', async () => {
      const complexPluginDir = path.join(testDir, 'complex-plugin')
      const subDir = path.join(complexPluginDir, 'lib')
      const assetsDir = path.join(complexPluginDir, 'assets')
      
      await fs.mkdir(complexPluginDir, { recursive: true })
      await fs.mkdir(subDir, { recursive: true })
      await fs.mkdir(assetsDir, { recursive: true })
      
      const manifest = createManifestTemplate({
        id: 'complex-plugin',
        name: 'Complex Plugin',
        main: 'src/index.js'
      })
      
      // Create directory structure
      const srcDir = path.join(complexPluginDir, 'src')
      await fs.mkdir(srcDir, { recursive: true })
      
      await fs.writeFile(
        path.join(complexPluginDir, 'plugin.json'),
        JSON.stringify(manifest, null, 2)
      )
      
      await fs.writeFile(
        path.join(srcDir, 'index.js'),
        'export default class ComplexPlugin {}'
      )
      
      await fs.writeFile(
        path.join(subDir, 'utils.js'),
        'export const helper = () => "help"'
      )
      
      await fs.writeFile(
        path.join(assetsDir, 'style.css'),
        '.plugin { color: red; }'
      )
      
      // Test plugin discovery
      mockReadDir.mockResolvedValue([
        { name: 'complex-plugin', path: complexPluginDir, children: [] }
      ])
      
      mockReadTextFile.mockResolvedValue(JSON.stringify(manifest))
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      await pluginManager.discoverPlugins()
      
      expect(pluginManager.registry.has('complex-plugin')).toBe(true)
      
      const pluginInfo = pluginManager.registry.get('complex-plugin')
      expect(pluginInfo.manifest.main).toBe('src/index.js')
    })
  })

  describe('Plugin Loading Performance', () => {
    it('should handle multiple plugins efficiently', async () => {
      const numPlugins = 10
      const plugins = []
      
      // Create multiple test plugins
      for (let i = 0; i < numPlugins; i++) {
        const pluginDir = path.join(testDir, `perf-plugin-${i}`)
        await fs.mkdir(pluginDir, { recursive: true })
        
        const manifest = createManifestTemplate({
          id: `perf-plugin-${i}`,
          name: `Performance Plugin ${i}`,
          main: 'index.js'
        })
        
        await fs.writeFile(
          path.join(pluginDir, 'plugin.json'),
          JSON.stringify(manifest, null, 2)
        )
        
        await fs.writeFile(
          path.join(pluginDir, 'index.js'),
          `export default class PerfPlugin${i} {}`
        )
        
        plugins.push({
          name: `perf-plugin-${i}`,
          path: pluginDir,
          children: []
        })
      }
      
      mockReadDir.mockResolvedValue(plugins)
      
      mockReadTextFile.mockImplementation(async (filePath) => {
        const match = filePath.match(/perf-plugin-(\d+)/)
        if (match) {
          const index = match[1]
          return JSON.stringify(createManifestTemplate({
            id: `perf-plugin-${index}`,
            name: `Performance Plugin ${index}`,
            main: 'index.js'
          }))
        }
        throw new Error('File not found')
      })
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      const startTime = performance.now()
      await pluginManager.discoverPlugins()
      const endTime = performance.now()
      
      expect(pluginManager.registry.size).toBe(numPlugins)
      
      // Discovery should complete within reasonable time (adjust as needed)
      const discoveryTime = endTime - startTime
      expect(discoveryTime).toBeLessThan(1000) // 1 second
    })
  })

  describe('Error Recovery', () => {
    it('should recover from partial loading failures', async () => {
      const workingPluginDir = path.join(testDir, 'working-plugin')
      const brokenPluginDir = path.join(testDir, 'broken-plugin')
      
      await fs.mkdir(workingPluginDir, { recursive: true })
      await fs.mkdir(brokenPluginDir, { recursive: true })
      
      const workingManifest = createManifestTemplate({
        id: 'working-plugin',
        name: 'Working Plugin'
      })
      
      const brokenManifest = createManifestTemplate({
        id: 'broken-plugin',
        name: 'Broken Plugin'
      })
      
      await fs.writeFile(
        path.join(workingPluginDir, 'plugin.json'),
        JSON.stringify(workingManifest, null, 2)
      )
      
      await fs.writeFile(
        path.join(brokenPluginDir, 'plugin.json'),
        JSON.stringify(brokenManifest, null, 2)
      )
      
      await fs.writeFile(
        path.join(workingPluginDir, 'index.js'),
        'export default class WorkingPlugin {}'
      )
      
      // Create broken main file for broken plugin
      await fs.writeFile(
        path.join(brokenPluginDir, 'index.js'),
        'throw new Error("Intentional error")'
      )
      
      mockReadDir.mockResolvedValue([
        { name: 'working-plugin', path: workingPluginDir, children: [] },
        { name: 'broken-plugin', path: brokenPluginDir, children: [] }
      ])
      
      mockReadTextFile.mockImplementation(async (filePath) => {
        if (filePath.includes('working-plugin')) {
          return JSON.stringify(workingManifest)
        } else if (filePath.includes('broken-plugin')) {
          return JSON.stringify(brokenManifest)
        }
        throw new Error('File not found')
      })
      
      pluginManager.pluginDirs.clear()
      pluginManager.pluginDirs.add(testDir)
      
      await pluginManager.discoverPlugins()
      
      // Both plugins should be discovered
      expect(pluginManager.registry.size).toBe(2)
      
      // Mock plugin loading
      pluginManager.registry.forEach(plugin => {
        pluginManager.dependencies.set(plugin.manifest.id, new Set())
      })
      
      const originalImport = global.import
      global.import = vi.fn().mockImplementation(async (path) => {
        if (path.includes('broken-plugin')) {
          throw new Error('Intentional error')
        }
        return { default: class TestPlugin {} }
      })
      
      try {
        await pluginManager.loadAllPlugins()
        
        // Working plugin should be loaded, broken plugin should have error status
        expect(pluginManager.isPluginLoaded('working-plugin')).toBe(true)
        expect(pluginManager.isPluginLoaded('broken-plugin')).toBe(false)
        expect(pluginManager.registry.get('broken-plugin').status).toBe('error')
      } finally {
        global.import = originalImport
      }
    })
  })
})