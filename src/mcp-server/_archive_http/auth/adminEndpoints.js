/**
 * Administrative Endpoints for User and Key Management
 * 
 * Provides comprehensive REST API endpoints for managing users, API keys,
 * permissions, sessions, and security settings with proper authorization.
 */

import { EventEmitter } from 'events';
import express from 'express';

export class AdminEndpoints extends EventEmitter {
  constructor(authComponents = {}) {
    super();
    
    // Inject authentication components
    this.jwtManager = authComponents.jwtManager;
    this.apiKeyManager = authComponents.apiKeyManager;
    this.permissionManager = authComponents.permissionManager;
    this.sessionManager = authComponents.sessionManager;
    this.rateLimiter = authComponents.rateLimiter;
    this.auditLogger = authComponents.auditLogger;
    this.corsManager = authComponents.corsManager;
    this.encryptionManager = authComponents.encryptionManager;
    
    // Configuration
    this.adminBasePath = authComponents.adminBasePath || '/admin';
    this.requireSuperAdmin = authComponents.requireSuperAdmin !== false;
    this.enableRateLimiting = authComponents.enableRateLimiting !== false;
    this.enableAuditLog = authComponents.enableAuditLog !== false;
    
    // Admin permissions
    this.adminPermissions = {
      SUPER_ADMIN: 'admin:super',
      USER_MANAGEMENT: 'admin:users',
      KEY_MANAGEMENT: 'admin:keys',
      PERMISSION_MANAGEMENT: 'admin:permissions',
      SESSION_MANAGEMENT: 'admin:sessions',
      SECURITY_MANAGEMENT: 'admin:security',
      AUDIT_ACCESS: 'admin:audit',
      SYSTEM_CONFIG: 'admin:config'
    };
    
    // Create Express router
    this.router = express.Router();
    this.setupMiddleware();
    this.setupRoutes();
    
    this.emit('initialized', {
      basePath: this.adminBasePath,
      endpoints: this.getEndpointList()
    });
  }

