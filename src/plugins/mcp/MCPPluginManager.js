/**
 * MCP Plugin Manager
 * 
 * Manages MCP-enabled plugins with specialized lifecycle management
 * Provides integration between Lokus plugin system and MCP protocol
 * Handles MCP server registration, discovery, and communication
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { MCPProtocol, MCPMethod, MCPResourceType } from './MCPProtocol.js'
import { PluginSandbox } from '../security/PluginSandbox.js'

/**
 * MCP Plugin Types
 */
export const MCPPluginType = {
  SERVER: 'mcp-server',
  CLIENT: 'mcp-client',
  HYBRID: 'mcp-hybrid'
}

/**
 * MCP Plugin States
 */
export const MCPPluginState = {
  DISCOVERED: 'discovered',
  LOADING: 'loading',
  LOADED: 'loaded',
  INITIALIZING: 'initializing',
  ACTIVE: 'active',
  ERROR: 'error',
  DISPOSED: 'disposed'
}

/**
 * MCP Plugin Manager - Handles MCP-enabled plugins
 */
export class MCPPluginManager extends EventEmitter {
  constructor(pluginManager, securityManager) {
    super()
    
    this.pluginManager = pluginManager
    this.securityManager = securityManager
    
    // MCP-specific plugin tracking
    this.mcpPlugins = new Map() // pluginId -> MCPPluginWrapper
    this.mcpServers = new Map() // serverId -> MCPProtocol instance
    this.mcpClients = new Map() // clientId -> MCPProtocol instance
    
    // Resource and tool registries
    this.globalResources = new Map() // uri -> { resource, pluginId, serverId }
    this.globalTools = new Map() // name -> { tool, pluginId, serverId }
    this.globalPrompts = new Map() // name -> { prompt, pluginId, serverId }
    
    // Communication channels
    this.serverChannels = new Map() // serverId -> communication channel
    this.clientChannels = new Map() // clientId -> communication channel
    
    // Plugin discovery
    this.mcpCapabilities = new Map() // pluginId -> capabilities
    
    // Configuration
    this.config = {
      enableAutoDiscovery: true,
      maxConcurrentServers: 10,
      serverStartupTimeout: 30000,
      enableCrossPluginCommunication: true,
      sandboxMCPPlugins: true
    }
    
    this.isInitialized = false
    this.logger = console
    
    this.setupEventHandlers()
  }

  /**
   * Initialize the MCP Plugin Manager
   */
  async initialize() {
    if (this.isInitialized) {
      return
    }

    try {
      // Discover existing MCP plugins
      if (this.config.enableAutoDiscovery) {
        await this.discoverMCPPlugins()
      }
      
      // Set up plugin manager integration
      this.integrateWithPluginManager()
      
      this.isInitialized = true
      this.emit('initialized')
      this.logger.info('MCP Plugin Manager initialized')
      
    } catch (error) {
      this.logger.error('Failed to initialize MCP Plugin Manager:', error)
      throw error
    }
  }

  /**
   * Set up event handlers
   */
  setupEventHandlers() {
    // Handle plugin lifecycle events
    this.on('mcp-plugin-loaded', this.handleMCPPluginLoaded.bind(this))
    this.on('mcp-plugin-activated', this.handleMCPPluginActivated.bind(this))
    this.on('mcp-plugin-deactivated', this.handleMCPPluginDeactivated.bind(this))
    this.on('mcp-plugin-error', this.handleMCPPluginError.bind(this))
  }

  /**
   * Integrate with the main plugin manager
   */
  integrateWithPluginManager() {
    // Listen for plugin events
    this.pluginManager.on('plugin_loaded', (event) => {
      this.handlePluginLoaded(event.pluginId, event.plugin)
    })
    
    this.pluginManager.on('plugin_activated', (event) => {
      this.handlePluginActivated(event.pluginId, event.plugin)
    })
    
    this.pluginManager.on('plugin_deactivated', (event) => {
      this.handlePluginDeactivated(event.pluginId, event.plugin)
    })
    
    this.pluginManager.on('plugin_unloaded', (event) => {
      this.handlePluginUnloaded(event.pluginId)
    })
  }

