/**
 * Lokus MCP Client - Stdio Configuration Helper
 *
 * Simple client that helps users configure their AI assistant to connect to Lokus via MCP.
 * No server management needed - just provides connection instructions.
 */

class MCPClient {
  constructor() {
    this.connectionConfigured = false
    this.subscribers = new Set()
  }

  /**
   * Check if the user has likely configured their AI assistant with Lokus MCP
   * This is informational only - we can't actually verify the assistant config
   * @returns {Object} Configuration status
   */
  getConfigurationStatus() {
    return {
      configured: this.connectionConfigured,
      serverType: 'stdio',
      command: 'node src/mcp-server/stdio-server.js'
    }
  }

  /**
   * Mark that user has been shown/used the connection instructions
   * This is just for UI state - doesn't affect actual connection
   */
  markConnectionShown() {
    this.connectionConfigured = true
    
    this.notifySubscribers({
      type: 'configuration_updated',
      configured: true
    })
  }

  /**
   * Get connection instructions for AI assistant
   * @returns {Object} Connection details
   */
  getConnectionInstructions() {
    return {
      command: 'claude mcp add lokus',
      args: 'node src/mcp-server/stdio-server.js',
      fullCommand: 'claude mcp add lokus node src/mcp-server/stdio-server.js',
      description: 'This connects your AI assistant to your Lokus workspace via stdio'
    }
  }

  /**
   * Subscribe to configuration changes
   * @param {Function} callback - Callback function for updates
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.subscribers.add(callback)
    
    // Immediately notify with current status
    callback({
      type: 'configuration_status',
      configured: this.connectionConfigured
    })
    
    return () => {
      this.subscribers.delete(callback)
    }
  }

  /**
   * Notify all subscribers of configuration changes
   * @param {Object} data - Data to send to subscribers
   */
  notifySubscribers(data) {
    this.subscribers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        console.error('Error in MCP client subscriber:', error)
      }
    })
  }
}

// Create and export singleton instance
const mcpClient = new MCPClient()
export default mcpClient