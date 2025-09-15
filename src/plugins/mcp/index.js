/**
 * MCP (Model Context Protocol) Module
 * 
 * Main entry point for the MCP plugin system integration
 * Exports all MCP components and provides a unified API
 */

// Core MCP Protocol
export { 
  MCPProtocol,
  MCPMessageType,
  MCPMethod,
  MCPErrorCode,
  MCPResourceType,
  MCPToolType,
  MCP_PROTOCOL_VERSION,
  MCPResourceBuilder,
  MCPToolBuilder,
  MCPPromptBuilder
} from './MCPProtocol.js'

// MCP Plugin Manager
export { 
  MCPPluginManager,
  MCPPluginWrapper,
  MCPPluginType,
  MCPPluginState
} from './MCPPluginManager.js'

// MCP Server Host
export { 
  MCPServerHost,
  MCPServerInstance,
  MCPServerType,
  MCPServerStatus
} from './MCPServerHost.js'

// MCP Client API
export { 
  MCPClient,
  MCPClientFactory,
  MCPResourceHelper,
  MCPClientState
} from './MCPClient.js'

// Type definitions (for runtime usage)
export * as MCPTypes from './types/mcp.d.ts'

/**
 * MCP Integration Helper
 * 
 * Provides high-level integration functions for setting up MCP in Lokus
 */
export class MCPIntegration {
  constructor(pluginManager, securityManager) {
    this.pluginManager = pluginManager
    this.securityManager = securityManager
    
    // Initialize MCP components
    this.mcpPluginManager = null
    this.mcpServerHost = null
    this.mcpClientFactory = null
    
    this.isInitialized = false
    this.logger = console
  }

  /**
   * Initialize MCP integration
   */
  async initialize(options = {}) {
    if (this.isInitialized) {
      return
    }

    try {
      // Initialize MCP Plugin Manager
      this.mcpPluginManager = new MCPPluginManager(this.pluginManager, this.securityManager)
      await this.mcpPluginManager.initialize()
      
      // Initialize MCP Server Host
      this.mcpServerHost = new MCPServerHost(this.securityManager, options.serverHost)
      await this.mcpServerHost.initialize()
      
      // Initialize MCP Client Factory
      this.mcpClientFactory = new MCPClientFactory()
      
      // Set up integration event handlers
      this.setupIntegrationHandlers()
      
      this.isInitialized = true
      this.logger.info('MCP Integration initialized successfully')
      
    } catch (error) {
      this.logger.error('Failed to initialize MCP Integration:', error)
      throw error
    }
  }

  /**
   * Set up integration event handlers
   */
  setupIntegrationHandlers() {
    // Forward MCP plugin manager events
    this.mcpPluginManager.on('mcp-plugin-activated', (event) => {
      this.handleMCPPluginActivated(event)
    })
    
    this.mcpPluginManager.on('global-resource-registered', (event) => {
      this.logger.info(`Global MCP resource registered: ${event.resource.name} from plugin ${event.pluginId}`)
    })
    
    this.mcpPluginManager.on('global-tool-registered', (event) => {
      this.logger.info(`Global MCP tool registered: ${event.tool.name} from plugin ${event.pluginId}`)
    })
    
    // Forward server host events
    this.mcpServerHost.on('server-started', (event) => {
      this.logger.info(`MCP server started: ${event.serverId}`)
    })
    
    this.mcpServerHost.on('server-error', (event) => {
      this.logger.error(`MCP server error (${event.serverId}):`, event.error)
    })
  }

  /**
   * Handle MCP plugin activation
   */
  async handleMCPPluginActivated(event) {
    const { pluginId, mcpPlugin } = event
    
    try {
      // If plugin has server configuration, start MCP server
      if (mcpPlugin.type === MCPPluginType.SERVER || mcpPlugin.type === MCPPluginType.HYBRID) {
        const serverConfig = {
          name: mcpPlugin.manifest.name,
          version: mcpPlugin.manifest.version,
          type: MCPServerType.INTERNAL,
          manifest: mcpPlugin.manifest
        }
        
        await this.mcpServerHost.startServer(`${pluginId}-server`, serverConfig)
      }
      
    } catch (error) {
      this.logger.error(`Failed to handle MCP plugin activation for ${pluginId}:`, error)
    }
  }

  /**
   * Create MCP client
   */
  createClient(clientId, options = {}) {
    if (!this.isInitialized) {
      throw new Error('MCP Integration not initialized')
    }
    
    return this.mcpClientFactory.createClient(clientId, options)
  }

  /**
   * Get MCP plugin by ID
   */
  getMCPPlugin(pluginId) {
    return this.mcpPluginManager?.getMCPPlugin(pluginId)
  }

  /**
   * Get MCP server by ID
   */
  getMCPServer(serverId) {
    return this.mcpServerHost?.getServer(serverId)
  }

  /**
   * Get MCP client by ID
   */
  getMCPClient(clientId) {
    return this.mcpClientFactory?.getClient(clientId)
  }

  /**
   * Find global resources
   */
  findGlobalResources(filter = {}) {
    return this.mcpPluginManager?.findGlobalResources(filter) || []
  }

  /**
   * Find global tools
   */
  findGlobalTools(filter = {}) {
    return this.mcpPluginManager?.findGlobalTools(filter) || []
  }

  /**
   * Find global prompts
   */
  findGlobalPrompts(filter = {}) {
    return this.mcpPluginManager?.findGlobalPrompts(filter) || []
  }