  /**
   * Discover MCP-enabled plugins
   */
  async discoverMCPPlugins() {
    const allPlugins = this.pluginManager.getAllPlugins()
    
    for (const pluginInfo of allPlugins) {
      const { id, manifest } = pluginInfo
      
      if (this.isMCPPlugin(manifest)) {
        try {
          await this.registerMCPPlugin(id, manifest)
          this.logger.info(`Discovered MCP plugin: ${id}`)
        } catch (error) {
          this.logger.warn(`Failed to register MCP plugin ${id}:`, error)
        }
      }
    }
  }

  /**
   * Check if a plugin is MCP-enabled
   */
  isMCPPlugin(manifest) {
    return !!(
      manifest.mcp ||
      manifest.capabilities?.mcp ||
      manifest.contributes?.mcp ||
      Object.values(MCPPluginType).includes(manifest.type)
    )
  }

  /**
   * Register an MCP plugin
   */
  async registerMCPPlugin(pluginId, manifest) {
    if (this.mcpPlugins.has(pluginId)) {
      throw new Error(`MCP plugin already registered: ${pluginId}`)
    }

    const mcpConfig = manifest.mcp || manifest.capabilities?.mcp || {}
    const pluginType = mcpConfig.type || manifest.type || MCPPluginType.SERVER

    // Create MCP plugin wrapper
    const mcpPlugin = new MCPPluginWrapper(pluginId, manifest, mcpConfig, pluginType)
    
    // Store capabilities
    this.mcpCapabilities.set(pluginId, mcpConfig.capabilities || {})
    
    // Register the plugin
    this.mcpPlugins.set(pluginId, mcpPlugin)
    
    this.emit('mcp-plugin-registered', { pluginId, mcpPlugin })
    return mcpPlugin
  }

  /**
   * Load MCP plugin
   */
  async loadMCPPlugin(pluginId) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (!mcpPlugin) {
      throw new Error(`MCP plugin not found: ${pluginId}`)
    }

    if (mcpPlugin.state !== MCPPluginState.DISCOVERED) {
      return mcpPlugin
    }

