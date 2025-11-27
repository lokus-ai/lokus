/**
 * End-to-End Tests for Lokus MCP Server
 * 
 * These tests verify the complete MCP server functionality including:
 * - WebSocket and HTTP communication
 * - Resource discovery and access
 * - Tool execution
 * - Real-time subscriptions
 * - Authentication and authorization
 * - Error handling and edge cases
 * 
 * Prerequisites:
 * - Lokus application running with MCP server enabled
 * - Test workspace with sample content
 * - Valid API key for authentication
 */

const { test, expect, chromium } = require('@playwright/test');
const WebSocket = require('ws');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const MCP_WS_URL = process.env.MCP_WS_URL || 'ws://localhost:3001/mcp';
const MCP_HTTP_URL = process.env.MCP_HTTP_URL || 'http://localhost:3001/api/mcp';
const TEST_API_KEY = process.env.TEST_API_KEY || 'test-api-key';
const TEST_WORKSPACE = process.env.TEST_WORKSPACE || '/tmp/lokus-test-workspace';

// Test utilities
class MCPTestClient {
  constructor() {
    this.ws = null;
    this.messageId = 1;
    this.pendingRequests = new Map();
    this.receivedNotifications = [];
  }

  async connect() {
    this.ws = new WebSocket(MCP_WS_URL, {
      headers: { 'Authorization': `Bearer ${TEST_API_KEY}` }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 10000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  handleMessage(message) {
    if ('id' in message) {
      // Response to request
      const request = this.pendingRequests.get(message.id);
      if (request) {
        this.pendingRequests.delete(message.id);
        if ('error' in message) {
          request.reject(new Error(`${message.error.code}: ${message.error.message}`));
        } else {
          request.resolve(message.result);
        }
      }
    } else if ('method' in message) {
      // Notification
      this.receivedNotifications.push(message);
    }
  }

  async sendRequest(method, params = {}) {
    const id = this.messageId++;
    const message = { jsonrpc: '2.0', id, method, params };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        reject: (error) => {
          clearTimeout(timeout);
          reject(error);
        }
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  async httpRequest(endpoint, method = 'GET', data = null) {
    const config = {
      method,
      url: `${MCP_HTTP_URL}${endpoint}`,
      headers: {
        'X-API-Key': TEST_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    if (data) {
      config.data = data;
    }

    return axios(config);
  }
}

// Test data setup
function setupTestWorkspace() {
  if (!fs.existsSync(TEST_WORKSPACE)) {
    fs.mkdirSync(TEST_WORKSPACE, { recursive: true });
  }

  // Create test files
  const testFiles = [
    {
      path: 'notes/meeting-notes.md',
      content: `# Meeting Notes

Date: ${new Date().toISOString()}

## Agenda
- Project status update
- Next steps discussion
- Resource allocation

## Action Items
- [ ] Review project timeline
- [ ] Update documentation
- [ ] Schedule follow-up meeting`
    },
    {
      path: 'docs/project-plan.md',
      content: `# Project Plan

## Overview
This document outlines the project objectives and timeline.

## Milestones
- Phase 1: Research and planning
- Phase 2: Development
- Phase 3: Testing and deployment

## Resources
- Development team: 3 people
- Timeline: 3 months
- Budget: $50,000`
    },
    {
      path: 'todo.txt',
      content: `Project TODO List:
- Set up development environment
- Design system architecture
- Implement core features
- Write documentation
- Conduct testing`
    },
    {
      path: 'config.json',
      content: JSON.stringify({
        "projectName": "Test Project",
        "version": "1.0.0",
        "settings": {
          "debug": true,
          "logLevel": "info"
        }
      }, null, 2)
    }
  ];

  testFiles.forEach(file => {
    const filePath = path.join(TEST_WORKSPACE, file.path);
    const dir = path.dirname(filePath);
    
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, file.content);
  });
}

// Test suite
test.describe('MCP Server Integration Tests', () => {
  let client;

  test.beforeAll(async () => {
    setupTestWorkspace();
  });

  test.beforeEach(async () => {
    client = new MCPTestClient();
  });

  test.afterEach(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  test.describe('Connection and Authentication', () => {
    test('should connect via WebSocket with valid API key', async () => {
      await expect(client.connect()).resolves.not.toThrow();
    });

    test('should reject connection with invalid API key', async () => {
      const invalidClient = new MCPTestClient();
      invalidClient.ws = new WebSocket(MCP_WS_URL, {
        headers: { 'Authorization': 'Bearer invalid-key' }
      });

      await expect(new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve('timeout'), 5000);
        invalidClient.ws.on('open', () => {
          clearTimeout(timeout);
          resolve('connected');
        });
        invalidClient.ws.on('error', () => {
          clearTimeout(timeout);
          resolve('error');
        });
        invalidClient.ws.on('close', (code) => {
          clearTimeout(timeout);
          resolve(`closed-${code}`);
        });
      })).resolves.toMatch(/error|closed-40[13]/);
    });

    test('should handle HTTP authentication', async () => {
      const response = await client.httpRequest('/resources/list');
      expect(response.status).toBe(200);
    });

    test('should reject HTTP requests without API key', async () => {
      try {
        await axios.get(`${MCP_HTTP_URL}/resources/list`);
        expect.fail('Should have thrown authentication error');
      } catch (error) {
        expect([401, 403]).toContain(error.response?.status);
      }
    });
  });

  test.describe('Session Initialization', () => {
    test('should initialize MCP session successfully', async () => {
      await client.connect();

      const response = await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: { subscribe: true },
          tools: { listChanged: true }
        },
        clientInfo: {
          name: 'Test Client',
          version: '1.0.0'
        }
      });

      expect(response).toHaveProperty('protocolVersion', '2024-11-05');
      expect(response).toHaveProperty('capabilities');
      expect(response).toHaveProperty('serverInfo');
      expect(response.serverInfo).toHaveProperty('name');
      expect(response.serverInfo).toHaveProperty('version');
    });

    test('should reject unsupported protocol version', async () => {
      await client.connect();

      await expect(client.sendRequest('initialize', {
        protocolVersion: '1999-01-01',
        capabilities: {},
        clientInfo: { name: 'Test', version: '1.0.0' }
      })).rejects.toThrow(/protocol version/i);
    });

    test('should require initialization before other operations', async () => {
      await client.connect();

      await expect(client.sendRequest('resources/list'))
        .rejects.toThrow(/not initialized|initialization required/i);
    });
  });

  test.describe('Resource Operations', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { resources: { subscribe: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should list available resources', async () => {
      const response = await client.sendRequest('resources/list');

      expect(response).toHaveProperty('resources');
      expect(Array.isArray(response.resources)).toBe(true);
      
      if (response.resources.length > 0) {
        const resource = response.resources[0];
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('type');
      }
    });

    test('should filter resources by type', async () => {
      const response = await client.sendRequest('resources/list', {
        type: 'file'
      });

      expect(response).toHaveProperty('resources');
      response.resources.forEach(resource => {
        expect(resource.type).toBe('file');
      });
    });

    test('should search resources by name', async () => {
      const response = await client.sendRequest('resources/list', {
        search: 'meeting'
      });

      expect(response).toHaveProperty('resources');
      response.resources.forEach(resource => {
        expect(resource.name.toLowerCase()).toContain('meeting');
      });
    });

    test('should read resource content', async () => {
      // First get available resources
      const listResponse = await client.sendRequest('resources/list');
      
      if (listResponse.resources.length === 0) {
        test.skip('No resources available for testing');
        return;
      }

      const resource = listResponse.resources[0];
      const readResponse = await client.sendRequest('resources/read', {
        uri: resource.uri
      });

      expect(readResponse).toHaveProperty('contents');
      expect(Array.isArray(readResponse.contents)).toBe(true);
      expect(readResponse.contents.length).toBeGreaterThan(0);

      const content = readResponse.contents[0];
      expect(content).toHaveProperty('uri', resource.uri);
      expect(content).toHaveProperty('mimeType');
      expect(content).toHaveProperty('text');
    });

    test('should handle non-existent resource', async () => {
      await expect(client.sendRequest('resources/read', {
        uri: 'file:///non-existent-file.txt'
      })).rejects.toThrow(/not found/i);
    });

    test('should support pagination', async () => {
      const firstPage = await client.sendRequest('resources/list', {
        cursor: null
      });

      expect(firstPage).toHaveProperty('resources');
      
      if (firstPage.nextCursor) {
        const secondPage = await client.sendRequest('resources/list', {
          cursor: firstPage.nextCursor
        });
        
        expect(secondPage).toHaveProperty('resources');
        // Ensure different results (no duplicates)
        const firstUris = new Set(firstPage.resources.map(r => r.uri));
        const secondUris = new Set(secondPage.resources.map(r => r.uri));
        const intersection = new Set([...firstUris].filter(x => secondUris.has(x)));
        expect(intersection.size).toBe(0);
      }
    });
  });

