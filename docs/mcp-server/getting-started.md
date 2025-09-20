# Getting Started with Lokus MCP Server

## Introduction

The Lokus Model Context Protocol (MCP) server enables AI assistants to seamlessly integrate with your Lokus workspace. This guide will walk you through setting up and using the MCP server for the first time.

## What is MCP?

Model Context Protocol (MCP) is an open standard that allows AI assistants to:

- **Access Resources**: Read and subscribe to content in your workspace
- **Execute Tools**: Perform actions like searching, creating files, and running plugins
- **Use Prompts**: Apply pre-configured templates for common AI tasks
- **Stay Updated**: Receive real-time notifications about content changes

## Prerequisites

- Lokus installed and running
- Node.js 16+ (for JavaScript examples)
- Python 3.8+ (for Python examples)
- Basic understanding of JSON-RPC 2.0

## Quick Setup

### 1. Enable MCP Server in Lokus

1. Open Lokus
2. Go to **Preferences** → **Advanced** → **MCP Server**
3. Enable "Start MCP Server"
4. Set port (default: 3001)
5. Configure authentication (optional but recommended)
6. Click "Save" and restart Lokus

### 2. Verify Server is Running

```bash
# Check if server is responding
curl http://localhost:3001/api/mcp/health

# Expected response:
# {"status": "healthy", "version": "1.0.0"}
```

### 3. Get API Key (Recommended)

1. In Lokus, go to **Preferences** → **API Keys**
2. Click "Generate New Key"
3. Give it a name (e.g., "My AI Assistant")
4. Copy the generated key
5. Store it securely

## Your First MCP Connection

### Using JavaScript/Node.js

```javascript
// install: npm install ws
const WebSocket = require('ws');

async function connectToLokus() {
  const ws = new WebSocket('ws://localhost:3001/mcp');
  
  ws.on('open', async () => {
    console.log('Connected to Lokus MCP server');
    
    // Initialize the session
    const initMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {
          resources: { subscribe: true },
          tools: { listChanged: true }
        },
        clientInfo: {
          name: 'My First MCP Client',
          version: '1.0.0'
        }
      }
    };
    
    ws.send(JSON.stringify(initMessage));
  });
  
  ws.on('message', (data) => {
    const message = JSON.parse(data.toString());
    console.log('Received:', message);
    
    if (message.id === 1) {
      // Initialization response
      console.log('Server capabilities:', message.result.capabilities);
      
      // Now we can make other requests
      listResources(ws);
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
}

function listResources(ws) {
  const message = {
    jsonrpc: '2.0',
    id: 2,
    method: 'resources/list',
    params: {}
  };
  
  ws.send(JSON.stringify(message));
}

connectToLokus();
```

### Using Python

```python
# install: pip install websockets
import asyncio
import json
import websockets

async def connect_to_lokus():
    uri = "ws://localhost:3001/mcp"
    
    async with websockets.connect(uri) as ws:
        print("Connected to Lokus MCP server")
        
        # Initialize session
        init_message = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "resources": {"subscribe": True},
                    "tools": {"listChanged": True}
                },
                "clientInfo": {
                    "name": "My Python MCP Client",
                    "version": "1.0.0"
                }
            }
        }
        
        await ws.send(json.dumps(init_message))
        
        # Listen for responses
        async for message in ws:
            data = json.loads(message)
            print(f"Received: {data}")
            
            if data.get("id") == 1:
                # Initialization response
                print(f"Server capabilities: {data['result']['capabilities']}")
                
                # List available resources
                await list_resources(ws)

async def list_resources(ws):
    message = {
        "jsonrpc": "2.0",
        "id": 2,
        "method": "resources/list",
        "params": {}
    }
    
    await ws.send(json.dumps(message))

# Run the client
asyncio.run(connect_to_lokus())
```

### Using HTTP/REST

```bash
# Initialize session
curl -X POST http://localhost:3001/api/mcp/initialize \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key-here" \
  -d '{
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "resources": {"subscribe": true}
    },
    "clientInfo": {
      "name": "cURL Client",
      "version": "1.0.0"
    }
  }'

# List resources
curl -X GET http://localhost:3001/api/mcp/resources/list \
  -H "X-API-Key: your-api-key-here"
```

## Common Use Cases

### 1. Reading Workspace Content

```javascript
// Read a specific file
const readMessage = {
  jsonrpc: '2.0',
  id: 3,
  method: 'resources/read',
  params: {
    uri: 'file:///workspace/notes/project-plan.md'
  }
};

ws.send(JSON.stringify(readMessage));
```

### 2. Searching for Files

```javascript
// Search for files containing "meeting"
const searchMessage = {
  jsonrpc: '2.0',
  id: 4,
  method: 'tools/call',
  params: {
    name: 'search_files',
    arguments: {
      query: 'meeting',
      fileTypes: ['md', 'txt']
    }
  }
};

ws.send(JSON.stringify(searchMessage));
```