    try {
      mcpPlugin.setState(MCPPluginState.LOADING)
      
      // Load the actual plugin instance
      const pluginInstance = this.pluginManager.getPlugin(pluginId)
      if (!pluginInstance) {
        await this.pluginManager.loadPlugin(pluginId)
      }
      
      mcpPlugin.setPluginInstance(this.pluginManager.getPlugin(pluginId))
      
      // Set up MCP protocol if needed
      if (mcpPlugin.type === MCPPluginType.SERVER || mcpPlugin.type === MCPPluginType.HYBRID) {
        await this.setupMCPServer(mcpPlugin)
      }
      
      if (mcpPlugin.type === MCPPluginType.CLIENT || mcpPlugin.type === MCPPluginType.HYBRID) {
        await this.setupMCPClient(mcpPlugin)
      }
      
      mcpPlugin.setState(MCPPluginState.LOADED)
      this.emit('mcp-plugin-loaded', { pluginId, mcpPlugin })
      
      return mcpPlugin
      
    } catch (error) {
      mcpPlugin.setState(MCPPluginState.ERROR)
      mcpPlugin.setError(error)
      this.emit('mcp-plugin-error', { pluginId, error })
      throw error
    }
  }

  /**
   * Activate MCP plugin
   */
  async activateMCPPlugin(pluginId) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (!mcpPlugin) {
      throw new Error(`MCP plugin not found: ${pluginId}`)
    }

    if (mcpPlugin.state === MCPPluginState.ACTIVE) {
      return mcpPlugin
    }

    try {
      mcpPlugin.setState(MCPPluginState.INITIALIZING)
      
      // Ensure plugin is loaded
      if (mcpPlugin.state !== MCPPluginState.LOADED) {
        await this.loadMCPPlugin(pluginId)
      }
      
      // Initialize MCP servers
      if (mcpPlugin.mcpServer) {
        await this.initializeMCPServer(mcpPlugin)
      }
      
      // Initialize MCP clients  
      if (mcpPlugin.mcpClient) {
        await this.initializeMCPClient(mcpPlugin)
      }
      
      // Activate the plugin
      if (mcpPlugin.pluginInstance && typeof mcpPlugin.pluginInstance.activate === 'function') {
        await mcpPlugin.pluginInstance.activate(this.createMCPAPI(mcpPlugin))
      }
      
      mcpPlugin.setState(MCPPluginState.ACTIVE)
      this.emit('mcp-plugin-activated', { pluginId, mcpPlugin })
      
      return mcpPlugin
      
    } catch (error) {
      mcpPlugin.setState(MCPPluginState.ERROR)
      mcpPlugin.setError(error)
      this.emit('mcp-plugin-error', { pluginId, error })
      throw error
    }
  }

  /**
   * Deactivate MCP plugin
   */
  async deactivateMCPPlugin(pluginId) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (!mcpPlugin || mcpPlugin.state !== MCPPluginState.ACTIVE) {
      return
    }

    try {
      // Deactivate plugin instance
      if (mcpPlugin.pluginInstance && typeof mcpPlugin.pluginInstance.deactivate === 'function') {
        await mcpPlugin.pluginInstance.deactivate()
      }
      
      // Clean up MCP resources
      await this.cleanupMCPResources(mcpPlugin)
      
      mcpPlugin.setState(MCPPluginState.LOADED)
      this.emit('mcp-plugin-deactivated', { pluginId, mcpPlugin })
      
    } catch (error) {
      this.logger.error(`Error deactivating MCP plugin ${pluginId}:`, error)
      mcpPlugin.setState(MCPPluginState.ERROR)
      mcpPlugin.setError(error)
    }
  }

  /**
   * Set up MCP server for a plugin
   */
  async setupMCPServer(mcpPlugin) {
    const serverId = `${mcpPlugin.pluginId}-server`
    
    // Create MCP protocol instance
    const mcpProtocol = new MCPProtocol(serverId, {
      enableResourceSubscriptions: mcpPlugin.config.enableResourceSubscriptions,
      enableToolExecution: mcpPlugin.config.enableToolExecution,
      enablePromptTemplates: mcpPlugin.config.enablePromptTemplates
    })
    
    // Set up communication channel
    const channel = this.createCommunicationChannel(serverId)
    this.serverChannels.set(serverId, channel)
    
    // Connect protocol to channel
    this.connectProtocolToChannel(mcpProtocol, channel)
    
    mcpPlugin.setMCPServer(mcpProtocol)
    this.mcpServers.set(serverId, mcpProtocol)
    
    this.logger.info(`Set up MCP server for plugin: ${mcpPlugin.pluginId}`)
  }

  /**
   * Set up MCP client for a plugin
   */
  async setupMCPClient(mcpPlugin) {
    const clientId = `${mcpPlugin.pluginId}-client`
    
    // Create MCP protocol instance
    const mcpProtocol = new MCPProtocol(clientId, {
      enableResourceSubscriptions: true,
      enableToolExecution: true,
      enablePromptTemplates: true
    })
    
    // Set up communication channel
    const channel = this.createCommunicationChannel(clientId)
    this.clientChannels.set(clientId, channel)
    
    // Connect protocol to channel
    this.connectProtocolToChannel(mcpProtocol, channel)
    
    mcpPlugin.setMCPClient(mcpProtocol)
    this.mcpClients.set(clientId, mcpProtocol)
    
    this.logger.info(`Set up MCP client for plugin: ${mcpPlugin.pluginId}`)
  }

  /**
   * Initialize MCP server
   */
  async initializeMCPServer(mcpPlugin) {
    const mcpServer = mcpPlugin.mcpServer
    
    // Set up server-specific handlers
    mcpServer.on('resource-registered', (resource) => {
      this.registerGlobalResource(resource, mcpPlugin.pluginId, mcpServer.serverId)
    })
    
    mcpServer.on('tool-registered', (tool) => {
      this.registerGlobalTool(tool, mcpPlugin.pluginId, mcpServer.serverId)
    })
    
    mcpServer.on('prompt-registered', (prompt) => {
      this.registerGlobalPrompt(prompt, mcpPlugin.pluginId, mcpServer.serverId)
    })
    
    // Initialize with server info
    await mcpServer.initialize({
      name: mcpPlugin.manifest.name,
      version: mcpPlugin.manifest.version,
      description: mcpPlugin.manifest.description
    })
    
    this.logger.info(`Initialized MCP server for plugin: ${mcpPlugin.pluginId}`)
  }

  /**
   * Initialize MCP client
   */
  async initializeMCPClient(mcpPlugin) {
    const mcpClient = mcpPlugin.mcpClient
    
    // Initialize with client info
    await mcpClient.initialize({
      name: `${mcpPlugin.manifest.name} Client`,
      version: mcpPlugin.manifest.version
    })
    
    this.logger.info(`Initialized MCP client for plugin: ${mcpPlugin.pluginId}`)
  }

  /**
   * Create MCP API for plugin
   */
  createMCPAPI(mcpPlugin) {
    const api = {}
    
    // Add server API if available
    if (mcpPlugin.mcpServer) {
      api.server = {
        registerResource: (resource) => mcpPlugin.mcpServer.registerResource(resource),
        unregisterResource: (uri) => mcpPlugin.mcpServer.unregisterResource(uri),
        updateResource: (uri, content, metadata) => mcpPlugin.mcpServer.updateResource(uri, content, metadata),
        
        registerTool: (tool) => mcpPlugin.mcpServer.registerTool(tool),
        unregisterTool: (name) => mcpPlugin.mcpServer.unregisterTool(name),
        
        registerPrompt: (prompt) => mcpPlugin.mcpServer.registerPrompt(prompt),
        unregisterPrompt: (name) => mcpPlugin.mcpServer.unregisterPrompt(name),
        
        sendNotification: (method, params) => mcpPlugin.mcpServer.sendNotification(method, params)
      }
    }
    
    // Add client API if available
    if (mcpPlugin.mcpClient) {
      api.client = {
        listResources: () => mcpPlugin.mcpClient.sendRequest(MCPMethod.RESOURCES_LIST),
        readResource: (uri) => mcpPlugin.mcpClient.sendRequest(MCPMethod.RESOURCES_READ, { uri }),
        subscribeToResource: (uri) => mcpPlugin.mcpClient.sendRequest(MCPMethod.RESOURCES_SUBSCRIBE, { uri }),
        
        listTools: () => mcpPlugin.mcpClient.sendRequest(MCPMethod.TOOLS_LIST),
        callTool: (name, args) => mcpPlugin.mcpClient.sendRequest(MCPMethod.TOOLS_CALL, { name, arguments: args }),
        
        listPrompts: () => mcpPlugin.mcpClient.sendRequest(MCPMethod.PROMPTS_LIST),
        getPrompt: (name, args) => mcpPlugin.mcpClient.sendRequest(MCPMethod.PROMPTS_GET, { name, arguments: args })
      }
    }
    
    // Add global resource discovery
    api.global = {
      findResources: (filter) => this.findGlobalResources(filter),
      findTools: (filter) => this.findGlobalTools(filter),
      findPrompts: (filter) => this.findGlobalPrompts(filter)
    }
    
    return api
  }

  /**
   * Create communication channel
   */
  createCommunicationChannel(channelId) {
    // This would create a secure communication channel
    // For now, return a simple message bus
    return new EventEmitter()
  }

  /**
   * Connect MCP protocol to communication channel
   */
  connectProtocolToChannel(protocol, channel) {
    // Forward messages from protocol to channel
    protocol.on('send-message', (message) => {
      channel.emit('message', message)
    })
    
    // Forward messages from channel to protocol
    channel.on('message', (message) => {
      protocol.handleMessage(message)
    })
  }

  /**
   * Register global resource
   */
  registerGlobalResource(resource, pluginId, serverId) {
    this.globalResources.set(resource.uri, {
      resource,
      pluginId,
      serverId,
      timestamp: Date.now()
    })
    
    this.emit('global-resource-registered', { resource, pluginId, serverId })
  }

  /**
   * Register global tool
   */
  registerGlobalTool(tool, pluginId, serverId) {
    this.globalTools.set(tool.name, {
      tool,
      pluginId,
      serverId,
      timestamp: Date.now()
    })
    
    this.emit('global-tool-registered', { tool, pluginId, serverId })
  }

  /**
   * Register global prompt
   */
  registerGlobalPrompt(prompt, pluginId, serverId) {
    this.globalPrompts.set(prompt.name, {
      prompt,
      pluginId,
      serverId,
      timestamp: Date.now()
    })
    
    this.emit('global-prompt-registered', { prompt, pluginId, serverId })
  }

  /**
   * Find global resources
   */
  findGlobalResources(filter = {}) {
    const results = []
    
    for (const [uri, info] of this.globalResources) {
      const { resource } = info
      
      let match = true
      
      if (filter.type && resource.type !== filter.type) {
        match = false
      }
      
      if (filter.mimeType && resource.mimeType !== filter.mimeType) {
        match = false
      }
      
      if (filter.pluginId && info.pluginId !== filter.pluginId) {
        match = false
      }
      
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase()
        if (!resource.name.toLowerCase().includes(searchTerm) &&
            !resource.description.toLowerCase().includes(searchTerm)) {
          match = false
        }
      }
      
      if (match) {
        results.push(info)
      }
    }
    
    return results
  }

  /**
   * Find global tools
   */
  findGlobalTools(filter = {}) {
    const results = []
    
    for (const [name, info] of this.globalTools) {
      const { tool } = info
      
      let match = true
      
      if (filter.pluginId && info.pluginId !== filter.pluginId) {
        match = false
      }
      
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase()
        if (!tool.name.toLowerCase().includes(searchTerm) &&
            !tool.description.toLowerCase().includes(searchTerm)) {
          match = false
        }
      }
      
      if (match) {
        results.push(info)
      }
    }
    
    return results
  }

  /**
   * Find global prompts
   */
  findGlobalPrompts(filter = {}) {
    const results = []
    
    for (const [name, info] of this.globalPrompts) {
      const { prompt } = info
      
      let match = true
      
      if (filter.pluginId && info.pluginId !== filter.pluginId) {
        match = false
      }
      
      if (filter.search) {
        const searchTerm = filter.search.toLowerCase()
        if (!prompt.name.toLowerCase().includes(searchTerm) &&
            !prompt.description.toLowerCase().includes(searchTerm)) {
          match = false
        }
      }
      
      if (match) {
        results.push(info)
      }
    }
    
    return results
  }

  /**
   * Clean up MCP resources for a plugin
   */
  async cleanupMCPResources(mcpPlugin) {
    const pluginId = mcpPlugin.pluginId
    
    // Remove global resources
    for (const [uri, info] of this.globalResources) {
      if (info.pluginId === pluginId) {
        this.globalResources.delete(uri)
      }
    }
    
    // Remove global tools
    for (const [name, info] of this.globalTools) {
      if (info.pluginId === pluginId) {
        this.globalTools.delete(name)
      }
    }
    
    // Remove global prompts
    for (const [name, info] of this.globalPrompts) {
      if (info.pluginId === pluginId) {
        this.globalPrompts.delete(name)
      }
    }
    
    // Dispose protocol instances
    if (mcpPlugin.mcpServer) {
      mcpPlugin.mcpServer.dispose()
    }
    
    if (mcpPlugin.mcpClient) {
      mcpPlugin.mcpClient.dispose()
    }
  }

  // === EVENT HANDLERS ===

  /**
   * Handle regular plugin loaded
   */
  async handlePluginLoaded(pluginId, plugin) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (mcpPlugin) {
      mcpPlugin.setPluginInstance(plugin)
      if (mcpPlugin.state === MCPPluginState.DISCOVERED) {
        await this.loadMCPPlugin(pluginId)
      }
    }
  }

  /**
   * Handle regular plugin activated
   */
  async handlePluginActivated(pluginId, plugin) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (mcpPlugin && mcpPlugin.state === MCPPluginState.LOADED) {
      await this.activateMCPPlugin(pluginId)
    }
  }

  /**
   * Handle regular plugin deactivated
   */
  async handlePluginDeactivated(pluginId, plugin) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (mcpPlugin && mcpPlugin.state === MCPPluginState.ACTIVE) {
      await this.deactivateMCPPlugin(pluginId)
    }
  }

  /**
   * Handle regular plugin unloaded
   */
  async handlePluginUnloaded(pluginId) {
    const mcpPlugin = this.mcpPlugins.get(pluginId)
    if (mcpPlugin) {
      await this.cleanupMCPResources(mcpPlugin)
      mcpPlugin.setState(MCPPluginState.DISPOSED)
    }
  }

  /**
   * Handle MCP plugin events
   */
  handleMCPPluginLoaded(event) {
    this.logger.info(`MCP plugin loaded: ${event.pluginId}`)
  }

  handleMCPPluginActivated(event) {
    this.logger.info(`MCP plugin activated: ${event.pluginId}`)
  }

  handleMCPPluginDeactivated(event) {
    this.logger.info(`MCP plugin deactivated: ${event.pluginId}`)
  }

  handleMCPPluginError(event) {
    this.logger.error(`MCP plugin error (${event.pluginId}):`, event.error)
  }

  /**
   * Get MCP plugin by ID
   */
  getMCPPlugin(pluginId) {
    return this.mcpPlugins.get(pluginId)
  }

  /**
   * Get all MCP plugins
   */
  getAllMCPPlugins() {
    return Array.from(this.mcpPlugins.values())
  }

  /**
   * Get MCP server by ID
   */
  getMCPServer(serverId) {
    return this.mcpServers.get(serverId)
  }

  /**
   * Get MCP client by ID
   */
  getMCPClient(clientId) {
    return this.mcpClients.get(clientId)
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      mcpPlugins: this.mcpPlugins.size,
      mcpServers: this.mcpServers.size,
      mcpClients: this.mcpClients.size,
      globalResources: this.globalResources.size,
      globalTools: this.globalTools.size,
      globalPrompts: this.globalPrompts.size,
      states: this.getPluginStates()
    }
  }

  /**
   * Get plugin states breakdown
   */
  getPluginStates() {
    const states = {}
    
    for (const mcpPlugin of this.mcpPlugins.values()) {
      states[mcpPlugin.state] = (states[mcpPlugin.state] || 0) + 1
    }
    
    return states
  }

  /**
   * Shutdown and cleanup
   */
  async shutdown() {
    for (const mcpPlugin of this.mcpPlugins.values()) {
      try {
        await this.deactivateMCPPlugin(mcpPlugin.pluginId)
      } catch (error) {
        this.logger.error(`Error shutting down MCP plugin ${mcpPlugin.pluginId}:`, error)
      }
    }
    
    this.mcpPlugins.clear()
    this.mcpServers.clear()
    this.mcpClients.clear()
    this.globalResources.clear()
    this.globalTools.clear()
    this.globalPrompts.clear()
    
    this.emit('shutdown')
  }
}

