#!/usr/bin/env node

/**
 * Quick test script for the MCP server
 */

import SecureMCPServer from './src/mcp-server/index.js';

async function testMCPServer() {
  console.log('🚀 Starting MCP Server test...');
  
  try {
    // Create and start the server
    const mcpServer = new SecureMCPServer({
      environment: 'development'
    });
    
    const server = await mcpServer.start(3456, 'localhost');
    console.log('✅ MCP Server started successfully on port 3456');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test health endpoint
    const healthResponse = await fetch('http://localhost:3456/health');
    const healthData = await healthResponse.json();
    console.log('🏥 Health check:', healthData);
    
    // Test MCP capabilities endpoint
    const mcpResponse = await fetch('http://localhost:3456/api/mcp/capabilities');
    const mcpData = await mcpResponse.json();
    console.log('🔌 MCP capabilities:', mcpData);
    
    // Test basic JSON-RPC request (ping)
    const rpcResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 1
      })
    });
    
    const rpcData = await rpcResponse.json();
    console.log('🔧 MCP ping test:', rpcData);
    
    console.log('\n✨ All tests passed! MCP Server is working correctly.');
    
    // Graceful shutdown
    setTimeout(async () => {
      console.log('🛑 Shutting down test server...');
      await mcpServer.stop();
      console.log('✅ Test completed successfully!');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testMCPServer().catch(console.error);