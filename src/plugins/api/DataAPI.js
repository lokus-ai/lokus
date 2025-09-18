/**
 * Data Provider API - Comprehensive interface for plugin data providers
 * 
 * This API enables plugins to provide alternative data sources, custom algorithms,
 * and enhanced functionality for all data-driven components in Lokus.
 * 
 * Supported Provider Types:
 * - Graph Renderers: Custom graph visualization and layout algorithms
 * - Kanban Providers: External task management systems (Jira, Trello, etc.)
 * - Search Providers: Enhanced search capabilities (semantic, external indexing)
 * - File System Providers: Cloud storage integration (Dropbox, Google Drive)
 * - Data Transform Providers: Custom data processing pipelines
 */

import { EventEmitter } from '../utils/EventEmitter.js'

/**
 * Base Data Provider Interface
 * All data providers must implement this interface
 */
export class BaseDataProvider extends EventEmitter {
  constructor(id, config = {}) {
    super()
    this.id = id
    this.config = config
    this.isConnected = false
    this.isEnabled = false
    this.cache = new Map()
    this.metrics = {
      requestCount: 0,
      errorCount: 0,
      lastRequestTime: null,
      averageResponseTime: 0
    }
    this.capabilities = new Set()
    this.dependencies = new Set()
  }

  /**
   * Initialize the provider (async setup, connection establishment)
   */
  async initialize() {
    throw new Error('initialize() must be implemented by data provider')
  }

  /**
   * Connect to the data source
   */
  async connect() {
    throw new Error('connect() must be implemented by data provider')
  }

  /**
   * Disconnect from the data source
   */
  async disconnect() {
    this.isConnected = false
    this.emit('disconnected')
  }

  /**
   * Check if provider is healthy and operational
   */
  async healthCheck() {
    return {
      connected: this.isConnected,
      enabled: this.isEnabled,
      lastError: this.lastError,
      metrics: this.metrics
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities() {
    return Array.from(this.capabilities)
  }

  /**
   * Get provider metadata
   */
  getMetadata() {
    return {
      id: this.id,
      type: this.constructor.name,
      version: this.config.version || '1.0.0',
      description: this.config.description || '',
      capabilities: this.getCapabilities(),
      dependencies: Array.from(this.dependencies),
      config: this.config
    }
  }

  /**
   * Update provider configuration
   */
  async updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
    this.emit('configUpdated', this.config)
  }

  /**
   * Get cached data if available
   */
  getFromCache(key) {
    const entry = this.cache.get(key)
    if (entry && entry.expiresAt > Date.now()) {
      return entry.data
    }
    return null
  }

  /**
   * Set data in cache with TTL
   */
  setCache(key, data, ttlMs = 300000) { // 5 minutes default
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now()
    })
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear()
  }

  /**
   * Track metrics for performance monitoring
   */
  _trackRequest(startTime, error = null) {
    const responseTime = Date.now() - startTime
    this.metrics.requestCount++
    this.metrics.lastRequestTime = Date.now()
    
    if (error) {
      this.metrics.errorCount++
      this.lastError = error
    }

    // Calculate moving average
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.requestCount - 1) + responseTime) / 
      this.metrics.requestCount
  }
}

/**
 * Graph Data Provider Interface
 * For custom graph visualization and layout algorithms
 */
export class GraphDataProvider extends BaseDataProvider {
  constructor(id, config = {}) {
    super(id, config)
    this.capabilities.add('graph-data')
    this.capabilities.add('graph-layout')
    this.supportedFormats = new Set(['graphology', 'cytoscape', 'd3', 'networkx'])
  }

