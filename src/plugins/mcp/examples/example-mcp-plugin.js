/**
 * Example MCP Plugin
 * 
 * Demonstrates how to create an MCP-enabled plugin for Lokus
 * This plugin provides file system resources and text processing tools
 */

import { MCPResourceBuilder, MCPToolBuilder, MCPPromptBuilder } from '../index.js'

/**
 * Example MCP Plugin Class
 */
export class ExampleMCPPlugin {
  constructor() {
    this.id = 'example-mcp-plugin'
    this.mcpAPI = null
    this.watchers = new Map()
  }

  /**
   * Plugin activation - called when plugin is activated
   */
  async activate(mcpAPI) {
    this.mcpAPI = mcpAPI
    
    console.log('Example MCP Plugin activated with API:', mcpAPI)
    
    // Register resources
    await this.registerResources()
    
    // Register tools
    await this.registerTools()
    
    // Register prompt templates
    await this.registerPrompts()
    
    console.log('Example MCP Plugin setup complete')
  }

  /**
   * Register MCP resources
   */
  async registerResources() {
    // Register a file system resource
    const fileResource = new MCPResourceBuilder()
      .setUri('file:///workspace/documents')
      .setName('Workspace Documents')
      .setDescription('Access to workspace document files')
      .setType('directory')
      .setMimeType('inode/directory')
      .setContent('Directory containing workspace documents')
      .setMetadata({
        readable: true,
        writable: true,
        watchable: true
      })
      .build()
    
    this.mcpAPI.server?.registerResource(fileResource)
    
    // Register a memory-based resource
    const memoryResource = new MCPResourceBuilder()
      .setUri('memory://plugin-cache')
      .setName('Plugin Cache')
      .setDescription('In-memory cache for plugin data')
      .setType('memory')
      .setMimeType('application/json')
      .setContent('{}')
      .setMetadata({
        volatile: true,
        maxSize: 1024 * 1024 // 1MB
      })
      .build()
    
    this.mcpAPI.server?.registerResource(memoryResource)
    
    console.log('Registered MCP resources')
  }

  /**
   * Register MCP tools
   */
  async registerTools() {
    // Text transformation tool
    const textTool = new MCPToolBuilder()
      .setName('transform_text')
      .setDescription('Transform text using various operations (uppercase, lowercase, reverse, etc.)')
      .setInputSchema({
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: 'The text to transform'
          },
          operation: {
            type: 'string',
            enum: ['uppercase', 'lowercase', 'reverse', 'capitalize', 'trim'],
            description: 'The transformation operation to perform'
          }
        },
        required: ['text', 'operation']
      })
      .setExecutor(async (args) => {
        const { text, operation } = args
        
        switch (operation) {
          case 'uppercase':
            return { output: text.toUpperCase() }
          case 'lowercase':
            return { output: text.toLowerCase() }
          case 'reverse':
            return { output: text.split('').reverse().join('') }
          case 'capitalize':
            return { output: text.charAt(0).toUpperCase() + text.slice(1).toLowerCase() }
          case 'trim':
            return { output: text.trim() }
          default:
            throw new Error(`Unknown operation: ${operation}`)
        }
      })
      .build()
    
    this.mcpAPI.server?.registerTool(textTool)
    
    // File operations tool
    const fileTool = new MCPToolBuilder()
      .setName('file_operations')
      .setDescription('Perform basic file operations (read, write, list)')
      .setInputSchema({
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: ['read', 'write', 'list', 'exists'],
            description: 'The file operation to perform'
          },
          path: {
            type: 'string',
            description: 'The file path'
          },
          content: {
            type: 'string',
            description: 'Content to write (for write operation)'
          }
        },
        required: ['operation', 'path']
      })
      .setExecutor(async (args) => {
        const { operation, path, content } = args
        
        // In a real implementation, these would be actual file operations
        // For this example, we'll simulate the operations
        switch (operation) {
          case 'read':
            return { 
              output: `Simulated content of file: ${path}`,
              metadata: { size: 1024, lastModified: new Date().toISOString() }
            }
          case 'write':
            return { 
              output: `Successfully wrote ${content?.length || 0} characters to ${path}`,
              metadata: { written: true }
            }
          case 'list':
            return { 
              output: `Contents of directory: ${path}`,
              files: ['file1.txt', 'file2.md', 'subdirectory/']
            }
          case 'exists':
            return { 
              output: `File ${path} exists: true`,
              exists: true
            }
          default:
            throw new Error(`Unknown file operation: ${operation}`)
        }
      })
      .build()
    
    this.mcpAPI.server?.registerTool(fileTool)
    
    console.log('Registered MCP tools')
  }

  /**
   * Register MCP prompt templates
   */
  async registerPrompts() {
    // Code review prompt
    const codeReviewPrompt = new MCPPromptBuilder()
      .setName('code_review')
      .setDescription('Generate a code review prompt for the given code')
      .setTemplate(`Please review the following {{language}} code and provide feedback:

\`\`\`{{language}}
{{code}}
\`\`\`

Focus on:
- Code quality and best practices
- Potential bugs or issues
- Performance considerations
- Readability and maintainability

{{#if context}}
Additional context: {{context}}
{{/if}}`)
      .setArguments([
        {
          name: 'code',
          description: 'The code to review',
          required: true,
          type: 'string'
        },
        {
          name: 'language',
          description: 'Programming language of the code',
          required: true,
          type: 'string'
        },
        {
          name: 'context',
          description: 'Additional context about the code',
          required: false,
          type: 'string'
        }
      ])
      .build()
    
    this.mcpAPI.server?.registerPrompt(codeReviewPrompt)
    
    // Documentation generation prompt
    const docsPrompt = new MCPPromptBuilder()
      .setName('generate_docs')
      .setDescription('Generate documentation for the given function or class')
      .setTemplate(`Generate comprehensive documentation for the following {{type}}:

\`\`\`{{language}}
{{code}}
\`\`\`

Please include:
- A clear description of what the {{type}} does
- Parameter descriptions (if applicable)
- Return value description (if applicable)
- Usage examples
- Any important notes or warnings

Format: {{format}}`)
      .setArguments([
        {
          name: 'code',
          description: 'The code to document',
          required: true,
          type: 'string'
        },
        {
          name: 'type',
          description: 'Type of code (function, class, module, etc.)',
          required: true,
          type: 'string'
        },
        {
          name: 'language',
          description: 'Programming language',
          required: true,
          type: 'string'
        },
        {
          name: 'format',
          description: 'Documentation format (JSDoc, Sphinx, etc.)',
          required: false,
          type: 'string',
          default: 'JSDoc'
        }
      ])
      .build()
    
    this.mcpAPI.server?.registerPrompt(docsPrompt)
    
    console.log('Registered MCP prompts')
  }

  /**
   * Plugin deactivation - called when plugin is deactivated
   */
  async deactivate() {
    console.log('Example MCP Plugin deactivated')
    
    // Clean up watchers
    for (const watcher of this.watchers.values()) {
      if (watcher.close) {
        watcher.close()
      }
    }
    this.watchers.clear()
    
    // The MCP API will automatically clean up resources, tools, and prompts
    this.mcpAPI = null
  }

  /**
   * Example of using MCP client functionality
   */
  async demonstrateClientUsage() {
    if (!this.mcpAPI.client) {
      console.log('No MCP client available')
      return
    }

    try {
      // List available resources from other plugins
      const resources = await this.mcpAPI.client.listResources()
      console.log('Available resources:', resources)
      
      // List available tools from other plugins
      const tools = await this.mcpAPI.client.listTools()
      console.log('Available tools:', tools)
      
      // Call a tool from another plugin
      if (tools.tools && tools.tools.length > 0) {
        const firstTool = tools.tools[0]
        console.log(`Calling tool: ${firstTool.name}`)
        
        const result = await this.mcpAPI.client.callTool(firstTool.name, {
          // Provide appropriate arguments based on the tool's schema
        })
        console.log('Tool result:', result)
      }
      
    } catch (error) {
      console.error('Error demonstrating MCP client usage:', error)
    }
  }

  /**
   * Example of finding global resources
   */
  async findFileResources() {
    const fileResources = this.mcpAPI.global?.findResources({
      type: 'file'
    })
    
    console.log('Found file resources:', fileResources)
    return fileResources
  }

  /**
   * Example of finding text processing tools
   */
  async findTextTools() {
    const textTools = this.mcpAPI.global?.findTools({
      search: 'text'
    })
    
    console.log('Found text processing tools:', textTools)
    return textTools
  }
}

