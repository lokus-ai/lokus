/**
 * Registry API Client
 * RESTful API client for plugin registry operations with offline support
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { logger } from '../../utils/logger.js'

/**
 * API Response Status
 */
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden',
  NOT_FOUND: 'not_found',
  RATE_LIMITED: 'rate_limited',
  SERVER_ERROR: 'server_error'
}

/**
* Authentication Methods
 */
export const AUTH_METHODS = {
  API_KEY: 'api_key',
  OAUTH: 'oauth',
  JWT: 'jwt'
}

/**
 * Registry API Client
 */
export class RegistryAPI extends EventEmitter {
  constructor(config = {}) {
    super()

    this.config = {
      baseUrl: 'http://localhost:3000/api/v1/registry',
      timeout: 30000,
      retryAttempts: 1,
      retryDelay: 500,
      maxRetryDelay: 2000,
      cacheTimeout: 300000, // 5 minutes
      offlineMode: false,
      ...config
    }

    // Authentication
    this.auth = {
      method: null,
      token: null,
      expires: null,
      refreshToken: null
    }

    // Request cache for offline support
    this.cache = new Map()
    this.pendingRequests = new Map()

    // Rate limiting
    this.rateLimiter = {
      requests: 0,
      resetTime: Date.now() + 60000, // 1 minute window
      limit: 100 // requests per minute
    }

    // Network status
    this.isOnline = navigator?.onLine ?? true
    this.lastSyncTime = null

    // COMPLETED TODO: Replaced console with proper logger
    this.logger = logger.createScoped('RegistryAPI')

    // Setup network monitoring
    this.setupNetworkMonitoring()
  }

  /**
   * Authentication methods
   */
  async authenticate(method, credentials) {
    try {
      const endpoint = this.getAuthEndpoint(method)
      const response = await this.request('POST', endpoint, credentials, {
        skipAuth: true,
        skipCache: true
      })

      if (response.status === API_STATUS.SUCCESS) {
        this.auth = {
          method,
          token: response.data.token,
          expires: response.data.expires ? new Date(response.data.expires) : null,
          refreshToken: response.data.refreshToken || null
        }

        this.emit('authenticated', { method, token: this.auth.token })
        this.logger.info(`Authenticated successfully using ${method}`)

        return {
          success: true,
          token: this.auth.token,
          expires: this.auth.expires
        }
      } else {
        throw new Error(response.message || 'Authentication failed')
      }
    } catch (error) {
      this.logger.error('Authentication failed:', error)
      throw error
    }
  }

  async refreshAuthentication() {
    try {
      if (!this.auth.refreshToken) {
        throw new Error('No refresh token available')
      }

      const response = await this.request('POST', '/auth/refresh', {
        refreshToken: this.auth.refreshToken
      }, {
        skipAuth: true,
        skipCache: true
      })

      if (response.status === API_STATUS.SUCCESS) {
        this.auth.token = response.data.token
        this.auth.expires = response.data.expires ? new Date(response.data.expires) : null

        this.emit('token_refreshed', { token: this.auth.token })
        return true
      }

      return false
    } catch (error) {
      this.logger.error('Token refresh failed:', error)
      return false
    }
  }

  logout() {
    this.auth = {
      method: null,
      token: null,
      expires: null,
      refreshToken: null
    }

    this.emit('logged_out')
    this.logger.info('Logged out successfully')
  }

  /**
   * Plugin management API
   */
  async searchPlugins(query, options = {}) {
    const params = new URLSearchParams({
      q: query || '',
      ...options
    })

    return this.request('GET', `/search?${params}`, null, {
      cacheable: true,
      cacheKey: `search_${query}_${JSON.stringify(options)}`
    })
  }

  async getPlugin(pluginId, version = 'latest') {
    // If version is 'latest', we use the plugin details endpoint which returns latest
    // If specific version, we might need a different endpoint or query param
    // My API: /api/v1/registry/plugin/[id] returns details + versions
    return this.request('GET', `/plugin/${pluginId}`, null, {
      cacheable: true,
      cacheKey: `plugin_${pluginId}_${version}`
    })
  }

