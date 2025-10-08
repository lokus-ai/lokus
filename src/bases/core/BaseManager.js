/**
 * Base Manager
 * Manages .base files with create, read, update, delete operations
 * Handles file I/O using Tauri commands and provides high-level base management
 */

import { invoke } from '@tauri-apps/api/core'
import { baseParser } from './BaseParser.js'
import { baseValidator } from './BaseValidator.js'
import { DEFAULT_BASE_TEMPLATE, VIEW_TYPES } from './BaseSchema.js'
import { joinPath, normalizePath } from '../../utils/pathUtils.js'

/**
 * Main BaseManager class
 */
export class BaseManager {
  constructor() {
    this.listeners = new Set()
    this.cache = new Map()
    this.activeQueries = new Map()
    this.basesIndex = new Map() // baseId -> base metadata
  }

  /**
   * Add a change listener
   */
  addListener(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Notify all listeners of changes
   */
  notifyListeners(event) {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('Base listener error:', error)
      }
    })
  }

  /**
   * Create a new base file
   */
  async createBase(name, options = {}) {
    try {
      // Validate input
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new Error('Base name is required')
      }

      // Create base definition
      const baseDefinition = {
        ...DEFAULT_BASE_TEMPLATE,
        name: name.trim(),
        description: options.description || '',
        source: options.source || DEFAULT_BASE_TEMPLATE.source,
        properties: options.properties || DEFAULT_BASE_TEMPLATE.properties,
        views: options.views || DEFAULT_BASE_TEMPLATE.views,
        settings: options.settings || DEFAULT_BASE_TEMPLATE.settings,
        created: new Date().toISOString(),
        modified: new Date().toISOString()
      }

      // Validate base definition
      const validation = baseValidator.validateBase(baseDefinition)
      if (!validation.isValid) {
        throw new ValidationError('Base validation failed', validation.errors)
      }

      // Generate file path
      const fileName = this.sanitizeFileName(name) + '.base'
      const basePath = options.path || await this.getBasesDirectory()
      
      // Ensure the bases directory exists
      await this.ensureBasesDirectory(basePath)
      
      const fullPath = await this.resolvePath(basePath, fileName)

      // Check if file already exists
      const exists = await this.fileExists(fullPath)
      if (exists && !options.overwrite) {
        throw new Error(`Base file already exists: ${fileName}`)
      }

      // Convert to YAML content
      const stringifyResult = baseParser.stringify(baseDefinition, {
        addHeader: true,
        validate: false // Already validated above
      })

      if (!stringifyResult.success) {
        throw new Error(`Failed to serialize base: ${stringifyResult.error}`)
      }

      // Save to file
      await invoke('write_file', {
        path: fullPath,
        content: stringifyResult.content
      })

      // Generate base ID and update cache
      const baseId = this.generateBaseId(fullPath)
      const baseMetadata = {
        id: baseId,
        name: baseDefinition.name,
        path: fullPath,
        fileName,
        created: baseDefinition.created,
        modified: baseDefinition.modified,
        sourceType: baseDefinition.source.type,
        propertyCount: Object.keys(baseDefinition.properties).length,
        viewCount: Object.keys(baseDefinition.views).length
      }

      // Update index and cache
      this.basesIndex.set(baseId, baseMetadata)
      this.cache.set(baseId, baseDefinition)

      // Notify listeners
      this.notifyListeners({
        type: 'base_created',
        baseId,
        base: baseDefinition,
        metadata: baseMetadata
      })

      return {
        success: true,
        baseId,
        path: fullPath,
        base: baseDefinition,
        metadata: baseMetadata
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        validationResult: error.validationResult || null
      }
    }
  }

  /**
   * Load a base file
   */
  async loadBase(basePath, options = {}) {
    try {
      const baseId = this.generateBaseId(basePath)

      // Check cache first
      if (!options.forceRefresh && this.cache.has(baseId)) {
        const cached = this.cache.get(baseId)
        return {
          success: true,
          baseId,
          base: cached,
          metadata: this.basesIndex.get(baseId),
          fromCache: true
        }
      }

      // Check if file exists
      const exists = await this.fileExists(basePath)
      if (!exists) {
        console.error('❌ Base file not found at path:', basePath)
        throw new Error(`Base file not found: ${basePath}`)
      }

      // Read file content
      const content = await invoke('read_file_content', { path: basePath })

      // Parse content
      const parseResult = baseParser.parse(content, {
        validate: false // Temporarily disable validation to test the UI
      })

      if (!parseResult.success) {
        console.error('❌ Parse failed:', parseResult.error)
        throw new ParseError(parseResult.error, parseResult.line, parseResult.column)
      }

      const baseDefinition = parseResult.data
      const metadata = {
        id: baseId,
        name: baseDefinition.name,
        path: basePath,
        fileName: this.extractFileName(basePath),
        created: baseDefinition.created,
        modified: baseDefinition.modified,
        sourceType: baseDefinition.source.type,
        propertyCount: Object.keys(baseDefinition.properties || {}).length,
        viewCount: Object.keys(baseDefinition.views || {}).length,
        views: baseDefinition.views, // Include the actual views
        properties: baseDefinition.properties, // Include properties too
        ...parseResult.metadata
      }

      // Update cache and index
      this.cache.set(baseId, baseDefinition)
      this.basesIndex.set(baseId, metadata)

      // Notify listeners
      this.notifyListeners({
        type: 'base_loaded',
        baseId,
        base: baseDefinition,
        metadata
      })

      return {
        success: true,
        baseId,
        base: baseDefinition,
        metadata,
        warnings: parseResult.warnings,
        fromCache: false
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        line: error.line || null,
        column: error.column || null
      }
    }
  }

  /**
   * Save a base file
   */
  async saveBase(baseId, baseDefinition, options = {}) {
    try {
      // Get base metadata
      const metadata = this.basesIndex.get(baseId)
      if (!metadata) {
        throw new Error(`Base not found: ${baseId}`)
      }

      // Update modified timestamp
      baseDefinition.modified = new Date().toISOString()

      // Validate if requested
      if (options.validate !== false) {
        const validation = baseValidator.validateBase(baseDefinition)
        if (!validation.isValid) {
          throw new ValidationError('Base validation failed', validation.errors)
        }
      }

      // Create backup if requested
      if (options.createBackup) {
        await this.createBackup(metadata.path)
      }

      // Convert to YAML
      const stringifyResult = baseParser.stringify(baseDefinition, {
        addHeader: options.addHeader !== false,
        validate: false // Already validated above
      })

      if (!stringifyResult.success) {
        throw new Error(`Failed to serialize base: ${stringifyResult.error}`)
      }

      // Write to file
      await invoke('write_file', {
        path: metadata.path,
        content: stringifyResult.content
      })

      // Update cache and metadata
      this.cache.set(baseId, baseDefinition)
      metadata.modified = baseDefinition.modified
      metadata.name = baseDefinition.name
      metadata.sourceType = baseDefinition.source.type
      metadata.propertyCount = Object.keys(baseDefinition.properties || {}).length
      metadata.viewCount = Object.keys(baseDefinition.views || {}).length

      // Notify listeners
      this.notifyListeners({
        type: 'base_saved',
        baseId,
        base: baseDefinition,
        metadata,
        path: metadata.path
      })

      return {
        success: true,
        baseId,
        base: baseDefinition,
        metadata,
        warnings: stringifyResult.warnings
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name,
        validationResult: error.validationResult || null
      }
    }
  }

  /**
   * Delete a base file
   */
  async deleteBase(baseId, options = {}) {
    try {
      const metadata = this.basesIndex.get(baseId)
      if (!metadata) {
        throw new Error(`Base not found: ${baseId}`)
      }

      // Create backup before deletion if requested
      if (options.createBackup !== false) {
        await this.createBackup(metadata.path)
      }

      // Confirm deletion if requested
      if (options.confirm && typeof options.confirm === 'function') {
        const confirmed = await options.confirm(metadata)
        if (!confirmed) {
          return {
            success: false,
            error: 'Deletion cancelled by user',
            errorType: 'UserCancellation'
          }
        }
      }

      // Delete file
      await invoke('delete_file', { path: metadata.path })

      // Remove from cache and index
      this.cache.delete(baseId)
      this.basesIndex.delete(baseId)

      // Notify listeners
      this.notifyListeners({
        type: 'base_deleted',
        baseId,
        metadata,
        path: metadata.path
      })

      return {
        success: true,
        baseId,
        deletedPath: metadata.path
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * List all bases in a directory
   */
  async listBases(directory = null, options = {}) {
    try {
      const basesDir = directory ? joinPath(directory, '.lokus', 'bases') : await this.getBasesDirectory(directory)

      // Ensure the bases directory exists
      await this.ensureBasesDirectory(basesDir)

      // Get all .base files in directory
      const allFiles = await invoke('read_workspace_files', { workspacePath: basesDir })

      const files = allFiles
        .filter(file => file.name.endsWith('.base'))
        .map(file => file.path)


      const bases = []

      // Load metadata for each base
      for (const filePath of files) {
        const baseId = this.generateBaseId(filePath)

        // Try to get from cache first
        let metadata = this.basesIndex.get(baseId)

        if (!metadata || options.forceRefresh) {
          // Load base to get metadata
          const loadResult = await this.loadBase(filePath, {
            validate: false,
            forceRefresh: true
          })

          if (loadResult.success) {
            metadata = loadResult.metadata
          } else {
            // Create minimal metadata for invalid bases
            metadata = {
              id: baseId,
              name: this.extractFileName(filePath, true),
              path: filePath,
              fileName: this.extractFileName(filePath),
              error: loadResult.error,
              isValid: false
            }
          }
        }

        bases.push(metadata)
      }

      // Sort bases by name or modification time
      const sortBy = options.sortBy || 'name'
      bases.sort((a, b) => {
        if (sortBy === 'modified') {
          return new Date(b.modified || 0) - new Date(a.modified || 0)
        }
        return a.name.localeCompare(b.name)
      })

      return {
        success: true,
        bases,
        directory: basesDir,
        count: bases.length
      }

    } catch (error) {
      console.error('Error in listBases:', error)
      return {
        success: false,
        error: error.message || String(error),
        errorType: error.constructor.name,
        originalError: error
      }
    }
  }

  /**
   * Search bases by name, content, or metadata
   */
  async searchBases(query, options = {}) {
    try {
      if (!query || typeof query !== 'string') {
        throw new Error('Search query is required')
      }

      const searchScope = options.scope || 'all' // 'name', 'content', 'all'
      const caseSensitive = options.caseSensitive || false
      const maxResults = options.maxResults || 50

      const searchQuery = caseSensitive ? query : query.toLowerCase()
      const results = []

      // Search in loaded bases
      for (const [baseId, base] of this.cache.entries()) {
        const metadata = this.basesIndex.get(baseId)
        if (!metadata) continue

        let matches = false
        let matchType = null
        let matchDetails = []

        // Search by name
        if ((searchScope === 'all' || searchScope === 'name')) {
          const name = caseSensitive ? base.name : base.name.toLowerCase()
          if (name.includes(searchQuery)) {
            matches = true
            matchType = 'name'
            matchDetails.push({ type: 'name', value: base.name })
          }
        }

        // Search by description
        if (!matches && (searchScope === 'all' || searchScope === 'content')) {
          const desc = base.description || ''
          const description = caseSensitive ? desc : desc.toLowerCase()
          if (description.includes(searchQuery)) {
            matches = true
            matchType = 'description'
            matchDetails.push({ type: 'description', value: desc })
          }
        }

        // Search in properties
        if (!matches && (searchScope === 'all' || searchScope === 'content')) {
          for (const [propName, propDef] of Object.entries(base.properties || {})) {
            const propNameMatch = caseSensitive ? propName : propName.toLowerCase()
            const propDescMatch = caseSensitive ? (propDef.description || '') : (propDef.description || '').toLowerCase()

            if (propNameMatch.includes(searchQuery) || propDescMatch.includes(searchQuery)) {
              matches = true
              matchType = 'property'
              matchDetails.push({ type: 'property', name: propName, description: propDef.description })
              break
            }
          }
        }

        if (matches) {
          results.push({
            baseId,
            base,
            metadata,
            matchType,
            matchDetails,
            score: this.calculateSearchScore(query, base, matchDetails)
          })
        }

        if (results.length >= maxResults) break
      }

      // Sort by relevance score
      results.sort((a, b) => b.score - a.score)

      return {
        success: true,
        results,
        query,
        count: results.length,
        hasMore: false // Could implement pagination
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Get base statistics
   */
  async getBaseStats() {
    try {
      const stats = {
        total: this.basesIndex.size,
        bySourceType: {},
        byPropertyCount: { '0-5': 0, '6-10': 0, '11-20': 0, '21+': 0 },
        byViewCount: { '1': 0, '2-5': 0, '6+': 0 },
        totalProperties: 0,
        totalViews: 0,
        mostUsedPropertyTypes: {},
        mostUsedViewTypes: {},
        recentlyCreated: 0,
        recentlyModified: 0
      }

      const now = Date.now()
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000)

      for (const [baseId, metadata] of this.basesIndex.entries()) {
        // Source type distribution
        const sourceType = metadata.sourceType || 'unknown'
        stats.bySourceType[sourceType] = (stats.bySourceType[sourceType] || 0) + 1

        // Property count distribution
        const propCount = metadata.propertyCount || 0
        stats.totalProperties += propCount
        if (propCount <= 5) stats.byPropertyCount['0-5']++
        else if (propCount <= 10) stats.byPropertyCount['6-10']++
        else if (propCount <= 20) stats.byPropertyCount['11-20']++
        else stats.byPropertyCount['21+']++

        // View count distribution
        const viewCount = metadata.viewCount || 1
        stats.totalViews += viewCount
        if (viewCount === 1) stats.byViewCount['1']++
        else if (viewCount <= 5) stats.byViewCount['2-5']++
        else stats.byViewCount['6+']++

        // Recent activity
        if (metadata.created) {
          const created = new Date(metadata.created).getTime()
          if (created > oneWeekAgo) stats.recentlyCreated++
        }
        if (metadata.modified) {
          const modified = new Date(metadata.modified).getTime()
          if (modified > oneDayAgo && metadata.created !== metadata.modified) {
            stats.recentlyModified++
          }
        }

        // Analyze cached base for detailed stats
        const base = this.cache.get(baseId)
        if (base) {
          // Property type analysis
          for (const prop of Object.values(base.properties || {})) {
            const type = prop.type
            stats.mostUsedPropertyTypes[type] = (stats.mostUsedPropertyTypes[type] || 0) + 1
          }

          // View type analysis
          for (const view of Object.values(base.views || {})) {
            const type = view.type
            stats.mostUsedViewTypes[type] = (stats.mostUsedViewTypes[type] || 0) + 1
          }
        }
      }

      return {
        success: true,
        stats
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Import base from external source
   */
  async importBase(source, format, options = {}) {
    try {
      let baseDefinition

      switch (format) {
        case 'json':
          baseDefinition = typeof source === 'string' ? JSON.parse(source) : source
          break
        case 'yaml':
          const parseResult = baseParser.parse(source)
          if (!parseResult.success) {
            throw new Error(parseResult.error)
          }
          baseDefinition = parseResult.data
          break
        case 'legacy':
          const convertResult = baseParser.convertLegacy(source, options.legacyFormat)
          if (!convertResult.success) {
            throw new Error(convertResult.error)
          }
          baseDefinition = convertResult.data
          break
        default:
          throw new Error(`Unsupported import format: ${format}`)
      }

      // Create the imported base
      return await this.createBase(baseDefinition.name, {
        description: baseDefinition.description,
        source: baseDefinition.source,
        properties: baseDefinition.properties,
        views: baseDefinition.views,
        settings: baseDefinition.settings,
        path: options.path,
        overwrite: options.overwrite
      })

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Export base to external format
   */
  async exportBase(baseId, format, options = {}) {
    try {
      let base = this.cache.get(baseId)
      if (!base) {
        const loadResult = await this.loadBase(this.basesIndex.get(baseId)?.path)
        if (!loadResult.success) {
          throw new Error(`Failed to load base: ${loadResult.error}`)
        }
        base = loadResult.base
      }

      switch (format) {
        case 'json':
          return {
            success: true,
            content: JSON.stringify(base, null, 2),
            mimeType: 'application/json',
            extension: 'json'
          }
        case 'yaml':
          const stringifyResult = baseParser.stringify(base, options)
          if (!stringifyResult.success) {
            throw new Error(stringifyResult.error)
          }
          return {
            success: true,
            content: stringifyResult.content,
            mimeType: 'text/yaml',
            extension: 'yaml'
          }
        default:
          throw new Error(`Unsupported export format: ${format}`)
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        errorType: error.constructor.name
      }
    }
  }

  /**
   * Utility methods
   */

  async getBasesDirectory(workspacePath = null) {
    if (workspacePath) {
      return normalizePath(joinPath(workspacePath, '.lokus', 'bases'))
    }
    // Default fallback - use current working directory or user documents
    // This should be overridden by passing workspacePath
    try {
      const homeDir = await invoke('get_home_directory') || 'C:\\Users\\Default\\Documents'
      return normalizePath(joinPath(homeDir, 'Documents', 'Lokus', '.lokus', 'bases'))
    } catch (error) {
      return normalizePath(joinPath('C:', 'Users', 'Default', 'Documents', 'Lokus', '.lokus', 'bases'))
    }
  }

  async ensureBasesDirectory(basesDir) {
    try {
      // Try to read the directory to see if it exists
      await invoke('read_workspace_files', { workspacePath: basesDir })
    } catch (error) {
      // Directory doesn't exist, create it
      try {
        // Create the parent .lokus directory first
        const parentDir = basesDir.replace(/[\/\\]bases$/, '')
        await invoke('create_folder_in_workspace', { 
          workspacePath: parentDir.replace(/[\/\\]\.lokus$/, ''), 
          name: '.lokus' 
        })
        
        // Then create the bases subdirectory
        await invoke('create_folder_in_workspace', { 
          workspacePath: parentDir, 
          name: 'bases' 
        })
      } catch (createError) {
        console.warn('Could not create bases directory:', createError)
        // Continue anyway - maybe the directory exists but we can't read it
      }
    }
  }

  async resolvePath(directory, fileName) {
    try {
      return await invoke('resolve_path', { directory, fileName })
    } catch (error) {
      // Fallback to manual path joining if Tauri command doesn't exist
      return normalizePath(joinPath(directory, fileName))
    }
  }

  async fileExists(path) {
    try {
      const content = await invoke('read_file_content', { path: path })
      return true
    } catch (error) {
      return false
    }
  }

  async createBackup(filePath) {
    const backupPath = `${filePath}.backup.${Date.now()}`
    await invoke('copy_file', { source: filePath, destination: backupPath })
    return backupPath
  }

  generateBaseId(filePath) {
    // Generate a consistent ID based on file path
    return btoa(filePath).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
  }

  sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '-').toLowerCase()
  }

  extractFileName(path, withoutExtension = false) {
    const fileName = path.split('/').pop() || path.split('\\').pop() || path
    return withoutExtension ? fileName.replace(/\.[^.]+$/, '') : fileName
  }

  calculateSearchScore(query, base, matchDetails) {
    let score = 0
    const queryLower = query.toLowerCase()

    for (const match of matchDetails) {
      switch (match.type) {
        case 'name':
          // Exact name match gets highest score
          if (base.name.toLowerCase() === queryLower) {
            score += 100
          } else if (base.name.toLowerCase().startsWith(queryLower)) {
            score += 50
          } else {
            score += 20
          }
          break
        case 'description':
          score += 10
          break
        case 'property':
          score += 5
          break
      }
    }

    return score
  }

  /**
   * Clear cache
   */
  invalidateCache() {
    this.cache.clear()
    this.basesIndex.clear()
  }

  /**
   * Get cached base
   */
  getCachedBase(baseId) {
    return this.cache.get(baseId) || null
  }

  /**
   * Get base metadata
   */
  getBaseMetadata(baseId) {
    return this.basesIndex.get(baseId) || null
  }

  /**
   * Check if base is loaded
   */
  isBaseLoaded(baseId) {
    return this.cache.has(baseId)
  }
}

/**
 * Error classes
 */
class ValidationError extends Error {
  constructor(message, errors = []) {
    super(message)
    this.name = 'ValidationError'
    this.errors = errors
    this.validationResult = { isValid: false, errors }
  }
}

class ParseError extends Error {
  constructor(message, line = null, column = null) {
    super(message)
    this.name = 'ParseError'
    this.line = line
    this.column = column
  }
}

// Create singleton instance
export const baseManager = new BaseManager()

// Export classes and helper functions
export { ValidationError, ParseError }

// Helper functions
export async function createBase(name, options = {}) {
  return await baseManager.createBase(name, options)
}

export async function loadBase(path, options = {}) {
  return await baseManager.loadBase(path, options)
}

export async function saveBase(baseId, baseDefinition, options = {}) {
  return await baseManager.saveBase(baseId, baseDefinition, options)
}

export async function deleteBase(baseId, options = {}) {
  return await baseManager.deleteBase(baseId, options)
}

export async function listBases(directory = null, options = {}) {
  return await baseManager.listBases(directory, options)
}

export default baseManager