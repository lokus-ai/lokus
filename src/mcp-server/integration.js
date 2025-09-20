/**
 * MCP HTTP Server Integration
 * 
 * Integrates the MCP HTTP server with the existing Lokus MCP plugin system
 * Provides bridging between HTTP/WebSocket and internal MCP protocols
 */

import { getMCPIntegration } from '../plugins/mcp/index.js'
import { MCPServerType, MCPServerStatus } from '../plugins/mcp/MCPServerHost.js'
import { createMCPServer } from './server.js'
import { initializeFileToolsPlugin } from './plugins/file-tools-plugin.js'

/**
 * MCP HTTP Server Integration
 * Bridges the HTTP server with the existing MCP plugin system
 */
export class MCPHttpServerIntegration {
  constructor(options = {}) {
    this.options = {
      serverId: options.serverId || 'http-server',
      serverConfig: {
        name: 'Lokus MCP HTTP Server',
        version: '1.0.0',
        type: MCPServerType.EMBEDDED,
        ...options.serverConfig
      },
      httpServerOptions: {
        port: options.port || 3456,
        host: options.host || 'localhost',
        enableWebSocket: options.enableWebSocket !== false,
        ...options.httpServerOptions
      },
      autoRegister: options.autoRegister !== false,
      ...options
    }

    this.mcpIntegration = null
    this.httpServer = null
    this.serverInstance = null
    this.isRegistered = false
    this.logger = console
  }

