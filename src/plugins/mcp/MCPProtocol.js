/**
 * MCP (Model Context Protocol) Implementation
 * 
 * JSON-RPC 2.0 based protocol for AI-powered plugin communication
 * Supports resource discovery, tool execution, and prompt templates
 * 
 * Based on the MCP specification for standardized AI assistant integration
 */

import { EventEmitter } from '../../utils/EventEmitter.js'
import { PluginCommunicationProtocol, ErrorCode } from '../communication/PluginCommunicationProtocol.js'

/**
 * MCP Protocol Version
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05'

/**
 * MCP Message Types (extends JSON-RPC 2.0)
 */
export const MCPMessageType = {
  // Standard JSON-RPC 2.0
  REQUEST: 'request',
  RESPONSE: 'response',
  NOTIFICATION: 'notification',
  
  // MCP-specific
  RESOURCE_UPDATED: 'notifications/resources/updated',
  RESOURCE_LIST_CHANGED: 'notifications/resources/list_changed',
  TOOL_LIST_CHANGED: 'notifications/tools/list_changed',
  PROMPT_LIST_CHANGED: 'notifications/prompts/list_changed',
  LOGGING: 'notifications/logging/message'
}

/**
 * MCP Standard Methods
 */
export const MCPMethod = {
  // Initialization
  INITIALIZE: 'initialize',
  
  // Resources
  RESOURCES_LIST: 'resources/list',
  RESOURCES_READ: 'resources/read',
  RESOURCES_SUBSCRIBE: 'resources/subscribe',
  RESOURCES_UNSUBSCRIBE: 'resources/unsubscribe',
  
  // Tools
  TOOLS_LIST: 'tools/list',
  TOOLS_CALL: 'tools/call',
  
  // Prompts
  PROMPTS_LIST: 'prompts/list',
  PROMPTS_GET: 'prompts/get',
  
  // Logging
  LOGGING_SET_LEVEL: 'logging/setLevel',
  
  // Completion (for AI features)
  COMPLETION_COMPLETE: 'completion/complete'
}

/**
 * MCP Error Codes (extends JSON-RPC 2.0)
 */
export const MCPErrorCode = {
  ...ErrorCode,
  
  // MCP-specific errors
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Resource errors
  RESOURCE_NOT_FOUND: -32001,
  RESOURCE_ACCESS_DENIED: -32002,
  RESOURCE_UNAVAILABLE: -32003,
  
  // Tool errors
  TOOL_NOT_FOUND: -32011,
  TOOL_EXECUTION_ERROR: -32012,
  TOOL_INVALID_INPUT: -32013,
  
  // Prompt errors
  PROMPT_NOT_FOUND: -32021,
  PROMPT_INVALID_ARGUMENTS: -32022
}

/**
 * MCP Resource Types
 */
export const MCPResourceType = {
  FILE: 'file',
  DIRECTORY: 'directory',
  DATABASE: 'database',
  API: 'api',
  MEMORY: 'memory',
  WEB: 'web',
  CUSTOM: 'custom'
}

/**
 * MCP Tool Types
 */
export const MCPToolType = {
  FUNCTION: 'function',
  COMMAND: 'command',
  API_CALL: 'api_call',
  SCRIPT: 'script',
  QUERY: 'query'
}

/**
 * Core MCP Protocol Implementation
 */
export class MCPProtocol extends EventEmitter {
  constructor(serverId, options = {}) {
    super()
    
    this.serverId = serverId
    this.protocolVersion = MCP_PROTOCOL_VERSION
    this.isInitialized = false
    
    // Configuration
    this.options = {
      enableResourceSubscriptions: true,
      enableToolExecution: true,
      enablePromptTemplates: true,
      enableLogging: true,
      maxConcurrentRequests: 50,
      requestTimeout: 30000,
      ...options
    }
    
    // State management
    this.resources = new Map() // uri -> resource
    this.tools = new Map() // name -> tool
    this.prompts = new Map() // name -> prompt
    this.subscriptions = new Map() // uri -> Set of subscribers
    
    // Protocol state
    this.capabilities = {
      resources: {
        subscribe: this.options.enableResourceSubscriptions,
        listChanged: true
      },
      tools: {
        listChanged: true
      },
      prompts: {
        listChanged: true
      },
      logging: {
        enabled: this.options.enableLogging
      }
    }
    
    // Communication layer
    this.communicationProtocol = null
    this.setupCommunicationLayer()
    
    // Request tracking
    this.pendingRequests = new Map()
    this.nextRequestId = 1
    
    // Logging
    this.logLevel = 'info'
    this.logger = console
  }