  /**
   * Setup middleware for admin endpoints
   */
  setupMiddleware() {
    // Rate limiting
    if (this.enableRateLimiting && this.rateLimiter) {
      this.router.use(async (req, res, next) => {
        const clientId = req.ip || 'unknown';
        const rateLimitResult = await this.rateLimiter.checkRateLimit(clientId, {
          limits: { requestsPerMinute: 30, requestsPerHour: 200 }, // Stricter limits for admin
          ip: req.ip,
          endpoint: req.path,
          userAgent: req.headers['user-agent']
        });
        
        if (!rateLimitResult.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            retryAfter: rateLimitResult.retryAfter
          });
        }
        
        next();
      });
    }
    
    // Authentication middleware
    this.router.use(this.authenticateAdmin.bind(this));
    
    // Audit logging middleware
    if (this.enableAuditLog && this.auditLogger) {
      this.router.use(this.auditMiddleware.bind(this));
    }
    
    // JSON body parser
    this.router.use(express.json({ limit: '10mb' }));
  }

  /**
   * Authentication middleware for admin endpoints
   */
  async authenticateAdmin(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const apiKey = req.headers['x-api-key'];
      
      let authResult = null;
      
      // Try JWT authentication
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const validation = this.jwtManager.validateAccessToken(token);
        
        if (validation.valid) {
          authResult = {
            type: 'jwt',
            userId: validation.userId,
            permissions: validation.permissions,
            scopes: validation.scope
          };
        }
      }
      
      // Try API key authentication
      if (!authResult && apiKey && this.apiKeyManager) {
        const validation = await this.apiKeyManager.validateApiKey(apiKey, {
          clientIP: req.ip,
          userAgent: req.headers['user-agent']
        });
        
        if (validation.valid) {
          authResult = {
            type: 'apikey',
            userId: validation.userId,
            keyId: validation.keyId,
            permissions: validation.permissions,
            scopes: validation.scopes
          };
        }
      }
      
      if (!authResult) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Check admin permissions
      const hasAdminAccess = await this.checkAdminPermissions(authResult, req.path, req.method);
      if (!hasAdminAccess) {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      req.auth = authResult;
      next();
    } catch (error) {
      this.emit('error', { operation: 'admin_auth', error: error.message });
      res.status(500).json({ error: 'Authentication error' });
    }
  }

  /**
   * Check admin permissions
   */
  async checkAdminPermissions(authResult, path, method) {
    if (this.requireSuperAdmin) {
      return await this.permissionManager.hasPermission(
        authResult.userId,
        this.adminPermissions.SUPER_ADMIN
      );
    }
    
    // Granular permission checking based on endpoint
    const requiredPermission = this.getRequiredPermissionForEndpoint(path, method);
    if (!requiredPermission) return true;
    
    return await this.permissionManager.hasPermission(
      authResult.userId,
      requiredPermission
    );
  }

  /**
   * Get required permission for endpoint
   */
  getRequiredPermissionForEndpoint(path, method) {
    const permissionMap = {
      '/users': this.adminPermissions.USER_MANAGEMENT,
      '/api-keys': this.adminPermissions.KEY_MANAGEMENT,
      '/permissions': this.adminPermissions.PERMISSION_MANAGEMENT,
      '/sessions': this.adminPermissions.SESSION_MANAGEMENT,
      '/security': this.adminPermissions.SECURITY_MANAGEMENT,
      '/audit': this.adminPermissions.AUDIT_ACCESS,
      '/config': this.adminPermissions.SYSTEM_CONFIG
    };
    
    for (const [pathPrefix, permission] of Object.entries(permissionMap)) {
      if (path.startsWith(pathPrefix)) {
        return permission;
      }
    }
    
    return this.adminPermissions.SUPER_ADMIN;
  }

  /**
   * Audit middleware
   */
  async auditMiddleware(req, res, next) {
    const startTime = Date.now();
    
    // Capture response
    const originalSend = res.send;
    let responseBody = null;
    
    res.send = function(body) {
      responseBody = body;
      return originalSend.call(this, body);
    };
    
    res.on('finish', async () => {
      try {
        await this.auditLogger.logAdminAction({
          action: `${req.method} ${req.path}`,
          adminUserId: req.auth?.userId,
          targetResource: req.path,
          requestBody: req.body,
          responseStatus: res.statusCode,
          responseTime: Date.now() - startTime,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      } catch (error) {
        this.emit('error', { operation: 'audit_log', error: error.message });
      }
    });
    
    next();
  }

  /**
   * Setup all admin routes
   */
  setupRoutes() {
    // Health and status
    this.router.get('/health', this.getHealth.bind(this));
    this.router.get('/status', this.getStatus.bind(this));
    
    // User management
    this.router.get('/users', this.getUsers.bind(this));
    this.router.get('/users/:userId', this.getUser.bind(this));
    this.router.put('/users/:userId', this.updateUser.bind(this));
    this.router.delete('/users/:userId', this.deleteUser.bind(this));
    this.router.post('/users/:userId/roles', this.assignUserRole.bind(this));
    this.router.delete('/users/:userId/roles/:roleId', this.removeUserRole.bind(this));
    this.router.post('/users/:userId/permissions', this.grantUserPermission.bind(this));
    this.router.delete('/users/:userId/permissions/:permissionId', this.revokeUserPermission.bind(this));
    
    // API key management
    this.router.get('/api-keys', this.getApiKeys.bind(this));
    this.router.post('/api-keys', this.createApiKey.bind(this));
    this.router.get('/api-keys/:keyId', this.getApiKey.bind(this));
    this.router.put('/api-keys/:keyId', this.updateApiKey.bind(this));
    this.router.delete('/api-keys/:keyId', this.deleteApiKey.bind(this));
    this.router.post('/api-keys/:keyId/revoke', this.revokeApiKey.bind(this));
    
    // Permission management
    this.router.get('/permissions', this.getPermissions.bind(this));
    this.router.post('/permissions', this.createPermission.bind(this));
    this.router.get('/roles', this.getRoles.bind(this));
    this.router.post('/roles', this.createRole.bind(this));
    this.router.put('/roles/:roleId', this.updateRole.bind(this));
    this.router.delete('/roles/:roleId', this.deleteRole.bind(this));
    
    // Session management
    this.router.get('/sessions', this.getSessions.bind(this));
    this.router.get('/sessions/:sessionId', this.getSession.bind(this));
    this.router.delete('/sessions/:sessionId', this.revokeSession.bind(this));
    this.router.delete('/users/:userId/sessions', this.revokeUserSessions.bind(this));
    
    // Security management
    this.router.get('/security/stats', this.getSecurityStats.bind(this));
    this.router.get('/security/rate-limits', this.getRateLimitStats.bind(this));
    this.router.post('/security/rate-limits/reset/:clientId', this.resetClientRateLimit.bind(this));
    this.router.get('/security/cors', this.getCorsStats.bind(this));
    this.router.post('/security/cors/origins', this.addCorsOrigin.bind(this));
    this.router.delete('/security/cors/origins', this.removeCorsOrigin.bind(this));
    this.router.post('/security/cors/block', this.blockCorsOrigin.bind(this));
    
    // Audit and logging
    this.router.get('/audit/logs', this.getAuditLogs.bind(this));
    this.router.get('/audit/security-report', this.getSecurityReport.bind(this));
    this.router.get('/audit/compliance-report', this.getComplianceReport.bind(this));
    
    // System configuration
    this.router.get('/config', this.getSystemConfig.bind(this));
    this.router.put('/config', this.updateSystemConfig.bind(this));
    this.router.post('/config/encryption/rotate-keys', this.rotateEncryptionKeys.bind(this));
    this.router.post('/config/jwt/rotate-secrets', this.rotateJwtSecrets.bind(this));
  }

  // Health and Status Endpoints
  async getHealth(req, res) {
    res.json({ status: 'healthy', timestamp: Date.now() });
  }

  async getStatus(req, res) {
    try {
      const status = {
        components: {
          jwt: !!this.jwtManager,
          apiKeys: !!this.apiKeyManager,
          permissions: !!this.permissionManager,
          sessions: !!this.sessionManager,
          rateLimiter: !!this.rateLimiter,
          auditLogger: !!this.auditLogger,
          cors: !!this.corsManager,
          encryption: !!this.encryptionManager
        },
        stats: {
          jwt: this.jwtManager?.getTokenStats(),
          apiKeys: this.apiKeyManager?.getApiKeyStats(),
          permissions: this.permissionManager?.getPermissionStats(),
          sessions: this.sessionManager?.getSessionStats(),
          rateLimiter: this.rateLimiter?.getStats(),
          audit: this.auditLogger?.getAuditStats(),
          cors: this.corsManager?.getStats(),
          encryption: this.encryptionManager?.getEncryptionStats()
        }
      };
      
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // User Management Endpoints
  async getUsers(req, res) {
    try {
      const { page = 1, limit = 50, search, role, status } = req.query;
      const offset = (page - 1) * limit;
      
      // This would integrate with your user management system
      const users = []; // Placeholder
      
      res.json({
        users,
        pagination: { page: parseInt(page), limit: parseInt(limit), total: 0 }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getUser(req, res) {
    try {
      const { userId } = req.params;
      
      const user = {
        id: userId,
        roles: this.permissionManager.getUserRoles(userId),
        permissions: this.permissionManager.getUserPermissions(userId),
        sessions: this.sessionManager.getUserSessions(userId),
        apiKeys: this.apiKeyManager.listApiKeys({ userId }).keys
      };
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async assignUserRole(req, res) {
    try {
      const { userId } = req.params;
      const { roleId } = req.body;
      
      await this.permissionManager.assignRole(userId, roleId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async removeUserRole(req, res) {
    try {
      const { userId, roleId } = req.params;
      
      await this.permissionManager.removeRole(userId, roleId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // API Key Management Endpoints
  async getApiKeys(req, res) {
    try {
      const { userId, active, expired, page = 1, limit = 50 } = req.query;
      const offset = (page - 1) * limit;
      
      const filters = { userId, active, expired, limit: parseInt(limit), offset };
      const result = this.apiKeyManager.listApiKeys(filters);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createApiKey(req, res) {
    try {
      const keyData = await this.apiKeyManager.createApiKey(req.body);
      res.status(201).json(keyData);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updateApiKey(req, res) {
    try {
      const { keyId } = req.params;
      const result = await this.apiKeyManager.updateApiKey(keyId, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async revokeApiKey(req, res) {
    try {
      const { keyId } = req.params;
      const { reason = 'Admin revoked' } = req.body;
      
      await this.apiKeyManager.revokeApiKey(keyId, reason);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Permission Management Endpoints
  async getPermissions(req, res) {
    try {
      const { resource, type, active } = req.query;
      const permissions = this.permissionManager.listPermissions({ resource, type, active });
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createPermission(req, res) {
    try {
      const permission = await this.permissionManager.createPermission(req.body);
      res.status(201).json(permission);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getRoles(req, res) {
    try {
      const { type, active } = req.query;
      const roles = this.permissionManager.listRoles({ type, active });
      res.json(roles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createRole(req, res) {
    try {
      const role = await this.permissionManager.createRole(req.body);
      res.status(201).json(role);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Session Management Endpoints
  async getSessions(req, res) {
    try {
      const { userId, active, page = 1, limit = 50 } = req.query;
      
      if (userId) {
        const sessions = this.sessionManager.getUserSessions(userId);
        res.json({ sessions });
      } else {
        // Get all sessions (admin only)
        res.json({ sessions: [] }); // Implement getAllSessions if needed
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async revokeSession(req, res) {
    try {
      const { sessionId } = req.params;
      const { reason = 'Admin revoked' } = req.body;
      
      await this.sessionManager.revokeSession(sessionId, reason);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async revokeUserSessions(req, res) {
    try {
      const { userId } = req.params;
      const { reason = 'Admin revoked all sessions' } = req.body;
      
      const result = await this.sessionManager.revokeAllUserSessions(userId, reason);
      res.json(result);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Security Management Endpoints
  async getSecurityStats(req, res) {
    try {
      const stats = {
        authentication: this.jwtManager?.getTokenStats(),
        apiKeys: this.apiKeyManager?.getApiKeyStats(),
        rateLimiting: this.rateLimiter?.getStats(),
        sessions: this.sessionManager?.getSessionStats(),
        cors: this.corsManager?.getStats(),
        audit: this.auditLogger?.getAuditStats()
      };
      
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getRateLimitStats(req, res) {
    try {
      const stats = this.rateLimiter.getStats();
      const { clientId } = req.query;
      
      if (clientId) {
        const clientStats = this.rateLimiter.getClientAnalytics(clientId);
        res.json({ general: stats, client: clientStats });
      } else {
        res.json(stats);
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async resetClientRateLimit(req, res) {
    try {
      const { clientId } = req.params;
      await this.rateLimiter.resetClient(clientId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // CORS Management Endpoints
  async getCorsStats(req, res) {
    try {
      const stats = this.corsManager.getStats();
      const analytics = this.corsManager.getOriginAnalytics();
      res.json({ stats, analytics });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async addCorsOrigin(req, res) {
    try {
      const { origin, duration = 3600000, reason } = req.body;
      const result = this.corsManager.addDynamicOrigin(origin, { 
        duration, 
        reason, 
        addedBy: req.auth.userId 
      });
      res.json({ success: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async blockCorsOrigin(req, res) {
    try {
      const { origin, reason = 'Admin blocked' } = req.body;
      const result = this.corsManager.blockOrigin(origin, reason);
      res.json({ success: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  // Audit Endpoints
  async getAuditLogs(req, res) {
    try {
      const filters = req.query;
      const logs = this.auditLogger.getAuditLog(filters);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getSecurityReport(req, res) {
    try {
      const { timeRange } = req.query;
      const report = this.auditLogger.generateSecurityReport(parseInt(timeRange));
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async getComplianceReport(req, res) {
    try {
      const { framework, timeRange } = req.query;
      const report = this.auditLogger.exportComplianceReport(framework, parseInt(timeRange));
      res.json(report);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // System Configuration Endpoints
  async getSystemConfig(req, res) {
    try {
      const config = {
        security: {
          jwtSettings: {
            accessTokenExpiry: this.jwtManager?.accessTokenExpiry,
            refreshTokenExpiry: this.jwtManager?.refreshTokenExpiry,
            algorithm: this.jwtManager?.algorithm
          },
          rateLimiting: this.rateLimiter?.defaultLimits,
          corsSettings: {
            strictMode: this.corsManager?.strictMode,
            allowedOrigins: Array.from(this.corsManager?.staticOrigins || [])
          }
        }
      };
      
      res.json(config);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async rotateEncryptionKeys(req, res) {
    try {
      if (!this.encryptionManager) {
        return res.status(501).json({ error: 'Encryption manager not available' });
      }
      
      const newKeyId = await this.encryptionManager.rotateKeys();
      res.json({ success: true, newKeyId });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get list of all endpoints
   */
  getEndpointList() {
    return [
      'GET /admin/health',
      'GET /admin/status',
      'GET /admin/users',
      'GET /admin/users/:userId',
      'PUT /admin/users/:userId',
      'DELETE /admin/users/:userId',
      'POST /admin/users/:userId/roles',
      'DELETE /admin/users/:userId/roles/:roleId',
      'GET /admin/api-keys',
      'POST /admin/api-keys',
      'GET /admin/api-keys/:keyId',
      'PUT /admin/api-keys/:keyId',
      'DELETE /admin/api-keys/:keyId',
      'POST /admin/api-keys/:keyId/revoke',
      'GET /admin/permissions',
      'POST /admin/permissions',
      'GET /admin/roles',
      'POST /admin/roles',
      'PUT /admin/roles/:roleId',
      'DELETE /admin/roles/:roleId',
      'GET /admin/sessions',
      'GET /admin/sessions/:sessionId',
      'DELETE /admin/sessions/:sessionId',
      'DELETE /admin/users/:userId/sessions',
      'GET /admin/security/stats',
      'GET /admin/security/rate-limits',
      'POST /admin/security/rate-limits/reset/:clientId',
      'GET /admin/security/cors',
      'POST /admin/security/cors/origins',
      'DELETE /admin/security/cors/origins',
      'POST /admin/security/cors/block',
      'GET /admin/audit/logs',
      'GET /admin/audit/security-report',
      'GET /admin/audit/compliance-report',
      'GET /admin/config',
      'PUT /admin/config',
      'POST /admin/config/encryption/rotate-keys',
      'POST /admin/config/jwt/rotate-secrets'
    ];
  }

  /**
   * Get Express router
   */
  getRouter() {
    return this.router;
  }

  /**
   * Shutdown and cleanup
   */
  shutdown() {
    this.removeAllListeners();
  }
}

export default AdminEndpoints;