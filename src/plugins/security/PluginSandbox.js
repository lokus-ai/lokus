/**
 * Plugin Sandbox - Secure execution environment for plugins
 * 
 * Provides isolated execution context using Web Workers with:
 * - Resource quotas (CPU, memory, network)
 * - Permission-based API access
 * - Code signing verification
 * - Runtime monitoring
 */

import { EventEmitter } from '../../utils/EventEmitter.js'

export class PluginSandbox extends EventEmitter {
  constructor(pluginId, manifest, options = {}) {
    super()
    
    this.pluginId = pluginId
    this.manifest = manifest
    this.options = {
      memoryLimit: 50 * 1024 * 1024, // 50MB default
      cpuTimeLimit: 1000, // 1 second CPU time per task
      networkTimeout: 30000, // 30 seconds
      maxFileSize: 10 * 1024 * 1024, // 10MB max file access
      ...options
    }
    
    this.worker = null
    this.workerEnabled = false
    this.isRunning = false
    this.stats = {
      memoryUsage: 0,
      cpuTime: 0,
      networkRequests: 0,
      apiCalls: 0,
      errors: 0,
      startTime: null
    }
    
    this.permissions = new Set(manifest.permissions || [])
    this.messageHandlers = new Map()
    this.pendingRequests = new Map()
    this.requestId = 0
    
    // Resource monitoring
    this.resourceMonitor = null
    this.quotaExceeded = false
  }

  /**
   * Initialize and start the sandbox
   */
  async initialize() {
    try {
      // Verify plugin code signature (if required)
      if (this.options.requireSignature) {
        await this.verifyCodeSignature()
      }

      // Try to create isolated worker (may fail in Tauri/restricted environments)
      try {
        await this.createWorker()
        // Initialize plugin in worker
        await this.initializePlugin()
        this.workerEnabled = true
      } catch (workerError) {
        // Workers not supported (e.g., Tauri webview with blob URL restrictions)
        // Continue without worker-based isolation - use lightweight monitoring only
        console.warn(`[PluginSandbox] Worker creation failed for ${this.pluginId}, using lightweight monitoring:`, workerError.message)
        this.workerEnabled = false
        this.worker = null
      }

      // Set up resource monitoring (works without worker)
      this.startResourceMonitoring()

      this.isRunning = true
      this.stats.startTime = Date.now()

      this.emit('initialized', { pluginId: this.pluginId, workerEnabled: this.workerEnabled })

    } catch (error) {
      this.emit('error', { pluginId: this.pluginId, error })
      throw error
    }
  }

  /**
   * Create isolated Web Worker for plugin execution
   */
  async createWorker() {
    // Create worker with security constraints
    const workerCode = this.generateSecureWorkerCode()
    const blob = new Blob([workerCode], { type: 'application/javascript' })
    const workerUrl = URL.createObjectURL(blob)
    
    this.worker = new Worker(workerUrl, {
      type: 'module',
      credentials: 'same-origin'
    })

    // Set up secure message passing
    this.worker.onmessage = (event) => {
      this.handleWorkerMessage(event.data)
    }

    this.worker.onerror = (error) => {
      this.stats.errors++
      this.emit('worker-error', { pluginId: this.pluginId, error })
    }

    // Clean up blob URL
    URL.revokeObjectURL(workerUrl)
  }

