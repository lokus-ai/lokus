/**
 * Unit Tests for MCPProtocol
 * 
 * Tests the core MCP protocol implementation including:
 * - Message handling and validation
 * - Resource management
 * - Tool execution
 * - Prompt template processing
 * - Error handling
 * - Event emission
 */

import { jest } from '@jest/globals';
import { 
  MCPProtocol, 
  MCPMethod, 
  MCPErrorCode, 
  MCPResourceType,
  MCPResourceBuilder,
  MCPToolBuilder,
  MCPPromptBuilder
} from '../../src/plugins/mcp/MCPProtocol.js';
import { 
  MockWebSocket,
  TestDataGenerator,
  MCPAssertions,
  TestEnvironment
} from '../../src/mcp-server/utils/testUtils.js';

describe('MCPProtocol', () => {
  let protocol;
  let testEnv;

  beforeEach(() => {
    testEnv = new TestEnvironment();
    protocol = new MCPProtocol('test-server', {
      enableResourceSubscriptions: true,
      enableToolExecution: true,
      enablePromptTemplates: true
    });
  });

  afterEach(async () => {
    if (protocol) {
      protocol.dispose();
    }
    await testEnv.tearDown();
  });

  describe('Constructor and Initialization', () => {
    test('should create protocol instance with default options', () => {
      const defaultProtocol = new MCPProtocol('test-server');
      
      expect(defaultProtocol.serverId).toBe('test-server');
      expect(defaultProtocol.protocolVersion).toBe('2024-11-05');
      expect(defaultProtocol.isInitialized).toBe(false);
      expect(defaultProtocol.options.enableResourceSubscriptions).toBe(true);
      expect(defaultProtocol.options.enableToolExecution).toBe(true);
      expect(defaultProtocol.options.enablePromptTemplates).toBe(true);
    });

    test('should create protocol instance with custom options', () => {
      const customOptions = {
        enableResourceSubscriptions: false,
        enableToolExecution: false,
        enablePromptTemplates: false,
        maxConcurrentRequests: 100,
        requestTimeout: 60000
      };

      const customProtocol = new MCPProtocol('custom-server', customOptions);
      
      expect(customProtocol.options.enableResourceSubscriptions).toBe(false);
      expect(customProtocol.options.enableToolExecution).toBe(false);
      expect(customProtocol.options.enablePromptTemplates).toBe(false);
      expect(customProtocol.options.maxConcurrentRequests).toBe(100);
      expect(customProtocol.options.requestTimeout).toBe(60000);
    });

    test('should set up capabilities based on options', () => {
      expect(protocol.capabilities.resources.subscribe).toBe(true);
      expect(protocol.capabilities.tools.listChanged).toBe(true);
      expect(protocol.capabilities.prompts.listChanged).toBe(true);
      expect(protocol.capabilities.logging.enabled).toBe(true);
    });
  });

  describe('Message Handling', () => {
    test('should handle initialization request', async () => {
      const initRequest = TestDataGenerator.generateMCPMessage(MCPMethod.INITIALIZE, {
        protocolVersion: '2024-11-05',
        capabilities: { resources: { subscribe: true } },
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });

      const response = await protocol.handleMessage(initRequest);
      
      MCPAssertions.assertMCPResponse(response, initRequest.id);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.protocolVersion).toBe('2024-11-05');
      expect(parsedResponse.result.capabilities).toBeDefined();
      expect(parsedResponse.result.serverInfo).toBeDefined();
      expect(protocol.isInitialized).toBe(true);
    });

    test('should reject unsupported protocol version', async () => {
      const initRequest = TestDataGenerator.generateMCPMessage(MCPMethod.INITIALIZE, {
        protocolVersion: '1999-01-01',
        capabilities: {},
        clientInfo: { name: 'Test Client', version: '1.0.0' }
      });

      const response = await protocol.handleMessage(initRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.INVALID_REQUEST);
    });

    test('should handle malformed JSON gracefully', async () => {
      const malformedMessage = '{"jsonrpc": "2.0", "method": "test"';
      
      const response = await protocol.handleMessage(malformedMessage);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.INVALID_REQUEST);
    });

    test('should handle unknown methods', async () => {
      await protocol.initialize({ name: 'Test Client', version: '1.0.0' });

      const unknownRequest = TestDataGenerator.generateMCPMessage('unknown_method', {});
      
      const response = await protocol.handleMessage(unknownRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.METHOD_NOT_FOUND);
    });
  });

  describe('Resource Management', () => {
    beforeEach(async () => {
      await protocol.initialize({ name: 'Test Client', version: '1.0.0' });
    });

    test('should register resource successfully', () => {
      const resource = TestDataGenerator.generateResource();
      
      const registeredResource = protocol.registerResource(resource);
      
      expect(registeredResource).toEqual(resource);
      expect(protocol.resources.has(resource.uri)).toBe(true);
    });

    test('should validate resource structure', () => {
      const invalidResource = { name: 'Test', type: 'file' }; // missing uri
      
      expect(() => {
        protocol.registerResource(invalidResource);
      }).toThrow(/uri/i);
    });

    test('should emit resource-registered event', () => {
      const resource = TestDataGenerator.generateResource();
      const eventSpy = jest.fn();
      
      protocol.on('resource-registered', eventSpy);
      protocol.registerResource(resource);
      
      expect(eventSpy).toHaveBeenCalledWith(resource);
    });

    test('should handle resources list request', async () => {
      // Add test resources
      const resource1 = TestDataGenerator.generateResource({ name: 'Resource 1' });
      const resource2 = TestDataGenerator.generateResource({ name: 'Resource 2' });
      
      protocol.registerResource(resource1);
      protocol.registerResource(resource2);

      const listRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_LIST, {});
      
      const response = await protocol.handleMessage(listRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.resources).toHaveLength(2);
      expect(parsedResponse.result.resources[0]).toHaveProperty('uri');
      expect(parsedResponse.result.resources[0]).toHaveProperty('name');
      expect(parsedResponse.result.resources[0]).toHaveProperty('type');
    });

    test('should handle resource read request', async () => {
      const resource = TestDataGenerator.generateResource({
        content: 'Test content for reading'
      });
      
      protocol.registerResource(resource);

      const readRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_READ, {
        uri: resource.uri
      });
      
      const response = await protocol.handleMessage(readRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.contents).toHaveLength(1);
      expect(parsedResponse.result.contents[0].uri).toBe(resource.uri);
      expect(parsedResponse.result.contents[0].text).toBe(resource.content);
    });

    test('should handle resource not found', async () => {
      const readRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_READ, {
        uri: 'file:///non-existent-resource.txt'
      });
      
      const response = await protocol.handleMessage(readRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.RESOURCE_NOT_FOUND);
    });

    test('should update resource content', () => {
      const resource = TestDataGenerator.generateResource();
      protocol.registerResource(resource);

      const newContent = 'Updated content';
      const updatedResource = protocol.updateResource(resource.uri, newContent);
      
      expect(updatedResource.content).toBe(newContent);
      expect(updatedResource.lastModified).toBeDefined();
      expect(new Date(updatedResource.lastModified).getTime()).toBeGreaterThan(
        new Date(resource.lastModified).getTime()
      );
    });

    test('should unregister resource', () => {
      const resource = TestDataGenerator.generateResource();
      protocol.registerResource(resource);
      
      expect(protocol.resources.has(resource.uri)).toBe(true);
      
      const unregisteredResource = protocol.unregisterResource(resource.uri);
      
      expect(unregisteredResource).toEqual(resource);
      expect(protocol.resources.has(resource.uri)).toBe(false);
    });
  });

  describe('Resource Subscriptions', () => {
    beforeEach(async () => {
      await protocol.initialize({ name: 'Test Client', version: '1.0.0' });
    });

    test('should handle resource subscription', async () => {
      const resource = TestDataGenerator.generateResource();
      protocol.registerResource(resource);

      const subscribeRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_SUBSCRIBE, {
        uri: resource.uri
      });
      
      const response = await protocol.handleMessage(subscribeRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.subscribed).toBe(true);
      expect(protocol.subscriptions.has(resource.uri)).toBe(true);
    });

    test('should handle resource unsubscription', async () => {
      const resource = TestDataGenerator.generateResource();
      protocol.registerResource(resource);

      // Subscribe first
      await protocol.handleMessage(TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_SUBSCRIBE, {
        uri: resource.uri
      }));

      // Then unsubscribe
      const unsubscribeRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_UNSUBSCRIBE, {
        uri: resource.uri
      });
      
      const response = await protocol.handleMessage(unsubscribeRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.unsubscribed).toBe(true);
    });

    test('should emit notifications on resource updates', () => {
      const resource = TestDataGenerator.generateResource();
      protocol.registerResource(resource);

      // Set up subscription
      protocol.subscriptions.set(resource.uri, new Set(['client']));

      const notificationSpy = jest.fn();
      protocol.on('send-message', notificationSpy);

      // Update resource
      protocol.updateResource(resource.uri, 'Updated content');

      expect(notificationSpy).toHaveBeenCalled();
    });
  });

  describe('Tool Management', () => {
    beforeEach(async () => {
      await protocol.initialize({ name: 'Test Client', version: '1.0.0' });
    });

    test('should register tool successfully', () => {
      const tool = TestDataGenerator.generateTool();
      
      const registeredTool = protocol.registerTool(tool);
      
      expect(registeredTool).toEqual(tool);
      expect(protocol.tools.has(tool.name)).toBe(true);
    });

    test('should validate tool structure', () => {
      const invalidTool = { description: 'Test tool' }; // missing name
      
      expect(() => {
        protocol.registerTool(invalidTool);
      }).toThrow(/name/i);
    });

    test('should handle tools list request', async () => {
      const tool1 = TestDataGenerator.generateTool({ name: 'tool1' });
      const tool2 = TestDataGenerator.generateTool({ name: 'tool2' });
      
      protocol.registerTool(tool1);
      protocol.registerTool(tool2);

      const listRequest = TestDataGenerator.generateMCPMessage(MCPMethod.TOOLS_LIST, {});
      
      const response = await protocol.handleMessage(listRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.tools).toHaveLength(2);
      expect(parsedResponse.result.tools[0]).toHaveProperty('name');
      expect(parsedResponse.result.tools[0]).toHaveProperty('description');
      expect(parsedResponse.result.tools[0]).toHaveProperty('inputSchema');
    });

    test('should execute tool successfully', async () => {
      const tool = TestDataGenerator.generateTool({
        name: 'echo_tool',
        execute: async (args) => ({ output: `Echo: ${args.input}` })
      });
      
      protocol.registerTool(tool);

      const callRequest = TestDataGenerator.generateMCPMessage(MCPMethod.TOOLS_CALL, {
        name: 'echo_tool',
        arguments: { input: 'Hello World' }
      });
      
      const response = await protocol.handleMessage(callRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.isError).toBe(false);
      expect(parsedResponse.result.content).toHaveLength(1);
      expect(parsedResponse.result.content[0].text).toBe('Echo: Hello World');
    });

    test('should handle tool execution error', async () => {
      const tool = TestDataGenerator.generateTool({
        name: 'error_tool',
        execute: async () => { throw new Error('Tool execution failed'); }
      });
      
      protocol.registerTool(tool);

      const callRequest = TestDataGenerator.generateMCPMessage(MCPMethod.TOOLS_CALL, {
        name: 'error_tool',
        arguments: {}
      });
      
      const response = await protocol.handleMessage(callRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.isError).toBe(true);
      expect(parsedResponse.result.content[0].text).toContain('Tool execution failed');
    });

    test('should handle non-existent tool call', async () => {
      const callRequest = TestDataGenerator.generateMCPMessage(MCPMethod.TOOLS_CALL, {
        name: 'non_existent_tool',
        arguments: {}
      });
      
      const response = await protocol.handleMessage(callRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.TOOL_NOT_FOUND);
    });

    test('should validate tool arguments', async () => {
      const tool = TestDataGenerator.generateTool({
        name: 'strict_tool',
        inputSchema: {
          type: 'object',
          properties: {
            required_param: { type: 'string' }
          },
          required: ['required_param']
        }
      });
      
      protocol.registerTool(tool);

      const callRequest = TestDataGenerator.generateMCPMessage(MCPMethod.TOOLS_CALL, {
        name: 'strict_tool',
        arguments: {} // missing required_param
      });
      
      const response = await protocol.handleMessage(callRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.isError).toBe(true);
      expect(parsedResponse.result.content[0].text).toContain('required_param');
    });
  });

  describe('Prompt Management', () => {
    beforeEach(async () => {
      await protocol.initialize({ name: 'Test Client', version: '1.0.0' });
    });

    test('should register prompt template successfully', () => {
      const prompt = TestDataGenerator.generatePrompt();
      
      const registeredPrompt = protocol.registerPrompt(prompt);
      
      expect(registeredPrompt).toEqual(prompt);
      expect(protocol.prompts.has(prompt.name)).toBe(true);
    });

    test('should validate prompt structure', () => {
      const invalidPrompt = { description: 'Test prompt' }; // missing name
      
      expect(() => {
        protocol.registerPrompt(invalidPrompt);
      }).toThrow(/name/i);
    });

    test('should handle prompts list request', async () => {
      const prompt1 = TestDataGenerator.generatePrompt({ name: 'prompt1' });
      const prompt2 = TestDataGenerator.generatePrompt({ name: 'prompt2' });
      
      protocol.registerPrompt(prompt1);
      protocol.registerPrompt(prompt2);

      const listRequest = TestDataGenerator.generateMCPMessage(MCPMethod.PROMPTS_LIST, {});
      
      const response = await protocol.handleMessage(listRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.prompts).toHaveLength(2);
      expect(parsedResponse.result.prompts[0]).toHaveProperty('name');
      expect(parsedResponse.result.prompts[0]).toHaveProperty('description');
    });

    test('should render prompt template', async () => {
      const prompt = TestDataGenerator.generatePrompt({
        name: 'greeting_prompt',
        template: 'Hello {{name}}, welcome to {{service}}!',
        arguments: [
          { name: 'name', description: 'User name', required: true },
          { name: 'service', description: 'Service name', required: true }
        ]
      });
      
      protocol.registerPrompt(prompt);

      const getRequest = TestDataGenerator.generateMCPMessage(MCPMethod.PROMPTS_GET, {
        name: 'greeting_prompt',
        arguments: { name: 'John', service: 'Lokus' }
      });
      
      const response = await protocol.handleMessage(getRequest);
      
      MCPAssertions.assertMCPResponse(response);
      
      const parsedResponse = JSON.parse(response);
      expect(parsedResponse.result.messages).toHaveLength(1);
      expect(parsedResponse.result.messages[0].content.text).toBe('Hello John, welcome to Lokus!');
    });

    test('should handle non-existent prompt', async () => {
      const getRequest = TestDataGenerator.generateMCPMessage(MCPMethod.PROMPTS_GET, {
        name: 'non_existent_prompt',
        arguments: {}
      });
      
      const response = await protocol.handleMessage(getRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.PROMPT_NOT_FOUND);
    });
  });

  describe('Builder Classes', () => {
    test('MCPResourceBuilder should build valid resource', () => {
      const resource = new MCPResourceBuilder()
        .setUri('file:///test/document.md')
        .setName('Test Document')
        .setDescription('A test document')
        .setType(MCPResourceType.FILE)
        .setMimeType('text/markdown')
        .setContent('# Test\n\nContent')
        .setMetadata({ tags: ['test'] })
        .build();

      MCPAssertions.assertResource(resource, {
        uri: 'file:///test/document.md',
        name: 'Test Document',
        type: 'file'
      });
      
      expect(resource.content).toBe('# Test\n\nContent');
      expect(resource.metadata.tags).toEqual(['test']);
      expect(resource.lastModified).toBeDefined();
    });

    test('MCPToolBuilder should build valid tool', () => {
      const executeFn = async (args) => ({ result: args.input });
      
      const tool = new MCPToolBuilder()
        .setName('test_tool')
        .setDescription('A test tool')
        .setInputSchema({
          type: 'object',
          properties: { input: { type: 'string' } }
        })
        .setExecutor(executeFn)
        .build();

      MCPAssertions.assertTool(tool, {
        name: 'test_tool',
        description: 'A test tool'
      });
      
      expect(tool.execute).toBe(executeFn);
    });

    test('MCPPromptBuilder should build valid prompt', () => {
      const prompt = new MCPPromptBuilder()
        .setName('test_prompt')
        .setDescription('A test prompt')
        .setTemplate('Hello {{name}}!')
        .setArguments([
          { name: 'name', description: 'User name', required: true }
        ])
        .build();

      MCPAssertions.assertPrompt(prompt, {
        name: 'test_prompt',
        description: 'A test prompt'
      });
      
      expect(prompt.template).toBe('Hello {{name}}!');
      expect(prompt.arguments).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    test('should create proper error objects', () => {
      const error = protocol.createError(
        MCPErrorCode.RESOURCE_NOT_FOUND,
        'Resource not found',
        { uri: 'file:///test.txt' }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe(MCPErrorCode.RESOURCE_NOT_FOUND);
      expect(error.message).toBe('Resource not found');
      expect(error.data).toEqual({ uri: 'file:///test.txt' });
    });

    test('should handle errors in message processing', async () => {
      // Mock the method handler to throw an error
      const originalHandler = protocol.handleResourcesList;
      protocol.handleResourcesList = jest.fn().mockRejectedValue(new Error('Internal error'));

      const listRequest = TestDataGenerator.generateMCPMessage(MCPMethod.RESOURCES_LIST, {});
      
      const response = await protocol.handleMessage(listRequest);
      
      MCPAssertions.assertMCPError(response, MCPErrorCode.INTERNAL_ERROR);
      
      // Restore original handler
      protocol.handleResourcesList = originalHandler;
    });
  });

  describe('Statistics and Monitoring', () => {
    test('should provide protocol statistics', () => {
      const resource = TestDataGenerator.generateResource();
      const tool = TestDataGenerator.generateTool();
      const prompt = TestDataGenerator.generatePrompt();
      
      protocol.registerResource(resource);
      protocol.registerTool(tool);
      protocol.registerPrompt(prompt);

      const stats = protocol.getStats();
      
      expect(stats).toHaveProperty('protocolVersion', '2024-11-05');
      expect(stats).toHaveProperty('isInitialized', false);
      expect(stats).toHaveProperty('resourceCount', 1);
      expect(stats).toHaveProperty('toolCount', 1);
      expect(stats).toHaveProperty('promptCount', 1);
      expect(stats).toHaveProperty('subscriptionCount', 0);
      expect(stats).toHaveProperty('capabilities');
    });
  });

  describe('Disposal and Cleanup', () => {
    test('should clean up resources on disposal', () => {
      const resource = TestDataGenerator.generateResource();
      const tool = TestDataGenerator.generateTool();
      const prompt = TestDataGenerator.generatePrompt();
      
      protocol.registerResource(resource);
      protocol.registerTool(tool);
      protocol.registerPrompt(prompt);
      
      expect(protocol.resources.size).toBe(1);
      expect(protocol.tools.size).toBe(1);
      expect(protocol.prompts.size).toBe(1);

      const disposedSpy = jest.fn();
      protocol.on('disposed', disposedSpy);

      protocol.dispose();
      
      expect(protocol.resources.size).toBe(0);
      expect(protocol.tools.size).toBe(0);
      expect(protocol.prompts.size).toBe(0);
      expect(protocol.isInitialized).toBe(false);
      expect(disposedSpy).toHaveBeenCalled();
    });
  });
});