#!/usr/bin/env node

/**
 * Lokus MCP Node.js Client Example
 * 
 * This example demonstrates how to connect to a Lokus MCP server using Node.js.
 * It includes resource discovery, tool execution, and real-time subscriptions.
 * 
 * Requirements:
 *   npm install ws axios
 * 
 * Usage:
 *   node nodejs-client.js
 *   node nodejs-client.js --interactive
 * 
 * Environment Variables:
 *   LOKUS_API_KEY: Your Lokus API key
 *   LOKUS_MCP_URL: MCP server URL (default: ws://localhost:3001/mcp)
 */

const WebSocket = require('ws');
const axios = require('axios');
const readline = require('readline');
const { EventEmitter } = require('events');

/**
 * Lokus MCP Client for Node.js
 */
class LokusMCPClient extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.websocketUrl = options.websocketUrl || process.env.LOKUS_MCP_URL || 'ws://localhost:3001/mcp';
    this.httpUrl = options.httpUrl || 'http://localhost:3001/api/mcp';
    this.apiKey = options.apiKey || process.env.LOKUS_API_KEY;
    
    this.ws = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.isInitialized = false;
    this.serverInfo = null;
    this.serverCapabilities = null;
    
    // Connection state
    this.connectionState = 'disconnected'; // disconnected, connecting, connected, error
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // ms
    
    this.logger = console;
  }
  
  /**
   * Connect to the MCP server via WebSocket
   */
  async connect() {
    if (this.connectionState === 'connected' || this.connectionState === 'connecting') {
      return true;
    }
    
    this.connectionState = 'connecting';
    this.logger.info(`🔌 Connecting to Lokus MCP server at ${this.websocketUrl}`);
    
    try {
      const headers = {};
      if (this.apiKey) {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }
      
      this.ws = new WebSocket(this.websocketUrl, {
        headers,
        handshakeTimeout: 10000
      });
      
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 15000);
        
        this.ws.on('open', async () => {
          clearTimeout(timeout);
          this.connectionState = 'connected';
          this.reconnectAttempts = 0;
          this.logger.info('✅ Connected to Lokus MCP server');
          
          try {
            await this.initialize();
            resolve(true);
          } catch (error) {
            reject(error);
          }
        });
        
        this.ws.on('message', (data) => {
          this._handleMessage(JSON.parse(data.toString()));
        });
        
        this.ws.on('close', (code, reason) => {
          clearTimeout(timeout);
          this.connectionState = 'disconnected';
          this.logger.warn(`🔌 Connection closed: ${code} - ${reason}`);
          this.emit('disconnected', { code, reason });
          
          // Auto-reconnect if not intentionally closed
          if (code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
            this._scheduleReconnect();
          }
        });
        
        this.ws.on('error', (error) => {
          clearTimeout(timeout);
          this.connectionState = 'error';
          this.logger.error(`❌ WebSocket error: ${error.message}`);
          this.emit('error', error);
          reject(error);
        });
        
        this.ws.on('ping', () => {
          this.ws.pong();
        });
      });
      
    } catch (error) {
      this.connectionState = 'error';
      this.logger.error(`❌ Failed to connect: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Disconnect from the MCP server
   */
  async disconnect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.logger.info('👋 Disconnected from MCP server');
  }
  
  /**
   * Initialize MCP session
   */
  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: true },
        tools: { listChanged: true },
        prompts: { listChanged: true }
      },
      clientInfo: {
        name: 'Lokus Node.js MCP Client',
        version: '1.0.0',
        description: 'Node.js example client for Lokus MCP server'
      }
    });
    
    this.serverInfo = response.serverInfo;
    this.serverCapabilities = response.capabilities;
    this.isInitialized = true;
    
    this.logger.info(`✅ Initialized with server: ${this.serverInfo?.name || 'Unknown'}`);
    this.logger.debug('Server capabilities:', this.serverCapabilities);
    
    this.emit('initialized', { serverInfo: this.serverInfo, capabilities: this.serverCapabilities });
    
    return response;
  }
  
  /**
   * Send a JSON-RPC request and wait for response
   */
  async sendRequest(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to MCP server');
    }
    
    const messageId = this.messageId++;
    const message = {
      jsonrpc: '2.0',
      id: messageId,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(messageId);
        reject(new Error(`Request ${method} timed out`));
      }, 30000);
      
      // Store request
      this.pendingRequests.set(messageId, {
        resolve,
        reject,
        timeout,
        method
      });
      
      // Send message
      this.ws.send(JSON.stringify(message));
      this.logger.debug(`📤 Sent request: ${method} (id: ${messageId})`);
    });
  }
  
  /**
   * Send a JSON-RPC notification (no response expected)
   */
  async sendNotification(method, params = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to MCP server');
    }
    
    const message = {
      jsonrpc: '2.0',
      method,
      params
    };
    
    this.ws.send(JSON.stringify(message));
    this.logger.debug(`📢 Sent notification: ${method}`);
  }
  
  /**
   * Handle incoming WebSocket messages
   */
  _handleMessage(data) {
    try {
      if ('id' in data) {
        // This is a response to a request
        const messageId = data.id;
        const request = this.pendingRequests.get(messageId);
        
        if (request) {
          clearTimeout(request.timeout);
          this.pendingRequests.delete(messageId);
          
          if ('error' in data) {
            const error = data.error;
            request.reject(new Error(`MCP Error ${error.code}: ${error.message}`));
          } else {
            request.resolve(data.result || {});
          }
        }
      } else if ('method' in data) {
        // This is a notification
        this._handleNotification(data.method, data.params || {});
      }
    } catch (error) {
      this.logger.error(`❌ Error handling message: ${error.message}`);
    }
  }
  
  /**
   * Handle incoming notifications
   */
  _handleNotification(method, params) {
    this.logger.debug(`📨 Received notification: ${method}`);
    this.emit('notification', { method, params });
    this.emit(method, params);
  }
  
  /**
   * Schedule reconnection attempt
   */
  _scheduleReconnect() {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    this.logger.info(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.logger.error(`❌ Reconnect attempt ${this.reconnectAttempts} failed: ${error.message}`);
      }
    }, delay);
  }
  
  // Resource methods
  async listResources(options = {}) {
    const params = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.type) params.type = options.type;
    if (options.search) params.search = options.search;
    
    return await this.sendRequest('resources/list', params);
  }
  
  async readResource(uri) {
    return await this.sendRequest('resources/read', { uri });
  }
  
  async readResources(uris) {
    return await this.sendRequest('resources/read', { uris });
  }
  
  async subscribeToResource(uri) {
    return await this.sendRequest('resources/subscribe', { uri });
  }
  
  async unsubscribeFromResource(uri) {
    return await this.sendRequest('resources/unsubscribe', { uri });
  }
  
  // Tool methods
  async listTools(options = {}) {
    const params = {};
    if (options.cursor) params.cursor = options.cursor;
    if (options.category) params.category = options.category;
    
    return await this.sendRequest('tools/list', params);
  }
  
  async callTool(name, args = {}) {
    return await this.sendRequest('tools/call', {
      name,
      arguments: args
    });
  }
  
  // Prompt methods
  async listPrompts() {
    return await this.sendRequest('prompts/list', {});
  }
  
  async getPrompt(name, args = {}) {
    return await this.sendRequest('prompts/get', {
      name,
      arguments: args
    });
  }
  
  // Utility methods
  async setLogLevel(level) {
    return await this.sendRequest('logging/setLevel', { level });
  }
  
  async getCompletion(refType, name = null, argumentName = null, value = null) {
    const params = {
      ref: { type: refType }
    };
    if (name) params.ref.name = name;
    if (argumentName && value) {
      params.argument = { name: argumentName, value };
    }
    
    return await this.sendRequest('completion/complete', params);
  }
}

/**
 * Example application that demonstrates MCP capabilities
 */
class LokusExplorer {
  constructor(client) {
    this.client = client;
    this.logger = console;
    
    // Set up event handlers
    this.client.on('notifications/resources/updated', (params) => {
      this.logger.info(`📄 Resource updated: ${params.uri}`);
    });
    
    this.client.on('notifications/resources/list_changed', () => {
      this.logger.info('📋 Resource list changed');
    });
    
    this.client.on('notifications/tools/list_changed', () => {
      this.logger.info('🔧 Tool list changed');
    });
    
    this.client.on('notifications/logging/message', (params) => {
      this.logger.info(`🔗 Server log [${params.level}]: ${params.message}`);
    });
  }
  
  /**
   * Explore the workspace and demonstrate MCP capabilities
   */
  async exploreWorkspace() {
    this.logger.info('🚀 Starting workspace exploration...');
    
    try {
      // 1. Discover resources
      this.logger.info('\n1️⃣ Discovering resources...');
      const resourcesResponse = await this.client.listResources();
      const resources = resourcesResponse.resources || [];
      
      this.logger.info(`Found ${resources.length} resources:`);
      resources.slice(0, 5).forEach(resource => {
        this.logger.info(`  📄 ${resource.name} (${resource.type}) - ${resource.uri}`);
      });
      
      if (resources.length > 5) {
        this.logger.info(`  ... and ${resources.length - 5} more`);
      }
      
      // 2. Discover tools
      this.logger.info('\n2️⃣ Discovering tools...');
      const toolsResponse = await this.client.listTools();
      const tools = toolsResponse.tools || [];
      
      this.logger.info(`Found ${tools.length} tools:`);
      tools.slice(0, 5).forEach(tool => {
        this.logger.info(`  🔧 ${tool.name} - ${tool.description}`);
      });
      
      // 3. Search for files
      this.logger.info('\n3️⃣ Searching for markdown files...');
      try {
        const searchResult = await this.client.callTool('search_files', {
          query: '',
          fileTypes: ['md'],
          includeContent: false
        });
        
        if (!searchResult.isError) {
          const content = searchResult.content[0].text;
          this.logger.info(`Search results:\n${content.substring(0, 500)}...`);
        }
      } catch (error) {
        this.logger.warn(`⚠️  Search tool not available: ${error.message}`);
      }
      
      // 4. Read a resource
      if (resources.length > 0) {
        this.logger.info('\n4️⃣ Reading a resource...');
        const firstFile = resources.find(r => r.type === 'file');
        
        if (firstFile) {
          try {
            const contentResponse = await this.client.readResource(firstFile.uri);
            const content = contentResponse.contents[0].text;
            
            this.logger.info(`Content of ${firstFile.name}:`);
            this.logger.info(`${content.substring(0, 200)}...`);
            this.logger.info(`Total characters: ${content.length}`);
            
            // 5. Subscribe to changes
            this.logger.info('\n5️⃣ Subscribing to resource changes...');
            await this.client.subscribeToResource(firstFile.uri);
            this.logger.info(`✅ Subscribed to ${firstFile.name}`);
            
          } catch (error) {
            this.logger.error(`❌ Failed to read resource: ${error.message}`);
          }
        }
      }
      
      // 6. Explore prompts
      this.logger.info('\n6️⃣ Exploring prompt templates...');
      const promptsResponse = await this.client.listPrompts();
      const prompts = promptsResponse.prompts || [];
      
      if (prompts.length > 0) {
        this.logger.info(`Found ${prompts.length} prompt templates:`);
        prompts.forEach(prompt => {
          this.logger.info(`  💬 ${prompt.name} - ${prompt.description}`);
        });
        
        // Try the first prompt
        try {
          const firstPrompt = prompts[0];
          const promptResponse = await this.client.getPrompt(firstPrompt.name, {
            content: 'This is a test content for the prompt template.'
          });
          
          this.logger.info(`\nRendered prompt '${firstPrompt.name}':`);
          promptResponse.messages.forEach(message => {
            this.logger.info(`  ${message.role}: ${message.content.text.substring(0, 100)}...`);
          });
          
        } catch (error) {
          this.logger.warn(`⚠️  Could not render prompt: ${error.message}`);
        }
      }
      
      // 7. Create a test file
      this.logger.info('\n7️⃣ Creating a test file...');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const testContent = `# MCP Test File

Created by Node.js MCP client at ${new Date().toISOString()}

This file demonstrates the MCP protocol capabilities:

- ✅ Resource discovery
- ✅ Tool execution  
- ✅ Real-time subscriptions
- ✅ Content creation

## Statistics
- Timestamp: ${timestamp}
- Client: Lokus Node.js MCP Client
- Protocol: MCP 2024-11-05
- Resources found: ${resources.length}
- Tools available: ${tools.length}
`;
      
      try {
        const createResult = await this.client.callTool('create_file', {
          path: `/workspace/mcp-test-${timestamp}.md`,
          content: testContent
        });
        
        if (!createResult.isError) {
          this.logger.info('✅ Test file created successfully');
        } else {
          this.logger.error(`❌ Failed to create file: ${createResult.content[0].text}`);
        }
        
      } catch (error) {
        this.logger.error(`❌ Error creating file: ${error.message}`);
      }
      
      this.logger.info('\n🎉 Workspace exploration completed!');
      
    } catch (error) {
      this.logger.error(`❌ Error during exploration: ${error.message}`);
    }
  }
  
  /**
   * Run interactive mode for manual testing
   */
  async interactiveMode() {
    this.logger.info('\n🎮 Entering interactive mode...');
    this.logger.info('Commands: list-resources, list-tools, search <query>, read <uri>, create-note <title>, quit');
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: '\n> '
    });
    
    return new Promise((resolve) => {
      const handleCommand = async (command) => {
        const parts = command.trim().split(' ');
        const cmd = parts[0].toLowerCase();
        
        try {
          switch (cmd) {
            case 'quit':
            case 'exit':
              rl.close();
              resolve();
              return;
            
            case 'list-resources':
              const resources = await this.client.listResources();
              resources.resources.forEach(resource => {
              });
              break;
            
            case 'list-tools':
              const tools = await this.client.listTools();
              tools.tools.forEach(tool => {
              });
              break;
            
            case 'search':
              if (parts.length < 2) {
                break;
              }
              const query = parts.slice(1).join(' ');
              const result = await this.client.callTool('search_files', {
                query,
                includeContent: false
              });
              break;
            
            case 'read':
              if (parts.length < 2) {
                break;
              }
              const uri = parts[1];
              const content = await this.client.readResource(uri);
              break;
            
            case 'create-note':
              if (parts.length < 2) {
                break;
              }
              const title = parts.slice(1).join(' ');
              const noteContent = `# ${title}\n\nCreated via MCP interactive mode at ${new Date().toISOString()}\n\n## Content\n\nAdd your content here...`;
              const filename = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
              
              const createResult = await this.client.callTool('create_file', {
                path: `/workspace/${filename}.md`,
                content: noteContent
              });
              
              if (!createResult.isError) {
              } else {
              }
              break;
            
            default:
          }
          
        } catch (error) {
        }
        
        rl.prompt();
      };
      
      rl.on('line', handleCommand);
      rl.on('close', () => {
        this.logger.info('\n👋 Exiting interactive mode');
        resolve();
      });
      
      rl.prompt();
    });
  }
}

