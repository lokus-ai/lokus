/**
 * MCP Server Host
 * 
 * Hosts and manages MCP servers within Lokus
 * Provides process management, IPC communication, and health monitoring
 * Supports both internal (Web Worker) and external (subprocess) MCP servers
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { MCPProtocol, MCPMethod } from './MCPProtocol.js'
import { PluginSandbox } from '../security/PluginSandbox.js'

/**
 * MCP Server Types
 */
export const MCPServerType = {
  INTERNAL: 'internal',   // Runs in Web Worker
  EXTERNAL: 'external',   // Runs as subprocess
  EMBEDDED: 'embedded'    // Runs in main thread (less secure)
}

/**
 * MCP Server Status
 */
export const MCPServerStatus = {
  STOPPED: 'stopped',
  STARTING: 'starting',
  RUNNING: 'running',
  STOPPING: 'stopping',
  CRASHED: 'crashed',
  ERROR: 'error'
}

/**
 * MCP Server Host - Manages MCP server processes
 */
export class MCPServerHost extends EventEmitter {
  constructor(securityManager, options = {}) {
    super()
    
    this.securityManager = securityManager
    
    // Configuration
    this.options = {
      maxServers: 20,
      serverStartupTimeout: 30000,
      serverShutdownTimeout: 10000,
      healthCheckInterval: 5000,
      restartOnCrash: true,
      enableProcessIsolation: true,
      memoryLimit: 100 * 1024 * 1024, // 100MB per server
      cpuLimit: 1000, // 1 second CPU time per request
      ...options
    }
    
    // Server management
    this.servers = new Map() // serverId -> MCPServerInstance
    this.serverProcesses = new Map() // serverId -> process/worker
    this.serverChannels = new Map() // serverId -> communication channel
    
    // Health monitoring
    this.healthMonitor = null
    this.serverHealth = new Map() // serverId -> health status
    
    // Resource tracking
    this.resourceUsage = new Map() // serverId -> usage stats
    
    this.logger = console
    this.isInitialized = false
  }

