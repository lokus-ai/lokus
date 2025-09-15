/**
 * Integration tests for Plugin Manifest v2 system
 * Tests validation, migration, and activation event functionality
 */

import { describe, it, expect, beforeEach } from 'vitest'

// Import the new v2 system
import { 
  validateManifestEnhanced,
  createManifestV2Template,
  migrateManifest,
  canMigrateManifest,
  PluginManifestV2,
  ActivationEventManager,
  ActivationContext,
  ACTIVATION_EVENT_TYPES
} from '../../src/plugins/core/PluginManifest.js'

describe('Plugin Manifest v2 System', () => {
  describe('Manifest v2 Creation', () => {
    it('should create a valid v2 manifest template', () => {
      const manifest = createManifestV2Template({
        id: 'test-plugin',
        name: 'Test Plugin',
        publisher: 'test-publisher',
        description: 'A test plugin for Lokus'
      })

      expect(manifest.manifest).toBe('2.0')
      expect(manifest.id).toBe('test-plugin')
      expect(manifest.name).toBe('Test Plugin')
      expect(manifest.publisher).toBe('test-publisher')
      expect(manifest.engines).toHaveProperty('lokus')
      expect(manifest.capabilities).toBeDefined()
    })

    it('should include required v2 fields', () => {
      const manifest = createManifestV2Template()

      expect(manifest).toHaveProperty('manifest', '2.0')
      expect(manifest).toHaveProperty('id')
      expect(manifest).toHaveProperty('name')
      expect(manifest).toHaveProperty('version')
      expect(manifest).toHaveProperty('engines')
      expect(manifest.engines).toHaveProperty('lokus')
    })
  })

  describe('Manifest v2 Validation', () => {
    let validV2Manifest

    beforeEach(() => {
      validV2Manifest = createManifestV2Template({
        id: 'test-plugin',
        name: 'Test Plugin',
        publisher: 'test-publisher'
      })
    })

    it('should validate a correct v2 manifest', () => {
      const result = validateManifestEnhanced(validV2Manifest)
      
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect missing required fields', () => {
      const invalidManifest = { ...validV2Manifest }
      delete invalidManifest.engines

      const result = validateManifestEnhanced(invalidManifest)
      
      expect(result.valid).toBe(false)
      expect(result.errors.some(error => error.message.includes('engines'))).toBe(true)
    })

    it('should validate activation events', () => {
      const manifestWithEvents = {
        ...validV2Manifest,
        activationEvents: ['onStartupFinished', 'onCommand:test.command', 'onLanguage:javascript']
      }

      const result = validateManifestEnhanced(manifestWithEvents)
      
      expect(result.valid).toBe(true)
    })

    it('should warn about unknown activation events', () => {
      const manifestWithInvalidEvents = {
        ...validV2Manifest,
        activationEvents: ['onStartupFinished', 'onInvalidEvent:something']
      }

      const result = validateManifestEnhanced(manifestWithInvalidEvents)
      
      expect(result.warnings.some(warning => 
        warning.message.includes('onInvalidEvent:something')
      )).toBe(true)
    })

    it('should validate categories', () => {
      const manifestWithCategories = {
        ...validV2Manifest,
        categories: ['Programming Languages', 'Themes']
      }

      const result = validateManifestEnhanced(manifestWithCategories)
      
      expect(result.valid).toBe(true)
    })

    it('should warn about unknown categories', () => {
      const manifestWithInvalidCategories = {
        ...validV2Manifest,
        categories: ['Programming Languages', 'Invalid Category']
      }

      const result = validateManifestEnhanced(manifestWithInvalidCategories)
      
      expect(result.warnings.some(warning => 
        warning.message.includes('Invalid Category')
      )).toBe(true)
    })
  })

  describe('Manifest Migration (v1 to v2)', () => {
    let validV1Manifest

    beforeEach(() => {
      validV1Manifest = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        main: 'index.js',
        lokusVersion: '^1.0.0',
        author: 'Test Author',
        license: 'MIT',
        activationEvents: ['onStartup'],
        categories: ['Other'],
        permissions: ['read_files']
      }
    })

    it('should detect if manifest can be migrated', () => {
      const result = canMigrateManifest(validV1Manifest)
      
      expect(result.upgradeable).toBe(true)
    })

    it('should migrate v1 manifest to v2', () => {
      const result = migrateManifest(validV1Manifest)
      
      expect(result.success).toBe(true)
      expect(result.v2Manifest).toBeDefined()
      expect(result.v2Manifest.manifest).toBe('2.0')
      expect(result.v2Manifest.engines.lokus).toBe('^1.0.0')
      expect(result.v2Manifest.activationEvents).toContain('onStartupFinished')
    })

    it('should convert activation events correctly', () => {
      const v1WithEvents = {
        ...validV1Manifest,
        activationEvents: ['onStartup', 'onCommand:test', 'onLanguage:javascript']
      }

      const result = migrateManifest(v1WithEvents)
      
      expect(result.success).toBe(true)
      expect(result.v2Manifest.activationEvents).toContain('onStartupFinished')
      expect(result.v2Manifest.activationEvents).toContain('onCommand:test')
      expect(result.v2Manifest.activationEvents).toContain('onLanguage:javascript')
    })

    it('should migrate permissions to capabilities', () => {
      const result = migrateManifest(validV1Manifest)
      
      expect(result.success).toBe(true)
      expect(result.v2Manifest.capabilities).toBeDefined()
      expect(result.v2Manifest.capabilities.untrustedWorkspaces).toBeDefined()
      expect(result.v2Manifest.capabilities.virtualWorkspaces).toBeDefined()
    })

    it('should provide migration log', () => {
      const result = migrateManifest(validV1Manifest)
      
      expect(result.log).toBeDefined()
      expect(result.log.length).toBeGreaterThan(0)
      expect(result.log.some(entry => entry.message.includes('migration'))).toBe(true)
    })
  })

  describe('Activation Event System', () => {
    let activationManager
    let mockPluginManager

    beforeEach(() => {
      mockPluginManager = {
        activatePlugin: vi.fn().mockResolvedValue(true),
        deactivatePlugin: vi.fn().mockResolvedValue(true)
      }
      
      activationManager = new ActivationEventManager(mockPluginManager)
    })

    it('should register plugin for activation events', () => {
      const manifest = createManifestV2Template({
        id: 'test-plugin',
        activationEvents: ['onStartupFinished', 'onCommand:test.command']
      })

      activationManager.registerPlugin(manifest)
      
      const stats = activationManager.getStatistics()
      expect(stats.registry.totalPlugins).toBe(1)
    })

    it('should fire command activation event', async () => {
      const manifest = createManifestV2Template({
        id: 'test-plugin',
        activationEvents: ['onCommand:test.command']
      })

      activationManager.registerPlugin(manifest)
      
      await activationManager.onCommand('test.command')
      
      expect(mockPluginManager.activatePlugin).toHaveBeenCalledWith(
        'test-plugin',
        expect.any(ActivationContext)
      )
    })

    it('should fire language activation event', async () => {
      const manifest = createManifestV2Template({
        id: 'test-plugin',
        activationEvents: ['onLanguage:javascript']
      })

      activationManager.registerPlugin(manifest)
      
      await activationManager.onLanguage('javascript')
      
      expect(mockPluginManager.activatePlugin).toHaveBeenCalledWith(
        'test-plugin',
        expect.any(ActivationContext)
      )
    })

    it('should not activate plugin for non-matching events', async () => {
      const manifest = createManifestV2Template({
        id: 'test-plugin',
        activationEvents: ['onCommand:other.command']
      })

      activationManager.registerPlugin(manifest)
      
      await activationManager.onCommand('test.command')
      
      expect(mockPluginManager.activatePlugin).not.toHaveBeenCalled()
    })
  })

  describe('Complex Integration Scenarios', () => {
    it('should handle full plugin lifecycle with v2 manifest', async () => {
      // Create v2 manifest
      const manifest = createManifestV2Template({
        id: 'integration-test',
        name: 'Integration Test Plugin',
        publisher: 'test',
        activationEvents: ['onStartupFinished', 'onCommand:integration.test'],
        contributes: {
          commands: [{
            command: 'integration.test',
            title: 'Integration Test Command'
          }]
        }
      })

      // Validate manifest
      const validation = validateManifestEnhanced(manifest)
      expect(validation.valid).toBe(true)

      // Setup activation manager
      const mockPluginManager = {
        activatePlugin: vi.fn().mockResolvedValue(true),
        deactivatePlugin: vi.fn().mockResolvedValue(true)
      }
      
      const activationManager = new ActivationEventManager(mockPluginManager)
      
      // Register plugin
      activationManager.registerPlugin(manifest)
      
      // Test command activation
      await activationManager.onCommand('integration.test')
      
      expect(mockPluginManager.activatePlugin).toHaveBeenCalledWith(
        'integration-test',
        expect.any(ActivationContext)
      )
    })

    it('should handle migration and validation flow', () => {
      // Start with v1 manifest
      const v1Manifest = {
        id: 'migration-test',
        name: 'Migration Test',
        version: '1.0.0',
        main: 'index.js',
        lokusVersion: '^1.0.0',
        activationEvents: ['onStartup'],
        categories: ['Other']
      }

      // Check if can migrate
      const canMigrate = canMigrateManifest(v1Manifest)
      expect(canMigrate.upgradeable).toBe(true)

      // Migrate to v2
      const migration = migrateManifest(v1Manifest)
      expect(migration.success).toBe(true)

      // Validate migrated manifest
      const validation = validateManifestEnhanced(migration.v2Manifest)
      expect(validation.valid).toBe(true)

      // Check migrated properties
      expect(migration.v2Manifest.manifest).toBe('2.0')
      expect(migration.v2Manifest.activationEvents).toContain('onStartupFinished')
      expect(migration.v2Manifest.capabilities).toBeDefined()
    })
  })
})

// Mock vitest functions if not available
if (typeof vi === 'undefined') {
  global.vi = {
    fn: (impl) => {
      const mock = impl || (() => {})
      mock.mockResolvedValue = (value) => {
        mock._mockResolvedValue = value
        return mock
      }
      mock.mockReturnValue = (value) => {
        mock._mockReturnValue = value
        return mock
      }
      return mock
    }
  }
}