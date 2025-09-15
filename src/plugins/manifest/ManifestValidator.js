/**
 * Enhanced Plugin Manifest Validator
 * Supports both v1 and v2 manifest validation with comprehensive error reporting
 */

import { ManifestValidator as ManifestValidatorV1 } from '../core/PluginManifest.js'
import { PluginManifestV2, validateManifestV2 } from './ManifestV2.js'

/**
 * Manifest version detection
 */
export const MANIFEST_VERSIONS = {
  V1: '1.0',
  V2: '2.0'
}

/**
 * Enhanced Manifest Validator
 * Handles both v1 and v2 manifests with unified interface
 */
export class EnhancedManifestValidator {
  constructor() {
    this.v1Validator = new ManifestValidatorV1()
    this.errors = []
    this.warnings = []
    this.info = []
  }

  /**
   * Validate a manifest (auto-detects version)
   */
  validate(manifestData) {
    this.reset()

    try {
      // Parse manifest if string
      const manifest = typeof manifestData === 'string' 
        ? JSON.parse(manifestData) 
        : manifestData

      // Detect version
      const version = this.detectVersion(manifest)
      
      this.addInfo(`Detected manifest version: ${version}`)

      // Validate based on version
      switch (version) {
        case MANIFEST_VERSIONS.V1:
          return this.validateV1(manifest)
        case MANIFEST_VERSIONS.V2:
          return this.validateV2(manifest)
        default:
          this.addError('manifest', 'Unknown or missing manifest version')
          return this.getResult()
      }
    } catch (error) {
      this.addError('json', `Invalid JSON: ${error.message}`)
      return this.getResult()
    }
  }

  /**
   * Validate v1 manifest
   */
  validateV1(manifest) {
    const v1Result = this.v1Validator.validate(manifest)
    
    // Convert v1 result to enhanced format
    this.errors = v1Result.errors.map(error => ({
      field: typeof error === 'string' ? 'unknown' : 'unknown',
      message: typeof error === 'string' ? error : error.toString(),
      severity: 'error',
      version: 'v1'
    }))

    this.warnings = v1Result.warnings.map(warning => ({
      field: 'unknown',
      message: typeof warning === 'string' ? warning : warning.toString(),
      severity: 'warning',
      version: 'v1'
    }))

    // Add upgrade suggestion
    this.addInfo('Consider upgrading to manifest v2 for enhanced capabilities')

    return this.getResult()
  }

  /**
   * Validate v2 manifest
   */
  validateV2(manifest) {
    const v2Result = validateManifestV2(manifest)
    
    // Use v2 validation results directly
    this.errors = v2Result.errors
    this.warnings = v2Result.warnings

    return this.getResult()
  }

  /**
   * Detect manifest version
   */
  detectVersion(manifest) {
    if (manifest.manifest === '2.0') {
      return MANIFEST_VERSIONS.V2
    }
    
    if (manifest.manifest === '1.0') {
      return MANIFEST_VERSIONS.V1
    }

    // Legacy v1 format (no explicit version)
    if (manifest.lokusVersion && !manifest.engines) {
      return MANIFEST_VERSIONS.V1
    }

    // New v2 format indicators
    if (manifest.engines || manifest.publisher || manifest.activationEvents) {
      return MANIFEST_VERSIONS.V2
    }

    // Default to v1 for backward compatibility
    return MANIFEST_VERSIONS.V1
  }

  /**
   * Validate specific manifest version
   */
  validateVersion(manifestData, version) {
    this.reset()

    try {
      const manifest = typeof manifestData === 'string' 
        ? JSON.parse(manifestData) 
        : manifestData

      switch (version) {
        case MANIFEST_VERSIONS.V1:
          return this.validateV1(manifest)
        case MANIFEST_VERSIONS.V2:
          return this.validateV2(manifest)
        default:
          this.addError('version', `Unsupported manifest version: ${version}`)
          return this.getResult()
      }
    } catch (error) {
      this.addError('json', `Invalid JSON: ${error.message}`)
      return this.getResult()
    }
  }

