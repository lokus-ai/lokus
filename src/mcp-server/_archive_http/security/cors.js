/**
 * Production-Ready CORS Security Manager
 * 
 * Provides comprehensive CORS policy management with security validation,
 * origin whitelist management, dynamic configuration, and request monitoring.
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';

class CORSManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.strictMode = options.strictMode || process.env.NODE_ENV === 'production';
    this.enableDynamicOrigins = options.enableDynamicOrigins || false;
    this.enableSubdomains = options.enableSubdomains || false;
    this.enableSecurityChecks = options.enableSecurityChecks !== false;
    this.enableAuditLog = options.enableAuditLog !== false;
    this.maxAge = options.maxAge || 86400; // 24 hours
    
    // Origin whitelist management
    this.staticOrigins = new Set(options.allowedOrigins || this.getDefaultOrigins());
    this.dynamicOrigins = new Map(); // origin -> { added, expires, reason, addedBy }
    this.blockedOrigins = new Set(options.blockedOrigins || []);
    this.trustedDomains = new Set(options.trustedDomains || []);
    
    // Security patterns
    this.dangerousPatterns = [
      /data:/i,
      /javascript:/i,
      /vbscript:/i,
      /file:/i,
      /chrome:/i,
      /chrome-extension:/i,
      /moz-extension:/i,
      /safari-extension:/i
    ];
    
    // Headers configuration
    this.allowedMethods = options.allowedMethods || [
      'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS', 'HEAD'
    ];
    
    this.allowedHeaders = options.allowedHeaders || [
      'Origin',
      'X-Requested-With', 
      'Content-Type',
      'Accept',
      'Authorization',
      'X-API-Key',
      'X-Client-Version',
      'X-Request-ID',
      'X-Correlation-ID',
      'User-Agent',
      'Referer'
    ];
    
    this.exposedHeaders = options.exposedHeaders || [
      'X-Request-ID',
      'X-RateLimit-Limit-Minute',
      'X-RateLimit-Remaining-Minute', 
      'X-RateLimit-Reset',
      'X-Total-Count',
      'X-Page-Count'
    ];
    
    // Private network access (Chrome 104+)
    this.allowPrivateNetworks = options.allowPrivateNetworks || 
      process.env.NODE_ENV === 'development';
    
    // Request tracking
    this.metrics = {
      totalRequests: 0,
      allowedRequests: 0,
      blockedRequests: 0,
      preflightRequests: 0,
      originViolations: 0,
      methodViolations: 0,
      headerViolations: 0
    };
    
    // Origin analytics
    this.originStats = new Map(); // origin -> { count, lastSeen, blocked, allowed }
    this.suspiciousOrigins = new Map(); // origin -> { violations, lastViolation }
    this.auditLog = [];
    
    // Cleanup timer
    this.cleanupInterval = options.cleanupInterval || 3600000; // 1 hour
    this.startCleanupTimer();
    
    this.emit('initialized', {
      strictMode: this.strictMode,
      staticOrigins: this.staticOrigins.size,
      securityChecks: this.enableSecurityChecks
    });
  }

  /**
   * Get default origins based on environment
   */
  getDefaultOrigins() {
    const defaults = [];
    
    if (process.env.NODE_ENV === 'development') {
      defaults.push(
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8080',
        'http://localhost:3001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:8080'
      );
    }
    
    // Add production origins from environment
    const prodOrigins = process.env.CORS_ALLOWED_ORIGINS;
    if (prodOrigins) {
      defaults.push(...prodOrigins.split(',').map(origin => origin.trim()));
    }
    
    return defaults;
  }

  /**
   * Create CORS configuration
   */
  createConfig() {
    return {
      origin: this.originHandler.bind(this),
      credentials: true,
      methods: this.allowedMethods,
      allowedHeaders: this.allowedHeaders,
      exposedHeaders: this.exposedHeaders,
      maxAge: this.maxAge,
      preflightContinue: false,
      optionsSuccessStatus: 204
    };
  }

  /**
   * Origin validation handler
   */
  originHandler(origin, callback) {
    this.metrics.totalRequests++;
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      this.metrics.allowedRequests++;
      return callback(null, true);
    }
    
    const validation = this.validateOrigin(origin);
    
    // Update origin statistics
    this.updateOriginStats(origin, validation.allowed);
    
    // Log the request
    if (this.enableAuditLog) {
      this.logCorsRequest(origin, validation);
    }
    
    // Update metrics
    if (validation.allowed) {
      this.metrics.allowedRequests++;
    } else {
      this.metrics.blockedRequests++;
      this.handleOriginViolation(origin, validation.reason);
    }
    
    callback(null, validation.allowed);
  }

  /**
   * Validate origin against security policies
   */
  validateOrigin(origin) {
    try {
      // Basic security checks
      if (this.enableSecurityChecks) {
        const securityCheck = this.performSecurityChecks(origin);
        if (!securityCheck.passed) {
          return { allowed: false, reason: securityCheck.reason };
        }
      }
      
      // Check blocked origins
      if (this.blockedOrigins.has(origin)) {
        return { allowed: false, reason: 'origin_blocked' };
      }
      
      // Check static whitelist
      if (this.staticOrigins.has(origin)) {
        return { allowed: true, reason: 'static_whitelist' };
      }
      
      // Check dynamic origins
      if (this.enableDynamicOrigins) {
        const dynamicOrigin = this.dynamicOrigins.get(origin);
        if (dynamicOrigin && Date.now() < dynamicOrigin.expires) {
          return { allowed: true, reason: 'dynamic_whitelist' };
        }
      }
      
      // Check subdomain allowance
      if (this.enableSubdomains) {
        const subdomainCheck = this.checkSubdomainAccess(origin);
        if (subdomainCheck.allowed) {
          return { allowed: true, reason: 'subdomain_allowed' };
        }
      }
      
      // Strict mode - deny everything not explicitly allowed
      if (this.strictMode) {
        return { allowed: false, reason: 'strict_mode_violation' };
      }
      
      // Development mode - be more permissive
      if (process.env.NODE_ENV === 'development') {
        return { allowed: true, reason: 'development_mode' };
      }
      
      return { allowed: false, reason: 'not_whitelisted' };
    } catch (error) {
      this.emit('error', { operation: 'validate_origin', origin, error: error.message });
      return { allowed: false, reason: 'validation_error' };
    }
  }

  /**
   * Perform security checks on origin
   */
  performSecurityChecks(origin) {
    // Check for dangerous protocols
    for (const pattern of this.dangerousPatterns) {
      if (pattern.test(origin)) {
        return { passed: false, reason: 'dangerous_protocol' };
      }
    }
    
    // Basic URL validation
    try {
      const url = new URL(origin);
      
      // Check for suspicious ports
      const suspiciousPorts = ['22', '23', '25', '53', '110', '143', '993', '995'];
      if (suspiciousPorts.includes(url.port)) {
        return { passed: false, reason: 'suspicious_port' };
      }
      
      // Check for IP addresses in production
      if (this.strictMode && /^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)) {
        return { passed: false, reason: 'ip_address_not_allowed' };
      }
      
      // Check for localhost in production
      if (this.strictMode && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
        return { passed: false, reason: 'localhost_not_allowed' };
      }
      
      return { passed: true };
    } catch (error) {
      return { passed: false, reason: 'invalid_url' };
    }
  }

  /**
   * Check subdomain access
   */
  checkSubdomainAccess(origin) {
    try {
      const url = new URL(origin);
      
      for (const trustedDomain of this.trustedDomains) {
        if (url.hostname === trustedDomain || url.hostname.endsWith(`.${trustedDomain}`)) {
          return { allowed: true, domain: trustedDomain };
        }
      }
      
      return { allowed: false };
    } catch (error) {
      return { allowed: false };
    }
  }

  /**
   * Add origin to dynamic whitelist
   */
  addDynamicOrigin(origin, options = {}) {
    try {
      const {
        duration = 3600000, // 1 hour
        reason = 'admin_added',
        addedBy = 'system'
      } = options;
      
      this.dynamicOrigins.set(origin, {
        added: Date.now(),
        expires: Date.now() + duration,
        reason,
        addedBy
      });
      
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'dynamic_origin_added',
          origin,
          duration,
          reason,
          addedBy
        });
      }
      
      this.emit('dynamicOriginAdded', { origin, duration, reason, addedBy });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'add_dynamic_origin', origin, error: error.message });
      return false;
    }
  }

  /**
   * Remove origin from dynamic whitelist
   */
  removeDynamicOrigin(origin) {
    const removed = this.dynamicOrigins.delete(origin);
    
    if (removed && this.enableAuditLog) {
      this.addAuditEntry({
        action: 'dynamic_origin_removed',
        origin
      });
    }
    
    this.emit('dynamicOriginRemoved', { origin });
    return removed;
  }

  /**
   * Add origin to blocklist
   */
  blockOrigin(origin, reason = 'security_violation') {
    this.blockedOrigins.add(origin);
    
    if (this.enableAuditLog) {
      this.addAuditEntry({
        action: 'origin_blocked',
        origin,
        reason
      });
    }
    
    this.emit('originBlocked', { origin, reason });
    return true;
  }

  /**
   * Remove origin from blocklist
   */
  unblockOrigin(origin) {
    const removed = this.blockedOrigins.delete(origin);
    
    if (removed && this.enableAuditLog) {
      this.addAuditEntry({
        action: 'origin_unblocked',
        origin
      });
    }
    
    this.emit('originUnblocked', { origin });
    return removed;
  }

  /**
   * Add trusted domain for subdomain access
   */
  addTrustedDomain(domain) {
    this.trustedDomains.add(domain);
    
    if (this.enableAuditLog) {
      this.addAuditEntry({
        action: 'trusted_domain_added',
        domain
      });
    }
    
    this.emit('trustedDomainAdded', { domain });
    return true;
  }

  /**
   * Remove trusted domain
   */
  removeTrustedDomain(domain) {
    const removed = this.trustedDomains.delete(domain);
    
    if (removed && this.enableAuditLog) {
      this.addAuditEntry({
        action: 'trusted_domain_removed',
        domain
      });
    }
    
    this.emit('trustedDomainRemoved', { domain });
    return removed;
  }

  /**
   * CORS middleware
   */
  corsMiddleware() {
    return (req, res, next) => {
      const origin = req.headers.origin;
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        this.metrics.preflightRequests++;
        this.handlePreflightRequest(req, res, origin);
        return;
      }
      
      // Validate and set CORS headers for actual requests
      this.handleActualRequest(req, res, origin);
      next();
    };
  }

  /**
   * Handle preflight (OPTIONS) requests
   */
  handlePreflightRequest(req, res, origin) {
    const validation = origin ? this.validateOrigin(origin) : { allowed: true };
    
    if (!validation.allowed) {
      res.status(403).json({ error: 'CORS policy violation', reason: validation.reason });
      return;
    }
    
    // Set preflight headers
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Methods', this.allowedMethods.join(', '));
    res.header('Access-Control-Allow-Headers', this.allowedHeaders.join(', '));
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', this.maxAge.toString());
    
    // Private network access
    if (this.allowPrivateNetworks && req.headers['access-control-request-private-network']) {
      res.header('Access-Control-Allow-Private-Network', 'true');
    }
    
    res.status(204).end();
  }

  /**
   * Handle actual requests
   */
  handleActualRequest(req, res, origin) {
    const validation = origin ? this.validateOrigin(origin) : { allowed: true };
    
    if (!validation.allowed) {
      res.status(403).json({ error: 'CORS policy violation', reason: validation.reason });
      return;
    }
    
    // Set CORS headers
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
    }
    
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Expose-Headers', this.exposedHeaders.join(', '));
    
    // Vary header for proper caching
    res.header('Vary', 'Origin');
  }

  /**
   * Handle origin violation
   */
  handleOriginViolation(origin, reason) {
    this.metrics.originViolations++;
    
    // Track suspicious activity
    if (!this.suspiciousOrigins.has(origin)) {
      this.suspiciousOrigins.set(origin, { violations: 0, lastViolation: null });
    }
    
    const suspicious = this.suspiciousOrigins.get(origin);
    suspicious.violations++;
    suspicious.lastViolation = Date.now();
    
    // Auto-block after multiple violations
    if (suspicious.violations >= 10) {
      this.blockOrigin(origin, 'repeated_violations');
    }
    
    this.emit('originViolation', { origin, reason, violations: suspicious.violations });
  }

  /**
   * Update origin statistics
   */
  updateOriginStats(origin, allowed) {
    if (!this.originStats.has(origin)) {
      this.originStats.set(origin, { 
        count: 0, 
        lastSeen: null, 
        blocked: 0, 
        allowed: 0 
      });
    }
    
    const stats = this.originStats.get(origin);
    stats.count++;
    stats.lastSeen = Date.now();
    
    if (allowed) {
      stats.allowed++;
    } else {
      stats.blocked++;
    }
  }

  /**
   * Log CORS request
   */
  logCorsRequest(origin, validation) {
    this.addAuditEntry({
      action: 'cors_request',
      origin,
      allowed: validation.allowed,
      reason: validation.reason,
      timestamp: Date.now()
    });
  }

  /**
   * Add audit log entry
   */
  addAuditEntry(entry) {
    if (!this.enableAuditLog) return;
    
    this.auditLog.push({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: entry.timestamp || Date.now()
    });
    
    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get CORS statistics
   */
  getStats() {
    return {
      ...this.metrics,
      staticOrigins: this.staticOrigins.size,
      dynamicOrigins: this.dynamicOrigins.size,
      blockedOrigins: this.blockedOrigins.size,
      trustedDomains: this.trustedDomains.size,
      suspiciousOrigins: this.suspiciousOrigins.size,
      originStats: this.originStats.size,
      auditLogEntries: this.auditLog.length
    };
  }

  /**
   * Get origin analytics
   */
  getOriginAnalytics() {
    const analytics = [];
    
    for (const [origin, stats] of this.originStats) {
      analytics.push({
        origin,
        totalRequests: stats.count,
        allowedRequests: stats.allowed,
        blockedRequests: stats.blocked,
        successRate: stats.count > 0 ? stats.allowed / stats.count : 0,
        lastSeen: stats.lastSeen,
        isBlocked: this.blockedOrigins.has(origin),
        isDynamic: this.dynamicOrigins.has(origin),
        violations: this.suspiciousOrigins.get(origin)?.violations || 0
      });
    }
    
    return analytics.sort((a, b) => b.totalRequests - a.totalRequests);
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    const {
      action = null,
      origin = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = filters;
    
    let entries = [...this.auditLog];
    
    // Apply filters
    if (action) entries = entries.filter(entry => entry.action === action);
    if (origin) entries = entries.filter(entry => entry.origin === origin);
    if (startTime) entries = entries.filter(entry => entry.timestamp >= startTime);
    if (endTime) entries = entries.filter(entry => entry.timestamp <= endTime);
    
    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);
    
    // Apply pagination
    const total = entries.length;
    entries = entries.slice(offset, offset + limit);
    
    return { entries, total, limit, offset, hasMore: offset + limit < total };
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, this.cleanupInterval);
  }

  /**
   * Cleanup expired data
   */
  cleanupExpiredData() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean expired dynamic origins
    for (const [origin, data] of this.dynamicOrigins) {
      if (now > data.expires) {
        this.dynamicOrigins.delete(origin);
        cleanedCount++;
      }
    }
    
    // Clean old origin stats (older than 24 hours)
    const oneDayAgo = now - 86400000;
    for (const [origin, stats] of this.originStats) {
      if (stats.lastSeen < oneDayAgo) {
        this.originStats.delete(origin);
        cleanedCount++;
      }
    }
    
    // Clean old suspicious origins
    for (const [origin, suspicious] of this.suspiciousOrigins) {
      if (suspicious.lastViolation < oneDayAgo) {
        this.suspiciousOrigins.delete(origin);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.emit('dataCleanup', { cleanedCount });
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.staticOrigins.clear();
    this.dynamicOrigins.clear();
    this.blockedOrigins.clear();
    this.trustedDomains.clear();
    this.originStats.clear();
    this.suspiciousOrigins.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
  }
}

export default CORSManager;

/**
 * Create CORS configuration helper
 */
export const createCorsConfig = (options = {}) => {
  const corsManager = new CORSManager(options);
  return corsManager.createConfig();
};