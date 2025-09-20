/**
 * Production-Ready Data Encryption System
 * 
 * Provides comprehensive encryption for sensitive data at rest,
 * including key management, field-level encryption, and secure storage.
 */

import crypto from 'crypto';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export class DataEncryptionManager extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.algorithm = options.algorithm || 'aes-256-gcm';
    this.keyDerivationAlgorithm = options.keyDerivationAlgorithm || 'pbkdf2';
    this.keyLength = options.keyLength || 32; // 256 bits
    this.ivLength = options.ivLength || 16; // 128 bits
    this.tagLength = options.tagLength || 16; // 128 bits for GCM
    this.saltLength = options.saltLength || 32; // 256 bits
    this.iterations = options.iterations || 100000; // PBKDF2 iterations
    this.keyStoragePath = options.keyStoragePath || './data/keys';
    this.enableKeyRotation = options.enableKeyRotation !== false;
    this.keyRotationInterval = options.keyRotationInterval || 30 * 24 * 60 * 60 * 1000; // 30 days
    this.enableAuditLog = options.enableAuditLog !== false;
    this.enableFieldLevelEncryption = options.enableFieldLevelEncryption !== false;
    
    // Master key and derived keys
    this.masterKey = options.masterKey || this.generateMasterKey();
    this.encryptionKeys = new Map(); // keyId -> { key, createdAt, algorithm, active }
    this.currentKeyId = null;
    
    // Field encryption configuration
    this.fieldEncryptionConfig = new Map(); // fieldName -> { algorithm, keyId, required }
    this.encryptedFieldPatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /ssn/i,
      /social/i,
      /credit/i,
      /card/i,
      /account/i,
      /pin/i,
      /passcode/i
    ];
    
    // Encryption cache for performance
    this.encryptionCache = new Map(); // hash -> { encrypted, timestamp }
    this.decryptionCache = new Map(); // hash -> { decrypted, timestamp }
    this.cacheTimeout = options.cacheTimeout || 300000; // 5 minutes
    this.maxCacheSize = options.maxCacheSize || 10000;
    
    // Audit and monitoring
    this.auditLog = [];
    this.encryptionMetrics = {
      totalEncryptions: 0,
      totalDecryptions: 0,
      cacheHits: 0,
      cacheMisses: 0,
      keyRotations: 0,
      encryptionErrors: 0,
      decryptionErrors: 0
    };
    
    // Initialize
    this.init();
  }

  /**
   * Initialize encryption manager
   */
  async init() {
    try {
      await this.loadKeys();
      await this.ensureCurrentKey();
      this.setupDefaultFieldEncryption();
      this.startKeyRotationTimer();
      this.startCacheCleanupTimer();
      
      this.emit('initialized', {
        algorithm: this.algorithm,
        currentKeyId: this.currentKeyId,
        totalKeys: this.encryptionKeys.size,
        fieldEncryption: this.enableFieldLevelEncryption
      });
    } catch (error) {
      this.emit('error', { operation: 'initialization', error: error.message });
      throw error;
    }
  }

  /**
   * Generate master key
   */
  generateMasterKey() {
    return crypto.randomBytes(this.keyLength).toString('hex');
  }

  /**
   * Generate encryption key with metadata
   */
  generateEncryptionKey() {
    const keyId = crypto.randomUUID();
    const key = crypto.randomBytes(this.keyLength);
    const createdAt = Date.now();
    
    const keyData = {
      keyId,
      key,
      createdAt,
      algorithm: this.algorithm,
      active: true,
      rotatedAt: null,
      usageCount: 0
    };
    
    this.encryptionKeys.set(keyId, keyData);
    
    if (this.enableAuditLog) {
      this.addAuditEntry({
        action: 'key_generated',
        keyId,
        algorithm: this.algorithm
      });
    }
    
    return keyData;
  }

  /**
   * Derive key from master key using PBKDF2
   */
  deriveKey(salt, info = '') {
    const combinedInfo = `${info}:${Date.now()}`;
    return crypto.pbkdf2Sync(this.masterKey, salt, this.iterations, this.keyLength, 'sha256');
  }

  /**
   * Encrypt data with current key
   */
  async encryptData(data, options = {}) {
    try {
      if (data === null || data === undefined) {
        return null;
      }
      
      const {
        keyId = this.currentKeyId,
        algorithm = this.algorithm,
        additionalData = null,
        compressionEnabled = false
      } = options;
      
      // Check cache first
      const cacheKey = this.createCacheKey(data, keyId);
      if (this.encryptionCache.has(cacheKey)) {
        const cached = this.encryptionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.encryptionMetrics.cacheHits++;
          return cached.encrypted;
        } else {
          this.encryptionCache.delete(cacheKey);
        }
      }
      this.encryptionMetrics.cacheMisses++;
      
      const keyData = this.encryptionKeys.get(keyId);
      if (!keyData || !keyData.active) {
        throw new Error(`Encryption key ${keyId} not found or inactive`);
      }
      
      // Convert data to string if needed
      const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
      const plaintextBuffer = Buffer.from(plaintext, 'utf8');
      
      // Compress if enabled
      let dataToEncrypt = plaintextBuffer;
      if (compressionEnabled && plaintextBuffer.length > 1000) {
        const zlib = await import('zlib');
        dataToEncrypt = zlib.gzipSync(plaintextBuffer);
      }
      
      // Generate IV and salt
      const iv = crypto.randomBytes(this.ivLength);
      const salt = crypto.randomBytes(this.saltLength);
      
      // Create cipher
      const cipher = crypto.createCipher(algorithm, keyData.key);
      cipher.setAutoPadding(true);
      
      // For GCM mode, set IV
      if (algorithm.includes('gcm')) {
        cipher = crypto.createCipherGCM(algorithm, keyData.key, iv);
        if (additionalData) {
          cipher.setAAD(Buffer.from(additionalData));
        }
      }
      
      // Encrypt data
      let encrypted = cipher.update(dataToEncrypt);
      encrypted = Buffer.concat([encrypted, cipher.final()]);
      
      // Get authentication tag for GCM
      let authTag = null;
      if (algorithm.includes('gcm')) {
        authTag = cipher.getAuthTag();
      }
      
      // Create result object
      const result = {
        algorithm,
        keyId,
        iv: iv.toString('hex'),
        salt: salt.toString('hex'),
        data: encrypted.toString('hex'),
        authTag: authTag ? authTag.toString('hex') : null,
        compressed: compressionEnabled && plaintextBuffer.length > 1000,
        timestamp: Date.now(),
        version: '1.0'
      };
      
      // Encode result
      const encodedResult = Buffer.from(JSON.stringify(result)).toString('base64');
      
      // Cache result
      this.encryptionCache.set(cacheKey, {
        encrypted: encodedResult,
        timestamp: Date.now()
      });
      
      // Update metrics and key usage
      this.encryptionMetrics.totalEncryptions++;
      keyData.usageCount++;
      
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'data_encrypted',
          keyId,
          algorithm,
          dataSize: dataToEncrypt.length,
          compressed: result.compressed
        });
      }
      
      return encodedResult;
    } catch (error) {
      this.encryptionMetrics.encryptionErrors++;
      this.emit('error', { operation: 'encrypt_data', error: error.message });
      throw new Error(`Encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt data
   */
  async decryptData(encryptedData, options = {}) {
    try {
      if (!encryptedData) {
        return null;
      }
      
      // Check cache first
      const cacheKey = this.createCacheKey(encryptedData);
      if (this.decryptionCache.has(cacheKey)) {
        const cached = this.decryptionCache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          this.encryptionMetrics.cacheHits++;
          return cached.decrypted;
        } else {
          this.decryptionCache.delete(cacheKey);
        }
      }
      this.encryptionMetrics.cacheMisses++;
      
      // Decode encrypted data
      const encryptedBuffer = Buffer.from(encryptedData, 'base64');
      const encryptionInfo = JSON.parse(encryptedBuffer.toString());
      
      const {
        algorithm,
        keyId,
        iv,
        salt,
        data,
        authTag,
        compressed = false,
        version = '1.0'
      } = encryptionInfo;
      
      // Get encryption key
      const keyData = this.encryptionKeys.get(keyId);
      if (!keyData) {
        throw new Error(`Decryption key ${keyId} not found`);
      }
      
      // Convert hex strings back to buffers
      const ivBuffer = Buffer.from(iv, 'hex');
      const saltBuffer = Buffer.from(salt, 'hex');
      const encryptedBuffer2 = Buffer.from(data, 'hex');
      const authTagBuffer = authTag ? Buffer.from(authTag, 'hex') : null;
      
      // Create decipher
      let decipher;
      if (algorithm.includes('gcm')) {
        decipher = crypto.createDecipherGCM(algorithm, keyData.key, ivBuffer);
        if (authTagBuffer) {
          decipher.setAuthTag(authTagBuffer);
        }
        if (options.additionalData) {
          decipher.setAAD(Buffer.from(options.additionalData));
        }
      } else {
        decipher = crypto.createDecipher(algorithm, keyData.key);
      }
      
      // Decrypt data
      let decrypted = decipher.update(encryptedBuffer2);
      decrypted = Buffer.concat([decrypted, decipher.final()]);
      
      // Decompress if needed
      if (compressed) {
        const zlib = await import('zlib');
        decrypted = zlib.gunzipSync(decrypted);
      }
      
      // Convert back to original format
      const decryptedString = decrypted.toString('utf8');
      let result;
      
      try {
        result = JSON.parse(decryptedString);
      } catch {
        result = decryptedString;
      }
      
      // Cache result
      this.decryptionCache.set(cacheKey, {
        decrypted: result,
        timestamp: Date.now()
      });
      
      // Update metrics
      this.encryptionMetrics.totalDecryptions++;
      
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'data_decrypted',
          keyId,
          algorithm,
          dataSize: decrypted.length,
          compressed
        });
      }
      
      return result;
    } catch (error) {
      this.encryptionMetrics.decryptionErrors++;
      this.emit('error', { operation: 'decrypt_data', error: error.message });
      throw new Error(`Decryption failed: ${error.message}`);
    }
  }

  /**
   * Encrypt object fields selectively
   */
  async encryptObject(obj, options = {}) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const {
      encryptAll = false,
      fieldWhitelist = null,
      fieldBlacklist = null
    } = options;
    
    const result = { ...obj };
    
    for (const [key, value] of Object.entries(result)) {
      let shouldEncrypt = false;
      
      if (encryptAll) {
        shouldEncrypt = true;
      } else if (fieldWhitelist) {
        shouldEncrypt = fieldWhitelist.includes(key);
      } else if (fieldBlacklist) {
        shouldEncrypt = !fieldBlacklist.includes(key);
      } else {
        // Check field encryption config
        shouldEncrypt = this.fieldEncryptionConfig.has(key) ||
          this.encryptedFieldPatterns.some(pattern => pattern.test(key));
      }
      
      if (shouldEncrypt && value !== null && value !== undefined) {
        result[key] = await this.encryptData(value);
        result[`${key}_encrypted`] = true;
      }
    }
    
    return result;
  }

  /**
   * Decrypt object fields selectively
   */
  async decryptObject(obj, options = {}) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    const result = { ...obj };
    
    for (const [key, value] of Object.entries(result)) {
      // Check if field is marked as encrypted
      if (result[`${key}_encrypted`] === true) {
        try {
          result[key] = await this.decryptData(value);
          delete result[`${key}_encrypted`];
        } catch (error) {
          this.emit('error', { 
            operation: 'decrypt_object_field', 
            field: key, 
            error: error.message 
          });
          // Keep encrypted value if decryption fails
        }
      }
    }
    
    return result;
  }

  /**
   * Hash sensitive data for indexing
   */
  hashData(data, salt = null) {
    const saltToUse = salt || crypto.randomBytes(16);
    const hash = crypto.pbkdf2Sync(data, saltToUse, 10000, 32, 'sha256');
    return {
      hash: hash.toString('hex'),
      salt: saltToUse.toString('hex')
    };
  }

  /**
   * Create searchable hash for encrypted data
   */
  createSearchableHash(data) {
    // Use HMAC for consistent hashing
    const hmac = crypto.createHmac('sha256', this.masterKey);
    hmac.update(data.toLowerCase().trim());
    return hmac.digest('hex');
  }

  /**
   * Rotate encryption keys
   */
  async rotateKeys() {
    try {
      // Generate new key
      const newKeyData = this.generateEncryptionKey();
      
      // Mark old key as inactive
      if (this.currentKeyId) {
        const oldKey = this.encryptionKeys.get(this.currentKeyId);
        if (oldKey) {
          oldKey.active = false;
          oldKey.rotatedAt = Date.now();
        }
      }
      
      // Set new key as current
      this.currentKeyId = newKeyData.keyId;
      
      // Save keys
      await this.saveKeys();
      
      // Update metrics
      this.encryptionMetrics.keyRotations++;
      
      if (this.enableAuditLog) {
        this.addAuditEntry({
          action: 'key_rotated',
          oldKeyId: this.currentKeyId,
          newKeyId: newKeyData.keyId
        });
      }
      
      this.emit('keyRotated', {
        oldKeyId: this.currentKeyId,
        newKeyId: newKeyData.keyId
      });
      
      return newKeyData.keyId;
    } catch (error) {
      this.emit('error', { operation: 'rotate_keys', error: error.message });
      throw error;
    }
  }

  /**
   * Re-encrypt data with new key
   */
  async reEncryptData(encryptedData, newKeyId = null) {
    try {
      // Decrypt with old key
      const decryptedData = await this.decryptData(encryptedData);
      
      // Encrypt with new key
      const targetKeyId = newKeyId || this.currentKeyId;
      return await this.encryptData(decryptedData, { keyId: targetKeyId });
    } catch (error) {
      this.emit('error', { operation: 're_encrypt_data', error: error.message });
      throw error;
    }
  }

  /**
   * Setup default field encryption patterns
   */
  setupDefaultFieldEncryption() {
    if (!this.enableFieldLevelEncryption) return;
    
    const sensitiveFields = [
      'password',
      'secret',
      'apiKey',
      'token',
      'refreshToken',
      'accessToken',
      'privateKey',
      'clientSecret',
      'encryptionKey',
      'hashedKey',
      'sessionId',
      'ssn',
      'socialSecurityNumber',
      'creditCardNumber',
      'accountNumber',
      'routingNumber',
      'pin',
      'passcode'
    ];
    
    sensitiveFields.forEach(field => {
      this.fieldEncryptionConfig.set(field, {
        algorithm: this.algorithm,
        keyId: this.currentKeyId,
        required: true
      });
    });
  }

  /**
   * Add field encryption configuration
   */
  addFieldEncryption(fieldName, config = {}) {
    const {
      algorithm = this.algorithm,
      keyId = this.currentKeyId,
      required = false
    } = config;
    
    this.fieldEncryptionConfig.set(fieldName, {
      algorithm,
      keyId,
      required
    });
    
    if (this.enableAuditLog) {
      this.addAuditEntry({
        action: 'field_encryption_added',
        fieldName,
        algorithm,
        keyId,
        required
      });
    }
  }

  /**
   * Remove field encryption configuration
   */
  removeFieldEncryption(fieldName) {
    const removed = this.fieldEncryptionConfig.delete(fieldName);
    
    if (removed && this.enableAuditLog) {
      this.addAuditEntry({
        action: 'field_encryption_removed',
        fieldName
      });
    }
    
    return removed;
  }

  /**
   * Create cache key for encryption/decryption
   */
  createCacheKey(data, keyId = null) {
    const content = keyId ? `${data}:${keyId}` : data;
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Ensure current encryption key exists
   */
  async ensureCurrentKey() {
    if (!this.currentKeyId || !this.encryptionKeys.has(this.currentKeyId)) {
      const keyData = this.generateEncryptionKey();
      this.currentKeyId = keyData.keyId;
      await this.saveKeys();
    }
  }

  /**
   * Get encryption statistics
   */
  getEncryptionStats() {
    return {
      ...this.encryptionMetrics,
      totalKeys: this.encryptionKeys.size,
      activeKeys: Array.from(this.encryptionKeys.values()).filter(k => k.active).length,
      currentKeyId: this.currentKeyId,
      cacheSize: {
        encryption: this.encryptionCache.size,
        decryption: this.decryptionCache.size
      },
      fieldEncryptionRules: this.fieldEncryptionConfig.size,
      auditLogEntries: this.auditLog.length
    };
  }

  /**
   * Add audit log entry
   */
  addAuditEntry(entry) {
    if (!this.enableAuditLog) return;
    
    this.auditLog.push({
      ...entry,
      id: crypto.randomUUID(),
      timestamp: Date.now()
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
      keyId = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = filters;
    
    let entries = [...this.auditLog];
    
    // Apply filters
    if (action) entries = entries.filter(entry => entry.action === action);
    if (keyId) entries = entries.filter(entry => entry.keyId === keyId);
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
   * Load encryption keys from storage
   */
  async loadKeys() {
    try {
      const keyDir = this.keyStoragePath;
      await fs.mkdir(keyDir, { recursive: true });
      
      try {
        const keyFile = path.join(keyDir, 'encryption-keys.json');
        const data = await fs.readFile(keyFile, 'utf8');
        const parsed = JSON.parse(data);
        
        if (parsed.keys) {
          this.encryptionKeys = new Map(parsed.keys.map(([id, keyData]) => [
            id,
            {
              ...keyData,
              key: Buffer.from(keyData.key, 'hex')
            }
          ]));
        }
        
        if (parsed.currentKeyId) {
          this.currentKeyId = parsed.currentKeyId;
        }
        
        if (parsed.fieldEncryptionConfig) {
          this.fieldEncryptionConfig = new Map(parsed.fieldEncryptionConfig);
        }
        
        if (parsed.auditLog) {
          this.auditLog = parsed.auditLog.slice(-1000);
        }
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
        // File doesn't exist, start fresh
      }
    } catch (error) {
      throw new Error(`Failed to load encryption keys: ${error.message}`);
    }
  }

  /**
   * Save encryption keys to storage
   */
  async saveKeys() {
    try {
      const keyDir = this.keyStoragePath;
      await fs.mkdir(keyDir, { recursive: true });
      
      const data = {
        keys: Array.from(this.encryptionKeys.entries()).map(([id, keyData]) => [
          id,
          {
            ...keyData,
            key: keyData.key.toString('hex')
          }
        ]),
        currentKeyId: this.currentKeyId,
        fieldEncryptionConfig: Array.from(this.fieldEncryptionConfig.entries()),
        auditLog: this.auditLog.slice(-1000),
        savedAt: Date.now()
      };
      
      const keyFile = path.join(keyDir, 'encryption-keys.json');
      await fs.writeFile(keyFile, JSON.stringify(data, null, 2));
    } catch (error) {
      throw new Error(`Failed to save encryption keys: ${error.message}`);
    }
  }

  /**
   * Start key rotation timer
   */
  startKeyRotationTimer() {
    if (!this.enableKeyRotation) return;
    
    this.keyRotationTimer = setInterval(() => {
      this.rotateKeys().catch(error => {
        this.emit('error', { operation: 'scheduled_key_rotation', error: error.message });
      });
    }, this.keyRotationInterval);
  }

  /**
   * Start cache cleanup timer
   */
  startCacheCleanupTimer() {
    this.cacheCleanupTimer = setInterval(() => {
      this.cleanupCache();
    }, 300000); // 5 minutes
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    // Clean encryption cache
    for (const [key, value] of this.encryptionCache) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.encryptionCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Clean decryption cache
    for (const [key, value] of this.decryptionCache) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.decryptionCache.delete(key);
        cleanedCount++;
      }
    }
    
    // Enforce max cache size
    if (this.encryptionCache.size > this.maxCacheSize) {
      const entries = Array.from(this.encryptionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - Math.floor(this.maxCacheSize * 0.8));
      toRemove.forEach(([key]) => this.encryptionCache.delete(key));
      cleanedCount += toRemove.length;
    }
    
    if (this.decryptionCache.size > this.maxCacheSize) {
      const entries = Array.from(this.decryptionCache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, entries.length - Math.floor(this.maxCacheSize * 0.8));
      toRemove.forEach(([key]) => this.decryptionCache.delete(key));
      cleanedCount += toRemove.length;
    }
    
    if (cleanedCount > 0) {
      this.emit('cacheCleanup', { cleanedCount });
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.keyRotationTimer) {
      clearInterval(this.keyRotationTimer);
    }
    
    if (this.cacheCleanupTimer) {
      clearInterval(this.cacheCleanupTimer);
    }
    
    try {
      await this.saveKeys();
    } catch (error) {
      this.emit('error', { operation: 'shutdown_save', error: error.message });
    }
    
    // Clear sensitive data from memory
    this.encryptionKeys.clear();
    this.encryptionCache.clear();
    this.decryptionCache.clear();
    this.fieldEncryptionConfig.clear();
    this.auditLog.length = 0;
    this.removeAllListeners();
  }
}

export default DataEncryptionManager;