/**
 * Production-Ready Authentication Middleware for MCP Server
 * 
 * Provides comprehensive authentication and authorization with JWT tokens,
 * API keys, permissions, sessions, rate limiting, and audit logging.
 */

import { EventEmitter } from 'events';
import JWTManager from './jwt.js';
import APIKeyManager from './apiKeyManager.js';
import PermissionManager from './permissionManager.js';
import SessionManager from './sessionManager.js';
import RateLimiter from './rateLimiter.js';
import AuditLogger from './auditLogger.js';
import CORSManager from '../security/cors.js';
import DataEncryptionManager from './dataEncryption.js';
import AdminEndpoints from './adminEndpoints.js';

export default class AuthenticationMiddleware extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.options = options;
    this.environment = options.environment || process.env.NODE_ENV || 'development';
    this.enableAuthentication = options.enableAuthentication !== false;
    this.enableAuthorization = options.enableAuthorization !== false;
    this.enableRateLimiting = options.enableRateLimiting !== false;
    this.enableAuditLogging = options.enableAuditLogging !== false;
    this.enableEncryption = options.enableEncryption !== false;
    this.enableAdminEndpoints = options.enableAdminEndpoints !== false;
    
    // Initialize components
    this.initializeComponents();
    
    // Request context storage
    this.requestContexts = new Map();
    
    this.emit('initialized', {
      environment: this.environment,
      components: this.getComponentStatus(),
      features: this.getEnabledFeatures()
    });
  }

  /**
   * Initialize all authentication components
   */
  initializeComponents() {
    try {
      // JWT Manager
      this.jwtManager = new JWTManager({
        accessTokenSecret: this.options.jwtAccessSecret,
        refreshTokenSecret: this.options.jwtRefreshSecret,
        accessTokenExpiry: this.options.jwtAccessExpiry || '15m',
        refreshTokenExpiry: this.options.jwtRefreshExpiry || '7d',
        issuer: this.options.jwtIssuer || 'lokus-mcp-server',
        audience: this.options.jwtAudience || 'lokus-client',
        enableAuditing: this.enableAuditLogging
      });

      // API Key Manager
      this.apiKeyManager = new APIKeyManager({
        storagePath: this.options.apiKeyStoragePath,
        encryptionKey: this.options.apiKeyEncryptionKey,
        enableAuditLog: this.enableAuditLogging,
        enableRateLimiting: this.enableRateLimiting
      });

      // Permission Manager
      this.permissionManager = new PermissionManager({
        permissionsPath: this.options.permissionsPath,
        rolesPath: this.options.rolesPath,
        enableAuditLog: this.enableAuditLogging,
        enableCaching: true
      });

      // Session Manager
      this.sessionManager = new SessionManager({
        sessionTimeout: this.options.sessionTimeout,
        sessionIdleTimeout: this.options.sessionIdleTimeout,
        maxSessionsPerUser: this.options.maxSessionsPerUser,
        enableMultiDevice: this.options.enableMultiDevice,
        enableAuditLog: this.enableAuditLogging
      });

      // Rate Limiter
      if (this.enableRateLimiting) {
        this.rateLimiter = new RateLimiter({
          algorithm: this.options.rateLimitAlgorithm || 'sliding_window',
          requestsPerMinute: this.options.requestsPerMinute || 60,
          requestsPerHour: this.options.requestsPerHour || 1000,
          requestsPerDay: this.options.requestsPerDay || 10000,
          enableBurstProtection: true,
          enableAdaptiveRateLimit: this.environment === 'production'
        });
      }

      // CORS Manager
      this.corsManager = new CORSManager({
        allowedOrigins: this.options.corsAllowedOrigins,
        strictMode: this.environment === 'production',
        enableSecurityChecks: true,
        enableAuditLog: this.enableAuditLogging
      });

      // Audit Logger
      if (this.enableAuditLogging) {
        this.auditLogger = new AuditLogger({
          logPath: this.options.auditLogPath || './logs',
          enableFileLogging: true,
          enableRealTimeAlerts: this.environment === 'production',
          enableCompliance: this.options.enableCompliance
        });
      }

      // Data Encryption Manager
      if (this.enableEncryption) {
        this.encryptionManager = new DataEncryptionManager({
          keyStoragePath: this.options.encryptionKeyPath,
          enableKeyRotation: this.environment === 'production',
          enableFieldLevelEncryption: true,
          enableAuditLog: this.enableAuditLogging
        });
      }

      // Admin Endpoints
      if (this.enableAdminEndpoints) {
        this.adminEndpoints = new AdminEndpoints({
          jwtManager: this.jwtManager,
          apiKeyManager: this.apiKeyManager,
          permissionManager: this.permissionManager,
          sessionManager: this.sessionManager,
          rateLimiter: this.rateLimiter,
          auditLogger: this.auditLogger,
          corsManager: this.corsManager,
          encryptionManager: this.encryptionManager,
          requireSuperAdmin: this.environment === 'production'
        });
      }

      // Setup component event listeners
      this.setupEventListeners();
      
    } catch (error) {
      this.emit('error', { operation: 'initialize_components', error: error.message });
      throw error;
    }
  }

  /**
   * Setup event listeners between components
   */
  setupEventListeners() {
    // JWT events
    this.jwtManager.on('tokenGenerated', (data) => {
      if (this.auditLogger) {
        this.auditLogger.logAuthentication({
          action: 'token_generated',
          userId: data.userId,
          clientId: data.clientId,
          success: true,
          method: 'jwt'
        });
      }
    });

    // API Key events
    this.apiKeyManager.on('keyCreated', (data) => {
      if (this.auditLogger) {
        this.auditLogger.logAuthentication({
          action: 'api_key_created',
          userId: data.userId,
          clientId: data.clientId,
          success: true,
          method: 'api_key'
        });
      }
    });

    // Session events
    this.sessionManager.on('sessionCreated', (data) => {
      if (this.auditLogger) {
        this.auditLogger.logSessionEvent({
          action: 'session_created',
          sessionId: data.sessionId,
          userId: data.userId,
          deviceId: data.deviceId
        });
      }
    });

    // Rate limit events
    if (this.rateLimiter) {
      this.rateLimiter.on('requestBlocked', (data) => {
        if (this.auditLogger) {
          this.auditLogger.logRateLimit({
            action: 'rate_limit_exceeded',
            clientId: data.clientId,
            reason: data.reason
          });
        }
      });
    }

    // Security violation events
    if (this.auditLogger) {
      this.on('securityViolation', (data) => {
        this.auditLogger.logSecurityViolation(data);
      });
    }
  }

  /**
   * Main authentication middleware
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const requestId = this.generateRequestId();
        req.requestId = requestId;
        
        // Start request context
        const context = this.createRequestContext(req);
        this.requestContexts.set(requestId, context);
        
        // CORS handling
        if (req.method === 'OPTIONS') {
          return this.corsManager.handlePreflightRequest(req, res, req.headers.origin);
        }
        
        this.corsManager.handleActualRequest(req, res, req.headers.origin);
        
        // Rate limiting
        if (this.enableRateLimiting) {
          const rateLimitResult = await this.checkRateLimit(req);
          if (!rateLimitResult.allowed) {
            this.logSecurityViolation(req, 'rate_limit_exceeded', rateLimitResult);
            return res.status(429).json({
              error: 'Rate limit exceeded',
              retryAfter: rateLimitResult.retryAfter
            });
          }
        }
        
        // Authentication
        if (this.enableAuthentication) {
          const authResult = await this.performAuthentication(req);
          if (!authResult.success) {
            this.logSecurityViolation(req, 'authentication_failed', authResult);
            return res.status(401).json({ error: authResult.error });
          }
          
          req.auth = authResult.auth;
          context.auth = authResult.auth;
        }
        
        // Authorization
        if (this.enableAuthorization && req.auth) {
          const authzResult = await this.performAuthorization(req);
          if (!authzResult.success) {
            this.logSecurityViolation(req, 'authorization_failed', authzResult);
            return res.status(403).json({ error: authzResult.error });
          }
        }
        
        // Audit logging
        if (this.enableAuditLogging) {
          this.logApiAccess(req, context);
        }
        
        // Complete request after response
        res.on('finish', () => {
          this.completeRequest(requestId, req, res);
        });
        
        next();
      } catch (error) {
        this.emit('error', { operation: 'authenticate_middleware', error: error.message });
        res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  /**
   * Perform authentication using multiple methods
   */
  async performAuthentication(req) {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];
    
    // Try JWT authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const validation = this.jwtManager.validateAccessToken(token);
      
      if (validation.valid) {
        return {
          success: true,
          auth: {
            type: 'jwt',
            userId: validation.userId,
            clientId: validation.clientId,
            permissions: validation.permissions,
            scopes: validation.scope
          }
        };
      } else {
        return { success: false, error: 'Invalid JWT token', details: validation };
      }
    }
    
    // Try API Key authentication
    if (apiKey) {
      const validation = await this.apiKeyManager.validateApiKey(apiKey, {
        clientIP: req.ip,
        userAgent: req.headers['user-agent']
      });
      
      if (validation.valid) {
        return {
          success: true,
          auth: {
            type: 'apikey',
            userId: validation.userId,
            clientId: validation.clientId,
            keyId: validation.keyId,
            permissions: validation.permissions,
            scopes: validation.scopes
          }
        };
      } else {
        return { success: false, error: 'Invalid API key', details: validation };
      }
    }
    
    // Check if authentication is required for this endpoint
    if (this.isPublicEndpoint(req.path)) {
      return { success: true, auth: null };
    }
    
    return { success: false, error: 'Authentication required' };
  }

  /**
   * Perform authorization checks
   */
  async performAuthorization(req) {
    if (!req.auth) {
      return { success: true }; // No auth, no authz needed
    }
    
    const requiredPermissions = this.getRequiredPermissions(req.path, req.method);
    if (requiredPermissions.length === 0) {
      return { success: true }; // No permissions required
    }
    
    for (const permission of requiredPermissions) {
      const hasPermission = await this.permissionManager.hasPermission(
        req.auth.userId,
        permission,
        {
          clientIP: req.ip,
          userAgent: req.headers['user-agent'],
          resourceId: req.params.id
        }
      );
      
      if (!hasPermission) {
        return {
          success: false,
          error: 'Insufficient permissions',
          required: permission
        };
      }
    }
    
    return { success: true };
  }

  /**
   * Check rate limiting
   */
  async checkRateLimit(req) {
    if (!this.rateLimiter) {
      return { allowed: true };
    }
    
    const clientId = req.auth?.userId || req.ip || 'anonymous';
    
    return await this.rateLimiter.checkRateLimit(clientId, {
      ip: req.ip,
      endpoint: req.path,
      method: req.method,
      userAgent: req.headers['user-agent']
    });
  }

  /**
   * Generate API key
   */
  async generateAPIKey(name, permissions = {}, options = {}) {
    try {
      return await this.apiKeyManager.createApiKey({
        name,
        permissions,
        ...options
      });
    } catch (error) {
      this.emit('error', { operation: 'generate_api_key', error: error.message });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateAPIKey(key, context = {}) {
    try {
      return await this.apiKeyManager.validateApiKey(key, context);
    } catch (error) {
      this.emit('error', { operation: 'validate_api_key', error: error.message });
      return { valid: false, error: 'Validation error' };
    }
  }

  /**
   * Check permissions
   */
  async hasPermission(userId, permission, context = {}) {
    try {
      return await this.permissionManager.hasPermission(userId, permission, context);
    } catch (error) {
      this.emit('error', { operation: 'check_permission', error: error.message });
      return false;
    }
  }

  /**
   * Revoke API key
   */
  async revokeAPIKey(keyId, reason = 'Revoked by admin') {
    try {
      return await this.apiKeyManager.revokeApiKey(keyId, reason);
    } catch (error) {
      this.emit('error', { operation: 'revoke_api_key', error: error.message });
      throw error;
    }
  }

  /**
   * Create request context
   */
  createRequestContext(req) {
    return {
      requestId: req.requestId,
      startTime: Date.now(),
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      method: req.method,
      path: req.path,
      auth: null
    };
  }

  /**
   * Complete request processing
   */
  completeRequest(requestId, req, res) {
    const context = this.requestContexts.get(requestId);
    if (!context) return;
    
    const endTime = Date.now();
    const duration = endTime - context.startTime;
    
    // Mark concurrent request as complete
    if (this.rateLimiter && req.auth) {
      const clientId = req.auth.userId || req.ip;
      this.rateLimiter.completeRequest(clientId);
    }
    
    // Log API access
    if (this.auditLogger) {
      this.auditLogger.logApiAccess({
        userId: req.auth?.userId,
        apiKey: req.headers['x-api-key'] ? 'present' : null,
        endpoint: req.path,
        method: req.method,
        statusCode: res.statusCode,
        responseTime: duration,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });
    }
    
    // Cleanup
    this.requestContexts.delete(requestId);
  }

  /**
   * Log security violation
   */
  logSecurityViolation(req, type, details) {
    this.emit('securityViolation', {
      type,
      userId: req.auth?.userId,
      clientId: req.auth?.clientId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      method: req.method,
      details
    });
  }

  /**
   * Log API access
   */
  logApiAccess(req, context) {
    if (!this.auditLogger) return;
    
    this.auditLogger.logApiAccess({
      userId: req.auth?.userId,
      endpoint: req.path,
      method: req.method,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.requestId
    });
  }

  /**
   * Check if endpoint is public
   */
  isPublicEndpoint(path) {
    const publicPaths = [
      '/health',
      '/status',
      '/api/auth/login',
      '/api/auth/register',
      '/docs',
      '/api/docs'
    ];
    
    return publicPaths.some(publicPath => path.startsWith(publicPath));
  }

  /**
   * Get required permissions for endpoint
   */
  getRequiredPermissions(path, method) {
    const permissionMap = {
      '/api/files': ['files:read', 'files:write', 'files:delete'],
      '/api/notes': ['notes:read', 'notes:write'],
      '/api/workspace': ['workspace:read', 'workspace:write'],
      '/api/search': ['search:query'],
      '/api/ai': ['ai:query'],
      '/api/admin': ['admin:access']
    };
    
    for (const [pathPrefix, permissions] of Object.entries(permissionMap)) {
      if (path.startsWith(pathPrefix)) {
        if (method === 'GET') return [permissions[0]]; // Read permission
        if (method === 'POST' || method === 'PUT') return [permissions[1]]; // Write permission
        if (method === 'DELETE') return [permissions[2] || permissions[1]]; // Delete or write
      }
    }
    
    return [];
  }

  /**
   * Generate request ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get component status
   */
  getComponentStatus() {
    return {
      jwt: !!this.jwtManager,
      apiKeys: !!this.apiKeyManager,
      permissions: !!this.permissionManager,
      sessions: !!this.sessionManager,
      rateLimiter: !!this.rateLimiter,
      auditLogger: !!this.auditLogger,
      cors: !!this.corsManager,
      encryption: !!this.encryptionManager,
      adminEndpoints: !!this.adminEndpoints
    };
  }

  /**
   * Get enabled features
   */
  getEnabledFeatures() {
    return {
      authentication: this.enableAuthentication,
      authorization: this.enableAuthorization,
      rateLimiting: this.enableRateLimiting,
      auditLogging: this.enableAuditLogging,
      encryption: this.enableEncryption,
      adminEndpoints: this.enableAdminEndpoints
    };
  }

  /**
   * Get comprehensive statistics
   */
  getStats() {
    return {
      environment: this.environment,
      components: this.getComponentStatus(),
      features: this.getEnabledFeatures(),
      stats: {
        jwt: this.jwtManager?.getTokenStats(),
        apiKeys: this.apiKeyManager?.getApiKeyStats(),
        permissions: this.permissionManager?.getPermissionStats(),
        sessions: this.sessionManager?.getSessionStats(),
        rateLimiter: this.rateLimiter?.getStats(),
        audit: this.auditLogger?.getAuditStats(),
        cors: this.corsManager?.getStats(),
        encryption: this.encryptionManager?.getEncryptionStats()
      },
      activeRequests: this.requestContexts.size
    };
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    if (!this.auditLogger) {
      return { entries: [], total: 0 };
    }
    
    return this.auditLogger.getAuditLog(filters);
  }

  /**
   * Get admin router
   */
  getAdminRouter() {
    return this.adminEndpoints?.getRouter();
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    try {
      // Shutdown all components
      if (this.jwtManager) this.jwtManager.shutdown();
      if (this.apiKeyManager) await this.apiKeyManager.shutdown();
      if (this.permissionManager) await this.permissionManager.shutdown();
      if (this.sessionManager) await this.sessionManager.shutdown();
      if (this.rateLimiter) await this.rateLimiter.shutdown();
      if (this.auditLogger) await this.auditLogger.shutdown();
      if (this.corsManager) this.corsManager.shutdown();
      if (this.encryptionManager) await this.encryptionManager.shutdown();
      if (this.adminEndpoints) this.adminEndpoints.shutdown();
      
      // Clear request contexts
      this.requestContexts.clear();
      
      this.removeAllListeners();
    } catch (error) {
      this.emit('error', { operation: 'shutdown', error: error.message });
    }
  }
}

export function createAuthMiddleware(options = {}) {
  return new AuthenticationMiddleware(options);
}