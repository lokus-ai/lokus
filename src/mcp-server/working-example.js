/**
 * Secure MCP Server Integration
 * 
 * Main entry point that integrates all security components:
 * - JWT and API Key authentication
 * - Rate limiting with multiple algorithms
 * - Request validation and sanitization
 * - CORS protection
 * - Security headers
 * - Comprehensive audit logging
 */

import express from 'express'
import { EventEmitter } from 'events'

// Security components
import AuthenticationMiddleware from './auth/middleware.js'
import CORSManager from './security/cors.js'
import SecurityHeadersManager from './security/headers.js'
import SecurityConfigManager from './config/security.js'

// MCP components (placeholder for now due to missing dependencies)
// In a real Tauri environment, these would import successfully
const fileTools = [];
const editorTools = [];
const searchTools = [];

class SecureMCPServer extends EventEmitter {
  constructor(config = {}) {
    super()
    
    try {
      this.app = express()
      this.server = null
      this.isRunning = false
      
      // Initialize configuration manager
      console.log('🔧 Initializing SecurityConfigManager...')
      this.configManager = new SecurityConfigManager(config.configPath)
      this.config = this.configManager.getConfig()
      console.log('✅ SecurityConfigManager initialized')
      
      // Initialize security components
      console.log('🔧 Initializing security components...')
      this.authMiddleware = new AuthenticationMiddleware(this.config.auth)
      this.corsManager = new CORSManager(this.config.cors)
      this.headersManager = new SecurityHeadersManager(this.config.headers)
      console.log('✅ Security components initialized')
      
      // MCP server instance
      this.mcpServer = null
      
      // Initialize tools and resources
      console.log('🔧 Initializing tools and resources...')
      this.initializeToolsAndResources()
      console.log('✅ Tools and resources initialized')
      
      // Setup event handlers
      console.log('🔧 Setting up event handlers...')
      this.setupEventHandlers()
      console.log('✅ Event handlers set up')
      
      // Initialize Express middleware
      console.log('🔧 Setting up Express middleware...')
      this.setupMiddleware()
      console.log('✅ Express middleware set up')
      
    } catch (error) {
      console.error('❌ SecureMCPServer constructor failed:', error)
      console.error('Stack trace:', error.stack)
      throw error
    }
  }

  /**
   * Initialize tools and resources
   */
  initializeToolsAndResources() {
    try {
      // Combine all tools
      this.tools = [
        ...fileTools,
        ...editorTools,
        ...searchTools
      ];

      // Initialize resource providers (gracefully handle missing providers)
      this.resourceProviders = {};
      
      // Try to dynamically import providers if available
      try {
        // These providers would be available in a full Tauri environment
        // For now, we'll use a fallback approach
        this.resourceProviders = {
          workspace: { name: 'workspace', description: 'Workspace resources' },
          notes: { name: 'notes', description: 'Note resources' },
          themes: { name: 'themes', description: 'Theme resources' },
          config: { name: 'config', description: 'Configuration resources' },
          plugins: { name: 'plugins', description: 'Plugin resources' }
        };
      } catch (providerError) {
        console.log('📋 Using basic resource providers (full providers not available in this environment)');
      }

      console.log(`📦 Initialized ${this.tools.length} tools and ${Object.keys(this.resourceProviders).length} resource providers`);
    } catch (error) {
      console.warn('⚠️ Some tools/resources could not be initialized (this is normal outside Tauri):', error.message);
      // Fallback to basic tools
      this.tools = [{
        name: 'echo',
        description: 'Echo the input',
        inputSchema: {
          type: 'object',
          properties: {
            message: { type: 'string' }
          },
          required: ['message']
        }
      }];
      this.resourceProviders = {};
    }
  }

