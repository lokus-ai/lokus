/**
 * MCP Server Testing Utilities
 * 
 * Provides utilities for testing MCP server functionality including:
 * - Mock clients and servers
 * - Test data generation
 * - Assertion helpers
 * - Test environment setup
 */

import { EventEmitter } from '../../utils/EventEmitter.js';
import { MCPProtocol, MCPMethod, MCPErrorCode } from '../MCPProtocol.js';
import { MCPServerHost, MCPServerType, MCPServerStatus } from '../MCPServerHost.js';
import { MCPClient } from '../MCPClient.js';

/**
 * Mock WebSocket implementation for testing
 */
export class MockWebSocket extends EventEmitter {
  constructor(url, options = {}) {
    super();
    this.url = url;
    this.options = options;
    this.readyState = MockWebSocket.CONNECTING;
    this.messages = [];
    this.closed = false;
    
    // Simulate async connection
    setTimeout(() => {
      if (!this.closed) {
        this.readyState = MockWebSocket.OPEN;
        this.emit('open');
      }
    }, 10);
  }
  
  static get CONNECTING() { return 0; }
  static get OPEN() { return 1; }
  static get CLOSING() { return 2; }
  static get CLOSED() { return 3; }
  
  send(data) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    this.messages.push(data);
    
    // Simulate message handling
    setTimeout(() => {
      try {
        const message = JSON.parse(data);
        this.emit('message-sent', message);
      } catch (error) {
        this.emit('error', error);
      }
    }, 5);
  }
  
  close(code = 1000, reason = '') {
    this.readyState = MockWebSocket.CLOSING;
    this.closed = true;
    
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED;
      this.emit('close', code, reason);
    }, 5);
  }
  
  ping() {
    this.emit('ping');
  }
  
  pong() {
    this.emit('pong');
  }
  
  // Test helpers
  simulateMessage(data) {
    if (this.readyState === MockWebSocket.OPEN) {
      this.emit('message', typeof data === 'string' ? data : JSON.stringify(data));
    }
  }
  
  simulateError(error) {
    this.emit('error', error);
  }
  
  getLastMessage() {
    return this.messages[this.messages.length - 1];
  }
  
  getAllMessages() {
    return [...this.messages];
  }
  
  clearMessages() {
    this.messages = [];
  }
}

/**
 * Mock MCP Server for testing client functionality
 */
