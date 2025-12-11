/**
 * Plugin Installation System
 * Handles plugin download, verification, dependency resolution, and installation
 */

import { invoke } from '@tauri-apps/api/core'
import { join, homeDir } from '@tauri-apps/api/path'
import { exists, createDir, removeDir, readTextFile, writeTextFile } from '@tauri-apps/api/fs'
import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginManifestV2 } from '../manifest/ManifestV2.js'
import RegistryAPI from './RegistryAPI.js'
import { logger } from '../../utils/logger.js'

/**
 * Installation Status
 */
export const INSTALL_STATUS = {
  PENDING: 'pending',
  DOWNLOADING: 'downloading',
  VERIFYING: 'verifying',
  EXTRACTING: 'extracting',
  INSTALLING: 'installing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
}

/**
 * Installation Types
 */
export const INSTALL_TYPE = {
  NEW: 'new',
  UPDATE: 'update',
  ROLLBACK: 'rollback',
  REINSTALL: 'reinstall'
}

/**
 * Dependency Resolution Strategies
 */
export const DEPENDENCY_STRATEGY = {
  AUTO: 'auto',
  PROMPT: 'prompt',
  STRICT: 'strict',
  IGNORE: 'ignore'
}

/**
 * Plugin Installer Class
 */
export class PluginInstaller extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      pluginDir: null, // Will be set in initialize()
      tempDir: null,
      maxConcurrentDownloads: 3,
      maxDownloadSize: 100 * 1024 * 1024, // 100MB
      verifyChecksums: true,
      autoResolveDependencies: true,
      dependencyStrategy: DEPENDENCY_STRATEGY.AUTO,
      backupBeforeUpdate: true,
      cleanupOnFailure: true,
      ...config
    }

    // Core components
    this.api = new RegistryAPI()
    this.downloads = new Map() // downloadId -> DownloadInfo
    this.installations = new Map() // installId -> InstallationInfo
    this.dependencyGraph = new Map() // pluginId -> Set<dependencyIds>
    this.installedPlugins = new Map() // pluginId -> InstallationMetadata
    
    // Download queue
    this.downloadQueue = []
    this.activeDownloads = new Set()
    
    // Security
    this.trustedPublishers = new Set()
    this.signatureVerifier = null // TODO: Implement signature verification

    // COMPLETED TODO: Replaced console with proper logger
    this.logger = logger.createScoped('PluginInstaller')
    this.isInitialized = false
  }

  /**
   * Initialize the installer
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      await this.setupDirectories()
      await this.loadInstalledPlugins()
      await this.api.initialize?.()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('Plugin installer initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize plugin installer:', error)
      throw error
    }
  }

  /**
   * Install plugin from registry
   */
  async installPlugin(pluginId, version = 'latest', options = {}) {
    try {
      const installId = this.generateInstallId()
      const {
        force = false,
        skipDependencies = false,
        strategy = this.config.dependencyStrategy
      } = options

      // Check if already installed
      if (!force && this.isPluginInstalled(pluginId)) {
        const installed = this.installedPlugins.get(pluginId)
        if (version === 'latest' || installed.version === version) {
          throw new Error(`Plugin already installed: ${pluginId}@${installed.version}`)
        }
      }

      // Create installation record
      const installation = {
        id: installId,
        pluginId,
        version,
        type: this.isPluginInstalled(pluginId) ? INSTALL_TYPE.UPDATE : INSTALL_TYPE.NEW,
        status: INSTALL_STATUS.PENDING,
        progress: 0,
        startTime: new Date().toISOString(),
        dependencies: [],
        rollbackData: null,
        error: null
      }

      this.installations.set(installId, installation)
      this.emit('install_started', installation)

      // Get plugin details from registry
      installation.status = INSTALL_STATUS.DOWNLOADING
      this.emit('install_progress', installation)

      const pluginDetails = await this.api.getPlugin(pluginId, version)
      if (!pluginDetails || pluginDetails.status !== 'success') {
        throw new Error(`Plugin not found: ${pluginId}@${version}`)
      }

      const plugin = pluginDetails.data
      installation.manifest = plugin.version.manifest
      installation.size = plugin.version.size

      // Resolve dependencies
      if (!skipDependencies) {
        const dependencies = await this.resolveDependencies(plugin, strategy)
        installation.dependencies = dependencies
        
        // Install dependencies first
        for (const dep of dependencies) {
          if (!this.isPluginInstalled(dep.id)) {
            await this.installPlugin(dep.id, dep.version, {
              ...options,
              skipDependencies: true // Avoid recursive resolution
            })
          }
        }
      }

      // Prepare backup if updating
      if (installation.type === INSTALL_TYPE.UPDATE && this.config.backupBeforeUpdate) {
        installation.rollbackData = await this.createBackup(pluginId)
      }

      // Download plugin package
      const downloadResult = await this.downloadPluginPackage(plugin, installation)
      installation.packagePath = downloadResult.path
      installation.checksum = downloadResult.checksum

      // Verify package
      installation.status = INSTALL_STATUS.VERIFYING
      this.emit('install_progress', installation)
      await this.verifyPackage(installation)

      // Extract package
      installation.status = INSTALL_STATUS.EXTRACTING
      this.emit('install_progress', installation)
      const extractPath = await this.extractPackage(installation)

      // Install plugin
      installation.status = INSTALL_STATUS.INSTALLING
      this.emit('install_progress', installation)
      await this.performInstallation(installation, extractPath)

      // Update installation registry
      await this.recordInstallation(installation)

      // Cleanup
      await this.cleanupInstallation(installation)

      installation.status = INSTALL_STATUS.COMPLETED
      installation.endTime = new Date().toISOString()
      installation.progress = 100

      this.emit('install_completed', installation)
      this.logger.info(`Plugin installed successfully: ${pluginId}@${version}`)

      return {
        success: true,
        installId,
        pluginId,
        version: plugin.version.version,
        installation
      }
    } catch (error) {
      await this.handleInstallationFailure(installId, error)
      throw error
    }
  }

  /**
   * Uninstall plugin
   */
  async uninstallPlugin(pluginId, options = {}) {
    try {
      if (!this.isPluginInstalled(pluginId)) {
        throw new Error(`Plugin not installed: ${pluginId}`)
      }

      const {
        force = false,
        keepData = false,
        removeDependents = false
      } = options

      const installation = this.installedPlugins.get(pluginId)
      
      // Check for dependents
      const dependents = this.getDependents(pluginId)
      if (dependents.length > 0 && !removeDependents && !force) {
        throw new Error(`Cannot uninstall ${pluginId}. Required by: ${dependents.join(', ')}`)
      }

      this.emit('uninstall_started', { pluginId })

      // Uninstall dependents first if requested
      if (removeDependents) {
        for (const dependent of dependents) {
          await this.uninstallPlugin(dependent, { ...options, removeDependents: true })
        }
      }

      // Remove plugin files
      const pluginPath = await join(this.config.pluginDir, pluginId)
      if (await exists(pluginPath)) {
        await removeDir(pluginPath, { recursive: true })
      }

      // Remove from installation registry
      this.installedPlugins.delete(pluginId)
      await this.saveInstalledPlugins()

      // Clean up dependency graph
      this.dependencyGraph.delete(pluginId)
      for (const deps of this.dependencyGraph.values()) {
        deps.delete(pluginId)
      }

      this.emit('uninstall_completed', { pluginId })
      this.logger.info(`Plugin uninstalled successfully: ${pluginId}`)

      return {
        success: true,
        pluginId,
        removedDependents: removeDependents ? dependents : []
      }
    } catch (error) {
      this.logger.error(`Failed to uninstall plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Update plugin to latest version
   */
  async updatePlugin(pluginId, options = {}) {
    try {
      if (!this.isPluginInstalled(pluginId)) {
        throw new Error(`Plugin not installed: ${pluginId}`)
      }

      const currentVersion = this.installedPlugins.get(pluginId).version
      const latestVersion = await this.getLatestVersion(pluginId)

      if (this.compareVersions(latestVersion, currentVersion) <= 0) {
        return {
          success: true,
          message: 'Plugin is already up to date',
          currentVersion,
          latestVersion
        }
      }

      return await this.installPlugin(pluginId, latestVersion, {
        ...options,
        force: true
      })
    } catch (error) {
      this.logger.error(`Failed to update plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Rollback to previous version
   */
  async rollbackPlugin(pluginId, targetVersion = null) {
    try {
      if (!this.isPluginInstalled(pluginId)) {
        throw new Error(`Plugin not installed: ${pluginId}`)
      }

      const installation = this.installedPlugins.get(pluginId)
      
      if (!targetVersion) {
        // Find previous version from installation history
        targetVersion = await this.getPreviousVersion(pluginId)
        if (!targetVersion) {
          throw new Error('No previous version found for rollback')
        }
      }

      this.logger.info(`Rolling back ${pluginId} from ${installation.version} to ${targetVersion}`)

      return await this.installPlugin(pluginId, targetVersion, {
        force: true,
        type: INSTALL_TYPE.ROLLBACK
      })
    } catch (error) {
      this.logger.error(`Failed to rollback plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Check for available updates
   */
  async checkUpdates(pluginIds = null) {
    try {
      const toCheck = pluginIds || Array.from(this.installedPlugins.keys())
      const updates = []

      for (const pluginId of toCheck) {
        try {
          const installation = this.installedPlugins.get(pluginId)
          if (!installation) continue

          const latest = await this.getLatestVersion(pluginId)
          if (this.compareVersions(latest, installation.version) > 0) {
            const pluginDetails = await this.api.getPlugin(pluginId, latest)
            updates.push({
              pluginId,
              currentVersion: installation.version,
              latestVersion: latest,
              changelog: pluginDetails.data?.version?.changelog || 'No changelog available',
              size: pluginDetails.data?.version?.size || 0
            })
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
  async resolveDependencies(plugin, strategy = DEPENDENCY_STRATEGY.AUTO) {
    const dependencies = []
    const manifest = plugin.version.manifest
    const pluginDeps = manifest.extensionDependencies || []

    for (const depId of pluginDeps) {
      try {
        // Check if already installed
        if (this.isPluginInstalled(depId)) {
          const installed = this.installedPlugins.get(depId)
          const requiredVersion = manifest.dependencies?.[depId] || 'latest'
          
          if (this.isVersionCompatible(installed.version, requiredVersion)) {
            continue // Dependency satisfied
          }
        }

        // Resolve dependency version
        const depDetails = await this.api.getPlugin(depId, 'latest')
        if (!depDetails || depDetails.status !== 'success') {
          if (strategy === DEPENDENCY_STRATEGY.STRICT) {
            throw new Error(`Required dependency not found: ${depId}`)
          }
          continue
        }

        dependencies.push({
          id: depId,
          version: depDetails.data.version.version,
          required: true,
          source: 'registry'
        })

        // Recursively resolve nested dependencies
        const nestedDeps = await this.resolveDependencies(depDetails.data, strategy)
        dependencies.push(...nestedDeps)
      } catch (error) {
        if (strategy === DEPENDENCY_STRATEGY.STRICT) {
          throw error
        }
        this.logger.warn(`Failed to resolve dependency ${depId}:`, error)
      }
    }

    // Remove duplicates
    const uniqueDeps = dependencies.filter((dep, index, arr) => 
      arr.findIndex(d => d.id === dep.id) === index
    )

    return uniqueDeps
  }

  /**
   * Package download and verification
   */
  async downloadPluginPackage(plugin, installation) {
    const downloadId = this.generateDownloadId()
    const tempPath = await join(this.config.tempDir, `${downloadId}.zip`)

    try {
      // Check download size
      if (plugin.version.size > this.config.maxDownloadSize) {
        throw new Error(`Package too large: ${plugin.version.size} bytes (max: ${this.config.maxDownloadSize})`)
      }

      const download = {
        id: downloadId,
        pluginId: plugin.id,
        version: plugin.version.version,
        url: plugin.version.downloadUrl,
        path: tempPath,
        size: plugin.version.size,
        downloaded: 0,
        startTime: Date.now()
      }

      this.downloads.set(downloadId, download)
      this.emit('download_started', download)

      // Download via API
      const response = await this.api.downloadPlugin(plugin.id, plugin.version.version)
      
      if (response.status !== 'success') {
        throw new Error(`Download failed: ${response.message}`)
      }

      // Save to temp file
      await this.saveDownloadToFile(response.data, tempPath, (progress) => {
        download.downloaded = progress.loaded
        installation.progress = Math.floor((progress.loaded / progress.total) * 50) // First 50% is download
        this.emit('download_progress', { download, progress })
        this.emit('install_progress', installation)
      })

      // Calculate checksum
      const checksum = await this.calculateChecksum(tempPath)
      download.checksum = checksum

      this.emit('download_completed', download)
      
      return {
        path: tempPath,
        checksum,
        downloadId
      }
    } catch (error) {
      this.downloads.delete(downloadId)
      throw error
    }
  }

  async verifyPackage(installation) {
    const { packagePath, checksum, manifest } = installation

    // Verify checksum if available
    if (this.config.verifyChecksums && manifest.checksum) {
      if (checksum !== manifest.checksum) {
        throw new Error('Package checksum verification failed')
      }
    }

    // Verify digital signature if available
    if (this.signatureVerifier && manifest.signature) {
      const isValid = await this.signatureVerifier.verify(packagePath, manifest.signature)
      if (!isValid) {
        throw new Error('Package signature verification failed')
      }
    }

    // Check against trusted publishers
    if (this.trustedPublishers.size > 0) {
      const publisher = manifest.publisher
      if (!this.trustedPublishers.has(publisher)) {
        this.logger.warn(`Installing plugin from untrusted publisher: ${publisher}`)
      }
    }

    return true
  }

  async extractPackage(installation) {
    const extractPath = await join(this.config.tempDir, `extract_${installation.id}`)
    
    try {
      // Create extraction directory
      await createDir(extractPath, { recursive: true })

      // Extract ZIP file
      await invoke('extract_archive', {
        archivePath: installation.packagePath,
        extractPath: extractPath
      })

      // Verify extracted manifest
      const manifestPath = await join(extractPath, 'plugin.json')
      if (!(await exists(manifestPath))) {
        throw new Error('Invalid plugin package: plugin.json not found')
      }

      const manifestContent = await readTextFile(manifestPath)
      const extractedManifest = JSON.parse(manifestContent)
      
      // Validate manifest
      const validator = new PluginManifestV2()
      const validation = validator.load(extractedManifest)
      
      if (!validation.valid) {
        throw new Error(`Invalid manifest: ${validation.errors.map(e => e.message).join(', ')}`)
      }

      return extractPath
    } catch (error) {
      // Cleanup on failure
      if (await exists(extractPath)) {
        await removeDir(extractPath, { recursive: true })
      }
      throw error
    }
  }

  async performInstallation(installation, extractPath) {
    const targetPath = await join(this.config.pluginDir, installation.pluginId)

    try {
      // Remove existing installation if updating
      if (await exists(targetPath)) {
        await removeDir(targetPath, { recursive: true })
      }

      // Create plugin directory
      await createDir(targetPath, { recursive: true })

      // Copy files from extraction directory
      await invoke('copy_directory', {
        sourcePath: extractPath,
        targetPath: targetPath
      })

      // Set permissions
      await invoke('set_directory_permissions', {
        path: targetPath,
        permissions: '755'
      })

      installation.progress = 90
      this.emit('install_progress', installation)

      return targetPath
    } catch (error) {
      // Cleanup on failure
      if (await exists(targetPath)) {
        await removeDir(targetPath, { recursive: true })
      }
      throw error
    }
  }

  /**
   * Installation registry management
   */
  async recordInstallation(installation) {
    const record = {
      pluginId: installation.pluginId,
      version: installation.manifest.version,
      installDate: new Date().toISOString(),
      installId: installation.id,
      type: installation.type,
      manifest: installation.manifest,
      dependencies: installation.dependencies.map(d => d.id),
      size: installation.size,
      checksum: installation.checksum
    }

    this.installedPlugins.set(installation.pluginId, record)
    
    // Update dependency graph
    const deps = new Set(record.dependencies)
    this.dependencyGraph.set(installation.pluginId, deps)

    await this.saveInstalledPlugins()
  }

  async loadInstalledPlugins() {
    try {
      const registryPath = await join(this.config.pluginDir, 'installed.json')
      
      if (await exists(registryPath)) {
        const content = await readTextFile(registryPath)
        const data = JSON.parse(content)
        
        for (const [pluginId, record] of Object.entries(data.plugins || {})) {
          this.installedPlugins.set(pluginId, record)
          
          if (record.dependencies) {
            this.dependencyGraph.set(pluginId, new Set(record.dependencies))
          }
        }
        
        this.logger.info(`Loaded ${this.installedPlugins.size} installed plugins`)
      }
    } catch (error) {
      this.logger.warn('Failed to load installed plugins registry:', error)
    }
  }

  async saveInstalledPlugins() {
    try {
      const registryPath = await join(this.config.pluginDir, 'installed.json')
      
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        plugins: Object.fromEntries(this.installedPlugins)
      }

      await writeTextFile(registryPath, JSON.stringify(data, null, 2))
    } catch (error) {
      this.logger.error('Failed to save installed plugins registry:', error)
      throw error
    }
  }

  /**
   * Helper methods
   */
  
  isPluginInstalled(pluginId) {
    return this.installedPlugins.has(pluginId)
  }

  getDependents(pluginId) {
    const dependents = []
    for (const [id, deps] of this.dependencyGraph) {
      if (deps.has(pluginId)) {
        dependents.push(id)
      }
    }
    return dependents
  }

  async getLatestVersion(pluginId) {
    const details = await this.api.getPlugin(pluginId, 'latest')
    return details.data?.version?.version || null
  }

  async getPreviousVersion(pluginId) {
    // TODO: Implement version history tracking
    return null
  }

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

  isVersionCompatible(installedVersion, requiredVersion) {
    // TODO: Implement proper semver compatibility checking
    return true
  }

  async setupDirectories() {
    const home = await homeDir()
    this.config.pluginDir = await join(home, '.lokus', 'plugins')
    this.config.tempDir = await join(home, '.lokus', 'temp')

    for (const dir of [this.config.pluginDir, this.config.tempDir]) {
      if (!(await exists(dir))) {
        await createDir(dir, { recursive: true })
      }
    }
  }

  async createBackup(pluginId) {
    // TODO: Implement plugin backup functionality
    return null
  }

  async handleInstallationFailure(installId, error) {
    const installation = this.installations.get(installId)
    if (!installation) return

    installation.status = INSTALL_STATUS.FAILED
    installation.error = error.message
    installation.endTime = new Date().toISOString()

    if (this.config.cleanupOnFailure) {
      await this.cleanupInstallation(installation)
    }

    this.emit('install_failed', { installation, error })
    this.logger.error(`Installation failed: ${installation.pluginId}`, error)
  }

  async cleanupInstallation(installation) {
    try {
      // Remove temp files
      if (installation.packagePath && await exists(installation.packagePath)) {
        await invoke('remove_file', { path: installation.packagePath })
      }

      // Remove extraction directory
      const extractPath = await join(this.config.tempDir, `extract_${installation.id}`)
      if (await exists(extractPath)) {
        await removeDir(extractPath, { recursive: true })
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup installation files:', error)
    }
  }

  async saveDownloadToFile(blob, filePath, progressCallback) {
    // TODO: Implement proper file download with progress
    // For now, this is a placeholder
    return invoke('save_blob_to_file', {
      blob: Array.from(new Uint8Array(await blob.arrayBuffer())),
      path: filePath
    })
  }

  async calculateChecksum(filePath) {
    return invoke('calculate_file_checksum', { path: filePath })
  }

  generateInstallId() {
    return `install_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  generateDownloadId() {
    return `download_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Public API methods
   */
  
  getInstallationStatus(installId) {
    return this.installations.get(installId)
  }

  getInstalledPlugins() {
    return Array.from(this.installedPlugins.entries()).map(([id, data]) => ({
      id,
      ...data
    }))
  }

  getActiveDownloads() {
    return Array.from(this.downloads.values())
  }

  cancelInstallation(installId) {
    const installation = this.installations.get(installId)
    if (installation && installation.status !== INSTALL_STATUS.COMPLETED) {
      installation.status = INSTALL_STATUS.CANCELLED
      this.emit('install_cancelled', installation)
      return true
    }
    return false
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown() {
    // Cancel active downloads
    for (const installation of this.installations.values()) {
      if (installation.status !== INSTALL_STATUS.COMPLETED) {
        this.cancelInstallation(installation.id)
      }
    }

    // Save state
    await this.saveInstalledPlugins()

    this.emit('shutdown')
    this.removeAllListeners()
  }
}

export default PluginInstaller