### 3. Creating New Content

```javascript
// Create a new note
const createMessage = {
  jsonrpc: '2.0',
  id: 5,
  method: 'tools/call',
  params: {
    name: 'create_file',
    arguments: {
      path: '/workspace/notes/new-idea.md',
      content: '# New Idea\n\nThis is a great idea!'
    }
  }
};

ws.send(JSON.stringify(createMessage));
```

### 4. Using Prompt Templates

```javascript
// Get a summarization prompt
const promptMessage = {
  jsonrpc: '2.0',
  id: 6,
  method: 'prompts/get',
  params: {
    name: 'summarize_content',
    arguments: {
      content: 'Long article content here...',
      maxLength: 200
    }
  }
};

ws.send(JSON.stringify(promptMessage));
```

### 5. Subscribing to Changes

```javascript
// Subscribe to changes in a specific file
const subscribeMessage = {
  jsonrpc: '2.0',
  id: 7,
  method: 'resources/subscribe',
  params: {
    uri: 'file:///workspace/notes/project-plan.md'
  }
};

ws.send(JSON.stringify(subscribeMessage));

// Listen for update notifications
ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.method === 'notifications/resources/updated') {
    console.log('Resource updated:', message.params.uri);
    console.log('New content:', message.params.content);
  }
});
```

## Building Your First MCP Application

Let's build a simple AI-powered note summarizer:

### Complete Example: Note Summarizer

```javascript
const WebSocket = require('ws');

class NoteSummarizer {
  constructor(apiKey) {
    this.ws = null;
    this.apiKey = apiKey;
    this.messageId = 1;
    this.pendingRequests = new Map();
  }
  
  async connect() {
    this.ws = new WebSocket('ws://localhost:3001/mcp');
    
    return new Promise((resolve, reject) => {
      this.ws.on('open', () => {
        console.log('✅ Connected to Lokus MCP server');
        this.initialize().then(resolve).catch(reject);
      });
      
      this.ws.on('message', (data) => {
        this.handleMessage(JSON.parse(data.toString()));
      });
      
      this.ws.on('error', reject);
    });
  }
  
  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        resources: { subscribe: false },
        tools: { listChanged: false }
      },
      clientInfo: {
        name: 'Note Summarizer',
        version: '1.0.0'
      }
    });
    
    console.log('✅ Initialized with server');
    return response;
  }
  
  async sendRequest(method, params) {
    const id = this.messageId++;
    const message = {
      jsonrpc: '2.0',
      id,
      method,
      params
    };
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(message));
    });
  }
  
  handleMessage(message) {
    if (message.id && this.pendingRequests.has(message.id)) {
      const { resolve, reject } = this.pendingRequests.get(message.id);
      this.pendingRequests.delete(message.id);
      
      if (message.error) {
        reject(new Error(message.error.message));
      } else {
        resolve(message.result);
      }
    }
  }
  
  async findMarkdownFiles() {
    const response = await this.sendRequest('tools/call', {
      name: 'search_files',
      arguments: {
        query: '',  // Empty query to get all files
        fileTypes: ['md'],
        includeContent: false
      }
    });
    
    // Parse the response to extract file paths
    const content = response.content[0].text;
    const filePaths = content.split('\n')
      .filter(line => line.includes('.md'))
      .map(line => line.trim().replace(/^- /, ''));
    
    return filePaths;
  }
  
  async readFile(filePath) {
    const uri = `file://${filePath}`;
    const response = await this.sendRequest('resources/read', { uri });
    return response.contents[0].text;
  }
  
  async summarizeFile(filePath) {
    try {
      console.log(`📖 Reading: ${filePath}`);
      const content = await this.readFile(filePath);
      
      if (content.length < 100) {
        console.log(`⏭️  Skipping ${filePath} (too short)`);
        return null;
      }
      
      console.log(`✨ Generating summary prompt for: ${filePath}`);
      const promptResponse = await this.sendRequest('prompts/get', {
        name: 'summarize_content',
        arguments: {
          content: content,
          maxLength: 150
        }
      });
      
      console.log(`📝 Summary prompt ready for: ${filePath}`);
      console.log(`Prompt: ${promptResponse.messages[0].content.text}`);
      
      return {
        file: filePath,
        content: content.substring(0, 200) + '...',
        prompt: promptResponse.messages[0].content.text,
        wordCount: content.split(' ').length
      };
      
    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      return null;
    }
  }
  
  async summarizeAllNotes() {
    try {
      const markdownFiles = await this.findMarkdownFiles();
      console.log(`📁 Found ${markdownFiles.length} markdown files`);
      
      const summaries = [];
      
      for (const filePath of markdownFiles.slice(0, 5)) { // Limit to first 5 files
        const summary = await this.summarizeFile(filePath);
        if (summary) {
          summaries.push(summary);
        }
      }
      
      console.log('\n🎉 Summary Report:');
      console.log('==================');
      
      summaries.forEach((summary, index) => {
        console.log(`\n${index + 1}. ${summary.file}`);
        console.log(`   Word count: ${summary.wordCount}`);
        console.log(`   Preview: ${summary.content}`);
        console.log(`   AI Prompt: Ready for summarization`);
      });
      
      return summaries;
      
    } catch (error) {
      console.error('❌ Error:', error.message);
    }
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      console.log('👋 Disconnected from Lokus');
    }
  }
}

