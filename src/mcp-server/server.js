/**
 * MCP HTTP Server Implementation
 * 
 * Express.js-based HTTP server for MCP protocol over HTTP
 * Integrates with WebSocket server for real-time communication
 */

import express from 'express'
import { createServer } from 'http'
import { createMiddleware } from './middleware.js'
import { createMCPHandler } from './handlers.js'
import { createMCPWebSocketServer } from './websocket.js'

/**
 * MCP HTTP Server
 * Main server class that orchestrates HTTP and WebSocket functionality
 */
export class MCPServer {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3456,
      host: options.host || 'localhost',
      enableWebSocket: options.enableWebSocket !== false,
      wsPort: options.wsPort || 3457,
      enableCors: options.enableCors !== false,
      enableRateLimit: options.enableRateLimit !== false,
      enableLogging: options.enableLogging !== false,
      production: options.production || process.env.NODE_ENV === 'production',
      ...options
    }

    // Server instances
    this.app = null
    this.httpServer = null
    this.wsServer = null
    this.mcpHandler = null
    this.middleware = null

    // State
    this.isRunning = false
    this.startTime = null
    this.logger = console

    // Statistics
    this.stats = {
      requests: 0,
      errors: 0,
      websocketConnections: 0,
      startTime: null,
      uptime: 0
    }
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      // Create Express app
      this.app = express()

      // Initialize MCP handler
      this.mcpHandler = await createMCPHandler()

      // Set up middleware
      this.setupMiddleware()

      // Set up routes
      this.setupRoutes()

      // Create HTTP server
      this.httpServer = createServer(this.app)

      // Initialize WebSocket server if enabled
      if (this.options.enableWebSocket) {
        this.wsServer = createMCPWebSocketServer({
          port: this.options.wsPort,
          host: this.options.host
        })
      }

      this.logger.info('[MCP-Server] Server initialized')

    } catch (error) {
      this.logger.error('[MCP-Server] Failed to initialize server:', error)
      throw error
    }
  }

  /**
   * Set up Express middleware
   */
  setupMiddleware() {
    this.middleware = createMiddleware({
      rateLimit: {
        enabled: this.options.enableRateLimit,
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: this.options.production ? 100 : 1000,
        toolWindowMs: 5 * 60 * 1000, // 5 minutes
        maxToolRequests: this.options.production ? 20 : 100
      },
      cors: {
        enabled: this.options.enableCors,
        allowedOrigins: this.options.allowedOrigins
      },
      logging: {
        enabled: this.options.enableLogging,
        logLevel: this.options.production ? 'info' : 'debug',
        includeBody: !this.options.production
      }
    })

    // Apply middleware in order
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // Health check (before other middleware)
    this.app.use(this.middleware.healthCheck)

    // Security headers
    this.app.use(this.middleware.security)

    // CORS
    if (this.options.enableCors) {
      this.app.use(this.middleware.cors)
    }

    // Request logging
    if (this.options.enableLogging) {
      this.app.use(this.middleware.requestLogger)
    }

    // Rate limiting
    if (this.options.enableRateLimit) {
      this.app.use('/mcp', this.middleware.rateLimiters.general)
    }

    // JSON-RPC validation
    this.app.use(this.middleware.validateJsonRpc)
    this.app.use(this.middleware.validateMcpRequest)

    // Request counter
    this.app.use((req, res, next) => {
      this.stats.requests++
      next()
    })
  }

  /**
   * Set up Express routes
   */
  setupRoutes() {
    // Main MCP endpoint
    this.app.post('/mcp', async (req, res, next) => {
      try {
        // Apply tool execution rate limit for tool calls
        if (req.body?.method === 'tools/call' && this.options.enableRateLimit) {
          await new Promise((resolve, reject) => {
            this.middleware.rateLimiters.toolExecution(req, res, (err) => {
              if (err) reject(err)
              else resolve()
            })
          })
        }

        await this.mcpHandler.handleRequest(req, res)
      } catch (error) {
        next(error)
      }
    })

    // Alternative endpoint paths
    this.app.post('/mcp/rpc', async (req, res, next) => {
      try {
        await this.mcpHandler.handleRequest(req, res)
      } catch (error) {
        next(error)
      }
    })

    // Server information endpoint
    this.app.get('/mcp/info', (req, res) => {
      res.json({
        serverInfo: {
          name: 'Lokus MCP HTTP Server',
          version: '1.0.0',
          description: 'HTTP bridge for Lokus MCP plugin system',
          protocolVersion: '2024-11-05'
        },
        capabilities: {
          resources: {
            subscribe: true,
            listChanged: true
          },
          tools: {
            listChanged: true
          },
          prompts: {
            listChanged: true
          },
          logging: {
            enabled: true
          }
        },
        transport: {
          http: true,
          websocket: this.options.enableWebSocket
        },
        endpoints: {
          http: `/mcp`,
          websocket: this.options.enableWebSocket ? `ws://${this.options.host}:${this.options.wsPort}` : null
        }
      })
    })

    // Server statistics endpoint
    this.app.get('/mcp/stats', (req, res) => {
      const stats = this.getStats()
      res.json(stats)
    })

    // WebSocket information endpoint
    if (this.options.enableWebSocket) {
      this.app.get('/mcp/websocket/connections', (req, res) => {
        if (this.wsServer) {
          res.json({
            connections: this.wsServer.getAllConnections(),
            stats: this.wsServer.getStats()
          })
        } else {
          res.status(503).json({ error: 'WebSocket server not available' })
        }
      })
    }

    // Health check endpoints
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: this.getUptime(),
        version: '1.0.0',
        services: {
          http: this.isRunning,
          websocket: this.wsServer ? this.wsServer.isRunning : false,
          mcpHandler: !!this.mcpHandler
        }
      })
    })

    this.app.get('/mcp/health', (req, res) => {
      res.json({
        status: 'healthy',
        mcp: {
          protocolVersion: '2024-11-05',
          handlerStats: this.mcpHandler ? this.mcpHandler.getStats() : null,
          websocketStats: this.wsServer ? this.wsServer.getStats() : null
        }
      })
    })

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Lokus MCP HTTP Server',
        version: '1.0.0',
        endpoints: {
          mcp: '/mcp',
          info: '/mcp/info',
          health: '/health',
          stats: '/mcp/stats'
        },
        documentation: 'https://spec.modelcontextprotocol.io/'
      })
    })

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        jsonrpc: '2.0',
        error: {
          code: -32601,
          message: 'Endpoint not found',
          data: `No endpoint found for ${req.method} ${req.originalUrl}`
        },
        id: null
      })
    })

    // Error handler (must be last)
    this.app.use(this.middleware.errorHandler)
    this.app.use((err, req, res, next) => {
      this.stats.errors++
      this.logger.error('[MCP-Server] Unhandled error:', err)
      
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: this.options.production ? undefined : err.message
          },
          id: null
        })
      }
    })
  }

  /**
   * Start the server
   */
  async start() {
    if (this.isRunning) {
      throw new Error('Server is already running')
    }

    try {
      // Initialize if not already done
      if (!this.app) {
        await this.initialize()
      }

      // Start HTTP server
      await new Promise((resolve, reject) => {
        this.httpServer.listen(this.options.port, this.options.host, (err) => {
          if (err) reject(err)
          else resolve()
        })
      })

      // Start WebSocket server if enabled
      if (this.options.enableWebSocket && this.wsServer) {
        await this.wsServer.start(this.httpServer)
      }

      this.isRunning = true
      this.startTime = Date.now()
      this.stats.startTime = new Date().toISOString()

      this.logger.info(`[MCP-Server] HTTP server started on http://${this.options.host}:${this.options.port}`)
      if (this.options.enableWebSocket) {
        this.logger.info(`[MCP-Server] WebSocket server started on ws://${this.options.host}:${this.options.wsPort}`)
      }

      // Start cleanup timer
      this.startCleanupTimer()

    } catch (error) {
      this.logger.error('[MCP-Server] Failed to start server:', error)
      await this.stop()
      throw error
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    if (!this.isRunning) {
      return
    }

    this.logger.info('[MCP-Server] Stopping server...')

    try {
      // Stop WebSocket server
      if (this.wsServer) {
        await this.wsServer.stop()
        this.wsServer = null
      }

      // Stop HTTP server
      if (this.httpServer) {
        await new Promise((resolve, reject) => {
          this.httpServer.close((err) => {
            if (err) reject(err)
            else resolve()
          })
        })
        this.httpServer = null
      }

      // Cleanup handlers
      if (this.mcpHandler) {
        this.mcpHandler.dispose()
        this.mcpHandler = null
      }

      this.isRunning = false
      this.startTime = null

      this.logger.info('[MCP-Server] Server stopped')

    } catch (error) {
      this.logger.error('[MCP-Server] Error stopping server:', error)
      throw error
    }
  }

  /**
   * Restart the server
   */
  async restart() {
    await this.stop()
    await this.start()
  }

  /**
   * Start cleanup timer for expired sessions
   */
  startCleanupTimer() {
    setInterval(() => {
      if (this.mcpHandler) {
        this.mcpHandler.cleanupSessions()
      }
    }, 5 * 60 * 1000) // Every 5 minutes
  }

  /**
   * Get server uptime in seconds
   */
  getUptime() {
    return this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0
  }

  /**
   * Get comprehensive server statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.getUptime(),
      isRunning: this.isRunning,
      configuration: {
        port: this.options.port,
        host: this.options.host,
        enableWebSocket: this.options.enableWebSocket,
        wsPort: this.options.wsPort,
        production: this.options.production
      },
      handler: this.mcpHandler ? this.mcpHandler.getStats() : null,
      websocket: this.wsServer ? this.wsServer.getStats() : null,
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    }
  }

  /**
   * Get server configuration
   */
  getConfig() {
    return {
      ...this.options,
      // Don't expose sensitive configuration
      allowedOrigins: this.options.allowedOrigins ? '[configured]' : null
    }
  }

  /**
   * Update server configuration (requires restart for some options)
   */
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions }
    this.logger.info('[MCP-Server] Configuration updated (restart may be required)')
  }

  /**
   * Broadcast notification to all connected clients
   */
  broadcast(method, params) {
    if (this.wsServer) {
      this.wsServer.broadcast(method, params)
    }
  }

  /**
   * Check if server is healthy
   */
  isHealthy() {
    return this.isRunning && 
           (!this.options.enableWebSocket || (this.wsServer && this.wsServer.isRunning)) &&
           this.mcpHandler !== null
  }
}

/**
 * Create and configure MCP server
 */
export const createMCPServer = (options = {}) => {
  return new MCPServer(options)
}

/**
 * Start MCP server with default configuration
 */
export const startMCPServer = async (options = {}) => {
  const server = createMCPServer(options)
  await server.start()
  return server
}

export default MCPServer