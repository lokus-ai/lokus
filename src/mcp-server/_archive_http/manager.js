/**
 * MCP Server Manager for Lokus
 * Integrates MCP server directly into the Lokus application
 */

class MCPServerManager {
  constructor() {
    this.server = null;
    this.isRunning = false;
    this.port = 3456;
  }

  /**
   * Start MCP server as part of Lokus app
   */
  async start() {
    if (this.isRunning) {
      console.log('🔌 MCP Server already running');
      return;
    }

    try {
      // Only start in Tauri environment
      const isTauri = typeof window !== 'undefined' && (
        (window.__TAURI_INTERNALS__ && typeof window.__TAURI_INTERNALS__.invoke === 'function') ||
        window.__TAURI_METADATA__ ||
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.includes('Tauri'))
      );

      if (!isTauri) {
        console.log('🔌 MCP Server skipped (not in Tauri environment)');
        return;
      }

      console.log('🔌 Starting MCP Server in Tauri environment...');

      // Dynamic import with proper error handling to avoid browser compatibility issues
      let SecureMCPServer;
      try {
        const mcpModule = await import('../../mcp-server/index.js');
        SecureMCPServer = mcpModule.default;
        console.log('✅ SecureMCPServer imported successfully');
      } catch (importError) {
        console.error('Failed to import MCP server:', importError);
        throw new Error(`MCP Server module could not be loaded: ${importError.message}`);
      }

      // Check if SecureMCPServer constructor is available
      if (!SecureMCPServer || typeof SecureMCPServer !== 'function') {
        throw new Error('SecureMCPServer constructor is not available');
      }

      this.server = new SecureMCPServer({
        environment: 'production'
      });

      console.log('✅ SecureMCPServer instance created');

      await this.server.start(this.port, 'localhost');
      this.isRunning = true;

      console.log(`🔌 Lokus MCP Server started on port ${this.port}`);
      console.log(`📋 Connect Claude Code with: claude mcp add lokus --command "node" --args "test-mcp-server.js"`);
      
      // Add to global for debugging
      if (typeof window !== 'undefined') {
        window.__LOKUS_MCP_SERVER__ = this.server;
      }

    } catch (error) {
      console.error('🔌 MCP Server failed to start:', error);
      console.error('Stack trace:', error.stack);
    }
  }

  /**
   * Stop MCP server
   */
  async stop() {
    if (!this.isRunning || !this.server) {
      return;
    }

    try {
      await this.server.stop();
      this.isRunning = false;
      this.server = null;
      console.log('🔌 Lokus MCP Server stopped');
      
      if (typeof window !== 'undefined') {
        delete window.__LOKUS_MCP_SERVER__;
      }
    } catch (error) {
      console.error('🔌 Error stopping MCP server:', error);
    }
  }

  /**
   * Get server status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      port: this.port,
      url: this.isRunning ? `http://localhost:${this.port}` : null
    };
  }

  /**
   * Restart server
   */
  async restart() {
    await this.stop();
    await this.start();
  }
}

// Create singleton instance
const mcpServerManager = new MCPServerManager();

export default mcpServerManager;