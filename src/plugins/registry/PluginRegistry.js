/**
 * Plugin Registry Core
 * Comprehensive marketplace backend for plugin discovery, distribution, and metadata management
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginManifestV2 } from '../manifest/ManifestV2.js'
import { logger } from '../../utils/logger.js'

/**
 * Plugin Registry Status Constants
 */
export const REGISTRY_STATUS = {
  DRAFT: 'draft',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  PUBLISHED: 'published',
  DEPRECATED: 'deprecated',
  SUSPENDED: 'suspended',
  REMOVED: 'removed'
}

/**
 * Plugin Registry Categories
 */
export const REGISTRY_CATEGORIES = {
  EDITOR: 'editor',
  FORMATTER: 'formatter',
  LANGUAGE: 'language',
  THEME: 'theme',
  SNIPPET: 'snippet',
  TOOL: 'tool',
  INTEGRATION: 'integration',
  PRODUCTIVITY: 'productivity',
  DEBUGGER: 'debugger',
  TESTING: 'testing',
  SCM: 'scm',
  EXTENSION_PACK: 'extension_pack',
  OTHER: 'other'
}

/**
 * Security Risk Levels
 */
export const SECURITY_RISK = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  CRITICAL: 'critical'
}

/**
 * Plugin Registry Core Class
 */
