/**
 * Security Headers Management for MCP Server
 * 
 * Implements comprehensive security headers including CSP, HSTS, XSS protection,
 * content type sniffing prevention, and other security best practices.
 */

import { EventEmitter } from 'events'

class SecurityHeadersManager extends EventEmitter {
  constructor(config = {}) {
    super()
    
    this.config = {
      // Content Security Policy
      csp: {
        enabled: config.csp?.enabled !== false,
        directives: {
          'default-src': config.csp?.directives?.['default-src'] || ["'self'"],
          'script-src': config.csp?.directives?.['script-src'] || ["'self'", "'unsafe-inline'"],
          'style-src': config.csp?.directives?.['style-src'] || ["'self'", "'unsafe-inline'"],
          'img-src': config.csp?.directives?.['img-src'] || ["'self'", 'data:', 'https:'],
          'connect-src': config.csp?.directives?.['connect-src'] || ["'self'"],
          'font-src': config.csp?.directives?.['font-src'] || ["'self'"],
          'object-src': config.csp?.directives?.['object-src'] || ["'none'"],
          'media-src': config.csp?.directives?.['media-src'] || ["'self'"],
          'frame-src': config.csp?.directives?.['frame-src'] || ["'none'"],
          'worker-src': config.csp?.directives?.['worker-src'] || ["'self'"],
          'child-src': config.csp?.directives?.['child-src'] || ["'self'"],
          'form-action': config.csp?.directives?.['form-action'] || ["'self'"],
          'frame-ancestors': config.csp?.directives?.['frame-ancestors'] || ["'none'"],
          'base-uri': config.csp?.directives?.['base-uri'] || ["'self'"],
          'upgrade-insecure-requests': config.csp?.directives?.['upgrade-insecure-requests'] || [],
          ...config.csp?.directives
        },
        reportOnly: config.csp?.reportOnly || false,
        reportUri: config.csp?.reportUri || null,
        nonce: config.csp?.nonce || false
      },

      // HTTP Strict Transport Security
      hsts: {
        enabled: config.hsts?.enabled !== false,
        maxAge: config.hsts?.maxAge || 31536000, // 1 year
        includeSubDomains: config.hsts?.includeSubDomains !== false,
        preload: config.hsts?.preload || false
      },

      // X-Frame-Options
      frameOptions: {
        enabled: config.frameOptions?.enabled !== false,
        policy: config.frameOptions?.policy || 'DENY' // 'DENY', 'SAMEORIGIN', 'ALLOW-FROM uri'
      },

      // X-Content-Type-Options
      contentTypeOptions: {
        enabled: config.contentTypeOptions?.enabled !== false,
        nosniff: config.contentTypeOptions?.nosniff !== false
      },

      // X-XSS-Protection
      xssProtection: {
        enabled: config.xssProtection?.enabled !== false,
        mode: config.xssProtection?.mode || '1; mode=block'
      },

      // Referrer Policy
      referrerPolicy: {
        enabled: config.referrerPolicy?.enabled !== false,
        policy: config.referrerPolicy?.policy || 'strict-origin-when-cross-origin'
      },

      // Permissions Policy (formerly Feature Policy)
      permissionsPolicy: {
        enabled: config.permissionsPolicy?.enabled || false,
        directives: {
          camera: config.permissionsPolicy?.directives?.camera || [],
          microphone: config.permissionsPolicy?.directives?.microphone || [],
          geolocation: config.permissionsPolicy?.directives?.geolocation || [],
          payment: config.permissionsPolicy?.directives?.payment || [],
          usb: config.permissionsPolicy?.directives?.usb || [],
          ...config.permissionsPolicy?.directives
        }
      },

      // Custom headers
      customHeaders: config.customHeaders || {},

      // Server identification
      removeServerHeader: config.removeServerHeader !== false,
      customServerHeader: config.customServerHeader || null,

      // Additional security headers
      crossOriginEmbedderPolicy: config.crossOriginEmbedderPolicy || null, // 'require-corp', 'credentialless'
      crossOriginOpenerPolicy: config.crossOriginOpenerPolicy || null, // 'same-origin', 'same-origin-allow-popups', 'unsafe-none'
      crossOriginResourcePolicy: config.crossOriginResourcePolicy || null, // 'same-site', 'same-origin', 'cross-origin'

      // Environment-specific settings
      development: config.development || false,
      enableReporting: config.enableReporting !== false,

      ...config
    }

    // CSP nonce generation
    this.nonceCache = new Map()
    this.nonceTTL = 300000 // 5 minutes

    // Security headers reporting
    this.violationLog = []
    this.maxViolationEntries = config.maxViolationEntries || 1000
  }

