# Secure MCP Server Authentication & Security System

A comprehensive authentication and security system for the MCP (Model Context Protocol) server, providing enterprise-grade security features including JWT authentication, API key management, rate limiting, CORS protection, and security headers.

## 🔐 Features

### Authentication & Authorization
- **JWT Token Management**: Secure token-based authentication with access and refresh tokens
- **API Key System**: Flexible API key generation with scopes, permissions, and expiration
- **Multi-Factor Auth Ready**: Extensible architecture for MFA implementation
- **Role-Based Access**: Granular permissions and scope-based authorization

### Security Protection
- **Rate Limiting**: Multiple algorithms (sliding window, token bucket, fixed window)
- **CORS Protection**: Configurable cross-origin resource sharing with security checks
- **Security Headers**: Comprehensive headers including CSP, HSTS, XSS protection
- **Request Validation**: Input sanitization and security attack prevention

### Monitoring & Auditing
- **Comprehensive Logging**: Detailed audit trails for all security events
- **Real-time Monitoring**: Event-driven architecture for security monitoring
- **Admin Dashboard**: RESTful APIs for security management and analytics
- **Configuration Management**: Dynamic configuration with hot-reloading

## 📁 Architecture

```
src/mcp-server/
├── auth/
│   ├── jwt.js              # JWT token management
│   ├── apiKeys.js          # API key generation & validation
│   ├── rateLimiter.js      # Rate limiting implementation
│   ├── validator.js        # Request validation & sanitization
│   └── middleware.js       # Authentication middleware
├── security/
│   ├── cors.js             # CORS configuration & protection
│   └── headers.js          # Security headers management
├── config/
│   └── security.js         # Configuration management
├── examples/
│   └── basic-usage.js      # Example implementation
├── index.js                # Main server integration
└── README.md               # This file
```

## 🚀 Quick Start

### Basic Setup

```javascript
import SecureMCPServer, { setupGracefulShutdown } from './src/mcp-server/index.js'

// Create server with default configuration
const server = new SecureMCPServer()

// Start the server
await server.start(3000, 'localhost')

// Setup graceful shutdown
setupGracefulShutdown(server)
```

### Generate API Keys

```javascript
// Admin API key with full access
const adminKey = await server.authMiddleware.generateAPIKey('admin-user', {
  name: 'Admin API Key',
  scopes: ['*'],
  permissions: { '*': ['*'] }
})

// Read-only API key
const readOnlyKey = await server.authMiddleware.generateAPIKey('readonly-user', {
  name: 'Read-Only Access',
  scopes: ['read'],
  permissions: {
    'tools': ['read'],
    'resources': ['read']
  }
})
```

## 🔧 Configuration

### Environment Variables

```bash
# JWT Configuration
JWT_ACCESS_SECRET=your-jwt-access-secret
JWT_REFRESH_SECRET=your-jwt-refresh-secret
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_PER_HOUR=1000
RATE_LIMIT_PER_DAY=10000
RATE_LIMIT_BURST=10

# CORS Configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:5173

# Security Headers
CSP_REPORT_URI=/api/security/csp-report
```

### Configuration File

```javascript
import SecurityConfigManager from './src/mcp-server/config/security.js'

const configManager = new SecurityConfigManager('./config/security.json')

// Load configuration from file
await configManager.loadConfig()

// Watch for configuration changes
await configManager.watchConfig()

// Update configuration section
configManager.updateConfig('rateLimit', {
  defaultLimits: {
    requestsPerMinute: 120
  }
})
```

## 🔑 API Key Management

### Generate API Key

```bash
curl -X POST http://localhost:3000/api/admin/auth/api-keys \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ADMIN_API_KEY" \
  -d '{
    "clientId": "client-123",
    "name": "Client API Key",
    "scopes": ["read", "write"],
    "permissions": {
      "tools": ["read", "execute"],
      "resources": ["read"]
    },
    "rateLimit": {
      "requestsPerMinute": 100,
      "requestsPerHour": 2000
    },
    "expiresIn": "90d"
  }'
```

