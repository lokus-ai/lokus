/**
 * Plugin Security Manager
 * Handles security validation, permission enforcement, and sandbox configuration
 */

export class PluginSecurityManager {
  constructor() {
    this.securityContexts = new Map() // pluginId -> SecurityContext
    this.permissionHandlers = new Map()
    this.securityPolicies = new Map()
    this.isInitialized = false
    this.logger = console // TODO: Replace with proper logger
    
    this.initializePermissionHandlers()
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Load security policies
      await this.loadSecurityPolicies()
      
      this.isInitialized = true
      this.logger.info('Plugin security manager initialized')
    } catch (error) {
      this.logger.error('Failed to initialize security manager:', error)
      throw error
    }
  }

  /**
   * Initialize permission handlers
   */
  initializePermissionHandlers() {
    // File system permissions
    this.permissionHandlers.set('read:files', {
      description: 'Read files from the file system',
      riskLevel: 'medium',
      validator: (context, args) => this.validateFileAccess(context, args[0], 'read')
    })
    
    this.permissionHandlers.set('write:files', {
      description: 'Write files to the file system',
      riskLevel: 'high',
      validator: (context, args) => this.validateFileAccess(context, args[0], 'write')
    })
    
    // Workspace permissions
    this.permissionHandlers.set('read:workspace', {
      description: 'Read workspace content and settings',
      riskLevel: 'low',
      validator: () => true
    })
    
    this.permissionHandlers.set('write:workspace', {
      description: 'Modify workspace content and settings',
      riskLevel: 'medium',
      validator: () => true
    })
    
    // Command execution
    this.permissionHandlers.set('execute:commands', {
      description: 'Execute system commands',
      riskLevel: 'critical',
      validator: (context, args) => this.validateCommandExecution(context, args[0])
    })
    
    // Network permissions
    this.permissionHandlers.set('network:http', {
      description: 'Make HTTP requests',
      riskLevel: 'medium',
      validator: (context, args) => this.validateNetworkAccess(context, args[0], 'http')
    })
    
    this.permissionHandlers.set('network:https', {
      description: 'Make HTTPS requests',
      riskLevel: 'medium',
      validator: (context, args) => this.validateNetworkAccess(context, args[0], 'https')
    })
    
    // UI permissions
    this.permissionHandlers.set('ui:editor', {
      description: 'Modify the editor interface',
      riskLevel: 'low',
      validator: () => true
    })
    
    this.permissionHandlers.set('ui:sidebar', {
      description: 'Add content to the sidebar',
      riskLevel: 'low',
      validator: () => true
    })
    
    this.permissionHandlers.set('ui:toolbar', {
      description: 'Add buttons to the toolbar',
      riskLevel: 'low',
      validator: () => true
    })
    
    // Storage permissions
    this.permissionHandlers.set('storage:local', {
      description: 'Store data locally',
      riskLevel: 'low',
      validator: () => true
    })
    
    // Clipboard permissions
    this.permissionHandlers.set('clipboard:read', {
      description: 'Read from clipboard',
      riskLevel: 'medium',
      validator: () => true
    })
    
    this.permissionHandlers.set('clipboard:write', {
      description: 'Write to clipboard',
      riskLevel: 'low',
      validator: () => true
    })
  }

  /**
   * Load security policies from configuration
   */
  async loadSecurityPolicies() {
    // Default security policies
    const defaultPolicies = {
      'default': {
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        maxExecutionTime: 30000, // 30 seconds
        allowedDomains: [],
        blockedDomains: ['localhost', '127.0.0.1'],
        maxFileSize: 10 * 1024 * 1024, // 10MB
        allowedFileExtensions: ['.md', '.txt', '.json', '.csv'],
        blockedPaths: ['/etc', '/var', '/usr', '/bin', '/sbin'],
        maxNetworkRequests: 100,
        networkTimeout: 10000
      }
    }
    
    // Apply default policies
    for (const [name, policy] of Object.entries(defaultPolicies)) {
      this.securityPolicies.set(name, policy)
    }
  }

  /**
   * Validate plugin security before execution
   */
  async validatePlugin(pluginId, manifest) {
    try {
      const securityContext = this.createSecurityContext(pluginId, manifest)
      
      // Validate manifest permissions
      await this.validateManifestPermissions(manifest)
      
      // Validate plugin code (basic static analysis)
      await this.validatePluginCode(pluginId, manifest)
      
      // Store security context
      this.securityContexts.set(pluginId, securityContext)
      
      this.logger.info(`Security validation passed for plugin ${pluginId}`)
      return true
    } catch (error) {
      this.logger.error(`Security validation failed for plugin ${pluginId}:`, error)
      throw error
    }
  }

  /**
   * Create security context for plugin
   */
  createSecurityContext(pluginId, manifest) {
    const policy = this.securityPolicies.get('default')
    
    return {
      pluginId,
      permissions: new Set(manifest.permissions || []),
      policy,
      resourceUsage: {
        memoryUsage: 0,
        executionTime: 0,
        networkRequests: 0,
        fileOperations: 0
      },
      restrictions: {
        allowedPaths: this.getAllowedPaths(manifest),
        blockedPaths: policy.blockedPaths,
        allowedDomains: policy.allowedDomains,
        blockedDomains: policy.blockedDomains
      },
      startTime: Date.now()
    }
  }

  /**
   * Get allowed file paths for plugin
   */
  getAllowedPaths(manifest) {
    const allowedPaths = []
    
    // Always allow plugin's own directory
    if (manifest.path) {
      allowedPaths.push(manifest.path)
    }
    
    // Allow workspace directory if permission granted
    if (manifest.permissions?.includes('read:workspace') || 
        manifest.permissions?.includes('write:workspace')) {
      allowedPaths.push('/workspace')
    }
    
    return allowedPaths
  }

  /**
   * Validate manifest permissions
   */
  async validateManifestPermissions(manifest) {
    const permissions = manifest.permissions || []
    
    for (const permission of permissions) {
      if (!this.permissionHandlers.has(permission)) {
        throw new Error(`Unknown permission: ${permission}`)
      }
      
      const handler = this.permissionHandlers.get(permission)
      if (handler.riskLevel === 'critical') {
        this.logger.warn(`Plugin requests critical permission: ${permission}`)
      }
    }
    
    // Check for dangerous permission combinations
    const hasCriticalPermissions = permissions.some(p => 
      this.permissionHandlers.get(p)?.riskLevel === 'critical'
    )
    
    if (hasCriticalPermissions) {
      this.logger.warn(`Plugin ${manifest.name} requests critical permissions`)
    }
  }

  /**
   * Basic static analysis of plugin code
   */
  async validatePluginCode(pluginId, manifest) {
    // This is a basic implementation - in production, you'd want more sophisticated analysis
    const dangerousPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /new\s+Function/,
      /document\.write/,
      /innerHTML\s*=/,
      /outerHTML\s*=/,
      /setTimeout\s*\(\s*["']/,
      /setInterval\s*\(\s*["']/,
      /exec\s*\(/,
      /spawn\s*\(/,
      /require\s*\(\s*["']child_process/,
      /require\s*\(\s*["']fs/,
      /require\s*\(\s*["']path/,
      /import\s+.*from\s+["']fs/,
      /import\s+.*from\s+["']child_process/
    ]
    
    // Note: In a real implementation, you'd read the actual plugin code here
    // For now, we'll just check the manifest for suspicious entries
    const manifestStr = JSON.stringify(manifest)
    
    for (const pattern of dangerousPatterns) {
      if (pattern.test(manifestStr)) {
        this.logger.warn(`Plugin ${pluginId} manifest contains potentially dangerous pattern: ${pattern}`)
      }
    }
  }

  /**
   * Validate file access permission
   */
  validateFileAccess(context, filePath, operation) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path')
    }
    
    // Normalize path
    const normalizedPath = this.normalizePath(filePath)
    
    // Check blocked paths
    for (const blockedPath of context.restrictions.blockedPaths) {
      if (normalizedPath.startsWith(blockedPath)) {
        throw new Error(`Access denied: ${filePath} is in blocked path ${blockedPath}`)
      }
    }
    
    // Check allowed paths
    let pathAllowed = false
    for (const allowedPath of context.restrictions.allowedPaths) {
      if (normalizedPath.startsWith(allowedPath)) {
        pathAllowed = true
        break
      }
    }
    
    if (!pathAllowed) {
      throw new Error(`Access denied: ${filePath} is not in allowed paths`)
    }
    
    // Check file extension if writing
    if (operation === 'write') {
      const policy = context.policy
      if (policy.allowedFileExtensions?.length > 0) {
        const extension = this.getFileExtension(filePath)
        if (!policy.allowedFileExtensions.includes(extension)) {
          throw new Error(`File type not allowed: ${extension}`)
        }
      }
    }
    
    // Update resource usage
    context.resourceUsage.fileOperations++
    
    return true
  }

  /**
   * Validate command execution
   */
  validateCommandExecution(context, command) {
    // For security, command execution is heavily restricted
    const allowedCommands = [
      'git status',
      'git log',
      'git diff'
    ]
    
    if (!allowedCommands.includes(command)) {
      throw new Error(`Command execution not allowed: ${command}`)
    }
    
    return true
  }

  /**
   * Validate network access
   */
  validateNetworkAccess(context, url, protocol) {
    try {
      const urlObj = new URL(url)
      
      // Check protocol
      if (urlObj.protocol !== `${protocol}:`) {
        throw new Error(`Protocol mismatch: expected ${protocol}, got ${urlObj.protocol}`)
      }
      
      // Check blocked domains
      for (const blockedDomain of context.restrictions.blockedDomains) {
        if (urlObj.hostname === blockedDomain || urlObj.hostname.endsWith(`.${blockedDomain}`)) {
          throw new Error(`Access denied: ${urlObj.hostname} is blocked`)
        }
      }
      
      // Check allowed domains (if specified)
      if (context.restrictions.allowedDomains.length > 0) {
        let domainAllowed = false
        for (const allowedDomain of context.restrictions.allowedDomains) {
          if (urlObj.hostname === allowedDomain || urlObj.hostname.endsWith(`.${allowedDomain}`)) {
            domainAllowed = true
            break
          }
        }
        
        if (!domainAllowed) {
          throw new Error(`Access denied: ${urlObj.hostname} is not in allowed domains`)
        }
      }
      
      // Check request limits
      context.resourceUsage.networkRequests++
      if (context.resourceUsage.networkRequests > context.policy.maxNetworkRequests) {
        throw new Error('Network request limit exceeded')
      }
      
      return true
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error(`Invalid URL: ${url}`)
      }
      throw error
    }
  }

  /**
   * Check if plugin has permission
   */
  hasPermission(pluginId, permission) {
    const context = this.securityContexts.get(pluginId)
    if (!context) {
      return false
    }
    
    return context.permissions.has(permission)
  }

  /**
   * Enforce permission check
   */
  enforcePermission(pluginId, permission, ...args) {
    const context = this.securityContexts.get(pluginId)
    if (!context) {
      throw new Error(`No security context found for plugin ${pluginId}`)
    }
    
    if (!context.permissions.has(permission)) {
      throw new Error(`Permission denied: ${permission}`)
    }
    
    const handler = this.permissionHandlers.get(permission)
    if (handler && handler.validator) {
      return handler.validator(context, args)
    }
    
    return true
  }

  /**
   * Check resource usage limits
   */
  checkResourceLimits(pluginId) {
    const context = this.securityContexts.get(pluginId)
    if (!context) {
      return
    }
    
    const currentTime = Date.now()
    const executionTime = currentTime - context.startTime
    
    // Check execution time limit
    if (executionTime > context.policy.maxExecutionTime) {
      throw new Error('Plugin execution time limit exceeded')
    }
    
    context.resourceUsage.executionTime = executionTime
  }

  /**
   * Get security context for plugin
   */
  getSecurityContext(pluginId) {
    return this.securityContexts.get(pluginId)
  }

  /**
   * Update resource usage
   */
  updateResourceUsage(pluginId, resource, amount) {
    const context = this.securityContexts.get(pluginId)
    if (context) {
      context.resourceUsage[resource] = (context.resourceUsage[resource] || 0) + amount
    }
  }

  /**
   * Get plugin security report
   */
  getSecurityReport(pluginId) {
    const context = this.securityContexts.get(pluginId)
    if (!context) {
      return null
    }
    
    return {
      pluginId,
      permissions: Array.from(context.permissions),
      resourceUsage: { ...context.resourceUsage },
      restrictions: { ...context.restrictions },
      policy: { ...context.policy },
      riskLevel: this.calculateRiskLevel(context)
    }
  }

  /**
   * Calculate risk level for plugin
   */
  calculateRiskLevel(context) {
    let riskScore = 0
    
    for (const permission of context.permissions) {
      const handler = this.permissionHandlers.get(permission)
      if (handler) {
        switch (handler.riskLevel) {
          case 'low': riskScore += 1; break
          case 'medium': riskScore += 3; break
          case 'high': riskScore += 5; break
          case 'critical': riskScore += 10; break
        }
      }
    }
    
    if (riskScore >= 10) return 'critical'
    if (riskScore >= 7) return 'high'
    if (riskScore >= 4) return 'medium'
    return 'low'
  }

  /**
   * Cleanup security context
   */
  cleanupSecurityContext(pluginId) {
    this.securityContexts.delete(pluginId)
  }

  /**
   * Utility methods
   */
  normalizePath(path) {
    return path.replace(/\\/g, '/').replace(/\/+/g, '/')
  }

  getFileExtension(filePath) {
    const lastDot = filePath.lastIndexOf('.')
    return lastDot >= 0 ? filePath.substring(lastDot) : ''
  }

  /**
   * Get all security contexts (for debugging)
   */
  getAllSecurityContexts() {
    const contexts = {}
    for (const [pluginId, context] of this.securityContexts) {
      contexts[pluginId] = this.getSecurityReport(pluginId)
    }
    return contexts
  }

  /**
   * Shutdown security manager
   */
  shutdown() {
    this.securityContexts.clear()
    this.isInitialized = false
  }
}

export default PluginSecurityManager