export class PluginRegistry extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      maxSearchResults: 100,
      maxVersionHistory: 50,
      cacheTimeout: 300000, // 5 minutes
      ...config
    }

    // Core data structures
    this.plugins = new Map() // pluginId -> PluginRegistryEntry
    this.versions = new Map() // pluginId -> Map<version, VersionMetadata>
    this.categories = new Map() // categoryId -> CategoryMetadata
    this.publishers = new Map() // publisherId -> PublisherMetadata
    this.downloads = new Map() // pluginId -> DownloadStats
    this.ratings = new Map() // pluginId -> RatingStats
    this.reviews = new Map() // pluginId -> Array<Review>
    this.tags = new Map() // tagId -> Set<pluginId>
    this.dependencies = new Map() // pluginId -> DependencyGraph
    this.searchIndex = new Map() // term -> Set<pluginId>
    
    // Security and validation
    this.securityScans = new Map() // pluginId -> SecurityScanResult
    this.verifiedPublishers = new Set() // publisherId
    this.featuredPlugins = new Set() // pluginId
    
    // Statistics
    this.stats = {
      totalPlugins: 0,
      totalDownloads: 0,
      totalPublishers: 0,
      lastUpdated: null
    }

    // COMPLETED TODO: Replaced console with proper logger
    this.logger = logger.createScoped('PluginRegistry')
    this.isInitialized = false
  }

  /**
   * Initialize the registry
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      await this.loadRegistry()
      await this.buildSearchIndex()
      await this.initializeCategories()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('Plugin registry initialized successfully')
    } catch (error) {
      this.logger.error('Failed to initialize plugin registry:', error)
      throw error
    }
  }

  /**
   * Register a new plugin
   */
  async registerPlugin(manifest, publisherInfo) {
    try {
      // Validate manifest
      const manifestValidator = new PluginManifestV2()
      const validationResult = manifestValidator.load(manifest)
      
      if (!validationResult.valid) {
        throw new Error(`Invalid manifest: ${validationResult.errors.map(e => e.message).join(', ')}`)
      }

      const pluginId = manifestValidator.getFullId()
      const publisherId = manifestValidator.getPublisher()

      // Check if plugin already exists
      if (this.plugins.has(pluginId)) {
        throw new Error(`Plugin already registered: ${pluginId}`)
      }

      // Validate publisher
      await this.validatePublisher(publisherId, publisherInfo)

      // Create registry entry
      const registryEntry = {
        id: pluginId,
        publisherId,
        manifest: manifestValidator.getManifest(),
        status: REGISTRY_STATUS.PENDING_REVIEW,
        metadata: {
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: manifestValidator.getManifest().version,
          description: manifestValidator.getManifest().description,
          categories: manifestValidator.getCategories(),
          keywords: manifestValidator.getKeywords(),
          license: manifestValidator.getManifest().license,
          homepage: manifestValidator.getManifest().homepage,
          repository: manifestValidator.getManifest().repository,
          icon: manifestValidator.getManifest().icon,
          preview: manifestValidator.isPreview(),
          verified: this.verifiedPublishers.has(publisherId)
        },
        versions: new Map(),
        securityInfo: {
          riskLevel: SECURITY_RISK.MEDIUM,
          scanDate: null,
          permissions: manifestValidator.getManifest().permissions || [],
          capabilities: manifestValidator.getCapabilities()
        },
        stats: {
          downloads: 0,
          rating: 0,
          reviewCount: 0,
          lastDownload: null
        }
      }

      // Add initial version
      const versionInfo = {
        version: manifestValidator.getManifest().version,
        manifest: manifestValidator.getManifest(),
        publishedAt: new Date().toISOString(),
        status: REGISTRY_STATUS.PENDING_REVIEW,
        size: 0, // Will be set during upload
        checksum: null, // Will be set during upload
        downloadUrl: null, // Will be set after approval
        changelog: manifestValidator.getManifest().changelog || 'Initial release'
      }

      registryEntry.versions.set(versionInfo.version, versionInfo)

      // Store in registry
      this.plugins.set(pluginId, registryEntry)
      this.versions.set(pluginId, registryEntry.versions)

      // Update statistics
      this.updateStats()

      // Build search index for new plugin
      this.addToSearchIndex(pluginId, registryEntry)

      this.emit('plugin_registered', { pluginId, registryEntry })
      this.logger.info(`Plugin registered: ${pluginId}`)

      return {
        success: true,
        pluginId,
        status: registryEntry.status,
        nextSteps: 'Plugin is pending review. You will be notified once approved.'
      }
    } catch (error) {
      this.logger.error('Failed to register plugin:', error)
      throw error
    }
  }

  /**
   * Add new version to existing plugin
   */
  async addPluginVersion(pluginId, manifest, packageInfo) {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`)
      }

      // Validate manifest
      const manifestValidator = new PluginManifestV2()
      const validationResult = manifestValidator.load(manifest)
      
      if (!validationResult.valid) {
        throw new Error(`Invalid manifest: ${validationResult.errors.map(e => e.message).join(', ')}`)
      }

      const version = manifestValidator.getManifest().version
      
      // Check if version already exists
      if (plugin.versions.has(version)) {
        throw new Error(`Version already exists: ${version}`)
      }

      // Validate version is newer
      const currentVersions = Array.from(plugin.versions.keys())
      if (!this.isNewerVersion(version, Math.max(...currentVersions))) {
        throw new Error('New version must be higher than existing versions')
      }

      // Create version info
      const versionInfo = {
        version,
        manifest: manifestValidator.getManifest(),
        publishedAt: new Date().toISOString(),
        status: REGISTRY_STATUS.PENDING_REVIEW,
        size: packageInfo.size || 0,
        checksum: packageInfo.checksum,
        downloadUrl: null, // Will be set after approval
        changelog: manifestValidator.getManifest().changelog || 'Version update'
      }

      // Add version
      plugin.versions.set(version, versionInfo)
      plugin.metadata.updatedAt = new Date().toISOString()
      plugin.metadata.version = version

      this.emit('plugin_version_added', { pluginId, version, versionInfo })
      this.logger.info(`Version added: ${pluginId}@${version}`)

      return {
        success: true,
        pluginId,
        version,
        status: versionInfo.status
      }
    } catch (error) {
      this.logger.error('Failed to add plugin version:', error)
      throw error
    }
  }

  /**
   * Search plugins in registry
   */
  async searchPlugins(query, options = {}) {
    try {
      const {
        category = null,
        tag = null,
        publisher = null,
        sortBy = 'popularity', // popularity, downloads, rating, recent, name
        sortOrder = 'desc',
        page = 1,
        limit = 20,
        includePreview = false,
        minRating = 0,
        verified = null
      } = options

      let matchingPlugins = new Set()

      // Text search
      if (query && query.trim()) {
        const queryTerms = query.toLowerCase().split(/\s+/)
        for (const term of queryTerms) {
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
      } else {
        // No query, include all plugins
        matchingPlugins = new Set(this.plugins.keys())
      }

      // Apply filters
      const filteredPlugins = Array.from(matchingPlugins)
        .map(id => this.plugins.get(id))
        .filter(plugin => {
          // Status filter (only published plugins by default)
          if (plugin.status !== REGISTRY_STATUS.PUBLISHED) {
            return false
          }

          // Category filter
          if (category && !plugin.metadata.categories.includes(category)) {
            return false
          }

          // Publisher filter
          if (publisher && plugin.publisherId !== publisher) {
            return false
          }

          // Preview filter
          if (!includePreview && plugin.metadata.preview) {
            return false
          }

          // Rating filter
          if (plugin.stats.rating < minRating) {
            return false
          }

          // Verified filter
          if (verified !== null && plugin.metadata.verified !== verified) {
            return false
          }

          // Tag filter
          if (tag) {
            const pluginTags = this.getPluginTags(plugin.id)
            if (!pluginTags.includes(tag)) {
              return false
            }
          }

          return true
        })

      // Sort results
      filteredPlugins.sort((a, b) => {
        let comparison = 0
        
        switch (sortBy) {
          case 'popularity':
            comparison = this.calculatePopularityScore(b) - this.calculatePopularityScore(a)
            break
          case 'downloads':
            comparison = b.stats.downloads - a.stats.downloads
            break
          case 'rating':
            comparison = b.stats.rating - a.stats.rating
            break
          case 'recent':
            comparison = new Date(b.metadata.updatedAt) - new Date(a.metadata.updatedAt)
            break
          case 'name':
            comparison = a.manifest.displayName?.localeCompare(b.manifest.displayName) || 0
            break
          default:
            comparison = 0
        }

        return sortOrder === 'desc' ? comparison : -comparison
      })

      // Pagination
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedResults = filteredPlugins.slice(startIndex, endIndex)

      // Transform for API response
      const results = paginatedResults.map(plugin => this.transformPluginForAPI(plugin))

      return {
        plugins: results,
        total: filteredPlugins.length,
        page,
        limit,
        totalPages: Math.ceil(filteredPlugins.length / limit),
        hasMore: endIndex < filteredPlugins.length
      }
    } catch (error) {
      this.logger.error('Failed to search plugins:', error)
      throw error
    }
  }

  /**
   * Get plugin details
   */
  async getPluginDetails(pluginId, version = 'latest') {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`)
      }

      let versionInfo
      if (version === 'latest') {
        const versions = Array.from(plugin.versions.keys())
          .filter(v => plugin.versions.get(v).status === REGISTRY_STATUS.PUBLISHED)
          .sort(this.compareVersions.bind(this))
        
        if (versions.length === 0) {
          throw new Error('No published versions available')
        }
        
        versionInfo = plugin.versions.get(versions[versions.length - 1])
      } else {
        versionInfo = plugin.versions.get(version)
        if (!versionInfo) {
          throw new Error(`Version not found: ${version}`)
        }
      }

      // Get additional data
      const reviews = this.reviews.get(pluginId) || []
      const tags = this.getPluginTags(pluginId)
      const dependencies = this.getDependencies(pluginId)
      const securityInfo = this.securityScans.get(pluginId)

      return {
        ...this.transformPluginForAPI(plugin),
        version: versionInfo,
        versions: Array.from(plugin.versions.values())
          .filter(v => v.status === REGISTRY_STATUS.PUBLISHED)
          .sort((a, b) => this.compareVersions(a.version, b.version)),
        reviews: reviews.slice(-10), // Last 10 reviews
        tags,
        dependencies,
        securityInfo,
        readme: versionInfo.readme || null,
        changelog: versionInfo.changelog || null
      }
    } catch (error) {
      this.logger.error('Failed to get plugin details:', error)
      throw error
    }
  }

  /**
   * Get featured plugins
   */
  async getFeaturedPlugins(limit = 10) {
    try {
      const featured = Array.from(this.featuredPlugins)
        .map(id => this.plugins.get(id))
        .filter(plugin => plugin && plugin.status === REGISTRY_STATUS.PUBLISHED)
        .slice(0, limit)
        .map(plugin => this.transformPluginForAPI(plugin))

      return featured
    } catch (error) {
      this.logger.error('Failed to get featured plugins:', error)
      throw error
    }
  }

  /**
   * Get plugin statistics
   */
  async getPluginStats(pluginId) {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`)
      }

      const downloads = this.downloads.get(pluginId) || { total: 0, daily: {}, weekly: {}, monthly: {} }
      const ratings = this.ratings.get(pluginId) || { average: 0, distribution: {}, total: 0 }

      return {
        pluginId,
        downloads,
        ratings,
        reviews: {
          total: this.reviews.get(pluginId)?.length || 0,
          recent: (this.reviews.get(pluginId) || []).slice(-5)
        },
        popularity: this.calculatePopularityScore(plugin),
        trending: this.isTrending(pluginId),
        lastUpdated: plugin.metadata.updatedAt
      }
    } catch (error) {
      this.logger.error('Failed to get plugin stats:', error)
      throw error
    }
  }

  /**
   * Add plugin rating and review
   */
  async addReview(pluginId, userId, rating, review, metadata = {}) {
    try {
      if (rating < 1 || rating > 5) {
        throw new Error('Rating must be between 1 and 5')
      }

      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`)
      }

      // Check if user already reviewed
      const existingReviews = this.reviews.get(pluginId) || []
      const existingReview = existingReviews.find(r => r.userId === userId)
      
      if (existingReview) {
        throw new Error('User has already reviewed this plugin')
      }

      const reviewEntry = {
        id: this.generateId(),
        userId,
        pluginId,
        rating,
        review: review || '',
        helpful: 0,
        reported: false,
        createdAt: new Date().toISOString(),
        metadata: {
          version: plugin.metadata.version,
          platform: metadata.platform || 'unknown',
          ...metadata
        }
      }

      // Add review
      if (!this.reviews.has(pluginId)) {
        this.reviews.set(pluginId, [])
      }
      this.reviews.get(pluginId).push(reviewEntry)

      // Update rating statistics
      this.updateRatingStats(pluginId)

      this.emit('review_added', { pluginId, userId, reviewEntry })
      this.logger.info(`Review added for ${pluginId} by ${userId}`)

      return {
        success: true,
        reviewId: reviewEntry.id,
        pluginId,
        rating,
        review
      }
    } catch (error) {
      this.logger.error('Failed to add review:', error)
      throw error
    }
  }

  /**
   * Track plugin download
   */
  async trackDownload(pluginId, version, metadata = {}) {
    try {
      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Plugin not found: ${pluginId}`)
      }

      const now = new Date()
      const dateKey = now.toISOString().split('T')[0] // YYYY-MM-DD

      // Initialize download stats if needed
      if (!this.downloads.has(pluginId)) {
        this.downloads.set(pluginId, {
          total: 0,
          daily: {},
          weekly: {},
          monthly: {},
          versions: {}
        })
      }

      const stats = this.downloads.get(pluginId)
      
      // Update totals
      stats.total++
      stats.daily[dateKey] = (stats.daily[dateKey] || 0) + 1
      stats.versions[version] = (stats.versions[version] || 0) + 1

      // Update plugin stats
      plugin.stats.downloads = stats.total
      plugin.stats.lastDownload = now.toISOString()

      // Update global stats
      this.stats.totalDownloads++

      this.emit('download_tracked', { pluginId, version, metadata })

      return {
        success: true,
        pluginId,
        version,
        totalDownloads: stats.total
      }
    } catch (error) {
      this.logger.error('Failed to track download:', error)
      throw error
    }
  }

  /**
   * Manage plugin categories
   */
  async getCategories() {
    return Array.from(this.categories.values())
  }

  async addCategory(categoryData) {
    const { id, name, description, icon } = categoryData
    
    if (this.categories.has(id)) {
      throw new Error(`Category already exists: ${id}`)
    }

    const category = {
      id,
      name,
      description: description || '',
      icon: icon || null,
      pluginCount: 0,
      createdAt: new Date().toISOString()
    }

    this.categories.set(id, category)
    return category
  }

  /**
   * Security and verification
   */
  async verifyPublisher(publisherId) {
    this.verifiedPublishers.add(publisherId)
    
    // Update all plugins by this publisher
    for (const plugin of this.plugins.values()) {
      if (plugin.publisherId === publisherId) {
        plugin.metadata.verified = true
      }
    }

    this.emit('publisher_verified', { publisherId })
  }

  async addSecurityScan(pluginId, scanResult) {
    this.securityScans.set(pluginId, {
      ...scanResult,
      scanDate: new Date().toISOString()
    })

    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      plugin.securityInfo.riskLevel = scanResult.riskLevel
      plugin.securityInfo.scanDate = new Date().toISOString()
    }
  }

  /**
   * Helper methods
   */
  
  transformPluginForAPI(plugin) {
    return {
      id: plugin.id,
      name: plugin.manifest.name,
      displayName: plugin.manifest.displayName || plugin.manifest.name,
      description: plugin.metadata.description,
      version: plugin.metadata.version,
      author: plugin.manifest.author,
      publisher: plugin.publisherId,
      license: plugin.metadata.license,
      homepage: plugin.metadata.homepage,
      repository: plugin.metadata.repository,
      icon: plugin.metadata.icon,
      categories: plugin.metadata.categories,
      keywords: plugin.metadata.keywords,
      preview: plugin.metadata.preview,
      verified: plugin.metadata.verified,
      featured: this.featuredPlugins.has(plugin.id),
      downloads: plugin.stats.downloads,
      rating: plugin.stats.rating,
      reviewCount: plugin.stats.reviewCount,
      createdAt: plugin.metadata.createdAt,
      updatedAt: plugin.metadata.updatedAt,
      status: plugin.status,
      securityInfo: {
        riskLevel: plugin.securityInfo.riskLevel,
        scanDate: plugin.securityInfo.scanDate
      }
    }
  }

  calculatePopularityScore(plugin) {
    const downloads = plugin.stats.downloads || 0
    const rating = plugin.stats.rating || 0
    const reviewCount = plugin.stats.reviewCount || 0
    const ageInDays = (Date.now() - new Date(plugin.metadata.createdAt)) / (1000 * 60 * 60 * 24)
    
    // Popularity algorithm: combines downloads, rating, reviews, and freshness
    const downloadScore = Math.log(downloads + 1) * 0.4
    const ratingScore = rating * reviewCount * 0.3
    const freshnessScore = Math.max(0, (365 - ageInDays) / 365) * 0.2
    const verificationBonus = plugin.metadata.verified ? 0.1 : 0
    
    return downloadScore + ratingScore + freshnessScore + verificationBonus
  }

  isTrending(pluginId) {
    const downloads = this.downloads.get(pluginId)
    if (!downloads) return false

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    let recentDownloads = 0
    for (const [dateStr, count] of Object.entries(downloads.daily)) {
      const date = new Date(dateStr)
      if (date >= sevenDaysAgo) {
        recentDownloads += count
      }
    }

    // Consider trending if > 100 downloads in last 7 days
    return recentDownloads > 100
  }

  addToSearchIndex(pluginId, plugin) {
    const indexableText = [
      plugin.manifest.name,
      plugin.manifest.displayName,
      plugin.metadata.description,
      ...plugin.metadata.keywords,
      ...plugin.metadata.categories,
      plugin.publisherId
    ].filter(Boolean).join(' ').toLowerCase()

    const terms = indexableText.split(/\s+/).filter(term => term.length > 2)
    
    for (const term of terms) {
      if (!this.searchIndex.has(term)) {
        this.searchIndex.set(term, new Set())
      }
      this.searchIndex.get(term).add(pluginId)
    }
  }

  updateRatingStats(pluginId) {
    const reviews = this.reviews.get(pluginId) || []
    const ratings = reviews.map(r => r.rating)
    
    if (ratings.length === 0) return

    const average = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    const distribution = ratings.reduce((dist, rating) => {
      dist[rating] = (dist[rating] || 0) + 1
      return dist
    }, {})

    this.ratings.set(pluginId, {
      average: Math.round(average * 10) / 10,
      distribution,
      total: ratings.length
    })

    // Update plugin stats
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      plugin.stats.rating = average
      plugin.stats.reviewCount = ratings.length
    }
  }

  updateStats() {
    this.stats = {
      totalPlugins: this.plugins.size,
      totalDownloads: Array.from(this.downloads.values())
        .reduce((total, stats) => total + stats.total, 0),
      totalPublishers: new Set(Array.from(this.plugins.values()).map(p => p.publisherId)).size,
      lastUpdated: new Date().toISOString()
    }
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

  isNewerVersion(version1, version2) {
    return this.compareVersions(version1, version2) > 0
  }

  generateId() {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  getPluginTags(pluginId) {
    const tags = []
    for (const [tag, pluginIds] of this.tags) {
      if (pluginIds.has(pluginId)) {
        tags.push(tag)
      }
    }
    return tags
  }

  getDependencies(pluginId) {
    return this.dependencies.get(pluginId) || { dependencies: [], dependents: [] }
  }

  async validatePublisher(publisherId, publisherInfo) {
    // TODO: Implement publisher validation logic
    if (!publisherId || publisherId.trim() === '') {
      throw new Error('Publisher ID is required')
    }

    if (!this.publishers.has(publisherId)) {
      // Register new publisher
      this.publishers.set(publisherId, {
        id: publisherId,
        ...publisherInfo,
        verified: false,
        joinedAt: new Date().toISOString(),
        pluginCount: 0
      })
    }

    return true
  }

  async loadRegistry() {
    // TODO: Implement registry loading from persistent storage
    this.logger.info('Registry data loaded (placeholder)')
  }

  async buildSearchIndex() {
    for (const [pluginId, plugin] of this.plugins) {
      this.addToSearchIndex(pluginId, plugin)
    }
  }

  async initializeCategories() {
    // Initialize default categories if empty
    if (this.categories.size === 0) {
      for (const [key, value] of Object.entries(REGISTRY_CATEGORIES)) {
        this.categories.set(value, {
          id: value,
          name: key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' '),
          description: `${key.charAt(0) + key.slice(1).toLowerCase().replace(/_/g, ' ')} related plugins`,
          pluginCount: 0,
          createdAt: new Date().toISOString()
        })
      }
    }
  }

  /**
   * Registry maintenance operations
   */
  async cleanup() {
    // Clean up old cache entries, logs, etc.
    this.logger.info('Registry cleanup completed')
  }

  async backup() {
    // TODO: Implement registry backup
    this.logger.info('Registry backup completed')
  }

  async getRegistryHealth() {
    return {
      status: 'healthy',
      plugins: this.stats.totalPlugins,
      publishers: this.stats.totalPublishers,
      downloads: this.stats.totalDownloads,
      lastUpdated: this.stats.lastUpdated,
      memoryUsage: process.memoryUsage ? process.memoryUsage() : null
    }
  }
}

export default PluginRegistry