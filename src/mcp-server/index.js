#!/usr/bin/env node

/**
 * Lokus MCP Server - Enhanced Version with 40+ Tools
 *
 * This server provides comprehensive integration between Lokus and AI assistants.
 * Features modular tools for all Lokus features including notes, bases, canvas,
 * kanban, graph navigation, and more.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { readFile, writeFile, access, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import { constants } from "fs";
import { fileURLToPath } from 'url';

// Import modular tools
import { notesTools, executeNoteTool } from "./tools/notes.js";
import { workspaceTools, executeWorkspaceTool } from "./tools/workspace.js";
import { workspaceContextTools, executeWorkspaceContextTool } from "./tools/workspace-context.js";
import { basesTools, executeBaseTool } from "./tools/bases.js";
import { canvasTools, executeCanvasTool } from "./tools/canvas.js";
import { kanbanTools, executeKanbanTool } from "./tools/kanban.js";
import { graphTools, executeGraphTool } from "./tools/graph.js";
import { templatesTools, executeTemplateTool } from "./tools/templates.js";

// Import resources
import { markdownSyntaxResources, getMarkdownSyntaxResource } from "./resources/markdownSyntaxProvider.js";

// ===== CONFIGURATION =====
const CONFIG = {
  defaultWorkspace: join(homedir(), 'Documents', 'Lokus Workspace'),
  lokusConfigDir: join(homedir(), '.lokus'),
  lastWorkspaceFile: join(homedir(), '.lokus', 'last-workspace.json'),
  apiUrl: 'http://127.0.0.1:3333', // Lokus API server
};

// ===== LOGGER =====
const logger = {
  info: (...args) => console.error('[MCP]', ...args),
  error: (...args) => console.error('[MCP ERROR]', ...args),
  warn: (...args) => console.error('[MCP WARN]', ...args)
};

// ===== WORKSPACE DETECTION =====
class WorkspaceDetector {
  constructor() {
    this.currentWorkspace = null;
    this.apiAvailable = false;
  }

  /**
   * Get the current workspace path with smart detection
   */
  async getWorkspace() {
    if (this.currentWorkspace) {
      return this.currentWorkspace;
    }

    // Try 1: Get from running Lokus app via API
    this.currentWorkspace = await this.getWorkspaceFromAPI();
    if (this.currentWorkspace) {
      logger.info('Using workspace from Lokus API:', this.currentWorkspace);
      this.apiAvailable = true;
      return this.currentWorkspace;
    }

    // Try 2: Get last workspace from config
    this.currentWorkspace = await this.getLastWorkspace();
    if (this.currentWorkspace) {
      logger.info('Using last workspace from config:', this.currentWorkspace);
      return this.currentWorkspace;
    }

    // Try 3: Use default workspace
    this.currentWorkspace = await this.getDefaultWorkspace();
    logger.info('Using default workspace:', this.currentWorkspace);
    return this.currentWorkspace;
  }

  /**
   * Get workspace from Lokus API server
   */
  async getWorkspaceFromAPI() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${CONFIG.apiUrl}/api/workspace`, {
        timeout: 2000
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.workspace;
        }
      }
    } catch (e) {
      // API not available, silent fail
    }
    return null;
  }

  /**
   * Get last workspace from config file
   */
  async getLastWorkspace() {
    try {
      const content = await readFile(CONFIG.lastWorkspaceFile, 'utf-8');
      const data = JSON.parse(content);
      if (data.workspace && await this.validateWorkspace(data.workspace)) {
        return data.workspace;
      }
    } catch (error) {
      // File doesn't exist or invalid
    }
    return null;
  }

  /**
   * Get default workspace, create if needed
   */
  async getDefaultWorkspace() {
    const workspace = CONFIG.defaultWorkspace;

    try {
      await access(workspace, constants.F_OK);
    } catch {
      // Create default workspace
      try {
        await mkdir(workspace, { recursive: true });
        await mkdir(join(workspace, '.lokus'), { recursive: true });

        // Create welcome note
        const welcomeNote = `# Welcome to Lokus!

This is your knowledge workspace. You can:
- Create notes with [[WikiLinks]]
- Organize with Bases (databases)
- Visualize with Canvas
- Manage tasks with Kanban boards
- Explore connections with Graph view