export class MockMCPServer extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.resources = new Map();
    this.tools = new Map();
    this.prompts = new Map();
    this.subscriptions = new Map();
    
    this.isInitialized = false;
    this.clientInfo = null;
    this.serverInfo = {
      name: 'Mock MCP Server',
      version: '1.0.0'
    };
    
    this.capabilities = {
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
    };
    
    // Add default test data
    this.addTestData();
  }
  
  addTestData() {
    // Test resources
    this.resources.set('file:///test/document1.md', {
      uri: 'file:///test/document1.md',
      name: 'Test Document 1',
      description: 'A test document',
      type: 'file',
      mimeType: 'text/markdown',
      content: '# Test Document\n\nThis is a test document.',
      lastModified: new Date().toISOString()
    });
    
    this.resources.set('file:///test/document2.txt', {
      uri: 'file:///test/document2.txt',
      name: 'Test Document 2',
      description: 'Another test document',
      type: 'file',
      mimeType: 'text/plain',
      content: 'This is a plain text test document.',
      lastModified: new Date().toISOString()
    });
    
    // Test tools
    this.tools.set('test_tool', {
      name: 'test_tool',
      description: 'A test tool',
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' }
        },
        required: ['input']
      },
      execute: async (args) => ({
        output: `Processed: ${args.input}`
      })
    });
    
    this.tools.set('echo_tool', {
      name: 'echo_tool',
      description: 'Echoes the input',
      inputSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: 'Message to echo' }
        },
        required: ['message']
      },
      execute: async (args) => ({
        output: args.message
      })
    });
    
    // Test prompts
    this.prompts.set('test_prompt', {
      name: 'test_prompt',
      description: 'A test prompt template',
      template: 'Test prompt with {{input}}',
      arguments: [
        {
          name: 'input',
          description: 'Input for the prompt',
          required: true
        }
      ]
    });
  }
  
  async handleMessage(message) {
    try {
      const { jsonrpc, id, method, params } = JSON.parse(message);
      
      if (jsonrpc !== '2.0') {
        return this.createErrorResponse(id, MCPErrorCode.INVALID_REQUEST, 'Invalid JSON-RPC version');
      }
      
      let result;
      
      switch (method) {
        case MCPMethod.INITIALIZE:
          result = await this.handleInitialize(params);
          break;
        case MCPMethod.RESOURCES_LIST:
          result = await this.handleResourcesList(params);
          break;
        case MCPMethod.RESOURCES_READ:
          result = await this.handleResourcesRead(params);
          break;
        case MCPMethod.RESOURCES_SUBSCRIBE:
          result = await this.handleResourcesSubscribe(params);
          break;
        case MCPMethod.RESOURCES_UNSUBSCRIBE:
          result = await this.handleResourcesUnsubscribe(params);
          break;
        case MCPMethod.TOOLS_LIST:
          result = await this.handleToolsList(params);
          break;
        case MCPMethod.TOOLS_CALL:
          result = await this.handleToolsCall(params);
          break;
        case MCPMethod.PROMPTS_LIST:
          result = await this.handlePromptsList(params);
          break;
        case MCPMethod.PROMPTS_GET:
          result = await this.handlePromptsGet(params);
          break;
        default:
          return this.createErrorResponse(id, MCPErrorCode.METHOD_NOT_FOUND, `Method not found: ${method}`);
      }
      
      return this.createSuccessResponse(id, result);
      
    } catch (error) {
      const messageData = JSON.parse(message);
      return this.createErrorResponse(messageData.id, MCPErrorCode.INTERNAL_ERROR, error.message);
    }
  }
  
  async handleInitialize(params) {
    this.clientInfo = params.clientInfo;
    this.isInitialized = true;
    
    return {
      protocolVersion: '2024-11-05',
      capabilities: this.capabilities,
      serverInfo: this.serverInfo
    };
  }
  
  async handleResourcesList(params) {
    const resources = Array.from(this.resources.values()).map(resource => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      type: resource.type,
      mimeType: resource.mimeType,
      lastModified: resource.lastModified
    }));
    
    return { resources };
  }
  
  async handleResourcesRead(params) {
    const { uri } = params;
    const resource = this.resources.get(uri);
    
    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    return {
      contents: [{
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: resource.content
      }]
    };
  }
  
  async handleResourcesSubscribe(params) {
    const { uri } = params;
    
    if (!this.resources.has(uri)) {
      throw new Error(`Resource not found: ${uri}`);
    }
    
    if (!this.subscriptions.has(uri)) {
      this.subscriptions.set(uri, new Set());
    }
    
    this.subscriptions.get(uri).add('test-client');
    
    return { subscribed: true };
  }
  
  async handleResourcesUnsubscribe(params) {
    const { uri } = params;
    
    const subscribers = this.subscriptions.get(uri);
    if (subscribers) {
      subscribers.delete('test-client');
      if (subscribers.size === 0) {
        this.subscriptions.delete(uri);
      }
    }
    
    return { unsubscribed: true };
  }
  
  async handleToolsList(params) {
    const tools = Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    return { tools };
  }
  
  async handleToolsCall(params) {
    const { name, arguments: args } = params;
    const tool = this.tools.get(name);
    
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    
    try {
      const result = await tool.execute(args);
      
      return {
        content: [{
          type: 'text',
          text: result.output || String(result)
        }],
        isError: false
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: error.message
        }],
        isError: true
      };
    }
  }
  
  async handlePromptsList(params) {
    const prompts = Array.from(this.prompts.values()).map(prompt => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments
    }));
    
    return { prompts };
  }
  
  async handlePromptsGet(params) {
    const { name, arguments: args } = params;
    const prompt = this.prompts.get(name);
    
    if (!prompt) {
      throw new Error(`Prompt not found: ${name}`);
    }
    
    let rendered = prompt.template;
    for (const [key, value] of Object.entries(args || {})) {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    return {
      description: prompt.description,
      messages: [{
        role: 'user',
        content: {
          type: 'text',
          text: rendered
        }
      }]
    };
  }
  
  createSuccessResponse(id, result) {
    return JSON.stringify({
      jsonrpc: '2.0',
      id,
      result
    });
  }
  
  createErrorResponse(id, code, message, data = null) {
    return JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    });
  }
  
  // Test helpers
  updateResource(uri, content) {
    const resource = this.resources.get(uri);
    if (resource) {
      resource.content = content;
      resource.lastModified = new Date().toISOString();
      
      // Notify subscribers
      const subscribers = this.subscriptions.get(uri);
      if (subscribers && subscribers.size > 0) {
        const notification = {
          jsonrpc: '2.0',
          method: 'notifications/resources/updated',
          params: {
            uri,
            content,
            metadata: {}
          }
        };
        
        this.emit('notification', JSON.stringify(notification));
      }
    }
  }
  
  addResource(resource) {
    this.resources.set(resource.uri, resource);
    
    // Notify about list change
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/resources/list_changed',
      params: { type: 'resources' }
    };
    
    this.emit('notification', JSON.stringify(notification));
  }
  
  addTool(tool) {
    this.tools.set(tool.name, tool);
    
    const notification = {
      jsonrpc: '2.0',
      method: 'notifications/tools/list_changed',
      params: { type: 'tools' }
    };
    
    this.emit('notification', JSON.stringify(notification));
  }
}