  async getFeaturedPlugins(limit = 10) {
    // My API: /api/v1/registry/featured (I need to create this or use search)
    // For now, let's use search with sort
    return this.request('GET', `/search?sort=downloads&limit=${limit}`, null, {
      cacheable: true,
      cacheKey: `featured_${limit}`
    })
  }

  async getPluginVersions(pluginId) {
    // Included in getPlugin response in my API
    const response = await this.getPlugin(pluginId)
    return { ...response, data: response.data.versions || [] }
  }

  async getPluginStats(pluginId) {
    // Included in getPlugin response
    return this.getPlugin(pluginId)
  }

  async downloadPlugin(pluginId, version = 'latest') {
    // My API: /api/v1/registry/download/[id]/[version]
    // If version is latest, we need to resolve it first or backend handles it
    // My backend expects specific version for download

    let targetVersion = version;
    if (version === 'latest') {
      const plugin = await this.getPlugin(pluginId);
      targetVersion = plugin.data.latest_version;
    }

    const response = await this.request('GET', `/download/${pluginId}/${targetVersion}`, null, {
      skipCache: true,
      responseType: 'json' // My API returns a JSON with signed URL
    })

    // Now fetch the actual file from the signed URL
    if (response.data && response.data.url) {
      const fileResponse = await fetch(response.data.url);
      if (!fileResponse.ok) throw new Error('Failed to download file from storage');
      return {
        data: await fileResponse.blob(),
        status: API_STATUS.SUCCESS
      };
    }

    throw new Error('Invalid download response');
  }

  /**
   * Plugin publishing API
   */
  async publishPlugin(pluginData, packageFile) {
    try {
      const formData = new FormData()
      formData.append('manifest', JSON.stringify(pluginData.manifest))
      formData.append('package', packageFile)

      if (pluginData.readme) {
        formData.append('readme', pluginData.readme)
      }

      if (pluginData.changelog) {
        formData.append('changelog', pluginData.changelog)
      }

      return this.request('POST', '/plugins', formData, {
        skipCache: true,
        requireAuth: true,
        headers: {
          // Let browser set content-type for FormData
        }
      })
    } catch (error) {
      this.logger.error('Failed to publish plugin:', error)
      throw error
    }
  }

  async updatePlugin(pluginId, version, updateData, packageFile) {
    try {
      const formData = new FormData()
      formData.append('manifest', JSON.stringify(updateData.manifest))

      if (packageFile) {
        formData.append('package', packageFile)
      }

      if (updateData.changelog) {
        formData.append('changelog', updateData.changelog)
      }

      return this.request('PUT', `/plugins/${pluginId}/${version}`, formData, {
        skipCache: true,
        requireAuth: true
      })
    } catch (error) {
      this.logger.error('Failed to update plugin:', error)
      throw error
    }
  }

  async deletePlugin(pluginId, version = null) {
    const endpoint = version
      ? `/plugins/${pluginId}/${version}`
      : `/plugins/${pluginId}`

    return this.request('DELETE', endpoint, null, {
      skipCache: true,
      requireAuth: true
    })
  }

  /**
   * Review and rating API
   */
  async submitReview(pluginId, rating, review, metadata = {}) {
    return this.request('POST', `/plugins/${pluginId}/reviews`, {
      rating,
      review,
      metadata
    }, {
      skipCache: true,
      requireAuth: true
    })
  }

  async getReviews(pluginId, options = {}) {
    const params = new URLSearchParams(options)
    return this.request('GET', `/plugins/${pluginId}/reviews?${params}`, null, {
      cacheable: true,
      cacheKey: `reviews_${pluginId}_${JSON.stringify(options)}`
    })
  }

  async updateReview(pluginId, reviewId, updates) {
    return this.request('PUT', `/plugins/${pluginId}/reviews/${reviewId}`, updates, {
      skipCache: true,
      requireAuth: true
    })
  }

