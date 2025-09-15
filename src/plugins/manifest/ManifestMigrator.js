/**
 * Plugin Manifest Migrator
 * Handles migration from v1 to v2 manifest format
 */

import { MANIFEST_VERSIONS } from './ManifestValidator.js'
import { CATEGORIES_V2, ACTIVATION_EVENTS_V2 } from './ManifestV2.js'

/**
 * Migration mapping for v1 to v2 categories
 */
const CATEGORY_MIGRATION_MAP = {
  'Editor': 'Other',
  'Formatter': 'Formatters',
  'Linter': 'Linters',
  'Debugger': 'Debuggers',
  'Language': 'Programming Languages',
  'Theme': 'Themes',
  'Snippet': 'Snippets',
  'Keybinding': 'Keymaps',
  'Extension Pack': 'Extension Packs',
  'Other': 'Other'
}

/**
 * Migration mapping for v1 to v2 activation events
 */
const ACTIVATION_EVENT_MIGRATION_MAP = {
  'onStartup': 'onStartupFinished',
  'onCommand:*': 'onCommand:',
  'onLanguage:*': 'onLanguage:',
  'onFileType:*': 'onLanguage:',
  'onView:*': 'onView:',
  'onUri:*': 'onUri',
  'onWebviewPanel:*': 'onWebviewPanel:',
  'workspaceContains:*': 'workspaceContains:'
}

/**
 * Migration mapping for v1 to v2 permissions
 */
const PERMISSION_MIGRATION_MAP = {
  'read_files': 'files:read',
  'write_files': 'files:write',
  'execute_commands': 'system:execute',
  'access_network': 'network:http',
  'modify_ui': 'ui:modify',
  'access_settings': 'settings:read',
  'access_vault': 'workspace:read',
  'all': 'system:all'
}

/**
 * Manifest Migrator Class
 */
export class ManifestMigrator {
  constructor() {
    this.migrationLog = []
    this.warnings = []
    this.errors = []
  }

  /**
   * Migrate v1 manifest to v2
   */
  migrate(v1Manifest) {
    this.reset()

    try {
      // Parse if string
      const manifest = typeof v1Manifest === 'string' 
        ? JSON.parse(v1Manifest) 
        : { ...v1Manifest }

      // Validate it's a v1 manifest
      if (!this.isV1Manifest(manifest)) {
        this.addError('migration', 'Input is not a valid v1 manifest')
        return this.getMigrationResult(null)
      }

      this.log('Starting migration from v1 to v2')

      // Create v2 manifest structure
      const v2Manifest = this.performMigration(manifest)

      // Validate migrated manifest
      const validation = this.validateMigratedManifest(v2Manifest)

      this.log('Migration completed successfully')

      return this.getMigrationResult(v2Manifest, validation)
    } catch (error) {
      this.addError('migration', `Migration failed: ${error.message}`)
      return this.getMigrationResult(null)
    }
  }

  /**
   * Perform the actual migration
   */
  performMigration(v1Manifest) {
    const v2Manifest = {}

    // 1. Set manifest version
    v2Manifest.manifest = '2.0'
    this.log('Set manifest version to 2.0')

    // 2. Migrate basic fields
    this.migrateBasicFields(v1Manifest, v2Manifest)

    // 3. Migrate engine compatibility
    this.migrateEngines(v1Manifest, v2Manifest)

    // 4. Migrate categories
    this.migrateCategories(v1Manifest, v2Manifest)

    // 5. Migrate activation events
    this.migrateActivationEvents(v1Manifest, v2Manifest)

    // 6. Migrate permissions to capabilities
    this.migratePermissions(v1Manifest, v2Manifest)

    // 7. Migrate contributions
    this.migrateContributions(v1Manifest, v2Manifest)

    // 8. Migrate author information
    this.migrateAuthor(v1Manifest, v2Manifest)

    // 9. Migrate repository information
    this.migrateRepository(v1Manifest, v2Manifest)

    // 10. Migrate optional fields
    this.migrateOptionalFields(v1Manifest, v2Manifest)

    // 11. Add v2-specific defaults
    this.addV2Defaults(v2Manifest)

    return v2Manifest
  }

  /**
   * Migrate basic required fields
   */
  migrateBasicFields(v1, v2) {
    // Required fields with direct mapping
    const directMappings = {
      id: 'id',
      name: 'name',
      version: 'version',
      description: 'description',
      main: 'main'
    }

    Object.entries(directMappings).forEach(([v1Field, v2Field]) => {
      if (v1[v1Field]) {
        v2[v2Field] = v1[v1Field]
        this.log(`Migrated ${v1Field} -> ${v2Field}`)
      }
    })

    // Extract publisher from id if it contains a dot
    if (v1.id && v1.id.includes('.')) {
      const parts = v1.id.split('.')
      if (parts.length === 2) {
        v2.publisher = parts[0]
        v2.id = parts[1]
        this.log(`Extracted publisher '${v2.publisher}' from id`)
      }
    }

    // Set displayName if not present
    if (!v2.displayName && v2.name) {
      v2.displayName = v2.name
      this.log('Set displayName from name')
    }
  }

