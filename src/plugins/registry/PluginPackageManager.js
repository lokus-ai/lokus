/**
 * Plugin Package Manager
 * Handles plugin installation, uninstallation, updates, and dependency resolution
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginManifestV2 } from '../manifest/ManifestV2.js'

/**
 * Installation Status Constants
 */
export const INSTALL_STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  EXTRACTING: 'extracting',
  VALIDATING: 'validating',
  INSTALLING: 'installing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Update Types
 */
export const UPDATE_TYPE = {
  MAJOR: 'major',
  MINOR: 'minor',
  PATCH: 'patch',
  PRERELEASE: 'prerelease'
}

/**
 * Dependency Resolution Strategies
 */
export const RESOLUTION_STRATEGY = {
  STRICT: 'strict',        // Exact version match
  COMPATIBLE: 'compatible', // Compatible version range
  LATEST: 'latest',        // Latest compatible version
  FORCE: 'force'           // Force install ignoring conflicts
}

/**
 * Plugin Package Manager Class
 */
export class PluginPackageManager extends EventEmitter {
  constructor(pluginManager, registryAPI, pluginStore, config = {}) {
    super()

    this.pluginManager = pluginManager
    this.registryAPI = registryAPI
    this.pluginStore = pluginStore

    this.config = {
      maxConcurrentDownloads: 3,
      downloadTimeout: 300000, // 5 minutes
      extractTimeout: 60000,   // 1 minute
      retryAttempts: 1,
      retryDelay: 500,
      tempDirectory: '/tmp/lokus-plugins',
      backupOnUpdate: true,
      autoResolveDependencies: true,
      allowPrerelease: false,
      verifyChecksums: true,
      ...config
    }

    // Active operations tracking
    this.activeInstalls = new Map() // pluginId -> InstallOperation
    this.activeUpdates = new Map()  // pluginId -> UpdateOperation
    this.downloadQueue = []         // Array of download tasks
    this.activeDownloads = new Set() // Set of active download promises

    // Dependency resolution cache
    this.dependencyCache = new Map()
    this.conflictCache = new Map()

    this.logger = console // TODO: Replace with proper logger
  }