// Usage
async function main() {
  const summarizer = new NoteSummarizer('your-api-key-here');
  
  try {
    await summarizer.connect();
    await summarizer.summarizeAllNotes();
  } catch (error) {
    console.error('Application error:', error);
  } finally {
    summarizer.disconnect();
  }
}

main();
```

## Integration with AI Assistants

### Claude Desktop Integration

1. Create a configuration file for Claude Desktop:

```json
{
  "mcpServers": {
    "lokus": {
      "command": "node",
      "args": ["path/to/lokus-mcp-client.js"],
      "env": {
        "LOKUS_API_KEY": "your-api-key-here",
        "LOKUS_MCP_URL": "ws://localhost:3001/mcp"
      }
    }
  }
}
```

2. Place it in Claude's configuration directory
3. Restart Claude Desktop
4. Use natural language to interact with your Lokus workspace

### OpenAI GPT Integration

```python
import openai
from lokus_mcp_client import LokusMCPClient

class LokusGPTIntegration:
    def __init__(self, openai_key, lokus_api_key):
        self.openai = openai.OpenAI(api_key=openai_key)
        self.lokus = LokusMCPClient(api_key=lokus_api_key)
    
    async def chat_with_context(self, user_message):
        # Search relevant content in Lokus
        search_results = await self.lokus.search_files(user_message)
        
        # Build context from search results
        context = "\n".join([
            f"File: {result['path']}\nContent: {result['content'][:500]}..."
            for result in search_results[:3]
        ])
        
        # Send to GPT with context
        response = self.openai.chat.completions.create(
            model="gpt-4",
            messages=[
                {"role": "system", "content": f"Context from user's workspace:\n{context}"},
                {"role": "user", "content": user_message}
            ]
        )
        
        return response.choices[0].message.content
```

## Troubleshooting

### Common Issues

**Connection Refused**
```bash
# Check if Lokus is running
ps aux | grep lokus

# Check if MCP server is enabled in preferences
# Verify port configuration (default: 3001)
```

**Authentication Errors**
```bash
# Verify API key is correct
curl -H "X-API-Key: your-key" http://localhost:3001/api/mcp/resources/list

# Check key permissions in Lokus preferences
```

**WebSocket Connection Drops**
```javascript
// Implement reconnection logic
ws.on('close', () => {
  console.log('Connection closed, reconnecting...');
  setTimeout(() => connectToLokus(), 5000);
});
```

**Resource Not Found**
```javascript
// List available resources first
const resources = await sendRequest('resources/list', {});
console.log('Available resources:', resources.resources.map(r => r.uri));
```

### Debug Mode

Enable detailed logging:

```bash
# Set debug level
curl -X POST http://localhost:3001/api/mcp/logging/setLevel \
  -H "Content-Type: application/json" \
  -d '{"level": "debug"}'
```

## Next Steps

### Advanced Features
- [WebSocket Subscriptions](./advanced/subscriptions.md)
- [Custom Tool Development](./advanced/custom-tools.md)
- [Plugin Integration](./advanced/plugin-integration.md)
- [Security Configuration](./advanced/security.md)

### Examples
- [Building a Knowledge Assistant](./examples/knowledge-assistant.md)
- [File Synchronization Tool](./examples/file-sync.md)
- [Content Analytics Dashboard](./examples/analytics.md)

### API Reference
- [Complete API Documentation](./API.md)
- [OpenAPI Specification](../../openapi.yaml)
- [Error Codes Reference](./reference/error-codes.md)

## Community

- **GitHub**: [github.com/lokus-ai/lokus](https://github.com/lokus-ai/lokus)
- **Discord**: [discord.gg/lokus](https://discord.gg/lokus)
- **Discussions**: [github.com/lokus-ai/lokus/discussions](https://github.com/lokus-ai/lokus/discussions)

## Support

If you run into issues:

1. Check this documentation
2. Search existing [GitHub issues](https://github.com/lokus-ai/lokus/issues)
3. Join our [Discord community](https://discord.gg/lokus)
4. Create a new issue with:
   - Lokus version
   - Operating system
   - Steps to reproduce
   - Expected vs actual behavior
   - Relevant logs/screenshots

Happy building! 🚀