  /**
   * Set up the communication layer
   */
  setupCommunicationLayer() {
    this.communicationProtocol = new PluginCommunicationProtocol(
      this.serverId,
      null // No security manager for MCP layer
    )
    
    // Register MCP method handlers
    this.registerMCPHandlers()
    
    // Forward events
    this.communicationProtocol.on('send-message', (message) => {
      this.emit('send-message', message)
    })
    
    this.communicationProtocol.on('protocol-error', (error) => {
      this.emit('protocol-error', error)
    })
  }

  /**
   * Register MCP-specific method handlers
   */
  registerMCPHandlers() {
    // Initialization
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.INITIALIZE, 
      this.handleInitialize.bind(this)
    )
    
    // Resources
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.RESOURCES_LIST, 
      this.handleResourcesList.bind(this)
    )
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.RESOURCES_READ, 
      this.handleResourcesRead.bind(this)
    )
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.RESOURCES_SUBSCRIBE, 
      this.handleResourcesSubscribe.bind(this)
    )
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.RESOURCES_UNSUBSCRIBE, 
      this.handleResourcesUnsubscribe.bind(this)
    )
    
    // Tools
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.TOOLS_LIST, 
      this.handleToolsList.bind(this)
    )
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.TOOLS_CALL, 
      this.handleToolsCall.bind(this)
    )
    
    // Prompts
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.PROMPTS_LIST, 
      this.handlePromptsList.bind(this)
    )
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.PROMPTS_GET, 
      this.handlePromptsGet.bind(this)
    )
    
    // Logging
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.LOGGING_SET_LEVEL, 
      this.handleLoggingSetLevel.bind(this)
    )
    
    // Completion
    this.communicationProtocol.registerMethodHandler(
      MCPMethod.COMPLETION_COMPLETE, 
      this.handleCompletionComplete.bind(this)
    )
  }

  /**
   * Initialize MCP session
   */
  async initialize(clientInfo = {}) {
    const initRequest = {
      protocolVersion: this.protocolVersion,
      capabilities: this.capabilities,
      clientInfo: {
        name: clientInfo.name || 'Lokus Plugin',
        version: clientInfo.version || '1.0.0',
        ...clientInfo
      }
    }
    
    const response = await this.sendRequest(MCPMethod.INITIALIZE, initRequest)
    
    this.serverInfo = response.serverInfo
    this.serverCapabilities = response.capabilities
    this.isInitialized = true
    
    this.emit('initialized', {
      serverInfo: this.serverInfo,
      capabilities: this.serverCapabilities
    })
    
    return response
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(message) {
    return this.communicationProtocol.handleMessage(message)
  }

  /**
   * Send request
   */
  async sendRequest(method, params = {}) {
    return this.communicationProtocol.sendRequest(method, params)
  }

  /**
   * Send notification
   */
  sendNotification(method, params = {}) {
    this.communicationProtocol.sendNotification(method, params)
  }

  // === RESOURCE MANAGEMENT ===

  /**
   * Register a resource
   */
  registerResource(resource) {
    this.validateResource(resource)
    this.resources.set(resource.uri, resource)
    
    // Notify subscribers of resource list change
    this.sendNotification(MCPMessageType.RESOURCE_LIST_CHANGED)
    
    this.emit('resource-registered', resource)
    return resource
  }

  /**
   * Unregister a resource
   */
  unregisterResource(uri) {
    const resource = this.resources.get(uri)
    if (resource) {
      this.resources.delete(uri)
      
      // Clean up subscriptions
      this.subscriptions.delete(uri)
      
      // Notify subscribers
      this.sendNotification(MCPMessageType.RESOURCE_LIST_CHANGED)
      
      this.emit('resource-unregistered', resource)
    }
    return resource
  }

  /**
   * Update resource content
   */
  updateResource(uri, content, metadata = {}) {
    const resource = this.resources.get(uri)
    if (!resource) {
      throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
    }
    
    resource.content = content
    resource.metadata = { ...resource.metadata, ...metadata }
    resource.lastModified = new Date().toISOString()
    
    // Notify subscribers
    const subscribers = this.subscriptions.get(uri)
    if (subscribers && subscribers.size > 0) {
      this.sendNotification(MCPMessageType.RESOURCE_UPDATED, {
        uri,
        content,
        metadata: resource.metadata
      })
    }
    
    this.emit('resource-updated', resource)
    return resource
  }

  /**
   * Validate resource structure
   */
  validateResource(resource) {
    if (!resource.uri) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Resource must have a URI')
    }
    
    if (!resource.name) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Resource must have a name')
    }
    
    if (!Object.values(MCPResourceType).includes(resource.type)) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, `Invalid resource type: ${resource.type}`)
    }
  }

  // === TOOL MANAGEMENT ===

  /**
   * Register a tool
   */
  registerTool(tool) {
    this.validateTool(tool)
    this.tools.set(tool.name, tool)
    
    // Notify of tool list change
    this.sendNotification(MCPMessageType.TOOL_LIST_CHANGED)
    
    this.emit('tool-registered', tool)
    return tool
  }

  /**
   * Unregister a tool
   */
  unregisterTool(name) {
    const tool = this.tools.get(name)
    if (tool) {
      this.tools.delete(name)
      this.sendNotification(MCPMessageType.TOOL_LIST_CHANGED)
      this.emit('tool-unregistered', tool)
    }
    return tool
  }

  /**
   * Validate tool structure
   */
  validateTool(tool) {
    if (!tool.name) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Tool must have a name')
    }
    
    if (!tool.description) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Tool must have a description')
    }
    
    if (!tool.inputSchema) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Tool must have an input schema')
    }
  }

  // === PROMPT MANAGEMENT ===

  /**
   * Register a prompt template
   */
  registerPrompt(prompt) {
    this.validatePrompt(prompt)
    this.prompts.set(prompt.name, prompt)
    
    // Notify of prompt list change
    this.sendNotification(MCPMessageType.PROMPT_LIST_CHANGED)
    
    this.emit('prompt-registered', prompt)
    return prompt
  }

  /**
   * Unregister a prompt template
   */
  unregisterPrompt(name) {
    const prompt = this.prompts.get(name)
    if (prompt) {
      this.prompts.delete(name)
      this.sendNotification(MCPMessageType.PROMPT_LIST_CHANGED)
      this.emit('prompt-unregistered', prompt)
    }
    return prompt
  }

  /**
   * Validate prompt structure
   */
  validatePrompt(prompt) {
    if (!prompt.name) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Prompt must have a name')
    }
    
    if (!prompt.description) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Prompt must have a description')
    }
    
    if (!prompt.template) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, 'Prompt must have a template')
    }
  }

  // === MESSAGE HANDLERS ===

  /**
   * Handle initialization request
   */
  async handleInitialize(params) {
    const { protocolVersion, capabilities, clientInfo } = params
    
    // Validate protocol version
    if (protocolVersion !== this.protocolVersion) {
      throw this.createError(
        MCPErrorCode.INVALID_REQUEST, 
        `Unsupported protocol version: ${protocolVersion}`
      )
    }
    
    this.clientInfo = clientInfo
    this.clientCapabilities = capabilities
    this.isInitialized = true
    
    return {
      protocolVersion: this.protocolVersion,
      capabilities: this.capabilities,
      serverInfo: {
        name: `Lokus MCP Server (${this.serverId})`,
        version: '1.0.0'
      }
    }
  }

  /**
   * Handle resources list request
   */
  async handleResourcesList(params) {
    const { cursor } = params || {}
    
    const resourcesList = Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
      type: resource.type,
      lastModified: resource.lastModified
    }))
    
    // Simple pagination support
    let resources = resourcesList
    let nextCursor = null
    
    if (cursor) {
      const startIndex = parseInt(cursor) || 0
      const pageSize = 100
      resources = resourcesList.slice(startIndex, startIndex + pageSize)
      
      if (startIndex + pageSize < resourcesList.length) {
        nextCursor = (startIndex + pageSize).toString()
      }
    }
    
    return {
      resources,
      ...(nextCursor && { nextCursor })
    }
  }

  /**
   * Handle resource read request
   */
  async handleResourcesRead(params) {
    const { uri } = params
    
    const resource = this.resources.get(uri)
    if (!resource) {
      throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
    }
    
    return {
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: resource.content || '',
        blob: resource.blob
      }]
    }
  }

  /**
   * Handle resource subscription
   */
  async handleResourcesSubscribe(params) {
    const { uri } = params
    
    if (!this.capabilities.resources.subscribe) {
      throw this.createError(
        MCPErrorCode.METHOD_NOT_FOUND, 
        'Resource subscriptions not supported'
      )
    }
    
    const resource = this.resources.get(uri)
    if (!resource) {
      throw this.createError(MCPErrorCode.RESOURCE_NOT_FOUND, `Resource not found: ${uri}`)
    }
    
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, new Set())
    }
    
    // Add subscriber (in real implementation, this would be the client ID)
    this.subscriptions.get(uri).add('client')
    
    return { subscribed: true }
  }

  /**
   * Handle resource unsubscription
   */
  async handleResourcesUnsubscribe(params) {
    const { uri } = params
    
    const subscribers = this.subscriptions.get(uri)
    if (subscribers) {
      subscribers.delete('client')
      if (subscribers.size === 0) {
        this.subscriptions.delete(uri)
      }
    }
    
    return { unsubscribed: true }
  }

  /**
   * Handle tools list request
   */
  async handleToolsList(params) {
    const { cursor } = params || {}
    
    const toolsList = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }))
    
    // Simple pagination
    let tools = toolsList
    let nextCursor = null
    
    if (cursor) {
      const startIndex = parseInt(cursor) || 0
      const pageSize = 100
      tools = toolsList.slice(startIndex, startIndex + pageSize)
      
      if (startIndex + pageSize < toolsList.length) {
        nextCursor = (startIndex + pageSize).toString()
      }
    }
    
    return {
      tools,
      ...(nextCursor && { nextCursor })
    }
  }

  /**
   * Handle tool execution request
   */
  async handleToolsCall(params) {
    const { name, arguments: args } = params
    
    const tool = this.tools.get(name)
    if (!tool) {
      throw this.createError(MCPErrorCode.TOOL_NOT_FOUND, `Tool not found: ${name}`)
    }
    
    try {
      // Validate arguments against schema
      this.validateToolArguments(tool, args)
      
      // Execute tool
      const result = await this.executeTool(tool, args)
      
      return {
        content: [
          {
            type: 'text',
            text: result.output || String(result)
          }
        ],
        isError: false
      }
      
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: error.message
          }
        ],
        isError: true
      }
    }
  }

  /**
   * Handle prompts list request
   */
  async handlePromptsList(params) {
    const { cursor } = params || {}
    
    const promptsList = Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }))
    
    return { prompts: promptsList }
  }

  /**
   * Handle prompt get request
   */
  async handlePromptsGet(params) {
    const { name, arguments: args } = params
    
    const prompt = this.prompts.get(name)
    if (!prompt) {
      throw this.createError(MCPErrorCode.PROMPT_NOT_FOUND, `Prompt not found: ${name}`)
    }
    
    try {
      // Render prompt template with arguments
      const renderedMessages = this.renderPromptTemplate(prompt, args)
      
      return {
        description: prompt.description,
        messages: renderedMessages
      }
      
    } catch (error) {
      throw this.createError(
        MCPErrorCode.PROMPT_INVALID_ARGUMENTS, 
        `Failed to render prompt: ${error.message}`
      )
    }
  }

  /**
   * Handle logging set level request
   */
  async handleLoggingSetLevel(params) {
    const { level } = params
    
    const validLevels = ['debug', 'info', 'warn', 'error']
    if (!validLevels.includes(level)) {
      throw this.createError(MCPErrorCode.INVALID_PARAMS, `Invalid log level: ${level}`)
    }
    
    this.logLevel = level
    this.emit('log-level-changed', { level })
    
    return { success: true }
  }

  /**
   * Handle completion request (for AI features)
   */
  async handleCompletionComplete(params) {
    const { ref, argument } = params
    
    // This would integrate with AI completion providers
    // For now, return empty suggestions
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
   * Validate tool arguments against schema
   */
  validateToolArguments(tool, args) {
    // Basic validation - in real implementation would use JSON Schema validator
    if (tool.inputSchema.required) {
      for (const required of tool.inputSchema.required) {
        if (!(required in args)) {
          throw new Error(`Missing required argument: ${required}`)
        }
      }
    }
  }

  /**
   * Execute a tool
   */
  async executeTool(tool, args) {
    if (typeof tool.execute === 'function') {
      return await tool.execute(args)
    } else {
      throw new Error('Tool execution function not implemented')
    }
  }

  /**
   * Render prompt template with arguments
   */
  renderPromptTemplate(prompt, args = {}) {
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
   * Get protocol statistics
   */
  getStats() {
    return {
      protocolVersion: this.protocolVersion,
      isInitialized: this.isInitialized,
      resourceCount: this.resources.size,
      toolCount: this.tools.size,
      promptCount: this.prompts.size,
      subscriptionCount: this.subscriptions.size,
      capabilities: this.capabilities,
      communicationStats: this.communicationProtocol?.getStats()
    }
  }

  /**
   * Dispose of the protocol instance
   */
  dispose() {
    // Clear all registrations
    this.resources.clear()
    this.tools.clear()
    this.prompts.clear()
    this.subscriptions.clear()
    
    // Dispose communication protocol
    if (this.communicationProtocol) {
      this.communicationProtocol.dispose()
    }
    
    this.isInitialized = false
    this.emit('disposed')
  }
}

/**
 * MCP Resource Builder - Helper for creating resource definitions
 */
export class MCPResourceBuilder {
  constructor() {
    this.resource = {}
  }
  
  setUri(uri) {
    this.resource.uri = uri
    return this
  }
  
  setName(name) {
    this.resource.name = name
    return this
  }
  
  setDescription(description) {
    this.resource.description = description
    return this
  }
  
  setType(type) {
    this.resource.type = type
    return this
  }
  
  setMimeType(mimeType) {
    this.resource.mimeType = mimeType
    return this
  }
  
  setContent(content) {
    this.resource.content = content
    return this
  }
  
  setMetadata(metadata) {
    this.resource.metadata = metadata
    return this
  }
  
  build() {
    this.resource.lastModified = new Date().toISOString()
    return { ...this.resource }
  }
}

/**
 * MCP Tool Builder - Helper for creating tool definitions
 */
export class MCPToolBuilder {
  constructor() {
    this.tool = {}
  }
  
  setName(name) {
    this.tool.name = name
    return this
  }
  
  setDescription(description) {
    this.tool.description = description
    return this
  }
  
  setInputSchema(schema) {
    this.tool.inputSchema = schema
    return this
  }
  
  setExecutor(executor) {
    this.tool.execute = executor
    return this
  }
  
  build() {
    return { ...this.tool }
  }
}

/**
 * MCP Prompt Builder - Helper for creating prompt templates
 */
export class MCPPromptBuilder {
  constructor() {
    this.prompt = {}
  }
  
  setName(name) {
    this.prompt.name = name
    return this
  }
  
  setDescription(description) {
    this.prompt.description = description
    return this
  }
  
  setTemplate(template) {
    this.prompt.template = template
    return this
  }
  
  setArguments(args) {
    this.prompt.arguments = args
    return this
  }
  
  build() {
    return { ...this.prompt }
  }
}

export default MCPProtocol