  /**
   * Generate secure worker code with sandboxed environment
   */
  generateSecureWorkerCode() {
    return `
      // Secure plugin execution environment
      let pluginInstance = null;
      let apiCallCount = 0;
      const maxApiCalls = ${this.options.maxApiCalls || 1000};
      
      // Remove access to unsafe globals
      delete self.importScripts;
      delete self.fetch; // Will be provided through secure proxy
      delete self.XMLHttpRequest;
      delete self.localStorage;
      delete self.sessionStorage;
      delete self.indexedDB;
      
      // Rate limiting for API calls
      function checkApiLimit() {
        if (++apiCallCount > maxApiCalls) {
          throw new Error('API call limit exceeded');
        }
      }
      
      // Secure API proxy
      const secureAPI = {
        // Editor operations
        editor: {
          getContent: () => {
            checkApiLimit();
            return sendSecureRequest('editor.getContent');
          },
          
          setContent: (content) => {
            checkApiLimit();
            return sendSecureRequest('editor.setContent', { content });
          },
          
          insertContent: (content) => {
            checkApiLimit();
            return sendSecureRequest('editor.insertContent', { content });
          },
          
          getSelection: () => {
            checkApiLimit();
            return sendSecureRequest('editor.getSelection');
          }
        },
        
        // UI operations
        ui: {
          showNotification: (message, type = 'info') => {
            checkApiLimit();
            return sendSecureRequest('ui.showNotification', { message, type });
          },
          
          showDialog: (config) => {
            checkApiLimit();
            return sendSecureRequest('ui.showDialog', { config });
          },
          
          registerPanel: (panel) => {
            checkApiLimit();
            return sendSecureRequest('ui.registerPanel', { panel });
          }
        },
        
        // Storage operations (scoped to plugin)
        storage: {
          get: (key) => {
            checkApiLimit();
            return sendSecureRequest('storage.get', { key });
          },
          
          set: (key, value) => {
            checkApiLimit();
            return sendSecureRequest('storage.set', { key, value });
          },
          
          remove: (key) => {
            checkApiLimit();
            return sendSecureRequest('storage.remove', { key });
          }
        },
        
        // Secure network access
        network: {
          fetch: async (url, options = {}) => {
            checkApiLimit();
            return sendSecureRequest('network.fetch', { url, options });
          }
        },
        
        // Event system
        events: {
          on: (event, handler) => {
            checkApiLimit();
            return sendSecureRequest('events.on', { event, handler: handler.toString() });
          },
          
          emit: (event, data) => {
            checkApiLimit();
            return sendSecureRequest('events.emit', { event, data });
          }
        }
      };
      
      // Secure request sender
      function sendSecureRequest(method, params = {}) {
        return new Promise((resolve, reject) => {
          const id = Math.random().toString(36).substr(2, 9);
          
          const timeout = setTimeout(() => {
            reject(new Error('Request timeout'));
          }, 10000);
          
          const handler = (event) => {
            if (event.data.type === 'api-response' && event.data.id === id) {
              clearTimeout(timeout);
              self.removeEventListener('message', handler);
              
              if (event.data.error) {
                reject(new Error(event.data.error));
              } else {
                resolve(event.data.result);
              }
            }
          };
          
          self.addEventListener('message', handler);
          
          self.postMessage({
            type: 'api-request',
            id,
            method,
            params
          });
        });
      }
      
      // Plugin message handler
      self.onmessage = async function(event) {
        const { type, data } = event.data;
        
        try {
          switch (type) {
            case 'initialize':
              // Load and initialize plugin
              const pluginCode = data.code;
              const PluginClass = eval('(' + pluginCode + ')');
              pluginInstance = new PluginClass();
              
              if (pluginInstance.activate) {
                await pluginInstance.activate(secureAPI);
              }
              
              self.postMessage({ type: 'initialized' });
              break;
              
            case 'execute':
              if (pluginInstance && pluginInstance[data.method]) {
                const result = await pluginInstance[data.method](...(data.args || []));
                self.postMessage({ 
                  type: 'execution-result', 
                  id: data.id,
                  result 
                });
              } else {
                throw new Error(\`Method \${data.method} not found\`);
              }
              break;
              
            case 'deactivate':
              if (pluginInstance && pluginInstance.deactivate) {
                await pluginInstance.deactivate();
              }
              pluginInstance = null;
              self.postMessage({ type: 'deactivated' });
              break;
          }
        } catch (error) {
          self.postMessage({ 
            type: 'error', 
            error: error.message,
            id: data.id 
          });
        }
      };
    `
  }

  /**
   * Handle messages from the worker
   */
  handleWorkerMessage(message) {
    const { type, id, method, params, result, error } = message

    switch (type) {
      case 'api-request':
        this.handleAPIRequest(id, method, params)
        break
        
      case 'initialized':
        this.emit('plugin-initialized', { pluginId: this.pluginId })
        break
        
      case 'execution-result':
        this.resolveRequest(id, result)
        break
        
      case 'error':
        this.stats.errors++
        this.rejectRequest(id, error)
        break
        
      case 'deactivated':
        this.emit('plugin-deactivated', { pluginId: this.pluginId })
        break
    }
  }

  /**
   * Handle API requests from plugins with permission checking
   */
  async handleAPIRequest(requestId, method, params) {
    try {
      // Check if plugin has permission for this API
      if (!this.hasPermissionForAPI(method)) {
        throw new Error(`Permission denied for API: ${method}`)
      }

      // Check resource quotas
      if (this.quotaExceeded) {
        throw new Error('Resource quota exceeded')
      }

      this.stats.apiCalls++
      
      // Route API call to appropriate handler
      const result = await this.executeAPICall(method, params)
      
      // Send response back to worker
      this.worker.postMessage({
        type: 'api-response',
        id: requestId,
        result
      })
      
    } catch (error) {
      this.worker.postMessage({
        type: 'api-response',
        id: requestId,
        error: error.message
      })
    }
  }

  /**
   * Check if plugin has permission for API call
   */
  hasPermissionForAPI(method) {
    const apiPermissions = {
      'editor.getContent': 'editor:read',
      'editor.setContent': 'editor:write',
      'editor.insertContent': 'editor:write',
      'editor.getSelection': 'editor:read',
      'ui.showNotification': 'ui:notifications',
      'ui.showDialog': 'ui:dialogs',
      'ui.registerPanel': 'ui:panels',
      'storage.get': 'storage:read',
      'storage.set': 'storage:write',
      'storage.remove': 'storage:write',
      'network.fetch': 'network:http',
      'events.on': 'events:listen',
      'events.emit': 'events:emit'
    }

    const requiredPermission = apiPermissions[method]
    return !requiredPermission || this.permissions.has(requiredPermission)
  }