/**
 * Test data generators
 */
export class TestDataGenerator {
  static generateResource(overrides = {}) {
    const defaults = {
      uri: `file:///test/resource-${Date.now()}.md`,
      name: `Test Resource ${Date.now()}`,
      description: 'A test resource',
      type: 'file',
      mimeType: 'text/markdown',
      content: '# Test Resource\n\nThis is a test resource.',
      lastModified: new Date().toISOString()
    };
    
    return { ...defaults, ...overrides };
  }
  
  static generateTool(overrides = {}) {
    const name = overrides.name || `test_tool_${Date.now()}`;
    const defaults = {
      name,
      description: `Test tool: ${name}`,
      inputSchema: {
        type: 'object',
        properties: {
          input: { type: 'string', description: 'Test input' }
        },
        required: ['input']
      },
      execute: async (args) => ({ output: `Processed: ${args.input}` })
    };
    
    return { ...defaults, ...overrides };
  }
  
  static generatePrompt(overrides = {}) {
    const name = overrides.name || `test_prompt_${Date.now()}`;
    const defaults = {
      name,
      description: `Test prompt: ${name}`,
      template: 'Test prompt with {{input}}',
      arguments: [
        {
          name: 'input',
          description: 'Input for the prompt',
          required: true
        }
      ]
    };
    
    return { ...defaults, ...overrides };
  }
  
  static generateMCPMessage(method, params = {}, id = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
  }
  
  static generateMCPResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }
  
  static generateMCPError(id, code, message, data = null) {
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message,
        ...(data && { data })
      }
    };
  }
  
  static generateMCPNotification(method, params = {}) {
    return {
      jsonrpc: '2.0',
      method,
      params
    };
  }
}

/**
 * Test assertion helpers
 */
export class MCPAssertions {
  static assertMCPMessage(message, expectedMethod = null, expectedId = null) {
    if (typeof message === 'string') {
      message = JSON.parse(message);
    }
    
    if (message.jsonrpc !== '2.0') {
      throw new Error(`Expected JSON-RPC 2.0, got: ${message.jsonrpc}`);
    }
    
    if (expectedMethod && message.method !== expectedMethod) {
      throw new Error(`Expected method ${expectedMethod}, got: ${message.method}`);
    }
    
    if (expectedId !== null && message.id !== expectedId) {
      throw new Error(`Expected id ${expectedId}, got: ${message.id}`);
    }
  }
  
  static assertMCPResponse(response, expectedId = null) {
    if (typeof response === 'string') {
      response = JSON.parse(response);
    }
    
    if (response.jsonrpc !== '2.0') {
      throw new Error(`Expected JSON-RPC 2.0, got: ${response.jsonrpc}`);
    }
    
    if (!('result' in response) && !('error' in response)) {
      throw new Error('Response must have either result or error');
    }
    
    if (expectedId !== null && response.id !== expectedId) {
      throw new Error(`Expected id ${expectedId}, got: ${response.id}`);
    }
  }
  
