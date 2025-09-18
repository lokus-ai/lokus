/**
 * Plugin Publishing Tools
 * Comprehensive toolkit for plugin packaging, validation, and publishing workflow
 */

import { invoke } from '@tauri-apps/api/core'
import { join, dirname, basename } from '@tauri-apps/api/path'
import { exists, readTextFile, writeTextFile, readDir, createDir } from '@tauri-apps/api/fs'
import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginManifestV2 } from '../manifest/ManifestV2.js'
import RegistryAPI from './RegistryAPI.js'

/**
 * Publishing Status
 */
export const PUBLISH_STATUS = {
  PREPARING: 'preparing',
  VALIDATING: 'validating',
  PACKAGING: 'packaging',
  UPLOADING: 'uploading',
  PROCESSING: 'processing',
  PUBLISHED: 'published',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Validation Severity
 */
export const VALIDATION_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
}

/**
 * Package Types
 */
export const PACKAGE_TYPE = {
  PLUGIN: 'plugin',
  THEME: 'theme',
  LANGUAGE_PACK: 'language_pack',
  EXTENSION_PACK: 'extension_pack'
}

/**
 * Plugin Publisher Class
 */
export class PluginPublisher extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      buildDir: null, // Will be set in initialize()
      outputDir: null,
      compressionLevel: 6,
      includeSourceMaps: false,
      minifyCode: false,
      validateStrict: true,
      generateDocs: true,
      autoIncrement: true,
      signPackages: false,
      dryRun: false,
      ...config
    }

    // Core components
    this.api = new RegistryAPI()
    this.validator = new PluginManifestV2()
    
    // Publishing state
    this.publications = new Map() // publishId -> PublishInfo
    this.packageCache = new Map() // pluginId -> PackageInfo
    
    // Validation rules
    this.validationRules = new Map()
    this.customValidators = new Map()
    
    // Templates and generators
    this.templates = new Map()
    this.generators = new Map()

    this.logger = console // TODO: Replace with proper logger
    this.isInitialized = false
  }

  /**
   * Initialize publisher
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      await this.setupDirectories()
      await this.initializeValidationRules()
      await this.initializeTemplates()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('Plugin publisher initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize plugin publisher:', error)
      throw error
    }
  }

  /**
   * Create new plugin project
   */
  async createProject(name, options = {}) {
    try {
      const {
        type = PACKAGE_TYPE.PLUGIN,
        template = 'basic',
        author = 'Unknown',
        license = 'MIT',
        description = '',
        outputPath = null
      } = options

      const publishId = this.generatePublishId()
      const projectPath = outputPath || await join(this.config.outputDir, name)

      const publication = {
        id: publishId,
        name,
        type,
        status: PUBLISH_STATUS.PREPARING,
        projectPath,
        manifest: null,
        validationResults: [],
        packagePath: null,
        startTime: new Date().toISOString()
      }

      this.publications.set(publishId, publication)
      this.emit('project_creation_started', publication)

      // Check if directory already exists
      if (await exists(projectPath)) {
        throw new Error(`Project directory already exists: ${projectPath}`)
      }

      // Create project directory
      await createDir(projectPath, { recursive: true })

      // Generate from template
      const templateConfig = this.templates.get(template)
      if (!templateConfig) {
        throw new Error(`Template not found: ${template}`)
      }

      // Create manifest
      const manifest = this.generateManifest(name, {
        type,
        author,
        license,
        description,
        ...templateConfig.manifestDefaults
      })

      // Generate project files
      await this.generateProjectFiles(projectPath, template, manifest, options)

      publication.manifest = manifest
      publication.status = PUBLISH_STATUS.PUBLISHED // Project creation complete
      publication.endTime = new Date().toISOString()

      this.emit('project_created', publication)
      this.logger.info(`Project created: ${name} at ${projectPath}`)

      return {
        success: true,
        publishId,
        projectPath,
        manifest
      }
    } catch (error) {
      const publication = this.publications.get(publishId)
      if (publication) {
        publication.status = PUBLISH_STATUS.FAILED
        publication.error = error.message
        this.emit('project_creation_failed', { publication, error })
      }
      throw error
    }
  }

  /**
   * Validate plugin project
   */
  async validateProject(projectPath, options = {}) {
    try {
      const {
        strict = this.config.validateStrict,
        fixable = false
      } = options

      const validationResults = {
        valid: true,
        errors: [],
        warnings: [],
        info: [],
        fixableIssues: []
      }

      this.emit('validation_started', { projectPath })

      // Load and validate manifest
      const manifestPath = await join(projectPath, 'plugin.json')
      if (!(await exists(manifestPath))) {
        validationResults.errors.push({
          severity: VALIDATION_SEVERITY.ERROR,
          message: 'plugin.json not found',
          file: 'plugin.json',
          fixable: false
        })
        validationResults.valid = false
      } else {
        const manifestContent = await readTextFile(manifestPath)
        const manifestValidation = this.validator.load(manifestContent)
        
        // Add manifest validation results
        validationResults.errors.push(...manifestValidation.errors.map(e => ({
          severity: VALIDATION_SEVERITY.ERROR,
          message: e.message,
          file: 'plugin.json',
          field: e.field,
          fixable: false
        })))

        validationResults.warnings.push(...manifestValidation.warnings.map(w => ({
          severity: VALIDATION_SEVERITY.WARNING,
          message: w.message,
          file: 'plugin.json',
          field: w.field,
          fixable: this.isFixableWarning(w)
        })))

        if (!manifestValidation.valid) {
          validationResults.valid = false
        }
      }

      // Validate project structure
      await this.validateProjectStructure(projectPath, validationResults)

      // Validate source files
      await this.validateSourceFiles(projectPath, validationResults)

      // Validate dependencies
      await this.validateDependencies(projectPath, validationResults)

      // Run custom validation rules
      await this.runCustomValidations(projectPath, validationResults)

      // Security validation
      await this.validateSecurity(projectPath, validationResults)

      // Performance validation
      await this.validatePerformance(projectPath, validationResults)

      this.emit('validation_completed', { projectPath, validationResults })

      return validationResults
    } catch (error) {
      this.logger.error('Project validation failed:', error)
      throw error
    }
  }

  /**
   * Package plugin for distribution
   */
  async packageProject(projectPath, options = {}) {
    try {
      const publishId = this.generatePublishId()
      const {
        outputPath = null,
        version = null,
        incremental = false,
        includeDevDependencies = false
      } = options

      const publication = {
        id: publishId,
        projectPath,
        status: PUBLISH_STATUS.PACKAGING,
        packagePath: null,
        manifest: null,
        size: 0,
        checksum: null,
        startTime: new Date().toISOString()
      }

      this.publications.set(publishId, publication)
      this.emit('packaging_started', publication)

      // Load manifest
      const manifestPath = await join(projectPath, 'plugin.json')
      const manifestContent = await readTextFile(manifestPath)
      const manifest = JSON.parse(manifestContent)
      publication.manifest = manifest

      // Update version if specified
      if (version) {
        manifest.version = version
        await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2))
      }

      // Auto-increment version if enabled
      if (this.config.autoIncrement && !version) {
        const newVersion = this.incrementVersion(manifest.version)
        manifest.version = newVersion
        await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2))
      }

      // Determine output path
      const packageName = `${manifest.id}-${manifest.version}.zip`
      const finalOutputPath = outputPath || await join(this.config.outputDir, packageName)
      publication.packagePath = finalOutputPath

      // Prepare build directory
      const buildDir = await join(this.config.buildDir, `build_${publishId}`)
      await createDir(buildDir, { recursive: true })

      try {
        // Copy source files to build directory
        await this.prepareBuildFiles(projectPath, buildDir, publication, {
          includeDevDependencies,
          incremental
        })

        // Process files (minify, transpile, etc.)
        await this.processFiles(buildDir, publication)

        // Generate documentation
        if (this.config.generateDocs) {
          await this.generateDocumentation(buildDir, publication)
        }

        // Create package archive
        await this.createPackageArchive(buildDir, finalOutputPath, publication)

        // Calculate checksum
        publication.checksum = await this.calculateChecksum(finalOutputPath)

        // Get package size
        const stats = await invoke('get_file_stats', { path: finalOutputPath })
        publication.size = stats.size

        publication.status = PUBLISH_STATUS.PUBLISHED // Packaging complete
        publication.endTime = new Date().toISOString()

        this.emit('packaging_completed', publication)
        this.logger.info(`Package created: ${packageName} (${this.formatSize(publication.size)})`)

        return {
          success: true,
          publishId,
          packagePath: finalOutputPath,
          manifest,
          size: publication.size,
          checksum: publication.checksum
        }
      } finally {
        // Cleanup build directory
        await this.cleanupBuildDir(buildDir)
      }
    } catch (error) {
      const publication = this.publications.get(publishId)
      if (publication) {
        publication.status = PUBLISH_STATUS.FAILED
        publication.error = error.message
        this.emit('packaging_failed', { publication, error })
      }
      throw error
    }
  }

  /**
   * Publish plugin to registry
   */
  async publishPlugin(packagePath, options = {}) {
    try {
      const publishId = this.generatePublishId()
      const {
        dryRun = this.config.dryRun,
        preRelease = false,
        releaseNotes = '',
        tags = []
      } = options

      const publication = {
        id: publishId,
        packagePath,
        status: PUBLISH_STATUS.UPLOADING,
        manifest: null,
        remoteId: null,
        publishUrl: null,
        startTime: new Date().toISOString()
      }

      this.publications.set(publishId, publication)
      this.emit('publishing_started', publication)

      // Extract and validate manifest from package
      const manifest = await this.extractManifestFromPackage(packagePath)
      publication.manifest = manifest

      if (dryRun) {
        this.logger.info('Dry run mode: would publish to registry')
        publication.status = PUBLISH_STATUS.PUBLISHED
        this.emit('publishing_completed', publication)
        return { success: true, dryRun: true, publishId }
      }

      // Check authentication
      if (!this.api.isAuthenticated()) {
        throw new Error('Authentication required for publishing')
      }

      // Prepare package file for upload
      const packageFile = await this.readPackageFile(packagePath)

      // Upload to registry
      publication.status = PUBLISH_STATUS.UPLOADING
      this.emit('publishing_progress', publication)

      const publishData = {
        manifest,
        preRelease,
        releaseNotes,
        tags,
        readme: await this.extractReadmeFromPackage(packagePath),
        changelog: await this.extractChangelogFromPackage(packagePath)
      }

      const response = await this.api.publishPlugin(publishData, packageFile)

      if (response.status !== 'success') {
        throw new Error(`Publishing failed: ${response.message}`)
      }

      publication.status = PUBLISH_STATUS.PROCESSING
      publication.remoteId = response.data.id
      publication.publishUrl = response.data.url

      // Wait for processing to complete
      await this.waitForProcessing(publication)

      publication.status = PUBLISH_STATUS.PUBLISHED
      publication.endTime = new Date().toISOString()

      this.emit('publishing_completed', publication)
      this.logger.info(`Plugin published: ${manifest.id}@${manifest.version}`)

      return {
        success: true,
        publishId,
        remoteId: publication.remoteId,
        publishUrl: publication.publishUrl,
        manifest
      }
    } catch (error) {
      const publication = this.publications.get(publishId)
      if (publication) {
        publication.status = PUBLISH_STATUS.FAILED
        publication.error = error.message
        this.emit('publishing_failed', { publication, error })
      }
      throw error
    }
  }

  /**
   * Update existing plugin
   */
  async updatePlugin(pluginId, packagePath, options = {}) {
    try {
      const {
        version = null,
        changelog = '',
        breaking = false
      } = options

      // Extract manifest to get version
      const manifest = await this.extractManifestFromPackage(packagePath)
      const targetVersion = version || manifest.version

      // Prepare update data
      const updateData = {
        manifest: {
          ...manifest,
          version: targetVersion
        },
        changelog,
        breaking
      }

      // Read package file
      const packageFile = await this.readPackageFile(packagePath)

      // Update via API
      const response = await this.api.updatePlugin(pluginId, targetVersion, updateData, packageFile)

      if (response.status !== 'success') {
        throw new Error(`Update failed: ${response.message}`)
      }

      this.logger.info(`Plugin updated: ${pluginId}@${targetVersion}`)

      return {
        success: true,
        pluginId,
        version: targetVersion,
        remoteId: response.data.id
      }
    } catch (error) {
      this.logger.error('Plugin update failed:', error)
      throw error
    }
  }

  /**
   * Template and project generation
   */
  generateManifest(name, options = {}) {
    const {
      type = PACKAGE_TYPE.PLUGIN,
      author = 'Unknown',
      license = 'MIT',
      description = '',
      version = '1.0.0',
      lokusVersion = '^1.0.0'
    } = options

    const id = name.toLowerCase().replace(/[^a-z0-9-]/g, '-')

    return {
      manifest: '2.0',
      id,
      name,
      displayName: name,
      version,
      description,
      author: typeof author === 'string' ? { name: author } : author,
      license,
      engines: {
        lokus: lokusVersion
      },
      categories: this.getDefaultCategories(type),
      keywords: [],
      main: './index.js',
      contributes: {},
      activationEvents: ['*'],
      capabilities: {
        untrustedWorkspaces: { supported: true },
        virtualWorkspaces: { supported: true }
      }
    }
  }

  async generateProjectFiles(projectPath, template, manifest, options = {}) {
    const templateConfig = this.templates.get(template)
    if (!templateConfig) {
      throw new Error(`Template not found: ${template}`)
    }

    // Write manifest
    const manifestPath = await join(projectPath, 'plugin.json')
    await writeTextFile(manifestPath, JSON.stringify(manifest, null, 2))

    // Generate files from template
    for (const [fileName, fileConfig] of Object.entries(templateConfig.files)) {
      const filePath = await join(projectPath, fileName)
      const fileDir = await dirname(filePath)
      
      // Ensure directory exists
      if (!(await exists(fileDir))) {
        await createDir(fileDir, { recursive: true })
      }

      let content = fileConfig.content
      
      // Process template variables
      content = this.processTemplate(content, {
        manifest,
        options,
        timestamp: new Date().toISOString()
      })

      await writeTextFile(filePath, content)
    }

    this.logger.info(`Generated project files from ${template} template`)
  }

  /**
   * Validation helpers
   */
  async validateProjectStructure(projectPath, results) {
    const requiredFiles = ['plugin.json', 'index.js']
    const recommendedFiles = ['README.md', 'CHANGELOG.md', 'LICENSE']

    for (const file of requiredFiles) {
      const filePath = await join(projectPath, file)
      if (!(await exists(filePath))) {
        results.errors.push({
          severity: VALIDATION_SEVERITY.ERROR,
          message: `Required file missing: ${file}`,
          file,
          fixable: file === 'index.js'
        })
        results.valid = false
      }
    }

    for (const file of recommendedFiles) {
      const filePath = await join(projectPath, file)
      if (!(await exists(filePath))) {
        results.warnings.push({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Recommended file missing: ${file}`,
          file,
          fixable: true
        })
      }
    }
  }

  async validateSourceFiles(projectPath, results) {
    try {
      const entries = await readDir(projectPath, { recursive: true })
      
      for (const entry of entries) {
        if (entry.children) continue // Skip directories
        
        const fileName = await basename(entry.path)
        const ext = fileName.split('.').pop()

        // Check file size
        const stats = await invoke('get_file_stats', { path: entry.path })
        if (stats.size > 1024 * 1024) { // 1MB
          results.warnings.push({
            severity: VALIDATION_SEVERITY.WARNING,
            message: `Large file detected: ${fileName} (${this.formatSize(stats.size)})`,
            file: fileName,
            fixable: false
          })
        }

        // Validate file types
        if (ext && !this.isAllowedFileType(ext)) {
          results.warnings.push({
            severity: VALIDATION_SEVERITY.WARNING,
            message: `Potentially unsafe file type: .${ext}`,
            file: fileName,
            fixable: false
          })
        }

        // Check for source maps in production
        if (fileName.endsWith('.map') && !this.config.includeSourceMaps) {
          results.info.push({
            severity: VALIDATION_SEVERITY.INFO,
            message: `Source map file will be excluded: ${fileName}`,
            file: fileName,
            fixable: true
          })
        }
      }
    } catch (error) {
      results.warnings.push({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Failed to validate source files: ${error.message}`,
        fixable: false
      })
    }
  }

  async validateDependencies(projectPath, results) {
    try {
      const packageJsonPath = await join(projectPath, 'package.json')
      
      if (await exists(packageJsonPath)) {
        const packageContent = await readTextFile(packageJsonPath)
        const packageJson = JSON.parse(packageContent)
        
        const deps = {
          ...packageJson.dependencies,
          ...packageJson.devDependencies
        }

        // Check for security vulnerabilities (placeholder)
        for (const [dep, version] of Object.entries(deps)) {
          if (this.isKnownVulnerableDependency(dep, version)) {
            results.warnings.push({
              severity: VALIDATION_SEVERITY.WARNING,
              message: `Potentially vulnerable dependency: ${dep}@${version}`,
              file: 'package.json',
              fixable: true
            })
          }
        }
      }
    } catch (error) {
      results.warnings.push({
        severity: VALIDATION_SEVERITY.WARNING,
        message: `Failed to validate dependencies: ${error.message}`,
        fixable: false
      })
    }
  }

  async validateSecurity(projectPath, results) {
    // Placeholder for security validation
    // Would include checks for:
    // - Suspicious code patterns
    // - Network requests
    // - File system access
    // - Eval usage
    // - External dependencies
  }

  async validatePerformance(projectPath, results) {
    // Placeholder for performance validation
    // Would include checks for:
    // - Bundle size
    // - Startup time
    // - Memory usage
    // - Synchronous operations
  }

  /**
   * File processing
   */
  async prepareBuildFiles(projectPath, buildDir, publication, options) {
    try {
      // Copy all files except excluded ones
      await invoke('copy_directory_selective', {
        sourcePath: projectPath,
        targetPath: buildDir,
        excludePatterns: [
          'node_modules/**',
          '.git/**',
          '*.log',
          '.DS_Store',
          'Thumbs.db',
          ...(this.config.includeSourceMaps ? [] : ['**/*.map'])
        ]
      })

      this.emit('build_files_prepared', { publication, buildDir })
    } catch (error) {
      throw new Error(`Failed to prepare build files: ${error.message}`)
    }
  }

  async processFiles(buildDir, publication) {
    if (this.config.minifyCode) {
      await this.minifyJavaScript(buildDir)
    }

    // Additional processing could include:
    // - TypeScript compilation
    // - CSS preprocessing
    // - Asset optimization
    // - Bundle creation

    this.emit('files_processed', { publication, buildDir })
  }

  async generateDocumentation(buildDir, publication) {
    try {
      const docsDir = await join(buildDir, 'docs')
      await createDir(docsDir, { recursive: true })

      // Generate API documentation
      const manifest = publication.manifest
      const apiDocs = this.generateApiDocs(manifest)
      
      const apiDocsPath = await join(docsDir, 'api.md')
      await writeTextFile(apiDocsPath, apiDocs)

      this.emit('documentation_generated', { publication, docsDir })
    } catch (error) {
      this.logger.warn('Failed to generate documentation:', error)
    }
  }

  /**
   * Helper methods
   */
  
  generatePublishId() {
    return `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getDefaultCategories(type) {
    switch (type) {
      case PACKAGE_TYPE.THEME:
        return ['Themes']
      case PACKAGE_TYPE.LANGUAGE_PACK:
        return ['Language Packs']
      case PACKAGE_TYPE.EXTENSION_PACK:
        return ['Extension Packs']
      default:
        return ['Other']
    }
  }

  incrementVersion(version) {
    const parts = version.split('.')
    const patch = parseInt(parts[2] || '0') + 1
    return `${parts[0]}.${parts[1]}.${patch}`
  }

  isAllowedFileType(ext) {
    const allowed = [
      'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'txt',
      'css', 'scss', 'less', 'html', 'svg', 'png',
      'jpg', 'jpeg', 'gif', 'wasm', 'map'
    ]
    return allowed.includes(ext.toLowerCase())
  }

  isKnownVulnerableDependency(name, version) {
    // Placeholder for vulnerability checking
    // Would integrate with security databases
    return false
  }

  isFixableWarning(warning) {
    const fixableTypes = [
      'missing_description',
      'missing_keywords',
      'missing_homepage',
      'missing_repository'
    ]
    return fixableTypes.includes(warning.type)
  }

  formatSize(bytes) {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  processTemplate(content, variables) {
    return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      const value = this.getNestedValue(variables, key)
      return value !== undefined ? value : match
    })
  }

  getNestedValue(obj, key) {
    return key.split('.').reduce((o, k) => o && o[k], obj)
  }

  async setupDirectories() {
    // Setup will be handled by the calling code
    this.config.buildDir = this.config.buildDir || '/tmp/lokus-builds'
    this.config.outputDir = this.config.outputDir || './dist'
  }

  async initializeValidationRules() {
    // Initialize built-in validation rules
    this.validationRules.set('manifest', this.validateManifestRule.bind(this))
    this.validationRules.set('structure', this.validateStructureRule.bind(this))
    this.validationRules.set('security', this.validateSecurityRule.bind(this))
  }

  async initializeTemplates() {
    // Initialize built-in templates
    this.templates.set('basic', {
      name: 'Basic Plugin',
      description: 'A basic plugin template',
      manifestDefaults: {},
      files: {
        'index.js': {
          content: `// {{manifest.displayName}}
// {{manifest.description}}

export default class {{manifest.name}}Plugin {
  constructor() {
    this.id = '{{manifest.id}}'
    this.name = '{{manifest.displayName}}'
  }

  async activate() {
    // Plugin activation logic here
  }

  async deactivate() {
    // Plugin cleanup logic here
  }
}
`
        },
        'README.md': {
          content: `# {{manifest.displayName}}

{{manifest.description}}

## Installation

Install via the Lokus Plugin Registry:

\`\`\`
lokus plugin install {{manifest.id}}
\`\`\`

## Usage

[Usage instructions here]

## License

{{manifest.license}}
`
        }
      }
    })
  }

  // Validation rule implementations
  async validateManifestRule(projectPath, results) {
    // Implemented in validateProject
  }

  async validateStructureRule(projectPath, results) {
    // Implemented in validateProjectStructure
  }

  async validateSecurityRule(projectPath, results) {
    // Implemented in validateSecurity
  }

  // Placeholder methods to be implemented
  async extractManifestFromPackage(packagePath) {
    // TODO: Extract manifest from ZIP package
    throw new Error('Not implemented')
  }

  async extractReadmeFromPackage(packagePath) {
    // TODO: Extract README from package
    return null
  }

  async extractChangelogFromPackage(packagePath) {
    // TODO: Extract CHANGELOG from package
    return null
  }

  async readPackageFile(packagePath) {
    // TODO: Read package file as blob/buffer
    throw new Error('Not implemented')
  }

  async createPackageArchive(buildDir, outputPath, publication) {
    // TODO: Create ZIP archive
    await invoke('create_archive', {
      sourcePath: buildDir,
      archivePath: outputPath,
      compressionLevel: this.config.compressionLevel
    })
  }

  async calculateChecksum(filePath) {
    return invoke('calculate_file_checksum', { path: filePath })
  }

  async waitForProcessing(publication) {
    // TODO: Poll registry for processing status
    // For now, just wait a bit
    await new Promise(resolve => setTimeout(resolve, 2000))
  }

  async minifyJavaScript(buildDir) {
    // TODO: Implement JavaScript minification
    this.logger.info('JavaScript minification not yet implemented')
  }

  generateApiDocs(manifest) {
    return `# ${manifest.displayName} API Documentation

## Overview

${manifest.description}

## Commands

[API documentation would be generated here]

## Events

[Event documentation would be generated here]

## Configuration

[Configuration documentation would be generated here]
`
  }

  async cleanupBuildDir(buildDir) {
    try {
      if (await exists(buildDir)) {
        await invoke('remove_directory', { path: buildDir })
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup build directory:', error)
    }
  }

  async runCustomValidations(projectPath, results) {
    for (const [name, validator] of this.customValidators) {
      try {
        await validator(projectPath, results)
      } catch (error) {
        results.warnings.push({
          severity: VALIDATION_SEVERITY.WARNING,
          message: `Custom validation '${name}' failed: ${error.message}`,
          fixable: false
        })
      }
    }
  }

  /**
   * Public API
   */
  
  getPublicationStatus(publishId) {
    return this.publications.get(publishId)
  }

  getAllPublications() {
    return Array.from(this.publications.values())
  }

  addCustomValidator(name, validator) {
    this.customValidators.set(name, validator)
  }

  removeCustomValidator(name) {
    this.customValidators.delete(name)
  }

  addTemplate(name, template) {
    this.templates.set(name, template)
  }

  getTemplates() {
    return Array.from(this.templates.keys())
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Cancel active publications
    for (const publication of this.publications.values()) {
      if (![PUBLISH_STATUS.PUBLISHED, PUBLISH_STATUS.FAILED, PUBLISH_STATUS.CANCELLED].includes(publication.status)) {
        publication.status = PUBLISH_STATUS.CANCELLED
      }
    }

    this.emit('shutdown')
    this.removeAllListeners()
  }
}

export default PluginPublisher