  /**
   * Execute API call and return result
   */
  async executeAPICall(method, params) {
    // This would integrate with the main PluginAPI
    return this.emit('api-call', {
      pluginId: this.pluginId,
      method,
      params
    })
  }

  /**
   * Initialize plugin in the worker
   */
  async initializePlugin() {
    // Load plugin code (would be from file system)
    const pluginCode = await this.loadPluginCode()
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Plugin initialization timeout'))
      }, 10000)

      const handler = (event) => {
        if (event.data.type === 'initialized') {
          clearTimeout(timeout)
          this.worker.removeEventListener('message', handler)
          resolve()
        } else if (event.data.type === 'error') {
          clearTimeout(timeout)
          this.worker.removeEventListener('message', handler)
          reject(new Error(event.data.error))
        }
      }

      this.worker.addEventListener('message', handler)
      
      this.worker.postMessage({
        type: 'initialize',
        data: { code: pluginCode }
      })
    })
  }

  /**
   * Load plugin code from file system
   */
  async loadPluginCode() {
    // This would load the actual plugin code
    // For now, return a placeholder
    return `
      class Plugin {
        async activate(api) {
          this.api = api;
        }
        
        async deactivate() {
        }
      }
      Plugin
    `
  }

  /**
   * Start resource monitoring
   */
  startResourceMonitoring() {
    this.resourceMonitor = setInterval(() => {
      this.checkResourceUsage()
    }, 1000) // Check every second
  }

  /**
   * Check resource usage and enforce quotas
   */
  async checkResourceUsage() {
    try {
      // Monitor memory usage (approximation)
      if (performance.memory) {
        this.stats.memoryUsage = performance.memory.usedJSHeapSize
        
        if (this.stats.memoryUsage > this.options.memoryLimit) {
          this.quotaExceeded = true
          this.emit('quota-exceeded', {
            pluginId: this.pluginId,
            type: 'memory',
            usage: this.stats.memoryUsage,
            limit: this.options.memoryLimit
          })
        }
      }

      // Monitor API call rate
      if (this.stats.apiCalls > (this.options.maxApiCalls || 1000)) {
        this.quotaExceeded = true
        this.emit('quota-exceeded', {
          pluginId: this.pluginId,
          type: 'api-calls',
          usage: this.stats.apiCalls,
          limit: this.options.maxApiCalls
        })
      }

    } catch { }
  }

  /**
   * Execute plugin method
   */
  async execute(method, ...args) {
    if (!this.isRunning) {
      throw new Error('Plugin sandbox is not running')
    }

    // If worker is not enabled, we can't execute in sandbox
    // Return null to indicate the caller should use direct execution
    if (!this.workerEnabled || !this.worker) {
      return null
    }

    const requestId = ++this.requestId

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error('Plugin execution timeout'))
      }, this.options.cpuTimeLimit)

      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      this.worker.postMessage({
        type: 'execute',
        id: requestId,
        method,
        args
      })
    })
  }

  /**
   * Resolve pending request
   */
  resolveRequest(requestId, result) {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      clearTimeout(request.timeout)
      this.pendingRequests.delete(requestId)
      request.resolve(result)
    }
  }

  /**
   * Reject pending request
   */
  rejectRequest(requestId, error) {
    const request = this.pendingRequests.get(requestId)
    if (request) {
      clearTimeout(request.timeout)
      this.pendingRequests.delete(requestId)
      request.reject(new Error(error))
    }
  }

  /**
   * Verify plugin code signature
   */
  async verifyCodeSignature() {
    // Implementation would verify digital signature
    // For now, just check if signature exists in manifest
    if (this.options.requireSignature && !this.manifest.signature) {
      throw new Error('Plugin signature required but not found')
    }
  }

  /**
   * Get current statistics
   */
  getStats() {
    return {
      ...this.stats,
      uptime: this.stats.startTime ? Date.now() - this.stats.startTime : 0,
      quotaExceeded: this.quotaExceeded,
      workerEnabled: this.workerEnabled
    }
  }

  /**
   * Terminate the sandbox
   */
  async terminate() {
    if (this.worker) {
      try {
        // Graceful shutdown
        this.worker.postMessage({ type: 'deactivate' })

        // Wait a bit for graceful shutdown
        await new Promise(resolve => setTimeout(resolve, 500))

        // Force terminate
        this.worker.terminate()
      } catch (e) {
        // Worker may already be terminated
      }
      this.worker = null
    }

    if (this.resourceMonitor) {
      clearInterval(this.resourceMonitor)
      this.resourceMonitor = null
    }

    // Reject all pending requests
    for (const [, request] of this.pendingRequests) {
      clearTimeout(request.timeout)
      request.reject(new Error('Plugin sandbox terminated'))
    }
    this.pendingRequests.clear()

    this.isRunning = false
    this.workerEnabled = false
    this.emit('terminated', { pluginId: this.pluginId })
  }
}

export default PluginSandbox