  /**
   * Setup event handlers for all components
   */
  setupEventHandlers() {
    // Config manager events
    this.configManager.on('configUpdated', (data) => {
      this.emit('configUpdated', data)
      this.handleConfigUpdate(data)
    })

    // Auth middleware events
    this.authMiddleware.on('rateLimited', (data) => {
      this.emit('rateLimited', data)
    })

    this.authMiddleware.on('clientBlocked', (data) => {
      this.emit('clientBlocked', data)
    })

    this.authMiddleware.on('activityLogged', (data) => {
      this.emit('activityLogged', data)
    })

    // CORS manager events
    this.corsManager.on('corsViolation', (data) => {
      this.emit('corsViolation', data)
    })

    // Headers manager events
    this.headersManager.on('cspViolation', (data) => {
      this.emit('cspViolation', data)
    })
  }

  /**
   * Handle configuration updates
   */
  handleConfigUpdate(data) {
    const { section, newConfig } = data
    
    switch (section) {
      case 'auth':
        // Reinitialize auth middleware with new config
        this.authMiddleware.shutdown()
        this.authMiddleware = new AuthenticationMiddleware(newConfig)
        break
      case 'cors':
        // Update CORS manager config
        this.corsManager.config = { ...this.corsManager.config, ...newConfig }
        break
      case 'headers':
        // Update headers manager config
        this.headersManager.config = { ...this.headersManager.config, ...newConfig }
        break
    }
  }

  /**
   * Setup Express middleware stack
   */
  setupMiddleware() {
    // Basic Express setup
    this.app.use(express.json({ 
      limit: this.config.validation.maxPayloadSize,
      verify: (req, res, buf) => {
        req.rawBody = buf
      }
    }))
    this.app.use(express.urlencoded({ extended: true, limit: this.config.validation.maxPayloadSize }))

    // Security headers (first)
    if (this.config.headers.enabled) {
      this.app.use(this.headersManager.securityMiddleware())
    }

    // CORS handling
    if (this.config.cors.enabled) {
      this.app.use(this.corsManager.corsMiddleware())
    }

    // Authentication and authorization
    if (this.config.auth.enabled) {
      this.app.use(this.authMiddleware.authenticate())
    }

    // CSP violation reporting endpoint
    if (this.config.headers.csp.enabled && this.config.headers.csp.reportUri) {
      this.app.post('/api/security/csp-report', this.headersManager.cspReportHandler())
    }
  }