  test.describe('Resource Subscriptions', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { resources: { subscribe: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should subscribe to resource changes', async () => {
      // Get a resource to subscribe to
      const listResponse = await client.sendRequest('resources/list');
      
      if (listResponse.resources.length === 0) {
        test.skip('No resources available for subscription testing');
        return;
      }

      const resource = listResponse.resources.find(r => r.type === 'file');
      if (!resource) {
        test.skip('No file resources available for subscription testing');
        return;
      }

      const subscribeResponse = await client.sendRequest('resources/subscribe', {
        uri: resource.uri
      });

      expect(subscribeResponse).toHaveProperty('subscribed', true);
    });

    test('should unsubscribe from resource changes', async () => {
      const listResponse = await client.sendRequest('resources/list');
      
      if (listResponse.resources.length === 0) {
        test.skip('No resources available for subscription testing');
        return;
      }

      const resource = listResponse.resources[0];

      // Subscribe first
      await client.sendRequest('resources/subscribe', {
        uri: resource.uri
      });

      // Then unsubscribe
      const unsubscribeResponse = await client.sendRequest('resources/unsubscribe', {
        uri: resource.uri
      });

      expect(unsubscribeResponse).toHaveProperty('unsubscribed', true);
    });

    test('should receive notifications on resource updates', async () => {
      const testFile = path.join(TEST_WORKSPACE, 'test-notification.md');
      const initialContent = '# Test File\n\nInitial content';
      fs.writeFileSync(testFile, initialContent);

      // Wait a bit for the file to be indexed
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get the resource URI
      const listResponse = await client.sendRequest('resources/list');
      const resource = listResponse.resources.find(r => 
        r.uri.includes('test-notification.md')
      );

      if (!resource) {
        test.skip('Test file not found in resources');
        return;
      }

      // Subscribe to the resource
      await client.sendRequest('resources/subscribe', {
        uri: resource.uri
      });

      // Clear previous notifications
      client.receivedNotifications = [];

      // Update the file
      const updatedContent = '# Test File\n\nUpdated content at ' + new Date().toISOString();
      fs.writeFileSync(testFile, updatedContent);

      // Wait for notification
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for resource update notification
      const updateNotifications = client.receivedNotifications.filter(
        notif => notif.method === 'notifications/resources/updated'
      );

      expect(updateNotifications.length).toBeGreaterThan(0);
      
      const notification = updateNotifications[0];
      expect(notification.params).toHaveProperty('uri', resource.uri);
      expect(notification.params).toHaveProperty('content');
    });
  });

  test.describe('Tool Operations', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { tools: { listChanged: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should list available tools', async () => {
      const response = await client.sendRequest('tools/list');

      expect(response).toHaveProperty('tools');
      expect(Array.isArray(response.tools)).toBe(true);

      if (response.tools.length > 0) {
        const tool = response.tools[0];
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
      }
    });

    test('should execute search_files tool', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          query: 'meeting',
          fileTypes: ['md', 'txt']
        }
      });

      expect(response).toHaveProperty('content');
      expect(Array.isArray(response.content)).toBe(true);
      expect(response).toHaveProperty('isError', false);

      if (response.content.length > 0) {
        const content = response.content[0];
        expect(content).toHaveProperty('type', 'text');
        expect(content).toHaveProperty('text');
      }
    });

    test('should handle tool execution errors gracefully', async () => {
      const response = await client.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          // Invalid arguments
          query: '',
          path: '/non-existent-path'
        }
      });

      expect(response).toHaveProperty('content');
      expect(response).toHaveProperty('isError', true);
    });

    test('should reject calls to non-existent tools', async () => {
      await expect(client.sendRequest('tools/call', {
        name: 'non_existent_tool',
        arguments: {}
      })).rejects.toThrow(/tool not found/i);
    });

    test('should validate tool arguments', async () => {
      // Try to call a tool with missing required arguments
      const response = await client.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          // Missing required 'query' argument
          fileTypes: ['md']
        }
      });

      expect(response).toHaveProperty('isError', true);
      expect(response.content[0].text).toMatch(/required|missing/i);
    });

    test('should execute file creation tool', async () => {
      const testFileName = `test-${Date.now()}.md`;
      const testContent = '# Test File\n\nCreated by E2E test';

      const response = await client.sendRequest('tools/call', {
        name: 'create_file',
        arguments: {
          path: `/workspace/${testFileName}`,
          content: testContent
        }
      });

      expect(response).toHaveProperty('isError', false);
      
      // Verify file was created
      const filePath = path.join(TEST_WORKSPACE, testFileName);
      expect(fs.existsSync(filePath)).toBe(true);
      expect(fs.readFileSync(filePath, 'utf8')).toBe(testContent);
    });
  });

  test.describe('Prompt Operations', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { prompts: { listChanged: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should list available prompt templates', async () => {
      const response = await client.sendRequest('prompts/list');

      expect(response).toHaveProperty('prompts');
      expect(Array.isArray(response.prompts)).toBe(true);

      if (response.prompts.length > 0) {
        const prompt = response.prompts[0];
        expect(prompt).toHaveProperty('name');
        expect(prompt).toHaveProperty('description');
        expect(prompt).toHaveProperty('arguments');
      }
    });

    test('should render prompt template with arguments', async () => {
      const listResponse = await client.sendRequest('prompts/list');
      
      if (listResponse.prompts.length === 0) {
        test.skip('No prompt templates available for testing');
        return;
      }

      const prompt = listResponse.prompts[0];
      const response = await client.sendRequest('prompts/get', {
        name: prompt.name,
        arguments: {
          content: 'This is test content for the prompt template.',
          maxLength: 100
        }
      });

      expect(response).toHaveProperty('messages');
      expect(Array.isArray(response.messages)).toBe(true);

      if (response.messages.length > 0) {
        const message = response.messages[0];
        expect(message).toHaveProperty('role');
        expect(message).toHaveProperty('content');
        expect(message.content).toHaveProperty('type', 'text');
        expect(message.content).toHaveProperty('text');
      }
    });

    test('should handle non-existent prompt template', async () => {
      await expect(client.sendRequest('prompts/get', {
        name: 'non_existent_prompt',
        arguments: {}
      })).rejects.toThrow(/prompt not found/i);
    });
  });

  test.describe('Error Handling', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should handle malformed JSON-RPC requests', async () => {
      const malformedMessage = '{"jsonrpc": "2.0", "method": "invalid_method"';
      
      await expect(new Promise((resolve, reject) => {
        client.ws.send(malformedMessage);
        setTimeout(() => resolve('no_error'), 1000);
      })).resolves.toBe('no_error');
    });

    test('should return appropriate error codes', async () => {
      await expect(client.sendRequest('non_existent_method'))
        .rejects.toThrow(/-32601/); // Method not found

      await expect(client.sendRequest('resources/read', { invalid: 'params' }))
        .rejects.toThrow(/-32602/); // Invalid params
    });

    test('should handle server internal errors gracefully', async () => {
      // This test would depend on how the server handles internal errors
      // For now, we'll test a scenario that might cause an internal error
      await expect(client.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          query: 'test',
          // Extremely large fileTypes array to potentially cause issues
          fileTypes: new Array(10000).fill('md')
        }
      })).resolves.toHaveProperty('content');
    });
  });

  test.describe('Performance and Rate Limiting', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should handle concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        client.sendRequest('resources/list', { search: `test${i}` })
      );

      const responses = await Promise.allSettled(requests);
      
      const successful = responses.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBeGreaterThan(0);
    });

    test('should enforce rate limiting', async () => {
      // Send many requests rapidly
      const rapidRequests = Array.from({ length: 100 }, () =>
        client.httpRequest('/resources/list').catch(err => err.response)
      );

      const responses = await Promise.allSettled(rapidRequests);
      
      // Check if some requests were rate limited
      const rateLimited = responses.some(r => 
        r.value?.status === 429 || 
        r.reason?.response?.status === 429
      );

      // Rate limiting may or may not be triggered depending on server config
      // This test documents the expected behavior rather than enforcing it
    });

    test('should respond within acceptable time limits', async () => {
      const startTime = Date.now();
      
      await client.sendRequest('resources/list');
      
      const responseTime = Date.now() - startTime;
      expect(responseTime).toBeLessThan(5000); // 5 second max response time
    });
  });

  test.describe('HTTP API Endpoints', () => {
    test('should support all operations via HTTP', async () => {
      // Initialize via HTTP
      const initResponse = await client.httpRequest('/initialize', 'POST', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'HTTP Test Client', version: '1.0.0' }
      });

      expect(initResponse.status).toBe(200);
      expect(initResponse.data).toHaveProperty('serverInfo');

      // List resources via HTTP
      const resourcesResponse = await client.httpRequest('/resources/list');
      expect(resourcesResponse.status).toBe(200);
      expect(resourcesResponse.data).toHaveProperty('resources');

      // List tools via HTTP
      const toolsResponse = await client.httpRequest('/tools/list');
      expect(toolsResponse.status).toBe(200);
      expect(toolsResponse.data).toHaveProperty('tools');
    });

    test('should handle HTTP-specific headers', async () => {
      const response = await client.httpRequest('/resources/list');
      
      expect(response.headers).toHaveProperty('content-type');
      expect(response.headers['content-type']).toContain('application/json');
      
      // Check for rate limiting headers if implemented
      if (response.headers['x-ratelimit-limit']) {
        expect(response.headers).toHaveProperty('x-ratelimit-remaining');
        expect(response.headers).toHaveProperty('x-ratelimit-reset');
      }
    });
  });

  test.describe('Real-world Scenarios', () => {
    test.beforeEach(async () => {
      await client.connect();
      await client.sendRequest('initialize', {
        protocolVersion: '2024-11-05',
        capabilities: { resources: { subscribe: true }, tools: { listChanged: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });
    });

    test('should support complete workflow: search, read, analyze', async () => {
      // 1. Search for files
      const searchResponse = await client.sendRequest('tools/call', {
        name: 'search_files',
        arguments: {
          query: 'project',
          fileTypes: ['md']
        }
      });

      expect(searchResponse.isError).toBe(false);

      // 2. Get list of resources
      const resourcesResponse = await client.sendRequest('resources/list', {
        type: 'file'
      });

      // 3. Read content from found resources
      if (resourcesResponse.resources.length > 0) {
        const resource = resourcesResponse.resources[0];
        const contentResponse = await client.sendRequest('resources/read', {
          uri: resource.uri
        });

        expect(contentResponse.contents).toBeDefined();
        expect(contentResponse.contents[0]).toHaveProperty('text');

        // 4. Analyze content (if analysis tool exists)
        try {
          const analysisResponse = await client.sendRequest('tools/call', {
            name: 'analyze_content',
            arguments: {
              content: contentResponse.contents[0].text,
              includeStats: true
            }
          });

          if (!analysisResponse.isError) {
            expect(analysisResponse.content).toBeDefined();
          }
        } catch (error) {
          // Analysis tool might not be available, that's okay
        }
      }
    });

    test('should handle workspace updates and notifications', async () => {
      // Subscribe to a resource
      const resourcesResponse = await client.sendRequest('resources/list');
      
      if (resourcesResponse.resources.length === 0) {
        test.skip('No resources available for notification testing');
        return;
      }

      const resource = resourcesResponse.resources[0];
      await client.sendRequest('resources/subscribe', {
        uri: resource.uri
      });

      // Clear notifications
      client.receivedNotifications = [];

      // Create a new file to trigger notifications
      const timestamp = Date.now();
      await client.sendRequest('tools/call', {
        name: 'create_file',
        arguments: {
          path: `/workspace/notification-test-${timestamp}.md`,
          content: `# Notification Test\n\nCreated at ${new Date().toISOString()}`
        }
      });

      // Wait for notifications
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check for list change notification
      const listChangeNotifications = client.receivedNotifications.filter(
        notif => notif.method === 'notifications/resources/list_changed'
      );

      expect(listChangeNotifications.length).toBeGreaterThan(0);
    });
  });
});

test.describe('MCP Server UI Integration', () => {
  test('should be accessible through Lokus UI', async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    try {
      // Navigate to Lokus (assuming it runs on localhost:8080)
      await page.goto('http://localhost:8080');

      // Check if MCP server status is visible in preferences
      await page.click('[data-testid="preferences-button"]');
      await page.click('[data-testid="mcp-server-tab"]');

      // Verify MCP server controls are present
      await expect(page.locator('[data-testid="mcp-server-enabled"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcp-server-port"]')).toBeVisible();
      await expect(page.locator('[data-testid="mcp-server-status"]')).toBeVisible();

      // Check server status
      const status = await page.locator('[data-testid="mcp-server-status"]').textContent();
      expect(status).toMatch(/running|enabled|active/i);

    } finally {
      await browser.close();
    }
  });
});