#!/usr/bin/env node

/**
 * Simple test for core MCP functionality
 */

async function testSimpleMCP() {
  console.log('🚀 Testing MCP Server core functionality...\n');
  
  try {
    // Test basic connectivity
    console.log('🔍 Testing server connectivity...');
    const healthResponse = await fetch('http://localhost:3456/health');
    if (healthResponse.ok) {
      const healthData = await healthResponse.json();
      console.log(`✅ Server is running: ${healthData.status}\n`);
    } else {
      throw new Error('Server is not responding');
    }
    
    // Test MCP ping
    console.log('🏓 Testing MCP ping...');
    const pingResponse = await fetch('http://localhost:3456/api/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'ping',
        params: {},
        id: 1
      })
    });
    
    const pingData = await pingResponse.json();
    if (pingData.result?.status === 'pong') {
      console.log('✅ MCP ping successful\n');
    } else {
      console.log('❌ MCP ping failed:', pingData);
    }
    
    // Test tools list
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
    if (toolsData.result?.tools) {
      console.log(`✅ Found ${toolsData.result.tools.length} tools:`);
      toolsData.result.tools.slice(0, 5).forEach(tool => {
        console.log(`  - ${tool.name}: ${tool.description}`);
      });
      if (toolsData.result.tools.length > 5) {
        console.log(`  ... and ${toolsData.result.tools.length - 5} more tools`);
      }
    } else {
      console.log('❌ Tools list failed:', toolsData);
    }
    console.log('');
    
    // Test resources list
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
    if (resourcesData.result?.resources) {
      console.log(`✅ Found ${resourcesData.result.resources.length} resources:`);
      resourcesData.result.resources.slice(0, 5).forEach(resource => {
        console.log(`  - ${resource.uri}: ${resource.name}`);
      });
      if (resourcesData.result.resources.length > 5) {
        console.log(`  ... and ${resourcesData.result.resources.length - 5} more resources`);
      }
    } else {
      console.log('❌ Resources list failed:', resourcesData);
    }
    console.log('');
    
    console.log('✨ Simple MCP test completed successfully!\n');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSimpleMCP().catch(console.error);