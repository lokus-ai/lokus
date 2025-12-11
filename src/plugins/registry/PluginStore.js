/**
 * Plugin Store/Database
 * Local plugin metadata storage, installation tracking, registry cache management, and search indexing
 */

import { invoke } from '@tauri-apps/api/core'
import { join, homeDir } from '@tauri-apps/api/path'
import { exists, createDir, readTextFile, writeTextFile, removeFile, readDir } from '@tauri-apps/api/fs'
import { EventEmitter } from '../../utils/EventEmitter.js'
import { logger } from '../../utils/logger.js'

/**
 * Storage Types
 */
export const STORAGE_TYPE = {
  CACHE: 'cache',
  METADATA: 'metadata',
  INSTALLATION: 'installation',
  SETTINGS: 'settings',
  ANALYTICS: 'analytics'
}

/**
 * Cache Policies
 */
export const CACHE_POLICY = {
  NO_CACHE: 'no_cache',
  CACHE_FIRST: 'cache_first',
  NETWORK_FIRST: 'network_first',
  STALE_WHILE_REVALIDATE: 'stale_while_revalidate'
}

/**
 * Plugin Store Class
 */
export class PluginStore extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      storageDir: null, // Will be set in initialize()
      cacheDir: null,
      metadataDir: null,
      maxCacheSize: 500 * 1024 * 1024, // 500MB
      maxCacheAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      compressionEnabled: true,
      encryptionEnabled: false,
      autoCleanup: true,
      cleanupInterval: 24 * 60 * 60 * 1000, // 24 hours
      backupEnabled: true,
      backupRetention: 7, // Keep 7 backups
      ...config
    }

    // Storage components
    this.cache = new Map() // In-memory cache
    this.metadata = new Map() // Plugin metadata
    this.installedPlugins = new Map() // pluginId -> InstallationRecord
    this.dependencies = new Map() // pluginId -> dependencies
    this.searchIndex = new Map() // term -> Set<pluginId>
    this.storageStats = {
      totalSize: 0,
      cacheSize: 0,
      metadataSize: 0,
      installedPlugins: 0,
      lastCleanup: null
    }

    // Cleanup timer
    this.cleanupTimer = null

    // COMPLETED TODO: Replaced console with proper logger
    this.logger = logger.createScoped('PluginStore')
    this.isInitialized = false
  }

  /**
   * Initialize storage system
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      await this.setupDirectories()
      await this.loadStorageStats()
      await this.loadMetadata()
      await this.loadInstalledPlugins()
      this.startCleanupTimer()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('Registry storage initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize registry storage:', error)
      throw error
    }
  }

  /**
   * Cache management
   */
  async set(key, data, options = {}) {
    try {
      const {
        type = STORAGE_TYPE.CACHE,
        ttl = this.config.maxCacheAge,
        compress = this.config.compressionEnabled,
        encrypt = this.config.encryptionEnabled
      } = options

      const entry = {
        key,
        data,
        type,
        timestamp: Date.now(),
        ttl,
        size: this.calculateSize(data),
        compressed: false,
        encrypted: false
      }

      // Compress if enabled and data is large enough
      if (compress && entry.size > 1024) {
        entry.data = await this.compressData(entry.data)
        entry.compressed = true
        entry.size = this.calculateSize(entry.data)
      }

      // Encrypt if enabled
      if (encrypt) {
        entry.data = await this.encryptData(entry.data)
        entry.encrypted = true
      }

      // Store in memory cache
      this.cache.set(key, entry)

      // Persist to disk based on type
      await this.persistEntry(key, entry)

      // Update stats
      this.updateStorageStats(entry.size, 'add')

      // Check cache size limits
      await this.enforceStorageLimits()

      this.emit('entry_stored', { key, type, size: entry.size })
      
      return true
    } catch (error) {
      this.logger.error(`Failed to store entry ${key}:`, error)
      throw error
    }
  }

  async get(key, options = {}) {
    try {
      const {
        policy = CACHE_POLICY.CACHE_FIRST,
        allowStale = false
      } = options

      // Check memory cache first
      let entry = this.cache.get(key)
      
      // If not in memory, try to load from disk
      if (!entry) {
        entry = await this.loadEntry(key)
        if (entry) {
          this.cache.set(key, entry)
        }
      }

      if (!entry) {
        return null
      }

      // Check if entry is expired
      const isExpired = this.isEntryExpired(entry)
      
      if (isExpired && !allowStale) {
        await this.delete(key)
        return null
      }

      // Decrypt if needed
      let data = entry.data
      if (entry.encrypted) {
        data = await this.decryptData(data)
      }

      // Decompress if needed
      if (entry.compressed) {
        data = await this.decompressData(data)
      }

      this.emit('entry_accessed', { key, type: entry.type, stale: isExpired })
      
      return {
        data,
        metadata: {
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          type: entry.type,
          stale: isExpired
        }
      }
    } catch (error) {
      this.logger.error(`Failed to get entry ${key}:`, error)
      return null
    }
  }

  async delete(key) {
    try {
      const entry = this.cache.get(key)
      
      // Remove from memory cache
      this.cache.delete(key)
      
      // Remove from disk
      await this.deletePersistedEntry(key)
      
      // Update stats
      if (entry) {
        this.updateStorageStats(entry.size, 'remove')
      }

      this.emit('entry_deleted', { key })
      
      return true
    } catch (error) {
      this.logger.error(`Failed to delete entry ${key}:`, error)
      throw error
    }
  }

  async has(key) {
    try {
      if (this.cache.has(key)) {
        return true
      }
      
      const entry = await this.loadEntry(key)
      return entry !== null
    } catch (error) {
      this.logger.error(`Failed to check entry ${key}:`, error)
      return false
    }
  }

  async clear(type = null) {
    try {
      const keysToDelete = []
      
      for (const [key, entry] of this.cache) {
        if (!type || entry.type === type) {
          keysToDelete.push(key)
        }
      }

      for (const key of keysToDelete) {
        await this.delete(key)
      }

      this.emit('storage_cleared', { type, count: keysToDelete.length })
      this.logger.info(`Cleared ${keysToDelete.length} entries${type ? ` of type ${type}` : ''}`)
      
      return keysToDelete.length
    } catch (error) {
      this.logger.error('Failed to clear storage:', error)
      throw error
    }
  }

  /**
   * Plugin metadata management
   */
  async setPluginMetadata(pluginId, metadata) {
    const key = `plugin_metadata_${pluginId}`
    return this.set(key, metadata, {
      type: STORAGE_TYPE.METADATA,
      ttl: this.config.maxCacheAge * 2 // Metadata lives longer
    })
  }

  async getPluginMetadata(pluginId) {
    const key = `plugin_metadata_${pluginId}`
    const result = await this.get(key)
    return result?.data || null
  }

  async deletePluginMetadata(pluginId) {
    const key = `plugin_metadata_${pluginId}`
    return this.delete(key)
  }

  /**
   * Installation state management
   */
  async setInstallationState(installId, state) {
    const key = `installation_${installId}`
    return this.set(key, state, {
      type: STORAGE_TYPE.INSTALLATION,
      ttl: 30 * 24 * 60 * 60 * 1000 // 30 days for installation records
    })
  }

  async getInstallationState(installId) {
    const key = `installation_${installId}`
    const result = await this.get(key)
    return result?.data || null
  }

  async getAllInstallations() {
    const installations = []
    
    for (const [key, entry] of this.cache) {
      if (entry.type === STORAGE_TYPE.INSTALLATION) {
        const result = await this.get(key)
        if (result) {
          installations.push(result.data)
        }
      }
    }

    return installations
  }

  /**
   * Settings management
   */
  async setSetting(key, value) {
    const settingKey = `setting_${key}`
    return this.set(settingKey, value, {
      type: STORAGE_TYPE.SETTINGS,
      ttl: Infinity // Settings don't expire
    })
  }

  async getSetting(key, defaultValue = null) {
    const settingKey = `setting_${key}`
    const result = await this.get(settingKey)
    return result?.data ?? defaultValue
  }

  async getAllSettings() {
    const settings = {}
    
    for (const [key, entry] of this.cache) {
      if (entry.type === STORAGE_TYPE.SETTINGS && key.startsWith('setting_')) {
        const settingKey = key.replace('setting_', '')
        const result = await this.get(key)
        if (result) {
          settings[settingKey] = result.data
        }
      }
    }

    return settings
  }

  /**
   * Analytics data management
   */
  async recordAnalytics(event, data) {
    const key = `analytics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    return this.set(key, {
      event,
      data,
      timestamp: new Date().toISOString()
    }, {
      type: STORAGE_TYPE.ANALYTICS,
      ttl: 90 * 24 * 60 * 60 * 1000 // 90 days
    })
  }

  async getAnalytics(timeRange = '30d') {
    const analytics = []
    const cutoffTime = this.parseDateRange(timeRange)
    
    for (const [key, entry] of this.cache) {
      if (entry.type === STORAGE_TYPE.ANALYTICS && entry.timestamp > cutoffTime) {
        const result = await this.get(key)
        if (result) {
          analytics.push(result.data)
        }
      }
    }

    return analytics.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
  }

  /**
   * Plugin installation tracking
   */
  async recordInstallation(pluginId, version, metadata = {}) {
    const installRecord = {
      pluginId,
      version,
      installTime: Date.now(),
      source: metadata.source || 'unknown',
      installPath: metadata.installPath || null,
      dependencies: metadata.dependencies || [],
      status: 'installed',
      lastUsed: null,
      ...metadata
    }

    this.installedPlugins.set(pluginId, installRecord)
    
    // Update dependencies mapping
    if (installRecord.dependencies.length > 0) {
      this.dependencies.set(pluginId, installRecord.dependencies)
    }

    // Update search index
    await this.updateSearchIndex(pluginId, installRecord)

    // Persist to disk
    await this.persistInstalledPlugins()

    this.storageStats.installedPlugins = this.installedPlugins.size
    this.emit('plugin_installed', { pluginId, version, installRecord })

    return installRecord
  }

  async recordUninstallation(pluginId, metadata = {}) {
    const installRecord = this.installedPlugins.get(pluginId)
    
    if (installRecord) {
      // Remove from installed plugins
      this.installedPlugins.delete(pluginId)
      
      // Remove from dependencies
      this.dependencies.delete(pluginId)
      
      // Remove from search index
      this.removeFromSearchIndex(pluginId)
      
      // Persist changes
      await this.persistInstalledPlugins()
      
      this.storageStats.installedPlugins = this.installedPlugins.size
      this.emit('plugin_uninstalled', { pluginId, metadata })
    }

    return true
  }

  async isInstalled(pluginId) {
    return this.installedPlugins.has(pluginId)
  }

  async getInstalledVersion(pluginId) {
    const record = this.installedPlugins.get(pluginId)
    return record?.version || null
  }

  async getInstalledPlugins() {
    return Array.from(this.installedPlugins.keys())
  }

  async getInstallationRecord(pluginId) {
    return this.installedPlugins.get(pluginId) || null
  }

  async getAllInstallationRecords() {
    return Array.from(this.installedPlugins.values())
  }

  async updateLastUsed(pluginId) {
    const record = this.installedPlugins.get(pluginId)
    if (record) {
      record.lastUsed = Date.now()
      await this.persistInstalledPlugins()
    }
  }

  /**
   * Dependency management
   */
  async getPluginDependencies(pluginId) {
    return this.dependencies.get(pluginId) || []
  }

  async findDependents(pluginId) {
    const dependents = []
    
    for (const [id, deps] of this.dependencies) {
      if (deps.some(dep => dep.id === pluginId || dep.pluginId === pluginId)) {
        const record = this.installedPlugins.get(id)
        if (record) {
          dependents.push({
            id,
            version: record.version,
            dependencyType: 'runtime'
          })
        }
      }
    }

    return dependents
  }

  async updateDependencies(pluginId, dependencies) {
    if (dependencies && dependencies.length > 0) {
      this.dependencies.set(pluginId, dependencies)
    } else {
      this.dependencies.delete(pluginId)
    }
    
    await this.persistInstalledPlugins()
  }

  /**
   * Search functionality
   */
  async searchInstalledPlugins(query, options = {}) {
    const {
      limit = 50,
      includeMetadata = false
    } = options

    if (!query || query.trim() === '') {
      const all = Array.from(this.installedPlugins.values())
      return includeMetadata ? all : all.map(p => p.pluginId)
    }

    const terms = query.toLowerCase().split(/\s+/)
    let matchingPlugins = new Set()

    // Search in index
    for (const term of terms) {
      if (this.searchIndex.has(term)) {
        if (matchingPlugins.size === 0) {
          matchingPlugins = new Set(this.searchIndex.get(term))
        } else {
          // Intersection for AND behavior
          matchingPlugins = new Set([...matchingPlugins].filter(id => 
            this.searchIndex.get(term).has(id)
          ))
        }
      }
    }

    const results = Array.from(matchingPlugins)
      .slice(0, limit)
      .map(pluginId => {
        const record = this.installedPlugins.get(pluginId)
        return includeMetadata ? record : pluginId
      })
      .filter(Boolean)

    return results
  }

  async updateSearchIndex(pluginId, installRecord) {
    // Remove existing entries for this plugin
    this.removeFromSearchIndex(pluginId)

    // Get plugin metadata for indexing
    const metadata = await this.getPluginMetadata(pluginId) || {}
    
    // Build searchable text
    const searchableText = [
      pluginId,
      installRecord.version,
      metadata.name || '',
      metadata.displayName || '',
      metadata.description || '',
      ...(metadata.keywords || []),
      ...(metadata.categories || []),
      metadata.author || ''
    ].filter(Boolean).join(' ').toLowerCase()

    // Extract terms
    const terms = searchableText.split(/\s+/).filter(term => term.length > 2)
    
    // Add to search index
    for (const term of terms) {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, new Set())
      }
      this.searchIndex.get(term).add(pluginId)
    }
  }

  removeFromSearchIndex(pluginId) {
    for (const [term, pluginIds] of this.searchIndex) {
      pluginIds.delete(pluginId)
      if (pluginIds.size === 0) {
        this.searchIndex.delete(term)
      }
    }
  }

  async rebuildSearchIndex() {
    this.searchIndex.clear()
    
    for (const [pluginId, record] of this.installedPlugins) {
      await this.updateSearchIndex(pluginId, record)
    }
  }

  /**
   * Registry cache management
   */
  async cacheRegistryData(key, data, ttl = this.config.maxCacheAge) {
    return this.set(`registry_${key}`, data, {
      type: STORAGE_TYPE.CACHE,
      ttl
    })
  }

  async getCachedRegistryData(key) {
    const result = await this.get(`registry_${key}`)
    return result?.data || null
  }

  async invalidateRegistryCache(pattern = null) {
    const keysToDelete = []
    
    for (const [key, entry] of this.cache) {
      if (key.startsWith('registry_')) {
        if (!pattern || key.includes(pattern)) {
          keysToDelete.push(key)
        }
      }
    }

    for (const key of keysToDelete) {
      await this.delete(key)
    }

    return keysToDelete.length
  }

  /**
   * Plugin statistics and analytics
   */
  async getPluginUsageStats(pluginId) {
    const record = this.installedPlugins.get(pluginId)
    if (!record) return null

    const analytics = await this.getAnalytics('30d')
    const pluginEvents = analytics.filter(event => 
      event.data.pluginId === pluginId
    )

    return {
      pluginId,
      version: record.version,
      installTime: record.installTime,
      lastUsed: record.lastUsed,
      totalEvents: pluginEvents.length,
      recentActivity: pluginEvents.slice(-10)
    }
  }

  async getInstallationStatistics() {
    const now = Date.now()
    const records = Array.from(this.installedPlugins.values())
    
    const stats = {
      totalInstalled: records.length,
      recentInstalls: records.filter(r => now - r.installTime < 7 * 24 * 60 * 60 * 1000).length,
      bySource: {},
      byAge: {
        thisWeek: 0,
        thisMonth: 0,
        older: 0
      },
      dependencies: this.dependencies.size,
      searchTerms: this.searchIndex.size
    }

    // Count by source
    records.forEach(record => {
      const source = record.source || 'unknown'
      stats.bySource[source] = (stats.bySource[source] || 0) + 1
    })

    // Count by age
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000
    
    records.forEach(record => {
      if (record.installTime > weekAgo) {
        stats.byAge.thisWeek++
      } else if (record.installTime > monthAgo) {
        stats.byAge.thisMonth++
      } else {
        stats.byAge.older++
      }
    })

    return stats
  }

  /**
   * Backup and restore enhancement
   */
  async createBackup() {
    try {
      if (!this.config.backupEnabled) {
        return null
      }

      const backupId = `backup_${Date.now()}`
      const backupPath = await join(this.config.storageDir, 'backups', `${backupId}.json`)
      
      // Ensure backup directory exists
      const backupDir = await join(this.config.storageDir, 'backups')
      if (!(await exists(backupDir))) {
        await createDir(backupDir, { recursive: true })
      }

      // Collect all data
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        cache: {},
        metadata: Object.fromEntries(this.metadata),
        installedPlugins: Object.fromEntries(this.installedPlugins),
        dependencies: Object.fromEntries(this.dependencies),
        stats: this.storageStats
      }

      // Export cache entries
      for (const [key, entry] of this.cache) {
        backupData.cache[key] = {
          ...entry,
          data: entry.encrypted ? '[ENCRYPTED]' : entry.data
        }
      }

      await writeTextFile(backupPath, JSON.stringify(backupData, null, 2))

      // Cleanup old backups
      await this.cleanupOldBackups()

      this.emit('backup_created', { backupId, path: backupPath })
      this.logger.info(`Backup created: ${backupId}`)

      return backupId
    } catch (error) {
      this.logger.error('Failed to create backup:', error)
      throw error
    }
  }

  async restoreBackup(backupId) {
    try {
      const backupPath = await join(this.config.storageDir, 'backups', `${backupId}.json`)
      
      if (!(await exists(backupPath))) {
        throw new Error(`Backup not found: ${backupId}`)
      }

      const backupContent = await readTextFile(backupPath)
      const backupData = JSON.parse(backupContent)

      // Clear current data
      await this.clear()

      // Restore metadata
      if (backupData.metadata) {
        this.metadata = new Map(Object.entries(backupData.metadata))
      }

      // Restore installed plugins
      if (backupData.installedPlugins) {
        this.installedPlugins = new Map(Object.entries(backupData.installedPlugins))
      }

      // Restore dependencies
      if (backupData.dependencies) {
        this.dependencies = new Map(Object.entries(backupData.dependencies))
      }

      // Restore cache entries (non-encrypted only)
      if (backupData.cache) {
        for (const [key, entry] of Object.entries(backupData.cache)) {
          if (entry.data !== '[ENCRYPTED]') {
            this.cache.set(key, entry)
          }
        }
      }

      // Restore stats
      if (backupData.stats) {
        this.storageStats = { ...this.storageStats, ...backupData.stats }
      }

      // Rebuild search index
      await this.rebuildSearchIndex()

      await this.persistAllEntries()

      this.emit('backup_restored', { backupId })
      this.logger.info(`Backup restored: ${backupId}`)

      return true
    } catch (error) {
      this.logger.error(`Failed to restore backup ${backupId}:`, error)
      throw error
    }
  }

  async listBackups() {
    try {
      const backupDir = await join(this.config.storageDir, 'backups')
      
      if (!(await exists(backupDir))) {
        return []
      }

      const entries = await readDir(backupDir)
      const backups = []

      for (const entry of entries) {
        if (entry.name.endsWith('.json') && entry.name.startsWith('backup_')) {
          try {
            const content = await readTextFile(entry.path)
            const data = JSON.parse(content)
            
            backups.push({
              id: entry.name.replace('.json', ''),
              timestamp: data.timestamp,
              size: entry.size || 0,
              version: data.version || '1.0'
            })
          } catch (error) {
            this.logger.warn(`Failed to read backup ${entry.name}:`, error)
          }
        }
      }

      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    } catch (error) {
      this.logger.error('Failed to list backups:', error)
      return []
    }
  }

  /**
   * Maintenance and cleanup
   */
  async cleanup() {
    try {
      let cleanedCount = 0
      let reclaimedSpace = 0

      // Remove expired entries
      const expiredKeys = []
      for (const [key, entry] of this.cache) {
        if (this.isEntryExpired(entry)) {
          expiredKeys.push(key)
        }
      }

      for (const key of expiredKeys) {
        const entry = this.cache.get(key)
        await this.delete(key)
        cleanedCount++
        reclaimedSpace += entry?.size || 0
      }

      // Enforce storage limits
      const limitCleaned = await this.enforceStorageLimits()
      cleanedCount += limitCleaned.count
      reclaimedSpace += limitCleaned.size

      // Update cleanup timestamp
      this.storageStats.lastCleanup = Date.now()
      await this.saveStorageStats()

      this.emit('cleanup_completed', {
        cleanedCount,
        reclaimedSpace,
        totalSize: this.storageStats.totalSize
      })

      this.logger.info(`Cleanup completed: removed ${cleanedCount} entries, reclaimed ${this.formatSize(reclaimedSpace)}`)

      return {
        cleanedCount,
        reclaimedSpace
      }
    } catch (error) {
      this.logger.error('Failed to cleanup storage:', error)
      throw error
    }
  }

  async enforceStorageLimits() {
    let cleanedCount = 0
    let reclaimedSize = 0

    // Check total cache size
    if (this.storageStats.cacheSize > this.config.maxCacheSize) {
      const excess = this.storageStats.cacheSize - this.config.maxCacheSize
      const entriesByAge = Array.from(this.cache.entries())
        .filter(([_, entry]) => entry.type === STORAGE_TYPE.CACHE)
        .sort((a, b) => a[1].timestamp - b[1].timestamp) // Oldest first

      let sizeToRemove = excess
      for (const [key, entry] of entriesByAge) {
        if (sizeToRemove <= 0) break
        
        await this.delete(key)
        cleanedCount++
        reclaimedSize += entry.size
        sizeToRemove -= entry.size
      }
    }

    return { count: cleanedCount, size: reclaimedSize }
  }

  /**
   * Storage operations
   */
  async persistEntry(key, entry) {
    try {
      const dir = this.getStorageDir(entry.type)
      const filePath = await join(dir, `${this.sanitizeKey(key)}.json`)
      
      // Ensure directory exists
      if (!(await exists(dir))) {
        await createDir(dir, { recursive: true })
      }

      const persistData = {
        ...entry,
        persistedAt: Date.now()
      }

      await writeTextFile(filePath, JSON.stringify(persistData))
    } catch (error) {
      this.logger.warn(`Failed to persist entry ${key}:`, error)
    }
  }

  async loadEntry(key) {
    try {
      // Try each storage type directory
      for (const type of Object.values(STORAGE_TYPE)) {
        const dir = this.getStorageDir(type)
        const filePath = await join(dir, `${this.sanitizeKey(key)}.json`)
        
        if (await exists(filePath)) {
          const content = await readTextFile(filePath)
          const entry = JSON.parse(content)
          return entry
        }
      }
      
      return null
    } catch (error) {
      this.logger.warn(`Failed to load entry ${key}:`, error)
      return null
    }
  }

  async deletePersistedEntry(key) {
    try {
      // Try to delete from all storage type directories
      for (const type of Object.values(STORAGE_TYPE)) {
        const dir = this.getStorageDir(type)
        const filePath = await join(dir, `${this.sanitizeKey(key)}.json`)
        
        if (await exists(filePath)) {
          await removeFile(filePath)
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to delete persisted entry ${key}:`, error)
    }
  }

  async persistAllEntries() {
    for (const [key, entry] of this.cache) {
      await this.persistEntry(key, entry)
    }
  }

  /**
   * Helper methods
   */
  
  getStorageDir(type) {
    switch (type) {
      case STORAGE_TYPE.CACHE:
        return this.config.cacheDir
      case STORAGE_TYPE.METADATA:
        return this.config.metadataDir
      case STORAGE_TYPE.INSTALLATION:
        return this.config.metadataDir
      case STORAGE_TYPE.SETTINGS:
        return this.config.metadataDir
      case STORAGE_TYPE.ANALYTICS:
        return this.config.metadataDir
      default:
        return this.config.cacheDir
    }
  }

  sanitizeKey(key) {
    return key.replace(/[^a-zA-Z0-9_-]/g, '_')
  }

  calculateSize(data) {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch (error) {
      return JSON.stringify(data).length
    }
  }

  isEntryExpired(entry) {
    if (entry.ttl === Infinity) return false
    return Date.now() > (entry.timestamp + entry.ttl)
  }

  updateStorageStats(size, operation) {
    if (operation === 'add') {
      this.storageStats.totalSize += size
      this.storageStats.cacheSize += size
    } else if (operation === 'remove') {
      this.storageStats.totalSize = Math.max(0, this.storageStats.totalSize - size)
      this.storageStats.cacheSize = Math.max(0, this.storageStats.cacheSize - size)
    }
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

  parseDateRange(range) {
    const now = Date.now()
    const match = range.match(/^(\d+)([hdwmy])$/)
    
    if (!match) return now - 30 * 24 * 60 * 60 * 1000 // Default to 30 days
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    const multipliers = {
      h: 60 * 60 * 1000,           // hours
      d: 24 * 60 * 60 * 1000,      // days
      w: 7 * 24 * 60 * 60 * 1000,  // weeks
      m: 30 * 24 * 60 * 60 * 1000, // months (approximate)
      y: 365 * 24 * 60 * 60 * 1000 // years (approximate)
    }
    
    return now - (value * multipliers[unit])
  }

  async compressData(data) {
    // TODO: Implement compression (could use lz-string or similar)
    return data
  }

  async decompressData(data) {
    // TODO: Implement decompression
    return data
  }

  async encryptData(data) {
    // TODO: Implement encryption
    return data
  }

  async decryptData(data) {
    // TODO: Implement decryption
    return data
  }

  async setupDirectories() {
    const home = await homeDir()
    this.config.storageDir = await join(home, '.lokus', 'registry')
    this.config.cacheDir = await join(this.config.storageDir, 'cache')
    this.config.metadataDir = await join(this.config.storageDir, 'metadata')

    for (const dir of [this.config.storageDir, this.config.cacheDir, this.config.metadataDir]) {
      if (!(await exists(dir))) {
        await createDir(dir, { recursive: true })
      }
    }
  }

  async loadStorageStats() {
    try {
      const statsPath = await join(this.config.storageDir, 'stats.json')
      
      if (await exists(statsPath)) {
        const content = await readTextFile(statsPath)
        const stats = JSON.parse(content)
        this.storageStats = { ...this.storageStats, ...stats }
      }
    } catch (error) {
      this.logger.warn('Failed to load storage stats:', error)
    }
  }

  async saveStorageStats() {
    try {
      const statsPath = await join(this.config.storageDir, 'stats.json')
      await writeTextFile(statsPath, JSON.stringify(this.storageStats, null, 2))
    } catch (error) {
      this.logger.warn('Failed to save storage stats:', error)
    }
  }

  async loadMetadata() {
    try {
      const metadataPath = await join(this.config.metadataDir, 'registry.json')
      
      if (await exists(metadataPath)) {
        const content = await readTextFile(metadataPath)
        const data = JSON.parse(content)
        this.metadata = new Map(Object.entries(data))
      }
    } catch (error) {
      this.logger.warn('Failed to load metadata:', error)
    }
  }

  async loadInstalledPlugins() {
    try {
      const pluginsPath = await join(this.config.metadataDir, 'installed_plugins.json')
      
      if (await exists(pluginsPath)) {
        const content = await readTextFile(pluginsPath)
        const data = JSON.parse(content)
        
        // Restore installed plugins
        if (data.plugins) {
          this.installedPlugins = new Map(Object.entries(data.plugins))
        }
        
        // Restore dependencies
        if (data.dependencies) {
          this.dependencies = new Map(Object.entries(data.dependencies))
        }
        
        // Rebuild search index
        await this.rebuildSearchIndex()
        
        this.storageStats.installedPlugins = this.installedPlugins.size
      }
    } catch (error) {
      this.logger.warn('Failed to load installed plugins:', error)
    }
  }

  async persistInstalledPlugins() {
    try {
      const pluginsPath = await join(this.config.metadataDir, 'installed_plugins.json')
      
      const data = {
        version: '1.0',
        lastUpdated: new Date().toISOString(),
        plugins: Object.fromEntries(this.installedPlugins),
        dependencies: Object.fromEntries(this.dependencies)
      }
      
      await writeTextFile(pluginsPath, JSON.stringify(data, null, 2))
    } catch (error) {
      this.logger.warn('Failed to persist installed plugins:', error)
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups()
      const backupsToDelete = backups.slice(this.config.backupRetention)
      
      for (const backup of backupsToDelete) {
        const backupPath = await join(this.config.storageDir, 'backups', `${backup.id}.json`)
        if (await exists(backupPath)) {
          await removeFile(backupPath)
        }
      }
    } catch (error) {
      this.logger.warn('Failed to cleanup old backups:', error)
    }
  }

  startCleanupTimer() {
    if (this.config.autoCleanup && !this.cleanupTimer) {
      this.cleanupTimer = setInterval(() => {
        this.cleanup().catch(error => 
          this.logger.error('Automatic cleanup failed:', error)
        )
      }, this.config.cleanupInterval)
    }
  }

  stopCleanupTimer() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = null
    }
  }

  /**
   * Public API
   */
  
  getStats() {
    return {
      ...this.storageStats,
      cacheEntries: this.cache.size,
      metadataEntries: this.metadata.size
    }
  }

  async optimize() {
    await this.cleanup()
    await this.createBackup()
    await this.saveStorageStats()
  }

  /**
   * Shutdown
   */
  async shutdown() {
    this.stopCleanupTimer()
    await this.persistAllEntries()
    await this.persistInstalledPlugins()
    await this.saveStorageStats()
    
    this.emit('shutdown')
    this.removeAllListeners()
  }
}

export default PluginStore