### API Key Properties

| Property | Description | Required |
|----------|-------------|----------|
| `clientId` | Unique identifier for the client | ✅ |
| `name` | Human-readable name for the key | ❌ |
| `scopes` | Array of authorized scopes | ❌ |
| `permissions` | Resource-action permission mapping | ❌ |
| `rateLimit` | Custom rate limits for this key | ❌ |
| `expiresIn` | Expiration duration (e.g., "90d", "1y") | ❌ |
| `metadata` | Additional metadata object | ❌ |

### Scopes

| Scope | Description |
|-------|-------------|
| `read` | Read-only access to all resources |
| `write` | Write access to resources |
| `admin` | Administrative access |
| `tools` | Access to tool execution |
| `resources` | Access to resource management |
| `*` | Wildcard - all permissions |

### Permissions

Permissions follow the format `resource:action`:

```javascript
{
  "tools": ["read", "execute"],
  "resources": ["read", "write", "delete"],
  "prompts": ["read", "execute"],
  "*": ["*"]  // Wildcard permissions
}
```

## 🛡️ Security Features

### Rate Limiting

Three algorithms available:

1. **Sliding Window** (default): Most accurate, tracks requests in real-time
2. **Token Bucket**: Allows bursts, good for APIs with variable load
3. **Fixed Window**: Simple implementation, resets at fixed intervals

```javascript
// Configure rate limiting
const rateLimitConfig = {
  algorithm: 'sliding_window',
  defaultLimits: {
    requestsPerMinute: 60,
    requestsPerHour: 1000,
    requestsPerDay: 10000,
    burstLimit: 10
  }
}
```

### CORS Protection

```javascript
// CORS configuration
const corsConfig = {
  allowedOrigins: ['https://yourdomain.com'],
  allowCredentials: true,
  strictMode: true,
  enableSecurityChecks: true,
  allowPrivateNetworks: false
}
```

### Security Headers

Automatically sets comprehensive security headers:

- **Content Security Policy (CSP)**: Prevents XSS attacks
- **HTTP Strict Transport Security (HSTS)**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: Legacy XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Controls browser features

### Request Validation

- **Input Sanitization**: Removes malicious content
- **Schema Validation**: Validates request structure
- **Security Checks**: Detects injection attacks
- **Size Limits**: Prevents DoS attacks

## 📊 Monitoring & Analytics

### Health Check

```bash
curl http://localhost:3000/health
```

### Security Statistics

```bash
curl -H "X-API-Key: ADMIN_KEY" \
  http://localhost:3000/api/admin/security/stats
```

### Audit Logs

```bash
curl -H "X-API-Key: ADMIN_KEY" \
  "http://localhost:3000/api/admin/audit?limit=100&action=authenticated"
```

## 🔒 MCP Integration

### Making MCP Requests

```bash
# Ping request
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"ping","id":1}'

# List tools (requires tools:read permission)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'

# Execute tool (requires tools:execute permission)
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "jsonrpc":"2.0",
    "method":"tools/call",
    "params":{
      "name":"echo",
      "arguments":{"message":"Hello World"}
    },
    "id":3
  }'
```

### Permission Requirements

| MCP Method | Required Permission |
|------------|-------------------|
| `ping` | None |
| `initialize` | None |
| `tools/list` | `tools:read` |
| `tools/call` | `tools:execute` |
| `resources/list` | `resources:read` |
| `resources/read` | `resources:read` |
| `prompts/list` | `prompts:read` |
| `prompts/get` | `prompts:read` |

## 🚦 Error Handling

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `400` | Bad Request - Invalid input or validation failed |
| `401` | Unauthorized - Missing or invalid authentication |
| `403` | Forbidden - Insufficient permissions |
| `429` | Too Many Requests - Rate limit exceeded |
| `500` | Internal Server Error - Server-side error |

### Error Response Format