  /**
   * Migrate engine compatibility
   */
  migrateEngines(v1, v2) {
    v2.engines = {}

    if (v1.lokusVersion) {
      v2.engines.lokus = v1.lokusVersion
      this.log(`Migrated lokusVersion to engines.lokus: ${v1.lokusVersion}`)
    } else {
      v2.engines.lokus = '^1.0.0'
      this.addWarning('No lokusVersion specified, defaulted to ^1.0.0')
    }

    // Add Node.js engine if main file is specified
    if (v1.main) {
      v2.engines.node = '>=16.0.0'
      this.log('Added Node.js engine requirement')
    }
  }

  /**
   * Migrate categories
   */
  migrateCategories(v1, v2) {
    if (v1.categories && Array.isArray(v1.categories)) {
      v2.categories = v1.categories
        .map(cat => CATEGORY_MIGRATION_MAP[cat] || cat)
        .filter(cat => CATEGORIES_V2.includes(cat))

      if (v2.categories.length === 0) {
        v2.categories = ['Other']
        this.addWarning('No valid categories found, defaulted to Other')
      } else {
        this.log(`Migrated categories: ${v2.categories.join(', ')}`)
      }
    } else {
      v2.categories = ['Other']
      this.log('No categories specified, defaulted to Other')
    }
  }

  /**
   * Migrate activation events
   */
  migrateActivationEvents(v1, v2) {
    if (v1.activationEvents && Array.isArray(v1.activationEvents)) {
      v2.activationEvents = []

      v1.activationEvents.forEach(event => {
        const migrated = this.migrateActivationEvent(event)
        if (migrated && !v2.activationEvents.includes(migrated)) {
          v2.activationEvents.push(migrated)
        }
      })

      if (v2.activationEvents.length === 0) {
        v2.activationEvents = ['onStartupFinished']
        this.addWarning('No valid activation events found, defaulted to onStartupFinished')
      } else {
        this.log(`Migrated activation events: ${v2.activationEvents.join(', ')}`)
      }
    } else {
      v2.activationEvents = ['onStartupFinished']
      this.log('No activation events specified, defaulted to onStartupFinished')
    }
  }

  /**
   * Migrate single activation event
   */
  migrateActivationEvent(event) {
    // Direct migration mappings
    if (ACTIVATION_EVENT_MIGRATION_MAP[event]) {
      return ACTIVATION_EVENT_MIGRATION_MAP[event]
    }

    // Pattern-based migrations
    for (const [pattern, replacement] of Object.entries(ACTIVATION_EVENT_MIGRATION_MAP)) {
      if (pattern.endsWith('*') && event.startsWith(pattern.slice(0, -1))) {
        return event.replace(pattern.slice(0, -1), replacement)
      }
    }

    // Special cases
    if (event === 'onStartup') {
      this.addWarning('onStartup changed to onStartupFinished in v2')
      return 'onStartupFinished'
    }

    if (event.startsWith('onFileType:')) {
      const fileType = event.replace('onFileType:', '')
      this.addWarning(`onFileType:${fileType} changed to onLanguage:${fileType} in v2`)
      return `onLanguage:${fileType}`
    }

    // Return as-is if no migration needed and it's valid
    if (this.isValidV2ActivationEvent(event)) {
      return event
    }

    this.addWarning(`Unknown activation event: ${event}`)
    return null
  }

  /**
   * Check if activation event is valid for v2
   */
  isValidV2ActivationEvent(event) {
    return Object.values(ACTIVATION_EVENTS_V2).some(validEvent => {
      if (validEvent.endsWith(':')) {
        return event.startsWith(validEvent)
      }
      return event === validEvent
    })
  }

  /**
   * Migrate permissions to capabilities
   */
  migratePermissions(v1, v2) {
    if (v1.permissions && Array.isArray(v1.permissions)) {
      // Create basic capability declarations based on permissions
      v2.capabilities = {
        untrustedWorkspaces: {
          supported: !v1.permissions.includes('all') && !v1.permissions.includes('execute_commands')
        },
        virtualWorkspaces: {
          supported: !v1.permissions.includes('write_files') && !v1.permissions.includes('execute_commands')
        }
      }

      // Log permission to capability migration
      if (v1.permissions.includes('all') || v1.permissions.includes('execute_commands')) {
        this.addWarning('Plugin requires dangerous permissions - restricted workspace support')
      }

      this.log('Migrated permissions to capabilities')
    } else {
      // Default safe capabilities
      v2.capabilities = {
        untrustedWorkspaces: { supported: true },
        virtualWorkspaces: { supported: true }
      }
      this.log('Set default safe capabilities')
    }
  }

