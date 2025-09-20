/**
 * Production-Ready API Key Management System
 * 
 * Provides secure API key generation, storage, validation, and management
 * with encryption, hashing, permissions, and comprehensive audit trails.
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import argon2 from 'argon2';
import CryptoJS from 'crypto-js';
import fs from 'fs/promises';
import path from 'path';

export class APIKeyManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.keyPrefix = options.keyPrefix || 'mcp_';
    this.keyLength = options.keyLength || 32;
    this.defaultExpiry = options.defaultExpiry || '365d';
    this.maxKeysPerClient = options.maxKeysPerClient || 10;
    this.storagePath = options.storagePath || './data/api-keys.json';
    this.encryptionKey = options.encryptionKey || this.generateEncryptionKey();
    this.enableAuditLog = options.enableAuditLog !== false;
    this.enableRateLimiting = options.enableRateLimiting !== false;
    this.enableIPWhitelist = options.enableIPWhitelist || false;
    
    // In-memory storage (will be persisted to disk)
    this.apiKeys = new Map(); // keyId -> { hashedKey, metadata, permissions, etc. }
    this.keyUsage = new Map(); // keyId -> { lastUsed, requestCount, etc. }
    this.auditLog = [];
    
    // Security settings
    this.argon2Options = {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1
    };
    
    // Rate limiting per key
    this.rateLimitWindows = new Map(); // keyId -> { requests, windowStart }
    this.defaultRateLimit = {
      requestsPerMinute: options.requestsPerMinute || 60,
      requestsPerHour: options.requestsPerHour || 1000,
      requestsPerDay: options.requestsPerDay || 10000
    };
    
    // Initialize
    this.initialized = false;
    this.init();
  }

  /**
   * Initialize the API key manager
   */
  async init() {
    try {
      await this.loadApiKeys();
      this.startCleanupTimer();
      this.initialized = true;
      
      this.emit('initialized', {
        keysLoaded: this.apiKeys.size,
        storagePath: this.storagePath
      });
    } catch (error) {
      this.emit('error', { operation: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Generate secure encryption key
   */
  generateEncryptionKey() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate secure API key
   */
  generateApiKey() {
    const randomBytes = crypto.randomBytes(this.keyLength);
    const timestamp = Date.now().toString(36);
    const random = randomBytes.toString('hex').substring(0, this.keyLength - timestamp.length);
    return this.keyPrefix + timestamp + random;
  }

  /**
   * Hash API key using Argon2
   */
  async hashApiKey(apiKey) {
    try {
      return await argon2.hash(apiKey, this.argon2Options);
    } catch (error) {
      throw new Error(`Failed to hash API key: ${error.message}`);
    }
  }

  /**
   * Verify API key against hash
   */
  async verifyApiKey(apiKey, hashedKey) {
    try {
      return await argon2.verify(hashedKey, apiKey);
    } catch (error) {
      return false;
    }
  }

  /**
   * Encrypt sensitive data
   */
  encryptData(data) {
    try {
      return CryptoJS.AES.encrypt(JSON.stringify(data), this.encryptionKey).toString();
    } catch (error) {
      throw new Error(`Failed to encrypt data: ${error.message}`);
    }
  }

  /**
   * Decrypt sensitive data
   */
  decryptData(encryptedData) {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.encryptionKey);
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (error) {
      throw new Error(`Failed to decrypt data: ${error.message}`);
    }
  }

  /**
   * Create new API key
   */
  async createApiKey(options = {}) {
    try {
      const {
        name = 'Unnamed Key',
        description = '',
        permissions = { read: true },
        scopes = ['read'],
        clientId = null,
        userId = null,
        expiresIn = this.defaultExpiry,
        ipWhitelist = [],
        rateLimits = this.defaultRateLimit,
        metadata = {}
      } = options;

      // Check client key limit
      if (clientId && this.getClientKeyCount(clientId) >= this.maxKeysPerClient) {
        throw new Error(`Maximum API keys per client exceeded (${this.maxKeysPerClient})`);
      }

      // Generate key and ID
      const apiKey = this.generateApiKey();
      const keyId = crypto.randomUUID();
      const hashedKey = await this.hashApiKey(apiKey);
      
      // Calculate expiry
      const createdAt = Date.now();
      const expiresAt = this.calculateExpiry(createdAt, expiresIn);
      
      // Create key metadata
      const keyData = {
        id: keyId,
        hashedKey,
        name,
        description,
        permissions,
        scopes,
        clientId,
        userId,
        createdAt,
        expiresAt,
        ipWhitelist,
        rateLimits,
        metadata: this.encryptData(metadata),
        active: true,
        lastUsed: null,
        usageCount: 0,
        version: 1
      };

      // Store key
      this.apiKeys.set(keyId, keyData);
      this.keyUsage.set(keyId, {
        requestCount: 0,
        lastUsed: null,
        dailyUsage: new Map(),
        errors: 0
      });

      // Save to disk
      await this.saveApiKeys();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_created',
          keyId,
          name,
          clientId,
          userId,
          permissions,
          scopes,
          expiresAt
        });
      }

      this.emit('keyCreated', { 
        keyId, 
        name, 
        clientId, 
        userId,
        permissions,
        scopes,
        expiresAt 
      });

      return {
        keyId,
        apiKey, // Only returned once during creation
        name,
        permissions,
        scopes,
        expiresAt,
        createdAt
      };
    } catch (error) {
      this.emit('error', { operation: 'create_key', error: error.message });
      throw error;
    }
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey, options = {}) {
    try {
      const { 
        clientIP = null, 
        userAgent = null, 
        requirePermissions = [],
        requireScopes = [] 
      } = options;

      // Find key by comparing with all stored hashed keys
      let matchedKey = null;
      let keyId = null;

      for (const [id, keyData] of this.apiKeys) {
        if (await this.verifyApiKey(apiKey, keyData.hashedKey)) {
          matchedKey = keyData;
          keyId = id;
          break;
        }
      }

      if (!matchedKey) {
        if (this.enableAuditLog) {
          this.addAuditEntry({
            action: 'key_validation_failed',
            reason: 'key_not_found',
            clientIP,
            userAgent
          });
        }
        return { valid: false, error: 'Invalid API key' };
      }

      // Check if key is active
      if (!matchedKey.active) {
        if (this.enableAuditLog) {
          this.addAuditEntry({
            action: 'key_validation_failed',
            keyId,
            reason: 'key_inactive',
            clientIP,
            userAgent
          });
        }
        return { valid: false, error: 'API key is inactive' };
      }

      // Check expiry
      if (matchedKey.expiresAt && Date.now() > matchedKey.expiresAt) {
        if (this.enableAuditLog) {
          this.addAuditEntry({
            action: 'key_validation_failed',
            keyId,
            reason: 'key_expired',
            clientIP,
            userAgent
          });
        }
        return { valid: false, error: 'API key has expired', expired: true };
      }

      // Check IP whitelist
      if (this.enableIPWhitelist && matchedKey.ipWhitelist.length > 0) {
        if (!clientIP || !this.isIPWhitelisted(clientIP, matchedKey.ipWhitelist)) {
          if (this.enableAuditLog) {
            this.addAuditEntry({
              action: 'key_validation_failed',
              keyId,
              reason: 'ip_not_whitelisted',
              clientIP,
              userAgent
            });
          }
          return { valid: false, error: 'IP address not whitelisted' };
        }
      }

      // Check rate limits
      if (this.enableRateLimiting) {
        const rateLimitCheck = this.checkRateLimit(keyId, matchedKey.rateLimits);
        if (!rateLimitCheck.allowed) {
          if (this.enableAuditLog) {
            this.addAuditEntry({
              action: 'key_validation_failed',
              keyId,
              reason: 'rate_limit_exceeded',
              rateLimitType: rateLimitCheck.limitType,
              clientIP,
              userAgent
            });
          }
          return { 
            valid: false, 
            error: 'Rate limit exceeded',
            rateLimited: true,
            retryAfter: rateLimitCheck.retryAfter
          };
        }
      }

      // Check required permissions
      if (requirePermissions.length > 0) {
        const hasPermissions = this.hasPermissions(matchedKey.permissions, requirePermissions);
        if (!hasPermissions) {
          if (this.enableAuditLog) {
            this.addAuditEntry({
              action: 'key_validation_failed',
              keyId,
              reason: 'insufficient_permissions',
              requiredPermissions: requirePermissions,
              clientIP,
              userAgent
            });
          }
          return { valid: false, error: 'Insufficient permissions' };
        }
      }

      // Check required scopes
      if (requireScopes.length > 0) {
        const hasScopes = this.hasScopes(matchedKey.scopes, requireScopes);
        if (!hasScopes) {
          if (this.enableAuditLog) {
            this.addAuditEntry({
              action: 'key_validation_failed',
              keyId,
              reason: 'insufficient_scopes',
              requiredScopes: requireScopes,
              clientIP,
              userAgent
            });
          }
          return { valid: false, error: 'Insufficient scopes' };
        }
      }

      // Update usage statistics
      this.updateKeyUsage(keyId, { clientIP, userAgent });

      // Successful validation
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_validated',
          keyId,
          clientId: matchedKey.clientId,
          userId: matchedKey.userId,
          clientIP,
          userAgent
        });
      }

      return {
        valid: true,
        keyId,
        name: matchedKey.name,
        permissions: matchedKey.permissions,
        scopes: matchedKey.scopes,
        clientId: matchedKey.clientId,
        userId: matchedKey.userId,
        metadata: this.decryptData(matchedKey.metadata),
        rateLimits: matchedKey.rateLimits
      };
    } catch (error) {
      this.emit('error', { operation: 'validate_key', error: error.message });
      return { valid: false, error: 'Validation error' };
    }
  }

  /**
   * Update API key
   */
  async updateApiKey(keyId, updates = {}) {
    try {
      const keyData = this.apiKeys.get(keyId);
      if (!keyData) {
        throw new Error('API key not found');
      }

      const allowedUpdates = [
        'name', 'description', 'permissions', 'scopes', 'active', 
        'ipWhitelist', 'rateLimits', 'metadata'
      ];

      const oldData = { ...keyData };
      
      // Apply updates
      for (const [field, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(field)) {
          if (field === 'metadata') {
            keyData[field] = this.encryptData(value);
          } else {
            keyData[field] = value;
          }
        }
      }

      keyData.version += 1;
      keyData.updatedAt = Date.now();

      // Save changes
      await this.saveApiKeys();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_updated',
          keyId,
          updates: Object.keys(updates),
          oldData: {
            name: oldData.name,
            permissions: oldData.permissions,
            scopes: oldData.scopes,
            active: oldData.active
          }
        });
      }

      this.emit('keyUpdated', { keyId, updates });

      return {
        keyId,
        name: keyData.name,
        permissions: keyData.permissions,
        scopes: keyData.scopes,
        active: keyData.active,
        updatedAt: keyData.updatedAt,
        version: keyData.version
      };
    } catch (error) {
      this.emit('error', { operation: 'update_key', keyId, error: error.message });
      throw error;
    }
  }

  /**
   * Revoke API key
   */
  async revokeApiKey(keyId, reason = 'Manual revocation') {
    try {
      const keyData = this.apiKeys.get(keyId);
      if (!keyData) {
        throw new Error('API key not found');
      }

      keyData.active = false;
      keyData.revokedAt = Date.now();
      keyData.revocationReason = reason;

      // Save changes
      await this.saveApiKeys();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_revoked',
          keyId,
          reason,
          name: keyData.name,
          clientId: keyData.clientId,
          userId: keyData.userId
        });
      }

      this.emit('keyRevoked', { keyId, reason });

      return true;
    } catch (error) {
      this.emit('error', { operation: 'revoke_key', keyId, error: error.message });
      throw error;
    }
  }

  /**
   * Delete API key permanently
   */
  async deleteApiKey(keyId) {
    try {
      const keyData = this.apiKeys.get(keyId);
      if (!keyData) {
        throw new Error('API key not found');
      }

      // Remove from storage
      this.apiKeys.delete(keyId);
      this.keyUsage.delete(keyId);

      // Save changes
      await this.saveApiKeys();

      // Audit log
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_deleted',
          keyId,
          name: keyData.name,
          clientId: keyData.clientId,
          userId: keyData.userId
        });
      }

      this.emit('keyDeleted', { keyId });

      return true;
    } catch (error) {
      this.emit('error', { operation: 'delete_key', keyId, error: error.message });
      throw error;
    }
  }

  /**
   * List API keys with filtering
   */
  listApiKeys(filters = {}) {
    const {
      clientId = null,
      userId = null,
      active = null,
      expired = null,
      limit = 100,
      offset = 0
    } = filters;

    let keys = Array.from(this.apiKeys.entries()).map(([id, data]) => ({
      keyId: id,
      name: data.name,
      description: data.description,
      permissions: data.permissions,
      scopes: data.scopes,
      clientId: data.clientId,
      userId: data.userId,
      active: data.active,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
      lastUsed: data.lastUsed,
      usageCount: data.usageCount,
      version: data.version
    }));

    // Apply filters
    if (clientId !== null) {
      keys = keys.filter(key => key.clientId === clientId);
    }

    if (userId !== null) {
      keys = keys.filter(key => key.userId === userId);
    }

    if (active !== null) {
      keys = keys.filter(key => key.active === active);
    }

    if (expired !== null) {
      const now = Date.now();
      keys = keys.filter(key => {
        const isExpired = key.expiresAt && now > key.expiresAt;
        return expired ? isExpired : !isExpired;
      });
    }

    // Sort by creation date (newest first)
    keys.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    const total = keys.length;
    keys = keys.slice(offset, offset + limit);

    return {
      keys,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Get API key statistics
   */
  getApiKeyStats() {
    const now = Date.now();
    const allKeys = Array.from(this.apiKeys.values());
    
    return {
      total: allKeys.length,
      active: allKeys.filter(key => key.active).length,
      inactive: allKeys.filter(key => !key.active).length,
      expired: allKeys.filter(key => key.expiresAt && now > key.expiresAt).length,
      totalUsage: Array.from(this.keyUsage.values())
        .reduce((sum, usage) => sum + usage.requestCount, 0),
      auditLogEntries: this.auditLog.length
    };
  }

  /**
   * Check if IP is whitelisted
   */
  isIPWhitelisted(clientIP, whitelist) {
    if (!whitelist || whitelist.length === 0) return true;
    
    return whitelist.some(allowedIP => {
      // Support CIDR notation and exact matches
      if (allowedIP.includes('/')) {
        // CIDR notation - simplified check
        const [network, prefixLength] = allowedIP.split('/');
        // For production, use a proper CIDR library
        return clientIP.startsWith(network.split('.').slice(0, Math.floor(prefixLength / 8)).join('.'));
      }
      return clientIP === allowedIP;
    });
  }

  /**
   * Check rate limits for API key
   */
  checkRateLimit(keyId, rateLimits) {
    if (!this.enableRateLimiting) {
      return { allowed: true };
    }

    const now = Date.now();
    const window = this.rateLimitWindows.get(keyId) || { 
      minuteRequests: [], 
      hourRequests: [], 
      dayRequests: [] 
    };

    // Clean old requests
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    window.minuteRequests = window.minuteRequests.filter(time => time > oneMinuteAgo);
    window.hourRequests = window.hourRequests.filter(time => time > oneHourAgo);
    window.dayRequests = window.dayRequests.filter(time => time > oneDayAgo);

    // Check limits
    if (window.minuteRequests.length >= rateLimits.requestsPerMinute) {
      return { 
        allowed: false, 
        limitType: 'minute', 
        retryAfter: Math.ceil((window.minuteRequests[0] + 60000 - now) / 1000) 
      };
    }

    if (window.hourRequests.length >= rateLimits.requestsPerHour) {
      return { 
        allowed: false, 
        limitType: 'hour', 
        retryAfter: Math.ceil((window.hourRequests[0] + 3600000 - now) / 1000) 
      };
    }

    if (window.dayRequests.length >= rateLimits.requestsPerDay) {
      return { 
        allowed: false, 
        limitType: 'day', 
        retryAfter: Math.ceil((window.dayRequests[0] + 86400000 - now) / 1000) 
      };
    }

    // Update counters
    window.minuteRequests.push(now);
    window.hourRequests.push(now);
    window.dayRequests.push(now);
    this.rateLimitWindows.set(keyId, window);

    return { allowed: true };
  }

  /**
   * Check if key has required permissions
   */
  hasPermissions(keyPermissions, requiredPermissions) {
    return requiredPermissions.every(permission => {
      if (typeof permission === 'string') {
        return keyPermissions[permission] === true;
      }
      // Support nested permissions like { resource: 'files', action: 'read' }
      if (typeof permission === 'object') {
        const { resource, action } = permission;
        return keyPermissions[resource] && keyPermissions[resource][action] === true;
      }
      return false;
    });
  }

  /**
   * Check if key has required scopes
   */
  hasScopes(keyScopes, requiredScopes) {
    return requiredScopes.every(scope => keyScopes.includes(scope));
  }

  /**
   * Update key usage statistics
   */
  updateKeyUsage(keyId, context = {}) {
    const usage = this.keyUsage.get(keyId);
    if (!usage) return;

    usage.requestCount += 1;
    usage.lastUsed = Date.now();

    // Update daily usage
    const today = new Date().toISOString().split('T')[0];
    const dailyCount = usage.dailyUsage.get(today) || 0;
    usage.dailyUsage.set(today, dailyCount + 1);

    // Update key's last used timestamp
    const keyData = this.apiKeys.get(keyId);
    if (keyData) {
      keyData.lastUsed = usage.lastUsed;
      keyData.usageCount = usage.requestCount;
    }
  }

  /**
   * Get client key count
   */
  getClientKeyCount(clientId) {
    return Array.from(this.apiKeys.values())
      .filter(key => key.clientId === clientId && key.active).length;
  }

  /**
   * Calculate expiry timestamp
   */
  calculateExpiry(createdAt, expiresIn) {
    if (!expiresIn || expiresIn === 'never') return null;
    
    const matches = expiresIn.match(/^(\d+)([smhd])$/);
    if (!matches) return createdAt + (365 * 24 * 60 * 60 * 1000); // Default 1 year
    
    const value = parseInt(matches[1]);
    const unit = matches[2];
    
    let multiplier;
    switch (unit) {
      case 's': multiplier = 1000; break;
      case 'm': multiplier = 60 * 1000; break;
      case 'h': multiplier = 60 * 60 * 1000; break;
      case 'd': multiplier = 24 * 60 * 60 * 1000; break;
      default: multiplier = 24 * 60 * 60 * 1000;
    }
    
    return createdAt + (value * multiplier);
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
    if (this.auditLog.length > 10000) {
      this.auditLog = this.auditLog.slice(-5000);
    }
  }

  /**
   * Get audit log with filtering
   */
  getAuditLog(filters = {}) {
    const {
      action = null,
      keyId = null,
      clientId = null,
      userId = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = filters;

    let entries = [...this.auditLog];

    // Apply filters
    if (action) {
      entries = entries.filter(entry => entry.action === action);
    }

    if (keyId) {
      entries = entries.filter(entry => entry.keyId === keyId);
    }

    if (clientId) {
      entries = entries.filter(entry => entry.clientId === clientId);
    }

    if (userId) {
      entries = entries.filter(entry => entry.userId === userId);
    }

    if (startTime) {
      entries = entries.filter(entry => entry.timestamp >= startTime);
    }

    if (endTime) {
      entries = entries.filter(entry => entry.timestamp <= endTime);
    }

    // Sort by timestamp (newest first)
    entries.sort((a, b) => b.timestamp - a.timestamp);

    // Apply pagination
    const total = entries.length;
    entries = entries.slice(offset, offset + limit);

    return {
      entries,
      total,
      limit,
      offset,
      hasMore: offset + limit < total
    };
  }

  /**
   * Load API keys from persistent storage
   */
  async loadApiKeys() {
    try {
      const dir = path.dirname(this.storagePath);
      await fs.mkdir(dir, { recursive: true });

      try {
        const data = await fs.readFile(this.storagePath, 'utf8');
        const parsed = JSON.parse(data);
        
        // Restore API keys
        if (parsed.apiKeys) {
          this.apiKeys = new Map(parsed.apiKeys);
        }
        
        // Restore usage data
        if (parsed.keyUsage) {
          this.keyUsage = new Map(parsed.keyUsage.map(([id, usage]) => [
            id,
            {
              ...usage,
              dailyUsage: new Map(usage.dailyUsage || [])
            }
          ]));
        }
        
        // Restore audit log
        if (parsed.auditLog) {
          this.auditLog = parsed.auditLog;
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, start fresh
      }
    } catch (error) {
      throw new Error(`Failed to load API keys: ${error.message}`);
    }
  }

  /**
   * Save API keys to persistent storage
   */
  async saveApiKeys() {
    try {
      const data = {
        apiKeys: Array.from(this.apiKeys.entries()),
        keyUsage: Array.from(this.keyUsage.entries()).map(([id, usage]) => [
          id,
          {
            ...usage,
            dailyUsage: Array.from(usage.dailyUsage.entries())
          }
        ]),
        auditLog: this.auditLog.slice(-1000), // Keep last 1000 entries
        savedAt: Date.now()
      };

      const dir = path.dirname(this.storagePath);
      await fs.mkdir(dir, { recursive: true });
      
      await fs.writeFile(this.storagePath, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to save API keys: ${error.message}`);
    }
  }

  /**
   * Start cleanup timer
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, 60000); // Run every minute
  }

  /**
   * Cleanup expired data
   */
  cleanupExpiredData() {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    
    // Clean up rate limit windows
    for (const [keyId, window] of this.rateLimitWindows) {
      window.minuteRequests = window.minuteRequests.filter(time => time > now - 60000);
      window.hourRequests = window.hourRequests.filter(time => time > now - 3600000);
      window.dayRequests = window.dayRequests.filter(time => time > now - 86400000);
      
      if (window.minuteRequests.length === 0 && 
          window.hourRequests.length === 0 && 
          window.dayRequests.length === 0) {
        this.rateLimitWindows.delete(keyId);
      }
    }

    // Clean up daily usage data older than 30 days
    for (const usage of this.keyUsage.values()) {
      const thirtyDaysAgo = new Date(now - 30 * 86400000).toISOString().split('T')[0];
      for (const [date, count] of usage.dailyUsage) {
        if (date < thirtyDaysAgo) {
          usage.dailyUsage.delete(date);
        }
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

    try {
      await this.saveApiKeys();
    } catch (error) {
      this.emit('error', { operation: 'shutdown_save', error: error.message });
    }

    this.apiKeys.clear();
    this.keyUsage.clear();
    this.rateLimitWindows.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
  }
}

export default APIKeyManager;