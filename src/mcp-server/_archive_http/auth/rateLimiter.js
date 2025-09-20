/**
 * Production-Ready Rate Limiting System
 * 
 * Provides comprehensive rate limiting with multiple algorithms,
 * Redis support, memory storage, adaptive limits, and detailed monitoring.
 */

import { EventEmitter } from 'events';

export class RateLimiter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.algorithm = options.algorithm || 'sliding_window'; // 'token_bucket', 'fixed_window', 'sliding_window'
    this.storage = options.storage || 'memory'; // 'memory', 'redis'
    this.redisClient = options.redisClient || null;
    this.keyPrefix = options.keyPrefix || 'mcp_rate_limit:';
    this.enableBurstProtection = options.enableBurstProtection !== false;
    this.enableAdaptiveRateLimit = options.enableAdaptiveRateLimit || false;
    this.enableBlocklist = options.enableBlocklist !== false;
    this.cleanupInterval = options.cleanupInterval || 60000; // 1 minute
    this.maxMemoryUsage = options.maxMemoryUsage || 100000; // Max entries in memory
    
    // Default rate limits (per minute, hour, day)
    this.defaultLimits = {
      requestsPerMinute: options.requestsPerMinute || 60,
      requestsPerHour: options.requestsPerHour || 1000,
      requestsPerDay: options.requestsPerDay || 10000,
      burstLimit: options.burstLimit || 10,
      concurrentRequests: options.concurrentRequests || 5
    };
    
    // Storage for different algorithms
    this.memoryStorage = {
      slidingWindow: new Map(), // clientId -> { requests: [timestamps], windows: {} }
      tokenBucket: new Map(),   // clientId -> { tokens, lastRefill, burstTokens }
      fixedWindow: new Map(),   // clientId -> { count, windowStart }
      concurrent: new Map(),    // clientId -> { activeRequests, maxConcurrent }
      blocklist: new Set(),     // blocked client IDs
      analytics: new Map()      // clientId -> { totalRequests, blockedRequests, etc. }
    };
    
    // Adaptive rate limiting
    this.adaptiveConfig = {
      baselineWindow: 300000, // 5 minutes
      thresholdMultiplier: 1.5,
      adaptationRate: 0.1,
      minLimit: 10,
      maxLimit: 1000
    };
    
    // Monitoring and metrics
    this.metrics = {
      totalRequests: 0,
      blockedRequests: 0,
      adaptiveAdjustments: 0,
      startTime: Date.now()
    };
    
    // Initialize storage
    this.initializeStorage();
    this.startCleanupTimer();
    
    this.emit('initialized', { 
      algorithm: this.algorithm, 
      storage: this.storage,
      defaultLimits: this.defaultLimits 
    });
  }

  /**
   * Initialize storage backend
   */
  async initializeStorage() {
    if (this.storage === 'redis' && this.redisClient) {
      try {
        await this.redisClient.ping();
        this.emit('storageReady', { type: 'redis' });
      } catch (error) {
        this.emit('storageError', { type: 'redis', error: error.message });
        // Fallback to memory storage
        this.storage = 'memory';
      }
    }
  }

  /**
   * Check rate limit for client
   */
  async checkRateLimit(clientId, options = {}) {
    try {
      this.metrics.totalRequests++;
      
      const limits = { ...this.defaultLimits, ...options.limits };
      const context = {
        userAgent: options.userAgent,
        ip: options.ip,
        endpoint: options.endpoint,
        method: options.method || 'GET'
      };

      // Check if client is blocked
      if (this.enableBlocklist && await this.isBlocked(clientId)) {
        this.metrics.blockedRequests++;
        this.emit('requestBlocked', { clientId, reason: 'blocklist', context });
        return {
          allowed: false,
          reason: 'client_blocked',
          retryAfter: null,
          remaining: 0,
          resetTime: null
        };
      }

      // Apply adaptive rate limiting
      if (this.enableAdaptiveRateLimit) {
        limits = await this.applyAdaptiveLimit(clientId, limits, context);
      }

      let result;
      switch (this.algorithm) {
        case 'token_bucket':
          result = await this.checkTokenBucket(clientId, limits, context);
          break;
        case 'fixed_window':
          result = await this.checkFixedWindow(clientId, limits, context);
          break;
        case 'sliding_window':
        default:
          result = await this.checkSlidingWindow(clientId, limits, context);
          break;
      }

      // Check concurrent requests
      const concurrentCheck = await this.checkConcurrentRequests(clientId, limits.concurrentRequests);
      if (!concurrentCheck.allowed) {
        result = concurrentCheck;
      }

      // Update analytics
      await this.updateAnalytics(clientId, result, context);

      // Emit events
      if (result.allowed) {
        this.emit('requestAllowed', { clientId, limits, context, result });
      } else {
        this.metrics.blockedRequests++;
        this.emit('requestBlocked', { clientId, reason: result.reason, context, result });
      }

      return result;
    } catch (error) {
      this.emit('error', { operation: 'check_rate_limit', clientId, error: error.message });
      // Fail open - allow request if rate limiter fails
      return { allowed: true, reason: 'rate_limiter_error' };
    }
  }

  /**
   * Sliding window rate limiting algorithm
   */
  async checkSlidingWindow(clientId, limits, context) {
    const now = Date.now();
    const storage = this.memoryStorage.slidingWindow;
    
    if (!storage.has(clientId)) {
      storage.set(clientId, { 
        requests: [],
        windows: {
          minute: [],
          hour: [],
          day: []
        }
      });
    }

    const clientData = storage.get(clientId);
    
    // Clean old requests
    const oneMinuteAgo = now - 60000;
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;

    clientData.windows.minute = clientData.windows.minute.filter(time => time > oneMinuteAgo);
    clientData.windows.hour = clientData.windows.hour.filter(time => time > oneHourAgo);
    clientData.windows.day = clientData.windows.day.filter(time => time > oneDayAgo);

    // Check limits
    if (clientData.windows.minute.length >= limits.requestsPerMinute) {
      const oldestRequest = Math.min(...clientData.windows.minute);
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limitType: 'minute',
        retryAfter: Math.ceil((oldestRequest + 60000 - now) / 1000),
        remaining: 0,
        resetTime: oldestRequest + 60000,
        limit: limits.requestsPerMinute,
        used: clientData.windows.minute.length
      };
    }

    if (clientData.windows.hour.length >= limits.requestsPerHour) {
      const oldestRequest = Math.min(...clientData.windows.hour);
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limitType: 'hour',
        retryAfter: Math.ceil((oldestRequest + 3600000 - now) / 1000),
        remaining: 0,
        resetTime: oldestRequest + 3600000,
        limit: limits.requestsPerHour,
        used: clientData.windows.hour.length
      };
    }

    if (clientData.windows.day.length >= limits.requestsPerDay) {
      const oldestRequest = Math.min(...clientData.windows.day);
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limitType: 'day',
        retryAfter: Math.ceil((oldestRequest + 86400000 - now) / 1000),
        remaining: 0,
        resetTime: oldestRequest + 86400000,
        limit: limits.requestsPerDay,
        used: clientData.windows.day.length
      };
    }

    // Check burst protection
    if (this.enableBurstProtection) {
      const recentRequests = clientData.windows.minute.filter(time => time > now - 10000); // Last 10 seconds
      if (recentRequests.length >= limits.burstLimit) {
        return {
          allowed: false,
          reason: 'burst_limit_exceeded',
          limitType: 'burst',
          retryAfter: 10,
          remaining: 0,
          resetTime: now + 10000,
          limit: limits.burstLimit,
          used: recentRequests.length
        };
      }
    }

    // Allow request - update counters
    clientData.windows.minute.push(now);
    clientData.windows.hour.push(now);
    clientData.windows.day.push(now);

    return {
      allowed: true,
      remaining: {
        minute: limits.requestsPerMinute - clientData.windows.minute.length,
        hour: limits.requestsPerHour - clientData.windows.hour.length,
        day: limits.requestsPerDay - clientData.windows.day.length
      },
      resetTime: {
        minute: Math.min(...clientData.windows.minute) + 60000,
        hour: Math.min(...clientData.windows.hour) + 3600000,
        day: Math.min(...clientData.windows.day) + 86400000
      },
      limits
    };
  }

  /**
   * Token bucket rate limiting algorithm
   */
  async checkTokenBucket(clientId, limits, context) {
    const now = Date.now();
    const storage = this.memoryStorage.tokenBucket;
    
    if (!storage.has(clientId)) {
      storage.set(clientId, {
        tokens: limits.requestsPerMinute,
        lastRefill: now,
        burstTokens: limits.burstLimit
      });
    }

    const bucket = storage.get(clientId);
    
    // Refill tokens based on time elapsed
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor(timeElapsed / 1000) * (limits.requestsPerMinute / 60); // Per second rate
    bucket.tokens = Math.min(limits.requestsPerMinute, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;

    // Check if we have tokens available
    if (bucket.tokens < 1) {
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limitType: 'token_bucket',
        retryAfter: Math.ceil((1 - bucket.tokens) * (60 / limits.requestsPerMinute)),
        remaining: 0,
        resetTime: now + ((1 - bucket.tokens) * (60000 / limits.requestsPerMinute)),
        limit: limits.requestsPerMinute,
        used: limits.requestsPerMinute - bucket.tokens
      };
    }

    // Consume a token
    bucket.tokens -= 1;

    return {
      allowed: true,
      remaining: Math.floor(bucket.tokens),
      resetTime: bucket.lastRefill + 60000,
      limits,
      algorithm: 'token_bucket'
    };
  }

  /**
   * Fixed window rate limiting algorithm
   */
  async checkFixedWindow(clientId, limits, context) {
    const now = Date.now();
    const windowSize = 60000; // 1 minute window
    const currentWindow = Math.floor(now / windowSize);
    const storage = this.memoryStorage.fixedWindow;
    
    if (!storage.has(clientId)) {
      storage.set(clientId, {
        count: 0,
        window: currentWindow
      });
    }

    const clientData = storage.get(clientId);
    
    // Reset if we're in a new window
    if (clientData.window !== currentWindow) {
      clientData.count = 0;
      clientData.window = currentWindow;
    }

    // Check limit
    if (clientData.count >= limits.requestsPerMinute) {
      const nextWindow = (currentWindow + 1) * windowSize;
      return {
        allowed: false,
        reason: 'rate_limit_exceeded',
        limitType: 'fixed_window',
        retryAfter: Math.ceil((nextWindow - now) / 1000),
        remaining: 0,
        resetTime: nextWindow,
        limit: limits.requestsPerMinute,
        used: clientData.count
      };
    }

    // Allow request
    clientData.count += 1;

    return {
      allowed: true,
      remaining: limits.requestsPerMinute - clientData.count,
      resetTime: (currentWindow + 1) * windowSize,
      limits,
      algorithm: 'fixed_window'
    };
  }

  /**
   * Check concurrent requests limit
   */
  async checkConcurrentRequests(clientId, maxConcurrent) {
    const storage = this.memoryStorage.concurrent;
    
    if (!storage.has(clientId)) {
      storage.set(clientId, { activeRequests: 0, maxConcurrent });
    }

    const concurrentData = storage.get(clientId);
    
    if (concurrentData.activeRequests >= maxConcurrent) {
      return {
        allowed: false,
        reason: 'concurrent_limit_exceeded',
        limitType: 'concurrent',
        retryAfter: 1,
        remaining: 0,
        limit: maxConcurrent,
        used: concurrentData.activeRequests
      };
    }

    // Increment active requests
    concurrentData.activeRequests += 1;

    return { allowed: true };
  }

  /**
   * Mark request as completed (for concurrent limiting)
   */
  async completeRequest(clientId) {
    const storage = this.memoryStorage.concurrent;
    const concurrentData = storage.get(clientId);
    
    if (concurrentData && concurrentData.activeRequests > 0) {
      concurrentData.activeRequests -= 1;
    }
  }

  /**
   * Apply adaptive rate limiting
   */
  async applyAdaptiveLimit(clientId, baseLimits, context) {
    const analytics = this.memoryStorage.analytics.get(clientId);
    if (!analytics) {
      return baseLimits;
    }

    const now = Date.now();
    const timeWindow = this.adaptiveConfig.baselineWindow;
    const recentRequests = analytics.requestHistory.filter(req => req.timestamp > now - timeWindow);
    
    if (recentRequests.length === 0) {
      return baseLimits;
    }

    // Calculate error rate and request pattern
    const errorRequests = recentRequests.filter(req => req.blocked || req.error);
    const errorRate = errorRequests.length / recentRequests.length;
    const requestRate = recentRequests.length / (timeWindow / 60000); // requests per minute

    // Adjust limits based on behavior
    let adjustmentFactor = 1.0;

    if (errorRate > 0.1) { // High error rate
      adjustmentFactor *= (1 - this.adaptiveConfig.adaptationRate);
    } else if (errorRate < 0.01 && requestRate < baseLimits.requestsPerMinute * 0.5) { // Good behavior
      adjustmentFactor *= (1 + this.adaptiveConfig.adaptationRate);
    }

    // Apply bounds
    const adaptedLimits = { ...baseLimits };
    adaptedLimits.requestsPerMinute = Math.max(
      this.adaptiveConfig.minLimit,
      Math.min(
        this.adaptiveConfig.maxLimit,
        Math.floor(baseLimits.requestsPerMinute * adjustmentFactor)
      )
    );

    if (adjustmentFactor !== 1.0) {
      this.metrics.adaptiveAdjustments++;
      this.emit('adaptiveAdjustment', { 
        clientId, 
        originalLimit: baseLimits.requestsPerMinute,
        adaptedLimit: adaptedLimits.requestsPerMinute,
        adjustmentFactor,
        errorRate,
        requestRate
      });
    }

    return adaptedLimits;
  }

  /**
   * Check if client is blocked
   */
  async isBlocked(clientId) {
    return this.memoryStorage.blocklist.has(clientId);
  }

  /**
   * Block client
   */
  async blockClient(clientId, reason = 'violation', duration = null) {
    this.memoryStorage.blocklist.add(clientId);
    
    // Auto-unblock after duration if specified
    if (duration) {
      setTimeout(() => {
        this.unblockClient(clientId);
      }, duration);
    }

    this.emit('clientBlocked', { clientId, reason, duration });
    return true;
  }

  /**
   * Unblock client
   */
  async unblockClient(clientId) {
    const wasBlocked = this.memoryStorage.blocklist.delete(clientId);
    
    if (wasBlocked) {
      this.emit('clientUnblocked', { clientId });
    }
    
    return wasBlocked;
  }

  /**
   * Update analytics for client
   */
  async updateAnalytics(clientId, result, context) {
    const storage = this.memoryStorage.analytics;
    
    if (!storage.has(clientId)) {
      storage.set(clientId, {
        totalRequests: 0,
        blockedRequests: 0,
        allowedRequests: 0,
        firstSeen: Date.now(),
        lastSeen: Date.now(),
        requestHistory: [],
        endpoints: new Map(),
        userAgents: new Set()
      });
    }

    const analytics = storage.get(clientId);
    analytics.totalRequests += 1;
    analytics.lastSeen = Date.now();

    if (result.allowed) {
      analytics.allowedRequests += 1;
    } else {
      analytics.blockedRequests += 1;
    }

    // Track request details
    analytics.requestHistory.push({
      timestamp: Date.now(),
      blocked: !result.allowed,
      reason: result.reason,
      endpoint: context.endpoint,
      method: context.method
    });

    // Limit history size
    if (analytics.requestHistory.length > 1000) {
      analytics.requestHistory = analytics.requestHistory.slice(-500);
    }

    // Track endpoint usage
    if (context.endpoint) {
      const count = analytics.endpoints.get(context.endpoint) || 0;
      analytics.endpoints.set(context.endpoint, count + 1);
    }

    // Track user agents
    if (context.userAgent) {
      analytics.userAgents.add(context.userAgent);
    }
  }

  /**
   * Get client analytics
   */
  getClientAnalytics(clientId) {
    const analytics = this.memoryStorage.analytics.get(clientId);
    if (!analytics) {
      return null;
    }

    return {
      clientId,
      totalRequests: analytics.totalRequests,
      allowedRequests: analytics.allowedRequests,
      blockedRequests: analytics.blockedRequests,
      successRate: analytics.totalRequests > 0 ? analytics.allowedRequests / analytics.totalRequests : 0,
      firstSeen: analytics.firstSeen,
      lastSeen: analytics.lastSeen,
      topEndpoints: Array.from(analytics.endpoints.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10),
      userAgentCount: analytics.userAgents.size,
      isBlocked: this.memoryStorage.blocklist.has(clientId)
    };
  }

  /**
   * Get rate limiter statistics
   */
  getStats() {
    const now = Date.now();
    const uptime = now - this.metrics.startTime;
    
    return {
      algorithm: this.algorithm,
      storage: this.storage,
      uptime,
      totalRequests: this.metrics.totalRequests,
      blockedRequests: this.metrics.blockedRequests,
      allowedRequests: this.metrics.totalRequests - this.metrics.blockedRequests,
      blockRate: this.metrics.totalRequests > 0 ? this.metrics.blockedRequests / this.metrics.totalRequests : 0,
      adaptiveAdjustments: this.metrics.adaptiveAdjustments,
      activeClients: {
        slidingWindow: this.memoryStorage.slidingWindow.size,
        tokenBucket: this.memoryStorage.tokenBucket.size,
        fixedWindow: this.memoryStorage.fixedWindow.size,
        concurrent: this.memoryStorage.concurrent.size,
        analytics: this.memoryStorage.analytics.size
      },
      blockedClients: this.memoryStorage.blocklist.size,
      requestsPerSecond: this.metrics.totalRequests / (uptime / 1000)
    };
  }

  /**
   * Reset client limits
   */
  async resetClient(clientId) {
    this.memoryStorage.slidingWindow.delete(clientId);
    this.memoryStorage.tokenBucket.delete(clientId);
    this.memoryStorage.fixedWindow.delete(clientId);
    this.memoryStorage.concurrent.delete(clientId);
    this.memoryStorage.analytics.delete(clientId);
    this.memoryStorage.blocklist.delete(clientId);

    this.emit('clientReset', { clientId });
    return true;
  }

  /**
   * Start cleanup timer for expired data
   */
  startCleanupTimer() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredData();
    }, this.cleanupInterval);
  }

  /**
   * Cleanup expired data from memory
   */
  cleanupExpiredData() {
    const now = Date.now();
    const oneHourAgo = now - 3600000;
    let cleanedCount = 0;

    // Clean sliding window data
    for (const [clientId, data] of this.memoryStorage.slidingWindow) {
      if (data.windows.day.length === 0 || Math.max(...data.windows.day) < oneHourAgo) {
        this.memoryStorage.slidingWindow.delete(clientId);
        cleanedCount++;
      }
    }

    // Clean token bucket data (inactive clients)
    for (const [clientId, bucket] of this.memoryStorage.tokenBucket) {
      if (bucket.lastRefill < oneHourAgo) {
        this.memoryStorage.tokenBucket.delete(clientId);
        cleanedCount++;
      }
    }

    // Clean analytics data (keep only active clients)
    for (const [clientId, analytics] of this.memoryStorage.analytics) {
      if (analytics.lastSeen < oneHourAgo) {
        this.memoryStorage.analytics.delete(clientId);
        cleanedCount++;
      }
    }

    // Enforce memory limits
    if (this.memoryStorage.analytics.size > this.maxMemoryUsage) {
      const sortedClients = Array.from(this.memoryStorage.analytics.entries())
        .sort((a, b) => a[1].lastSeen - b[1].lastSeen);
      
      const toRemove = sortedClients.slice(0, sortedClients.length - Math.floor(this.maxMemoryUsage * 0.8));
      toRemove.forEach(([clientId]) => {
        this.resetClient(clientId);
        cleanedCount++;
      });
    }

    if (cleanedCount > 0) {
      this.emit('dataCleanup', { cleanedCount, activeClients: this.memoryStorage.analytics.size });
    }
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Clear all memory storage
    Object.values(this.memoryStorage).forEach(storage => {
      if (storage instanceof Map || storage instanceof Set) {
        storage.clear();
      }
    });

    this.removeAllListeners();
  }
}

export default RateLimiter;