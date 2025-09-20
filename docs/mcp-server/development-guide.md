# MCP Server Development Guide

## Overview

This guide covers how to develop, extend, and contribute to the Lokus MCP (Model Context Protocol) server. Whether you're adding new features, creating plugins, or contributing to the core system, this document will help you get started.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Architecture Overview](#architecture-overview)
- [Core Components](#core-components)
- [Adding New Features](#adding-new-features)
- [Plugin Development](#plugin-development)
- [Testing](#testing)
- [Performance Optimization](#performance-optimization)
- [Security Considerations](#security-considerations)
- [Contributing Guidelines](#contributing-guidelines)

## Development Environment Setup

### Prerequisites

- Node.js 18+ 
- Rust 1.70+ (for Tauri backend)
- Git
- Code editor (VS Code recommended)

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/lokus-ai/lokus.git
cd lokus

# Install dependencies
npm install

# Install Rust dependencies
cd src-tauri
cargo build
cd ..

# Set up development environment
cp .env.example .env
```

### Development Tools

```bash
# Install recommended VS Code extensions
code --install-extension rust-lang.rust-analyzer
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension bradlc.vscode-tailwindcss

# Install development utilities
npm install -g @playwright/test
npm install -g jest
```

### Environment Configuration

Create a `.env` file with development settings:

```bash
# Development Configuration
NODE_ENV=development
MCP_SERVER_PORT=3001
MCP_SERVER_HOST=localhost
DEBUG=lokus:mcp:*

# Security Settings
MCP_ENABLE_CORS=true
MCP_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080

# Plugin Development
PLUGIN_DEV_MODE=true
PLUGIN_HOT_RELOAD=true

# Testing
TEST_WORKSPACE_PATH=/tmp/lokus-test-workspace
TEST_API_KEY=dev-test-key-12345
```

### Running in Development Mode

```bash
# Start the full development server
npm run tauri dev

# Or run components separately:

# Frontend only
npm run dev

# Backend only  
cd src-tauri && cargo run

# MCP server only
npm run mcp:dev
```

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Lokus Application                         │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Editor    │  │   Plugin    │  │    MCP Server       │  │
│  │   System    │  │   Manager   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Core Services                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ File System │  │ Search      │  │   Security          │  │
│  │ Manager     │  │ Service     │  │   Manager           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  Tauri Backend                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   IPC       │  │ File API    │  │   System            │  │
│  │ Bridge      │  │             │  │   Integration       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### MCP Server Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   MCP Server Host                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ WebSocket   │  │ HTTP/REST   │  │   Health            │  │
│  │ Transport   │  │ API         │  │   Monitor           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                  MCP Protocol Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Resource    │  │ Tool        │  │   Prompt            │  │
│  │ Manager     │  │ Executor    │  │   Templates         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│                   Plugin Integration                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Plugin      │  │ Sandbox     │  │   Communication     │  │
│  │ Manager     │  │ Runtime     │  │   Bridge            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### MCPProtocol Class

The main protocol implementation handling JSON-RPC 2.0 messaging:

```javascript
// src/plugins/mcp/MCPProtocol.js
export class MCPProtocol extends EventEmitter {
  constructor(serverId, options = {}) {
    super();
    this.serverId = serverId;
    this.protocolVersion = MCP_PROTOCOL_VERSION;
    // ... initialization
  }

  // Core methods to implement when extending:
  async handleInitialize(params) { /* ... */ }
  async handleResourcesList(params) { /* ... */ }
  async handleToolsCall(params) { /* ... */ }
}
```

**Key extension points:**
- Custom message handlers via `registerMethodHandler()`
- Resource providers via `registerResource()`
- Tool implementations via `registerTool()`
- Event listeners for protocol events

### MCPServerHost Class

Manages server instances and process isolation:

```javascript
// src/plugins/mcp/MCPServerHost.js
export class MCPServerHost extends EventEmitter {
  async startServer(serverId, config) {
    // Creates sandboxed server instances
    // Handles different server types (internal, external, embedded)
    // Sets up communication channels
  }

  async stopServer(serverId, force = false) {
    // Graceful shutdown with optional force
    // Resource cleanup
    // Event notification
  }
}
```

**Extension points:**
- Custom server types via `startServerProcess()`
- Health check implementations
- Resource monitoring hooks

### Plugin Integration

MCP plugins follow the standard Lokus plugin architecture:

```javascript
// Example MCP Plugin Structure
export class MCPPlugin {
  constructor(config) {
    this.mcpResources = new Map();
    this.mcpTools = new Map();
    this.mcpPrompts = new Map();
  }

  async activate(context) {
    // Register MCP resources, tools, and prompts
    this.registerMCPCapabilities(context.mcpApi);
  }

  registerMCPCapabilities(mcpApi) {
    // Register resources
    mcpApi.registerResource({
      uri: 'plugin://my-plugin/data',
      name: 'Plugin Data',
      type: 'custom',
      provider: this.provideData.bind(this)
    });

    // Register tools
    mcpApi.registerTool({
      name: 'my_plugin_tool',
      description: 'Custom plugin tool',
      inputSchema: { /* JSON Schema */ },
      execute: this.executeTool.bind(this)
    });
  }
}
```

## Adding New Features

### Adding a New Resource Type

1. **Define the resource type:**

```javascript
// src/plugins/mcp/MCPProtocol.js
export const MCPResourceType = {
  // ... existing types
  CALENDAR: 'calendar',
  EMAIL: 'email'
};
```

2. **Create resource provider:**

```javascript
// src/plugins/mcp/providers/CalendarResourceProvider.js
export class CalendarResourceProvider {
  constructor(calendarService) {
    this.calendarService = calendarService;
  }

  async listResources() {
    const events = await this.calendarService.getEvents();
    return events.map(event => ({
      uri: `calendar://events/${event.id}`,
      name: event.title,
      type: MCPResourceType.CALENDAR,
      mimeType: 'application/json',
      lastModified: event.updatedAt
    }));
  }

  async readResource(uri) {
    const eventId = this.extractEventId(uri);
    const event = await this.calendarService.getEvent(eventId);
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(event, null, 2)
    };
  }
}
```

3. **Register the provider:**

```javascript
// In plugin activation or server startup
const calendarProvider = new CalendarResourceProvider(calendarService);
mcpProtocol.registerResourceProvider(MCPResourceType.CALENDAR, calendarProvider);
```

### Adding a New Tool

1. **Define tool schema:**

```javascript
// tools/EmailTool.js
export class EmailTool {
  static get schema() {
    return {
      name: 'send_email',
      description: 'Send an email message',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', format: 'email' },
          subject: { type: 'string' },
          body: { type: 'string' }
        },
        required: ['to', 'subject', 'body']
      }
    };
  }

  constructor(emailService) {
    this.emailService = emailService;
  }

  async execute(args) {
    const { to, subject, body } = args;
    
    try {
      const result = await this.emailService.sendEmail({
        to, subject, body
      });
      
      return {
        output: `Email sent successfully. Message ID: ${result.messageId}`
      };
    } catch (error) {
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
}
```

2. **Register the tool:**

```javascript
const emailTool = new EmailTool(emailService);
mcpProtocol.registerTool({
  ...EmailTool.schema,
  execute: emailTool.execute.bind(emailTool)
});
```

### Adding a New Transport

1. **Implement transport interface:**

```javascript
// src/plugins/mcp/transports/HTTPTransport.js
export class HTTPTransport extends EventEmitter {
  constructor(options) {
    super();
    this.port = options.port;
    this.host = options.host;
    this.server = null;
  }

  async start() {
    this.server = express();
    this.setupRoutes();
    
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        this.emit('listening', { port: this.port, host: this.host });
        resolve();
      });
    });
  }

  setupRoutes() {
    this.server.post('/mcp', this.handleRequest.bind(this));
    this.server.get('/health', this.handleHealth.bind(this));
  }

  async handleRequest(req, res) {
    try {
      const response = await this.processMessage(req.body);
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  processMessage(message) {
    return new Promise((resolve, reject) => {
      this.emit('message', message, (response) => {
        resolve(response);
      });
    });
  }
}
```

2. **Register transport:**

```javascript
const httpTransport = new HTTPTransport({ port: 3001, host: 'localhost' });
mcpServerHost.registerTransport('http', httpTransport);
```

## Plugin Development

### MCP Plugin Template

Use the MCP plugin template to create new plugins:

```bash
# Create new MCP plugin
npm run create-plugin -- --type=mcp --name=my-mcp-plugin

# Or manually:
mkdir src/plugins/my-mcp-plugin
cd src/plugins/my-mcp-plugin
```

### Plugin Structure

```
src/plugins/my-mcp-plugin/
├── plugin.json              # Plugin metadata
├── src/
│   ├── index.js             # Main plugin entry point
│   ├── resources/           # Resource providers
│   │   └── MyResourceProvider.js
│   ├── tools/               # Tool implementations
│   │   └── MyTool.js
│   ├── prompts/             # Prompt templates
│   │   └── my-prompts.json
│   └── utils/               # Utility functions
│       └── helpers.js
├── tests/                   # Plugin tests
│   ├── integration/
│   └── unit/
└── docs/                    # Plugin documentation
    └── README.md
```

### Plugin Manifest

```json
{
  "name": "my-mcp-plugin",
  "version": "1.0.0",
  "description": "My custom MCP plugin",
  "author": "Your Name",
  "license": "MIT",
  "main": "src/index.js",
  "type": "mcp",
  "capabilities": {
    "resources": ["custom"],
    "tools": ["my_tool"],
    "prompts": ["my_prompt"]
  },
  "permissions": {
    "filesystem": "read",
    "network": "limited",
    "system": "none"
  },
  "dependencies": {
    "axios": "^1.0.0"
  }
}
```

### Plugin Implementation

```javascript
// src/plugins/my-mcp-plugin/src/index.js
import { MCPPlugin } from '../../../mcp/MCPPlugin.js';
import { MyResourceProvider } from './resources/MyResourceProvider.js';
import { MyTool } from './tools/MyTool.js';

export class MyMCPPlugin extends MCPPlugin {
  constructor(config) {
    super(config);
    this.resourceProvider = new MyResourceProvider(config);
    this.tool = new MyTool(config);
  }

  async activate(context) {
    const mcpApi = context.getMCPAPI();

    // Register resources
    await this.registerResources(mcpApi);
    
    // Register tools
    await this.registerTools(mcpApi);
    
    // Register prompts
    await this.registerPrompts(mcpApi);

    this.logger.info('My MCP Plugin activated');
  }

  async registerResources(mcpApi) {
    const resources = await this.resourceProvider.discoverResources();
    
    for (const resource of resources) {
      mcpApi.registerResource({
        uri: resource.uri,
        name: resource.name,
        type: 'custom',
        provider: this.resourceProvider.readResource.bind(this.resourceProvider)
      });
    }
  }

  async registerTools(mcpApi) {
    mcpApi.registerTool({
      name: 'my_tool',
      description: 'My custom tool',
      inputSchema: this.tool.schema,
      execute: this.tool.execute.bind(this.tool)
    });
  }

  async deactivate() {
    // Cleanup resources
    await this.resourceProvider.cleanup();
    this.logger.info('My MCP Plugin deactivated');
  }
}

// Export plugin factory
export default function createPlugin(config) {
  return new MyMCPPlugin(config);
}
```

### Resource Provider Implementation

```javascript
// src/plugins/my-mcp-plugin/src/resources/MyResourceProvider.js
export class MyResourceProvider {
  constructor(config) {
    this.config = config;
    this.cache = new Map();
  }

  async discoverResources() {
    // Discover available resources
    // Return array of resource metadata
    return [
      {
        uri: 'custom://my-plugin/resource1',
        name: 'My Resource 1',
        description: 'Description of resource 1'
      }
    ];
  }

  async readResource(uri) {
    // Implement resource reading logic
    const resourceId = this.extractResourceId(uri);
    
    if (this.cache.has(resourceId)) {
      return this.cache.get(resourceId);
    }

    const content = await this.fetchResourceContent(resourceId);
    this.cache.set(resourceId, content);
    
    return {
      uri,
      mimeType: 'application/json',
      text: JSON.stringify(content, null, 2)
    };
  }

  async subscribeToChanges(uri, callback) {
    // Implement change subscription if supported
    const resourceId = this.extractResourceId(uri);
    // Set up file watcher, webhook, or polling
  }

  extractResourceId(uri) {
    return uri.split('/').pop();
  }

  async fetchResourceContent(resourceId) {
    // Implement actual resource fetching
    throw new Error('Not implemented');
  }

  async cleanup() {
    this.cache.clear();
  }
}
```

## Testing

### Unit Tests

```javascript
// tests/unit/MCPProtocol.test.js
import { MCPProtocol } from '../../src/plugins/mcp/MCPProtocol.js';
import { TestDataGenerator, MCPAssertions } from '../utils/testUtils.js';

describe('MCPProtocol', () => {
  let protocol;

  beforeEach(() => {
    protocol = new MCPProtocol('test-server');
  });

  test('should handle resource registration', () => {
    const resource = TestDataGenerator.generateResource();
    
    const result = protocol.registerResource(resource);
    
    MCPAssertions.assertResource(result);
    expect(protocol.resources.has(resource.uri)).toBe(true);
  });
});
```

### Integration Tests

```javascript
// tests/integration/mcp-plugin.test.js
import { MCPTestEnvironment } from '../utils/testUtils.js';
import { MyMCPPlugin } from '../../src/plugins/my-mcp-plugin/src/index.js';

describe('My MCP Plugin Integration', () => {
  let testEnv;
  let plugin;

  beforeEach(async () => {
    testEnv = new MCPTestEnvironment();
    plugin = new MyMCPPlugin({ testMode: true });
    await testEnv.setupPlugin(plugin);
  });

  afterEach(async () => {
    await testEnv.cleanup();
  });

  test('should register resources correctly', async () => {
    await plugin.activate(testEnv.context);
    
    const resources = await testEnv.mcpClient.listResources();
    expect(resources.length).toBeGreaterThan(0);
  });
});
```

### E2E Tests

```javascript
// tests/e2e/mcp-workflow.spec.js
import { test, expect } from '@playwright/test';
import { MCPTestClient } from '../utils/testUtils.js';

test.describe('MCP Workflow', () => {
  test('should complete full resource discovery and usage workflow', async () => {
    const client = new MCPTestClient();
    await client.connect();
    
    // Initialize
    await client.initialize();
    
    // Discover resources
    const resources = await client.listResources();
    expect(resources.length).toBeGreaterThan(0);
    
    // Read resource
    const content = await client.readResource(resources[0].uri);
    expect(content).toBeDefined();
    
    // Execute tool
    const result = await client.callTool('search_files', {
      query: 'test'
    });
    expect(result.isError).toBe(false);
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch

# Run performance tests
npm run test:performance
```

## Performance Optimization

### Profiling

```javascript
// utils/profiler.js
export class MCPProfiler {
  constructor() {
    this.metrics = new Map();
  }

  startTimer(operation) {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  recordMetric(operation, value) {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }
    this.metrics.get(operation).push(value);
  }

  getStats(operation) {
    const values = this.metrics.get(operation) || [];
    return {
      count: values.length,
      average: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values)
    };
  }
}

// Usage in MCP Protocol
const profiler = new MCPProfiler();

async handleResourcesList(params) {
  const timer = profiler.startTimer('resources/list');
  
  try {
    const result = await this.doResourcesList(params);
    return result;
  } finally {
    timer();
  }
}
```

### Caching Strategies

```javascript
// utils/cache.js
export class MCPCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.ttl = options.ttl || 300000; // 5 minutes
    this.maxSize = options.maxSize || 1000;
    this.timers = new Map();
  }

  set(key, value, customTTL = null) {
    // Evict old entries if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });

    // Set expiration timer
    const ttl = customTTL || this.ttl;
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl);
    
    this.timers.set(key, timer);
  }

  get(key) {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key) {
    this.cache.delete(key);
    
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
  }

  clear() {
    this.cache.clear();
    this.timers.forEach(timer => clearTimeout(timer));
    this.timers.clear();
  }

  evictOldest() {
    const oldestKey = this.cache.keys().next().value;
    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}
```

### Memory Management

```javascript
// Monitor memory usage
export class MemoryMonitor {
  constructor(thresholdMB = 500) {
    this.threshold = thresholdMB * 1024 * 1024;
    this.checkInterval = setInterval(() => {
      this.checkMemory();
    }, 30000); // Check every 30 seconds
  }

  checkMemory() {
    const usage = process.memoryUsage();
    
    if (usage.heapUsed > this.threshold) {
      console.warn(`High memory usage: ${Math.round(usage.heapUsed / 1024 / 1024)}MB`);
      
      // Trigger garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      // Emit warning event
      this.emit('high-memory', usage);
    }
  }

  dispose() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
  }
}
```

## Security Considerations

### Input Validation

```javascript
// utils/validators.js
export class MCPValidators {
  static validateResourceURI(uri) {
    // Validate URI format and prevent path traversal
    const uriPattern = /^[a-z]+:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=%]+$/;
    
    if (!uriPattern.test(uri)) {
      throw new Error('Invalid URI format');
    }

    // Prevent path traversal
    if (uri.includes('..') || uri.includes('~')) {
      throw new Error('Invalid URI: path traversal detected');
    }

    return true;
  }

  static validateToolArguments(tool, args) {
    // Validate against JSON schema
    const validator = new JSONSchemaValidator(tool.inputSchema);
    const result = validator.validate(args);
    
    if (!result.valid) {
      throw new Error(`Invalid arguments: ${result.errors.join(', ')}`);
    }

    return true;
  }

  static sanitizeContent(content) {
    // Remove potential XSS content
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }
}
```

### Authentication and Authorization

```javascript
// security/auth.js
export class MCPAuthManager {
  constructor(config) {
    this.config = config;
    this.apiKeys = new Map();
    this.permissions = new Map();
  }

  async validateRequest(request, requiredPermission) {
    const token = this.extractToken(request);
    
    if (!token) {
      throw new Error('Authentication required');
    }

    const user = await this.validateToken(token);
    
    if (!this.hasPermission(user, requiredPermission)) {
      throw new Error('Insufficient permissions');
    }

    return user;
  }

  extractToken(request) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }
    
    return request.headers['x-api-key'];
  }

  async validateToken(token) {
    // Validate API key or JWT token
    if (this.apiKeys.has(token)) {
      return this.apiKeys.get(token);
    }

    // JWT validation logic here
    throw new Error('Invalid token');
  }

  hasPermission(user, permission) {
    const userPermissions = this.permissions.get(user.id) || [];
    return userPermissions.includes(permission) || userPermissions.includes('admin');
  }
}
```

### Sandboxing

```javascript
// security/sandbox.js
export class MCPSandbox {
  constructor(options) {
    this.options = options;
    this.resourceLimits = {
      memory: options.maxMemory || 100 * 1024 * 1024, // 100MB
      cpu: options.maxCPU || 1000, // 1 second
      networkCalls: options.maxNetworkCalls || 10
    };
  }

  async executeInSandbox(code, context) {
    const vm = new VM({
      timeout: this.resourceLimits.cpu,
      sandbox: this.createSandboxContext(context)
    });

    try {
      return await vm.run(code);
    } catch (error) {
      if (error.message.includes('timeout')) {
        throw new Error('Execution time limit exceeded');
      }
      throw error;
    }
  }

  createSandboxContext(context) {
    return {
      // Provide safe APIs only
      console: {
        log: (...args) => context.logger.info(...args),
        error: (...args) => context.logger.error(...args)
      },
      
      // Limited file system access
      fs: this.createLimitedFS(context),
      
      // No direct network access
      fetch: undefined,
      XMLHttpRequest: undefined
    };
  }

  createLimitedFS(context) {
    return {
      readFile: (path) => {
        if (!this.isPathAllowed(path)) {
          throw new Error('File access denied');
        }
        return context.fs.readFile(path);
      }
    };
  }

  isPathAllowed(path) {
    const allowedPaths = this.options.allowedPaths || [];
    return allowedPaths.some(allowed => path.startsWith(allowed));
  }
}
```

## Contributing Guidelines

### Code Style

We use ESLint and Prettier for code formatting:

```javascript
// .eslintrc.js
module.exports = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    'no-console': 'warn',
    'prefer-const': 'error',
    'no-unused-vars': 'error'
  }
};
```

### Commit Guidelines

We follow Conventional Commits:

```bash
# Examples
feat(mcp): add calendar resource provider
fix(mcp): resolve memory leak in resource cache
docs(mcp): update development guide
test(mcp): add integration tests for tool execution
```

### Pull Request Process

1. **Fork and Branch**
   ```bash
   git fork https://github.com/lokus-ai/lokus.git
   git checkout -b feature/my-new-feature
   ```

2. **Develop and Test**
   ```bash
   # Make changes
   npm run test
   npm run lint
   npm run build
   ```

3. **Submit PR**
   - Write clear description
   - Include tests for new features
   - Update documentation
   - Link related issues

4. **Review Process**
   - Code review by maintainers
   - Automated tests must pass
   - Documentation review
   - Final approval and merge

### Release Process

1. **Version Bump**
   ```bash
   npm version patch|minor|major
   ```

2. **Generate Changelog**
   ```bash
   npm run changelog
   ```

3. **Create Release**
   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

4. **Automated Deployment**
   - GitHub Actions builds and tests
   - Artifacts published to npm
   - Documentation updated

### Documentation

All new features must include:

- API documentation in JSDoc format
- User guide updates
- Example code
- Test coverage

### Issue Reporting

When reporting bugs:

1. Use the bug report template
2. Include reproduction steps
3. Provide environment details
4. Attach relevant logs
5. Add performance impact if applicable

## Resources

### Documentation
- [MCP Specification](https://spec.modelcontextprotocol.org/)
- [Lokus Plugin API](../plugins/README.md)
- [Testing Guide](./testing.md)

### Tools
- [MCP Inspector](https://github.com/modelcontextprotocol/inspector)
- [MCP Client Library](https://npmjs.com/package/@modelcontextprotocol/client)
- [VS Code Extension](https://marketplace.visualstudio.com/items?itemName=lokus.mcp-dev)

### Community
- [Discord Server](https://discord.gg/lokus)
- [GitHub Discussions](https://github.com/lokus-ai/lokus/discussions)
- [Developer Forum](https://forum.lokus.ai/c/development)

---

This development guide is a living document. Please contribute improvements and keep it updated as the project evolves.