/**
 * TypeScript definitions for MCP (Model Context Protocol)
 * 
 * Comprehensive type definitions for MCP protocol implementation
 * Based on MCP specification version 2024-11-05
 */

// === CORE PROTOCOL TYPES ===

/**
 * MCP Protocol Version
 */
export type MCPProtocolVersion = '2024-11-05'

/**
 * JSON-RPC 2.0 Base Message
 */
export interface JSONRPCMessage {
  jsonrpc: '2.0'
}

/**
 * JSON-RPC 2.0 Request
 */
export interface JSONRPCRequest extends JSONRPCMessage {
  id: string | number
  method: string
  params?: any
}

/**
 * JSON-RPC 2.0 Response
 */
export interface JSONRPCResponse extends JSONRPCMessage {
  id: string | number
  result?: any
  error?: JSONRPCError
}

/**
 * JSON-RPC 2.0 Notification
 */
export interface JSONRPCNotification extends JSONRPCMessage {
  method: string
  params?: any
}

/**
 * JSON-RPC 2.0 Error
 */
export interface JSONRPCError {
  code: number
  message: string
  data?: any
}

// === MCP SPECIFIC TYPES ===

/**
 * MCP Message Types
 */
export type MCPMessageType = 
  | 'request'
  | 'response'
  | 'notification'
  | 'notifications/resources/updated'
  | 'notifications/resources/list_changed'
  | 'notifications/tools/list_changed'
  | 'notifications/prompts/list_changed'
  | 'notifications/logging/message'

/**
 * MCP Methods
 */
export type MCPMethod = 
  | 'initialize'
  | 'resources/list'
  | 'resources/read'
  | 'resources/subscribe'
  | 'resources/unsubscribe'
  | 'tools/list'
  | 'tools/call'
  | 'prompts/list'
  | 'prompts/get'
  | 'logging/setLevel'
  | 'completion/complete'

/**
 * MCP Error Codes
 */
export enum MCPErrorCode {
  // JSON-RPC standard errors
  PARSE_ERROR = -32700,
  INVALID_REQUEST = -32600,
  METHOD_NOT_FOUND = -32601,
  INVALID_PARAMS = -32602,
  INTERNAL_ERROR = -32603,
  
  // MCP specific errors
  RESOURCE_NOT_FOUND = -32001,
  RESOURCE_ACCESS_DENIED = -32002,
  RESOURCE_UNAVAILABLE = -32003,
  TOOL_NOT_FOUND = -32011,
  TOOL_EXECUTION_ERROR = -32012,
  TOOL_INVALID_INPUT = -32013,
  PROMPT_NOT_FOUND = -32021,
  PROMPT_INVALID_ARGUMENTS = -32022,
}

// === RESOURCE TYPES ===

/**
 * Resource Types
 */
export type MCPResourceType = 
  | 'file'
  | 'directory'
  | 'database'
  | 'api'
  | 'memory'
  | 'web'
  | 'custom'

/**
 * Resource Definition
 */
export interface MCPResource {
  uri: string
  name: string
  description?: string
  type: MCPResourceType
  mimeType?: string
  lastModified?: string
  metadata?: Record<string, any>
  content?: string
  blob?: Uint8Array
}

/**
 * Resource Content
 */
export interface MCPResourceContent {
  uri: string
  mimeType?: string
  text?: string
  blob?: Uint8Array
}

/**
 * Resource List Request
 */
export interface ResourcesListRequest {
  cursor?: string
}

/**
 * Resource List Response
 */
export interface ResourcesListResponse {
  resources: MCPResource[]
  nextCursor?: string
}

/**
 * Resource Read Request
 */
export interface ResourcesReadRequest {
  uri: string
}

/**
 * Resource Read Response
 */
export interface ResourcesReadResponse {
  contents: MCPResourceContent[]
}

/**
 * Resource Subscribe Request
 */
export interface ResourcesSubscribeRequest {
  uri: string
}

/**
 * Resource Subscribe Response
 */
export interface ResourcesSubscribeResponse {
  subscribed: boolean
}

/**
 * Resource Updated Notification
 */
export interface ResourceUpdatedNotification {
  uri: string
  content: string
  metadata?: Record<string, any>
}

// === TOOL TYPES ===

/**
 * Tool Types
 */
export type MCPToolType = 
  | 'function'
  | 'command'
  | 'api_call'
  | 'script'
  | 'query'

/**
 * JSON Schema Definition
 */
export interface JSONSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'
  properties?: Record<string, JSONSchema>
  items?: JSONSchema
  required?: string[]
  description?: string
  enum?: any[]
  default?: any
  examples?: any[]
}

/**
 * Tool Definition
 */