  /**
   * Install a plugin from the registry
   */
  async installPlugin(pluginId, version = 'latest', options = {}) {
    try {
      const {
        force = false,
        resolutionStrategy = RESOLUTION_STRATEGY.COMPATIBLE,
        skipDependencies = false,
        dryRun = false
      } = options

      // Check if already installing
      if (this.activeInstalls.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is already being installed`)
      }

      // Check if already installed (unless force)
      if (!force && await this.isPluginInstalled(pluginId)) {
        const installedVersion = await this.getInstalledVersion(pluginId)
        if (version === 'latest' || version === installedVersion) {
          throw new Error(`Plugin ${pluginId} is already installed (version ${installedVersion})`)
        }
      }

      // Get plugin metadata from registry
      const pluginData = await this.registryAPI.getPlugin(pluginId, version)
      if (!pluginData || pluginData.status !== 'success') {
        throw new Error(`Plugin ${pluginId} not found in registry`)
      }

      const manifest = pluginData.data.version.manifest
      const actualVersion = manifest.version

      // Create installation operation
      const operation = {
        id: this.generateOperationId(),
        pluginId,
        version: actualVersion,
        type: 'install',
        status: INSTALL_STATUS.PENDING,
        progress: 0,
        startTime: Date.now(),
        dependencies: [],
        downloadSize: pluginData.data.version.size || 0,
        downloadUrl: pluginData.data.version.downloadUrl,
        checksum: pluginData.data.version.checksum,
        tempPath: null,
        extractPath: null,
        error: null
      }

      this.activeInstalls.set(pluginId, operation)
      this.emit('install_started', { pluginId, version: actualVersion, operation })

      try {
        // Step 1: Resolve dependencies
        if (!skipDependencies && manifest.dependencies) {
          operation.status = INSTALL_STATUS.PENDING
          operation.dependencies = await this.resolveDependencies(
            manifest.dependencies,
            resolutionStrategy
          )

          if (operation.dependencies.length > 0) {
            this.logger.info(`Resolved ${operation.dependencies.length} dependencies for ${pluginId}`)
          }
        }

        // Step 2: Perform dry run if requested
        if (dryRun) {
          return {
            success: true,
            operation,
            dryRun: true,
            dependencies: operation.dependencies,
            conflicts: await this.checkConflicts(pluginId, actualVersion, operation.dependencies)
          }
        }

        // Step 3: Install dependencies first
        if (operation.dependencies.length > 0) {
          await this.installDependencies(operation.dependencies, options)
        }

        // Step 4: Download plugin package
        operation.status = INSTALL_STATUS.DOWNLOADING
        this.emit('install_progress', { pluginId, operation })

        const downloadResult = await this.downloadPlugin(operation)
        operation.tempPath = downloadResult.tempPath
        operation.progress = 50

        // Step 5: Extract and validate
        operation.status = INSTALL_STATUS.EXTRACTING
        this.emit('install_progress', { pluginId, operation })

        const extractResult = await this.extractPlugin(operation)
        operation.extractPath = extractResult.extractPath
        operation.progress = 75

        // Step 6: Validate plugin
        operation.status = INSTALL_STATUS.VALIDATING
        this.emit('install_progress', { pluginId, operation })

        await this.validatePluginPackage(operation)
        operation.progress = 90

        // Step 7: Install plugin
        operation.status = INSTALL_STATUS.INSTALLING
        this.emit('install_progress', { pluginId, operation })

        await this.performInstallation(operation)
        operation.progress = 100
        operation.status = INSTALL_STATUS.COMPLETED

        // Step 8: Update local registry
        await this.pluginStore.recordInstallation(pluginId, actualVersion, {
          installTime: Date.now(),
          source: 'registry',
          dependencies: operation.dependencies.map(d => ({ id: d.pluginId, version: d.version }))
        })

        // Step 9: Cleanup temp files
        await this.cleanupInstallation(operation)

        this.emit('install_completed', { pluginId, version: actualVersion, operation })
        this.logger.info(`Plugin ${pluginId}@${actualVersion} installed successfully`)

        return {
          success: true,
          pluginId,
          version: actualVersion,
          operation,
          dependencies: operation.dependencies
        }

      } catch (error) {
        operation.status = INSTALL_STATUS.FAILED
        operation.error = error.message

        // Cleanup on failure
        await this.cleanupInstallation(operation)

        this.emit('install_failed', { pluginId, version: actualVersion, error, operation })
        throw error
      } finally {
        this.activeInstalls.delete(pluginId)
      }

    } catch (error) {
      this.logger.error(`Failed to install plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Uninstall a plugin
   */
  async uninstallPlugin(pluginId, options = {}) {
    try {
      const {
        force = false,
        removeDependencies = false,
        backup = true
      } = options

      // Check if plugin is installed
      if (!await this.isPluginInstalled(pluginId)) {
        throw new Error(`Plugin ${pluginId} is not installed`)
      }

      const installedVersion = await this.getInstalledVersion(pluginId)

      // Check for dependents if not force
      if (!force) {
        const dependents = await this.findDependents(pluginId)
        if (dependents.length > 0) {
          throw new Error(
            `Cannot uninstall ${pluginId}: required by ${dependents.map(d => d.id).join(', ')}`
          )
        }
      }

      this.emit('uninstall_started', { pluginId, version: installedVersion })

      // Create backup if requested
      if (backup && this.config.backupOnUpdate) {
        await this.createPluginBackup(pluginId, installedVersion)
      }

      // Deactivate plugin if active
      if (this.pluginManager.isPluginActive(pluginId)) {
        await this.pluginManager.deactivatePlugin(pluginId)
      }

      // Remove plugin files
      await this.removePluginFiles(pluginId)

      // Update local registry
      await this.pluginStore.recordUninstallation(pluginId, {
        uninstallTime: Date.now(),
        version: installedVersion
      })

      // Remove dependencies if requested
      if (removeDependencies) {
        const dependencies = await this.getPluginDependencies(pluginId)
        for (const dep of dependencies) {
          try {
            await this.uninstallPlugin(dep.id, { force: false, removeDependencies: false })
          } catch (error) {
            this.logger.warn(`Failed to remove dependency ${dep.id}:`, error)
          }
        }
      }

      this.emit('uninstall_completed', { pluginId, version: installedVersion })
      this.logger.info(`Plugin ${pluginId}@${installedVersion} uninstalled successfully`)

      return {
        success: true,
        pluginId,
        version: installedVersion
      }

    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}:`, error)
      this.emit('uninstall_failed', { pluginId, error })
      throw error
    }
  }

  /**
   * Update a plugin to a newer version
   */
  async updatePlugin(pluginId, targetVersion = 'latest', options = {}) {
    try {
      const {
        force = false,
        backup = true,
        strategy = RESOLUTION_STRATEGY.COMPATIBLE
      } = options

      // Check if plugin is installed
      if (!await this.isPluginInstalled(pluginId)) {
        throw new Error(`Plugin ${pluginId} is not installed`)
      }

      const currentVersion = await this.getInstalledVersion(pluginId)

      // Get available updates
      const availableVersions = await this.registryAPI.getPluginVersions(pluginId)
      if (!availableVersions || availableVersions.status !== 'success') {
        throw new Error(`Could not fetch versions for ${pluginId}`)
      }

      const versions = availableVersions.data.versions.map(v => v.version)
      const resolvedVersion = targetVersion === 'latest'
        ? this.getLatestVersion(versions)
        : targetVersion

      // Check if update is needed
      if (!force && this.compareVersions(resolvedVersion, currentVersion) <= 0) {
        return {
          success: false,
          message: `Plugin ${pluginId} is already at version ${currentVersion} (requested: ${resolvedVersion})`,
          currentVersion,
          requestedVersion: resolvedVersion
        }
      }

      // Check for breaking changes
      const updateType = this.getUpdateType(currentVersion, resolvedVersion)
      if (updateType === UPDATE_TYPE.MAJOR && !force) {
        throw new Error(
          `Major version update detected (${currentVersion} -> ${resolvedVersion}). Use force option to proceed.`
        )
      }

      this.emit('update_started', { pluginId, currentVersion, targetVersion: resolvedVersion })

      // Create backup
      if (backup) {
        await this.createPluginBackup(pluginId, currentVersion)
      }

      // Perform update by uninstalling current and installing new
      const uninstallResult = await this.uninstallPlugin(pluginId, {
        force: true,
        backup: false,
        removeDependencies: false
      })

      try {
        const installResult = await this.installPlugin(pluginId, resolvedVersion, {
          force: true,
          resolutionStrategy: strategy
        })

        this.emit('update_completed', {
          pluginId,
          oldVersion: currentVersion,
          newVersion: resolvedVersion,
          updateType
        })

        return {
          success: true,
          pluginId,
          oldVersion: currentVersion,
          newVersion: resolvedVersion,
          updateType,
          operation: installResult.operation
        }

      } catch (installError) {
        // Rollback on installation failure
        this.logger.error(`Update failed, attempting rollback for ${pluginId}`)

        try {
          await this.restorePluginBackup(pluginId, currentVersion)
          this.emit('update_rolled_back', { pluginId, version: currentVersion })
        } catch (rollbackError) {
          this.logger.error(`Rollback failed for ${pluginId}:`, rollbackError)
          throw new Error(`Update failed and rollback failed: ${installError.message}`)
        }

        throw installError
      }

    } catch (error) {
      this.logger.error(`Failed to update plugin ${pluginId}:`, error)
      this.emit('update_failed', { pluginId, error })
      throw error
    }
  }

  /**
   * Check for available updates for installed plugins
   */
  async checkForUpdates(pluginIds = null) {
    try {
      const installedPlugins = pluginIds || await this.getInstalledPlugins()
      const updates = []

      for (const pluginId of installedPlugins) {
        try {
          const currentVersion = await this.getInstalledVersion(pluginId)
          const availableVersions = await this.registryAPI.getPluginVersions(pluginId)

          if (availableVersions && availableVersions.status === 'success') {
            const versions = availableVersions.data.versions.map(v => v.version)
            const latestVersion = this.getLatestVersion(versions)

            if (this.compareVersions(latestVersion, currentVersion) > 0) {
              updates.push({
                pluginId,
                currentVersion,
                latestVersion,
                updateType: this.getUpdateType(currentVersion, latestVersion)
              })
            }
          }
        } catch (error) {
          this.logger.warn(`Failed to check updates for ${pluginId}:`, error)
        }
      }

      return updates
    } catch (error) {
      this.logger.error('Failed to check for updates:', error)
      throw error
    }
  }

  /**
   * Dependency resolution
   */
  async resolveDependencies(dependencies, strategy = RESOLUTION_STRATEGY.COMPATIBLE) {
    const resolved = []
    const visited = new Set()

    for (const [depId, versionSpec] of Object.entries(dependencies)) {
      await this.resolveDependency(depId, versionSpec, strategy, resolved, visited)
    }

    return resolved
  }

  async resolveDependency(depId, versionSpec, strategy, resolved, visited) {
    if (visited.has(depId)) {
      return // Already processed
    }

    visited.add(depId)

    // Check if already resolved
    const existing = resolved.find(r => r.pluginId === depId)
    if (existing) {
      // Check version compatibility
      if (!this.isVersionCompatible(existing.version, versionSpec)) {
        throw new Error(`Version conflict for ${depId}: need ${versionSpec}, have ${existing.version}`)
      }
      return
    }

    // Check if already installed and compatible
    if (await this.isPluginInstalled(depId)) {
      const installedVersion = await this.getInstalledVersion(depId)
      if (this.isVersionCompatible(installedVersion, versionSpec)) {
        resolved.push({ pluginId: depId, version: installedVersion, installed: true })
        return
      }
    }

    // Resolve version from registry
    const availableVersions = await this.registryAPI.getPluginVersions(depId)
    if (!availableVersions || availableVersions.status !== 'success') {
      throw new Error(`Dependency ${depId} not found in registry`)
    }

    const compatibleVersion = this.findCompatibleVersion(
      availableVersions.data.versions.map(v => v.version),
      versionSpec,
      strategy
    )

    if (!compatibleVersion) {
      throw new Error(`No compatible version found for ${depId} (required: ${versionSpec})`)
    }

    resolved.push({ pluginId: depId, version: compatibleVersion, installed: false })

    // Recursively resolve dependencies of this dependency
    const depData = await this.registryAPI.getPlugin(depId, compatibleVersion)
    if (depData && depData.data && depData.data.version.manifest.dependencies) {
      for (const [nestedDepId, nestedVersionSpec] of Object.entries(depData.data.version.manifest.dependencies)) {
        await this.resolveDependency(nestedDepId, nestedVersionSpec, strategy, resolved, visited)
      }
    }
  }

  /**
   * Version management utilities
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number)
    const parts2 = v2.split('.').map(Number)

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0
      const part2 = parts2[i] || 0

      if (part1 < part2) return -1
      if (part1 > part2) return 1
    }

    return 0
  }

  getLatestVersion(versions) {
    return versions
      .filter(v => this.config.allowPrerelease || !v.includes('-'))
      .sort(this.compareVersions.bind(this))
      .pop()
  }

  getUpdateType(currentVersion, newVersion) {
    const current = currentVersion.split('.').map(Number)
    const next = newVersion.split('.').map(Number)

    if (next[0] > current[0]) return UPDATE_TYPE.MAJOR
    if (next[1] > current[1]) return UPDATE_TYPE.MINOR
    if (next[2] > current[2]) return UPDATE_TYPE.PATCH

    return UPDATE_TYPE.PRERELEASE
  }

  isVersionCompatible(installedVersion, requiredSpec) {
    // Simple semver compatibility check
    // TODO: Implement full semver range checking
    if (requiredSpec.startsWith('^')) {
      const required = requiredSpec.slice(1)
      return this.compareVersions(installedVersion, required) >= 0
    }

    if (requiredSpec.startsWith('~')) {
      const required = requiredSpec.slice(1)
      const installedParts = installedVersion.split('.').map(Number)
      const requiredParts = required.split('.').map(Number)

      return installedParts[0] === requiredParts[0] &&
        installedParts[1] === requiredParts[1] &&
        installedParts[2] >= requiredParts[2]
    }

    return installedVersion === requiredSpec
  }

  findCompatibleVersion(versions, versionSpec, strategy) {
    const compatible = versions.filter(v => this.isVersionCompatible(v, versionSpec))

    if (compatible.length === 0) return null

    switch (strategy) {
      case RESOLUTION_STRATEGY.LATEST:
        return this.getLatestVersion(compatible)
      case RESOLUTION_STRATEGY.STRICT:
        return compatible.find(v => v === versionSpec.replace(/[\^~]/, ''))
      default:
        return this.getLatestVersion(compatible)
    }
  }

  /**
   * Installation helpers
   */
  async downloadPlugin(operation) {
    const { pluginId, downloadUrl, checksum, downloadSize } = operation

    if (!downloadUrl) {
      throw new Error(`No download URL available for ${pluginId}`)
    }

    // Create temp directory
    const tempPath = `${this.config.tempDirectory}/${pluginId}-${operation.version}-${Date.now()}`
    await this.ensureDirectory(tempPath)

    const fileName = `${pluginId}-${operation.version}.zip`
    const filePath = `${tempPath}/${fileName}`

    // Download with progress tracking
    const response = await this.registryAPI.downloadPlugin(pluginId, operation.version)

    if (!response || !response.data) {
      throw new Error(`Failed to download ${pluginId}`)
    }

    // Verify checksum if available
    if (this.config.verifyChecksums && checksum) {
      const computedChecksum = await this.computeChecksum(response.data)
      if (computedChecksum !== checksum) {
        throw new Error(`Checksum verification failed for ${pluginId}`)
      }
    }

    // Save to temp file
    await this.saveFile(filePath, response.data)

    return { tempPath, filePath }
  }

  async extractPlugin(operation) {
    const { tempPath } = operation
    const extractPath = `${tempPath}/extracted`

    await this.ensureDirectory(extractPath)

    // Extract plugin package (assuming ZIP format)
    // TODO: Implement actual extraction logic
    await this.extractZip(operation.tempPath, extractPath)

    return { extractPath }
  }

  async validatePluginPackage(operation) {
    const { extractPath, pluginId } = operation

    // Validate manifest exists and is valid
    const manifestPath = `${extractPath}/plugin.json`
    if (!await this.fileExists(manifestPath)) {
      throw new Error(`Invalid plugin package: missing plugin.json`)
    }

    const manifestContent = await this.readFile(manifestPath)
    const manifest = JSON.parse(manifestContent)

    const validator = new PluginManifestV2()
    const validation = validator.load(manifest)

    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    // Verify plugin ID matches
    if (validator.getFullId() !== pluginId) {
      throw new Error(`Plugin ID mismatch: expected ${pluginId}, got ${validator.getFullId()}`)
    }

    return true
  }

  async performInstallation(operation) {
    const { pluginId, extractPath } = operation
    const installPath = await this.getPluginInstallPath(pluginId)

    await this.ensureDirectory(installPath)

    // Copy plugin files to installation directory
    await this.copyDirectory(extractPath, installPath)

    // Register with plugin manager
    await this.pluginManager.loadPlugin(installPath)
  }

  async cleanupInstallation(operation) {
    if (operation.tempPath) {
      try {
        await this.removeDirectory(operation.tempPath)
      } catch (error) {
        this.logger.warn(`Failed to cleanup temp directory ${operation.tempPath}:`, error)
      }
    }
  }

  /**
   * Helper methods (these would need platform-specific implementations)
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  async isPluginInstalled(pluginId) {
    return this.pluginStore.isInstalled(pluginId)
  }

  async getInstalledVersion(pluginId) {
    return this.pluginStore.getInstalledVersion(pluginId)
  }

  async getInstalledPlugins() {
    return this.pluginStore.getInstalledPlugins()
  }

  async getPluginDependencies(pluginId) {
    return this.pluginStore.getPluginDependencies(pluginId)
  }

  async findDependents(pluginId) {
    return this.pluginStore.findDependents(pluginId)
  }

  async checkConflicts(pluginId, version, dependencies) {
    // TODO: Implement conflict detection logic
    return []
  }

  async installDependencies(dependencies, options) {
    for (const dep of dependencies) {
      if (!dep.installed) {
        await this.installPlugin(dep.pluginId, dep.version, {
          ...options,
          skipDependencies: true // Avoid infinite recursion
        })
      }
    }
  }

  async createPluginBackup(pluginId, version) {
    // TODO: Implement backup creation
    this.logger.info(`Creating backup for ${pluginId}@${version}`)
  }

  async restorePluginBackup(pluginId, version) {
    // TODO: Implement backup restoration
    this.logger.info(`Restoring backup for ${pluginId}@${version}`)
  }

  async removePluginFiles(pluginId) {
    const installPath = await this.getPluginInstallPath(pluginId)
    await this.removeDirectory(installPath)
  }

  async getPluginInstallPath(pluginId) {
    // TODO: Get actual plugin installation path
    return `/path/to/plugins/${pluginId}`
  }

  // File system operations (platform-specific implementations needed)
  async ensureDirectory(path) {
    // TODO: Implement directory creation
  }

  async removeDirectory(path) {
    // TODO: Implement directory removal
  }

  async copyDirectory(src, dest) {
    // TODO: Implement directory copying
  }

  async extractZip(zipPath, extractPath) {
    // TODO: Implement ZIP extraction
  }

  async saveFile(filePath, data) {
    // TODO: Implement file saving
  }

  async readFile(filePath) {
    // TODO: Implement file reading
  }

  async fileExists(filePath) {
    // TODO: Implement file existence check
    return false
  }

  async computeChecksum(data) {
    // TODO: Implement checksum computation
    return null
  }

  /**
   * Status and monitoring
   */
  getActiveOperations() {
    return {
      installs: Array.from(this.activeInstalls.entries()).map(([id, op]) => ({ pluginId: id, ...op })),
      updates: Array.from(this.activeUpdates.entries()).map(([id, op]) => ({ pluginId: id, ...op })),
      downloads: this.activeDownloads.size
    }
  }

  getStatus() {
    return {
      activeInstalls: this.activeInstalls.size,
      activeUpdates: this.activeUpdates.size,
      activeDownloads: this.activeDownloads.size,
      queuedDownloads: this.downloadQueue.length,
      config: this.config
    }
  }
}

export default PluginPackageManager