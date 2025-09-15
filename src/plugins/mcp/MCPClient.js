/**
 * MCP Client API
 * 
 * Client-side implementation of the Model Context Protocol
 * Provides high-level API for MCP server communication
 * Handles resource access, tool invocation, and prompt management
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { MCPProtocol, MCPMethod, MCPErrorCode, MCPResourceType } from './MCPProtocol.js'

/**
 * MCP Client Connection States
 */
export const MCPClientState = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting', 
  CONNECTED: 'connected',
  ERROR: 'error',
  CLOSED: 'closed'
}

/**
 * MCP Client API - High-level client for MCP communication
 */
export class MCPClient extends EventEmitter {
  constructor(clientId, options = {}) {
    super()
    
    this.clientId = clientId
    this.state = MCPClientState.DISCONNECTED
    
    // Configuration
    this.options = {
      autoReconnect: true,
      reconnectDelay: 5000,
      maxReconnectAttempts: 5,
      requestTimeout: 30000,
      enableResourceCaching: true,
      enableToolCaching: false,
      ...options
    }
    
    // Protocol instance
    this.protocol = null
    
    // Server information
    this.serverInfo = null
    this.serverCapabilities = null
    
    // Cached data
    this.resourceCache = new Map() // uri -> { resource, timestamp }
    this.toolCache = new Map() // name -> { tool, timestamp }
    this.promptCache = new Map() // name -> { prompt, timestamp }
    
    // Subscriptions
    this.subscriptions = new Map() // uri -> subscription info
    
    // Connection management
    this.connectionAttempts = 0
    this.lastConnectionError = null
    this.reconnectTimer = null
    
    // Request tracking
    this.pendingRequests = new Map()
    this.requestStats = {
      total: 0,
      successful: 0,
      failed: 0,
      averageResponseTime: 0
    }
    
    this.logger = console
  }

