/**
 * File Tools MCP Plugin
 * Registers file operation tools with the MCP integration system
 */

import { fileTools } from '../tools/fileTools.js';

/**
 * File Tools Plugin
 * Automatically registers file operation tools when MCP system is available
 */
export class FileToolsPlugin {
  constructor() {
    this.pluginId = 'file-tools';
    this.name = 'File Tools Plugin';
    this.version = '1.0.0';
    this.description = 'Provides file operation tools for Lokus workspace management';
    this.mcpIntegration = null;
    this.registered = false;
    this.logger = console;
  }

  /**
   * Initialize the plugin
   */
  async initialize() {
    try {
      // Try to dynamically import MCP integration to avoid circular dependencies
      try {
        const mcpModule = await import('../../plugins/mcp/index.js');
        this.mcpIntegration = mcpModule.getMCPIntegration();
      } catch (error) {
        this.logger.warn('[FileToolsPlugin] MCP integration not available:', error.message);
        return false;
      }
      
      if (!this.mcpIntegration) {
        this.logger.warn('[FileToolsPlugin] MCP integration not available');
        return false;
      }

      // Register tools
      await this.registerTools();
      
      this.registered = true;
      this.logger.info('[FileToolsPlugin] Initialized successfully');
      return true;
      
    } catch (error) {
      this.logger.error('[FileToolsPlugin] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Register all file tools
   */
  async registerTools() {
    if (!this.mcpIntegration) {
      throw new Error('MCP integration not available');
    }

    // Get or create MCP plugin instance
    let mcpPlugin;
    try {
      mcpPlugin = this.mcpIntegration.getMCPPlugin(this.pluginId);
    } catch (error) {
      // Plugin doesn't exist, create it
      const pluginConfig = {
        id: this.pluginId,
        name: this.name,
        version: this.version,
        description: this.description,
        type: 'server',
        enabled: true
      };
      
      mcpPlugin = await this.mcpIntegration.createPlugin(pluginConfig);
    }

    // Register each file tool
    for (const tool of fileTools) {
      try {
        const registeredTool = mcpPlugin.mcpServer?.registerTool({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
          handler: tool.handler,
          execute: tool.handler // Alias for compatibility
        });

        this.logger.info(`[FileToolsPlugin] Registered tool: ${tool.name}`);
      } catch (error) {
        this.logger.error(`[FileToolsPlugin] Failed to register tool ${tool.name}:`, error);
      }
    }

    this.logger.info(`[FileToolsPlugin] Registered ${fileTools.length} file tools`);
  }

  /**
   * Get plugin info
   */
  getInfo() {
    return {
      id: this.pluginId,
      name: this.name,
      version: this.version,
      description: this.description,
      registered: this.registered,
      toolCount: fileTools.length,
      tools: fileTools.map(tool => ({
        name: tool.name,
        description: tool.description
      }))
    };
  }

  /**
   * Dispose of the plugin
   */
  dispose() {
    // Unregister tools if needed
    if (this.mcpIntegration && this.registered) {
      try {
        const mcpPlugin = this.mcpIntegration.getMCPPlugin(this.pluginId);
        for (const tool of fileTools) {
          mcpPlugin.mcpServer?.unregisterTool(tool.name);
        }
        this.logger.info('[FileToolsPlugin] Unregistered all tools');
      } catch (error) {
        this.logger.warn('[FileToolsPlugin] Error during cleanup:', error);
      }
    }
    
    this.registered = false;
    this.mcpIntegration = null;
  }
}

/**
 * Auto-initialize file tools plugin if MCP integration is available
 */
let fileToolsPlugin = null;

export async function initializeFileToolsPlugin() {
  if (fileToolsPlugin) {
    return fileToolsPlugin;
  }

  fileToolsPlugin = new FileToolsPlugin();
  const success = await fileToolsPlugin.initialize();
  
  if (!success) {
    fileToolsPlugin = null;
    throw new Error('Failed to initialize file tools plugin');
  }

  return fileToolsPlugin;
}

export function getFileToolsPlugin() {
  return fileToolsPlugin;
}

// Export default instance creator
export default FileToolsPlugin;