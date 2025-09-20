/**
 * Professional AI Assistant Connection Manager
 * Auto-discovers and manages connections to AI assistants like Claude Desktop
 */

import mcpServerManager from '../mcp/manager.js';

class AIConnectionManager {
  constructor() {
    this.connectedClients = new Map();
    this.discoveryAttempts = 0;
    this.maxDiscoveryAttempts = 3;
  }

  /**
   * Auto-discover and connect to Claude Desktop
   * This is what professional apps do - zero configuration
   */
  async autoConnect() {
    try {
      console.log('🔍 Discovering AI assistants...');
      
      // Step 1: Start our MCP server if not running
      if (!mcpServerManager.getStatus().isRunning) {
        console.log('🚀 Starting MCP server...');
        await mcpServerManager.start();
      }

      // Step 2: Check for Claude Desktop installation
      const claudeInstalled = await this.detectClaudeDesktop();
      
      if (claudeInstalled) {
        // Step 3: Auto-configure Claude Desktop
        await this.configureClaudeDesktop();
        
        // Step 4: Verify connection
        const connected = await this.verifyConnection();
        
        if (connected) {
          console.log('✅ Claude Desktop connected successfully!');
          return { success: true, assistant: 'Claude Desktop' };
        }
      }

      // Fallback: Provide manual instructions
      return this.generateManualInstructions();

    } catch (error) {
      console.error('❌ Auto-connect failed:', error);
      return { 
        success: false, 
        error: error.message,
        instructions: this.generateManualInstructions()
      };
    }
  }

  /**
   * Detect if Claude Desktop is installed
   * Professional approach: check common installation paths
   */
  async detectClaudeDesktop() {
    try {
      // Check if we're in Tauri environment
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        
        // Check common Claude Desktop paths on macOS
        const commonPaths = [
          '/Applications/Claude.app',
          '~/Applications/Claude.app',
          '/System/Applications/Claude.app'
        ];

        for (const path of commonPaths) {
          try {
            // Use Tauri to check if file exists
            const exists = await invoke('path_exists', { path });
            if (exists) {
              console.log(`✅ Found Claude Desktop at: ${path}`);
              return true;
            }
          } catch (e) {
            // Continue checking other paths
          }
        }
      }

      return false;
    } catch (error) {
      console.log('🔍 Could not auto-detect Claude Desktop');
      return false;
    }
  }

  /**
   * Auto-configure Claude Desktop MCP settings
   * Professional approach: write config file directly
   */
  async configureClaudeDesktop() {
    try {
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        const { invoke } = window.__TAURI_INTERNALS__;
        
        const configPath = '~/.claude/claude_desktop_config.json';
        const serverStatus = mcpServerManager.getStatus();
        
        const config = {
          mcpServers: {
            lokus: {
              command: "node",
              args: [process.cwd() + "/test-mcp-server.js"],
              env: {}
            }
          }
        };

        // Write config file using Tauri
        await invoke('write_file_content', {
          path: configPath,
          content: JSON.stringify(config, null, 2)
        });

        console.log('✅ Claude Desktop configured automatically');
        return true;
      }
      
      return false;
    } catch (error) {
      console.log('⚠️ Could not auto-configure Claude Desktop:', error.message);
      return false;
    }
  }

  /**
   * Verify connection is working
   */
  async verifyConnection() {
    try {
      // Wait a moment for Claude Desktop to pick up config
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Try to ping our MCP server
      const serverStatus = mcpServerManager.getStatus();
      if (serverStatus.isRunning) {
        const response = await fetch(serverStatus.url + '/health');
        return response.ok;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate manual instructions for users
   * Fallback when auto-configuration fails
   */
  generateManualInstructions() {
    const serverStatus = mcpServerManager.getStatus();
    
    return {
      success: false,
      manual: true,
      instructions: [
        {
          step: 1,
          title: "Install Claude Desktop",
          description: "Download and install Claude Desktop from Anthropic's website",
          action: "https://claude.ai/download"
        },
        {
          step: 2,
          title: "Add Lokus Connection",
          description: "Add this configuration to Claude Desktop",
          action: "copy_config",
          config: {
            mcpServers: {
              lokus: {
                command: "node",
                args: [process.cwd() + "/test-mcp-server.js"]
              }
            }
          }
        },
        {
          step: 3,
          title: "Restart Claude Desktop",
          description: "Restart Claude Desktop to load the new configuration"
        }
      ]
    };
  }

  /**
   * Disconnect from AI assistants
   */
  async disconnect() {
    try {
      await mcpServerManager.stop();
      this.connectedClients.clear();
      console.log('🔌 Disconnected from AI assistants');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get connection status
   */
  getStatus() {
    const serverStatus = mcpServerManager.getStatus();
    return {
      connected: serverStatus.isRunning,
      server: serverStatus,
      clients: Array.from(this.connectedClients.keys()),
      ready: serverStatus.isRunning && this.connectedClients.size > 0
    };
  }

  /**
   * Smart reconnection with exponential backoff
   */
  async smartReconnect() {
    if (this.discoveryAttempts >= this.maxDiscoveryAttempts) {
      console.log('🛑 Max reconnection attempts reached');
      return { success: false, reason: 'max_attempts' };
    }

    this.discoveryAttempts++;
    const delay = Math.pow(2, this.discoveryAttempts) * 1000; // Exponential backoff
    
    console.log(`🔄 Reconnection attempt ${this.discoveryAttempts}/${this.maxDiscoveryAttempts} in ${delay}ms`);
    
    await new Promise(resolve => setTimeout(resolve, delay));
    return this.autoConnect();
  }
}

// Create singleton instance
const aiConnectionManager = new AIConnectionManager();

export default aiConnectionManager;