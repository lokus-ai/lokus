/**
 * MCP HTTP Server Request Handlers
 * 
 * JSON-RPC 2.0 compliant request handlers for MCP protocol methods
 * Bridges HTTP requests to the existing MCP plugin system
 */

import { MCPMethod, MCPErrorCode, MCP_PROTOCOL_VERSION } from '../plugins/mcp/MCPProtocol.js'
import { getMCPIntegration } from '../plugins/mcp/index.js'

/**
 * Base MCP Request Handler
 * Handles common JSON-RPC 2.0 processing and error handling
 */
export class MCPRequestHandler {
  constructor(mcpIntegration = null) {
    this.mcpIntegration = mcpIntegration
    this.sessions = new Map() // sessionId -> session data
    this.clients = new Map() // clientId -> client info
    this.logger = console
  }

  /**
   * Initialize the handler with MCP integration
   */
  async initialize() {
    if (!this.mcpIntegration) {
      try {
        this.mcpIntegration = getMCPIntegration()
      } catch (error) {
        this.logger.warn('[MCP-Handler] MCP integration not available, running in standalone mode')
        this.mcpIntegration = null
      }
    }
    this.logger.info('[MCP-Handler] Initialized with MCP integration')
  }

  /**
   * Handle incoming JSON-RPC request
   */
  async handleRequest(req, res) {
    const { body } = req
    const { id, method, params } = body

    try {
      // Get or create session
      const sessionId = this.getSessionId(req)
      const session = await this.getOrCreateSession(sessionId, req)

      // Route to specific method handler
      const result = await this.routeMethod(method, params, session, req)

      // Send success response
      res.json({
        jsonrpc: '2.0',
        result,
        id
      })

    } catch (error) {
      this.logger.error(`[MCP-Handler] Error handling ${method}:`, error)
      
      // Send error response
      res.status(error.statusCode || 500).json({
        jsonrpc: '2.0',
        error: {
          code: error.code || MCPErrorCode.INTERNAL_ERROR,
          message: error.message || 'Internal error',
          ...(error.data && { data: error.data })
        },
        id
      })
    }
  }

