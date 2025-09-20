/**
 * MCP HTTP Server Middleware
 * 
 * Security and rate limiting middleware for the MCP HTTP server
 * Provides CORS, helmet security headers, rate limiting, and request validation
 */

import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

/**
 * Security Headers Middleware
 * Uses helmet to set various HTTP security headers
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
})

/**
 * CORS Configuration
 * Configurable CORS middleware for cross-origin requests
 */
export const createCorsMiddleware = (options = {}) => {
  const corsOptions = {
    origin: options.allowedOrigins || ['http://localhost:3000', 'http://localhost:5173', 'tauri://localhost'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type', 
      'Authorization', 
      'X-Requested-With',
      'X-MCP-Client-Info',
      'X-MCP-Session-ID'
    ],
    credentials: true,
    optionsSuccessStatus: 200,
    ...options.cors
  }

  return cors(corsOptions)
}

/**
 * Rate Limiting Middleware
 * Different rate limits for different types of requests
 */
export const createRateLimiters = (options = {}) => {
  const rateLimitOptions = {
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.maxRequests || 100, // per window
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        jsonrpc: '2.0',
        error: {
          code: -32429,
          message: 'Too Many Requests',
          data: {
            retryAfter: Math.round(req.rateLimit.resetTime / 1000)
          }
        },
        id: req.body?.id || null
      })
    },
    ...options.general
  }

  // General API rate limiter
  const generalLimiter = rateLimit(rateLimitOptions)

  // Stricter rate limiter for tool execution
  const toolExecutionLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: options.toolWindowMs || 5 * 60 * 1000, // 5 minutes
    max: options.maxToolRequests || 20, // fewer tool executions
    keyGenerator: (req) => {
      // Rate limit by IP and method combination for tool calls
      const method = req.body?.method || 'unknown'
      return `${req.ip}:${method}`
    }
  })

  // WebSocket connection rate limiter
  const wsConnectionLimiter = rateLimit({
    ...rateLimitOptions,
    windowMs: options.wsWindowMs || 10 * 60 * 1000, // 10 minutes
    max: options.maxWsConnections || 10, // WebSocket connections
    skipSuccessfulRequests: true
  })

  return {
    general: generalLimiter,
    toolExecution: toolExecutionLimiter,
    wsConnection: wsConnectionLimiter
  }
}

/**
 * JSON-RPC Request Validation Middleware
 * Validates incoming JSON-RPC 2.0 requests
 */
export const validateJsonRpc = (req, res, next) => {
  // Skip validation for non-JSON requests (like health checks)
  if (!req.is('application/json')) {
    return next()
  }

  const { body } = req

  // Check for JSON-RPC structure
  if (!body || typeof body !== 'object') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: 'Parse error',
        data: 'Invalid JSON'
      },
      id: null
    })
  }

  // Validate JSON-RPC 2.0 format
  if (body.jsonrpc !== '2.0') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: 'JSON-RPC version must be "2.0"'
      },
      id: body.id || null
    })
  }

  // Validate method for requests
  if (body.method && typeof body.method !== 'string') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: 'Method must be a string'
      },
      id: body.id || null
    })
  }

  // Validate params if present
  if (body.params !== undefined && typeof body.params !== 'object') {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32600,
        message: 'Invalid Request',
        data: 'Params must be an object or array'
      },
      id: body.id || null
    })
  }

  next()
}

/**
 * MCP-specific Request Validation
 * Validates MCP protocol-specific requirements
 */
export const validateMcpRequest = (req, res, next) => {
  // Skip validation for non-MCP endpoints
  if (!req.path.startsWith('/mcp')) {
    return next()
  }

  const { body } = req
  const { method } = body || {}

  // Check for required MCP methods
  const mcpMethods = [
    'initialize',
    'resources/list',
    'resources/read',
    'resources/subscribe',
    'resources/unsubscribe',
    'tools/list',
    'tools/call',
    'prompts/list',
    'prompts/get',
    'logging/setLevel',
    'completion/complete'
  ]

  if (method && !mcpMethods.includes(method)) {
    return res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Method not found',
        data: `Unknown MCP method: ${method}`
      },
      id: body.id || null
    })
  }

  // Validate initialization requirements
  if (method === 'initialize') {
    const { params } = body
    if (!params || !params.protocolVersion || !params.capabilities) {
      return res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Initialize method requires protocolVersion and capabilities'
        },
        id: body.id || null
      })
    }
  }

  next()
}

/**
 * Request Logging Middleware
 * Logs MCP requests for debugging and monitoring
 */
export const requestLogger = (options = {}) => {
  const logLevel = options.logLevel || 'info'
  const includeBody = options.includeBody !== false

  return (req, res, next) => {
    const start = Date.now()
    const { method: httpMethod, path, ip } = req
    const mcpMethod = req.body?.method || 'unknown'

    // Log request
    if (logLevel === 'debug' || logLevel === 'info') {
      const logData = {
        timestamp: new Date().toISOString(),
        ip,
        httpMethod,
        path,
        mcpMethod,
        userAgent: req.get('User-Agent'),
        ...(includeBody && logLevel === 'debug' && { body: req.body })
      }
      
      console.log(`[MCP-Server] ${httpMethod} ${path} - ${mcpMethod}`, logData)
    }

    // Log response
    const originalSend = res.send
    res.send = function(data) {
      const duration = Date.now() - start
      
      if (logLevel === 'debug' || logLevel === 'info') {
        console.log(`[MCP-Server] Response ${res.statusCode} - ${duration}ms`)
      }
      
      originalSend.call(this, data)
    }

    next()
  }
}

/**
 * Error Handling Middleware
 * Converts errors to JSON-RPC 2.0 error responses
 */
export const errorHandler = (err, req, res, next) => {
  console.error('[MCP-Server] Error:', err)

  // If response already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err)
  }

  // Default to internal error
  let code = -32603
  let message = 'Internal error'
  let data = undefined

  // Map specific error types
  if (err.code) {
    code = err.code
    message = err.message
    data = err.data
  } else if (err.name === 'ValidationError') {
    code = -32602
    message = 'Invalid params'
    data = err.message
  } else if (err.name === 'SyntaxError') {
    code = -32700
    message = 'Parse error'
    data = 'Invalid JSON'
  }

  // Send JSON-RPC error response
  res.status(err.statusCode || 500).json({
    jsonrpc: '2.0',
    error: {
      code,
      message,
      ...(data && { data })
    },
    id: req.body?.id || null
  })
}

/**
 * Health Check Middleware
 * Simple health check that bypasses other middleware
 */
export const healthCheck = (req, res, next) => {
  if (req.path === '/health' || req.path === '/mcp/health') {
    return res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0'
    })
  }
  next()
}

/**
 * Create all middleware for MCP server
 */
export const createMiddleware = (options = {}) => {
  const rateLimiters = createRateLimiters(options.rateLimit)
  const corsMiddleware = createCorsMiddleware(options)

  return {
    security: securityHeaders,
    cors: corsMiddleware,
    rateLimiters,
    validateJsonRpc,
    validateMcpRequest,
    requestLogger: requestLogger(options.logging),
    errorHandler,
    healthCheck
  }
}

export default {
  createMiddleware,
  createRateLimiters,
  createCorsMiddleware,
  securityHeaders,
  validateJsonRpc,
  validateMcpRequest,
  requestLogger,
  errorHandler,
  healthCheck
}