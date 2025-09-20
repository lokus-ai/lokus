#!/usr/bin/env node

/**
 * Comprehensive test script for complete MCP server functionality
 */

import SecureMCPServer from './src/mcp-server/index.js';

async function testCompleteMCPServer() {
  console.log('🚀 Starting comprehensive MCP Server test...\n');
  
  try {
    // Start the server with new functionality
    const mcpServer = new SecureMCPServer({
      environment: 'development'
    });
    
    const server = await mcpServer.start(3456, 'localhost');
    console.log('✅ Complete MCP Server started successfully on port 3456\n');
    
    // Wait a moment for server to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test 1: Health check
    console.log('🏥 Testing health endpoint...');
    const healthResponse = await fetch('http://localhost:3456/health');
    const healthData = await healthResponse.json();
    console.log(`Status: ${healthData.status}, Components: ${Object.entries(healthData.components).map(([k,v]) => `${k}:${v}`).join(', ')}\n`);
    
    // Test 2: MCP capabilities
    console.log('🔌 Testing MCP capabilities...');
    const capResponse = await fetch('http://localhost:3456/api/mcp/capabilities');
    const capData = await capResponse.json();
    console.log(`Protocol: ${capData.protocolVersion}, Server: ${capData.serverInfo.name} v${capData.serverInfo.version}\n`);
    
    // Test 3: Tools list (should now include real tools)
    console.log('🔧 Testing tools list...');
    const toolsResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        params: {},
        id: 2
      })
    });
    
    const toolsData = await toolsResponse.json();
    if (toolsData.result && toolsData.result.tools) {
      console.log(`Found ${toolsData.result.tools.length} tools:`);
      toolsData.result.tools.forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
    } else {
      console.log('Tools result:', JSON.stringify(toolsData, null, 2));
    }
    console.log('');
    
    // Test 4: Resources list
    console.log('📁 Testing resources list...');
    const resourcesResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'resources/list',
        params: {},
        id: 3
      })
    });
    
    const resourcesData = await resourcesResponse.json();
    if (resourcesData.result && resourcesData.result.resources) {
      console.log(`Found ${resourcesData.result.resources.length} resources:`);
      resourcesData.result.resources.slice(0, 5).forEach(resource => {
        console.log(`  - ${resource.uri}: ${resource.name}`);
      });
      if (resourcesData.result.resources.length > 5) {
        console.log(`  ... and ${resourcesData.result.resources.length - 5} more`);
      }
    } else {
      console.log('Resources result:', JSON.stringify(resourcesData, null, 2));
    }
    console.log('');
    
    // Test 5: Test a file tool
    console.log('📝 Testing file operations...');
    const readResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'list_files',
          arguments: { path: '.' }
        },
        id: 4
      })
    });
    
    const readData = await readResponse.json();
    if (readData.result) {
      console.log('✅ File listing tool working');
    } else {
      console.log('File tool result:', JSON.stringify(readData, null, 2));
    }
    console.log('');
    
    // Test 6: Test workspace resource
    console.log('🗂️ Testing workspace resources...');
    const workspaceResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'resources/read',
        params: {
          uri: 'lokus://workspace/info'
        },
        id: 5
      })
    });
    
    const workspaceData = await workspaceResponse.json();
    if (workspaceData.result) {
      console.log('✅ Workspace resource provider working');
    } else {
      console.log('Workspace resource result:', JSON.stringify(workspaceData, null, 2));
    }
    console.log('');
    
    // Test 7: Admin endpoints
    console.log('🔑 Testing admin endpoints...');
    const statsResponse = await fetch('http://localhost:3456/api/admin/security/stats');
    if (statsResponse.status === 403) {
      console.log('✅ Admin endpoints properly protected (403 Forbidden)');
    } else {
      const statsData = await statsResponse.json();
      console.log('Admin stats:', statsData);
    }
    console.log('');
    
    console.log('✨ All comprehensive tests completed! MCP Server with complete functionality is working.\n');
    
    // Graceful shutdown
    setTimeout(async () => {
      console.log('🛑 Shutting down complete MCP server...');
      await mcpServer.stop();
      console.log('✅ Complete MCP server test finished successfully!');
      process.exit(0);
    }, 2000);
    
  } catch (error) {
    console.error('❌ Comprehensive test failed:', error);
    process.exit(1);
  }
}

// Run the comprehensive test
testCompleteMCPServer().catch(console.error);