/**
 * MCP Plugin Wrapper - Wraps regular plugins with MCP capabilities
 */
export class MCPPluginWrapper {
  constructor(pluginId, manifest, mcpConfig, type) {
    this.pluginId = pluginId
    this.manifest = manifest
    this.config = mcpConfig
    this.type = type
    
    this.state = MCPPluginState.DISCOVERED
    this.pluginInstance = null
    this.mcpServer = null
    this.mcpClient = null
    this.error = null
    
    this.capabilities = mcpConfig.capabilities || {}
    this.metadata = {
      registeredAt: Date.now(),
      lastStateChange: Date.now()
    }
  }

  /**
   * Set plugin state
   */
  setState(newState) {
    const oldState = this.state
    this.state = newState
    this.metadata.lastStateChange = Date.now()
    
    if (newState === MCPPluginState.ERROR) {
      this.metadata.errorTimestamp = Date.now()
    }
  }

  /**
   * Set plugin instance
   */
  setPluginInstance(instance) {
    this.pluginInstance = instance
  }

  /**
   * Set MCP server
   */
  setMCPServer(server) {
    this.mcpServer = server
  }

  /**
   * Set MCP client
   */
  setMCPClient(client) {
    this.mcpClient = client
  }

  /**
   * Set error
   */
  setError(error) {
    this.error = error
    this.setState(MCPPluginState.ERROR)
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      pluginId: this.pluginId,
      type: this.type,
      state: this.state,
      capabilities: this.capabilities,
      metadata: this.metadata,
      error: this.error?.message,
      hasServer: !!this.mcpServer,
      hasClient: !!this.mcpClient
    }
  }
}

export default MCPPluginManager