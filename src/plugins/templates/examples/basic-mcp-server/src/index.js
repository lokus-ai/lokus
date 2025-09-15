/**
 * Basic File Server MCP Plugin
 * 
 * A simple example demonstrating how to create an MCP server plugin
 * that provides file system access through resources and tools.
 */

import { BasePlugin } from '@lokus/plugin-core'
import { MCPResourceBuilder, MCPToolBuilder } from '@lokus/mcp'
import { FileServer } from './FileServer.js'

export class BasicFileServerPlugin extends BasePlugin {
  constructor() {
    super()
    this.fileServer = null
    this.mcpAPI = null
  }

  /**
   * Plugin activation
   */
  async activate() {
    await super.activate()
    
    try {
      // Get MCP API from plugin context
      this.mcpAPI = this.api.getMCPAPI()
      if (!this.mcpAPI) {
        throw new Error('MCP API not available')
      }

      // Initialize file server
      this.fileServer = new FileServer(this.api)
      await this.fileServer.initialize()

      // Register MCP resources and tools
      await this.registerMCPComponents()

      // Register commands
      this.registerCommands()

      this.logger.info('Basic File Server Plugin activated successfully')
      
    } catch (error) {
      this.logger.error('Failed to activate Basic File Server Plugin:', error)
      throw error
    }
  }

  /**
   * Register MCP resources and tools
   */
  async registerMCPComponents() {
    // Register file system resources
    await this.registerFileResources()
    
    // Register file operation tools
    await this.registerFileTools()
  }

  /**
   * Register file system resources
   */
  async registerFileResources() {
    // Workspace files resource
    const workspaceResource = new MCPResourceBuilder()
      .setUri('file:///workspace')
      .setName('Workspace Files')
      .setDescription('All files in the workspace directory')
      .setType('directory')
      .setMimeType('inode/directory')
      .setMetadata({
        readable: true,
        writable: true,
        watchable: true,
        path: '/workspace'
      })
      .build()

    this.mcpAPI.registerResource(workspaceResource)

    // Documents resource
    const documentsResource = new MCPResourceBuilder()
      .setUri('file:///workspace/documents')
      .setName('Documents')
      .setDescription('Document files in the workspace')
      .setType('collection')
      .setMimeType('text/*')
      .setMetadata({
        readable: true,
        filterable: true,
        extensions: ['.md', '.txt', '.doc', '.docx', '.pdf']
      })
      .build()

    this.mcpAPI.registerResource(documentsResource)
  }

  /**
   * Register file operation tools
   */
  async registerFileTools() {
    // Read file tool
    const readFileTool = new MCPToolBuilder()
      .setName('read_file')
      .setDescription('Read the contents of a file')
      .setInputSchema({
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
            enum: ['utf8', 'ascii', 'base64', 'binary']
          }
        },
        required: ['path']
      })
      .setExecutor(async (args) => {
        return await this.fileServer.readFile(args.path, args.encoding)
      })
      .build()

    this.mcpAPI.registerTool(readFileTool)

    // Write file tool
    const writeFileTool = new MCPToolBuilder()
      .setName('write_file')
      .setDescription('Write content to a file')
      .setInputSchema({
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file'
          },
          encoding: {
            type: 'string',
            description: 'File encoding (default: utf8)',
            default: 'utf8',
            enum: ['utf8', 'ascii', 'base64', 'binary']
          },
          createDirectories: {
            type: 'boolean',
            description: 'Create parent directories if they don\'t exist',
            default: true
          }
        },
        required: ['path', 'content']
      })
      .setExecutor(async (args) => {
        return await this.fileServer.writeFile(
          args.path, 
          args.content, 
          args.encoding,
          args.createDirectories
        )
      })
      .build()

    this.mcpAPI.registerTool(writeFileTool)

    // List directory tool
    const listDirectoryTool = new MCPToolBuilder()
      .setName('list_directory')
      .setDescription('List the contents of a directory')
      .setInputSchema({
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the directory'
          },
          recursive: {
            type: 'boolean',
            description: 'List subdirectories recursively',
            default: false
          },
          includeHidden: {
            type: 'boolean',
            description: 'Include hidden files and directories',
            default: false
          },
          filter: {
            type: 'string',
            description: 'File extension filter (e.g., ".js", ".md")'
          }
        },
        required: ['path']
      })
      .setExecutor(async (args) => {
        return await this.fileServer.listDirectory(
          args.path,
          args.recursive,
          args.includeHidden,
          args.filter
        )
      })
      .build()

    this.mcpAPI.registerTool(listDirectoryTool)

    // File info tool
    const fileInfoTool = new MCPToolBuilder()
      .setName('file_info')
      .setDescription('Get information about a file or directory')
      .setInputSchema({
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Absolute or relative path to the file or directory'
          }
        },
        required: ['path']
      })
      .setExecutor(async (args) => {
        return await this.fileServer.getFileInfo(args.path)
      })
      .build()

    this.mcpAPI.registerTool(fileInfoTool)
  }

  /**
   * Register plugin commands
   */
  registerCommands() {
    // Status command
    this.registerCommand({
      name: 'fileServer.status',
      description: 'Show file server status',
      action: async () => {
        const status = this.fileServer.getStatus()
        this.showNotification(`File Server Status: ${status.isActive ? 'Active' : 'Inactive'}`, 'info')
        return status
      }
    })

    // Refresh command
    this.registerCommand({
      name: 'fileServer.refresh',
      description: 'Refresh file resources',
      action: async () => {
        await this.fileServer.refreshResources()
        this.showNotification('File resources refreshed', 'success')
      }
    })
  }

  /**
   * Plugin deactivation
   */
  async deactivate() {
    if (this.fileServer) {
      await this.fileServer.shutdown()
      this.fileServer = null
    }

    this.mcpAPI = null
    await super.deactivate()
    
    this.logger.info('Basic File Server Plugin deactivated')
  }

  /**
   * Get plugin status
   */
  getPluginStatus() {
    return {
      ...super.getStatus(),
      fileServer: this.fileServer?.getStatus() || null,
      mcpAPI: this.mcpAPI ? 'available' : 'unavailable'
    }
  }
}

export default BasicFileServerPlugin