  /**
   * Get graph data in specified format
   */
  async getGraphData(format = 'graphology', options = {}) {
    const startTime = Date.now()
    try {
      const cacheKey = `graph-${format}-${JSON.stringify(options)}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const data = await this._fetchGraphData(format, options)
      this.setCache(cacheKey, data)
      this._trackRequest(startTime)
      return data
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Apply custom layout algorithm
   */
  async applyLayout(graphData, algorithm = 'force-directed', options = {}) {
    const startTime = Date.now()
    try {
      const result = await this._applyLayoutAlgorithm(graphData, algorithm, options)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Get supported layout algorithms
   */
  getSupportedLayouts() {
    return ['force-directed', 'hierarchical', 'circular', 'grid', 'custom']
  }

  /**
   * Calculate graph metrics and statistics
   */
  async calculateMetrics(graphData, metrics = ['centrality', 'clustering', 'components']) {
    const startTime = Date.now()
    try {
      const result = await this._calculateGraphMetrics(graphData, metrics)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  // Abstract methods to be implemented by concrete providers
  async _fetchGraphData(format, options) {
    throw new Error('_fetchGraphData must be implemented')
  }

  async _applyLayoutAlgorithm(graphData, algorithm, options) {
    throw new Error('_applyLayoutAlgorithm must be implemented')
  }

  async _calculateGraphMetrics(graphData, metrics) {
    throw new Error('_calculateGraphMetrics must be implemented')
  }
}

/**
 * Kanban Data Provider Interface
 * For external task management systems integration
 */
export class KanbanDataProvider extends BaseDataProvider {
  constructor(id, config = {}) {
    super(id, config)
    this.capabilities.add('task-management')
    this.capabilities.add('board-sync')
    this.capabilities.add('real-time-updates')
  }

  /**
   * Get all boards/projects
   */
  async getBoards() {
    const startTime = Date.now()
    try {
      const cached = this.getFromCache('boards')
      if (cached) return cached

      const boards = await this._fetchBoards()
      this.setCache('boards', boards, 600000) // 10 minutes
      this._trackRequest(startTime)
      return boards
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Get tasks from a specific board
   */
  async getTasks(boardId, filters = {}) {
    const startTime = Date.now()
    try {
      const cacheKey = `tasks-${boardId}-${JSON.stringify(filters)}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const tasks = await this._fetchTasks(boardId, filters)
      this.setCache(cacheKey, tasks, 300000) // 5 minutes
      this._trackRequest(startTime)
      return tasks
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Create a new task
   */
  async createTask(boardId, taskData) {
    const startTime = Date.now()
    try {
      const task = await this._createTask(boardId, taskData)
      this.clearCache() // Invalidate cache
      this._trackRequest(startTime)
      this.emit('taskCreated', { boardId, task })
      return task
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Update an existing task
   */
  async updateTask(taskId, updates) {
    const startTime = Date.now()
    try {
      const task = await this._updateTask(taskId, updates)
      this.clearCache() // Invalidate cache
      this._trackRequest(startTime)
      this.emit('taskUpdated', { taskId, task, updates })
      return task
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId) {
    const startTime = Date.now()
    try {
      await this._deleteTask(taskId)
      this.clearCache() // Invalidate cache
      this._trackRequest(startTime)
      this.emit('taskDeleted', { taskId })
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Start real-time synchronization
   */
  async startSync() {
    if (this.capabilities.has('real-time-updates')) {
      await this._startRealTimeSync()
      this.emit('syncStarted')
    }
  }

  /**
   * Stop real-time synchronization
   */
  async stopSync() {
    await this._stopRealTimeSync()
    this.emit('syncStopped')
  }

  // Abstract methods to be implemented by concrete providers
  async _fetchBoards() {
    throw new Error('_fetchBoards must be implemented')
  }

  async _fetchTasks(boardId, filters) {
    throw new Error('_fetchTasks must be implemented')
  }

  async _createTask(boardId, taskData) {
    throw new Error('_createTask must be implemented')
  }

  async _updateTask(taskId, updates) {
    throw new Error('_updateTask must be implemented')
  }

  async _deleteTask(taskId) {
    throw new Error('_deleteTask must be implemented')
  }

  async _startRealTimeSync() {
    // Default implementation - can be overridden
  }

  async _stopRealTimeSync() {
    // Default implementation - can be overridden
  }
}

/**
 * Search Data Provider Interface
 * For enhanced search capabilities and external indexing
 */
export class SearchDataProvider extends BaseDataProvider {
  constructor(id, config = {}) {
    super(id, config)
    this.capabilities.add('text-search')
    this.capabilities.add('semantic-search')
    this.capabilities.add('external-indexing')
    this.searchTypes = new Set(['keyword', 'semantic', 'fuzzy', 'regex'])
  }

  /**
   * Search across indexed content
   */
  async search(query, options = {}) {
    const startTime = Date.now()
    try {
      const searchType = options.type || 'keyword'
      const cacheKey = `search-${searchType}-${query}-${JSON.stringify(options)}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const results = await this._performSearch(query, options)
      this.setCache(cacheKey, results, 120000) // 2 minutes
      this._trackRequest(startTime)
      return results
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Index content for searching
   */
  async indexContent(content, metadata = {}) {
    const startTime = Date.now()
    try {
      await this._indexContent(content, metadata)
      this._trackRequest(startTime)
      this.emit('contentIndexed', { metadata })
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Get search suggestions/autocomplete
   */
  async getSuggestions(partialQuery, limit = 10) {
    const startTime = Date.now()
    try {
      const suggestions = await this._getSuggestions(partialQuery, limit)
      this._trackRequest(startTime)
      return suggestions
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Get search analytics and metrics
   */
  async getSearchAnalytics(timeRange = '7d') {
    const startTime = Date.now()
    try {
      const analytics = await this._getSearchAnalytics(timeRange)
      this._trackRequest(startTime)
      return analytics
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Rebuild search index
   */
  async rebuildIndex() {
    const startTime = Date.now()
    try {
      await this._rebuildIndex()
      this._trackRequest(startTime)
      this.emit('indexRebuilt')
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  // Abstract methods to be implemented by concrete providers
  async _performSearch(query, options) {
    throw new Error('_performSearch must be implemented')
  }

  async _indexContent(content, metadata) {
    throw new Error('_indexContent must be implemented')
  }

  async _getSuggestions(partialQuery, limit) {
    throw new Error('_getSuggestions must be implemented')
  }

  async _getSearchAnalytics(timeRange) {
    throw new Error('_getSearchAnalytics must be implemented')
  }

  async _rebuildIndex() {
    throw new Error('_rebuildIndex must be implemented')
  }
}

/**
 * File System Data Provider Interface
 * For cloud storage and alternative file system backends
 */
export class FileSystemDataProvider extends BaseDataProvider {
  constructor(id, config = {}) {
    super(id, config)
    this.capabilities.add('file-operations')
    this.capabilities.add('directory-listing')
    this.capabilities.add('file-sync')
    this.supportedOperations = new Set(['read', 'write', 'delete', 'list', 'move', 'copy'])
  }

  /**
   * List files and directories
   */
  async listFiles(path = '/', options = {}) {
    const startTime = Date.now()
    try {
      const cacheKey = `list-${path}-${JSON.stringify(options)}`
      const cached = this.getFromCache(cacheKey)
      if (cached) return cached

      const files = await this._listFiles(path, options)
      this.setCache(cacheKey, files, 180000) // 3 minutes
      this._trackRequest(startTime)
      return files
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Read file content
   */
  async readFile(filePath) {
    const startTime = Date.now()
    try {
      const cached = this.getFromCache(`file-${filePath}`)
      if (cached) return cached

      const content = await this._readFile(filePath)
      this.setCache(`file-${filePath}`, content, 60000) // 1 minute
      this._trackRequest(startTime)
      return content
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Write file content
   */
  async writeFile(filePath, content, options = {}) {
    const startTime = Date.now()
    try {
      await this._writeFile(filePath, content, options)
      this.cache.delete(`file-${filePath}`) // Invalidate cache
      this._trackRequest(startTime)
      this.emit('fileWritten', { filePath, size: content.length })
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Delete file or directory
   */
  async deleteFile(filePath) {
    const startTime = Date.now()
    try {
      await this._deleteFile(filePath)
      this.cache.delete(`file-${filePath}`) // Invalidate cache
      this._trackRequest(startTime)
      this.emit('fileDeleted', { filePath })
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    const startTime = Date.now()
    try {
      const exists = await this._fileExists(filePath)
      this._trackRequest(startTime)
      return exists
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(filePath) {
    const startTime = Date.now()
    try {
      const metadata = await this._getFileMetadata(filePath)
      this._trackRequest(startTime)
      return metadata
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Start file synchronization
   */
  async startSync() {
    if (this.capabilities.has('file-sync')) {
      await this._startFileSync()
      this.emit('syncStarted')
    }
  }

  /**
   * Stop file synchronization
   */
  async stopSync() {
    await this._stopFileSync()
    this.emit('syncStopped')
  }

  // Abstract methods to be implemented by concrete providers
  async _listFiles(path, options) {
    throw new Error('_listFiles must be implemented')
  }

  async _readFile(filePath) {
    throw new Error('_readFile must be implemented')
  }

  async _writeFile(filePath, content, options) {
    throw new Error('_writeFile must be implemented')
  }

  async _deleteFile(filePath) {
    throw new Error('_deleteFile must be implemented')
  }

  async _fileExists(filePath) {
    throw new Error('_fileExists must be implemented')
  }

  async _getFileMetadata(filePath) {
    throw new Error('_getFileMetadata must be implemented')
  }

  async _startFileSync() {
    // Default implementation - can be overridden
  }

  async _stopFileSync() {
    // Default implementation - can be overridden
  }
}

/**
 * Data Transform Provider Interface
 * For custom data processing and transformation pipelines
 */
export class DataTransformProvider extends BaseDataProvider {
  constructor(id, config = {}) {
    super(id, config)
    this.capabilities.add('data-transform')
    this.capabilities.add('data-validation')
    this.capabilities.add('data-enrichment')
    this.supportedFormats = new Set(['json', 'csv', 'xml', 'yaml', 'markdown'])
  }

  /**
   * Transform data from one format to another
   */
  async transform(data, fromFormat, toFormat, options = {}) {
    const startTime = Date.now()
    try {
      const result = await this._transformData(data, fromFormat, toFormat, options)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Validate data against schema
   */
  async validate(data, schema, options = {}) {
    const startTime = Date.now()
    try {
      const result = await this._validateData(data, schema, options)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Enrich data with additional information
   */
  async enrich(data, enrichmentRules = []) {
    const startTime = Date.now()
    try {
      const result = await this._enrichData(data, enrichmentRules)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  /**
   * Process data through pipeline
   */
  async pipeline(data, steps = []) {
    const startTime = Date.now()
    try {
      const result = await this._processPipeline(data, steps)
      this._trackRequest(startTime)
      return result
    } catch (error) {
      this._trackRequest(startTime, error)
      throw error
    }
  }

  // Abstract methods to be implemented by concrete providers
  async _transformData(data, fromFormat, toFormat, options) {
    throw new Error('_transformData must be implemented')
  }

  async _validateData(data, schema, options) {
    throw new Error('_validateData must be implemented')
  }

  async _enrichData(data, enrichmentRules) {
    throw new Error('_enrichData must be implemented')
  }

  async _processPipeline(data, steps) {
    throw new Error('_processPipeline must be implemented')
  }
}

/**
 * Data Provider Factory
 * Creates appropriate provider instances based on type
 */
export class DataProviderFactory {
  static create(type, id, config = {}) {
    switch (type) {
      case 'graph':
        return new GraphDataProvider(id, config)
      case 'kanban':
        return new KanbanDataProvider(id, config)
      case 'search':
        return new SearchDataProvider(id, config)
      case 'filesystem':
        return new FileSystemDataProvider(id, config)
      case 'transform':
        return new DataTransformProvider(id, config)
      default:
        throw new Error(`Unknown data provider type: ${type}`)
    }
  }

  static getSupportedTypes() {
    return ['graph', 'kanban', 'search', 'filesystem', 'transform']
  }
}

// Export all classes and interfaces
export {
  BaseDataProvider,
  GraphDataProvider,
  KanbanDataProvider,
  SearchDataProvider,
  FileSystemDataProvider,
  DataTransformProvider,
  DataProviderFactory
}