  /**
   * Main security headers middleware function
   */
  securityMiddleware() {
    return (req, res, next) => {
      try {
        // Remove or modify server header
        if (this.config.removeServerHeader) {
          res.removeHeader('Server')
          res.removeHeader('X-Powered-By')
        }
        
        if (this.config.customServerHeader) {
          res.setHeader('Server', this.config.customServerHeader)
        }

        // Set security headers
        this.setContentSecurityPolicy(req, res)
        this.setStrictTransportSecurity(req, res)
        this.setFrameOptions(res)
        this.setContentTypeOptions(res)
        this.setXSSProtection(res)
        this.setReferrerPolicy(res)
        this.setPermissionsPolicy(res)
        this.setCrossOriginPolicies(res)
        this.setCustomHeaders(res)

        // Add security context to request
        req.security = {
          nonce: this.generateNonce(req),
          cspReportEndpoint: this.config.csp.reportUri
        }

        this.emit('headersSet', {
          path: req.path || req.url,
          userAgent: req.headers['user-agent'],
          timestamp: Date.now()
        })

        next()
      } catch (error) {
        this.emit('headerError', {
          error: error.message,
          path: req.path || req.url,
          timestamp: Date.now()
        })

        // Continue anyway - don't block requests due to header errors
        next()
      }
    }
  }

  /**
   * Set Content Security Policy header
   */
  setContentSecurityPolicy(req, res) {
    if (!this.config.csp.enabled) return

    const directives = { ...this.config.csp.directives }
    
    // Add nonce if enabled
    if (this.config.csp.nonce) {
      const nonce = this.generateNonce(req)
      if (directives['script-src']) {
        directives['script-src'] = [...directives['script-src'], `'nonce-${nonce}'`]
      }
      if (directives['style-src']) {
        directives['style-src'] = [...directives['style-src'], `'nonce-${nonce}'`]
      }
    }

    // Add report URI if configured
    if (this.config.csp.reportUri) {
      directives['report-uri'] = [this.config.csp.reportUri]
    }

    // Build CSP string
    const cspString = Object.entries(directives)
      .filter(([directive, values]) => values && values.length > 0)
      .map(([directive, values]) => {
        if (Array.isArray(values)) {
          return `${directive} ${values.join(' ')}`
        }
        return `${directive}`
      })
      .join('; ')

    // Set appropriate header
    const headerName = this.config.csp.reportOnly 
      ? 'Content-Security-Policy-Report-Only'
      : 'Content-Security-Policy'
    
    res.setHeader(headerName, cspString)
  }

