/**
 * MCP HTTP Server Example
 * 
 * Example usage of the MCP HTTP server
 * Demonstrates basic setup and integration with Lokus
 */

import { startDevMCPServer, getMCPHttpServer } from './index.js'

/**
 * Example: Start development MCP server
 */
async function startExampleServer() {
  try {
    console.log('Starting MCP HTTP Server example...')
    
    // Start development server with custom configuration
    const integration = await startDevMCPServer(3456)
    
    console.log('✅ MCP HTTP Server started successfully!')
    console.log('📊 Server Status:', integration.getStatus())
    
    // Display server information
    const httpServer = integration.getHttpServer()
    const stats = httpServer.getStats()
    
    console.log('\n🌐 Server Endpoints:')
    console.log(`   HTTP API: http://localhost:3456/mcp`)
    console.log(`   WebSocket: ws://localhost:3457`)
    console.log(`   Health: http://localhost:3456/health`)
    console.log(`   Info: http://localhost:3456/mcp/info`)
    console.log(`   Stats: http://localhost:3456/mcp/stats`)
    
    console.log('\n📈 Server Statistics:')
    console.log(`   Uptime: ${stats.uptime} seconds`)
    console.log(`   Requests: ${stats.requests}`)
    console.log(`   Memory: ${stats.memory.used}MB / ${stats.memory.total}MB`)
    
    // Example: Test server health
    await testServerHealth()
    
    // Example: Test MCP endpoints
    await testMCPEndpoints()
    
    // Keep server running
    console.log('\n🚀 Server is running. Press Ctrl+C to stop.')
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down server...')
      await integration.stop()
      console.log('✅ Server stopped successfully')
      process.exit(0)
    })
    
  } catch (error) {
    console.error('❌ Failed to start MCP server:', error)
    process.exit(1)
  }
}

/**
 * Test server health
 */
async function testServerHealth() {
  try {
    const response = await fetch('http://localhost:3456/health')
    const health = await response.json()
    
    console.log('\n💚 Health Check:')
    console.log(`   Status: ${health.status}`)
    console.log(`   Uptime: ${health.uptime}s`)
    console.log(`   Services:`, health.services)
    
  } catch (error) {
    console.log('❌ Health check failed:', error.message)
  }
}

/**
 * Test MCP endpoints
 */
async function testMCPEndpoints() {
  try {
    // Test MCP info endpoint
    const infoResponse = await fetch('http://localhost:3456/mcp/info')
    const info = await infoResponse.json()
    
    console.log('\n📋 MCP Server Info:')
    console.log(`   Name: ${info.serverInfo.name}`)
    console.log(`   Version: ${info.serverInfo.version}`)
    console.log(`   Protocol: ${info.serverInfo.protocolVersion}`)
    console.log(`   Capabilities:`, Object.keys(info.capabilities))
    
    // Test JSON-RPC initialize
    const initResponse = await fetch('http://localhost:3456/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            resources: { subscribe: true },
            tools: {},
            prompts: {}
          },
          clientInfo: {
            name: 'Example Client',
            version: '1.0.0'
          }
        }
      })
    })
    
    const initResult = await initResponse.json()
    
    console.log('\n🔧 MCP Initialize:')
    console.log(`   Result:`, initResult.result ? '✅ Success' : '❌ Failed')
    if (initResult.result) {
      console.log(`   Server: ${initResult.result.serverInfo.name}`)
      console.log(`   Protocol: ${initResult.result.protocolVersion}`)
    }
    
    // Test resources list
    const resourcesResponse = await fetch('http://localhost:3456/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MCP-Session-ID': 'example-session'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'resources/list',
        params: {}
      })
    })
    
    const resourcesResult = await resourcesResponse.json()
    
    console.log('\n📚 Resources List:')
    if (resourcesResult.result) {
      console.log(`   Found ${resourcesResult.result.resources.length} resources`)
    } else {
      console.log(`   Error: ${resourcesResult.error?.message}`)
    }
    
  } catch (error) {
    console.log('❌ MCP endpoint test failed:', error.message)
  }
}

/**
 * Example: WebSocket client
 */
function createWebSocketExample() {
  try {
    const ws = new WebSocket('ws://localhost:3457')
    
    ws.onopen = () => {
      console.log('\n🔌 WebSocket connected')
      
      // Send initialize message
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {
            resources: { subscribe: true }
          },
          clientInfo: {
            name: 'WebSocket Example',
            version: '1.0.0'
          }
        }
      }))
    }
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data)
      console.log('📨 WebSocket message:', message)
    }
    
    ws.onclose = () => {
      console.log('🔌 WebSocket disconnected')
    }
    
    ws.onerror = (error) => {
      console.log('❌ WebSocket error:', error)
    }
    
  } catch (error) {
    console.log('❌ WebSocket example failed:', error.message)
  }
}

/**
 * Run example
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  startExampleServer()
}

export {
  startExampleServer,
  testServerHealth,
  testMCPEndpoints,
  createWebSocketExample
}