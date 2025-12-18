/**
 * Error Handler - Comprehensive error handling and recovery for editor plugins
 * 
 * This module provides:
 * - Centralized error handling for plugin operations
 * - Error recovery mechanisms
 * - Performance monitoring and optimization
 * - Security validation and sandboxing
 * - Debugging and logging utilities
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

export class EditorPluginErrorHandler extends EventEmitter {
  constructor() {
    super()
    
    // Error tracking
    this.errors = new Map() // pluginId -> Array of errors
    this.errorCounts = new Map() // pluginId -> count
    this.errorThresholds = {
      warning: 5,   // Show warning after 5 errors
      disable: 15,  // Disable plugin after 15 errors
      critical: 50  // Remove plugin after 50 errors
    }
    
    // Performance monitoring
    this.performanceMetrics = new Map()
    this.performanceThresholds = {
      extensionLoad: 5000,    // 5 seconds max for extension loading
      commandExecution: 1000, // 1 second max for command execution
      renderTime: 500,        // 500ms max for node rendering
      memoryUsage: 100        // 100MB max memory per plugin
    }
    
    // Recovery mechanisms
    this.recoveryStrategies = new Map()
    this.quarantinedPlugins = new Set()
    
    // Security validation
    this.securityViolations = new Map()
    this.securityThresholds = {
      domAccess: 10,      // Max 10 DOM access violations
      networkRequests: 5, // Max 5 network violations
      storageAccess: 20   // Max 20 storage violations
    }
    
  }

  // === ERROR HANDLING ===

  /**
   * Handle plugin error with context and recovery
   */
  handleError(pluginId, error, context = {}) {
    const errorInfo = {
      pluginId,
      error,
      context,
      timestamp: Date.now(),
      stack: error.stack,
      message: error.message,
      type: this.classifyError(error)
    }
    
    // Track error
    this.trackError(pluginId, errorInfo)
    
    // Log error
    this.logError(errorInfo)
    
    // Emit error event
    this.emit('plugin-error', errorInfo)
    
    // Check thresholds and take action
    this.checkErrorThresholds(pluginId)
    
    // Attempt recovery
    this.attemptRecovery(pluginId, errorInfo)
    
    return errorInfo
  }

  /**
   * Track error for plugin
   */
  trackError(pluginId, errorInfo) {
    // Add to errors array
    if (!this.errors.has(pluginId)) {
      this.errors.set(pluginId, [])
    }
    this.errors.get(pluginId).push(errorInfo)
    
    // Increment error count
    const currentCount = this.errorCounts.get(pluginId) || 0
    this.errorCounts.set(pluginId, currentCount + 1)
    
    // Keep only last 100 errors per plugin
    const errors = this.errors.get(pluginId)
    if (errors.length > 100) {
      errors.splice(0, errors.length - 100)
    }
  }

  /**
   * Classify error type for better handling
   */
  classifyError(error) {
    const message = error.message.toLowerCase()
    const stack = error.stack ? error.stack.toLowerCase() : ''
    
    if (message.includes('permission') || message.includes('security')) {
      return 'security'
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('cors')) {
      return 'network'
    }
    
    if (message.includes('syntax') || message.includes('parse')) {
      return 'syntax'
    }
    
    if (message.includes('memory') || message.includes('heap')) {
      return 'memory'
    }
    
    if (message.includes('timeout') || message.includes('slow')) {
      return 'performance'
    }
    
    if (stack.includes('tiptap') || stack.includes('prosemirror')) {
      return 'editor'
    }
    
    if (error instanceof TypeError) {
      return 'type'
    }
    
    if (error instanceof ReferenceError) {
      return 'reference'
    }
    
    return 'unknown'
  }

  /**
   * Check error thresholds and take action
   */
  checkErrorThresholds(pluginId) {
    const errorCount = this.errorCounts.get(pluginId) || 0
    
    if (errorCount >= this.errorThresholds.critical) {
      this.quarantinePlugin(pluginId, 'critical-errors')
      this.emit('plugin-quarantined', { pluginId, reason: 'critical-errors', errorCount })
    } else if (errorCount >= this.errorThresholds.disable) {
      this.disablePlugin(pluginId, 'high-error-rate')
      this.emit('plugin-disabled', { pluginId, reason: 'high-error-rate', errorCount })
    } else if (errorCount >= this.errorThresholds.warning) {
      this.warnPlugin(pluginId, 'error-threshold-warning')
      this.emit('plugin-warning', { pluginId, reason: 'error-threshold-warning', errorCount })
    }
  }

  /**
   * Attempt error recovery
   */
  attemptRecovery(pluginId, errorInfo) {
    const strategy = this.getRecoveryStrategy(errorInfo.type, errorInfo.context)
    
    if (strategy) {
      
      try {
        strategy.execute(pluginId, errorInfo)
        this.emit('recovery-attempted', { pluginId, strategy: strategy.name, success: true })
      } catch (recoveryError) {
        this.emit('recovery-attempted', { pluginId, strategy: strategy.name, success: false, error: recoveryError })
      }
    }
  }

  /**
   * Get recovery strategy for error type
   */
  getRecoveryStrategy(errorType, context) {
    const strategies = {
      'syntax': {
        name: 'syntax-recovery',
        execute: (pluginId, errorInfo) => {
          // Try to reload plugin with fallback configuration
          this.reloadPluginWithFallback(pluginId)
        }
      },
      'memory': {
        name: 'memory-cleanup',
        execute: (pluginId, errorInfo) => {
          // Clear caches and force garbage collection
          this.clearPluginCaches(pluginId)
          if (window.gc) window.gc()
        }
      },
      'performance': {
        name: 'performance-optimization',
        execute: (pluginId, errorInfo) => {
          // Reduce plugin functionality to improve performance
          this.optimizePlugin(pluginId)
        }
      },
      'network': {
        name: 'network-retry',
        execute: (pluginId, errorInfo) => {
          // Retry network operations with exponential backoff
          this.retryNetworkOperation(pluginId, errorInfo)
        }
      },
      'editor': {
        name: 'editor-reset',
        execute: (pluginId, errorInfo) => {
          // Reset editor state and reload extensions
          this.resetEditorState(pluginId)
        }
      }
    }
    
    return strategies[errorType] || null
  }

  // === PERFORMANCE MONITORING ===

  /**
   * Monitor performance metrics
   */
  monitorPerformance(pluginId, operation, duration, metadata = {}) {
    const metric = {
      pluginId,
      operation,
      duration,
      metadata,
      timestamp: Date.now()
    }
    
    // Track metric
    if (!this.performanceMetrics.has(pluginId)) {
      this.performanceMetrics.set(pluginId, [])
    }
    this.performanceMetrics.get(pluginId).push(metric)
    
    // Check performance thresholds
    this.checkPerformanceThresholds(pluginId, operation, duration)
    
    // Emit performance event
    this.emit('performance-metric', metric)
    
    // Keep only last 1000 metrics per plugin
    const metrics = this.performanceMetrics.get(pluginId)
    if (metrics.length > 1000) {
      metrics.splice(0, metrics.length - 1000)
    }
  }

  /**
   * Check performance thresholds
   */
  checkPerformanceThresholds(pluginId, operation, duration) {
    const threshold = this.performanceThresholds[operation]
    
    if (threshold && duration > threshold) {
      const warning = {
        pluginId,
        operation,
        duration,
        threshold,
        severity: duration > threshold * 2 ? 'high' : 'medium'
      }
      
      this.emit('performance-warning', warning)
      
      // Take action for severe performance issues
      if (warning.severity === 'high') {
        this.handlePerformanceIssue(pluginId, warning)
      }
    }
  }

  /**
   * Handle performance issues
   */
  handlePerformanceIssue(pluginId, warning) {
    
    // Optimize plugin automatically
    this.optimizePlugin(pluginId)
    
    // If still having issues, consider disabling
    const recentWarnings = this.getRecentPerformanceWarnings(pluginId)
    if (recentWarnings.length > 5) {
      this.disablePlugin(pluginId, 'performance-issues')
      this.emit('plugin-disabled', { pluginId, reason: 'performance-issues' })
    }
  }

  /**
   * Get recent performance warnings for plugin
   */
  getRecentPerformanceWarnings(pluginId) {
    const cutoff = Date.now() - 60000 // Last minute
    const metrics = this.performanceMetrics.get(pluginId) || []
    
    return metrics.filter(metric => 
      metric.timestamp > cutoff && 
      metric.duration > (this.performanceThresholds[metric.operation] || Infinity)
    )
  }

  // === SECURITY VALIDATION ===

  /**
   * Validate security for plugin operation
   */
  validateSecurity(pluginId, operation, context = {}) {
    const violations = []
    
    // Check DOM access patterns
    if (operation.includes('dom') || context.domAccess) {
      const violation = this.checkDOMAccess(pluginId, context)
      if (violation) violations.push(violation)
    }
    
    // Check network requests
    if (operation.includes('network') || context.networkAccess) {
      const violation = this.checkNetworkAccess(pluginId, context)
      if (violation) violations.push(violation)
    }
    
    // Check storage access
    if (operation.includes('storage') || context.storageAccess) {
      const violation = this.checkStorageAccess(pluginId, context)
      if (violation) violations.push(violation)
    }
    
    // Track violations
    if (violations.length > 0) {
      this.trackSecurityViolations(pluginId, violations)
    }
    
    return violations
  }

  /**
   * Check DOM access security
   */
  checkDOMAccess(pluginId, context) {
    // Check for suspicious DOM operations
    const suspiciousPatterns = [
      'innerHTML',
      'outerHTML',
      'document.write',
      'eval',
      'Function',
      'script'
    ]
    
    const operation = context.operation || ''
    for (const pattern of suspiciousPatterns) {
      if (operation.includes(pattern)) {
        return {
          type: 'dom-access',
          severity: 'high',
          pattern,
          operation
        }
      }
    }
    
    return null
  }

  /**
   * Check network access security
   */
  checkNetworkAccess(pluginId, context) {
    const url = context.url || ''
    
    // Check for suspicious URLs
    if (url.includes('javascript:') || url.includes('data:text/html')) {
      return {
        type: 'network-access',
        severity: 'critical',
        url,
        reason: 'suspicious-protocol'
      }
    }
    
    // Check rate limiting
    const recentRequests = this.getRecentNetworkRequests(pluginId)
    if (recentRequests.length > 10) {
      return {
        type: 'network-access',
        severity: 'medium',
        reason: 'rate-limit-exceeded',
        requestCount: recentRequests.length
      }
    }
    
    return null
  }

  /**
   * Check storage access security
   */
  checkStorageAccess(pluginId, context) {
    const key = context.key || ''
    
    // Check for accessing sensitive keys
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'private',
      'auth',
      'credential'
    ]
    
    for (const sensitiveKey of sensitiveKeys) {
      if (key.toLowerCase().includes(sensitiveKey)) {
        return {
          type: 'storage-access',
          severity: 'high',
          key,
          reason: 'sensitive-key-access'
        }
      }
    }
    
    return null
  }

  /**
   * Track security violations
   */
  trackSecurityViolations(pluginId, violations) {
    if (!this.securityViolations.has(pluginId)) {
      this.securityViolations.set(pluginId, [])
    }
    
    const pluginViolations = this.securityViolations.get(pluginId)
    pluginViolations.push(...violations.map(v => ({
      ...v,
      timestamp: Date.now()
    })))
    
    // Check security thresholds
    this.checkSecurityThresholds(pluginId)
    
    // Emit security events
    violations.forEach(violation => {
      this.emit('security-violation', { pluginId, violation })
    })
  }

  /**
   * Check security thresholds
   */
  checkSecurityThresholds(pluginId) {
    const violations = this.securityViolations.get(pluginId) || []
    const recentViolations = violations.filter(v => Date.now() - v.timestamp < 300000) // Last 5 minutes
    
    // Count by type
    const violationCounts = {}
    recentViolations.forEach(v => {
      violationCounts[v.type] = (violationCounts[v.type] || 0) + 1
    })
    
    // Check thresholds
    for (const [type, count] of Object.entries(violationCounts)) {
      const threshold = this.securityThresholds[type.replace('-', '')]
      if (threshold && count >= threshold) {
        this.quarantinePlugin(pluginId, `security-violations-${type}`)
        this.emit('plugin-quarantined', { 
          pluginId, 
          reason: `security-violations-${type}`, 
          violationCount: count 
        })
        break
      }
    }
  }

  // === PLUGIN MANAGEMENT ===

  /**
   * Disable plugin due to issues
   */
  disablePlugin(pluginId, reason) {
    
    try {
      // Emit disable event for plugin system to handle
      this.emit('disable-plugin-request', { pluginId, reason })
    } catch { }
  }

  /**
   * Quarantine plugin for security or critical issues
   */
  quarantinePlugin(pluginId, reason) {
    
    this.quarantinedPlugins.add(pluginId)
    
    try {
      // Emit quarantine event for plugin system to handle
      this.emit('quarantine-plugin-request', { pluginId, reason })
    } catch { }
  }

  /**
   * Warn plugin about issues
   */
  warnPlugin(pluginId, reason) {
    
    this.emit('plugin-warning', { pluginId, reason })
  }

  /**
   * Reload plugin with fallback configuration
   */
  reloadPluginWithFallback(pluginId) {
    
    this.emit('reload-plugin-request', { pluginId, useFallback: true })
  }

  /**
   * Clear plugin caches
   */
  clearPluginCaches(pluginId) {
    
    this.emit('clear-plugin-caches-request', { pluginId })
  }

  /**
   * Optimize plugin performance
   */
  optimizePlugin(pluginId) {
    
    this.emit('optimize-plugin-request', { pluginId })
  }

  /**
   * Retry network operation with backoff
   */
  retryNetworkOperation(pluginId, errorInfo) {
    
    this.emit('retry-network-request', { pluginId, errorInfo })
  }

  /**
   * Reset editor state
   */
  resetEditorState(pluginId) {
    
    this.emit('reset-editor-request', { pluginId })
  }

  // === UTILITY METHODS ===

  /**
   * Get recent network requests for rate limiting
   */
  getRecentNetworkRequests(pluginId) {
    const cutoff = Date.now() - 60000 // Last minute
    // This would be tracked elsewhere, returning empty array for now
    return []
  }

  /**
   * Get error statistics for plugin
   */
  getErrorStats(pluginId) {
    const errors = this.errors.get(pluginId) || []
    const totalErrors = this.errorCounts.get(pluginId) || 0
    const recentErrors = errors.filter(e => Date.now() - e.timestamp < 3600000) // Last hour
    
    const errorsByType = {}
    errors.forEach(error => {
      errorsByType[error.type] = (errorsByType[error.type] || 0) + 1
    })
    
    return {
      totalErrors,
      recentErrors: recentErrors.length,
      errorsByType,
      isQuarantined: this.quarantinedPlugins.has(pluginId)
    }
  }

  /**
   * Get performance statistics for plugin
   */
  getPerformanceStats(pluginId) {
    const metrics = this.performanceMetrics.get(pluginId) || []
    const recentMetrics = metrics.filter(m => Date.now() - m.timestamp < 3600000) // Last hour
    
    const averageDuration = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.duration, 0) / recentMetrics.length 
      : 0
    
    const operationStats = {}
    recentMetrics.forEach(metric => {
      if (!operationStats[metric.operation]) {
        operationStats[metric.operation] = { count: 0, totalDuration: 0 }
      }
      operationStats[metric.operation].count++
      operationStats[metric.operation].totalDuration += metric.duration
    })
    
    // Calculate averages
    Object.keys(operationStats).forEach(operation => {
      const stats = operationStats[operation]
      stats.averageDuration = stats.totalDuration / stats.count
    })
    
    return {
      totalMetrics: metrics.length,
      recentMetrics: recentMetrics.length,
      averageDuration,
      operationStats
    }
  }

  /**
   * Get security statistics for plugin
   */
  getSecurityStats(pluginId) {
    const violations = this.securityViolations.get(pluginId) || []
    const recentViolations = violations.filter(v => Date.now() - v.timestamp < 3600000) // Last hour
    
    const violationsByType = {}
    violations.forEach(violation => {
      violationsByType[violation.type] = (violationsByType[violation.type] || 0) + 1
    })
    
    return {
      totalViolations: violations.length,
      recentViolations: recentViolations.length,
      violationsByType,
      isQuarantined: this.quarantinedPlugins.has(pluginId)
    }
  }

  /**
   * Get comprehensive health report for plugin
   */
  getHealthReport(pluginId) {
    return {
      pluginId,
      timestamp: Date.now(),
      errors: this.getErrorStats(pluginId),
      performance: this.getPerformanceStats(pluginId),
      security: this.getSecurityStats(pluginId),
      overall: this.calculateOverallHealth(pluginId)
    }
  }

  /**
   * Calculate overall health score for plugin
   */
  calculateOverallHealth(pluginId) {
    const errorStats = this.getErrorStats(pluginId)
    const performanceStats = this.getPerformanceStats(pluginId)
    const securityStats = this.getSecurityStats(pluginId)
    
    let score = 100
    
    // Deduct for errors
    score -= Math.min(errorStats.recentErrors * 5, 50)
    
    // Deduct for performance issues
    if (performanceStats.averageDuration > 1000) {
      score -= Math.min((performanceStats.averageDuration - 1000) / 100, 30)
    }
    
    // Deduct for security violations
    score -= Math.min(securityStats.recentViolations * 10, 50)
    
    // Quarantined plugins get 0 score
    if (this.quarantinedPlugins.has(pluginId)) {
      score = 0
    }
    
    return {
      score: Math.max(0, score),
      status: score > 80 ? 'healthy' : score > 50 ? 'warning' : score > 20 ? 'poor' : 'critical'
    }
  }

  /**
   * Clear all data for plugin
   */
  clearPluginData(pluginId) {
    this.errors.delete(pluginId)
    this.errorCounts.delete(pluginId)
    this.performanceMetrics.delete(pluginId)
    this.securityViolations.delete(pluginId)
    this.quarantinedPlugins.delete(pluginId)
  }

  /**
   * Get system-wide statistics
   */
  getSystemStats() {
    const allPlugins = new Set([
      ...this.errors.keys(),
      ...this.performanceMetrics.keys(),
      ...this.securityViolations.keys()
    ])
    
    const totalErrors = Array.from(this.errorCounts.values()).reduce((sum, count) => sum + count, 0)
    const quarantinedCount = this.quarantinedPlugins.size
    
    return {
      totalPluginsMonitored: allPlugins.size,
      totalErrors,
      quarantinedPlugins: quarantinedCount,
      healthyPlugins: Array.from(allPlugins).filter(pluginId => {
        const health = this.calculateOverallHealth(pluginId)
        return health.score > 80
      }).length
    }
  }
}

// Export singleton instance
export const errorHandler = new EditorPluginErrorHandler()

export default {
  EditorPluginErrorHandler,
  errorHandler
}