  /**
   * Setup MCP-specific routes
   */
  setupMCPRoutes() {
    // MCP JSON-RPC endpoint
    this.app.post('/api/mcp', async (req, res) => {
      try {
        // Validate MCP request
        const validationResult = await this.authMiddleware.validator?.validateMCPRequest(req.validatedBody || req.body)
        
        if (validationResult && !validationResult.valid) {
          return res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32602,
              message: 'Invalid params',
              data: validationResult.errors
            },
            id: req.body?.id || null
          })
        }

        // Process MCP request
        const response = await this.processMCPRequest(req.body, req.auth)
        res.json(response)
        
      } catch (error) {
        this.emit('mcpError', {
          error: error.message,
          request: req.body,
          auth: req.auth,
          timestamp: Date.now()
        })

        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: this.config.environment === 'development' ? error.message : undefined
          },
          id: req.body?.id || null
        })
      }
    })

    // MCP capabilities endpoint
    this.app.get('/api/mcp/capabilities', (req, res) => {
      res.json({
        protocolVersion: '2024-11-05',
        capabilities: {
          logging: {},
          tools: {
            listChanged: true
          },
          resources: {
            subscribe: true,
            listChanged: true
          },
          prompts: {
            listChanged: true
          }
        },
        serverInfo: {
          name: 'Lokus MCP Server',
          version: '1.0.0'
        }
      })
    })
  }

  /**
   * Setup admin and monitoring routes
   */
  setupAdminRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        components: {
          auth: this.authMiddleware ? 'active' : 'inactive',
          cors: this.corsManager ? 'active' : 'inactive',
          headers: this.headersManager ? 'active' : 'inactive',
          config: this.configManager ? 'active' : 'inactive'
        }
      }
      
      res.json(health)
    })

    // Security metrics endpoint
    this.app.get('/api/admin/security/stats', (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      const stats = {
        auth: this.authMiddleware?.getStats(),
        cors: this.corsManager?.getStats(),
        headers: this.headersManager?.getStats(),
        config: this.configManager?.getStats(),
        timestamp: Date.now()
      }

      res.json(stats)
    })

    // API key management endpoints
    this.app.post('/api/admin/auth/api-keys', async (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      try {
        const { clientId, ...options } = req.body
        const apiKey = await this.authMiddleware.generateAPIKey(clientId, options)
        res.json(apiKey)
      } catch (error) {
        res.status(400).json({ error: error.message })
      }
    })

    this.app.delete('/api/admin/auth/api-keys/:keyId', async (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      try {
        const result = await this.authMiddleware.revokeAPIKey(req.params.keyId, 'admin_revocation')
        res.json({ success: result })
      } catch (error) {
        res.status(400).json({ error: error.message })
      }
    })

    // Configuration management endpoints
    this.app.get('/api/admin/config', (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      const config = this.configManager.getConfig()
      
      // Remove sensitive data
      delete config.auth.jwt.accessTokenSecret
      delete config.auth.jwt.refreshTokenSecret
      
      res.json(config)
    })

    this.app.put('/api/admin/config/:section', async (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      try {
        const updated = this.configManager.updateConfig(req.params.section, req.body)
        res.json(updated)
      } catch (error) {
        res.status(400).json({ error: error.message })
      }
    })

    // Audit logs endpoint
    this.app.get('/api/admin/audit', (req, res) => {
      if (!req.auth?.scopes?.includes('admin')) {
        return res.status(403).json({ error: 'Admin scope required' })
      }

      const filters = {
        action: req.query.action,
        clientId: req.query.clientId,
        since: req.query.since ? parseInt(req.query.since) : undefined,
        until: req.query.until ? parseInt(req.query.until) : undefined,
        limit: req.query.limit ? parseInt(req.query.limit) : 100
      }

      const auditLog = this.authMiddleware.getAuditLog(filters)
      res.json(auditLog)
    })
  }

  /**
   * Process MCP JSON-RPC request
   */
  async processMCPRequest(request, auth) {
    // This is where you'd integrate with your actual MCP server
    // For now, return a basic response
    
    const { method, params, id } = request

    switch (method) {
      case 'ping':
        return {
          jsonrpc: '2.0',
          result: { status: 'pong' },
          id
        }
        
      case 'initialize':
        return {
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              logging: {},
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
              prompts: { listChanged: true }
            },
            serverInfo: {
              name: 'Lokus MCP Server',
              version: '1.0.0'
            }
          },
          id
        }
        
      case 'tools/list':
        // Check if client has tools:read permission
        if (!this.authMiddleware.hasPermission(auth.permissions, 'tools', 'read')) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Insufficient permissions',
              data: { required: 'tools:read' }
            },
            id
          }
        }
        
        return {
          jsonrpc: '2.0',
          result: {
            tools: this.tools.map(tool => ({
              name: tool.name,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          },
          id
        }
        
      case 'tools/call':
        // Check if client has tools:execute permission
        if (!this.authMiddleware.hasPermission(auth.permissions, 'tools', 'execute')) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32001,
              message: 'Insufficient permissions',
              data: { required: 'tools:execute' }
            },
            id
          }
        }
        
        // Find the tool
        const tool = this.tools.find(t => t.name === params.name);
        if (!tool) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: 'Tool not found',
              data: { tool: params.name }
            },
            id
          }
        }
        
        // Execute the tool
        try {
          const result = await tool.handler(params.arguments || {});
          return {
            jsonrpc: '2.0',
            result,
            id
          }
        } catch (error) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Tool execution failed',
              data: { error: error.message }
            },
            id
          }
        }

      case 'resources/list':
        try {
          const allResources = [];
          for (const [providerName, provider] of Object.entries(this.resourceProviders)) {
            if (provider && typeof provider.listResources === 'function') {
              const resources = await provider.listResources();
              allResources.push(...resources);
            }
          }
          
          return {
            jsonrpc: '2.0',
            result: {
              resources: allResources
            },
            id
          }
        } catch (error) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Failed to list resources',
              data: { error: error.message }
            },
            id
          }
        }

      case 'resources/read':
        try {
          const { uri } = params;
          let resource = null;
          
          for (const [providerName, provider] of Object.entries(this.resourceProviders)) {
            if (provider && typeof provider.readResource === 'function') {
              try {
                resource = await provider.readResource(uri);
                if (resource) break;
              } catch (error) {
                // Continue to next provider
                continue;
              }
            }
          }
          
          if (!resource) {
            return {
              jsonrpc: '2.0',
              error: {
                code: -32602,
                message: 'Resource not found',
                data: { uri }
              },
              id
            }
          }
          
          return {
            jsonrpc: '2.0',
            result: resource,
            id
          }
        } catch (error) {
          return {
            jsonrpc: '2.0',
            error: {
              code: -32603,
              message: 'Failed to read resource',
              data: { error: error.message }
            },
            id
          }
        }
        
      default:
        return {
          jsonrpc: '2.0',
          error: {
            code: -32601,
            message: 'Method not found',
            data: { method }
          },
          id
        }
    }
  }

  /**
   * Start the server
   */
  async start(port = 3000, host = 'localhost') {
    if (this.isRunning) {
      throw new Error('Server is already running')
    }

    try {
      // Setup routes
      this.setupMCPRoutes()
      this.setupAdminRoutes()

      // Error handling middleware
      this.app.use((error, req, res, next) => {
        this.emit('serverError', {
          error: error.message,
          stack: error.stack,
          path: req.path,
          method: req.method,
          timestamp: Date.now()
        })

        res.status(500).json({
          error: 'Internal server error',
          requestId: req.requestId,
          timestamp: new Date().toISOString()
        })
      })

      // Start listening
      this.server = this.app.listen(port, host, () => {
        this.isRunning = true
        this.emit('serverStarted', { port, host, timestamp: Date.now() })
        console.log(`🔒 Secure MCP Server running on ${host}:${port}`)
        console.log(`📊 Health check: http://${host}:${port}/health`)
        console.log(`🔑 Admin panel: http://${host}:${port}/api/admin/security/stats`)
      })

      this.server.on('error', (error) => {
        this.emit('serverError', { error: error.message, timestamp: Date.now() })
      })

      return this.server
    } catch (error) {
      this.emit('startupError', { error: error.message, timestamp: Date.now() })
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

    try {
      // Close HTTP server
      if (this.server) {
        await new Promise((resolve) => {
          this.server.close(resolve)
        })
      }

      // Shutdown security components
      this.authMiddleware?.shutdown()
      this.corsManager?.shutdown()
      this.headersManager?.shutdown()
      this.configManager?.shutdown()

      this.isRunning = false
      this.emit('serverStopped', { timestamp: Date.now() })
      console.log('🔒 Secure MCP Server stopped')
    } catch (error) {
      this.emit('shutdownError', { error: error.message, timestamp: Date.now() })
      throw error
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    console.log('🔒 Initiating graceful shutdown...')
    
    // Stop accepting new connections
    if (this.server) {
      this.server.close()
    }

    // Wait for existing requests to complete (with timeout)
    await new Promise((resolve) => {
      setTimeout(resolve, 5000) // 5 second grace period
    })

    // Force stop
    await this.stop()
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      uptime: this.isRunning ? process.uptime() : 0,
      memory: process.memoryUsage(),
      components: {
        auth: this.authMiddleware ? 'active' : 'inactive',
        cors: this.corsManager ? 'active' : 'inactive',
        headers: this.headersManager ? 'active' : 'inactive',
        config: this.configManager ? 'active' : 'inactive'
      },
      stats: {
        auth: this.authMiddleware?.getStats(),
        cors: this.corsManager?.getStats(),
        headers: this.headersManager?.getStats(),
        config: this.configManager?.getStats()
      }
    }
  }
}

// Handle process signals for graceful shutdown
function setupGracefulShutdown(server) {
  const gracefulShutdown = async (signal) => {
    console.log(`\n🔒 Received ${signal}, shutting down gracefully...`)
    try {
      await server.gracefulShutdown()
      process.exit(0)
    } catch (error) {
      console.error('Error during shutdown:', error)
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
  process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')) // nodemon restart
}

export { SecureMCPServer, setupGracefulShutdown }
export default SecureMCPServer