  /**
   * Initialize the server host
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Start health monitoring
      this.startHealthMonitoring()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('MCP Server Host initialized')
      
    } catch (error) {
      this.logger.error('Failed to initialize MCP Server Host:', error)
      throw error
    }
  }

  /**
   * Start an MCP server
   */
  async startServer(serverId, config) {
    if (this.servers.has(serverId)) {
      throw new Error(`Server already exists: ${serverId}`)
    }

    if (this.servers.size >= this.options.maxServers) {
      throw new Error(`Maximum number of servers reached: ${this.options.maxServers}`)
    }

    try {
      // Create server instance
      const serverInstance = new MCPServerInstance(serverId, config, this.options)
      this.servers.set(serverId, serverInstance)
      
      // Set up event handlers
      this.setupServerEventHandlers(serverInstance)
      
      // Start the server based on type
      await this.startServerProcess(serverInstance)
      
      // Initialize MCP protocol
      await this.initializeServerProtocol(serverInstance)
      
      // Register with health monitoring
      this.registerForHealthMonitoring(serverId)
      
      this.emit('server-started', { serverId, serverInstance })
      this.logger.info(`MCP server started: ${serverId}`)
      
      return serverInstance
      
    } catch (error) {
      // Clean up on failure
      this.servers.delete(serverId)
      this.serverProcesses.delete(serverId)
      this.serverChannels.delete(serverId)
      
      this.logger.error(`Failed to start MCP server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Stop an MCP server
   */
  async stopServer(serverId, force = false) {
    const serverInstance = this.servers.get(serverId)
    if (!serverInstance) {
      throw new Error(`Server not found: ${serverId}`)
    }

    try {
      serverInstance.setStatus(MCPServerStatus.STOPPING)
      
      // Graceful shutdown first
      if (!force) {
        await this.gracefulShutdown(serverInstance)
      } else {
        await this.forceShutdown(serverInstance)
      }
      
      // Clean up resources
      await this.cleanupServerResources(serverId)
      
      serverInstance.setStatus(MCPServerStatus.STOPPED)
      this.emit('server-stopped', { serverId })
      this.logger.info(`MCP server stopped: ${serverId}`)
      
    } catch (error) {
      serverInstance.setStatus(MCPServerStatus.ERROR)
      this.logger.error(`Failed to stop MCP server ${serverId}:`, error)
      throw error
    }
  }

  /**
   * Restart an MCP server
   */
  async restartServer(serverId) {
    const serverInstance = this.servers.get(serverId)
    if (!serverInstance) {
      throw new Error(`Server not found: ${serverId}`)
    }

    const config = serverInstance.config
    
    await this.stopServer(serverId, false)
    await this.startServer(serverId, config)
    
    this.emit('server-restarted', { serverId })
    return this.servers.get(serverId)
  }

  /**
   * Start server process based on type
   */
  async startServerProcess(serverInstance) {
    const { serverId, config, type } = serverInstance
    
    switch (type) {
      case MCPServerType.INTERNAL:
        await this.startInternalServer(serverInstance)
        break
        
      case MCPServerType.EXTERNAL:
        await this.startExternalServer(serverInstance)
        break
        
      case MCPServerType.EMBEDDED:
        await this.startEmbeddedServer(serverInstance)
        break
        
      default:
        throw new Error(`Unsupported server type: ${type}`)
    }
  }

  /**
   * Start internal server (Web Worker)
   */
  async startInternalServer(serverInstance) {
    const { serverId, config } = serverInstance
    
    try {
      // Create secure sandbox
      const sandbox = new PluginSandbox(serverId, config.manifest, {
        memoryLimit: this.options.memoryLimit,
        cpuTimeLimit: this.options.cpuLimit,
        requireSignature: config.requireSignature
      })
      
      // Initialize sandbox
      await sandbox.initialize()
      
      // Create communication channel
      const channel = this.createInternalChannel(sandbox)
      
      serverInstance.setProcess(sandbox)
      serverInstance.setChannel(channel)
      serverInstance.setStatus(MCPServerStatus.RUNNING)
      
      // Store references
      this.serverProcesses.set(serverId, sandbox)
      this.serverChannels.set(serverId, channel)
      
      this.logger.info(`Internal MCP server started: ${serverId}`)
      
    } catch (error) {
      serverInstance.setStatus(MCPServerStatus.ERROR)
      throw error
    }
  }

  /**
   * Start external server (subprocess)
   */
  async startExternalServer(serverInstance) {
    const { serverId, config } = serverInstance
    
    try {
      // This would spawn a subprocess
      // For now, we'll simulate with a mock process
      const mockProcess = new MockExternalProcess(serverId, config)
      
      // Start the process
      await mockProcess.start()
      
      // Create communication channel
      const channel = this.createExternalChannel(mockProcess)
      
      serverInstance.setProcess(mockProcess)
      serverInstance.setChannel(channel)
      serverInstance.setStatus(MCPServerStatus.RUNNING)
      
      // Store references
      this.serverProcesses.set(serverId, mockProcess)
      this.serverChannels.set(serverId, channel)
      
      this.logger.info(`External MCP server started: ${serverId}`)
      
    } catch (error) {
      serverInstance.setStatus(MCPServerStatus.ERROR)
      throw error
    }
  }

  /**
   * Start embedded server (main thread)
   */
  async startEmbeddedServer(serverInstance) {
    const { serverId, config } = serverInstance
    
    try {
      // Create in-process server
      const embeddedServer = new EmbeddedMCPServer(serverId, config)
      
      // Initialize server
      await embeddedServer.initialize()
      
      // Create direct channel
      const channel = this.createEmbeddedChannel(embeddedServer)
      
      serverInstance.setProcess(embeddedServer)
      serverInstance.setChannel(channel)
      serverInstance.setStatus(MCPServerStatus.RUNNING)
      
      // Store references
      this.serverProcesses.set(serverId, embeddedServer)
      this.serverChannels.set(serverId, channel)
      
      this.logger.info(`Embedded MCP server started: ${serverId}`)
      
    } catch (error) {
      serverInstance.setStatus(MCPServerStatus.ERROR)
      throw error
    }
  }

  /**
   * Initialize server MCP protocol
   */
  async initializeServerProtocol(serverInstance) {
    const { serverId, channel } = serverInstance
    
    // Create MCP protocol instance
    const mcpProtocol = new MCPProtocol(serverId)
    
    // Connect protocol to channel
    this.connectProtocolToChannel(mcpProtocol, channel)
    
    // Initialize protocol
    await mcpProtocol.initialize({
      name: serverInstance.config.name || serverId,
      version: serverInstance.config.version || '1.0.0'
    })
    
    serverInstance.setProtocol(mcpProtocol)
    
    this.logger.info(`MCP protocol initialized for server: ${serverId}`)
  }

  /**
   * Create communication channels
   */
  createInternalChannel(sandbox) {
    const channel = new EventEmitter()
    
    // Connect sandbox events to channel
    sandbox.on('send-message', (message) => {
      channel.emit('message-from-server', message)
    })
    
    // Forward channel messages to sandbox
    channel.on('message-to-server', (message) => {
      sandbox.handleMessage(message)
    })
    
    return channel
  }

  createExternalChannel(process) {
    const channel = new EventEmitter()
    
    // Connect process stdio to channel
    process.on('message', (message) => {
      channel.emit('message-from-server', message)
    })
    
    channel.on('message-to-server', (message) => {
      process.send(message)
    })
    
    return channel
  }

  createEmbeddedChannel(server) {
    const channel = new EventEmitter()
    
    // Direct connection to embedded server
    server.on('message', (message) => {
      channel.emit('message-from-server', message)
    })
    
    channel.on('message-to-server', (message) => {
      server.handleMessage(message)
    })
    
    return channel
  }

  /**
   * Connect MCP protocol to communication channel
   */
  connectProtocolToChannel(protocol, channel) {
    // Forward protocol messages to channel
    protocol.on('send-message', (message) => {
      channel.emit('message-to-server', message)
    })
    
    // Forward channel messages to protocol
    channel.on('message-from-server', (message) => {
      protocol.handleMessage(message)
    })
  }

  /**
   * Set up server event handlers
   */
  setupServerEventHandlers(serverInstance) {
    const { serverId } = serverInstance
    
    serverInstance.on('status-changed', (status) => {
      this.emit('server-status-changed', { serverId, status })
      
      // Handle crashes
      if (status === MCPServerStatus.CRASHED && this.options.restartOnCrash) {
        this.handleServerCrash(serverId)
      }
    })
    
    serverInstance.on('error', (error) => {
      this.emit('server-error', { serverId, error })
      this.logger.error(`Server error (${serverId}):`, error)
    })
    
    serverInstance.on('resource-usage', (usage) => {
      this.resourceUsage.set(serverId, usage)
      this.emit('server-resource-usage', { serverId, usage })
    })
  }

  /**
   * Handle server crash
   */
  async handleServerCrash(serverId) {
    this.logger.warn(`Server crashed, attempting restart: ${serverId}`)
    
    try {
      await this.restartServer(serverId)
      this.logger.info(`Server successfully restarted: ${serverId}`)
    } catch (error) {
      this.logger.error(`Failed to restart crashed server ${serverId}:`, error)
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    this.healthMonitor = setInterval(() => {
      this.performHealthChecks()
    }, this.options.healthCheckInterval)
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring() {
    if (this.healthMonitor) {
      clearInterval(this.healthMonitor)
      this.healthMonitor = null
    }
  }

  /**
   * Perform health checks on all servers
   */
  async performHealthChecks() {
    for (const [serverId, serverInstance] of this.servers) {
      try {
        await this.checkServerHealth(serverInstance)
      } catch (error) {
        this.logger.warn(`Health check failed for server ${serverId}:`, error)
      }
    }
  }

  /**
   * Check individual server health
   */
  async checkServerHealth(serverInstance) {
    const { serverId, protocol, status } = serverInstance
    
    if (status !== MCPServerStatus.RUNNING) {
      return
    }
    
    try {
      // Simple ping check
      const startTime = Date.now()
      await protocol.sendRequest('ping', {}, { timeout: 5000 })
      const responseTime = Date.now() - startTime
      
      const healthStatus = {
        status: 'healthy',
        responseTime,
        timestamp: Date.now()
      }
      
      this.serverHealth.set(serverId, healthStatus)
      
    } catch (error) {
      const healthStatus = {
        status: 'unhealthy',
        error: error.message,
        timestamp: Date.now()
      }
      
      this.serverHealth.set(serverId, healthStatus)
      
      // Mark server as having issues
      if (serverInstance.status === MCPServerStatus.RUNNING) {
        serverInstance.setStatus(MCPServerStatus.ERROR)
      }
    }
  }

  /**
   * Register server for health monitoring
   */
  registerForHealthMonitoring(serverId) {
    this.serverHealth.set(serverId, {
      status: 'unknown',
      timestamp: Date.now()
    })
  }

  /**
   * Graceful server shutdown
   */
  async gracefulShutdown(serverInstance) {
    const { serverId, protocol, process } = serverInstance
    
    try {
      // Send shutdown signal through protocol
      if (protocol) {
        await protocol.sendNotification('shutdown')
      }
      
      // Give process time to shut down gracefully
      await this.waitForShutdown(process, this.options.serverShutdownTimeout)
      
    } catch (error) {
      this.logger.warn(`Graceful shutdown failed for ${serverId}, forcing shutdown`)
      await this.forceShutdown(serverInstance)
    }
  }

  /**
   * Force server shutdown
   */
  async forceShutdown(serverInstance) {
    const { serverId, process } = serverInstance
    
    try {
      if (process && typeof process.terminate === 'function') {
        await process.terminate()
      } else if (process && typeof process.kill === 'function') {
        process.kill()
      }
    } catch (error) {
      this.logger.error(`Force shutdown failed for ${serverId}:`, error)
    }
  }

  /**
   * Wait for process shutdown
   */
  async waitForShutdown(process, timeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Shutdown timeout'))
      }, timeout)
      
      if (process && typeof process.on === 'function') {
        process.on('exit', () => {
          clearTimeout(timer)
          resolve()
        })
      } else {
        // For non-process objects, just resolve
        clearTimeout(timer)
        resolve()
      }
    })
  }

  /**
   * Clean up server resources
   */
  async cleanupServerResources(serverId) {
    // Remove from tracking maps
    this.servers.delete(serverId)
    this.serverProcesses.delete(serverId)
    this.serverChannels.delete(serverId)
    this.serverHealth.delete(serverId)
    this.resourceUsage.delete(serverId)
  }

  /**
   * Get server by ID
   */
  getServer(serverId) {
    return this.servers.get(serverId)
  }

  /**
   * Get all servers
   */
  getAllServers() {
    return Array.from(this.servers.values())
  }

  /**
   * Get server health status
   */
  getServerHealth(serverId) {
    return this.serverHealth.get(serverId)
  }

  /**
   * Get server resource usage
   */
  getServerResourceUsage(serverId) {
    return this.resourceUsage.get(serverId)
  }

  /**
   * Get host statistics
   */
  getStats() {
    const stats = {
      totalServers: this.servers.size,
      runningServers: 0,
      stoppedServers: 0,
      errorServers: 0,
      byType: {},
      totalMemoryUsage: 0,
      healthySer: 0,
      unhealthyServers: 0
    }
    
    // Count by status
    for (const server of this.servers.values()) {
      switch (server.status) {
        case MCPServerStatus.RUNNING:
          stats.runningServers++
          break
        case MCPServerStatus.STOPPED:
          stats.stoppedServers++
          break
        case MCPServerStatus.ERROR:
        case MCPServerStatus.CRASHED:
          stats.errorServers++
          break
      }
      
      // Count by type
      stats.byType[server.type] = (stats.byType[server.type] || 0) + 1
    }
    
    // Calculate resource usage
    for (const usage of this.resourceUsage.values()) {
      if (usage.memoryUsage) {
        stats.totalMemoryUsage += usage.memoryUsage
      }
    }
    
    // Count health status
    for (const health of this.serverHealth.values()) {
      if (health.status === 'healthy') {
        stats.healthyServers++
      } else if (health.status === 'unhealthy') {
        stats.unhealthyServers++
      }
    }
    
    return stats
  }

  /**
   * Shutdown all servers
   */
  async shutdown() {
    this.logger.info('Shutting down MCP Server Host...')
    
    // Stop health monitoring
    this.stopHealthMonitoring()
    
    // Stop all servers
    const shutdownPromises = []
    for (const serverId of this.servers.keys()) {
      shutdownPromises.push(
        this.stopServer(serverId, true).catch(error => {
          this.logger.error(`Error stopping server ${serverId}:`, error)
        })
      )
    }
    
    await Promise.allSettled(shutdownPromises)
    
    this.emit('shutdown')
    this.logger.info('MCP Server Host shut down')
  }
}

/**
 * MCP Server Instance - Represents a single MCP server
 */
export class MCPServerInstance extends EventEmitter {
  constructor(serverId, config, options) {
    super()
    
    this.serverId = serverId
    this.config = config
    this.type = config.type || MCPServerType.INTERNAL
    
    this.status = MCPServerStatus.STOPPED
    this.process = null
    this.channel = null
    this.protocol = null
    
    this.metadata = {
      createdAt: Date.now(),
      startedAt: null,
      stoppedAt: null,
      restartCount: 0
    }
    
    this.lastError = null
  }

  /**
   * Set server status
   */
  setStatus(newStatus) {
    const oldStatus = this.status
    this.status = newStatus
    
    if (newStatus === MCPServerStatus.RUNNING && !this.metadata.startedAt) {
      this.metadata.startedAt = Date.now()
    } else if (newStatus === MCPServerStatus.STOPPED) {
      this.metadata.stoppedAt = Date.now()
    }
    
    this.emit('status-changed', newStatus, oldStatus)
  }

  /**
   * Set server process
   */
  setProcess(process) {
    this.process = process
  }

  /**
   * Set communication channel
   */
  setChannel(channel) {
    this.channel = channel
  }

  /**
   * Set MCP protocol
   */
  setProtocol(protocol) {
    this.protocol = protocol
  }

  /**
   * Set error
   */
  setError(error) {
    this.lastError = error
    this.emit('error', error)
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      serverId: this.serverId,
      type: this.type,
      status: this.status,
      config: this.config,
      metadata: this.metadata,
      lastError: this.lastError?.message,
      hasProcess: !!this.process,
      hasChannel: !!this.channel,
      hasProtocol: !!this.protocol
    }
  }
}

/**
 * Mock External Process (for demonstration)
 */
class MockExternalProcess extends EventEmitter {
  constructor(serverId, config) {
    super()
    this.serverId = serverId
    this.config = config
    this.isRunning = false
  }

  async start() {
    this.isRunning = true
    this.emit('started')
  }

  send(message) {
    // Echo back for demo
    setTimeout(() => {
      this.emit('message', message)
    }, 10)
  }

  kill() {
    this.isRunning = false
    this.emit('exit', 0)
  }

  async terminate() {
    this.kill()
  }
}

/**
 * Embedded MCP Server (runs in main thread)
 */
class EmbeddedMCPServer extends EventEmitter {
  constructor(serverId, config) {
    super()
    this.serverId = serverId
    this.config = config
    this.isInitialized = false
  }

  async initialize() {
    this.isInitialized = true
    this.emit('initialized')
  }

  handleMessage(message) {
    // Echo back for demo
    setTimeout(() => {
      this.emit('message', message)
    }, 5)
  }

  async terminate() {
    this.isInitialized = false
    this.emit('terminated')
  }
}

export default MCPServerHost