  static assertMCPError(response, expectedCode = null, expectedMessage = null) {
    this.assertMCPResponse(response);
    
    if (typeof response === 'string') {
      response = JSON.parse(response);
    }
    
    if (!response.error) {
      throw new Error('Expected error response');
    }
    
    if (expectedCode && response.error.code !== expectedCode) {
      throw new Error(`Expected error code ${expectedCode}, got: ${response.error.code}`);
    }
    
    if (expectedMessage && !response.error.message.includes(expectedMessage)) {
      throw new Error(`Expected error message to contain "${expectedMessage}", got: ${response.error.message}`);
    }
  }
  
  static assertResource(resource, expectedProperties = {}) {
    const requiredProperties = ['uri', 'name', 'type'];
    
    for (const prop of requiredProperties) {
      if (!(prop in resource)) {
        throw new Error(`Resource missing required property: ${prop}`);
      }
    }
    
    for (const [key, value] of Object.entries(expectedProperties)) {
      if (resource[key] !== value) {
        throw new Error(`Expected resource.${key} to be ${value}, got: ${resource[key]}`);
      }
    }
  }
  
  static assertTool(tool, expectedProperties = {}) {
    const requiredProperties = ['name', 'description', 'inputSchema'];
    
    for (const prop of requiredProperties) {
      if (!(prop in tool)) {
        throw new Error(`Tool missing required property: ${prop}`);
      }
    }
    
    for (const [key, value] of Object.entries(expectedProperties)) {
      if (tool[key] !== value) {
        throw new Error(`Expected tool.${key} to be ${value}, got: ${tool[key]}`);
      }
    }
  }
  
  static assertPrompt(prompt, expectedProperties = {}) {
    const requiredProperties = ['name', 'description'];
    
    for (const prop of requiredProperties) {
      if (!(prop in prompt)) {
        throw new Error(`Prompt missing required property: ${prop}`);
      }
    }
    
    for (const [key, value] of Object.entries(expectedProperties)) {
      if (prompt[key] !== value) {
        throw new Error(`Expected prompt.${key} to be ${value}, got: ${prompt[key]}`);
      }
    }
  }
}

/**
 * Test environment setup utilities
 */
export class TestEnvironment {
  constructor() {
    this.mockServers = [];
    this.mockClients = [];
    this.testData = new Map();
    this.cleanup = [];
  }
  
  async setupMockServer(options = {}) {
    const server = new MockMCPServer(options);
    this.mockServers.push(server);
    
    this.cleanup.push(() => {
      server.removeAllListeners();
    });
    
    return server;
  }
  
  async setupMockClient(serverUrl = 'ws://localhost:3001/mcp') {
    const client = new MCPClient('test-client', {
      transport: 'mock',
      serverUrl
    });
    
    this.mockClients.push(client);
    
    this.cleanup.push(async () => {
      await client.disconnect();
    });
    
    return client;
  }
  
  generateTestWorkspace(path) {
    const testFiles = [
      {
        path: 'notes/test-note.md',
        content: '# Test Note\n\nThis is a test note for MCP testing.'
      },
      {
        path: 'docs/api.md',
        content: '# API Documentation\n\n## Endpoints\n\n### GET /api/test'
      },
      {
        path: 'config.json',
        content: JSON.stringify({ test: true, environment: 'test' }, null, 2)
      }
    ];
    
    this.testData.set('workspace', { path, files: testFiles });
    
    this.cleanup.push(() => {
      // Clean up test files if needed
    });
    
    return testFiles;
  }
  
  async tearDown() {
    for (const cleanupFn of this.cleanup) {
      try {
        await cleanupFn();
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
    
    this.mockServers = [];
    this.mockClients = [];
    this.testData.clear();
    this.cleanup = [];
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  static async measureAsyncOperation(operation, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      iterations,
      totalTime: times.reduce((sum, time) => sum + time, 0),
      averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      times
    };
  }
  
  static async testConcurrency(operation, concurrency = 10) {
    const start = performance.now();
    
    const promises = Array.from({ length: concurrency }, () => operation());
    const results = await Promise.allSettled(promises);
    
    const end = performance.now();
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    return {
      concurrency,
      totalTime: end - start,
      successful,
      failed,
      successRate: successful / concurrency,
      results
    };
  }
  
  static memoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    } else if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory;
    } else {
      return { note: 'Memory usage not available in this environment' };
    }
  }
}

// Export everything for easy importing
export default {
  MockWebSocket,
  MockMCPServer,
  TestDataGenerator,
  MCPAssertions,
  TestEnvironment,
  PerformanceTestUtils
};