Happy knowledge building! 🚀
`;
        await writeFile(join(workspace, 'Welcome.md'), welcomeNote);
        logger.info('Created default workspace at:', workspace);
      } catch (error) {
        logger.error('Failed to create default workspace:', error);
      }
    }

    return workspace;
  }

  /**
   * Validate that a path is a valid workspace
   */
  async validateWorkspace(path) {
    try {
      await access(path, constants.R_OK | constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Save workspace as last used
   */
  async saveLastWorkspace(workspace) {
    try {
      await mkdir(CONFIG.lokusConfigDir, { recursive: true });
      await writeFile(
        CONFIG.lastWorkspaceFile,
        JSON.stringify({
          workspace,
          lastUsed: new Date().toISOString(),
          apiAvailable: this.apiAvailable
        })
      );
    } catch (error) {
      logger.error('Failed to save last workspace:', error);
    }
  }

  /**
   * Check if API is available
   */
  async checkAPIStatus() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${CONFIG.apiUrl}/api/health`, {
        timeout: 1000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ===== MCP SERVER SETUP =====
const workspaceDetector = new WorkspaceDetector();

const server = new Server(
  {
    name: "lokus-mcp-enhanced",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {}
    },
  }
);

// ===== COMBINE ALL TOOLS =====
const getAllTools = () => {
  return [
    ...workspaceContextTools,  // Workspace context tools first for easy discovery
    ...notesTools,
    ...workspaceTools,
    ...basesTools,
    ...canvasTools,
    ...kanbanTools,
    ...graphTools,
    ...templatesTools
  ];
};

// Tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = getAllTools();
  logger.info(`Providing ${tools.length} tools to AI assistant`);

  return { tools };
});

// Tools execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name: toolName, arguments: args } = request.params;
  const workspace = await workspaceDetector.getWorkspace();
  const apiUrl = workspaceDetector.apiAvailable ? CONFIG.apiUrl : null;

  logger.info(`Executing tool: ${toolName}`);

  try {
    // Route to appropriate tool handler based on prefix
    if (workspaceContextTools.some(t => t.name === toolName)) {
      return await executeWorkspaceContextTool(toolName, args, apiUrl);
    }

    if (notesTools.some(t => t.name === toolName)) {
      return await executeNoteTool(toolName, args, workspace, apiUrl);
    }

    if (workspaceTools.some(t => t.name === toolName)) {
      return await executeWorkspaceTool(toolName, args, workspace, apiUrl);
    }

    if (basesTools.some(t => t.name === toolName)) {
      return await executeBaseTool(toolName, args, workspace, apiUrl);
    }

    if (canvasTools.some(t => t.name === toolName)) {
      return await executeCanvasTool(toolName, args, workspace, apiUrl);
    }

    if (kanbanTools.some(t => t.name === toolName)) {
      return await executeKanbanTool(toolName, args, workspace, apiUrl);
    }

    if (graphTools.some(t => t.name === toolName)) {
      return await executeGraphTool(toolName, args, workspace, apiUrl);
    }

    if (templatesTools.some(t => t.name === toolName)) {
      return await executeTemplateTool(toolName, args, workspace, apiUrl);
    }

    throw new Error(`Unknown tool: ${toolName}`);

  } catch (error) {
    logger.error(`Tool execution failed for ${toolName}:`, error.message);

    return {
      content: [{
        type: "text",
        text: `❌ Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// Resources list handler
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  logger.info(`Providing ${markdownSyntaxResources.length} documentation resources`);
  return { resources: markdownSyntaxResources };
});

// Resources read handler
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;
  logger.info(`Reading resource: ${uri}`);

  try {
    return await getMarkdownSyntaxResource(uri);
  } catch (error) {
    logger.error(`Resource read failed for ${uri}:`, error.message);
    return {
      contents: [{
        uri,
        mimeType: "text/plain",
        text: `Error: ${error.message}`
      }]
    };
  }
});

// ===== START SERVER =====
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  logger.info('===========================================');
  logger.info('Lokus MCP Server v2.0 started successfully');
  logger.info(`Offering ${getAllTools().length} tools`);

  // Check API availability
  const apiAvailable = await workspaceDetector.checkAPIStatus();
  if (apiAvailable) {
    logger.info('✅ Connected to Lokus app API');
  } else {
    logger.info('⚠️  Lokus app not running (basic features only)');
  }

  // Get and display workspace
  const workspace = await workspaceDetector.getWorkspace();
  logger.info('Workspace:', workspace);
  logger.info('===========================================');
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});