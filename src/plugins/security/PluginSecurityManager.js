/**
 * Plugin Security Manager - Central security orchestration for plugins
 * 
 * Manages:
 * - Plugin sandboxes and isolation
 * - Permission validation and enforcement  
 * - Code signing and verification
 * - Security policy enforcement
 * - Threat detection and response
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import PluginSandbox from './PluginSandbox.js'

export class PluginSecurityManager extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.options = {
      defaultPermissions: ['ui:notifications'],
      requireSignatures: false,
      maxSandboxes: 20,
      quarantineEnabled: true,
      auditingEnabled: true,
      ...options
    }
    
    this.sandboxes = new Map() // pluginId -> PluginSandbox
    this.securityPolicies = new Map() // pluginId -> SecurityPolicy
    this.quarantinedPlugins = new Set()
    this.auditLog = []
    this.threatDetector = null
    
    this.setupThreatDetection()
  }

  /**
   * Create secure sandbox for plugin
   */
  async createSandbox(pluginId, manifest, options = {}) {
    try {
      // Security validation
      await this.validatePluginSecurity(pluginId, manifest)
      
      // Check if plugin is quarantined
      if (this.quarantinedPlugins.has(pluginId)) {
        throw new Error(`Plugin ${pluginId} is quarantined due to security violations`)
      }

      // Check sandbox limits
      if (this.sandboxes.size >= this.options.maxSandboxes) {
        throw new Error('Maximum number of plugin sandboxes reached')
      }

      // Create security policy for plugin
      const securityPolicy = this.createSecurityPolicy(manifest)
      this.securityPolicies.set(pluginId, securityPolicy)

      // Create sandbox with security constraints
      const sandboxOptions = {
        ...this.getSandboxSecurityOptions(securityPolicy),
        ...options
      }

      const sandbox = new PluginSandbox(pluginId, manifest, sandboxOptions)
      
      // Set up sandbox monitoring
      this.setupSandboxMonitoring(sandbox, pluginId)
      
      // Initialize sandbox
      await sandbox.initialize()
      
      this.sandboxes.set(pluginId, sandbox)
      
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'sandbox_created',
        pluginId,
        securityLevel: securityPolicy.level,
        permissions: manifest.permissions || []
      })

      this.emit('sandbox-created', { pluginId, sandbox })
      
      return sandbox
      
    } catch (error) {
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'sandbox_creation_failed',
        pluginId,
        error: error.message
      })
      
      this.emit('security-violation', {
        pluginId,
        violation: 'sandbox_creation_failed',
        error: error.message
      })
      
      throw error
    }
  }

  /**
   * Validate plugin security before sandbox creation
   */
  async validatePluginSecurity(pluginId, manifest) {
    const violations = []

    // Check manifest structure
    if (!manifest || typeof manifest !== 'object') {
      violations.push('Invalid manifest structure')
    }

    // Validate plugin ID
    if (!pluginId || typeof pluginId !== 'string' || !/^[a-zA-Z0-9-_]+$/.test(pluginId)) {
      violations.push('Invalid plugin ID format')
    }

    // Check required fields
    const requiredFields = ['name', 'version', 'main']
    for (const field of requiredFields) {
      if (!manifest[field]) {
        violations.push(`Missing required field: ${field}`)
      }
    }

    // Validate permissions
    if (manifest.permissions) {
      const invalidPermissions = this.validatePermissions(manifest.permissions)
      if (invalidPermissions.length > 0) {
        violations.push(`Invalid permissions: ${invalidPermissions.join(', ')}`)
      }
    }

    // Check code signature if required
    if (this.options.requireSignatures) {
      if (!manifest.signature || !manifest.signatureAlgorithm) {
        violations.push('Code signature required but not provided')
      } else {
        const signatureValid = await this.verifyCodeSignature(manifest)
        if (!signatureValid) {
          violations.push('Invalid code signature')
        }
      }
    }

    // Check against known malicious patterns
    const threatScore = await this.assessThreatLevel(manifest)
    if (threatScore > 0.7) {
      violations.push('High threat score detected')
    }

    if (violations.length > 0) {
      throw new Error(`Security validation failed: ${violations.join(', ')}`)
    }
  }

  /**
   * Validate plugin permissions
   */
  validatePermissions(permissions) {
    const validPermissions = [
      // Editor permissions
      'editor:read', 'editor:write', 'editor:execute',
      
      // UI permissions  
      'ui:panels', 'ui:dialogs', 'ui:notifications', 'ui:menus', 'ui:toolbars',
      
      // File system permissions
      'fs:read', 'fs:write', 'fs:execute',
      
      // Network permissions
      'network:http', 'network:https', 'network:websocket',
      
      // Storage permissions
      'storage:read', 'storage:write',
      
      // System permissions
      'system:clipboard', 'system:notifications',
      
      // Events permissions
      'events:listen', 'events:emit',
      
      // Advanced permissions
      'all' // Dangerous - grants all permissions
    ]

    return permissions.filter(permission => !validPermissions.includes(permission))
  }

  /**
   * Create security policy for plugin
   */
  createSecurityPolicy(manifest) {
    const permissions = manifest.permissions || this.options.defaultPermissions
    const hasHighRiskPermissions = permissions.some(p => 
      ['all', 'fs:execute', 'system:shell', 'network:raw'].includes(p)
    )

    return {
      level: hasHighRiskPermissions ? 'high' : permissions.length > 5 ? 'medium' : 'low',
      permissions: new Set(permissions),
      restrictions: {
        memoryLimit: hasHighRiskPermissions ? 100 * 1024 * 1024 : 50 * 1024 * 1024,
        cpuTimeLimit: hasHighRiskPermissions ? 5000 : 1000,
        networkTimeout: 30000,
        maxApiCalls: hasHighRiskPermissions ? 5000 : 1000,
        maxFileSize: 10 * 1024 * 1024
      },
      monitoring: {
        logApiCalls: true,
        logNetworkAccess: true,
        logFileAccess: permissions.includes('fs:read') || permissions.includes('fs:write'),
        alertOnSuspiciousBehavior: true
      }
    }
  }

  /**
   * Get sandbox security options based on policy
   */
  getSandboxSecurityOptions(securityPolicy) {
    return {
      memoryLimit: securityPolicy.restrictions.memoryLimit,
      cpuTimeLimit: securityPolicy.restrictions.cpuTimeLimit,
      networkTimeout: securityPolicy.restrictions.networkTimeout,
      maxApiCalls: securityPolicy.restrictions.maxApiCalls,
      maxFileSize: securityPolicy.restrictions.maxFileSize,
      requireSignature: this.options.requireSignatures
    }
  }

  /**
   * Set up monitoring for sandbox
   */
  setupSandboxMonitoring(sandbox, pluginId) {
    const policy = this.securityPolicies.get(pluginId)

    // Monitor quota violations
    sandbox.on('quota-exceeded', (event) => {
      this.handleSecurityViolation(pluginId, 'quota_exceeded', {
        type: event.type,
        usage: event.usage,
        limit: event.limit
      })
    })

    // Monitor API calls
    sandbox.on('api-call', (event) => {
      if (policy.monitoring.logApiCalls) {
        this.auditLog.push({
          timestamp: Date.now(),
          action: 'api_call',
          pluginId,
          method: event.method,
          params: event.params
        })
      }
      
      // Check for suspicious API usage patterns
      this.checkSuspiciousAPIUsage(pluginId, event)
    })

    // Monitor errors
    sandbox.on('error', (event) => {
      this.auditLog.push({
        timestamp: Date.now(),
        action: 'sandbox_error',
        pluginId,
        error: event.error
      })
    })

    // Monitor worker errors
    sandbox.on('worker-error', (event) => {
      this.handleSecurityViolation(pluginId, 'worker_error', {
        error: event.error
      })
    })
  }

  /**
   * Handle security violations
   */
  handleSecurityViolation(pluginId, violationType, details) {
    this.auditLog.push({
      timestamp: Date.now(),
      action: 'security_violation',
      pluginId,
      violationType,
      details
    })

    const severity = this.assessViolationSeverity(violationType, details)
    
    if (severity === 'critical') {
      // Immediate quarantine
      this.quarantinePlugin(pluginId, `Critical violation: ${violationType}`)
    } else if (severity === 'high') {
      // Temporary suspension
      this.suspendPlugin(pluginId, 60000) // 1 minute
    }

    this.emit('security-violation', {
      pluginId,
      violationType,
      severity,
      details
    })
  }

  /**
   * Assess severity of security violation
   */
  assessViolationSeverity(violationType, details) {
    const criticalViolations = ['code_injection', 'privilege_escalation', 'data_exfiltration']
    const highViolations = ['quota_exceeded', 'permission_denied', 'suspicious_api_usage']
    
    if (criticalViolations.includes(violationType)) {
      return 'critical'
    } else if (highViolations.includes(violationType)) {
      return 'high'
    } else {
      return 'medium'
    }
  }

  /**
   * Check for suspicious API usage patterns
   */
  checkSuspiciousAPIUsage(pluginId, apiCall) {
    const recentCalls = this.getRecentAPICalls(pluginId, 5000) // Last 5 seconds
    
    // Check for rapid-fire API calls
    if (recentCalls.length > 100) {
      this.handleSecurityViolation(pluginId, 'suspicious_api_usage', {
        pattern: 'rapid_fire',
        callCount: recentCalls.length
      })
    }
    
    // Check for unauthorized API access attempts
    const policy = this.securityPolicies.get(pluginId)
    const requiredPermission = this.getRequiredPermission(apiCall.method)
    
    if (requiredPermission && !policy.permissions.has(requiredPermission)) {
      this.handleSecurityViolation(pluginId, 'permission_denied', {
        method: apiCall.method,
        requiredPermission
      })
    }
  }

  /**
   * Get recent API calls for plugin
   */
  getRecentAPICalls(pluginId, timeWindow) {
    const since = Date.now() - timeWindow
    return this.auditLog.filter(entry => 
      entry.pluginId === pluginId &&
      entry.action === 'api_call' &&
      entry.timestamp >= since
    )
  }

  /**
   * Get required permission for API method
   */
  getRequiredPermission(method) {
    const permissionMap = {
      'editor.getContent': 'editor:read',
      'editor.setContent': 'editor:write',
      'editor.insertContent': 'editor:write',
      'ui.showNotification': 'ui:notifications',
      'ui.showDialog': 'ui:dialogs',
      'storage.get': 'storage:read',
      'storage.set': 'storage:write',
      'network.fetch': 'network:http'
    }
    
    return permissionMap[method]
  }

  /**
   * Quarantine plugin
   */
  quarantinePlugin(pluginId, reason) {
    this.quarantinedPlugins.add(pluginId)
    
    // Terminate existing sandbox
    const sandbox = this.sandboxes.get(pluginId)
    if (sandbox) {
      sandbox.terminate()
      this.sandboxes.delete(pluginId)
    }

    this.auditLog.push({
      timestamp: Date.now(),
      action: 'plugin_quarantined',
      pluginId,
      reason
    })

    this.emit('plugin-quarantined', { pluginId, reason })
  }

  /**
   * Suspend plugin temporarily
   */
  suspendPlugin(pluginId, duration) {
    const sandbox = this.sandboxes.get(pluginId)
    if (sandbox) {
      sandbox.quotaExceeded = true
      
      setTimeout(() => {
        if (this.sandboxes.has(pluginId)) {
          sandbox.quotaExceeded = false
        }
      }, duration)
    }

    this.emit('plugin-suspended', { pluginId, duration })
  }

  /**
   * Verify code signature
   */
  async verifyCodeSignature(manifest) {
    // This would implement actual signature verification
    // For now, just check if signature exists
    return !!(manifest.signature && manifest.signatureAlgorithm)
  }

  /**
   * Assess threat level of plugin
   */
  async assessThreatLevel(manifest) {
    let threatScore = 0

    // Check for high-risk permissions
    const highRiskPermissions = ['all', 'fs:execute', 'system:shell']
    const permissions = manifest.permissions || []
    
    for (const permission of permissions) {
      if (highRiskPermissions.includes(permission)) {
        threatScore += 0.3
      }
    }

    // Check for suspicious manifest patterns
    if (manifest.name && manifest.name.includes('crypto')) {
      threatScore += 0.2
    }
    
    if (manifest.description && manifest.description.toLowerCase().includes('mining')) {
      threatScore += 0.4
    }

    // Check for obfuscated code indicators
    if (manifest.main && manifest.main.includes('eval')) {
      threatScore += 0.3
    }

    return Math.min(threatScore, 1.0)
  }

  /**
   * Set up threat detection system
   */
  setupThreatDetection() {
    // Monitor system resources
    this.threatDetector = setInterval(() => {
      this.detectAnomalies()
    }, 10000) // Check every 10 seconds
  }

  /**
   * Detect anomalies in plugin behavior
   */
  detectAnomalies() {
    // Check for unusual resource usage across all sandboxes
    let totalMemoryUsage = 0
    let totalApiCalls = 0

    for (const [pluginId, sandbox] of this.sandboxes) {
      const stats = sandbox.getStats()
      totalMemoryUsage += stats.memoryUsage
      totalApiCalls += stats.apiCalls

      // Check individual plugin anomalies
      if (stats.errors > 10) {
        this.handleSecurityViolation(pluginId, 'excessive_errors', {
          errorCount: stats.errors
        })
      }
    }

    // System-wide anomaly detection
    if (totalMemoryUsage > 500 * 1024 * 1024) { // 500MB total
      this.emit('system-anomaly', {
        type: 'high_memory_usage',
        usage: totalMemoryUsage
      })
    }
  }

  /**
   * Get sandbox for plugin
   */
  getSandbox(pluginId) {
    return this.sandboxes.get(pluginId)
  }

  /**
   * Remove quarantine from plugin
   */
  removeQuarantine(pluginId) {
    this.quarantinedPlugins.delete(pluginId)
    
    this.auditLog.push({
      timestamp: Date.now(),
      action: 'quarantine_removed',
      pluginId
    })

    this.emit('quarantine-removed', { pluginId })
  }

  /**
   * Get security audit log
   */
  getAuditLog(filter = {}) {
    let logs = [...this.auditLog]

    if (filter.pluginId) {
      logs = logs.filter(log => log.pluginId === filter.pluginId)
    }

    if (filter.action) {
      logs = logs.filter(log => log.action === filter.action)
    }

    if (filter.since) {
      logs = logs.filter(log => log.timestamp >= filter.since)
    }

    return logs.sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get security statistics
   */
  getSecurityStats() {
    const totalPlugins = this.sandboxes.size
    const quarantinedCount = this.quarantinedPlugins.size
    const recentViolations = this.auditLog.filter(log => 
      log.action === 'security_violation' && 
      log.timestamp >= Date.now() - 3600000 // Last hour
    ).length

    return {
      totalPlugins,
      quarantinedCount,
      recentViolations,
      threatLevel: quarantinedCount > 0 || recentViolations > 5 ? 'high' : 'low',
      systemResourceUsage: this.getSystemResourceUsage()
    }
  }

  /**
   * Get system resource usage
   */
  getSystemResourceUsage() {
    let totalMemory = 0
    let totalApiCalls = 0

    for (const sandbox of this.sandboxes.values()) {
      const stats = sandbox.getStats()
      totalMemory += stats.memoryUsage
      totalApiCalls += stats.apiCalls
    }

    return {
      totalMemory,
      totalApiCalls,
      activeSandboxes: this.sandboxes.size
    }
  }

  /**
   * Terminate all sandboxes and cleanup
   */
  async shutdown() {
    // Stop threat detection
    if (this.threatDetector) {
      clearInterval(this.threatDetector)
      this.threatDetector = null
    }

    // Terminate all sandboxes
    for (const sandbox of this.sandboxes.values()) {
      await sandbox.terminate()
    }

    this.sandboxes.clear()
    this.securityPolicies.clear()

    this.emit('shutdown')
  }
}

export default PluginSecurityManager