/**
 * Main application
 */
async function main() {
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const interactive = args.includes('--interactive');
  const debug = args.includes('--debug');
  
  // Configuration
  const websocketUrl = process.env.LOKUS_MCP_URL || 'ws://localhost:3001/mcp';
  const apiKey = process.env.LOKUS_API_KEY;
  
  if (!apiKey) {
    console.warn('⚠️  No API key found. Set LOKUS_API_KEY environment variable for authentication');
  }
  
  // Create client
  const client = new LokusMCPClient({
    websocketUrl,
    apiKey
  });
  
  if (debug) {
    client.logger = {
      info: console.info,
      warn: console.warn,
      error: console.error,
      debug: console.debug
    };
  }
  
  try {
    // Connect to server
    await client.connect();
    
    // Create explorer
    const explorer = new LokusExplorer(client);
    
    if (interactive) {
      await explorer.interactiveMode();
    } else {
      await explorer.exploreWorkspace();
      
      // Keep connection alive for a bit to see notifications
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
    
  } catch (error) {
    console.error(`❌ Application error: ${error.message}`);
    process.exit(1);
  } finally {
    await client.disconnect();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Run the application
if (require.main === module) {
  main().catch(error => {
    console.error(`❌ Fatal error: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { LokusMCPClient, LokusExplorer };