  /**
   * Check if manifest is upgradeable from v1 to v2
   */
  isUpgradeable(manifestData) {
    try {
      const manifest = typeof manifestData === 'string' 
        ? JSON.parse(manifestData) 
        : manifestData

      const version = this.detectVersion(manifest)
      
      if (version !== MANIFEST_VERSIONS.V1) {
        return {
          upgradeable: false,
          reason: `Manifest is already version ${version}`
        }
      }

      // Check for v1 required fields
      const requiredV1Fields = ['id', 'name', 'version', 'main', 'lokusVersion']
      const missingFields = requiredV1Fields.filter(field => !manifest[field])
      
      if (missingFields.length > 0) {
        return {
          upgradeable: false,
          reason: `Missing required v1 fields: ${missingFields.join(', ')}`
        }
      }

      return {
        upgradeable: true,
        reason: 'Manifest can be upgraded to v2'
      }
    } catch (error) {
      return {
        upgradeable: false,
        reason: `Invalid manifest: ${error.message}`
      }
    }
  }

  /**
   * Get compatibility report
   */
  getCompatibilityReport(manifestData) {
    try {
      const manifest = typeof manifestData === 'string' 
        ? JSON.parse(manifestData) 
        : manifestData

      const version = this.detectVersion(manifest)
      const validation = this.validate(manifest)

      const report = {
        version,
        valid: validation.valid,
        compatibility: {
          v1: true,
          v2: version === MANIFEST_VERSIONS.V2
        },
        features: {
          commands: !!manifest.contributes?.commands?.length,
          menus: !!manifest.contributes?.menus && Object.keys(manifest.contributes.menus).length > 0,
          keybindings: !!manifest.contributes?.keybindings?.length,
          languages: !!manifest.contributes?.languages?.length,
          themes: !!manifest.contributes?.themes?.length,
          configuration: !!manifest.contributes?.configuration,
          views: !!manifest.contributes?.views && Object.keys(manifest.contributes.views).length > 0,
          activationEvents: !!manifest.activationEvents?.length,
          capabilities: !!manifest.capabilities
        },
        recommendations: []
      }

      // Add recommendations based on features
      if (version === MANIFEST_VERSIONS.V1) {
        report.recommendations.push('Consider upgrading to manifest v2 for enhanced capabilities')
        
        if (manifest.activationEvents?.includes('onStartup')) {
          report.recommendations.push('Use "onStartupFinished" instead of "onStartup" in v2')
        }
        
        if (manifest.contributes?.commands?.length > 0) {
          report.recommendations.push('Add command categories and icons in v2')
        }
      }

      if (!manifest.capabilities) {
        report.recommendations.push('Define workspace capabilities for better security')
      }

      if (!manifest.categories?.length) {
        report.recommendations.push('Add categories for better marketplace discoverability')
      }

      return report
    } catch (error) {
      return {
        version: 'unknown',
        valid: false,
        error: error.message,
        compatibility: { v1: false, v2: false },
        features: {},
        recommendations: ['Fix JSON syntax errors']
      }
    }
  }

  /**
   * Validate manifest format without content validation
   */
  validateFormat(manifestData) {
    try {
      const manifest = typeof manifestData === 'string' 
        ? JSON.parse(manifestData) 
        : manifestData

      if (!manifest || typeof manifest !== 'object') {
        return {
          valid: false,
          error: 'Manifest must be a valid JSON object'
        }
      }

      const version = this.detectVersion(manifest)
      
      return {
        valid: true,
        version,
        hasRequiredStructure: this.hasRequiredStructure(manifest, version)
      }
    } catch (error) {
      return {
        valid: false,
        error: `Invalid JSON: ${error.message}`
      }
    }
  }

  /**
   * Check if manifest has required structure for version
   */
  hasRequiredStructure(manifest, version) {
    switch (version) {
      case MANIFEST_VERSIONS.V1:
        return !!(manifest.id && manifest.name && manifest.version && manifest.main)
      case MANIFEST_VERSIONS.V2:
        return !!(manifest.id && manifest.name && manifest.version && manifest.engines)
      default:
        return false
    }
  }

  /**
   * Get validation statistics
   */
  getValidationStats() {
    return {
      errors: this.errors.length,
      warnings: this.warnings.length,
      info: this.info.length,
      total: this.errors.length + this.warnings.length + this.info.length,
      errorsByField: this.getErrorsByField(),
      warningsByField: this.getWarningsByField()
    }
  }

  /**
   * Get errors grouped by field
   */
  getErrorsByField() {
    const grouped = {}
    this.errors.forEach(error => {
      const field = error.field || 'unknown'
      if (!grouped[field]) grouped[field] = []
      grouped[field].push(error)
    })
    return grouped
  }

