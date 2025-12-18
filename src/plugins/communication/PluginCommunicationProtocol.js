/**
 * Plugin Communication Protocol - JSON-RPC 2.0 based secure communication
 * 
 * Provides structured, type-safe communication between plugins and host:
 * - JSON-RPC 2.0 protocol implementation
 * - Request/response correlation
 * - Event subscription system
 * - Message validation and security
 * - Performance monitoring
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

/**
 * JSON-RPC 2.0 Message Types
 */
export const MessageType = {
  REQUEST: 'request',
  RESPONSE: 'response',
  NOTIFICATION: 'notification',
  ERROR: 'error'
}

/**
 * Standard JSON-RPC 2.0 Error Codes
 */
export const ErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Custom error codes
  PERMISSION_DENIED: -32000,
  RATE_LIMIT_EXCEEDED: -32001,
  RESOURCE_EXHAUSTED: -32002,
  PLUGIN_ERROR: -32003,
  VALIDATION_ERROR: -32004
}

/**
 * Plugin Communication Protocol Implementation
 */
export class PluginCommunicationProtocol extends EventEmitter {
  constructor(pluginId, securityManager) {
    super()
    
    this.pluginId = pluginId
    this.securityManager = securityManager
    
    // Message tracking
    this.nextRequestId = 1
    this.pendingRequests = new Map() // id -> { resolve, reject, timeout, timestamp }
    this.subscriptions = new Map() // event -> Set of handlers
    
    // Protocol configuration
    this.config = {
      requestTimeout: 30000, // 30 seconds
      maxConcurrentRequests: 100,
      rateLimitWindow: 1000, // 1 second
      rateLimitRequests: 100, // per window
      enableCompression: false,
      enableEncryption: false
    }
    
    // Performance monitoring
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      requestsCompleted: 0,
      requestsFailed: 0,
      averageResponseTime: 0,
      errors: []
    }
    
    // Rate limiting
    this.rateLimitWindow = []
    
