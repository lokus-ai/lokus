/**
 * Granular Permission System for MCP Operations
 * 
 * Provides fine-grained access control for MCP server operations,
 * including resource-based permissions, role-based access control,
 * and dynamic permission evaluation.
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class PermissionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.permissionsPath = options.permissionsPath || './data/permissions.json';
    this.rolesPath = options.rolesPath || './data/roles.json';
    this.enableAuditLog = options.enableAuditLog !== false;
    this.enableCaching = options.enableCaching !== false;
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    
    // Permission storage
    this.permissions = new Map(); // permission_id -> permission definition
    this.roles = new Map(); // role_id -> role definition
    this.userRoles = new Map(); // user_id -> Set<role_id>
    this.userPermissions = new Map(); // user_id -> Set<permission_id>
    this.resourcePermissions = new Map(); // resource_type -> Map<resource_id, permissions>
    
    // Permission cache for performance
    this.permissionCache = new Map(); // cache_key -> { result, timestamp }
    this.auditLog = [];
    
    // Initialize default MCP permissions
    this.initializeDefaultPermissions();
    this.initializeDefaultRoles();
    
    // Load persisted data
    this.init();
  }

  /**
   * Initialize the permission manager
   */
  async init() {
    try {
      await this.loadPermissions();
      await this.loadRoles();
      this.startCacheCleanup();
      
      this.emit('initialized', {
        permissions: this.permissions.size,
        roles: this.roles.size,
        userRoles: this.userRoles.size
      });
    } catch (error) {
      this.emit('error', { operation: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Initialize default MCP permissions
   */
  initializeDefaultPermissions() {
    const defaultPermissions = [
      // File operations
      { id: 'files:read', name: 'Read Files', description: 'Read file contents', resource: 'files', action: 'read' },
      { id: 'files:write', name: 'Write Files', description: 'Create and modify files', resource: 'files', action: 'write' },
      { id: 'files:delete', name: 'Delete Files', description: 'Delete files', resource: 'files', action: 'delete' },
      { id: 'files:list', name: 'List Files', description: 'List directory contents', resource: 'files', action: 'list' },
      { id: 'files:execute', name: 'Execute Files', description: 'Execute files and scripts', resource: 'files', action: 'execute' },
      
      // Workspace operations
      { id: 'workspace:read', name: 'Read Workspace', description: 'Access workspace data', resource: 'workspace', action: 'read' },
      { id: 'workspace:write', name: 'Write Workspace', description: 'Modify workspace settings', resource: 'workspace', action: 'write' },
      { id: 'workspace:manage', name: 'Manage Workspace', description: 'Full workspace management', resource: 'workspace', action: 'manage' },
      
      // Note operations
      { id: 'notes:read', name: 'Read Notes', description: 'Read note contents', resource: 'notes', action: 'read' },
      { id: 'notes:write', name: 'Write Notes', description: 'Create and modify notes', resource: 'notes', action: 'write' },
      { id: 'notes:delete', name: 'Delete Notes', description: 'Delete notes', resource: 'notes', action: 'delete' },
      { id: 'notes:share', name: 'Share Notes', description: 'Share notes with others', resource: 'notes', action: 'share' },
      
      // Search operations
      { id: 'search:query', name: 'Search Query', description: 'Perform search queries', resource: 'search', action: 'query' },
      { id: 'search:index', name: 'Search Index', description: 'Manage search index', resource: 'search', action: 'index' },
      
      // AI operations
      { id: 'ai:query', name: 'AI Query', description: 'Make AI assistant queries', resource: 'ai', action: 'query' },
      { id: 'ai:train', name: 'AI Training', description: 'Access AI training features', resource: 'ai', action: 'train' },
      
      // System operations
      { id: 'system:read', name: 'System Read', description: 'Read system information', resource: 'system', action: 'read' },
      { id: 'system:monitor', name: 'System Monitor', description: 'Monitor system status', resource: 'system', action: 'monitor' },
      { id: 'system:admin', name: 'System Admin', description: 'System administration', resource: 'system', action: 'admin' },
      
      // API operations
      { id: 'api:read', name: 'API Read', description: 'Read-only API access', resource: 'api', action: 'read' },
      { id: 'api:write', name: 'API Write', description: 'Write API access', resource: 'api', action: 'write' },
      { id: 'api:admin', name: 'API Admin', description: 'Administrative API access', resource: 'api', action: 'admin' },
      
      // Plugin operations
      { id: 'plugins:read', name: 'Read Plugins', description: 'View plugin information', resource: 'plugins', action: 'read' },
      { id: 'plugins:install', name: 'Install Plugins', description: 'Install new plugins', resource: 'plugins', action: 'install' },
      { id: 'plugins:manage', name: 'Manage Plugins', description: 'Enable/disable plugins', resource: 'plugins', action: 'manage' },
      { id: 'plugins:develop', name: 'Develop Plugins', description: 'Plugin development access', resource: 'plugins', action: 'develop' },
      
      // Resource management
      { id: 'resources:read', name: 'Read Resources', description: 'Access MCP resources', resource: 'resources', action: 'read' },
      { id: 'resources:write', name: 'Write Resources', description: 'Modify MCP resources', resource: 'resources', action: 'write' },
      { id: 'resources:manage', name: 'Manage Resources', description: 'Full resource management', resource: 'resources', action: 'manage' },
      
      // Tool operations
      { id: 'tools:execute', name: 'Execute Tools', description: 'Execute MCP tools', resource: 'tools', action: 'execute' },
      { id: 'tools:manage', name: 'Manage Tools', description: 'Manage tool configurations', resource: 'tools', action: 'manage' },
      
      // Prompt operations
      { id: 'prompts:read', name: 'Read Prompts', description: 'Access prompt templates', resource: 'prompts', action: 'read' },
      { id: 'prompts:write', name: 'Write Prompts', description: 'Create prompt templates', resource: 'prompts', action: 'write' },
      { id: 'prompts:manage', name: 'Manage Prompts', description: 'Full prompt management', resource: 'prompts', action: 'manage' }
    ];

    defaultPermissions.forEach(permission => {
      this.permissions.set(permission.id, {
        ...permission,
        type: 'system',
        createdAt: Date.now(),
        active: true
      });
    });
  }

  /**
   * Initialize default roles
   */
  initializeDefaultRoles() {
    const defaultRoles = [
      {
        id: 'viewer',
        name: 'Viewer',
        description: 'Read-only access to most resources',
        permissions: [
          'files:read', 'files:list',
          'workspace:read',
          'notes:read',
          'search:query',
          'system:read', 'system:monitor',
          'api:read',
          'plugins:read',
          'resources:read',
          'prompts:read'
        ],
        priority: 1
      },
      {
        id: 'editor',
        name: 'Editor',
        description: 'Can read and modify content',
        permissions: [
          'files:read', 'files:write', 'files:list',
          'workspace:read', 'workspace:write',
          'notes:read', 'notes:write',
          'search:query',
          'ai:query',
          'system:read', 'system:monitor',
          'api:read', 'api:write',
          'plugins:read',
          'resources:read', 'resources:write',
          'tools:execute',
          'prompts:read', 'prompts:write'
        ],
        priority: 2
      },
      {
        id: 'contributor',
        name: 'Contributor',
        description: 'Can create, modify, and share content',
        permissions: [
          'files:read', 'files:write', 'files:list', 'files:delete',
          'workspace:read', 'workspace:write',
          'notes:read', 'notes:write', 'notes:delete', 'notes:share',
          'search:query', 'search:index',
          'ai:query',
          'system:read', 'system:monitor',
          'api:read', 'api:write',
          'plugins:read', 'plugins:install',
          'resources:read', 'resources:write',
          'tools:execute',
          'prompts:read', 'prompts:write'
        ],
        priority: 3
      },
      {
        id: 'developer',
        name: 'Developer',
        description: 'Full development access',
        permissions: [
          'files:read', 'files:write', 'files:list', 'files:delete', 'files:execute',
          'workspace:read', 'workspace:write', 'workspace:manage',
          'notes:read', 'notes:write', 'notes:delete', 'notes:share',
          'search:query', 'search:index',
          'ai:query', 'ai:train',
          'system:read', 'system:monitor',
          'api:read', 'api:write',
          'plugins:read', 'plugins:install', 'plugins:manage', 'plugins:develop',
          'resources:read', 'resources:write', 'resources:manage',
          'tools:execute', 'tools:manage',
          'prompts:read', 'prompts:write', 'prompts:manage'
        ],
        priority: 4
      },
      {
        id: 'admin',
        name: 'Administrator',
        description: 'Full system access',
        permissions: '*', // All permissions
        priority: 5
      }
    ];

    defaultRoles.forEach(role => {
      this.roles.set(role.id, {
        ...role,
        type: 'system',
        createdAt: Date.now(),
        active: true
      });
    });
  }

  /**
   * Create custom permission
   */
  async createPermission(permissionData) {
    try {
      const {
        id,
        name,
        description,
        resource,
        action,
        conditions = {},
        metadata = {}
      } = permissionData;

      if (!id || !name || !resource || !action) {
        throw new Error('Missing required permission fields');
      }

      if (this.permissions.has(id)) {
        throw new Error(`Permission ${id} already exists`);
      }

      const permission = {
        id,
        name,
        description,
        resource,
        action,
        conditions,
        metadata,
        type: 'custom',
        createdAt: Date.now(),
        active: true
      };

      this.permissions.set(id, permission);
      await this.savePermissions();

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'permission_created',
          permissionId: id,
          name,
          resource,
          actionType: action
        });
      }

      this.emit('permissionCreated', { permissionId: id, permission });
      return permission;
    } catch (error) {
      this.emit('error', { operation: 'create_permission', error: error.message });
      throw error;
    }
  }

  /**
   * Create or update role
   */
  async createRole(roleData) {
    try {
      const {
        id,
        name,
        description,
        permissions = [],
        priority = 1,
        conditions = {},
        metadata = {}
      } = roleData;

      if (!id || !name) {
        throw new Error('Missing required role fields');
      }

      // Validate permissions exist
      if (permissions !== '*') {
        const invalidPermissions = permissions.filter(perm => !this.permissions.has(perm));
        if (invalidPermissions.length > 0) {
          throw new Error(`Invalid permissions: ${invalidPermissions.join(', ')}`);
        }
      }

      const role = {
        id,
        name,
        description,
        permissions,
        priority,
        conditions,
        metadata,
        type: 'custom',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        active: true
      };

      const isUpdate = this.roles.has(id);
      this.roles.set(id, role);
      await this.saveRoles();

      // Clear permission cache
      this.clearPermissionCache();

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: isUpdate ? 'role_updated' : 'role_created',
          roleId: id,
          name,
          permissions: permissions === '*' ? 'all' : permissions.length
        });
      }

      this.emit(isUpdate ? 'roleUpdated' : 'roleCreated', { roleId: id, role });
      return role;
    } catch (error) {
      this.emit('error', { operation: 'create_role', error: error.message });
      throw error;
    }
  }

  /**
   * Assign role to user
   */
  async assignRole(userId, roleId) {
    try {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role ${roleId} does not exist`);
      }

      if (!this.userRoles.has(userId)) {
        this.userRoles.set(userId, new Set());
      }

      this.userRoles.get(userId).add(roleId);
      
      // Clear permission cache for this user
      this.clearUserPermissionCache(userId);

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'role_assigned',
          userId,
          roleId,
          roleName: this.roles.get(roleId).name
        });
      }

      this.emit('roleAssigned', { userId, roleId });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'assign_role', userId, roleId, error: error.message });
      throw error;
    }
  }

  /**
   * Remove role from user
   */
  async removeRole(userId, roleId) {
    try {
      const userRoles = this.userRoles.get(userId);
      if (!userRoles || !userRoles.has(roleId)) {
        throw new Error(`User ${userId} does not have role ${roleId}`);
      }

      userRoles.delete(roleId);
      if (userRoles.size === 0) {
        this.userRoles.delete(userId);
      }

      // Clear permission cache for this user
      this.clearUserPermissionCache(userId);

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'role_removed',
          userId,
          roleId,
          roleName: this.roles.get(roleId)?.name
        });
      }

      this.emit('roleRemoved', { userId, roleId });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'remove_role', userId, roleId, error: error.message });
      throw error;
    }
  }

  /**
   * Grant specific permission to user
   */
  async grantPermission(userId, permissionId) {
    try {
      if (!this.permissions.has(permissionId)) {
        throw new Error(`Permission ${permissionId} does not exist`);
      }

      if (!this.userPermissions.has(userId)) {
        this.userPermissions.set(userId, new Set());
      }

      this.userPermissions.get(userId).add(permissionId);
      
      // Clear permission cache for this user
      this.clearUserPermissionCache(userId);

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'permission_granted',
          userId,
          permissionId,
          permissionName: this.permissions.get(permissionId).name
        });
      }

      this.emit('permissionGranted', { userId, permissionId });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'grant_permission', userId, permissionId, error: error.message });
      throw error;
    }
  }

  /**
   * Revoke specific permission from user
   */
  async revokePermission(userId, permissionId) {
    try {
      const userPermissions = this.userPermissions.get(userId);
      if (!userPermissions || !userPermissions.has(permissionId)) {
        throw new Error(`User ${userId} does not have permission ${permissionId}`);
      }

      userPermissions.delete(permissionId);
      if (userPermissions.size === 0) {
        this.userPermissions.delete(userId);
      }

      // Clear permission cache for this user
      this.clearUserPermissionCache(userId);

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'permission_revoked',
          userId,
          permissionId,
          permissionName: this.permissions.get(permissionId)?.name
        });
      }

      this.emit('permissionRevoked', { userId, permissionId });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'revoke_permission', userId, permissionId, error: error.message });
      throw error;
    }
  }

  /**
   * Check if user has permission
   */
  async hasPermission(userId, permissionId, context = {}) {
    try {
      // Check cache first
      const cacheKey = `${userId}:${permissionId}:${JSON.stringify(context)}`;
      if (this.enableCaching) {
        const cached = this.permissionCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.result;
        }
      }

      let hasPermission = false;

      // Check direct permissions
      const userPermissions = this.userPermissions.get(userId);
      if (userPermissions && userPermissions.has(permissionId)) {
        hasPermission = true;
      }

      // Check role-based permissions
      if (!hasPermission) {
        const userRoles = this.userRoles.get(userId);
        if (userRoles) {
          for (const roleId of userRoles) {
            const role = this.roles.get(roleId);
            if (role && role.active) {
              if (role.permissions === '*' || role.permissions.includes(permissionId)) {
                // Check role conditions
                if (this.evaluateConditions(role.conditions, context)) {
                  hasPermission = true;
                  break;
                }
              }
            }
          }
        }
      }

      // Check permission conditions
      if (hasPermission) {
        const permission = this.permissions.get(permissionId);
        if (permission && permission.conditions) {
          hasPermission = this.evaluateConditions(permission.conditions, context);
        }
      }

      // Cache result
      if (this.enableCaching) {
        this.permissionCache.set(cacheKey, {
          result: hasPermission,
          timestamp: Date.now()
        });
      }

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'permission_checked',
          userId,
          permissionId,
          result: hasPermission,
          context: Object.keys(context)
        });
      }

      return hasPermission;
    } catch (error) {
      this.emit('error', { operation: 'check_permission', userId, permissionId, error: error.message });
      return false;
    }
  }

  /**
   * Check if user has any of the specified permissions
   */
  async hasAnyPermission(userId, permissionIds, context = {}) {
    for (const permissionId of permissionIds) {
      if (await this.hasPermission(userId, permissionId, context)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if user has all of the specified permissions
   */
  async hasAllPermissions(userId, permissionIds, context = {}) {
    for (const permissionId of permissionIds) {
      if (!(await this.hasPermission(userId, permissionId, context))) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check resource-level permission
   */
  async hasResourcePermission(userId, resource, action, resourceId = null, context = {}) {
    const permissionId = `${resource}:${action}`;
    
    // Check general resource permission first
    const hasGeneral = await this.hasPermission(userId, permissionId, context);
    if (!hasGeneral) {
      return false;
    }

    // Check specific resource permissions if resourceId provided
    if (resourceId) {
      const resourcePerms = this.resourcePermissions.get(resource);
      if (resourcePerms && resourcePerms.has(resourceId)) {
        const resourcePermission = resourcePerms.get(resourceId);
        if (resourcePermission.denied && resourcePermission.denied.includes(userId)) {
          return false;
        }
        if (resourcePermission.allowed && !resourcePermission.allowed.includes(userId)) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Set resource-specific permissions
   */
  async setResourcePermission(resource, resourceId, permission) {
    try {
      if (!this.resourcePermissions.has(resource)) {
        this.resourcePermissions.set(resource, new Map());
      }

      this.resourcePermissions.get(resource).set(resourceId, permission);

      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'resource_permission_set',
          resource,
          resourceId,
          permission
        });
      }

      this.emit('resourcePermissionSet', { resource, resourceId, permission });
      return true;
    } catch (error) {
      this.emit('error', { operation: 'set_resource_permission', resource, resourceId, error: error.message });
      throw error;
    }
  }

  /**
   * Get user's effective permissions
   */
  getUserPermissions(userId) {
    const effectivePermissions = new Set();

    // Add direct permissions
    const userPermissions = this.userPermissions.get(userId);
    if (userPermissions) {
      userPermissions.forEach(perm => effectivePermissions.add(perm));
    }

    // Add role-based permissions
    const userRoles = this.userRoles.get(userId);
    if (userRoles) {
      for (const roleId of userRoles) {
        const role = this.roles.get(roleId);
        if (role && role.active) {
          if (role.permissions === '*') {
            // Add all available permissions
            this.permissions.forEach((perm, id) => effectivePermissions.add(id));
          } else {
            role.permissions.forEach(perm => effectivePermissions.add(perm));
          }
        }
      }
    }

    return Array.from(effectivePermissions);
  }

  /**
   * Get user's roles
   */
  getUserRoles(userId) {
    const userRoles = this.userRoles.get(userId);
    if (!userRoles) return [];

    return Array.from(userRoles).map(roleId => ({
      id: roleId,
      ...this.roles.get(roleId)
    })).filter(role => role.active);
  }

  /**
   * Evaluate permission conditions
   */
  evaluateConditions(conditions, context) {
    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // Time-based conditions
    if (conditions.timeRange) {
      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();
      const [startHour, startMin] = conditions.timeRange.start.split(':').map(Number);
      const [endHour, endMin] = conditions.timeRange.end.split(':').map(Number);
      const startTime = startHour * 60 + startMin;
      const endTime = endHour * 60 + endMin;
      
      if (currentTime < startTime || currentTime > endTime) {
        return false;
      }
    }

    // IP-based conditions
    if (conditions.allowedIPs && context.clientIP) {
      if (!conditions.allowedIPs.includes(context.clientIP)) {
        return false;
      }
    }

    // User agent conditions
    if (conditions.allowedUserAgents && context.userAgent) {
      const allowed = conditions.allowedUserAgents.some(pattern => 
        new RegExp(pattern).test(context.userAgent)
      );
      if (!allowed) {
        return false;
      }
    }

    // Resource owner condition
    if (conditions.resourceOwner && context.resourceOwnerId && context.userId) {
      if (context.resourceOwnerId !== context.userId) {
        return false;
      }
    }

    // Custom condition functions
    if (conditions.custom && typeof conditions.custom === 'function') {
      return conditions.custom(context);
    }

    return true;
  }

  /**
   * List all permissions
   */
  listPermissions(filters = {}) {
    const { resource = null, type = null, active = null } = filters;
    
    let permissions = Array.from(this.permissions.values());

    if (resource) {
      permissions = permissions.filter(perm => perm.resource === resource);
    }

    if (type) {
      permissions = permissions.filter(perm => perm.type === type);
    }

    if (active !== null) {
      permissions = permissions.filter(perm => perm.active === active);
    }

    return permissions.sort((a, b) => a.resource.localeCompare(b.resource) || a.action.localeCompare(b.action));
  }

  /**
   * List all roles
   */
  listRoles(filters = {}) {
    const { type = null, active = null } = filters;
    
    let roles = Array.from(this.roles.values());

    if (type) {
      roles = roles.filter(role => role.type === type);
    }

    if (active !== null) {
      roles = roles.filter(role => role.active === active);
    }

    return roles.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  }

  /**
   * Get permission statistics
   */
  getPermissionStats() {
    return {
      totalPermissions: this.permissions.size,
      activePermissions: Array.from(this.permissions.values()).filter(p => p.active).length,
      totalRoles: this.roles.size,
      activeRoles: Array.from(this.roles.values()).filter(r => r.active).length,
      usersWithRoles: this.userRoles.size,
      usersWithDirectPermissions: this.userPermissions.size,
      auditLogEntries: this.auditLog.length,
      cacheEntries: this.permissionCache.size
    };
  }

  /**
   * Clear permission cache
   */
  clearPermissionCache(pattern = null) {
    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.permissionCache) {
        if (regex.test(key)) {
          this.permissionCache.delete(key);
        }
      }
    } else {
      this.permissionCache.clear();
    }
  }

  /**
   * Clear user-specific permission cache
   */
  clearUserPermissionCache(userId) {
    this.clearPermissionCache(`^${userId}:`);
  }

  /**
   * Add audit log entry
   */
  addAuditEntry(entry) {
    if (!this.enableAuditLog) return;

    this.auditLog.push({
      ...entry,
      timestamp: Date.now(),
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    });

    // Limit audit log size
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get audit log
   */
  getAuditLog(filters = {}) {
    const {
      action = null,
      userId = null,
      permissionId = null,
      roleId = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = filters;

    let entries = [...this.auditLog];

    // Apply filters
    if (action) entries = entries.filter(entry => entry.action === action);
    if (userId) entries = entries.filter(entry => entry.userId === userId);
    if (permissionId) entries = entries.filter(entry => entry.permissionId === permissionId);
    if (roleId) entries = entries.filter(entry => entry.roleId === roleId);
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
   * Load permissions from storage
   */
  async loadPermissions() {
    try {
      const dir = path.dirname(this.permissionsPath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const data = await fs.readFile(this.permissionsPath, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed.permissions) {
          // Don't override system permissions, only load custom ones
          parsed.permissions.forEach(([id, permission]) => {
            if (permission.type === 'custom') {
              this.permissions.set(id, permission);
            }
          });
        }

        if (parsed.userPermissions) {
          this.userPermissions = new Map(parsed.userPermissions.map(([id, perms]) => [
            id, new Set(perms)
          ]));
        }

        if (parsed.resourcePermissions) {
          this.resourcePermissions = new Map(parsed.resourcePermissions.map(([resource, resourceMap]) => [
            resource, new Map(resourceMap)
          ]));
        }

        if (parsed.auditLog) {
          this.auditLog = parsed.auditLog.slice(-1000);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to load permissions: ${error.message}`);
    }
  }

  /**
   * Save permissions to storage
   */
  async savePermissions() {
    try {
      // Only save custom permissions
      const customPermissions = Array.from(this.permissions.entries())
        .filter(([id, permission]) => permission.type === 'custom');

      const data = {
        permissions: customPermissions,
        userPermissions: Array.from(this.userPermissions.entries()).map(([id, perms]) => [
          id, Array.from(perms)
        ]),
        resourcePermissions: Array.from(this.resourcePermissions.entries()).map(([resource, resourceMap]) => [
          resource, Array.from(resourceMap.entries())
        ]),
        auditLog: this.auditLog.slice(-1000),
        savedAt: Date.now()
      };

      const dir = path.dirname(this.permissionsPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.permissionsPath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to save permissions: ${error.message}`);
    }
  }

  /**
   * Load roles from storage
   */
  async loadRoles() {
    try {
      const dir = path.dirname(this.rolesPath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const data = await fs.readFile(this.rolesPath, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed.roles) {
          // Don't override system roles, only load custom ones
          parsed.roles.forEach(([id, role]) => {
            if (role.type === 'custom') {
              this.roles.set(id, role);
            }
          });
        }

        if (parsed.userRoles) {
          this.userRoles = new Map(parsed.userRoles.map(([id, roles]) => [
            id, new Set(roles)
          ]));
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }
    } catch (error) {
      throw new Error(`Failed to load roles: ${error.message}`);
    }
  }

  /**
   * Save roles to storage
   */
  async saveRoles() {
    try {
      // Only save custom roles
      const customRoles = Array.from(this.roles.entries())
        .filter(([id, role]) => role.type === 'custom');

      const data = {
        roles: customRoles,
        userRoles: Array.from(this.userRoles.entries()).map(([id, roles]) => [
          id, Array.from(roles)
        ]),
        savedAt: Date.now()
      };

      const dir = path.dirname(this.rolesPath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.rolesPath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to save roles: ${error.message}`);
    }
  }

  /**
   * Start cache cleanup timer
   */
  startCacheCleanup() {
    this.cacheCleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.permissionCache) {
        if (now - value.timestamp > this.cacheTimeout) {
          this.permissionCache.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }

    try {
      await this.savePermissions();
      await this.saveRoles();
    } catch (error) {
      this.emit('error', { operation: 'shutdown_save', error: error.message });
    }

    this.permissions.clear();
    this.roles.clear();
    this.userRoles.clear();
    this.userPermissions.clear();
    this.resourcePermissions.clear();
    this.permissionCache.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
  }
}

export default PermissionManager;