  /**
   * Get warnings grouped by field
   */
  getWarningsByField() {
    const grouped = {}
    this.warnings.forEach(warning => {
      const field = warning.field || 'unknown'
      if (!grouped[field]) grouped[field] = []
      grouped[field].push(warning)
    })
    return grouped
  }

  /**
   * Reset validator state
   */
  reset() {
    this.errors = []
    this.warnings = []
    this.info = []
  }

  /**
   * Add error
   */
  addError(field, message, data = null) {
    this.errors.push({
      field,
      message,
      severity: 'error',
      data,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Add warning
   */
  addWarning(field, message, data = null) {
    this.warnings.push({
      field,
      message,
      severity: 'warning',
      data,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Add info
   */
  addInfo(message, data = null) {
    this.info.push({
      message,
      severity: 'info',
      data,
      timestamp: new Date().toISOString()
    })
  }

  /**
   * Get validation result
   */
  getResult() {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
      info: [...this.info],
      stats: this.getValidationStats()
    }
  }
}

/**
 * Batch validation for multiple manifests
 */
export class BatchManifestValidator {
  constructor() {
    this.validator = new EnhancedManifestValidator()
    this.results = []
  }

  /**
   * Validate multiple manifests
   */
  validateBatch(manifests) {
    this.results = []

    manifests.forEach((manifestData, index) => {
      try {
        const result = this.validator.validate(manifestData)
        this.results.push({
          index,
          manifest: typeof manifestData === 'string' ? JSON.parse(manifestData) : manifestData,
          validation: result,
          success: true
        })
      } catch (error) {
        this.results.push({
          index,
          manifest: null,
          validation: {
            valid: false,
            errors: [{ field: 'json', message: error.message, severity: 'error' }],
            warnings: [],
            info: []
          },
          success: false,
          error: error.message
        })
      }
    })

    return this.getBatchResult()
  }

  /**
   * Get batch validation result
   */
  getBatchResult() {
    const valid = this.results.filter(r => r.validation.valid)
    const invalid = this.results.filter(r => !r.validation.valid)
    const totalErrors = this.results.reduce((sum, r) => sum + r.validation.errors.length, 0)
    const totalWarnings = this.results.reduce((sum, r) => sum + r.validation.warnings.length, 0)

    return {
      total: this.results.length,
      valid: valid.length,
      invalid: invalid.length,
      totalErrors,
      totalWarnings,
      results: this.results,
      summary: {
        validPercentage: (valid.length / this.results.length) * 100,
        avgErrorsPerManifest: totalErrors / this.results.length,
        avgWarningsPerManifest: totalWarnings / this.results.length
      }
    }
  }

  /**
   * Get results by version
   */
  getResultsByVersion() {
    const byVersion = { v1: [], v2: [], unknown: [] }
    
    this.results.forEach(result => {
      if (result.manifest?.manifest === '2.0') {
        byVersion.v2.push(result)
      } else if (result.manifest?.manifest === '1.0' || result.manifest?.lokusVersion) {
        byVersion.v1.push(result)
      } else {
        byVersion.unknown.push(result)
      }
    })

    return byVersion
  }
}

/**
 * Convenience functions
 */

/**
 * Validate a single manifest (auto-detect version)
 */
export function validateManifest(manifestData) {
  const validator = new EnhancedManifestValidator()
  return validator.validate(manifestData)
}

/**
 * Quick manifest validation (format only)
 */
export function validateManifestFormat(manifestData) {
  const validator = new EnhancedManifestValidator()
  return validator.validateFormat(manifestData)
}

/**
 * Get manifest compatibility report
 */
export function getManifestCompatibility(manifestData) {
  const validator = new EnhancedManifestValidator()
  return validator.getCompatibilityReport(manifestData)
}

/**
 * Check if manifest can be upgraded
 */
export function canUpgradeManifest(manifestData) {
  const validator = new EnhancedManifestValidator()
  return validator.isUpgradeable(manifestData)
}

/**
 * Validate multiple manifests
 */
export function validateManifestBatch(manifests) {
  const batchValidator = new BatchManifestValidator()
  return batchValidator.validateBatch(manifests)
}

export { EnhancedManifestValidator as default }