  async deleteReview(pluginId, reviewId) {
    return this.request('DELETE', `/plugins/${pluginId}/reviews/${reviewId}`, null, {
      skipCache: true,
      requireAuth: true
    })
  }

  async markReviewHelpful(pluginId, reviewId) {
    return this.request('POST', `/plugins/${pluginId}/reviews/${reviewId}/helpful`, null, {
      skipCache: true,
      requireAuth: true
    })
  }

  /**
   * Category and tag management
   */
  async getCategories() {
    return this.request('GET', '/categories', null, {
      cacheable: true,
      cacheKey: 'categories'
    })
  }

  async getTags() {
    return this.request('GET', '/tags', null, {
      cacheable: true,
      cacheKey: 'tags'
    })
  }

  /**
   * User and publisher API
   */
  async getPublisherProfile(publisherId) {
    return this.request('GET', `/publishers/${publisherId}`, null, {
      cacheable: true,
      cacheKey: `publisher_${publisherId}`
    })
  }

  async updatePublisherProfile(publisherId, profileData) {
    return this.request('PUT', `/publishers/${publisherId}`, profileData, {
      skipCache: true,
      requireAuth: true
    })
  }

  async getPublisherPlugins(publisherId, options = {}) {
    const params = new URLSearchParams(options)
    return this.request('GET', `/publishers/${publisherId}/plugins?${params}`, null, {
      cacheable: true,
      cacheKey: `publisher_plugins_${publisherId}_${JSON.stringify(options)}`
    })
  }

  /**
   * Analytics and tracking
   */
  async trackDownload(pluginId, version, metadata = {}) {
    return this.request('POST', `/analytics/download`, {
      pluginId,
      version,
      timestamp: new Date().toISOString(),
      metadata
    }, {
      skipCache: true,
      skipRetry: true // Don't retry analytics calls
    })
  }

  async trackInstall(pluginId, version, success, metadata = {}) {
    return this.request('POST', `/analytics/install`, {
      pluginId,
      version,
      success,
      timestamp: new Date().toISOString(),
      metadata
    }, {
      skipCache: true,
      skipRetry: true
    })
  }

  async getAnalytics(pluginId, timeRange = '30d') {
    return this.request('GET', `/analytics/${pluginId}?range=${timeRange}`, null, {
      cacheable: true,
      cacheKey: `analytics_${pluginId}_${timeRange}`,
      requireAuth: true
    })
  }