  /**
   * Get comprehensive MCP statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      pluginManager: this.mcpPluginManager?.getStats(),
      serverHost: this.mcpServerHost?.getStats(),
      clients: this.mcpClientFactory?.getAllClients().length || 0
    }
  }

  /**
   * Shutdown MCP integration
   */
  async shutdown() {
    if (!this.isInitialized) {
      return
    }

    try {
      // Shutdown client factory
      if (this.mcpClientFactory) {
        await this.mcpClientFactory.disconnectAll()
      }
      
      // Shutdown server host
      if (this.mcpServerHost) {
        await this.mcpServerHost.shutdown()
      }
      
      // Shutdown plugin manager
      if (this.mcpPluginManager) {
        await this.mcpPluginManager.shutdown()
      }
      
      this.isInitialized = false
      this.logger.info('MCP Integration shut down')
      
    } catch (error) {
      this.logger.error('Error during MCP Integration shutdown:', error)
    }
  }
}

/**
 * Default MCP Integration instance
 */
let defaultMCPIntegration = null

/**
 * Initialize default MCP integration
 */
export async function initializeMCP(pluginManager, securityManager, options = {}) {
  if (defaultMCPIntegration) {
    throw new Error('MCP Integration already initialized')
  }
  
  defaultMCPIntegration = new MCPIntegration(pluginManager, securityManager)
  await defaultMCPIntegration.initialize(options)
  
  return defaultMCPIntegration
}

/**
 * Get default MCP integration
 */
export function getMCPIntegration() {
  if (!defaultMCPIntegration) {
    throw new Error('MCP Integration not initialized. Call initializeMCP() first.')
  }
  
  return defaultMCPIntegration
}

/**
 * Shutdown default MCP integration
 */
export async function shutdownMCP() {
  if (defaultMCPIntegration) {
    await defaultMCPIntegration.shutdown()
    defaultMCPIntegration = null
  }
}

/**
 * MCP Plugin Developer API
 * 
 * Simplified API for plugin developers to create MCP-enabled plugins
 */
export class MCPPluginAPI {
  constructor(pluginId, mcpIntegration) {
    this.pluginId = pluginId
    this.mcpIntegration = mcpIntegration
    this.resources = new Map()
    this.tools = new Map()
    this.prompts = new Map()
  }

  /**
   * Register a resource
   */
  registerResource(resource) {
    const mcpPlugin = this.mcpIntegration.getMCPPlugin(this.pluginId)
    if (mcpPlugin?.mcpServer) {
      const registeredResource = mcpPlugin.mcpServer.registerResource(resource)
      this.resources.set(resource.uri, registeredResource)
      return registeredResource
    }
    throw new Error('Plugin does not have an active MCP server')
  }

  /**
   * Register a tool
   */
  registerTool(tool) {
    const mcpPlugin = this.mcpIntegration.getMCPPlugin(this.pluginId)
    if (mcpPlugin?.mcpServer) {
      const registeredTool = mcpPlugin.mcpServer.registerTool(tool)
      this.tools.set(tool.name, registeredTool)
      return registeredTool
    }
    throw new Error('Plugin does not have an active MCP server')
  }

  /**
   * Register a prompt template
   */
  registerPrompt(prompt) {
    const mcpPlugin = this.mcpIntegration.getMCPPlugin(this.pluginId)
    if (mcpPlugin?.mcpServer) {
      const registeredPrompt = mcpPlugin.mcpServer.registerPrompt(prompt)
      this.prompts.set(prompt.name, registeredPrompt)
      return registeredPrompt
    }
    throw new Error('Plugin does not have an active MCP server')
  }

  /**
   * Create MCP client
   */
  createClient(options = {}) {
    const clientId = `${this.pluginId}-client`
    return this.mcpIntegration.createClient(clientId, options)
  }

  /**
   * Find resources across all plugins
   */
  findResources(filter = {}) {
    return this.mcpIntegration.findGlobalResources(filter)
  }

  /**
   * Find tools across all plugins
   */
  findTools(filter = {}) {
    return this.mcpIntegration.findGlobalTools(filter)
  }

  /**
   * Find prompts across all plugins
   */
  findPrompts(filter = {}) {
    return this.mcpIntegration.findGlobalPrompts(filter)
  }

  /**
   * Clean up plugin resources
   */
  dispose() {
    // Resources, tools, and prompts are automatically cleaned up
    // when the plugin is deactivated through the MCP Plugin Manager
    this.resources.clear()
    this.tools.clear()
    this.prompts.clear()
  }
}

/**
 * Create MCP Plugin API for a specific plugin
 */
export function createMCPPluginAPI(pluginId, mcpIntegration = null) {
  const integration = mcpIntegration || getMCPIntegration()
  return new MCPPluginAPI(pluginId, integration)
}

// Re-export types for convenience
export { 
  MCPPluginType, 
  MCPPluginState, 
  MCPServerType, 
  MCPServerStatus, 
  MCPClientState,
  MCPResourceType,
  MCPToolType
} from './types/mcp.d.ts'

export default {
  // Core classes
  MCPProtocol,
  MCPPluginManager,
  MCPServerHost,
  MCPClient,
  MCPIntegration,
  MCPPluginAPI,
  
  // Factory classes
  MCPClientFactory,
  MCPResourceHelper,
  
  // Builder classes
  MCPResourceBuilder,
  MCPToolBuilder,
  MCPPromptBuilder,
  
  // Utility functions
  initializeMCP,
  getMCPIntegration,
  shutdownMCP,
  createMCPPluginAPI,
  
  // Constants
  MCP_PROTOCOL_VERSION,
  MCPMessageType,
  MCPMethod,
  MCPErrorCode,
  MCPResourceType,
  MCPToolType,
  MCPPluginType,
  MCPPluginState,
  MCPServerType,
  MCPServerStatus,
  MCPClientState
}