  /**
   * Initialize the integration
   */
  async initialize() {
    try {
      // Get MCP integration
      this.mcpIntegration = getMCPIntegration()
      
      // Create HTTP server with enhanced options
      this.httpServer = createMCPServer({
        ...this.options.httpServerOptions,
        mcpIntegration: this.mcpIntegration
      })

      // Initialize HTTP server
      await this.httpServer.initialize()

      // Register with MCP system if enabled
      if (this.options.autoRegister) {
        await this.registerWithMCPSystem()
      }

      // Initialize file tools plugin
      try {
        await initializeFileToolsPlugin()
        this.logger.info('[MCP-HttpIntegration] File tools plugin initialized')
      } catch (error) {
        this.logger.warn('[MCP-HttpIntegration] File tools plugin initialization failed:', error)
      }

      this.logger.info('[MCP-HttpIntegration] Integration initialized')
      return this

    } catch (error) {
      this.logger.error('[MCP-HttpIntegration] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * Register HTTP server with MCP system
   */
  async registerWithMCPSystem() {
    try {
      const serverHost = this.mcpIntegration.mcpServerHost
      if (!serverHost) {
        this.logger.warn('[MCP-HttpIntegration] No MCP server host available')
        return
      }

      // Register as an embedded server
      this.serverInstance = await serverHost.startServer(
        this.options.serverId,
        {
          ...this.options.serverConfig,
          httpServer: this.httpServer,
          type: MCPServerType.EMBEDDED
        }
      )

      this.isRegistered = true
      this.logger.info('[MCP-HttpIntegration] Registered with MCP system')

      // Set up integration event handlers
      this.setupIntegrationHandlers()

    } catch (error) {
      this.logger.error('[MCP-HttpIntegration] Failed to register with MCP system:', error)
      throw error
    }
  }

  /**
   * Set up integration event handlers
   */
  setupIntegrationHandlers() {
    // Forward HTTP server events to MCP system
    if (this.httpServer && this.serverInstance) {
      // Monitor server health
      this.httpServer.on?.('error', (error) => {
        this.serverInstance.setError(error)
      })

      // Update status based on HTTP server state
      const updateStatus = () => {
        if (this.httpServer.isRunning) {
          this.serverInstance.setStatus(MCPServerStatus.RUNNING)
        } else {
          this.serverInstance.setStatus(MCPServerStatus.STOPPED)
        }
      }

      // Monitor status changes
      setInterval(updateStatus, 5000)
    }

    // Forward MCP integration events to HTTP server
    if (this.mcpIntegration) {
      // Forward resource updates
      this.mcpIntegration.on?.('global-resource-registered', (event) => {
        this.broadcastResourceListChanged()
      })

      this.mcpIntegration.on?.('global-tool-registered', (event) => {
        this.broadcastToolListChanged()
      })

      this.mcpIntegration.on?.('global-prompt-registered', (event) => {
        this.broadcastPromptListChanged()
      })
    }
  }

  /**
   * Start the HTTP server
   */
  async start() {
    if (!this.httpServer) {
      await this.initialize()
    }

    await this.httpServer.start()
    this.logger.info('[MCP-HttpIntegration] HTTP server started')
    return this
  }

  /**
   * Stop the HTTP server
   */
  async stop() {
    if (this.httpServer) {
      await this.httpServer.stop()
    }

    if (this.isRegistered && this.mcpIntegration?.mcpServerHost) {
      try {
        await this.mcpIntegration.mcpServerHost.stopServer(this.options.serverId)
        this.isRegistered = false
      } catch (error) {
        this.logger.warn('[MCP-HttpIntegration] Error unregistering from MCP system:', error)
      }
    }

    this.logger.info('[MCP-HttpIntegration] HTTP server stopped')
    return this
  }

  /**
   * Restart the HTTP server
   */
  async restart() {
    await this.stop()
    await this.start()
    return this
  }

  /**
   * Broadcast resource list changed
   */
  broadcastResourceListChanged() {
    if (this.httpServer?.wsServer) {
      this.httpServer.wsServer.broadcastListChanged('resources')
    }
  }

  /**
   * Broadcast tool list changed
   */
  broadcastToolListChanged() {
    if (this.httpServer?.wsServer) {
      this.httpServer.wsServer.broadcastListChanged('tools')
    }
  }

  /**
   * Broadcast prompt list changed
   */
  broadcastPromptListChanged() {
    if (this.httpServer?.wsServer) {
      this.httpServer.wsServer.broadcastListChanged('prompts')
    }
  }

  /**
   * Broadcast resource update
   */
  broadcastResourceUpdate(uri, content, metadata = {}) {
    if (this.httpServer?.wsServer) {
      this.httpServer.wsServer.broadcastResourceUpdate(uri, content, metadata)
    }
  }

  /**
   * Get integration status
   */
  getStatus() {
    return {
      isInitialized: !!this.httpServer,
      isRegistered: this.isRegistered,
      isRunning: this.httpServer?.isRunning || false,
      isHealthy: this.httpServer?.isHealthy() || false,
      serverId: this.options.serverId,
      httpServerStats: this.httpServer?.getStats(),
      mcpServerInstance: this.serverInstance?.getInfo()
    }
  }

  /**
   * Get HTTP server instance
   */
  getHttpServer() {
    return this.httpServer
  }

  /**
   * Get MCP server instance
   */
  getMCPServerInstance() {
    return this.serverInstance
  }

  /**
   * Update configuration
   */
  updateConfig(newOptions) {
    this.options = { ...this.options, ...newOptions }
    if (this.httpServer) {
      this.httpServer.updateConfig(newOptions.httpServerOptions || {})
    }
    return this
  }

  /**
   * Dispose of the integration
   */
  async dispose() {
    await this.stop()
    this.mcpIntegration = null
    this.httpServer = null
    this.serverInstance = null
    this.logger.info('[MCP-HttpIntegration] Integration disposed')
  }
}

/**
 * Default integration instance
 */
let defaultIntegration = null

/**
 * Initialize default MCP HTTP server integration
 */
export async function initializeMCPHttpServer(options = {}) {
  if (defaultIntegration) {
    throw new Error('MCP HTTP Server integration already initialized')
  }

  defaultIntegration = new MCPHttpServerIntegration(options)
  await defaultIntegration.initialize()
  
  return defaultIntegration
}

/**
 * Get default MCP HTTP server integration
 */
export function getMCPHttpServer() {
  if (!defaultIntegration) {
    throw new Error('MCP HTTP Server integration not initialized')
  }
  return defaultIntegration
}

/**
 * Start default MCP HTTP server
 */
export async function startMCPHttpServerIntegration(options = {}) {
  if (!defaultIntegration) {
    await initializeMCPHttpServer(options)
  }
  await defaultIntegration.start()
  return defaultIntegration
}

/**
 * Stop default MCP HTTP server
 */
export async function stopMCPHttpServer() {
  if (defaultIntegration) {
    await defaultIntegration.stop()
  }
}

/**
 * Shutdown default MCP HTTP server
 */
export async function shutdownMCPHttpServer() {
  if (defaultIntegration) {
    await defaultIntegration.dispose()
    defaultIntegration = null
  }
}

/**
 * Quick start for development
 */
export async function startDevMCPServer(port = 3456) {
  return await startMCPHttpServerIntegration({
    serverId: 'dev-http-server',
    port,
    enableWebSocket: true,
    enableCors: true,
    enableRateLimit: false,
    enableLogging: true,
    production: false,
    autoRegister: true
  })
}

/**
 * Quick start for production
 */
export async function startProdMCPServer(options = {}) {
  return await startMCPHttpServerIntegration({
    serverId: 'prod-http-server',
    port: options.port || process.env.PORT || 3456,
    host: options.host || process.env.HOST || '0.0.0.0',
    enableWebSocket: true,
    enableCors: true,
    enableRateLimit: true,
    enableLogging: true,
    production: true,
    allowedOrigins: options.allowedOrigins || process.env.ALLOWED_ORIGINS?.split(','),
    autoRegister: true,
    ...options
  })
}

export default MCPHttpServerIntegration