export interface MCPTool {
  name: string
  description: string
  inputSchema: JSONSchema
  type?: MCPToolType
  execute?: (args: any) => Promise<any> | any
}

/**
 * Tool List Request
 */
export interface ToolsListRequest {
  cursor?: string
}

/**
 * Tool List Response
 */
export interface ToolsListResponse {
  tools: MCPTool[]
  nextCursor?: string
}

/**
 * Tool Call Request
 */
export interface ToolsCallRequest {
  name: string
  arguments: Record<string, any>
}

/**
 * Tool Call Response Content
 */
export interface ToolCallContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

/**
 * Tool Call Response
 */
export interface ToolsCallResponse {
  content: ToolCallContent[]
  isError: boolean
}

// === PROMPT TYPES ===

/**
 * Prompt Argument Definition
 */
export interface PromptArgument {
  name: string
  description: string
  required?: boolean
  type?: 'string' | 'number' | 'boolean'
  default?: any
}

/**
 * Prompt Template
 */
export interface MCPPrompt {
  name: string
  description: string
  template: string
  arguments?: PromptArgument[]
}

/**
 * Prompt Message Role
 */
export type PromptMessageRole = 'user' | 'assistant' | 'system'

/**
 * Prompt Message Content
 */
export interface PromptMessageContent {
  type: 'text' | 'image'
  text?: string
  data?: string
  mimeType?: string
}

/**
 * Prompt Message
 */
export interface PromptMessage {
  role: PromptMessageRole
  content: PromptMessageContent
}

/**
 * Prompt List Request
 */
export interface PromptsListRequest {
  cursor?: string
}

/**
 * Prompt List Response
 */
export interface PromptsListResponse {
  prompts: MCPPrompt[]
  nextCursor?: string
}

/**
 * Prompt Get Request
 */
export interface PromptsGetRequest {
  name: string
  arguments?: Record<string, any>
}

/**
 * Prompt Get Response
 */
export interface PromptsGetResponse {
  description?: string
  messages: PromptMessage[]
}

// === INITIALIZATION TYPES ===

/**
 * Client Information
 */
export interface ClientInfo {
  name: string
  version: string
  description?: string
  author?: string
  license?: string
}

/**
 * Server Information
 */
export interface ServerInfo {
  name: string
  version: string
  description?: string
  author?: string
  license?: string
}

/**
 * MCP Capabilities
 */
export interface MCPCapabilities {
  resources?: {
    subscribe?: boolean
    listChanged?: boolean
  }
  tools?: {
    listChanged?: boolean
  }
  prompts?: {
    listChanged?: boolean
  }
  logging?: {
    enabled?: boolean
  }
  completion?: {
    enabled?: boolean
  }
}

/**
 * Initialize Request
 */
export interface InitializeRequest {
  protocolVersion: MCPProtocolVersion
  capabilities: MCPCapabilities
  clientInfo: ClientInfo
}

/**
 * Initialize Response
 */
export interface InitializeResponse {
  protocolVersion: MCPProtocolVersion
  capabilities: MCPCapabilities
  serverInfo: ServerInfo
}

// === LOGGING TYPES ===

/**
 * Log Levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/**
 * Logging Set Level Request
 */
export interface LoggingSetLevelRequest {
  level: LogLevel
}

/**
 * Logging Message Notification
 */
export interface LoggingMessageNotification {
  level: LogLevel
  logger?: string
  data: any
}

// === PLUGIN TYPES ===

/**
 * MCP Plugin Types
 */
export type MCPPluginType = 
  | 'mcp-server'
  | 'mcp-client'
  | 'mcp-hybrid'

/**
 * MCP Plugin States
 */
export type MCPPluginState = 
  | 'discovered'
  | 'loading'
  | 'loaded'
  | 'initializing'
  | 'active'
  | 'error'
  | 'disposed'

/**
 * MCP Plugin Configuration
 */
export interface MCPPluginConfig {
  type?: MCPPluginType
  capabilities?: MCPCapabilities
  enableResourceSubscriptions?: boolean
  enableToolExecution?: boolean
  enablePromptTemplates?: boolean
  requireSignature?: boolean
  memoryLimit?: number
  cpuTimeLimit?: number
  maxApiCalls?: number
}

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
  name: string
  version: string
  description?: string
  type: MCPServerType
  manifest: PluginManifest
  requireSignature?: boolean
  memoryLimit?: number
  cpuTimeLimit?: number
}

/**
 * MCP Server Types
 */
export type MCPServerType = 
  | 'internal'
  | 'external'
  | 'embedded'

/**
 * MCP Server Status
 */
export type MCPServerStatus = 
  | 'stopped'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'crashed'
  | 'error'

/**
 * MCP Client States
 */
export type MCPClientState = 
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'closed'

// === PLUGIN MANIFEST TYPES ===

