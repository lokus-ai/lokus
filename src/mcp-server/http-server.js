#!/usr/bin/env node

/**
 * Lokus MCP HTTP Server
 *
 * Provides HTTP/JSON-RPC transport for CLI tools.
 * Auto-started by Lokus app on launch.
 * Shares tool implementations with stdio server.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { readFile, writeFile, access, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir } from "os";
import { constants } from "fs";
import { fileURLToPath } from 'url';
import http from 'http';

// Import modular tools (same as index.js)
import { notesTools, executeNoteTool } from "./tools/notes.js";
import { workspaceTools, executeWorkspaceTool } from "./tools/workspace.js";
import { workspaceContextTools, executeWorkspaceContextTool } from "./tools/workspace-context.js";
import { basesTools, executeBaseTool } from "./tools/bases.js";
import { canvasTools, executeCanvasTool } from "./tools/canvas.js";
import { kanbanTools, executeKanbanTool } from "./tools/kanban.js";
import { graphTools, executeGraphTool } from "./tools/graph.js";

// ===== CONFIGURATION =====
const CONFIG = {
  defaultWorkspace: join(homedir(), 'Documents', 'Lokus Workspace'),
  lokusConfigDir: join(homedir(), '.lokus'),
  lastWorkspaceFile: join(homedir(), '.lokus', 'last-workspace.json'),
  apiUrl: 'http://127.0.0.1:3333',
  port: parseInt(process.argv[2]) || 3456 // Port from command line or default
};

// ===== LOGGER =====
const logger = {
  info: (...args) => console.error('[MCP-HTTP]', ...args),
  error: (...args) => console.error('[MCP-HTTP ERROR]', ...args),
  warn: (...args) => console.error('[MCP-HTTP WARN]', ...args)
};

// ===== WORKSPACE DETECTION =====
class WorkspaceDetector {
  constructor() {
    this.currentWorkspace = null;
    this.apiAvailable = false;
  }

  async getWorkspace() {
    if (this.currentWorkspace) {
      return this.currentWorkspace;
    }

    // Try API first
    this.currentWorkspace = await this.getWorkspaceFromAPI();
    if (this.currentWorkspace) {
      this.apiAvailable = true;
      return this.currentWorkspace;
    }

    // Try last workspace
    this.currentWorkspace = await this.getLastWorkspace();
    if (this.currentWorkspace) {
      return this.currentWorkspace;
    }

    // Use default
    this.currentWorkspace = await this.getDefaultWorkspace();
    return this.currentWorkspace;
  }

  async getWorkspaceFromAPI() {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(`${CONFIG.apiUrl}/api/workspace`, { timeout: 2000 });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.workspace;
        }
      }
    } catch (e) {
      // Silent fail
    }
    return null;
  }

  async getLastWorkspace() {
    try {
      const content = await readFile(CONFIG.lastWorkspaceFile, 'utf-8');
      const data = JSON.parse(content);
      if (data.workspace) {
        return data.workspace;
      }
    } catch (error) {
      // Doesn't exist
    }
    return null;
  }

  async getDefaultWorkspace() {
    const workspace = CONFIG.defaultWorkspace;
    try {
      await access(workspace, constants.F_OK);
    } catch {
      // Create it
      await mkdir(workspace, { recursive: true });
      await mkdir(join(workspace, '.lokus'), { recursive: true });
    }
    return workspace;
  }
}

const workspaceDetector = new WorkspaceDetector();

// ===== HTTP JSON-RPC SERVER =====
const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'healthy', service: 'lokus-mcp-http' }));
    return;
  }

  // Server info
  if (req.method === 'GET' && req.url === '/mcp/info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      name: 'lokus-mcp-http',
      version: '1.0.0',
      transport: 'http',
      tools: getAllTools().length
    }));
    return;
  }

  // MCP endpoint
  if (req.method === 'POST' && (req.url === '/mcp' || req.url === '/')) {
    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        const request = JSON.parse(body);
        const response = await handleMCPRequest(request);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response));
      } catch (error) {
        logger.error('Request error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: error.message
          },
          id: null
        }));
      }
    });
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ===== MCP REQUEST HANDLER =====
const getAllTools = () => {
  return [
    ...workspaceContextTools,
    ...notesTools,
    ...workspaceTools,
    ...basesTools,
    ...canvasTools,
    ...kanbanTools,
    ...graphTools
  ];
};

async function handleMCPRequest(request) {
  const { method, params, id } = request;

  try {
    // Initialize - MCP protocol handshake
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {},
            resources: {}
          },
          serverInfo: {
            name: 'lokus-mcp-http',
            version: '1.0.0'
          }
        },
        id
      };
    }

    // Initialized notification (no response needed)
    if (method === 'notifications/initialized') {
      logger.info('Client initialized successfully');
      return {
        jsonrpc: '2.0',
        result: {},
        id
      };
    }

    // List tools
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        result: { tools: getAllTools() },
        id
      };
    }

    // Call tool
    if (method === 'tools/call') {
      const { name: toolName, arguments: args } = params;
      const workspace = await workspaceDetector.getWorkspace();
      const apiUrl = workspaceDetector.apiAvailable ? CONFIG.apiUrl : null;

      logger.info(`Executing tool: ${toolName}`);

      let result;

      // Route to appropriate handler
      if (workspaceContextTools.some(t => t.name === toolName)) {
        result = await executeWorkspaceContextTool(toolName, args, apiUrl);
      } else if (notesTools.some(t => t.name === toolName)) {
        result = await executeNoteTool(toolName, args, workspace, apiUrl);
      } else if (workspaceTools.some(t => t.name === toolName)) {
        result = await executeWorkspaceTool(toolName, args, workspace, apiUrl);
      } else if (basesTools.some(t => t.name === toolName)) {
        result = await executeBaseTool(toolName, args, workspace, apiUrl);
      } else if (canvasTools.some(t => t.name === toolName)) {
        result = await executeCanvasTool(toolName, args, workspace, apiUrl);
      } else if (kanbanTools.some(t => t.name === toolName)) {
        result = await executeKanbanTool(toolName, args, workspace, apiUrl);
      } else if (graphTools.some(t => t.name === toolName)) {
        result = await executeGraphTool(toolName, args, workspace, apiUrl);
      } else {
        throw new Error(`Unknown tool: ${toolName}`);
      }

      return {
        jsonrpc: '2.0',
        result,
        id
      };
    }

    // Unknown method
    return {
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      },
      id
    };

  } catch (error) {
    logger.error(`Request failed:`, error);
    return {
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message
      },
      id
    };
  }
}

// ===== START SERVER =====
async function main() {
  try {
    server.listen(CONFIG.port, '127.0.0.1', () => {
      logger.info('===========================================');
      logger.info(`Lokus MCP HTTP Server v1.0 started`);
      logger.info(`Port: ${CONFIG.port}`);
      logger.info(`URL: http://127.0.0.1:${CONFIG.port}/mcp`);
      logger.info(`Tools: ${getAllTools().length}`);
      logger.info('===========================================');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, closing server...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, closing server...');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Fatal error:', error);
    process.exit(1);
  }
}

main();
