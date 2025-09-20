/**
 * Production-Ready Session Management System
 * 
 * Provides comprehensive session management with secure storage,
 * session tracking, logout functionality, and multi-device support.
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class SessionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.sessionTimeout = options.sessionTimeout || 3600000; // 1 hour
    this.sessionIdleTimeout = options.sessionIdleTimeout || 1800000; // 30 minutes
    this.maxSessionsPerUser = options.maxSessionsPerUser || 5;
    this.sessionStorage = options.sessionStorage || 'memory'; // 'memory', 'redis', 'file'
    this.storagePath = options.storagePath || './data/sessions.json';
    this.redisClient = options.redisClient || null;
    this.sessionPrefix = options.sessionPrefix || 'mcp_session:';
    this.enableMultiDevice = options.enableMultiDevice !== false;
    this.enableSessionRotation = options.enableSessionRotation !== false;
    this.enableGeoTracking = options.enableGeoTracking || false;
    this.enableAuditLog = options.enableAuditLog !== false;
    
    // Session storage
    this.sessions = new Map(); // sessionId -> session data
    this.userSessions = new Map(); // userId -> Set<sessionId>
    this.deviceSessions = new Map(); // deviceId -> Set<sessionId>
    this.auditLog = [];
    
    // Session monitoring
    this.sessionMetrics = {
      totalSessions: 0,
      activeSessions: 0,
      expiredSessions: 0,
      loggedOutSessions: 0,
      concurrentUsers: 0,
      averageSessionDuration: 0
    };
    
    // Cleanup and monitoring
    this.cleanupInterval = options.cleanupInterval || 300000; // 5 minutes
    this.maxAuditLogSize = options.maxAuditLogSize || 10000;
    
    // Initialize
    this.init();
  }

  /**
   * Initialize session manager
   */
  async init() {
    try {
      await this.loadSessions();
      this.startCleanupTimer();
      this.startMetricsTimer();
      
      this.emit('initialized', {
        activeSessions: this.sessions.size,
        activeUsers: this.userSessions.size,
        storage: this.sessionStorage
      });
    } catch (error) {
      this.emit('error', { operation: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Create new session
   */
  async createSession(options = {}) {
    try {
      const {
        userId,
        clientId = null,
        deviceId = null,
        deviceInfo = {},
        ipAddress = null,
        userAgent = null,
        location = null,
        metadata = {},
        permissions = [],
        scopes = []
      } = options;

      if (!userId) {
        throw new Error('User ID is required for session creation');
      }

      // Check session limits per user
      if (this.enableMultiDevice) {
        const userSessionCount = this.getUserSessionCount(userId);
        if (userSessionCount >= this.maxSessionsPerUser) {
          // Remove oldest session
          await this.removeOldestUserSession(userId);
        }
      } else {
        // Single device mode - revoke existing sessions
        await this.revokeAllUserSessions(userId, 'new_session_created');
      }

      // Generate session ID and data
      const sessionId = this.generateSessionId();
      const now = Date.now();
      
      const sessionData = {
        sessionId,
        userId,
        clientId,
        deviceId,
        deviceInfo,
        ipAddress,
        userAgent,
        location,
        metadata,
        permissions,
        scopes,
        
        // Timestamps
        createdAt: now,
        lastAccessedAt: now,
        expiresAt: now + this.sessionTimeout,
        
        // Session state
        status: 'active',
        loginMethod: options.loginMethod || 'unknown',
        
        // Security
        refreshCount: 0,
        maxRefreshCount: options.maxRefreshCount || 10,
        securityFlags: {
          suspiciousActivity: false,
          ipChanged: false,
          userAgentChanged: false,
          concurrentLoginAttempt: false
        },
        
        // Activity tracking
        activityLog: [{
          action: 'session_created',
          timestamp: now,
          ipAddress,
          userAgent
        }],
        
        // Device tracking
        deviceFingerprint: this.generateDeviceFingerprint(deviceInfo, userAgent, ipAddress)
      };

      // Store session
      this.sessions.set(sessionId, sessionData);
      
      // Update user session mapping
      if (!this.userSessions.has(userId)) {
        this.userSessions.set(userId, new Set());
      }
      this.userSessions.get(userId).add(sessionId);
      
      // Update device session mapping
      if (deviceId) {
        if (!this.deviceSessions.has(deviceId)) {
          this.deviceSessions.set(deviceId, new Set());
        }
        this.deviceSessions.get(deviceId).add(sessionId);
      }

      // Save to persistent storage
      await this.saveSessions();
      
      // Update metrics
      this.sessionMetrics.totalSessions++;
      this.sessionMetrics.activeSessions++;
      this.updateConcurrentUsers();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'session_created',
          sessionId,
          userId,
          clientId,
          deviceId,
          ipAddress,
          userAgent,
          loginMethod: options.loginMethod
        });
      }

      this.emit('sessionCreated', { sessionId, userId, deviceId, sessionData });

      return {
        sessionId,
        expiresAt: sessionData.expiresAt,
        deviceId,
        permissions,
        scopes
      };
    } catch (error) {
      this.emit('error', { operation: 'create_session', userId: options.userId, error: error.message });
      throw error;
    }
  }

  /**
   * Validate and refresh session
   */
  async validateSession(sessionId, options = {}) {
    try {
      const {
        ipAddress = null,
        userAgent = null,
        updateLastAccessed = true
      } = options;

      const session = this.sessions.get(sessionId);
      if (!session) {
        return { valid: false, error: 'Session not found' };
      }

      const now = Date.now();

      // Check if session is active
      if (session.status !== 'active') {
        return { valid: false, error: 'Session not active', status: session.status };
      }

      // Check expiration
      if (now > session.expiresAt) {
        await this.expireSession(sessionId, 'timeout');
        return { valid: false, error: 'Session expired', expired: true };
      }

      // Check idle timeout
      if (now - session.lastAccessedAt > this.sessionIdleTimeout) {
        await this.expireSession(sessionId, 'idle_timeout');
        return { valid: false, error: 'Session idle timeout', expired: true };
      }

      // Security checks
      const securityCheck = this.performSecurityChecks(session, { ipAddress, userAgent });
      if (!securityCheck.passed) {
        if (securityCheck.suspicious) {
          session.securityFlags.suspiciousActivity = true;
          this.emit('suspiciousActivity', {
            sessionId,
            userId: session.userId,
            reason: securityCheck.reason,
            ipAddress,
            userAgent
          });
        }
        
        if (securityCheck.terminate) {
          await this.revokeSession(sessionId, securityCheck.reason);
          return { valid: false, error: 'Session terminated due to security violation' };
        }
      }

      // Update session activity
      if (updateLastAccessed) {
        session.lastAccessedAt = now;
        
        // Extend session if rotation is enabled
        if (this.enableSessionRotation && session.refreshCount < session.maxRefreshCount) {
          session.expiresAt = now + this.sessionTimeout;
          session.refreshCount++;
        }

        // Add activity log entry
        session.activityLog.push({
          action: 'session_accessed',
          timestamp: now,
          ipAddress,
          userAgent
        });

        // Limit activity log size
        if (session.activityLog.length > 100) {
          session.activityLog = session.activityLog.slice(-50);
        }
      }

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'session_validated',
          sessionId,
          userId: session.userId,
          ipAddress,
          userAgent
        });
      }

      return {
        valid: true,
        session: {
          sessionId: session.sessionId,
          userId: session.userId,
          clientId: session.clientId,
          deviceId: session.deviceId,
          permissions: session.permissions,
          scopes: session.scopes,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt,
          expiresAt: session.expiresAt,
          metadata: session.metadata
        }
      };
    } catch (error) {
      this.emit('error', { operation: 'validate_session', sessionId, error: error.message });
      return { valid: false, error: 'Session validation error' };
    }
  }

  /**
   * Logout session
   */
  async logout(sessionId, reason = 'user_logout') {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      const userId = session.userId;

      // Update session status
      session.status = 'logged_out';
      session.logoutAt = Date.now();
      session.logoutReason = reason;

      // Add logout activity
      session.activityLog.push({
        action: 'session_logout',
        timestamp: session.logoutAt,
        reason
      });

      // Remove from active sessions
      this.sessions.delete(sessionId);

      // Update user session mapping
      const userSessions = this.userSessions.get(userId);
      if (userSessions) {
        userSessions.delete(sessionId);
        if (userSessions.size === 0) {
          this.userSessions.delete(userId);
        }
      }

      // Update device session mapping
      if (session.deviceId) {
        const deviceSessions = this.deviceSessions.get(session.deviceId);
        if (deviceSessions) {
          deviceSessions.delete(sessionId);
          if (deviceSessions.size === 0) {
            this.deviceSessions.delete(session.deviceId);
          }
        }
      }

      // Update metrics
      this.sessionMetrics.activeSessions = Math.max(0, this.sessionMetrics.activeSessions - 1);
      this.sessionMetrics.loggedOutSessions++;
      this.updateConcurrentUsers();

      // Save changes
      await this.saveSessions();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'session_logout',
          sessionId,
          userId,
          reason,
          deviceId: session.deviceId
        });
      }

      this.emit('sessionLogout', { sessionId, userId, reason });

      return { success: true, sessionId, userId };
    } catch (error) {
      this.emit('error', { operation: 'logout', sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Logout all sessions for a user
   */
  async logoutAllUserSessions(userId, reason = 'user_logout_all') {
    try {
      const userSessions = this.userSessions.get(userId);
      if (!userSessions) {
        return { success: true, loggedOutSessions: 0 };
      }

      const sessionIds = Array.from(userSessions);
      let loggedOutCount = 0;

      for (const sessionId of sessionIds) {
        try {
          await this.logout(sessionId, reason);
          loggedOutCount++;
        } catch (error) {
          this.emit('error', { operation: 'logout_user_session', sessionId, userId, error: error.message });
        }
      }

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'user_logout_all',
          userId,
          reason,
          loggedOutSessions: loggedOutCount
        });
      }

      this.emit('userLogoutAll', { userId, reason, loggedOutCount });

      return { success: true, loggedOutSessions: loggedOutCount };
    } catch (error) {
      this.emit('error', { operation: 'logout_all_user_sessions', userId, error: error.message });
      throw error;
    }
  }

  /**
   * Revoke session (forced termination)
   */
  async revokeSession(sessionId, reason = 'admin_revoked') {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return { success: false, error: 'Session not found' };
      }

      session.status = 'revoked';
      session.revokedAt = Date.now();
      session.revocationReason = reason;

      const result = await this.logout(sessionId, reason);

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'session_revoked',
          sessionId,
          userId: session.userId,
          reason,
          adminAction: true
        });
      }

      this.emit('sessionRevoked', { sessionId, userId: session.userId, reason });

      return result;
    } catch (error) {
      this.emit('error', { operation: 'revoke_session', sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Revoke all user sessions
   */
  async revokeAllUserSessions(userId, reason = 'admin_revoked') {
    const result = await this.logoutAllUserSessions(userId, reason);
    
    if (this.enableAuditLog) {
      this.addAuditEntry({
        action: 'user_sessions_revoked',
        userId,
        reason,
        adminAction: true,
        revokedSessions: result.loggedOutSessions
      });
    }

    return result;
  }

  /**
   * Get user sessions
   */
  getUserSessions(userId) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions) {
      return [];
    }

    return Array.from(userSessions).map(sessionId => {
      const session = this.sessions.get(sessionId);
      return session ? {
        sessionId: session.sessionId,
        deviceId: session.deviceId,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        userAgent: session.userAgent,
        location: session.location,
        createdAt: session.createdAt,
        lastAccessedAt: session.lastAccessedAt,
        expiresAt: session.expiresAt,
        status: session.status,
        loginMethod: session.loginMethod,
        securityFlags: session.securityFlags
      } : null;
    }).filter(Boolean);
  }

  /**
   * Get session details
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }

    return {
      sessionId: session.sessionId,
      userId: session.userId,
      clientId: session.clientId,
      deviceId: session.deviceId,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      location: session.location,
      metadata: session.metadata,
      permissions: session.permissions,
      scopes: session.scopes,
      createdAt: session.createdAt,
      lastAccessedAt: session.lastAccessedAt,
      expiresAt: session.expiresAt,
      status: session.status,
      loginMethod: session.loginMethod,
      refreshCount: session.refreshCount,
      securityFlags: session.securityFlags,
      activityLog: session.activityLog.slice(-10) // Last 10 activities
    };
  }

  /**
   * Update session metadata
   */
  async updateSessionMetadata(sessionId, metadata) {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      session.metadata = { ...session.metadata, ...metadata };
      session.lastAccessedAt = Date.now();

      await this.saveSessions();

      return { success: true };
    } catch (error) {
      this.emit('error', { operation: 'update_session_metadata', sessionId, error: error.message });
      throw error;
    }
  }

  /**
   * Perform security checks on session
   */
  performSecurityChecks(session, context = {}) {
    const checks = {
      passed: true,
      suspicious: false,
      terminate: false,
      reason: null
    };

    // IP address change detection
    if (context.ipAddress && session.ipAddress && context.ipAddress !== session.ipAddress) {
      session.securityFlags.ipChanged = true;
      checks.suspicious = true;
      checks.reason = 'IP address changed';
      
      // Terminate if too many IP changes
      const ipChanges = session.activityLog.filter(log => 
        log.ipAddress && log.ipAddress !== session.ipAddress
      ).length;
      
      if (ipChanges > 3) {
        checks.terminate = true;
      }
    }

    // User agent change detection
    if (context.userAgent && session.userAgent && context.userAgent !== session.userAgent) {
      session.securityFlags.userAgentChanged = true;
      checks.suspicious = true;
      checks.reason = checks.reason ? checks.reason + ', User agent changed' : 'User agent changed';
    }

    // Concurrent login detection
    const userSessions = this.userSessions.get(session.userId);
    if (userSessions && userSessions.size > this.maxSessionsPerUser) {
      session.securityFlags.concurrentLoginAttempt = true;
      checks.suspicious = true;
      checks.reason = checks.reason ? checks.reason + ', Too many concurrent sessions' : 'Too many concurrent sessions';
    }

    // Session refresh limit
    if (session.refreshCount >= session.maxRefreshCount) {
      checks.terminate = true;
      checks.reason = 'Maximum refresh count exceeded';
    }

    return checks;
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    const timestamp = Date.now().toString(36);
    const randomBytes = crypto.randomBytes(32).toString('hex');
    return `ses_${timestamp}_${randomBytes}`;
  }

  /**
   * Generate device fingerprint
   */
  generateDeviceFingerprint(deviceInfo, userAgent, ipAddress) {
    const fingerprintData = JSON.stringify({
      userAgent: userAgent || '',
      screen: deviceInfo.screen || '',
      timezone: deviceInfo.timezone || '',
      language: deviceInfo.language || '',
      platform: deviceInfo.platform || '',
      ipAddress: ipAddress || ''
    });

    return crypto.createHash('sha256').update(fingerprintData).digest('hex');
  }

  /**
   * Get user session count
   */
  getUserSessionCount(userId) {
    const userSessions = this.userSessions.get(userId);
    return userSessions ? userSessions.size : 0;
  }

  /**
   * Remove oldest user session
   */
  async removeOldestUserSession(userId) {
    const userSessions = this.userSessions.get(userId);
    if (!userSessions || userSessions.size === 0) {
      return;
    }

    let oldestSession = null;
    let oldestTime = Date.now();

    for (const sessionId of userSessions) {
      const session = this.sessions.get(sessionId);
      if (session && session.createdAt < oldestTime) {
        oldestTime = session.createdAt;
        oldestSession = sessionId;
      }
    }

    if (oldestSession) {
      await this.logout(oldestSession, 'session_limit_exceeded');
    }
  }

  /**
   * Expire session
   */
  async expireSession(sessionId, reason = 'timeout') {
    try {
      const session = this.sessions.get(sessionId);
      if (!session) {
        return;
      }

      session.status = 'expired';
      session.expiredAt = Date.now();
      session.expirationReason = reason;

      await this.logout(sessionId, reason);

      this.sessionMetrics.expiredSessions++;

      this.emit('sessionExpired', { sessionId, userId: session.userId, reason });
    } catch (error) {
      this.emit('error', { operation: 'expire_session', sessionId, error: error.message });
    }
  }

  /**
   * Update concurrent users metric
   */
  updateConcurrentUsers() {
    this.sessionMetrics.concurrentUsers = this.userSessions.size;
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    const now = Date.now();
    const allSessions = Array.from(this.sessions.values());
    
    // Calculate average session duration
    const completedSessions = allSessions.filter(s => s.logoutAt || s.expiredAt);
    const totalDuration = completedSessions.reduce((sum, session) => {
      const endTime = session.logoutAt || session.expiredAt || now;
      return sum + (endTime - session.createdAt);
    }, 0);
    
    this.sessionMetrics.averageSessionDuration = completedSessions.length > 0 
      ? totalDuration / completedSessions.length 
      : 0;

    return {
      ...this.sessionMetrics,
      activeSessions: this.sessions.size,
      activeUsers: this.userSessions.size,
      activeDevices: this.deviceSessions.size,
      sessionsByStatus: {
        active: allSessions.filter(s => s.status === 'active').length,
        expired: allSessions.filter(s => s.status === 'expired').length,
        revoked: allSessions.filter(s => s.status === 'revoked').length,
        loggedOut: allSessions.filter(s => s.status === 'logged_out').length
      }
    };
  }

  /**
   * Add audit log entry
   */
  addAuditEntry(entry) {
    if (!this.enableAuditLog) return;

    this.auditLog.push({
      ...entry,
      timestamp: Date.now(),
      id: crypto.randomUUID()
    });

    // Limit audit log size
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-Math.floor(this.maxAuditLogSize / 2));
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    const {
      action = null,
      userId = null,
      sessionId = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = filters;

    let entries = [...this.auditLog];

    // Apply filters
    if (action) entries = entries.filter(entry => entry.action === action);
    if (userId) entries = entries.filter(entry => entry.userId === userId);
    if (sessionId) entries = entries.filter(entry => entry.sessionId === sessionId);
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
      this.cleanupExpiredSessions();
    }, this.cleanupInterval);
  }

  /**
   * Start metrics timer
   */
  startMetricsTimer() {
    this.metricsTimer = setInterval(() => {
      this.updateMetrics();
    }, 60000); // Update every minute
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions() {
    const now = Date.now();
    const expiredSessions = [];

    for (const [sessionId, session] of this.sessions) {
      if (now > session.expiresAt || 
          (now - session.lastAccessedAt > this.sessionIdleTimeout)) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.expireSession(sessionId, 
        now - this.sessions.get(sessionId).lastAccessedAt > this.sessionIdleTimeout 
          ? 'idle_timeout' 
          : 'timeout'
      );
    }

    if (expiredSessions.length > 0) {
      this.emit('cleanupCompleted', { expiredSessions: expiredSessions.length });
    }
  }

  /**
   * Update metrics
   */
  updateMetrics() {
    this.updateConcurrentUsers();
    this.emit('metricsUpdated', this.getSessionStats());
  }

  /**
   * Load sessions from persistent storage
   */
  async loadSessions() {
    if (this.sessionStorage === 'file') {
      try {
        const dir = path.dirname(this.storagePath);
        await fs.mkdir(dir, { recursive: true });

        try {
          const data = await fs.readFile(this.storagePath, 'utf8');
          const parsed = JSON.parse(data);
          
          if (parsed.sessions) {
            this.sessions = new Map(parsed.sessions);
          }
          
          if (parsed.userSessions) {
            this.userSessions = new Map(parsed.userSessions.map(([userId, sessionIds]) => [
              userId, new Set(sessionIds)
            ]));
          }
          
          if (parsed.deviceSessions) {
            this.deviceSessions = new Map(parsed.deviceSessions.map(([deviceId, sessionIds]) => [
              deviceId, new Set(sessionIds)
            ]));
          }
          
          if (parsed.auditLog) {
            this.auditLog = parsed.auditLog.slice(-this.maxAuditLogSize);
          }
        } catch (error) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      } catch (error) {
        throw new Error(`Failed to load sessions: ${error.message}`);
      }
    }
  }

  /**
   * Save sessions to persistent storage
   */
  async saveSessions() {
    if (this.sessionStorage === 'file') {
      try {
        const data = {
          sessions: Array.from(this.sessions.entries()),
          userSessions: Array.from(this.userSessions.entries()).map(([userId, sessionIds]) => [
            userId, Array.from(sessionIds)
          ]),
          deviceSessions: Array.from(this.deviceSessions.entries()).map(([deviceId, sessionIds]) => [
            deviceId, Array.from(sessionIds)
          ]),
          auditLog: this.auditLog.slice(-1000),
          savedAt: Date.now()
        };

        const dir = path.dirname(this.storagePath);
        await fs.mkdir(dir, { recursive: true });
        
        await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
      } catch (error) {
        throw new Error(`Failed to save sessions: ${error.message}`);
      }
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
    }

    try {
      await this.saveSessions();
    } catch (error) {
      this.emit('error', { operation: 'shutdown_save', error: error.message });
    }

    this.sessions.clear();
    this.userSessions.clear();
    this.deviceSessions.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
  }
}

export default SessionManager;