  /**
   * Route method to appropriate handler
   */
  async routeMethod(method, params, session, req) {
    switch (method) {
      case MCPMethod.INITIALIZE:
        return this.handleInitialize(params, session, req)
      
      case MCPMethod.RESOURCES_LIST:
        return this.handleResourcesList(params, session)
      
      case MCPMethod.RESOURCES_READ:
        return this.handleResourcesRead(params, session)
      
      case MCPMethod.RESOURCES_SUBSCRIBE:
        return this.handleResourcesSubscribe(params, session)
      
      case MCPMethod.RESOURCES_UNSUBSCRIBE:
        return this.handleResourcesUnsubscribe(params, session)
      
      case MCPMethod.TOOLS_LIST:
        return this.handleToolsList(params, session)
      
      case MCPMethod.TOOLS_CALL:
        return this.handleToolsCall(params, session)
      
      case MCPMethod.PROMPTS_LIST:
        return this.handlePromptsList(params, session)
      
      case MCPMethod.PROMPTS_GET:
        return this.handlePromptsGet(params, session)
      
      case MCPMethod.LOGGING_SET_LEVEL:
        return this.handleLoggingSetLevel(params, session)
      
      case MCPMethod.COMPLETION_COMPLETE:
        return this.handleCompletionComplete(params, session)
      
      default:
        throw this.createError(MCPErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`)
    }
  }

  /**
   * Get session ID from request
   */
  getSessionId(req) {
    return req.get('X-MCP-Session-ID') || 
           req.get('X-Forwarded-For') || 
           req.connection.remoteAddress || 
           'default'
  }

  /**
   * Get or create session
   */
  async getOrCreateSession(sessionId, req) {
    if (!this.sessions.has(sessionId)) {
      const session = {
        id: sessionId,
        created: Date.now(),
        lastActivity: Date.now(),
        isInitialized: false,
        clientInfo: null,
        capabilities: null,
        subscriptions: new Set(),
        ip: req.ip,
        userAgent: req.get('User-Agent')
      }
      this.sessions.set(sessionId, session)
      this.logger.info(`[MCP-Handler] Created new session: ${sessionId}`)
    }

    const session = this.sessions.get(sessionId)
    session.lastActivity = Date.now()
    return session
  }

  /**
   * Clean up expired sessions
   */
  cleanupSessions(maxAge = 30 * 60 * 1000) { // 30 minutes
    const now = Date.now()
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > maxAge) {
        this.sessions.delete(sessionId)
        this.logger.info(`[MCP-Handler] Cleaned up expired session: ${sessionId}`)
      }
    }
  }

  // === MCP METHOD HANDLERS ===

  /**
   * Handle initialize method
   */
  async handleInitialize(params, session, req) {
    const { protocolVersion, capabilities, clientInfo } = params

    // Validate protocol version
    if (protocolVersion !== MCP_PROTOCOL_VERSION) {
      throw this.createError(
        MCPErrorCode.INVALID_REQUEST,
        `Unsupported protocol version: ${protocolVersion}. Expected: ${MCP_PROTOCOL_VERSION}`
      )
    }

    // Update session
    session.isInitialized = true
    session.clientInfo = clientInfo
    session.capabilities = capabilities

    // Store client info
    const clientId = `${session.id}-${Date.now()}`
    this.clients.set(clientId, {
      id: clientId,
      sessionId: session.id,
      info: clientInfo,
      capabilities,
      connectedAt: new Date().toISOString()
    })

    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
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
      serverInfo: {
        name: 'Lokus MCP HTTP Server',
        version: '1.0.0',
        description: 'HTTP bridge for Lokus MCP plugin system'
      }
    }
  }

  /**
   * Handle resources list method
   */
  async handleResourcesList(params, session) {
    this.requireInitialized(session)
    
    const { cursor } = params || {}
    
    // Get resources from MCP integration
    const allResources = this.mcpIntegration ? this.mcpIntegration.findGlobalResources() : []
    
    // Convert to MCP format and apply pagination
    const resources = allResources.map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType || 'text/plain',
      type: resource.type,
      lastModified: resource.lastModified || new Date().toISOString()
    }))

    // Simple pagination
    let paginatedResources = resources
    let nextCursor = null

    if (cursor) {
      const startIndex = parseInt(cursor) || 0
      const pageSize = 100
      paginatedResources = resources.slice(startIndex, startIndex + pageSize)
      
      if (startIndex + pageSize < resources.length) {
        nextCursor = (startIndex + pageSize).toString()
      }
    }

    return {
      resources: paginatedResources,
      ...(nextCursor && { nextCursor })
    }
  }

  /**
   * Handle resources read method
   */
  async handleResourcesRead(params, session) {
    this.requireInitialized(session)
    
    const { uri } = params
    if (!uri) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'URI parameter is required')
    }

    // Find resource through MCP integration
    const resources = this.mcpIntegration ? this.mcpIntegration.findGlobalResources({ uri }) : []
    const resource = resources.find(r => r.uri === uri)

    if (!resource) {
      throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
    }

    return {
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType || 'text/plain',
        text: resource.content || '',
        ...(resource.blob && { blob: resource.blob })
      }]
    }
  }

  /**
   * Handle resources subscribe method
   */
  async handleResourcesSubscribe(params, session) {
    this.requireInitialized(session)
    
    const { uri } = params
    if (!uri) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'URI parameter is required')
    }

    // Check if resource exists
    const resources = this.mcpIntegration ? this.mcpIntegration.findGlobalResources({ uri }) : []
    if (!resources.find(r => r.uri === uri)) {
      throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
    }

    // Add to session subscriptions
    session.subscriptions.add(uri)

    return { subscribed: true }
  }

  /**
   * Handle resources unsubscribe method
   */
  async handleResourcesUnsubscribe(params, session) {
    this.requireInitialized(session)
    
    const { uri } = params
    if (!uri) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'URI parameter is required')
    }

    // Remove from session subscriptions
    session.subscriptions.delete(uri)

    return { unsubscribed: true }
  }

  /**
   * Handle tools list method
   */
  async handleToolsList(params, session) {
    this.requireInitialized(session)
    
    const { cursor } = params || {}
    
    // Get tools from MCP integration
    const allTools = this.mcpIntegration ? this.mcpIntegration.findGlobalTools() : []
    
    // Convert to MCP format
    const tools = allTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema || { type: 'object', properties: {} }
    }))

    // Apply pagination
    let paginatedTools = tools
    let nextCursor = null

    if (cursor) {
      const startIndex = parseInt(cursor) || 0
      const pageSize = 100
      paginatedTools = tools.slice(startIndex, startIndex + pageSize)
      
      if (startIndex + pageSize < tools.length) {
        nextCursor = (startIndex + pageSize).toString()
      }
    }

    return {
      tools: paginatedTools,
      ...(nextCursor && { nextCursor })
    }
  }

  /**
   * Handle tools call method
   */
  async handleToolsCall(params, session) {
    this.requireInitialized(session)
    
    const { name, arguments: args } = params
    if (!name) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Tool name is required')
    }

    try {
      // Find tool through MCP integration
      const tools = this.mcpIntegration ? this.mcpIntegration.findGlobalTools({ name }) : []
      const tool = tools.find(t => t.name === name)

      if (!tool) {
        throw this.createError(MCPErrorCode.TOOL_NOT_FOUND, `Tool not found: ${name}`)
      }

      // Execute tool
      const result = await this.executeTool(tool, args || {})

      return {
        content: [
          {
            type: 'text',
            text: typeof result === 'string' ? result : JSON.stringify(result)
          }
        ],
        isError: false
      }

    } catch (error) {
      this.logger.error(`[MCP-Handler] Tool execution error for ${name}:`, error)
      
      return {
        content: [
          {
            type: 'text',
            text: error.message || 'Tool execution failed'
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Handle prompts list method
   */
  async handlePromptsList(params, session) {
    this.requireInitialized(session)
    
    // Get prompts from MCP integration
    const allPrompts = this.mcpIntegration ? this.mcpIntegration.findGlobalPrompts() : []
    
    // Convert to MCP format
    const prompts = allPrompts.map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments || []
    }))

    return { prompts }
  }

  /**
   * Handle prompts get method
   */
  async handlePromptsGet(params, session) {
    this.requireInitialized(session)
    
    const { name, arguments: args } = params
    if (!name) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Prompt name is required')
    }

    // Find prompt through MCP integration
    const prompts = this.mcpIntegration ? this.mcpIntegration.findGlobalPrompts({ name }) : []
    const prompt = prompts.find(p => p.name === name)

    if (!prompt) {
      throw this.createError(MCPErrorCode.PROMPT_NOT_FOUND, `Prompt not found: ${name}`)
    }

    try {
      // Render prompt template
      const messages = this.renderPromptTemplate(prompt, args || {})

      return {
        description: prompt.description,
        messages
      }

    } catch (error) {
      throw this.createError(
        MCPErrorCode.PROMPT_INVALID_ARGUMENTS,
        `Failed to render prompt: ${error.message}`
      )
    }
  }

  /**
   * Handle logging set level method
   */
  async handleLoggingSetLevel(params, session) {
    this.requireInitialized(session)
    
    const { level } = params
    const validLevels = ['debug', 'info', 'warn', 'error']
    
    if (!validLevels.includes(level)) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, `Invalid log level: ${level}`)
    }

    // Update logging level (this would integrate with actual logging system)
    this.logger.info(`[MCP-Handler] Log level set to: ${level}`)

    return { success: true }
  }

  /**
   * Handle completion complete method
   */
  async handleCompletionComplete(params, session) {
    this.requireInitialized(session)
    
    const { ref, argument } = params

    // This would integrate with AI completion providers
    // For now, return empty completion
    return {
      completion: {
        values: [],
        total: 0,
        hasMore: false
      }
    }
  }

  // === UTILITY METHODS ===

  /**
   * Require session to be initialized
   */
  requireInitialized(session) {
    if (!session.isInitialized) {
      throw this.createError(
        MCPErrorCode.INVALID_REQUEST,
        'Session not initialized. Call initialize method first.'
      )
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(tool, args) {
    if (typeof tool.execute === 'function') {
      return await tool.execute(args)
    } else if (tool.handler && typeof tool.handler === 'function') {
      return await tool.handler(args)
    } else {
      throw new Error('Tool execution function not available')
    }
  }

  /**
   * Render prompt template
   */
  renderPromptTemplate(prompt, args) {
    let rendered = prompt.template

    // Simple template variable replacement
    for (const [key, value] of Object.entries(args)) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
      rendered = rendered.replace(regex, String(value))
    }

    return [
      {
        role: 'user',
        content: {
          type: 'text',
          text: rendered
        }
      }
    ]
  }

  /**
   * Create MCP error
   */
  createError(code, message, data = null) {
    const error = new Error(message)
    error.code = code
    error.data = data
    return error
  }

  /**
   * Get handler statistics
   */
  getStats() {
    return {
      sessions: this.sessions.size,
      clients: this.clients.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isInitialized).length,
      totalSubscriptions: Array.from(this.sessions.values())
        .reduce((total, session) => total + session.subscriptions.size, 0)
    }
  }

  /**
   * Broadcast notification to subscribed sessions
   */
  broadcastNotification(method, params, resourceUri = null) {
    for (const session of this.sessions.values()) {
      if (!session.isInitialized) continue
      
      // Check if session is subscribed to this resource
      if (resourceUri && !session.subscriptions.has(resourceUri)) continue
      
      // In a real implementation, this would send the notification
      // through WebSocket or Server-Sent Events
      this.logger.debug(`[MCP-Handler] Broadcasting ${method} to session ${session.id}`)
    }
  }

  /**
   * Cleanup handler resources
   */
  dispose() {
    this.sessions.clear()
    this.clients.clear()
    this.logger.info('[MCP-Handler] Handler disposed')
  }
}

/**
 * Create and configure MCP request handler
 */
export const createMCPHandler = async (mcpIntegration = null) => {
  const handler = new MCPRequestHandler(mcpIntegration)
  await handler.initialize()
  return handler
}

export default MCPRequestHandler