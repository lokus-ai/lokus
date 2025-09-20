/**
 * Basic Usage Example for Secure MCP Server
 * 
 * This example demonstrates how to set up and use the comprehensive
 * authentication and security system for the MCP server.
 */

import SecureMCPServer, { setupGracefulShutdown } from '../index.js'

async function main() {
  try {
    console.log('🔒 Starting Secure MCP Server Example...')

    // Create server with custom configuration
    const server = new SecureMCPServer({
      // Optional: path to config file
      // configPath: './config/security.json'
    })

    // Setup event listeners for monitoring
    setupEventListeners(server)

    // Start the server
    await server.start(3000, 'localhost')

    // Setup graceful shutdown
    setupGracefulShutdown(server)

    // Example: Generate an admin API key
    console.log('\n📋 Setting up initial admin API key...')
    const adminKey = await server.authMiddleware.generateAPIKey('admin-user', {
      name: 'Admin API Key',
      description: 'Full access admin key',
      scopes: ['*'],
      permissions: {
        '*': ['*']
      },
      rateLimit: {
        requestsPerMinute: 1000,
        requestsPerHour: 10000,
        requestsPerDay: 100000,
        burstLimit: 50
      }
    })

    console.log(`🔑 Admin API Key: ${adminKey.apiKey}`)
    console.log(`🔍 Key ID: ${adminKey.keyId}`)

    // Example: Generate a read-only API key
    const readOnlyKey = await server.authMiddleware.generateAPIKey('readonly-user', {
      name: 'Read-Only API Key',
      description: 'Limited access for reading data',
      scopes: ['read'],
      permissions: {
        'tools': ['read'],
        'resources': ['read'],
        'prompts': ['read']
      },
      rateLimit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        requestsPerDay: 10000,
        burstLimit: 10
      }
    })

    console.log(`\n🔓 Read-Only API Key: ${readOnlyKey.apiKey}`)
    console.log(`🔍 Key ID: ${readOnlyKey.keyId}`)

    // Print usage examples
    printUsageExamples(adminKey.apiKey, readOnlyKey.apiKey)

  } catch (error) {
    console.error('❌ Failed to start server:', error.message)
    process.exit(1)
  }
}

function setupEventListeners(server) {
  // Authentication events
  server.on('rateLimited', (data) => {
    console.log(`⚠️  Rate limited: ${data.clientId} - ${data.reason}`)
  })

  server.on('clientBlocked', (data) => {
    console.log(`🚫 Client blocked: ${data.clientId} (${data.reason})`)
  })

  server.on('activityLogged', (data) => {
    if (data.action === 'authenticated') {
      console.log(`✅ Auth: ${data.clientId} (${data.type})`)
    }
  })

  // CORS events
  server.on('corsViolation', (data) => {
    console.log(`🚫 CORS violation: ${data.origin} - ${data.reason}`)
  })

  // Security header events
  server.on('cspViolation', (data) => {
    console.log(`⚠️  CSP violation: ${data.violation.violatedDirective}`)
  })

  // Server events
  server.on('serverError', (data) => {
    console.error(`❌ Server error: ${data.error}`)
  })
}

function printUsageExamples(adminKey, readOnlyKey) {
  console.log(`
📚 Usage Examples:

1. Health Check:
   curl http://localhost:3000/health

2. MCP Capabilities (no auth required):
   curl http://localhost:3000/api/mcp/capabilities

3. MCP Request with API Key:
   curl -X POST http://localhost:3000/api/mcp \\
     -H "Content-Type: application/json" \\
     -H "X-API-Key: ${readOnlyKey}" \\
     -d '{"jsonrpc":"2.0","method":"ping","id":1}'

4. List Tools (requires tools:read permission):
   curl -X POST http://localhost:3000/api/mcp \\
     -H "Content-Type: application/json" \\
     -H "X-API-Key: ${readOnlyKey}" \\
     -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'

5. Call Tool (requires tools:execute permission - will fail with read-only key):
   curl -X POST http://localhost:3000/api/mcp \\
     -H "Content-Type: application/json" \\
     -H "X-API-Key: ${readOnlyKey}" \\
     -d '{"jsonrpc":"2.0","method":"tools/call","params":{"name":"echo","arguments":{"message":"Hello"}},"id":3}'

6. Admin: Get Security Stats:
   curl http://localhost:3000/api/admin/security/stats \\
     -H "X-API-Key: ${adminKey}"

7. Admin: Create New API Key:
   curl -X POST http://localhost:3000/api/admin/auth/api-keys \\
     -H "Content-Type: application/json" \\
     -H "X-API-Key: ${adminKey}" \\
     -d '{"clientId":"new-client","name":"Test Key","scopes":["read"]}'

8. Admin: Get Audit Log:
   curl "http://localhost:3000/api/admin/audit?limit=10" \\
     -H "X-API-Key: ${adminKey}"

9. Test Rate Limiting (run multiple times quickly):
   for i in {1..20}; do curl -H "X-API-Key: ${readOnlyKey}" http://localhost:3000/api/mcp/capabilities; done

10. Test CORS (from browser console):
    fetch('http://localhost:3000/api/mcp/capabilities', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://example.com',
        'Access-Control-Request-Method': 'POST'
      }
    })

🔐 Security Features Enabled:
- ✅ JWT Authentication (ready for use)
- ✅ API Key Authentication
- ✅ Rate Limiting (sliding window algorithm)
- ✅ Request Validation & Sanitization
- ✅ CORS Protection
- ✅ Security Headers (CSP, HSTS, etc.)
- ✅ Comprehensive Audit Logging
- ✅ Admin Management Interface

📊 Monitoring Endpoints:
- Health: http://localhost:3000/health
- Security Stats: http://localhost:3000/api/admin/security/stats
- Configuration: http://localhost:3000/api/admin/config
- Audit Logs: http://localhost:3000/api/admin/audit

🛡️  Security Notes:
- All admin endpoints require admin scope
- Rate limits are enforced per API key
- CORS is configured for localhost development
- CSP is in report-only mode for development
- All requests are logged for audit purposes
`)
}