    // Message handlers
    this.methodHandlers = new Map()
    this.setupDefaultHandlers()
  }

  /**
   * Setup default message handlers
   */
  setupDefaultHandlers() {
    // Plugin lifecycle
    this.registerMethodHandler('plugin.activate', this.handleActivate.bind(this))
    this.registerMethodHandler('plugin.deactivate', this.handleDeactivate.bind(this))
    this.registerMethodHandler('plugin.getInfo', this.handleGetInfo.bind(this))
    
    // API forwarding
    this.registerMethodHandler('api.*', this.handleAPICall.bind(this))
    
    // Event system
    this.registerMethodHandler('events.subscribe', this.handleEventSubscribe.bind(this))
    this.registerMethodHandler('events.unsubscribe', this.handleEventUnsubscribe.bind(this))
    this.registerMethodHandler('events.emit', this.handleEventEmit.bind(this))
  }

  /**
   * Register method handler
   */
  registerMethodHandler(method, handler) {
    this.methodHandlers.set(method, handler)
  }

  /**
   * Send request and wait for response
   */
  async sendRequest(method, params = {}, options = {}) {
    // Rate limiting check
    if (!this.checkRateLimit()) {
      throw this.createError(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded')
    }

    // Check concurrent request limit
    if (this.pendingRequests.size >= this.config.maxConcurrentRequests) {
      throw this.createError(ErrorCode.RESOURCE_EXHAUSTED, 'Too many concurrent requests')
    }

    const id = this.nextRequestId++
    const request = this.createRequest(id, method, params)
    
    // Security validation
    this.validateOutgoingMessage(request)
    
    const timeout = options.timeout || this.config.requestTimeout
    const startTime = Date.now()
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(this.createError(ErrorCode.INTERNAL_ERROR, 'Request timeout'))
      }, timeout)

      // Store pending request
      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeoutHandle)
          this.pendingRequests.delete(id)
          
          // Update stats
          const responseTime = Date.now() - startTime
          this.updateResponseTimeStats(responseTime)
          this.stats.requestsCompleted++
          
          resolve(result)
        },
        reject: (error) => {
          clearTimeout(timeoutHandle)
          this.pendingRequests.delete(id)
          this.stats.requestsFailed++
          reject(error)
        },
        timeout: timeoutHandle,
        timestamp: startTime
      })

      // Send message
      this.sendMessage(request)
    })
  }

  /**
   * Send notification (no response expected)
   */
  sendNotification(method, params = {}) {
    const notification = this.createNotification(method, params)
    
    // Security validation
    this.validateOutgoingMessage(notification)
    
    this.sendMessage(notification)
  }

  /**
   * Subscribe to events
   */
  async subscribe(event, handler) {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set())
    }
    
    this.subscriptions.get(event).add(handler)
    
    // Notify host about subscription
    await this.sendRequest('events.subscribe', { event })
    
    return {
      dispose: () => {
        this.unsubscribe(event, handler)
      }
    }
  }

  /**
   * Unsubscribe from events
   */
  async unsubscribe(event, handler) {
    const handlers = this.subscriptions.get(event)
    if (handlers) {
      handlers.delete(handler)
      
      if (handlers.size === 0) {
        this.subscriptions.delete(event)
        // Notify host about unsubscription
        await this.sendRequest('events.unsubscribe', { event })
      }
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(rawMessage) {
    this.stats.messagesReceived++
    
    try {
      // Parse and validate message
      const message = this.parseMessage(rawMessage)
      this.validateIncomingMessage(message)
      
      // Route message based on type
      if (this.isRequest(message)) {
        await this.handleIncomingRequest(message)
      } else if (this.isResponse(message)) {
        this.handleIncomingResponse(message)
      } else if (this.isNotification(message)) {
        await this.handleIncomingNotification(message)
      } else {
        throw this.createError(ErrorCode.INVALID_REQUEST, 'Invalid message type')
      }
      
    } catch (error) {
      this.stats.errors.push({
        timestamp: Date.now(),
        error: error.message,
        message: rawMessage
      })
      
      // Send error response if this was a request
      if (rawMessage.id !== undefined) {
        this.sendErrorResponse(rawMessage.id, error)
      }
      
      this.emit('protocol-error', error)
    }
  }

  /**
   * Handle incoming request
   */
  async handleIncomingRequest(request) {
    const { id, method, params } = request
    
    try {
      // Find method handler
      const handler = this.findMethodHandler(method)
      if (!handler) {
        throw this.createError(ErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`)
      }

      // Execute handler
      const result = await handler(params, { method, pluginId: this.pluginId })
      
      // Send success response
      this.sendSuccessResponse(id, result)
      
    } catch (error) {
      // Send error response
      this.sendErrorResponse(id, error)
    }
  }

  /**
   * Handle incoming response
   */
  handleIncomingResponse(response) {
    const { id, result, error } = response
    const pendingRequest = this.pendingRequests.get(id)
    
    if (!pendingRequest) {
      return
    }

    if (error) {
      pendingRequest.reject(this.createErrorFromResponse(error))
    } else {
      pendingRequest.resolve(result)
    }
  }

  /**
   * Handle incoming notification
   */
  async handleIncomingNotification(notification) {
    const { method, params } = notification
    
    // Handle event notifications
    if (method === 'events.notification') {
      this.handleEventNotification(params)
      return
    }

    // Find method handler
    const handler = this.findMethodHandler(method)
    if (handler) {
      try {
        await handler(params, { method, pluginId: this.pluginId })
      } catch { }
    }
  }

  /**
   * Handle event notification from host
   */
  handleEventNotification(params) {
    const { event, data } = params
    const handlers = this.subscriptions.get(event)
    
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data)
        } catch { }
      }
    }
  }

  /**
   * Find method handler (supports wildcards)
   */
  findMethodHandler(method) {
    // Exact match first
    if (this.methodHandlers.has(method)) {
      return this.methodHandlers.get(method)
    }

    // Wildcard matching
    for (const [pattern, handler] of this.methodHandlers) {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        if (regex.test(method)) {
          return handler
        }
      }
    }

    return null
  }

  /**
   * Create JSON-RPC 2.0 request
   */
  createRequest(id, method, params) {
    return {
      jsonrpc: '2.0',
      id,
      method,
      params
    }
  }

  /**
   * Create JSON-RPC 2.0 notification
   */
  createNotification(method, params) {
    return {
      jsonrpc: '2.0',
      method,
      params
    }
  }

  /**
   * Send success response
   */
  sendSuccessResponse(id, result) {
    const response = {
      jsonrpc: '2.0',
      id,
      result
    }
    
    this.sendMessage(response)
  }

  /**
   * Send error response
   */
  sendErrorResponse(id, error) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code: error.code || ErrorCode.INTERNAL_ERROR,
        message: error.message,
        data: error.data
      }
    }
    
    this.sendMessage(response)
  }

  /**
   * Send message to transport layer
   */
  sendMessage(message) {
    this.stats.messagesSent++
    this.emit('send-message', message)
  }

  /**
   * Parse incoming message
   */
  parseMessage(rawMessage) {
    if (typeof rawMessage === 'string') {
      try {
        return JSON.parse(rawMessage)
      } catch (error) {
        throw this.createError(ErrorCode.PARSE_ERROR, 'Parse error')
      }
    }
    
    return rawMessage
  }

  /**
   * Validate outgoing message
   */
  validateOutgoingMessage(message) {
    if (!message || typeof message !== 'object') {
      throw this.createError(ErrorCode.INVALID_REQUEST, 'Invalid message format')
    }

    if (message.jsonrpc !== '2.0') {
      throw this.createError(ErrorCode.INVALID_REQUEST, 'Invalid JSON-RPC version')
    }

    // Check security constraints
    if (this.securityManager) {
      this.securityManager.validateOutgoingMessage(this.pluginId, message)
    }
  }

  /**
   * Validate incoming message
   */
  validateIncomingMessage(message) {
    if (!message || typeof message !== 'object') {
      throw this.createError(ErrorCode.INVALID_REQUEST, 'Invalid message format')
    }

    if (message.jsonrpc !== '2.0') {
      throw this.createError(ErrorCode.INVALID_REQUEST, 'Invalid JSON-RPC version')
    }

    // Check security constraints
    if (this.securityManager) {
      this.securityManager.validateIncomingMessage(this.pluginId, message)
    }
  }

  /**
   * Check rate limiting
   */
  checkRateLimit() {
    const now = Date.now()
    const windowStart = now - this.config.rateLimitWindow
    
    // Remove old entries
    this.rateLimitWindow = this.rateLimitWindow.filter(timestamp => timestamp > windowStart)
    
    // Check limit
    if (this.rateLimitWindow.length >= this.config.rateLimitRequests) {
      return false
    }
    
    // Add current request
    this.rateLimitWindow.push(now)
    return true
  }

  /**
   * Update response time statistics
   */
  updateResponseTimeStats(responseTime) {
    const alpha = 0.1 // Exponential moving average factor
    this.stats.averageResponseTime = 
      this.stats.averageResponseTime * (1 - alpha) + responseTime * alpha
  }

  /**
   * Message type checking
   */
  isRequest(message) {
    return message.method !== undefined && message.id !== undefined
  }

  isResponse(message) {
    return message.id !== undefined && (message.result !== undefined || message.error !== undefined)
  }

  isNotification(message) {
    return message.method !== undefined && message.id === undefined
  }

  /**
   * Create error object
   */
  createError(code, message, data = null) {
    const error = new Error(message)
    error.code = code
    error.data = data
    return error
  }

  /**
   * Create error from response
   */
  createErrorFromResponse(errorResponse) {
    const error = new Error(errorResponse.message)
    error.code = errorResponse.code
    error.data = errorResponse.data
    return error
  }

  // === DEFAULT MESSAGE HANDLERS ===

  /**
   * Handle plugin activation
   */
  async handleActivate(params) {
    this.emit('plugin-activate', params)
    return { status: 'activated', pluginId: this.pluginId }
  }

  /**
   * Handle plugin deactivation
   */
  async handleDeactivate(params) {
    this.emit('plugin-deactivate', params)
    return { status: 'deactivated', pluginId: this.pluginId }
  }

  /**
   * Handle get plugin info
   */
  async handleGetInfo(params) {
    return {
      pluginId: this.pluginId,
      stats: this.getStats(),
      subscriptions: Array.from(this.subscriptions.keys())
    }
  }

  /**
   * Handle API call forwarding
   */
  async handleAPICall(params, context) {
    const { method } = context
    const apiMethod = method.replace(/^api\./, '')
    
    this.emit('api-call', {
      method: apiMethod,
      params,
      pluginId: this.pluginId
    })
  }

  /**
   * Handle event subscription
   */
  async handleEventSubscribe(params) {
    const { event } = params
    this.emit('event-subscribe', { event, pluginId: this.pluginId })
    return { subscribed: true, event }
  }

  /**
   * Handle event unsubscription
   */
  async handleEventUnsubscribe(params) {
    const { event } = params
    this.emit('event-unsubscribe', { event, pluginId: this.pluginId })
    return { unsubscribed: true, event }
  }

  /**
   * Handle event emission
   */
  async handleEventEmit(params) {
    const { event, data } = params
    this.emit('event-emit', { event, data, pluginId: this.pluginId })
    return { emitted: true, event }
  }

  /**
   * Get protocol statistics
   */
  getStats() {
    return {
      ...this.stats,
      pendingRequests: this.pendingRequests.size,
      subscriptions: this.subscriptions.size,
      uptime: Date.now() - (this.startTime || Date.now())
    }
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Cancel pending requests
    for (const [id, request] of this.pendingRequests) {
      clearTimeout(request.timeout)
      request.reject(this.createError(ErrorCode.INTERNAL_ERROR, 'Protocol disposed'))
    }
    this.pendingRequests.clear()

    // Clear subscriptions
    this.subscriptions.clear()

    // Clear handlers
    this.methodHandlers.clear()

    this.emit('disposed')
  }
}

/**
 * Protocol Message Builder - Helper for creating protocol messages
 */
export class ProtocolMessageBuilder {
  static request(id, method, params) {
    return {
      jsonrpc: '2.0',
      id,
      method,
      params
    }
  }

  static notification(method, params) {
    return {
      jsonrpc: '2.0',
      method,
      params
    }
  }

  static successResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    }
  }

  static errorResponse(id, code, message, data = null) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        data
      }
    }
  }
}

/**
 * Protocol Event Types
 */
export const ProtocolEvents = {
  MESSAGE_SENT: 'message-sent',
  MESSAGE_RECEIVED: 'message-received',
  REQUEST_COMPLETED: 'request-completed',
  REQUEST_FAILED: 'request-failed',
  ERROR: 'protocol-error',
  RATE_LIMITED: 'rate-limited',
  DISPOSED: 'disposed'
}

export default PluginCommunicationProtocol