  /**
   * Set HTTP Strict Transport Security header
   */
  setStrictTransportSecurity(req, res) {
    if (!this.config.hsts.enabled) return

    // Only set HSTS for HTTPS requests
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      let hstsValue = `max-age=${this.config.hsts.maxAge}`
      
      if (this.config.hsts.includeSubDomains) {
        hstsValue += '; includeSubDomains'
      }
      
      if (this.config.hsts.preload) {
        hstsValue += '; preload'
      }
      
      res.setHeader('Strict-Transport-Security', hstsValue)
    }
  }

  /**
   * Set X-Frame-Options header
   */
  setFrameOptions(res) {
    if (!this.config.frameOptions.enabled) return
    
    res.setHeader('X-Frame-Options', this.config.frameOptions.policy)
  }

  /**
   * Set X-Content-Type-Options header
   */
  setContentTypeOptions(res) {
    if (!this.config.contentTypeOptions.enabled) return
    
    if (this.config.contentTypeOptions.nosniff) {
      res.setHeader('X-Content-Type-Options', 'nosniff')
    }
  }

  /**
   * Set X-XSS-Protection header
   */
  setXSSProtection(res) {
    if (!this.config.xssProtection.enabled) return
    
    res.setHeader('X-XSS-Protection', this.config.xssProtection.mode)
  }

  /**
   * Set Referrer-Policy header
   */
  setReferrerPolicy(res) {
    if (!this.config.referrerPolicy.enabled) return
    
    res.setHeader('Referrer-Policy', this.config.referrerPolicy.policy)
  }

  /**
   * Set Permissions-Policy header
   */
  setPermissionsPolicy(res) {
    if (!this.config.permissionsPolicy.enabled) return
    
    const directives = Object.entries(this.config.permissionsPolicy.directives)
      .filter(([feature, allowlist]) => allowlist && allowlist.length >= 0)
      .map(([feature, allowlist]) => {
        if (allowlist.length === 0) {
          return `${feature}=()`
        }
        return `${feature}=(${allowlist.join(' ')})`
      })
    
    if (directives.length > 0) {
      res.setHeader('Permissions-Policy', directives.join(', '))
    }
  }

  /**
   * Set Cross-Origin policies
   */
  setCrossOriginPolicies(res) {
    if (this.config.crossOriginEmbedderPolicy) {
      res.setHeader('Cross-Origin-Embedder-Policy', this.config.crossOriginEmbedderPolicy)
    }
    
    if (this.config.crossOriginOpenerPolicy) {
      res.setHeader('Cross-Origin-Opener-Policy', this.config.crossOriginOpenerPolicy)
    }
    
    if (this.config.crossOriginResourcePolicy) {
      res.setHeader('Cross-Origin-Resource-Policy', this.config.crossOriginResourcePolicy)
    }
  }

  /**
   * Set custom headers
   */
  setCustomHeaders(res) {
    Object.entries(this.config.customHeaders).forEach(([name, value]) => {
      res.setHeader(name, value)
    })
  }

  /**
   * Generate CSP nonce
   */
  generateNonce(req) {
    if (!this.config.csp.nonce) return null

    const requestId = req.requestId || 'default'
    const now = Date.now()

    // Check cache
    const cached = this.nonceCache.get(requestId)
    if (cached && (now - cached.timestamp) < this.nonceTTL) {
      return cached.nonce
    }

    // Generate new nonce
    const nonce = this.createRandomNonce()
    
    // Cache the nonce
    this.nonceCache.set(requestId, {
      nonce,
      timestamp: now
    })

    // Clean old entries
    this.cleanNonceCache()

    return nonce
  }

  /**
   * Create random nonce
   */
  createRandomNonce() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let result = ''
    for (let i = 0; i < 16; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  /**
   * Clean expired nonce cache entries
   */
  cleanNonceCache() {
    const now = Date.now()
    for (const [key, value] of this.nonceCache.entries()) {
      if (now - value.timestamp > this.nonceTTL) {
        this.nonceCache.delete(key)
      }
    }
  }

  /**
   * CSP violation reporting endpoint
   */
  cspReportHandler() {
    return (req, res) => {
      try {
        const report = req.body
        
        if (report && report['csp-report']) {
          this.logCSPViolation(report['csp-report'], req)
        }

        res.status(204).end()
      } catch (error) {
        this.emit('reportError', {
          error: error.message,
          body: req.body,
          timestamp: Date.now()
        })
        
        res.status(400).json({ error: 'Invalid report format' })
      }
    }
  }

  /**
   * Log CSP violation
   */
  logCSPViolation(violation, req) {
    const logEntry = {
      timestamp: Date.now(),
      type: 'csp_violation',
      violation: {
        documentUri: violation['document-uri'],
        referrer: violation.referrer,
        blockedUri: violation['blocked-uri'],
        violatedDirective: violation['violated-directive'],
        originalPolicy: violation['original-policy'],
        sourceFile: violation['source-file'],
        lineNumber: violation['line-number'],
        columnNumber: violation['column-number']
      },
      request: {
        userAgent: req.headers['user-agent'],
        ip: req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        referer: req.headers.referer
      }
    }

    this.violationLog.push(logEntry)

    // Keep log size manageable
    if (this.violationLog.length > this.maxViolationEntries) {
      this.violationLog = this.violationLog.slice(-Math.floor(this.maxViolationEntries * 0.8))
    }

    this.emit('cspViolation', logEntry)
  }

  /**
   * Update CSP directives
   */
  updateCSPDirectives(newDirectives) {
    this.config.csp.directives = {
      ...this.config.csp.directives,
      ...newDirectives
    }

    this.emit('cspUpdated', { directives: newDirectives })
  }

  /**
   * Add CSP source to directive
   */
  addCSPSource(directive, source) {
    if (!this.config.csp.directives[directive]) {
      this.config.csp.directives[directive] = []
    }

    if (!this.config.csp.directives[directive].includes(source)) {
      this.config.csp.directives[directive].push(source)
      
      this.emit('cspSourceAdded', { directive, source })
    }
  }

  /**
   * Remove CSP source from directive
   */
  removeCSPSource(directive, source) {
    if (this.config.csp.directives[directive]) {
      const index = this.config.csp.directives[directive].indexOf(source)
      if (index > -1) {
        this.config.csp.directives[directive].splice(index, 1)
        
        this.emit('cspSourceRemoved', { directive, source })
      }
    }
  }

  /**
   * Generate development-friendly CSP
   */
  generateDevelopmentCSP() {
    return {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'localhost:*', '127.0.0.1:*'],
      'style-src': ["'self'", "'unsafe-inline'", 'localhost:*', '127.0.0.1:*'],
      'img-src': ["'self'", 'data:', 'blob:', 'localhost:*', '127.0.0.1:*'],
      'connect-src': ["'self'", 'ws:', 'wss:', 'localhost:*', '127.0.0.1:*'],
      'font-src': ["'self'", 'data:', 'localhost:*', '127.0.0.1:*'],
      'media-src': ["'self'", 'localhost:*', '127.0.0.1:*'],
      'object-src': ["'none'"],
      'frame-src': ["'self'", 'localhost:*', '127.0.0.1:*'],
      'worker-src': ["'self'", 'blob:', 'localhost:*', '127.0.0.1:*']
    }
  }

  /**
   * Get security headers statistics
   */
  getStats() {
    const now = Date.now()
    const hourAgo = now - (60 * 60 * 1000)
    const dayAgo = now - (24 * 60 * 60 * 1000)

    const recentViolations = this.violationLog.filter(log => log.timestamp > hourAgo)

    return {
      totalViolations: this.violationLog.length,
      violationsLastHour: recentViolations.length,
      noncesCached: this.nonceCache.size,
      topViolatedDirectives: this.getTopViolatedDirectives(dayAgo),
      topBlockedUris: this.getTopBlockedUris(dayAgo),
      config: {
        cspEnabled: this.config.csp.enabled,
        hstsEnabled: this.config.hsts.enabled,
        frameOptionsEnabled: this.config.frameOptions.enabled,
        xssProtectionEnabled: this.config.xssProtection.enabled,
        development: this.config.development
      }
    }
  }

  /**
   * Get top violated CSP directives
   */
  getTopViolatedDirectives(since = 0) {
    const directiveCounts = {}
    
    this.violationLog
      .filter(log => log.timestamp > since && log.type === 'csp_violation')
      .forEach(log => {
        const directive = log.violation.violatedDirective
        directiveCounts[directive] = (directiveCounts[directive] || 0) + 1
      })

    return Object.entries(directiveCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([directive, count]) => ({ directive, count }))
  }

  /**
   * Get top blocked URIs
   */
  getTopBlockedUris(since = 0) {
    const uriCounts = {}
    
    this.violationLog
      .filter(log => log.timestamp > since && log.type === 'csp_violation')
      .forEach(log => {
        const uri = log.violation.blockedUri
        uriCounts[uri] = (uriCounts[uri] || 0) + 1
      })

    return Object.entries(uriCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([uri, count]) => ({ uri, count }))
  }

  /**
   * Get violation log with filters
   */
  getViolationLog(filters = {}) {
    let logs = [...this.violationLog]

    if (filters.type) {
      logs = logs.filter(log => log.type === filters.type)
    }

    if (filters.directive) {
      logs = logs.filter(log => 
        log.violation?.violatedDirective?.includes(filters.directive)
      )
    }

    if (filters.since) {
      logs = logs.filter(log => log.timestamp >= filters.since)
    }

    if (filters.until) {
      logs = logs.filter(log => log.timestamp <= filters.until)
    }

    // Sort by timestamp (newest first)
    logs.sort((a, b) => b.timestamp - a.timestamp)

    // Apply limit
    if (filters.limit) {
      logs = logs.slice(0, filters.limit)
    }

    return {
      logs,
      total: logs.length,
      filters
    }
  }

  /**
   * Clear violation log
   */
  clearViolationLog() {
    this.violationLog.length = 0
    this.emit('violationLogCleared')
  }

  /**
   * Export current configuration
   */
  exportConfig() {
    return {
      csp: { ...this.config.csp },
      hsts: { ...this.config.hsts },
      frameOptions: { ...this.config.frameOptions },
      contentTypeOptions: { ...this.config.contentTypeOptions },
      xssProtection: { ...this.config.xssProtection },
      referrerPolicy: { ...this.config.referrerPolicy },
      permissionsPolicy: { ...this.config.permissionsPolicy },
      customHeaders: { ...this.config.customHeaders }
    }
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    this.nonceCache.clear()
    this.violationLog.length = 0
    this.removeAllListeners()
  }
}

export { SecurityHeadersManager }
export default SecurityHeadersManager