/**
 * Plugin Manifest (base interface)
 */
export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  main: string
  lokusVersion: string
  author?: string | AuthorInfo
  license?: string
  homepage?: string
  repository?: string | RepositoryInfo
  keywords?: string[]
  dependencies?: Record<string, string>
  permissions?: string[]
  contributes?: ContributePoints
  activationEvents?: string[]
  categories?: string[]
  
  // MCP-specific fields
  mcp?: MCPPluginConfig
  type?: MCPPluginType
}

/**
 * Author Information
 */
export interface AuthorInfo {
  name: string
  email?: string
  url?: string
}

/**
 * Repository Information
 */
export interface RepositoryInfo {
  type: string
  url: string
  directory?: string
}

/**
 * Plugin Contribution Points
 */
export interface ContributePoints {
  commands?: Command[]
  menus?: Record<string, MenuItem[]>
  keybindings?: KeyBinding[]
  languages?: Language[]
  themes?: Theme[]
  snippets?: Snippet[]
  configuration?: Configuration
  mcp?: MCPContributions
}

/**
 * MCP Contributions
 */
export interface MCPContributions {
  servers?: MCPServerContribution[]
  resources?: MCPResourceContribution[]
  tools?: MCPToolContribution[]
  prompts?: MCPPromptContribution[]
}

/**
 * MCP Server Contribution
 */
export interface MCPServerContribution {
  id: string
  name: string
  description?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  transport?: 'stdio' | 'tcp' | 'websocket'
}

/**
 * MCP Resource Contribution
 */
export interface MCPResourceContribution {
  name: string
  description?: string
  pattern: string
  type: MCPResourceType
  mimeType?: string
}

/**
 * MCP Tool Contribution
 */
export interface MCPToolContribution {
  name: string
  description: string
  inputSchema: JSONSchema
  handler: string
}

/**
 * MCP Prompt Contribution
 */
export interface MCPPromptContribution {
  name: string
  description: string
  template: string
  arguments?: PromptArgument[]
}

// === EVENT TYPES ===

/**
 * MCP Protocol Events
 */
export interface MCPProtocolEvents {
  'initialized': { serverInfo: ServerInfo; capabilities: MCPCapabilities }
  'resource-registered': MCPResource
  'resource-unregistered': MCPResource
  'resource-updated': MCPResource
  'tool-registered': MCPTool
  'tool-unregistered': MCPTool
  'prompt-registered': MCPPrompt
  'prompt-unregistered': MCPPrompt
  'send-message': JSONRPCMessage
  'protocol-error': Error
  'disposed': void
}

/**
 * MCP Client Events
 */
export interface MCPClientEvents {
  'connected': { serverInfo: ServerInfo }
  'disconnected': void
  'state-changed': { newState: MCPClientState; oldState: MCPClientState }
  'resource-updated': { uri: string; content: string; metadata?: Record<string, any> }
  'resource-list-changed': any
  'tool-list-changed': any
  'prompt-list-changed': any
  'tool-called': { name: string; args: any; response: any; responseTime: number }
  'server-log': { level: LogLevel; logger?: string; data: any }
  'message-sent': JSONRPCMessage
  'protocol-error': Error
  'request-error': { method: string; error: Error }
  'notification': JSONRPCNotification
}

/**
 * MCP Plugin Manager Events
 */
export interface MCPPluginManagerEvents {
  'initialized': void
  'mcp-plugin-registered': { pluginId: string; mcpPlugin: any }
  'mcp-plugin-loaded': { pluginId: string; mcpPlugin: any }
  'mcp-plugin-activated': { pluginId: string; mcpPlugin: any }
  'mcp-plugin-deactivated': { pluginId: string; mcpPlugin: any }
  'mcp-plugin-error': { pluginId: string; error: Error }
  'global-resource-registered': { resource: MCPResource; pluginId: string; serverId: string }
  'global-tool-registered': { tool: MCPTool; pluginId: string; serverId: string }
  'global-prompt-registered': { prompt: MCPPrompt; pluginId: string; serverId: string }
  'shutdown': void
}

/**
 * MCP Server Host Events
 */
export interface MCPServerHostEvents {
  'initialized': void
  'server-started': { serverId: string; serverInstance: any }
  'server-stopped': { serverId: string }
  'server-restarted': { serverId: string }
  'server-status-changed': { serverId: string; status: MCPServerStatus }
  'server-error': { serverId: string; error: Error }
  'server-resource-usage': { serverId: string; usage: any }
  'shutdown': void
}

// === API TYPES ===

/**
 * MCP API for Plugins
 */