  /**
   * Core request method with retry logic and caching
   */
  async request(method, endpoint, data = null, options = {}) {
    const {
      skipAuth = false,
      requireAuth = false,
      skipCache = false,
      cacheable = false,
      cacheKey = null,
      skipRetry = false,
      responseType = 'json',
      headers = {}
    } = options

    // Check authentication
    if (requireAuth && !this.isAuthenticated()) {
      throw new Error('Authentication required')
    }

    // Check rate limiting
    await this.checkRateLimit()

    // Check cache first
    if (!skipCache && cacheable && cacheKey) {
      const cached = this.getCachedResponse(cacheKey)
      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`)
        return cached
      }
    }

    // Check if offline and request is cacheable
    if (!this.isOnline && cacheable && cacheKey) {
      const cached = this.getCachedResponse(cacheKey, true) // Allow stale cache
      if (cached) {
        this.logger.warn(`Using stale cache (offline): ${cacheKey}`)
        return cached
      }
    }

    if (!this.isOnline && !this.config.offlineMode) {
      throw new Error('Network unavailable and offline mode disabled')
    }

    const url = this.buildUrl(endpoint)
    const requestOptions = this.buildRequestOptions(method, data, {
      skipAuth,
      headers,
      responseType
    })

    // Add to pending requests to avoid duplicates
    const requestKey = `${method}:${endpoint}`
    if (this.pendingRequests.has(requestKey)) {
      return this.pendingRequests.get(requestKey)
    }

    const requestPromise = this.executeRequest(url, requestOptions, {
      skipRetry,
      method,
      endpoint
    })

    this.pendingRequests.set(requestKey, requestPromise)

    try {
      const response = await requestPromise

      // Cache successful responses
      if (cacheable && cacheKey && response.status === API_STATUS.SUCCESS) {
        this.setCachedResponse(cacheKey, response)
      }

      return response
    } finally {
      this.pendingRequests.delete(requestKey)
    }
  }

  async executeRequest(url, options, context) {
    const { skipRetry, method, endpoint } = context
    let lastError = null

    for (let attempt = 0; attempt <= (skipRetry ? 0 : this.config.retryAttempts); attempt++) {
      try {
        if (attempt > 0) {
          const delay = Math.min(
            this.config.retryDelay * Math.pow(2, attempt - 1),
            this.config.maxRetryDelay
          )
          await this.sleep(delay)
          this.logger.warn(`Retrying request (attempt ${attempt + 1}): ${method} ${endpoint}`)
        }

        const response = await this.performRequest(url, options)
        this.updateRateLimit(response.headers)

        return this.processResponse(response)
      } catch (error) {
        lastError = error

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          break
        }

        // Check if we should refresh token and retry
        if (error.status === 401 && this.auth.refreshToken && attempt === 0) {
          const refreshed = await this.refreshAuthentication()
          if (refreshed) {
            // Update options with new token
            options.headers = this.buildHeaders(options.headers, false)
            continue
          }
        }

        if (attempt === this.config.retryAttempts) {
          break
        }
      }
    }

    this.logger.error(`Request failed after ${this.config.retryAttempts + 1} attempts:`, lastError)
    throw lastError
  }

  async performRequest(url, options) {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout)

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      })

      clearTimeout(timeoutId)
      return response
    } catch (error) {
      clearTimeout(timeoutId)

      if (error.name === 'AbortError') {
        throw new Error('Request timeout')
      }

      throw error
    }
  }

  async processResponse(response) {
    let data = null

    try {
      const contentType = response.headers.get('content-type')

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else if (contentType?.includes('text/')) {
        data = await response.text()
      } else {
        data = await response.blob()
      }
    } catch (error) {
      this.logger.warn('Failed to parse response body:', error)
    }

    const result = {
      status: this.mapHttpStatusToApiStatus(response.status),
      statusCode: response.status,
      data,
      message: data?.message || response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      ok: response.ok
    }

    if (!response.ok) {
      const error = new Error(result.message || `HTTP ${response.status}`)
      error.response = result
      error.status = response.status
      throw error
    }

    return result
  }

  /**
   * Helper methods
   */

  buildUrl(endpoint) {
    const baseUrl = this.config.baseUrl.replace(/\/$/, '')
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
    return `${baseUrl}${cleanEndpoint}`
  }

  buildRequestOptions(method, data, options) {
    const { skipAuth, headers, responseType } = options

    const requestOptions = {
      method: method.toUpperCase(),
      headers: this.buildHeaders(headers, skipAuth)
    }

    if (data !== null) {
      if (data instanceof FormData) {
        requestOptions.body = data
        // Don't set content-type for FormData, let browser handle it
      } else if (typeof data === 'object') {
        requestOptions.body = JSON.stringify(data)
        requestOptions.headers['Content-Type'] = 'application/json'
      } else {
        requestOptions.body = data
      }
    }

    return requestOptions
  }

  buildHeaders(additionalHeaders = {}, skipAuth = false) {
    const headers = {
      'User-Agent': 'Lokus-Plugin-Client/1.0',
      'Accept': 'application/json',
      ...additionalHeaders
    }

    if (!skipAuth && this.isAuthenticated()) {
      const authHeader = this.getAuthHeader()
      if (authHeader) {
        headers['Authorization'] = authHeader
      }
    }

    return headers
  }

  getAuthHeader() {
    if (!this.auth.token) return null

    switch (this.auth.method) {
      case AUTH_METHODS.API_KEY:
        return `Bearer ${this.auth.token}`
      case AUTH_METHODS.JWT:
        return `Bearer ${this.auth.token}`
      case AUTH_METHODS.OAUTH:
        return `Bearer ${this.auth.token}`
      default:
        return `Bearer ${this.auth.token}`
    }
  }

  getAuthEndpoint(method) {
    switch (method) {
      case AUTH_METHODS.API_KEY:
        return '/auth/api-key'
      case AUTH_METHODS.OAUTH:
        return '/auth/oauth'
      case AUTH_METHODS.JWT:
        return '/auth/login'
      default:
        throw new Error(`Unsupported auth method: ${method}`)
    }
  }

  isAuthenticated() {
    if (!this.auth.token) return false
    if (!this.auth.expires) return true
    return new Date() < this.auth.expires
  }

  isNonRetryableError(error) {
    const nonRetryableStatuses = [400, 401, 403, 404, 422]
    return nonRetryableStatuses.includes(error.status)
  }

  mapHttpStatusToApiStatus(httpStatus) {
    switch (httpStatus) {
      case 200:
      case 201:
      case 202:
        return API_STATUS.SUCCESS
      case 401:
        return API_STATUS.UNAUTHORIZED
      case 403:
        return API_STATUS.FORBIDDEN
      case 404:
        return API_STATUS.NOT_FOUND
      case 429:
        return API_STATUS.RATE_LIMITED
      case 500:
      case 502:
      case 503:
      case 504:
        return API_STATUS.SERVER_ERROR
      default:
        return API_STATUS.ERROR
    }
  }

  /**
   * Cache management
   */
  getCachedResponse(key, allowStale = false) {
    const cached = this.cache.get(key)
    if (!cached) return null

    const now = Date.now()
    const isExpired = now > cached.expires

    if (isExpired && !allowStale) {
      this.cache.delete(key)
      return null
    }

    return {
      ...cached.response,
      _cached: true,
      _stale: isExpired
    }
  }

  setCachedResponse(key, response) {
    this.cache.set(key, {
      response: { ...response },
      expires: Date.now() + this.config.cacheTimeout,
      cachedAt: Date.now()
    })
  }

  clearCache() {
    this.cache.clear()
    this.logger.info('API cache cleared')
  }

  /**
   * Rate limiting
   */
  async checkRateLimit() {
    const now = Date.now()

    if (now > this.rateLimiter.resetTime) {
      this.rateLimiter.requests = 0
      this.rateLimiter.resetTime = now + 60000
    }

    if (this.rateLimiter.requests >= this.rateLimiter.limit) {
      const waitTime = this.rateLimiter.resetTime - now
      this.logger.warn(`Rate limit exceeded, waiting ${waitTime}ms`)
      await this.sleep(waitTime)
      this.rateLimiter.requests = 0
      this.rateLimiter.resetTime = Date.now() + 60000
    }

    this.rateLimiter.requests++
  }

  updateRateLimit(headers) {
    const remaining = headers['x-ratelimit-remaining']
    const reset = headers['x-ratelimit-reset']

    if (remaining !== undefined) {
      this.rateLimiter.requests = this.rateLimiter.limit - parseInt(remaining)
    }

    if (reset !== undefined) {
      this.rateLimiter.resetTime = parseInt(reset) * 1000
    }
  }

  /**
   * Network monitoring
   */
  setupNetworkMonitoring() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true
        this.emit('online')
        this.syncOfflineRequests()
      })

      window.addEventListener('offline', () => {
        this.isOnline = false
        this.emit('offline')
      })
    }
  }

  async syncOfflineRequests() {
    // TODO: Implement offline request syncing
    this.lastSyncTime = new Date()
    this.emit('synced')
  }

  /**
   * Utility methods
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Configuration and state
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig }
  }

  getConfig() {
    return { ...this.config }
  }

  getStatus() {
    return {
      online: this.isOnline,
      authenticated: this.isAuthenticated(),
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      rateLimit: { ...this.rateLimiter },
      lastSync: this.lastSyncTime
    }
  }
}

export default RegistryAPI