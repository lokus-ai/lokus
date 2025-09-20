/**
 * MCP WebSocket Server Implementation
 * 
 * WebSocket support for real-time MCP communication
 * Handles WebSocket connections, message routing, and notifications
 */

import { WebSocketServer } from 'ws'
import { MCPRequestHandler } from './handlers.js'

/**
 * MCP WebSocket Server
 * Manages WebSocket connections and real-time MCP communication
 */
export class MCPWebSocketServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3457,
      host: options.host || 'localhost',
      maxConnections: options.maxConnections || 100,
      heartbeatInterval: options.heartbeatInterval || 30000, // 30 seconds
      connectionTimeout: options.connectionTimeout || 60000, // 1 minute
      ...options
    }

    this.wss = null
    this.connections = new Map() // connectionId -> connection data
    this.heartbeatTimer = null
    this.requestHandler = null
    this.logger = console
    this.isRunning = false
  }

  /**
   * Start the WebSocket server
   */
  async start(httpServer = null) {
    try {
      const wsOptions = {
        ...(httpServer ? { server: httpServer } : { 
          port: this.options.port, 
          host: this.options.host 
        }),
        perMessageDeflate: false,
        maxPayload: 1024 * 1024 // 1MB
      }

      this.wss = new WebSocketServer(wsOptions)
      
      // Initialize request handler
      this.requestHandler = new MCPRequestHandler()
      await this.requestHandler.initialize()

      // Set up WebSocket event handlers
      this.setupWebSocketHandlers()

      // Start heartbeat timer
      this.startHeartbeat()

      this.isRunning = true
      this.logger.info(`[MCP-WebSocket] Server started on ${this.options.host}:${this.options.port}`)

    } catch (error) {
      this.logger.error('[MCP-WebSocket] Failed to start server:', error)
      throw error
    }
  }

  /**
   * Stop the WebSocket server
   */
  async stop() {
    this.isRunning = false

    // Stop heartbeat
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }

    // Close all connections
    for (const [connectionId, connection] of this.connections.entries()) {
      this.closeConnection(connectionId, 1001, 'Server shutting down')
    }

    // Close WebSocket server
    if (this.wss) {
      await new Promise((resolve, reject) => {
        this.wss.close((err) => {
          if (err) reject(err)
          else resolve()
        })
      })
      this.wss = null
    }

    // Cleanup request handler
    if (this.requestHandler) {
      this.requestHandler.dispose()
      this.requestHandler = null
    }

    this.logger.info('[MCP-WebSocket] Server stopped')
  }

  /**
   * Set up WebSocket event handlers
   */
  setupWebSocketHandlers() {
    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req)
    })

    this.wss.on('error', (error) => {
      this.logger.error('[MCP-WebSocket] Server error:', error)
    })
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    // Check connection limits
    if (this.connections.size >= this.options.maxConnections) {
      ws.close(1008, 'Too many connections')
      return
    }

    // Create connection data
    const connectionId = this.generateConnectionId()
    const connection = {
      id: connectionId,
      ws,
      req,
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: Date.now(),
      lastActivity: Date.now(),
      isInitialized: false,
      sessionId: null,
      subscriptions: new Set(),
      isAlive: true
    }

    this.connections.set(connectionId, connection)
    this.logger.info(`[MCP-WebSocket] New connection: ${connectionId} from ${connection.ip}`)

    // Set up connection event handlers
    this.setupConnectionHandlers(connection)

    // Send welcome message
    this.sendMessage(connection, {
      jsonrpc: '2.0',
      method: 'server/info',
      params: {
        serverInfo: {
          name: 'Lokus MCP WebSocket Server',
          version: '1.0.0'
        },
        connectionId
      }
    })
  }

  /**
   * Set up individual connection event handlers
   */
  setupConnectionHandlers(connection) {
    const { ws } = connection

    // Handle incoming messages
    ws.on('message', async (data) => {
      await this.handleMessage(connection, data)
    })

    // Handle connection close
    ws.on('close', (code, reason) => {
      this.handleConnectionClose(connection, code, reason)
    })

    // Handle connection errors
    ws.on('error', (error) => {
      this.logger.error(`[MCP-WebSocket] Connection error (${connection.id}):`, error)
      this.closeConnection(connection.id, 1011, 'Internal error')
    })

    // Handle pong responses for heartbeat
    ws.on('pong', () => {
      connection.isAlive = true
      connection.lastActivity = Date.now()
    })
  }

  /**
   * Handle incoming WebSocket message
   */
  async handleMessage(connection, data) {
    try {
      connection.lastActivity = Date.now()

      // Parse JSON message
      let message
      try {
        message = JSON.parse(data.toString())
      } catch (error) {
        this.sendError(connection, null, -32700, 'Parse error', 'Invalid JSON')
        return
      }

      // Validate JSON-RPC format
      if (!this.validateJsonRpcMessage(message)) {
        this.sendError(connection, message.id, -32600, 'Invalid Request', 'Invalid JSON-RPC format')
        return
      }

      // Handle different message types
      if (message.method) {
        // Request or notification
        await this.handleRequest(connection, message)
      } else if (message.result !== undefined || message.error !== undefined) {
        // Response (not expected from client in current implementation)
        this.logger.warn(`[MCP-WebSocket] Unexpected response from client ${connection.id}`)
      }

    } catch (error) {
      this.logger.error(`[MCP-WebSocket] Error handling message from ${connection.id}:`, error)
      this.sendError(connection, null, -32603, 'Internal error', error.message)
    }
  }

  /**
   * Handle JSON-RPC request
   */
  async handleRequest(connection, message) {
    const { id, method, params } = message

    try {
      // Create mock request object for handler
      const mockReq = {
        body: message,
        ip: connection.ip,
        get: (header) => {
          const headers = {
            'user-agent': connection.userAgent,
            'x-mcp-session-id': connection.sessionId || connection.id
          }
          return headers[header.toLowerCase()]
        },
        is: () => true, // Always treat as JSON
        path: '/mcp/websocket'
      }

      // Create mock response object
      const mockRes = {
        json: (data) => {
          this.sendMessage(connection, data)
        },
        status: () => mockRes // Chain for status().json()
      }

      // Handle the request through the request handler
      await this.requestHandler.handleRequest(mockReq, mockRes)

      // Update connection state for initialize method
      if (method === 'initialize') {
        connection.isInitialized = true
        connection.sessionId = connection.id
      }

    } catch (error) {
      this.sendError(connection, id, error.code || -32603, error.message, error.data)
    }
  }

  /**
   * Handle connection close
   */
  handleConnectionClose(connection, code, reason) {
    this.logger.info(`[MCP-WebSocket] Connection closed: ${connection.id} (${code}: ${reason})`)
    this.connections.delete(connection.id)

    // Clean up any session data
    if (this.requestHandler && connection.sessionId) {
      // The request handler will handle session cleanup
    }
  }

  /**
   * Close a specific connection
   */
  closeConnection(connectionId, code = 1000, reason = 'Normal closure') {
    const connection = this.connections.get(connectionId)
    if (connection) {
      connection.ws.close(code, reason)
      this.connections.delete(connectionId)
    }
  }

  /**
   * Send message to connection
   */
  sendMessage(connection, message) {
    if (connection.ws.readyState === connection.ws.OPEN) {
      try {
        connection.ws.send(JSON.stringify(message))
      } catch (error) {
        this.logger.error(`[MCP-WebSocket] Error sending message to ${connection.id}:`, error)
        this.closeConnection(connection.id, 1011, 'Send error')
      }
    }
  }

  /**
   * Send error response
   */
  sendError(connection, id, code, message, data = null) {
    this.sendMessage(connection, {
      jsonrpc: '2.0',
      error: {
        code,
        message,
        ...(data && { data })
      },
      id
    })
  }

  /**
   * Broadcast notification to all connections
   */
  broadcast(method, params, filter = null) {
    for (const connection of this.connections.values()) {
      if (!connection.isInitialized) continue
      
      // Apply filter if provided
      if (filter && !filter(connection)) continue

      this.sendMessage(connection, {
        jsonrpc: '2.0',
        method,
        params
      })
    }
  }

  /**
   * Broadcast resource update notifications
   */
  broadcastResourceUpdate(uri, content, metadata = {}) {
    const params = { uri, content, metadata }
    
    this.broadcast('notifications/resources/updated', params, (connection) => {
      return connection.subscriptions.has(uri)
    })
  }

  /**
   * Broadcast list change notifications
   */
  broadcastListChanged(type) {
    const methodMap = {
      resources: 'notifications/resources/list_changed',
      tools: 'notifications/tools/list_changed',
      prompts: 'notifications/prompts/list_changed'
    }

    const method = methodMap[type]
    if (method) {
      this.broadcast(method, {})
    }
  }

  /**
   * Start heartbeat mechanism
   */
  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      for (const [connectionId, connection] of this.connections.entries()) {
        if (!connection.isAlive) {
          // Connection didn't respond to ping, close it
          this.logger.warn(`[MCP-WebSocket] Heartbeat timeout for ${connectionId}`)
          this.closeConnection(connectionId, 1001, 'Heartbeat timeout')
        } else {
          // Send ping
          connection.isAlive = false
          connection.ws.ping()
        }
      }
    }, this.options.heartbeatInterval)
  }

  /**
   * Validate JSON-RPC message format
   */
  validateJsonRpcMessage(message) {
    if (typeof message !== 'object' || message === null) {
      return false
    }

    if (message.jsonrpc !== '2.0') {
      return false
    }

    // Check for required fields based on message type
    if (message.method) {
      // Request or notification
      return typeof message.method === 'string'
    } else if (message.result !== undefined || message.error !== undefined) {
      // Response
      return message.id !== undefined
    }

    return false
  }

  /**
   * Generate unique connection ID
   */
  generateConnectionId() {
    return `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Get server statistics
   */
  getStats() {
    const connections = Array.from(this.connections.values())
    
    return {
      isRunning: this.isRunning,
      totalConnections: connections.length,
      initializedConnections: connections.filter(c => c.isInitialized).length,
      totalSubscriptions: connections.reduce((sum, c) => sum + c.subscriptions.size, 0),
      averageConnectionAge: connections.length > 0 
        ? Math.round(connections.reduce((sum, c) => sum + (Date.now() - c.connectedAt), 0) / connections.length / 1000)
        : 0,
      options: this.options
    }
  }

  /**
   * Get connection information
   */
  getConnectionInfo(connectionId) {
    const connection = this.connections.get(connectionId)
    if (!connection) return null

    return {
      id: connection.id,
      ip: connection.ip,
      userAgent: connection.userAgent,
      connectedAt: new Date(connection.connectedAt).toISOString(),
      lastActivity: new Date(connection.lastActivity).toISOString(),
      isInitialized: connection.isInitialized,
      subscriptions: Array.from(connection.subscriptions),
      isAlive: connection.isAlive
    }
  }

  /**
   * Get all connection information
   */
  getAllConnections() {
    return Array.from(this.connections.keys()).map(id => this.getConnectionInfo(id))
  }
}

/**
 * Create and configure MCP WebSocket server
 */
export const createMCPWebSocketServer = (options = {}) => {
  return new MCPWebSocketServer(options)
}

export default MCPWebSocketServer