// Additional utility functions for testing

/**
 * Test authentication with different scenarios
 */
async function testAuthentication(serverUrl, apiKey) {
  console.log('\n🧪 Testing Authentication...')

  const tests = [
    {
      name: 'Valid API Key',
      headers: { 'X-API-Key': apiKey },
      expectedStatus: 200
    },
    {
      name: 'Invalid API Key',
      headers: { 'X-API-Key': 'invalid-key' },
      expectedStatus: 401
    },
    {
      name: 'Missing API Key',
      headers: {},
      expectedStatus: 401
    }
  ]

  for (const test of tests) {
    try {
      const response = await fetch(`${serverUrl}/api/mcp/capabilities`, {
        headers: test.headers
      })
      
      const status = response.status
      const success = status === test.expectedStatus
      console.log(`${success ? '✅' : '❌'} ${test.name}: ${status} (expected ${test.expectedStatus})`)
      
    } catch (error) {
      console.log(`❌ ${test.name}: Failed - ${error.message}`)
    }
  }
}

/**
 * Test rate limiting
 */
async function testRateLimit(serverUrl, apiKey) {
  console.log('\n🧪 Testing Rate Limiting...')

  const requests = []
  const numberOfRequests = 10

  console.log(`Sending ${numberOfRequests} requests rapidly...`)

  for (let i = 0; i < numberOfRequests; i++) {
    requests.push(
      fetch(`${serverUrl}/api/mcp/capabilities`, {
        headers: { 'X-API-Key': apiKey }
      })
    )
  }

  try {
    const responses = await Promise.all(requests)
    const statusCounts = {}
    
    responses.forEach(response => {
      statusCounts[response.status] = (statusCounts[response.status] || 0) + 1
    })

    console.log('Response status distribution:')
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count} requests`)
    })

    if (statusCounts['429']) {
      console.log('✅ Rate limiting is working - some requests were throttled')
    } else {
      console.log('⚠️  No rate limiting detected - all requests succeeded')
    }

  } catch (error) {
    console.log(`❌ Rate limit test failed: ${error.message}`)
  }
}

/**
 * Example configuration for production deployment
 */
function generateProductionConfig() {
  return {
    environment: 'production',
    auth: {
      jwt: {
        accessTokenSecret: 'your-super-secret-jwt-key-here',
        refreshTokenSecret: 'your-super-secret-refresh-key-here',
        accessTokenExpiry: '15m',
        refreshTokenExpiry: '7d'
      },
      apiKey: {
        defaultExpiry: '90d', // Shorter expiry for production
        maxKeysPerClient: 5
      }
    },
    rateLimit: {
      defaultLimits: {
        requestsPerMinute: 30, // More restrictive
        requestsPerHour: 500,
        requestsPerDay: 5000,
        burstLimit: 5
      }
    },
    cors: {
      allowedOrigins: [
        'https://your-production-domain.com',
        'https://app.your-domain.com'
      ],
      strictMode: true,
      allowPrivateNetworks: false
    },
    headers: {
      csp: {
        reportOnly: false, // Enforce CSP in production
        directives: {
          'default-src': ["'self'"],
          'script-src': ["'self'"],
          'style-src': ["'self'", "'unsafe-inline'"],
          'img-src': ["'self'", 'https:', 'data:'],
          'connect-src': ["'self'"],
          'font-src': ["'self'"],
          'object-src': ["'none'"],
          'frame-src': ["'none'"],
          'upgrade-insecure-requests': []
        }
      },
      hsts: {
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    }
  }
}

// Export for testing
export { testAuthentication, testRateLimit, generateProductionConfig }

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}