  /**
   * Migrate contributions
   */
  migrateContributions(v1, v2) {
    if (v1.contributes && typeof v1.contributes === 'object') {
      v2.contributes = {}

      // Direct migration for compatible contribution points
      const compatibleContributions = [
        'commands', 'menus', 'keybindings', 'languages', 
        'grammars', 'themes', 'snippets', 'configuration',
        'views', 'viewsContainers', 'problemMatchers', 'taskDefinitions'
      ]

      compatibleContributions.forEach(contrib => {
        if (v1.contributes[contrib]) {
          v2.contributes[contrib] = v1.contributes[contrib]
          this.log(`Migrated contribution: ${contrib}`)
        }
      })

      // Migrate iconThemes from themes if needed
      if (v1.contributes.themes) {
        const iconThemes = v1.contributes.themes.filter(theme => 
          theme.id && theme.id.includes('icon')
        )
        if (iconThemes.length > 0) {
          v2.contributes.iconThemes = iconThemes
          this.log('Extracted icon themes from themes')
        }
      }
    }
  }

  /**
   * Migrate author information
   */
  migrateAuthor(v1, v2) {
    if (v1.author) {
      if (typeof v1.author === 'string') {
        v2.author = v1.author
      } else if (typeof v1.author === 'object') {
        v2.author = { ...v1.author }
      }
      this.log('Migrated author information')
    }
  }

  /**
   * Migrate repository information
   */
  migrateRepository(v1, v2) {
    if (v1.repository) {
      if (typeof v1.repository === 'string') {
        v2.repository = {
          type: 'git',
          url: v1.repository
        }
      } else {
        v2.repository = { ...v1.repository }
      }
      this.log('Migrated repository information')
    }
  }

  /**
   * Migrate optional fields
   */
  migrateOptionalFields(v1, v2) {
    const optionalFields = [
      'license', 'homepage', 'keywords', 'icon', 
      'galleryBanner', 'preview', 'qna'
    ]

    optionalFields.forEach(field => {
      if (v1[field] !== undefined) {
        v2[field] = v1[field]
        this.log(`Migrated optional field: ${field}`)
      }
    })

    // Handle dependencies -> extensionDependencies
    if (v1.dependencies && typeof v1.dependencies === 'object') {
      v2.extensionDependencies = Object.keys(v1.dependencies)
      this.log('Migrated dependencies to extensionDependencies')
    }
  }

  /**
   * Add v2-specific defaults
   */
  addV2Defaults(v2) {
    // Add pricing if not specified
    if (!v2.pricing) {
      v2.pricing = 'Free'
      this.log('Set default pricing to Free')
    }

    // Add markdown flavor
    if (!v2.markdown) {
      v2.markdown = 'standard'
      this.log('Set default markdown flavor to standard')
    }

    // Ensure we have at least one category
    if (!v2.categories || v2.categories.length === 0) {
      v2.categories = ['Other']
    }

    // Ensure we have at least one activation event
    if (!v2.activationEvents || v2.activationEvents.length === 0) {
      v2.activationEvents = ['onStartupFinished']
    }
  }

  /**
   * Check if manifest is v1
   */
  isV1Manifest(manifest) {
    // Explicit v1 version
    if (manifest.manifest === '1.0') return true
    
    // Legacy v1 indicators
    if (manifest.lokusVersion && !manifest.engines) return true
    
    // Has v1 required fields but not v2 indicators
    const hasV1Fields = !!(manifest.id && manifest.name && manifest.version && manifest.main)
    const hasV2Indicators = !!(manifest.engines || manifest.publisher || manifest.manifest === '2.0')
    
    return hasV1Fields && !hasV2Indicators
  }