```json
{
  "error": "rate_limit_exceeded",
  "message": "Request rate limit exceeded",
  "requestId": "req_1234567890_abc123",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "retryAfter": 30000
}
```

### MCP Error Format

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32001,
    "message": "Insufficient permissions",
    "data": {
      "required": "tools:execute"
    }
  },
  "id": 1
}
```

## 🔧 Advanced Configuration

### Production Configuration

```javascript
const productionConfig = {
  environment: 'production',
  auth: {
    jwt: {
      accessTokenExpiry: '15m',
      refreshTokenExpiry: '7d'
    },
    apiKey: {
      defaultExpiry: '90d',
      maxKeysPerClient: 5
    }
  },
  rateLimit: {
    defaultLimits: {
      requestsPerMinute: 30,
      requestsPerHour: 500,
      requestsPerDay: 5000
    }
  },
  cors: {
    allowedOrigins: ['https://yourdomain.com'],
    strictMode: true,
    allowPrivateNetworks: false
  },
  headers: {
    csp: {
      reportOnly: false,
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
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
```

### Custom Middleware

```javascript
// Add custom authentication middleware
server.app.use('/api/custom', (req, res, next) => {
  // Custom authentication logic
  if (!req.auth?.scopes?.includes('custom')) {
    return res.status(403).json({ error: 'Custom scope required' })
  }
  next()
})
```

### Event Handling

```javascript
// Monitor security events
server.on('rateLimited', (data) => {
  console.log(`Rate limited: ${data.clientId}`)
  // Send alert to monitoring system
})

server.on('clientBlocked', (data) => {
  console.log(`Client blocked: ${data.clientId}`)
  // Log security incident
})

server.on('cspViolation', (data) => {
  console.log(`CSP violation: ${data.violation.violatedDirective}`)
  // Track potential XSS attempts
})
```

## 🔍 Troubleshooting

### Common Issues

#### 1. API Key Not Working

**Problem**: Requests return 401 Unauthorized

**Solutions**:
- Check API key format: `mcp_xxxxxxxx_yyyyyyyy`
- Verify key hasn't expired: Check `expiresAt` field
- Confirm key is active: Check `status` field
- Validate request headers: Use `X-API-Key` header

#### 2. Rate Limit Exceeded

**Problem**: Requests return 429 Too Many Requests

**Solutions**:
- Check rate limit headers in response
- Implement exponential backoff
- Request higher rate limits for your API key
- Check if multiple clients use same key

#### 3. CORS Errors

**Problem**: Browser requests fail with CORS errors

**Solutions**:
- Add your domain to `allowedOrigins`
- Check if credentials are required
- Verify request method is allowed
- Enable CORS debugging in development

#### 4. Permission Denied

**Problem**: Requests return 403 Forbidden

**Solutions**:
- Check API key scopes: Ensure required scope is granted
- Verify permissions: Check resource:action permissions
- Review MCP method requirements
- Contact admin for permission updates

### Debug Mode

Enable debug logging:

```javascript
const server = new SecureMCPServer({
  development: {
    verboseLogging: true
  },
  logging: {
    level: 'debug'
  }
})
```

### Health Checks

Monitor system health:

```bash
# Basic health check
curl http://localhost:3000/health

# Detailed security statistics
curl -H "X-API-Key: ADMIN_KEY" \
  http://localhost:3000/api/admin/security/stats
```

## 📝 License

This security system is part of the Lokus project and follows the same licensing terms.

## 🤝 Contributing

1. Follow existing code style and patterns
2. Add comprehensive tests for new features
3. Update documentation for any API changes
4. Ensure security best practices are maintained

## 📞 Support

For security-related issues or questions:
1. Check this documentation first
2. Review audit logs for clues
3. Enable debug logging
4. File an issue with detailed reproduction steps

---

**⚠️ Security Notice**: This system handles sensitive authentication data. Always use HTTPS in production, regularly rotate secrets, and monitor audit logs for suspicious activity.