  /**
   * Connect to MCP server
   */
  async connect(transport, clientInfo = {}) {
    if (this.state === MCPClientState.CONNECTED) {
      return
    }

    this.setState(MCPClientState.CONNECTING)
    
    try {
      // Create protocol instance
      this.protocol = new MCPProtocol(this.clientId, {
        requestTimeout: this.options.requestTimeout
      })
      
      // Set up protocol event handlers
      this.setupProtocolHandlers()
      
      // Connect transport
      await this.connectTransport(transport)
      
      // Initialize MCP session
      const initResponse = await this.protocol.initialize({
        name: clientInfo.name || `Lokus MCP Client (${this.clientId})`,
        version: clientInfo.version || '1.0.0',
        description: clientInfo.description || 'Lokus MCP Client',
        ...clientInfo
      })
      
      this.serverInfo = initResponse.serverInfo
      this.serverCapabilities = initResponse.capabilities
      this.connectionAttempts = 0
      this.lastConnectionError = null
      
      this.setState(MCPClientState.CONNECTED)
      this.emit('connected', { serverInfo: this.serverInfo })
      
      this.logger.info(`MCP client connected: ${this.clientId}`)
      
    } catch (error) {
      this.lastConnectionError = error
      this.setState(MCPClientState.ERROR)
      
      // Attempt reconnection if enabled
      if (this.options.autoReconnect) {
        this.scheduleReconnect()
      }
      
      throw error
    }
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    if (this.state === MCPClientState.DISCONNECTED) {
      return
    }

    try {
      // Cancel any scheduled reconnection
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
      }
      
      // Clean up subscriptions
      await this.unsubscribeAll()
      
      // Dispose protocol
      if (this.protocol) {
        this.protocol.dispose()
        this.protocol = null
      }
      
      // Clear cached data
      this.clearCaches()
      
      this.setState(MCPClientState.DISCONNECTED)
      this.emit('disconnected')
      
      this.logger.info(`MCP client disconnected: ${this.clientId}`)
      
    } catch (error) {
      this.logger.error(`Error disconnecting MCP client ${this.clientId}:`, error)
    }
  }

  /**
   * Set up protocol event handlers
   */
  setupProtocolHandlers() {
    this.protocol.on('send-message', (message) => {
      this.emit('message-sent', message)
    })
    
    this.protocol.on('protocol-error', (error) => {
      this.emit('protocol-error', error)
      this.handleProtocolError(error)
    })
    
    // Handle notifications
    this.protocol.on('notification', (notification) => {
      this.handleNotification(notification)
    })
  }

  /**
   * Connect transport layer
   */
  async connectTransport(transport) {
    // This would set up the actual transport (WebSocket, IPC, etc.)
    // For now, we'll use a mock transport
    this.transport = transport
    
    if (transport && typeof transport.connect === 'function') {
      await transport.connect()
    }
  }

  /**
   * Handle protocol errors
   */
  handleProtocolError(error) {
    this.logger.error(`Protocol error in MCP client ${this.clientId}:`, error)
    
    if (this.state === MCPClientState.CONNECTED) {
      this.setState(MCPClientState.ERROR)
      
      if (this.options.autoReconnect) {
        this.scheduleReconnect()
      }
    }
  }

  /**
   * Handle incoming notifications
   */
  handleNotification(notification) {
    const { method, params } = notification
    
    switch (method) {
      case 'notifications/resources/updated':
        this.handleResourceUpdated(params)
        break
        
      case 'notifications/resources/list_changed':
        this.handleResourceListChanged(params)
        break
        
      case 'notifications/tools/list_changed':
        this.handleToolListChanged(params)
        break
        
      case 'notifications/prompts/list_changed':
        this.handlePromptListChanged(params)
        break
        
      case 'notifications/logging/message':
        this.handleLoggingMessage(params)
        break
        
      default:
        this.emit('notification', notification)
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    if (this.connectionAttempts >= this.options.maxReconnectAttempts) {
      this.logger.error(`Max reconnection attempts reached for ${this.clientId}`)
      return
    }

    this.connectionAttempts++
    const delay = this.options.reconnectDelay * Math.pow(2, this.connectionAttempts - 1)
    
    this.reconnectTimer = setTimeout(async () => {
      this.logger.info(`Reconnection attempt ${this.connectionAttempts} for ${this.clientId}`)
      
      try {
        await this.connect(this.transport, this.lastClientInfo)
      } catch (error) {
        this.logger.warn(`Reconnection failed for ${this.clientId}:`, error)
        this.scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Set client state
   */
  setState(newState) {
    const oldState = this.state
    this.state = newState
    this.emit('state-changed', { newState, oldState })
  }

  // === RESOURCE MANAGEMENT ===

  /**
   * List available resources
   */
  async listResources(options = {}) {
    this.ensureConnected()
    
    try {
      const response = await this.protocol.sendRequest(MCPMethod.RESOURCES_LIST, {
        cursor: options.cursor
      })
      
      // Cache resources if enabled
      if (this.options.enableResourceCaching) {
        this.cacheResources(response.resources)
      }
      
      return response
      
    } catch (error) {
      this.handleRequestError('listResources', error)
      throw error
    }
  }

  /**
   * Read resource content
   */
  async readResource(uri, options = {}) {
    this.ensureConnected()
    
    // Check cache first
    if (this.options.enableResourceCaching && !options.forceRefresh) {
      const cached = this.resourceCache.get(uri)
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.resource
      }
    }
    
    try {
      const response = await this.protocol.sendRequest(MCPMethod.RESOURCES_READ, { uri })
      
      // Cache the result
      if (this.options.enableResourceCaching && response.contents?.[0]) {
        this.resourceCache.set(uri, {
          resource: response,
          timestamp: Date.now()
        })
      }
      
      return response
      
    } catch (error) {
      this.handleRequestError('readResource', error)
      throw error
    }
  }

  /**
   * Subscribe to resource updates
   */
  async subscribeToResource(uri, handler) {
    this.ensureConnected()
    
    if (!this.serverCapabilities?.resources?.subscribe) {
      throw new Error('Server does not support resource subscriptions')
    }
    
    try {
      await this.protocol.sendRequest(MCPMethod.RESOURCES_SUBSCRIBE, { uri })
      
      // Store subscription
      this.subscriptions.set(uri, {
        handler,
        subscribedAt: Date.now()
      })
      
      this.emit('resource-subscribed', { uri })
      
      return {
        dispose: () => this.unsubscribeFromResource(uri)
      }
      
    } catch (error) {
      this.handleRequestError('subscribeToResource', error)
      throw error
    }
  }

  /**
   * Unsubscribe from resource updates
   */
  async unsubscribeFromResource(uri) {
    this.ensureConnected()
    
    if (!this.subscriptions.has(uri)) {
      return
    }
    
    try {
      await this.protocol.sendRequest(MCPMethod.RESOURCES_UNSUBSCRIBE, { uri })
      this.subscriptions.delete(uri)
      this.emit('resource-unsubscribed', { uri })
      
    } catch (error) {
      this.handleRequestError('unsubscribeFromResource', error)
      throw error
    }
  }

  /**
   * Handle resource updated notification
   */
  handleResourceUpdated(params) {
    const { uri, content, metadata } = params
    
    // Update cache
    if (this.options.enableResourceCaching) {
      const cached = this.resourceCache.get(uri)
      if (cached) {
        cached.resource.contents[0].text = content
        cached.timestamp = Date.now()
      }
    }
    
    // Notify subscription handler
    const subscription = this.subscriptions.get(uri)
    if (subscription && subscription.handler) {
      try {
        subscription.handler({ uri, content, metadata })
      } catch (error) {
        this.logger.error(`Resource subscription handler error:`, error)
      }
    }
    
    this.emit('resource-updated', { uri, content, metadata })
  }

  /**
   * Handle resource list changed notification
   */
  handleResourceListChanged(params) {
    // Invalidate resource cache
    if (this.options.enableResourceCaching) {
      this.resourceCache.clear()
    }
    
    this.emit('resource-list-changed', params)
  }

  // === TOOL MANAGEMENT ===

  /**
   * List available tools
   */
  async listTools(options = {}) {
    this.ensureConnected()
    
    try {
      const response = await this.protocol.sendRequest(MCPMethod.TOOLS_LIST, {
        cursor: options.cursor
      })
      
      // Cache tools if enabled
      if (this.options.enableToolCaching) {
        this.cacheTools(response.tools)
      }
      
      return response
      
    } catch (error) {
      this.handleRequestError('listTools', error)
      throw error
    }
  }

  /**
   * Call a tool
   */
  async callTool(name, args = {}, options = {}) {
    this.ensureConnected()
    
    try {
      const startTime = Date.now()
      
      const response = await this.protocol.sendRequest(MCPMethod.TOOLS_CALL, {
        name,
        arguments: args
      })
      
      const responseTime = Date.now() - startTime
      this.updateRequestStats(true, responseTime)
      
      this.emit('tool-called', { name, args, response, responseTime })
      
      return response
      
    } catch (error) {
      this.updateRequestStats(false, 0)
      this.handleRequestError('callTool', error)
      throw error
    }
  }

  /**
   * Handle tool list changed notification
   */
  handleToolListChanged(params) {
    // Invalidate tool cache
    if (this.options.enableToolCaching) {
      this.toolCache.clear()
    }
    
    this.emit('tool-list-changed', params)
  }

  // === PROMPT MANAGEMENT ===

  /**
   * List available prompts
   */
  async listPrompts(options = {}) {
    this.ensureConnected()
    
    try {
      const response = await this.protocol.sendRequest(MCPMethod.PROMPTS_LIST, {
        cursor: options.cursor
      })
      
      // Cache prompts
      this.cachePrompts(response.prompts)
      
      return response
      
    } catch (error) {
      this.handleRequestError('listPrompts', error)
      throw error
    }
  }

  /**
   * Get a prompt template
   */
  async getPrompt(name, args = {}, options = {}) {
    this.ensureConnected()
    
    // Check cache first
    if (!options.forceRefresh) {
      const cached = this.promptCache.get(name)
      if (cached && this.isCacheValid(cached.timestamp)) {
        return cached.prompt
      }
    }
    
    try {
      const response = await this.protocol.sendRequest(MCPMethod.PROMPTS_GET, {
        name,
        arguments: args
      })
      
      // Cache the result
      this.promptCache.set(name, {
        prompt: response,
        timestamp: Date.now()
      })
      
      return response
      
    } catch (error) {
      this.handleRequestError('getPrompt', error)
      throw error
    }
  }

  /**
   * Handle prompt list changed notification
   */
  handlePromptListChanged(params) {
    // Invalidate prompt cache
    this.promptCache.clear()
    this.emit('prompt-list-changed', params)
  }

  // === LOGGING ===

  /**
   * Set logging level
   */
  async setLogLevel(level) {
    this.ensureConnected()
    
    try {
      await this.protocol.sendRequest(MCPMethod.LOGGING_SET_LEVEL, { level })
      this.emit('log-level-set', { level })
      
    } catch (error) {
      this.handleRequestError('setLogLevel', error)
      throw error
    }
  }

  /**
   * Handle logging message notification
   */
  handleLoggingMessage(params) {
    const { level, logger, data } = params
    this.emit('server-log', { level, logger, data })
  }

  // === UTILITY METHODS ===

  /**
   * Ensure client is connected
   */
  ensureConnected() {
    if (this.state !== MCPClientState.CONNECTED) {
      throw new Error(`MCP client not connected: ${this.state}`)
    }
  }

  /**
   * Check if cached data is still valid
   */
  isCacheValid(timestamp, maxAge = 300000) { // 5 minutes default
    return Date.now() - timestamp < maxAge
  }

  /**
   * Cache resources
   */
  cacheResources(resources) {
    const timestamp = Date.now()
    for (const resource of resources) {
      this.resourceCache.set(resource.uri, {
        resource,
        timestamp
      })
    }
  }

  /**
   * Cache tools
   */
  cacheTools(tools) {
    const timestamp = Date.now()
    for (const tool of tools) {
      this.toolCache.set(tool.name, {
        tool,
        timestamp
      })
    }
  }

  /**
   * Cache prompts
   */
  cachePrompts(prompts) {
    const timestamp = Date.now()
    for (const prompt of prompts) {
      this.promptCache.set(prompt.name, {
        prompt,
        timestamp
      })
    }
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.resourceCache.clear()
    this.toolCache.clear()
    this.promptCache.clear()
  }

  /**
   * Unsubscribe from all resources
   */
  async unsubscribeAll() {
    const unsubPromises = []
    
    for (const uri of this.subscriptions.keys()) {
      unsubPromises.push(
        this.unsubscribeFromResource(uri).catch(error => {
          this.logger.warn(`Failed to unsubscribe from ${uri}:`, error)
        })
      )
    }
    
    await Promise.allSettled(unsubPromises)
  }

  /**
   * Handle request errors
   */
  handleRequestError(method, error) {
    this.logger.error(`MCP request error (${method}):`, error)
    this.emit('request-error', { method, error })
  }

  /**
   * Update request statistics
   */
  updateRequestStats(successful, responseTime) {
    this.requestStats.total++
    
    if (successful) {
      this.requestStats.successful++
      
      // Update average response time
      const alpha = 0.1
      this.requestStats.averageResponseTime = 
        this.requestStats.averageResponseTime * (1 - alpha) + responseTime * alpha
    } else {
      this.requestStats.failed++
    }
  }

  /**
   * Get client information
   */
  getInfo() {
    return {
      clientId: this.clientId,
      state: this.state,
      serverInfo: this.serverInfo,
      serverCapabilities: this.serverCapabilities,
      connectionAttempts: this.connectionAttempts,
      lastConnectionError: this.lastConnectionError?.message,
      cacheStats: {
        resources: this.resourceCache.size,
        tools: this.toolCache.size,
        prompts: this.promptCache.size
      },
      subscriptions: this.subscriptions.size,
      requestStats: this.requestStats
    }
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      ...this.getInfo(),
      uptime: this.protocol?.getStats()?.uptime || 0,
      protocolStats: this.protocol?.getStats()
    }
  }
}

/**
 * MCP Client Factory - Helper for creating MCP clients
 */
export class MCPClientFactory {
  constructor() {
    this.clients = new Map()
  }

  /**
   * Create MCP client
   */
  createClient(clientId, options = {}) {
    if (this.clients.has(clientId)) {
      throw new Error(`Client already exists: ${clientId}`)
    }

    const client = new MCPClient(clientId, options)
    this.clients.set(clientId, client)
    
    // Clean up on disconnect
    client.on('disconnected', () => {
      this.clients.delete(clientId)
    })
    
    return client
  }

  /**
   * Get client by ID
   */
  getClient(clientId) {
    return this.clients.get(clientId)
  }

  /**
   * Get all clients
   */
  getAllClients() {
    return Array.from(this.clients.values())
  }

  /**
   * Disconnect all clients
   */
  async disconnectAll() {
    const disconnectPromises = []
    
    for (const client of this.clients.values()) {
      disconnectPromises.push(
        client.disconnect().catch(error => {
          console.warn(`Error disconnecting client ${client.clientId}:`, error)
        })
      )
    }
    
    await Promise.allSettled(disconnectPromises)
    this.clients.clear()
  }
}

/**
 * MCP Resource Helper - Utility for working with MCP resources
 */
export class MCPResourceHelper {
  /**
   * Create file resource reference
   */
  static createFileResource(filePath, options = {}) {
    return {
      uri: `file://${filePath}`,
      name: options.name || filePath.split('/').pop(),
      description: options.description || `File: ${filePath}`,
      type: MCPResourceType.FILE,
      mimeType: options.mimeType || 'text/plain'
    }
  }

  /**
   * Create web resource reference
   */
  static createWebResource(url, options = {}) {
    return {
      uri: url,
      name: options.name || new URL(url).hostname,
      description: options.description || `Web resource: ${url}`,
      type: MCPResourceType.WEB,
      mimeType: options.mimeType || 'text/html'
    }
  }

  /**
   * Create database resource reference
   */
  static createDatabaseResource(connectionString, options = {}) {
    return {
      uri: connectionString,
      name: options.name || 'Database',
      description: options.description || `Database: ${connectionString}`,
      type: MCPResourceType.DATABASE,
      mimeType: 'application/sql'
    }
  }
}

export default MCPClient