  /**
   * Validate migrated manifest
   */
  validateMigratedManifest(v2Manifest) {
    // Basic validation - would integrate with ManifestValidator
    const errors = []
    const warnings = []

    // Check required v2 fields
    const requiredFields = ['manifest', 'id', 'name', 'version', 'engines']
    requiredFields.forEach(field => {
      if (!v2Manifest[field]) {
        errors.push(`Missing required field: ${field}`)
      }
    })

    // Check version format
    if (v2Manifest.manifest !== '2.0') {
      errors.push('Manifest version must be 2.0')
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * Create migration preview without performing migration
   */
  preview(v1Manifest) {
    try {
      const manifest = typeof v1Manifest === 'string' 
        ? JSON.parse(v1Manifest) 
        : v1Manifest

      if (!this.isV1Manifest(manifest)) {
        return {
          canMigrate: false,
          reason: 'Not a valid v1 manifest'
        }
      }

      const changes = []

      // Analyze what will change
      changes.push('Manifest version will be updated to 2.0')
      
      if (manifest.lokusVersion) {
        changes.push(`lokusVersion will move to engines.lokus`)
      }

      if (manifest.id && manifest.id.includes('.')) {
        changes.push('Publisher will be extracted from plugin ID')
      }

      if (manifest.categories) {
        const newCategories = manifest.categories
          .map(cat => CATEGORY_MIGRATION_MAP[cat] || cat)
          .filter(cat => CATEGORIES_V2.includes(cat))
        if (newCategories.join(',') !== manifest.categories.join(',')) {
          changes.push('Categories will be updated for v2 compatibility')
        }
      }

      if (manifest.activationEvents) {
        const hasChanges = manifest.activationEvents.some(event => 
          ACTIVATION_EVENT_MIGRATION_MAP[event] || event === 'onStartup' || event.startsWith('onFileType:')
        )
        if (hasChanges) {
          changes.push('Activation events will be updated for v2 compatibility')
        }
      }

      if (manifest.permissions) {
        changes.push('Permissions will be converted to capability declarations')
      }

      if (manifest.dependencies) {
        changes.push('Dependencies will be converted to extensionDependencies')
      }

      return {
        canMigrate: true,
        changes,
        estimatedComplexity: this.estimateMigrationComplexity(manifest)
      }
    } catch (error) {
      return {
        canMigrate: false,
        reason: `Invalid manifest: ${error.message}`
      }
    }
  }

  /**
   * Estimate migration complexity
   */
  estimateMigrationComplexity(manifest) {
    let complexity = 1 // Base complexity

    if (manifest.contributes) {
      complexity += Object.keys(manifest.contributes).length * 0.5
    }

    if (manifest.activationEvents && manifest.activationEvents.length > 3) {
      complexity += 1
    }

    if (manifest.permissions && manifest.permissions.length > 5) {
      complexity += 1
    }

    if (manifest.dependencies) {
      complexity += Object.keys(manifest.dependencies).length * 0.3
    }

    if (complexity <= 2) return 'low'
    if (complexity <= 4) return 'medium'
    return 'high'
  }

  /**
   * Reset migrator state
   */
  reset() {
    this.migrationLog = []
    this.warnings = []
    this.errors = []
  }

  /**
   * Add log entry
   */
  log(message) {
    this.migrationLog.push({
      type: 'info',
      message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Add warning
   */
  addWarning(message) {
    this.warnings.push({
      type: 'warning',
      message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Add error
   */
  addError(field, message) {
    this.errors.push({
      type: 'error',
      field,
      message,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Get migration result
   */
  getMigrationResult(v2Manifest, validation = null) {
    return {
      success: this.errors.length === 0 && v2Manifest !== null,
      v2Manifest,
      validation,
      log: [...this.migrationLog],
      warnings: [...this.warnings],
      errors: [...this.errors],
      stats: {
        logEntries: this.migrationLog.length,
        warnings: this.warnings.length,
        errors: this.errors.length
      }
    }
  }
}

/**
 * Convenience functions
 */

/**
 * Migrate v1 manifest to v2
 */
export function migrateManifest(v1Manifest) {
  const migrator = new ManifestMigrator()
  return migrator.migrate(v1Manifest)
}

/**
 * Preview migration changes
 */
export function previewMigration(v1Manifest) {
  const migrator = new ManifestMigrator()
  return migrator.preview(v1Manifest)
}

/**
 * Check if manifest can be migrated
 */
export function canMigrateManifest(manifest) {
  const migrator = new ManifestMigrator()
  return migrator.isV1Manifest(
    typeof manifest === 'string' ? JSON.parse(manifest) : manifest
  )
}

/**
 * Batch migration for multiple manifests
 */
export function batchMigrateManifests(v1Manifests) {
  const migrator = new ManifestMigrator()
  const results = []

  v1Manifests.forEach((manifest, index) => {
    try {
      const result = migrator.migrate(manifest)
      results.push({
        index,
        success: result.success,
        result
      })
    } catch (error) {
      results.push({
        index,
        success: false,
        error: error.message
      })
    }
  })

  return {
    total: v1Manifests.length,
    successful: results.filter(r => r.success).length,
    failed: results.filter(r => !r.success).length,
    results
  }
}

export default ManifestMigrator