export interface MCPAPI {
  server?: {
    registerResource: (resource: MCPResource) => MCPResource
    unregisterResource: (uri: string) => MCPResource | undefined
    updateResource: (uri: string, content: string, metadata?: Record<string, any>) => MCPResource
    registerTool: (tool: MCPTool) => MCPTool
    unregisterTool: (name: string) => MCPTool | undefined
    registerPrompt: (prompt: MCPPrompt) => MCPPrompt
    unregisterPrompt: (name: string) => MCPPrompt | undefined
    sendNotification: (method: string, params?: any) => void
  }
  client?: {
    listResources: () => Promise<ResourcesListResponse>
    readResource: (uri: string) => Promise<ResourcesReadResponse>
    subscribeToResource: (uri: string) => Promise<{ dispose: () => void }>
    listTools: () => Promise<ToolsListResponse>
    callTool: (name: string, args: any) => Promise<ToolsCallResponse>
    listPrompts: () => Promise<PromptsListResponse>
    getPrompt: (name: string, args?: any) => Promise<PromptsGetResponse>
  }
  global?: {
    findResources: (filter?: any) => any[]
    findTools: (filter?: any) => any[]
    findPrompts: (filter?: any) => any[]
  }
}

// === STATISTICS TYPES ===

/**
 * MCP Protocol Statistics
 */
export interface MCPProtocolStats {
  protocolVersion: MCPProtocolVersion
  isInitialized: boolean
  resourceCount: number
  toolCount: number
  promptCount: number
  subscriptionCount: number
  capabilities: MCPCapabilities
  communicationStats?: any
}

/**
 * MCP Client Statistics
 */
export interface MCPClientStats {
  clientId: string
  state: MCPClientState
  serverInfo?: ServerInfo
  serverCapabilities?: MCPCapabilities
  connectionAttempts: number
  lastConnectionError?: string
  cacheStats: {
    resources: number
    tools: number
    prompts: number
  }
  subscriptions: number
  requestStats: {
    total: number
    successful: number
    failed: number
    averageResponseTime: number
  }
  uptime: number
  protocolStats?: MCPProtocolStats
}

/**
 * MCP Plugin Manager Statistics
 */
export interface MCPPluginManagerStats {
  mcpPlugins: number
  mcpServers: number
  mcpClients: number
  globalResources: number
  globalTools: number
  globalPrompts: number
  states: Record<MCPPluginState, number>
}

/**
 * MCP Server Host Statistics
 */
export interface MCPServerHostStats {
  totalServers: number
  runningServers: number
  stoppedServers: number
  errorServers: number
  byType: Record<MCPServerType, number>
  totalMemoryUsage: number
  healthyServers: number
  unhealthyServers: number
}

// === UTILITY TYPES ===

/**
 * Generic Response Wrapper
 */
export interface MCPResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

/**
 * Generic Event Handler
 */
export type MCPEventHandler<T = any> = (data: T) => void | Promise<void>

/**
 * Generic Disposable
 */
export interface Disposable {
  dispose(): void | Promise<void>
}

// === BUILDER TYPES ===

/**
 * MCP Resource Builder
 */
export interface MCPResourceBuilder {
  setUri(uri: string): MCPResourceBuilder
  setName(name: string): MCPResourceBuilder
  setDescription(description: string): MCPResourceBuilder
  setType(type: MCPResourceType): MCPResourceBuilder
  setMimeType(mimeType: string): MCPResourceBuilder
  setContent(content: string): MCPResourceBuilder
  setMetadata(metadata: Record<string, any>): MCPResourceBuilder
  build(): MCPResource
}

/**
 * MCP Tool Builder
 */
export interface MCPToolBuilder {
  setName(name: string): MCPToolBuilder
  setDescription(description: string): MCPToolBuilder
  setInputSchema(schema: JSONSchema): MCPToolBuilder
  setExecutor(executor: (args: any) => Promise<any> | any): MCPToolBuilder
  build(): MCPTool
}

/**
 * MCP Prompt Builder
 */
export interface MCPPromptBuilder {
  setName(name: string): MCPPromptBuilder
  setDescription(description: string): MCPPromptBuilder
  setTemplate(template: string): MCPPromptBuilder
  setArguments(args: PromptArgument[]): MCPPromptBuilder
  build(): MCPPrompt
}

// === Re-export common types for convenience ===

export {
  MCPProtocolVersion,
  MCPMessageType,
  MCPMethod,
  MCPResourceType,
  MCPToolType,
  MCPPluginType,
  MCPPluginState,
  MCPServerType,
  MCPServerStatus,
  MCPClientState,
  LogLevel
}

// === Default exports ===

export default {
  MCPProtocolVersion,
  MCPErrorCode,
  MCPMessageType,
  MCPMethod,
  MCPResourceType,
  MCPToolType,
  MCPPluginType,
  MCPPluginState,
  MCPServerType,
  MCPServerStatus,
  MCPClientState
}