// Plugin manifest example
export const manifest = {
  id: 'example-mcp-plugin',
  name: 'Example MCP Plugin',
  version: '1.0.0',
  description: 'Example plugin demonstrating MCP integration',
  main: 'example-mcp-plugin.js',
  lokusVersion: '^1.0.0',
  author: 'Lokus Team',
  license: 'MIT',
  
  // MCP-specific configuration
  type: 'mcp-server',
  mcp: {
    type: 'mcp-server',
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
    enableResourceSubscriptions: true,
    enableToolExecution: true,
    enablePromptTemplates: true,
    memoryLimit: 50 * 1024 * 1024, // 50MB
    cpuTimeLimit: 5000, // 5 seconds
    maxApiCalls: 1000
  },
  
  permissions: [
    'read_files',
    'write_files',
    'mcp:serve',
    'mcp:resources',
    'mcp:tools',
    'mcp:prompts'
  ],
  
  categories: ['MCP Server', 'Tool Provider', 'Data Provider'],
  
  contributes: {
    mcp: {
      servers: [
        {
          id: 'example-server',
          name: 'Example MCP Server',
          description: 'Provides file system access and text processing tools'
        }
      ],
      resources: [
        {
          name: 'workspace-docs',
          description: 'Workspace document files',
          pattern: 'file:///workspace/**/*.{md,txt,doc}',
          type: 'file',
          mimeType: 'text/*'
        }
      ],
      tools: [
        {
          name: 'transform_text',
          description: 'Transform text using various operations',
          inputSchema: {
            type: 'object',
            properties: {
              text: { type: 'string' },
              operation: { type: 'string', enum: ['uppercase', 'lowercase', 'reverse'] }
            },
            required: ['text', 'operation']
          },
          handler: 'handleTextTransform'
        }
      ],
      prompts: [
        {
          name: 'code_review',
          description: 'Generate code review prompts',
          template: 'Review this {{language}} code: {{code}}',
          arguments: [
            { name: 'code', required: true },
            { name: 'language', required: true }
          ]
        }
      ]
    }
  },
  
  activationEvents: [
    'onStartup',
    'onMCPServer:example-server',
    'onCommand:example.transformText'
  ]
}

export default ExampleMCPPlugin