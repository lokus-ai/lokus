/**
 * Comprehensive Security Audit Logging System
 * 
 * Provides detailed security event logging, real-time monitoring,
 * compliance reporting, and forensic analysis capabilities.
 */

import crypto from 'crypto';
import winston from 'winston';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class AuditLogger extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.logLevel = options.logLevel || 'info';
    this.logPath = options.logPath || './logs';
    this.enableFileLogging = options.enableFileLogging !== false;
    this.enableConsoleLogging = options.enableConsoleLogging || false;
    this.enableRemoteLogging = options.enableRemoteLogging || false;
    this.enableRealTimeAlerts = options.enableRealTimeAlerts !== false;
    this.enableCompliance = options.enableCompliance !== false;
    this.enableForensics = options.enableForensics !== false;
    
    // Log rotation settings
    this.maxFileSize = options.maxFileSize || '20m';
    this.maxFiles = options.maxFiles || 14;
    this.datePattern = options.datePattern || 'YYYY-MM-DD';
    
    // Security settings
    this.enableLogIntegrity = options.enableLogIntegrity !== false;
    this.logEncryption = options.logEncryption || false;
    this.encryptionKey = options.encryptionKey || this.generateEncryptionKey();
    this.enableAnonymization = options.enableAnonymization || false;
    
    // Event categorization
    this.eventCategories = {
      AUTHENTICATION: 'authentication',
      AUTHORIZATION: 'authorization',
      ACCESS_CONTROL: 'access_control',
      SESSION_MANAGEMENT: 'session_management',
      API_ACCESS: 'api_access',
      RATE_LIMITING: 'rate_limiting',
      SECURITY_VIOLATION: 'security_violation',
      ADMIN_ACTION: 'admin_action',
      SYSTEM_EVENT: 'system_event',
      DATA_ACCESS: 'data_access',
      CONFIGURATION: 'configuration',
      ERROR: 'error'
    };
    
    // Alert thresholds
    this.alertThresholds = {
      failedLogins: options.failedLoginThreshold || 5,
      rateLimitViolations: options.rateLimitThreshold || 10,
      suspiciousActivity: options.suspiciousActivityThreshold || 3,
      timeWindow: options.alertTimeWindow || 300000 // 5 minutes
    };
    
    // In-memory storage for real-time analysis
    this.recentEvents = new Map(); // eventType -> events[]
    this.alertCounters = new Map(); // alertType -> { count, windowStart }
    this.securityMetrics = {
      totalEvents: 0,
      securityViolations: 0,
      alertsTriggered: 0,
      categoryCounts: new Map()
    };
    
    // Compliance tracking
    this.complianceEvents = [];
    this.retentionPeriod = options.retentionPeriod || 365 * 24 * 60 * 60 * 1000; // 1 year
    
    // Initialize logger
    this.initializeLogger();
    this.startCleanupTimer();
  }

  /**
   * Initialize Winston logger with multiple transports
   */
  initializeLogger() {
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.json(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const logEntry = {
          timestamp,
          level,
          message,
          ...meta
        };
        
        // Add integrity hash if enabled
        if (this.enableLogIntegrity) {
          logEntry.integrity = this.generateIntegrityHash(logEntry);
        }
        
        return JSON.stringify(logEntry);
      })
    );

    const transports = [];

    // Console transport
    if (this.enableConsoleLogging) {
      transports.push(new winston.transports.Console({
        level: this.logLevel,
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }));
    }

    // File transports
    if (this.enableFileLogging) {
      // Security events log
      transports.push(new winston.transports.File({
        filename: path.join(this.logPath, 'security.log'),
        level: 'info',
        format: logFormat,
        maxsize: this.parseSize(this.maxFileSize),
        maxFiles: this.maxFiles,
        tailable: true
      }));

      // Error log
      transports.push(new winston.transports.File({
        filename: path.join(this.logPath, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: this.parseSize(this.maxFileSize),
        maxFiles: this.maxFiles,
        tailable: true
      }));

      // Audit log (all events)
      transports.push(new winston.transports.File({
        filename: path.join(this.logPath, 'audit.log'),
        level: 'debug',
        format: logFormat,
        maxsize: this.parseSize(this.maxFileSize),
        maxFiles: this.maxFiles,
        tailable: true
      }));
    }

    this.logger = winston.createLogger({
      level: this.logLevel,
      format: logFormat,
      transports,
      exitOnError: false
    });

    this.emit('loggerInitialized', { 
      transports: transports.length,
      logPath: this.logPath,
      enableIntegrity: this.enableLogIntegrity
    });
  }

  /**
   * Log security event
   */
  async logSecurityEvent(eventData) {
    try {
      const event = this.enrichEvent(eventData);
      
      // Update metrics
      this.securityMetrics.totalEvents++;
      const category = event.category || 'unknown';
      this.securityMetrics.categoryCounts.set(
        category, 
        (this.securityMetrics.categoryCounts.get(category) || 0) + 1
      );
      
      // Check for security violations
      if (this.isSecurityViolation(event)) {
        this.securityMetrics.securityViolations++;
        event.securityViolation = true;
      }
      
      // Store in recent events for real-time analysis
      this.storeRecentEvent(event);
      
      // Check for alert conditions
      await this.checkAlertConditions(event);
      
      // Log compliance events
      if (this.enableCompliance && this.isComplianceEvent(event)) {
        this.logComplianceEvent(event);
      }
      
      // Anonymize sensitive data if enabled
      if (this.enableAnonymization) {
        event = this.anonymizeEvent(event);
      }
      
      // Log the event
      this.logger.log(event.severity || 'info', event.message, event);
      
      // Emit event for real-time processing
      this.emit('securityEvent', event);
      
      return event.eventId;
    } catch (error) {
      this.emit('error', { operation: 'log_security_event', error: error.message });
      throw error;
    }
  }

  /**
   * Log authentication event
   */
  async logAuthentication(authData) {
    const event = {
      category: this.eventCategories.AUTHENTICATION,
      action: authData.action, // 'login_attempt', 'login_success', 'login_failure', 'logout'
      userId: authData.userId,
      clientId: authData.clientId,
      ipAddress: authData.ipAddress,
      userAgent: authData.userAgent,
      method: authData.method, // 'password', 'api_key', 'jwt', 'oauth'
      sessionId: authData.sessionId,
      reason: authData.reason,
      success: authData.success,
      message: `Authentication ${authData.action}: ${authData.success ? 'SUCCESS' : 'FAILURE'}`,
      severity: authData.success ? 'info' : 'warn'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log authorization event
   */
  async logAuthorization(authzData) {
    const event = {
      category: this.eventCategories.AUTHORIZATION,
      action: authzData.action, // 'permission_check', 'access_denied', 'access_granted'
      userId: authzData.userId,
      resource: authzData.resource,
      operation: authzData.operation,
      permissions: authzData.permissions,
      result: authzData.result,
      reason: authzData.reason,
      message: `Authorization ${authzData.action}: ${authzData.result}`,
      severity: authzData.result === 'denied' ? 'warn' : 'info'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log API access event
   */
  async logApiAccess(apiData) {
    const event = {
      category: this.eventCategories.API_ACCESS,
      action: 'api_request',
      userId: apiData.userId,
      apiKey: apiData.apiKey ? this.hashSensitiveData(apiData.apiKey) : null,
      endpoint: apiData.endpoint,
      method: apiData.method,
      statusCode: apiData.statusCode,
      responseTime: apiData.responseTime,
      requestSize: apiData.requestSize,
      responseSize: apiData.responseSize,
      ipAddress: apiData.ipAddress,
      userAgent: apiData.userAgent,
      message: `API ${apiData.method} ${apiData.endpoint} - ${apiData.statusCode}`,
      severity: apiData.statusCode >= 400 ? 'warn' : 'info'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log rate limiting event
   */
  async logRateLimit(rateLimitData) {
    const event = {
      category: this.eventCategories.RATE_LIMITING,
      action: rateLimitData.action, // 'rate_limit_exceeded', 'rate_limit_warning'
      clientId: rateLimitData.clientId,
      userId: rateLimitData.userId,
      limitType: rateLimitData.limitType, // 'minute', 'hour', 'day', 'burst'
      limit: rateLimitData.limit,
      used: rateLimitData.used,
      remaining: rateLimitData.remaining,
      retryAfter: rateLimitData.retryAfter,
      ipAddress: rateLimitData.ipAddress,
      endpoint: rateLimitData.endpoint,
      message: `Rate limit ${rateLimitData.action}: ${rateLimitData.limitType} limit exceeded`,
      severity: 'warn'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log session management event
   */
  async logSessionEvent(sessionData) {
    const event = {
      category: this.eventCategories.SESSION_MANAGEMENT,
      action: sessionData.action, // 'session_created', 'session_validated', 'session_expired', 'session_revoked'
      sessionId: sessionData.sessionId,
      userId: sessionData.userId,
      deviceId: sessionData.deviceId,
      ipAddress: sessionData.ipAddress,
      userAgent: sessionData.userAgent,
      reason: sessionData.reason,
      duration: sessionData.duration,
      message: `Session ${sessionData.action}`,
      severity: sessionData.action === 'session_revoked' ? 'warn' : 'info'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log admin action
   */
  async logAdminAction(adminData) {
    const event = {
      category: this.eventCategories.ADMIN_ACTION,
      action: adminData.action,
      adminUserId: adminData.adminUserId,
      targetUserId: adminData.targetUserId,
      targetResource: adminData.targetResource,
      changes: adminData.changes,
      reason: adminData.reason,
      ipAddress: adminData.ipAddress,
      message: `Admin action: ${adminData.action}`,
      severity: 'warn'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(violationData) {
    const event = {
      category: this.eventCategories.SECURITY_VIOLATION,
      action: violationData.action,
      violationType: violationData.type, // 'suspicious_activity', 'policy_violation', 'intrusion_attempt'
      severity: violationData.severity || 'error',
      userId: violationData.userId,
      clientId: violationData.clientId,
      ipAddress: violationData.ipAddress,
      userAgent: violationData.userAgent,
      description: violationData.description,
      evidence: violationData.evidence,
      riskScore: violationData.riskScore,
      message: `Security violation: ${violationData.type}`,
      securityViolation: true
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Log data access event
   */
  async logDataAccess(dataAccessData) {
    const event = {
      category: this.eventCategories.DATA_ACCESS,
      action: dataAccessData.action, // 'read', 'write', 'delete', 'export'
      userId: dataAccessData.userId,
      resourceType: dataAccessData.resourceType,
      resourceId: dataAccessData.resourceId,
      dataClassification: dataAccessData.dataClassification, // 'public', 'internal', 'confidential', 'restricted'
      accessMethod: dataAccessData.accessMethod,
      recordCount: dataAccessData.recordCount,
      success: dataAccessData.success,
      message: `Data ${dataAccessData.action}: ${dataAccessData.resourceType}`,
      severity: dataAccessData.dataClassification === 'restricted' ? 'warn' : 'info'
    };
    
    return this.logSecurityEvent(event);
  }

  /**
   * Enrich event with additional metadata
   */
  enrichEvent(eventData) {
    const eventId = crypto.randomUUID();
    const timestamp = Date.now();
    
    return {
      eventId,
      timestamp,
      server: process.env.SERVER_ID || 'unknown',
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      correlationId: eventData.correlationId || crypto.randomBytes(16).toString('hex'),
      ...eventData
    };
  }

  /**
   * Check if event is a security violation
   */
  isSecurityViolation(event) {
    const violations = [
      event.category === this.eventCategories.SECURITY_VIOLATION,
      event.action === 'login_failure' && event.category === this.eventCategories.AUTHENTICATION,
      event.action === 'access_denied' && event.category === this.eventCategories.AUTHORIZATION,
      event.action === 'rate_limit_exceeded' && event.category === this.eventCategories.RATE_LIMITING,
      event.statusCode >= 400 && event.category === this.eventCategories.API_ACCESS
    ];
    
    return violations.some(Boolean);
  }

  /**
   * Check if event requires compliance logging
   */
  isComplianceEvent(event) {
    const complianceCategories = [
      this.eventCategories.AUTHENTICATION,
      this.eventCategories.AUTHORIZATION,
      this.eventCategories.DATA_ACCESS,
      this.eventCategories.ADMIN_ACTION,
      this.eventCategories.SECURITY_VIOLATION
    ];
    
    return complianceCategories.includes(event.category);
  }

  /**
   * Store event for real-time analysis
   */
  storeRecentEvent(event) {
    const eventType = `${event.category}:${event.action}`;
    
    if (!this.recentEvents.has(eventType)) {
      this.recentEvents.set(eventType, []);
    }
    
    const events = this.recentEvents.get(eventType);
    events.push(event);
    
    // Keep only recent events (last hour)
    const oneHourAgo = Date.now() - 3600000;
    this.recentEvents.set(eventType, events.filter(e => e.timestamp > oneHourAgo));
  }

  /**
   * Check for alert conditions
   */
  async checkAlertConditions(event) {
    if (!this.enableRealTimeAlerts) return;
    
    const now = Date.now();
    const alertChecks = [
      () => this.checkFailedLoginAlert(event, now),
      () => this.checkRateLimitAlert(event, now),
      () => this.checkSuspiciousActivityAlert(event, now),
      () => this.checkSecurityViolationAlert(event, now)
    ];
    
    for (const check of alertChecks) {
      const alert = check();
      if (alert) {
        await this.triggerAlert(alert);
      }
    }
  }

  /**
   * Check for failed login alerts
   */
  checkFailedLoginAlert(event, now) {
    if (event.category !== this.eventCategories.AUTHENTICATION || event.success) {
      return null;
    }
    
    const alertKey = `failed_login:${event.userId || event.ipAddress}`;
    const counter = this.getAlertCounter(alertKey, now);
    
    if (counter.count >= this.alertThresholds.failedLogins) {
      return {
        type: 'failed_login_threshold',
        severity: 'high',
        description: `Multiple failed login attempts detected`,
        data: {
          userId: event.userId,
          ipAddress: event.ipAddress,
          attempts: counter.count,
          timeWindow: this.alertThresholds.timeWindow
        }
      };
    }
    
    return null;
  }

  /**
   * Check for rate limit alerts
   */
  checkRateLimitAlert(event, now) {
    if (event.category !== this.eventCategories.RATE_LIMITING) {
      return null;
    }
    
    const alertKey = `rate_limit:${event.clientId || event.ipAddress}`;
    const counter = this.getAlertCounter(alertKey, now);
    
    if (counter.count >= this.alertThresholds.rateLimitViolations) {
      return {
        type: 'rate_limit_violation',
        severity: 'medium',
        description: `Repeated rate limit violations detected`,
        data: {
          clientId: event.clientId,
          ipAddress: event.ipAddress,
          violations: counter.count,
          timeWindow: this.alertThresholds.timeWindow
        }
      };
    }
    
    return null;
  }

  /**
   * Check for suspicious activity alerts
   */
  checkSuspiciousActivityAlert(event, now) {
    if (!event.securityViolation) {
      return null;
    }
    
    const alertKey = `suspicious:${event.userId || event.ipAddress}`;
    const counter = this.getAlertCounter(alertKey, now);
    
    if (counter.count >= this.alertThresholds.suspiciousActivity) {
      return {
        type: 'suspicious_activity',
        severity: 'high',
        description: `Suspicious activity pattern detected`,
        data: {
          userId: event.userId,
          ipAddress: event.ipAddress,
          incidents: counter.count,
          timeWindow: this.alertThresholds.timeWindow
        }
      };
    }
    
    return null;
  }

  /**
   * Check for security violation alerts
   */
  checkSecurityViolationAlert(event, now) {
    if (event.category !== this.eventCategories.SECURITY_VIOLATION) {
      return null;
    }
    
    return {
      type: 'security_violation',
      severity: event.severity || 'high',
      description: `Security violation detected: ${event.violationType}`,
      data: {
        violationType: event.violationType,
        userId: event.userId,
        ipAddress: event.ipAddress,
        riskScore: event.riskScore,
        evidence: event.evidence
      }
    };
  }

  /**
   * Get or create alert counter
   */
  getAlertCounter(alertKey, now) {
    let counter = this.alertCounters.get(alertKey);
    
    if (!counter || now - counter.windowStart > this.alertThresholds.timeWindow) {
      counter = { count: 0, windowStart: now };
      this.alertCounters.set(alertKey, counter);
    }
    
    counter.count++;
    return counter;
  }

  /**
   * Trigger security alert
   */
  async triggerAlert(alert) {
    try {
      this.securityMetrics.alertsTriggered++;
      
      const alertEvent = {
        alertId: crypto.randomUUID(),
        type: alert.type,
        severity: alert.severity,
        description: alert.description,
        data: alert.data,
        timestamp: Date.now(),
        status: 'triggered'
      };
      
      // Log the alert
      this.logger.error('Security alert triggered', alertEvent);
      
      // Emit alert for real-time handling
      this.emit('securityAlert', alertEvent);
      
      // Send to external systems if configured
      if (this.enableRemoteLogging) {
        await this.sendRemoteAlert(alertEvent);
      }
      
      return alertEvent;
    } catch (error) {
      this.emit('error', { operation: 'trigger_alert', error: error.message });
    }
  }

  /**
   * Log compliance event
   */
  logComplianceEvent(event) {
    const complianceEvent = {
      eventId: event.eventId,
      timestamp: event.timestamp,
      category: event.category,
      action: event.action,
      userId: event.userId,
      resourceType: event.resourceType,
      dataClassification: event.dataClassification,
      retentionRequired: true,
      complianceFrameworks: this.getApplicableFrameworks(event)
    };
    
    this.complianceEvents.push(complianceEvent);
    
    // Limit compliance events size
    if (this.complianceEvents.length > 50000) {
      this.complianceEvents = this.complianceEvents.slice(-25000);
    }
  }

  /**
   * Get applicable compliance frameworks
   */
  getApplicableFrameworks(event) {
    const frameworks = [];
    
    // GDPR - for any user data access
    if (event.userId || event.dataClassification) {
      frameworks.push('GDPR');
    }
    
    // SOX - for admin actions and configuration changes
    if (event.category === this.eventCategories.ADMIN_ACTION || 
        event.category === this.eventCategories.CONFIGURATION) {
      frameworks.push('SOX');
    }
    
    // HIPAA - for restricted data access
    if (event.dataClassification === 'restricted') {
      frameworks.push('HIPAA');
    }
    
    // PCI-DSS - for payment-related operations
    if (event.resourceType && event.resourceType.includes('payment')) {
      frameworks.push('PCI-DSS');
    }
    
    return frameworks;
  }

  /**
   * Anonymize sensitive event data
   */
  anonymizeEvent(event) {
    const anonymized = { ...event };
    
    // Hash sensitive identifiers
    if (anonymized.userId) {
      anonymized.userId = this.hashSensitiveData(anonymized.userId);
    }
    
    if (anonymized.ipAddress) {
      anonymized.ipAddress = this.anonymizeIP(anonymized.ipAddress);
    }
    
    if (anonymized.userAgent) {
      anonymized.userAgent = this.anonymizeUserAgent(anonymized.userAgent);
    }
    
    return anonymized;
  }

  /**
   * Hash sensitive data
   */
  hashSensitiveData(data) {
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Anonymize IP address
   */
  anonymizeIP(ip) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.xxx.xxx`;
    }
    return 'xxx.xxx.xxx.xxx';
  }

  /**
   * Anonymize user agent
   */
  anonymizeUserAgent(userAgent) {
    // Keep browser/OS info but remove version details
    return userAgent.replace(/[\d.]+/g, 'x.x');
  }

  /**
   * Generate integrity hash for log entry
   */
  generateIntegrityHash(logEntry) {
    const data = JSON.stringify(logEntry, Object.keys(logEntry).sort());
    return crypto.createHash('sha256').update(data + this.encryptionKey).digest('hex');
  }

  /**
   * Generate encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Parse file size string
   */
  parseSize(sizeStr) {
    const units = { k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = sizeStr.toLowerCase().match(/^(\d+)([kmg]?)$/);
    
    if (match) {
      const size = parseInt(match[1]);
      const unit = match[2] || '';
      return size * (units[unit] || 1);
    }
    
    return 20 * 1024 * 1024; // Default 20MB
  }

  /**
   * Search audit logs
   */
  async searchLogs(criteria = {}) {
    try {
      const {
        category = null,
        action = null,
        userId = null,
        startTime = null,
        endTime = null,
        severity = null,
        ipAddress = null,
        limit = 1000,
        offset = 0
      } = criteria;
      
      // Filter recent events in memory first
      let results = [];
      
      for (const events of this.recentEvents.values()) {
        for (const event of events) {
          let matches = true;
          
          if (category && event.category !== category) matches = false;
          if (action && event.action !== action) matches = false;
          if (userId && event.userId !== userId) matches = false;
          if (severity && event.severity !== severity) matches = false;
          if (ipAddress && event.ipAddress !== ipAddress) matches = false;
          if (startTime && event.timestamp < startTime) matches = false;
          if (endTime && event.timestamp > endTime) matches = false;
          
          if (matches) {
            results.push(event);
          }
        }
      }
      
      // Sort by timestamp (newest first)
      results.sort((a, b) => b.timestamp - a.timestamp);
      
      // Apply pagination
      const total = results.length;
      results = results.slice(offset, offset + limit);
      
      return {
        results,
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      };
    } catch (error) {
      this.emit('error', { operation: 'search_logs', error: error.message });
      throw error;
    }
  }

  /**
   * Generate security report
   */
  generateSecurityReport(timeRange = 86400000) { // 24 hours
    const now = Date.now();
    const startTime = now - timeRange;
    
    const report = {
      reportId: crypto.randomUUID(),
      generatedAt: now,
      timeRange: { start: startTime, end: now },
      summary: { ...this.securityMetrics },
      categories: {},
      topViolations: [],
      alertsSummary: {
        total: this.securityMetrics.alertsTriggered,
        byType: new Map(),
        bySeverity: new Map()
      },
      recommendations: []
    };
    
    // Analyze events by category
    for (const [category, count] of this.securityMetrics.categoryCounts) {
      report.categories[category] = count;
    }
    
    // Generate recommendations based on violations
    if (this.securityMetrics.securityViolations > 100) {
      report.recommendations.push('Consider implementing stricter rate limiting');
    }
    
    if (this.securityMetrics.alertsTriggered > 50) {
      report.recommendations.push('Review and tune alert thresholds');
    }
    
    return report;
  }

  /**
   * Export compliance report
   */
  exportComplianceReport(framework = null, timeRange = null) {
    const now = Date.now();
    const startTime = timeRange ? now - timeRange : now - (365 * 24 * 60 * 60 * 1000); // 1 year default
    
    let events = this.complianceEvents.filter(event => 
      event.timestamp >= startTime && 
      event.timestamp <= now
    );
    
    if (framework) {
      events = events.filter(event => 
        event.complianceFrameworks.includes(framework)
      );
    }
    
    return {
      reportId: crypto.randomUUID(),
      framework,
      generatedAt: now,
      timeRange: { start: startTime, end: now },
      totalEvents: events.length,
      events: events.sort((a, b) => b.timestamp - a.timestamp),
      retention: {
        required: true,
        period: this.retentionPeriod,
        expiresAt: now + this.retentionPeriod
      }
    };
  }

  /**
   * Get audit statistics
   */
  getAuditStats() {
    return {
      ...this.securityMetrics,
      recentEventsCount: Array.from(this.recentEvents.values())
        .reduce((sum, events) => sum + events.length, 0),
      complianceEventsCount: this.complianceEvents.length,
      alertCountersActive: this.alertCounters.size,
      categoryCounts: Object.fromEntries(this.securityMetrics.categoryCounts)
    };
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldData();
    }, 3600000); // Run every hour
  }

  /**
   * Cleanup old data
   */
  cleanupOldData() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    const retentionLimit = now - this.retentionPeriod;
    
    // Clean recent events
    for (const [eventType, events] of this.recentEvents) {
      const filtered = events.filter(event => event.timestamp > oneHourAgo);
      if (filtered.length === 0) {
        this.recentEvents.delete(eventType);
      } else {
        this.recentEvents.set(eventType, filtered);
      }
    }
    
    // Clean alert counters
    for (const [alertKey, counter] of this.alertCounters) {
      if (now - counter.windowStart > this.alertThresholds.timeWindow) {
        this.alertCounters.delete(alertKey);
      }
    }
    
    // Clean compliance events (respect retention period)
    this.complianceEvents = this.complianceEvents.filter(event => 
      event.timestamp > retentionLimit
    );
  }

  /**
   * Send remote alert (placeholder for external integrations)
   */
  async sendRemoteAlert(alert) {
    // Implement integration with external systems like:
    // - SIEM systems
    // - Slack/Teams notifications
    // - Email alerts
    // - PagerDuty/OpsGenie
    this.emit('remoteAlert', alert);
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Close Winston logger
    if (this.logger) {
      this.logger.close();
    }
    
    // Clear in-memory data
    this.recentEvents.clear();
    this.alertCounters.clear();
    this.complianceEvents.length = 0;
    this.removeAllListeners();
  }
}

export default AuditLogger;