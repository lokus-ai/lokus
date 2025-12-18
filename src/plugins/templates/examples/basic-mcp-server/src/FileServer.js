/**
 * File Server Implementation
 * 
 * Handles file system operations for the Basic File Server MCP Plugin
 */

import fs from 'fs/promises'
import path from 'path'

export class FileServer {
  constructor(api) {
    this.api = api
    this.isActive = false
    this.watchedPaths = new Map()
    this.baseDirectory = '/workspace' // Default workspace directory
    this.allowedExtensions = new Set([
      '.md', '.txt', '.json', '.js', '.ts', '.jsx', '.tsx',
      '.html', '.css', '.scss', '.less', '.xml', '.yaml', '.yml',
      '.csv', '.log', '.ini', '.conf', '.env'
    ])
  }

  /**
   * Initialize the file server
   */
  async initialize() {
    try {
      // Ensure base directory exists (in a real implementation, this would be configurable)
      await this.ensureDirectory(this.baseDirectory)
      
      this.isActive = true
      
    } catch (error) {
      throw error
    }
  }

  /**
   * Read file contents
   */
  async readFile(filePath, encoding = 'utf8') {
    try {
      const resolvedPath = this.resolvePath(filePath)
      await this.validateFileAccess(resolvedPath, 'read')
      
      const content = await fs.readFile(resolvedPath, encoding)
      const stats = await fs.stat(resolvedPath)
      
      return {
        success: true,
        content,
        metadata: {
          path: resolvedPath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          encoding
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }
  }

  /**
   * Write content to file
   */
  async writeFile(filePath, content, encoding = 'utf8', createDirectories = true) {
    try {
      const resolvedPath = this.resolvePath(filePath)
      await this.validateFileAccess(resolvedPath, 'write')
      
      if (createDirectories) {
        const directory = path.dirname(resolvedPath)
        await this.ensureDirectory(directory)
      }
      
      await fs.writeFile(resolvedPath, content, encoding)
      const stats = await fs.stat(resolvedPath)
      
      return {
        success: true,
        metadata: {
          path: resolvedPath,
          size: stats.size,
          lastModified: stats.mtime.toISOString(),
          bytesWritten: Buffer.byteLength(content, encoding)
        }
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }
  }

  /**
   * List directory contents
   */
  async listDirectory(dirPath, recursive = false, includeHidden = false, filter = null) {
    try {
      const resolvedPath = this.resolvePath(dirPath)
      await this.validateFileAccess(resolvedPath, 'read')
      
      const entries = await this.scanDirectory(
        resolvedPath, 
        recursive, 
        includeHidden, 
        filter
      )
      
      return {
        success: true,
        path: resolvedPath,
        entries,
        count: entries.length
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }
  }

  /**
   * Get file or directory information
   */
  async getFileInfo(filePath) {
    try {
      const resolvedPath = this.resolvePath(filePath)
      await this.validateFileAccess(resolvedPath, 'read')
      
      const stats = await fs.stat(resolvedPath)
      
      return {
        success: true,
        path: resolvedPath,
        name: path.basename(resolvedPath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        permissions: {
          readable: true, // Simplified for example
          writable: true,
          executable: stats.isDirectory()
        },
        extension: stats.isFile() ? path.extname(resolvedPath) : null
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        code: error.code
      }
    }
  }

  /**
   * Refresh file resources (for MCP resource updates)
   */
  async refreshResources() {
    try {
      // In a real implementation, this would notify MCP clients
      // about resource changes and update the resource catalog
      
      // Scan base directory for changes
      const entries = await this.scanDirectory(this.baseDirectory, true, false)
      
      return {
        success: true,
        resourcesFound: entries.length,
        lastRefresh: new Date().toISOString()
      }
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isActive: this.isActive,
      baseDirectory: this.baseDirectory,
      watchedPaths: this.watchedPaths.size,
      allowedExtensions: Array.from(this.allowedExtensions)
    }
  }

  /**
   * Shutdown the file server
   */
  async shutdown() {
    // Clean up watchers
    for (const watcher of this.watchedPaths.values()) {
      try {
        if (watcher.close) {
          watcher.close()
        }
      } catch { }
    }
    
    this.watchedPaths.clear()
    this.isActive = false
  }

  /**
   * Resolve relative paths to absolute paths
   */
  resolvePath(filePath) {
    if (path.isAbsolute(filePath)) {
      return filePath
    }
    return path.resolve(this.baseDirectory, filePath)
  }

  /**
   * Validate file access permissions
   */
  async validateFileAccess(filePath, operation) {
    // Security check: ensure path is within allowed directory
    const normalizedPath = path.normalize(filePath)
    const normalizedBase = path.normalize(this.baseDirectory)
    
    if (!normalizedPath.startsWith(normalizedBase)) {
      throw new Error(`Access denied: path outside allowed directory`)
    }

    // Check file extension for read/write operations
    if (operation === 'read' || operation === 'write') {
      const extension = path.extname(filePath)
      if (extension && !this.allowedExtensions.has(extension)) {
        throw new Error(`Access denied: file type '${extension}' not allowed`)
      }
    }

    // Check if file/directory exists for read operations
    if (operation === 'read') {
      try {
        await fs.access(filePath, fs.constants.F_OK)
      } catch (error) {
        throw new Error(`File or directory does not exist: ${filePath}`)
      }
    }
  }

  /**
   * Ensure directory exists
   */
  async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true })
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
  }

  /**
   * Scan directory recursively
   */
  async scanDirectory(dirPath, recursive, includeHidden, filter) {
    const entries = []
    
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true })
      
      for (const item of items) {
        // Skip hidden files if not requested
        if (!includeHidden && item.name.startsWith('.')) {
          continue
        }
        
        const fullPath = path.join(dirPath, item.name)
        const relativePath = path.relative(this.baseDirectory, fullPath)
        
        if (item.isDirectory()) {
          const entry = {
            name: item.name,
            path: fullPath,
            relativePath,
            type: 'directory',
            size: 0
          }
          
          entries.push(entry)
          
          // Recurse into subdirectories if requested
          if (recursive) {
            const subEntries = await this.scanDirectory(
              fullPath, 
              recursive, 
              includeHidden, 
              filter
            )
            entries.push(...subEntries)
          }
          
        } else if (item.isFile()) {
          // Apply filter if specified
          if (filter && !item.name.endsWith(filter)) {
            continue
          }
          
          // Check if file type is allowed
          const extension = path.extname(item.name)
          if (extension && !this.allowedExtensions.has(extension)) {
            continue
          }
          
          const stats = await fs.stat(fullPath)
          const entry = {
            name: item.name,
            path: fullPath,
            relativePath,
            type: 'file',
            size: stats.size,
            extension,
            modified: stats.mtime.toISOString()
          }
          
          entries.push(entry)
        }
      }
      
    } catch (error) {
      throw new Error(`Failed to scan directory ${dirPath}: ${error.message}`)
    }
    
    return entries
  }
}

export default FileServer