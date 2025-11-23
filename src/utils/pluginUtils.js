/**
 * Secure Plugin Sandbox using iframe isolation
 * 
 * This implementation uses iframe sandboxing with postMessage communication
 * to properly isolate plugin code execution and enforce permissions.
 */

export class SecurePluginSandbox {
  constructor(plugin) {
    this.plugin = plugin;
    this.iframe = null;
    this.messageHandlers = new Map();
    this.messageId = 0;
    this.initialized = false;
  }

  /**
   * Initialize the sandbox iframe
   */
  async initialize() {
    if (this.initialized) return;

    // Create isolated iframe
    this.iframe = document.createElement('iframe');
    this.iframe.sandbox = 'allow-scripts'; // Minimal permissions
    this.iframe.style.display = 'none';

    // Create sandbox HTML with plugin code
    const sandboxHTML = this.createSandboxHTML();
    const blob = new Blob([sandboxHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);

    this.iframe.src = url;
    document.body.appendChild(this.iframe);

    // Setup message listener
    window.addEventListener('message', this.handleMessage.bind(this));

    // Wait for sandbox to be ready
    await this.waitForReady();
    this.initialized = true;
  }

  /**
   * Create sandbox HTML with restricted API
   */
  createSandboxHTML() {
    const restrictedAPI = this.createRestrictedAPI();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline';">
      </head>
      <body>
        <script>
          // Restricted global environment
          (function() {
            'use strict';
            
            // Remove dangerous globals
            window.eval = undefined;
            window.Function = undefined;
            window.XMLHttpRequest = undefined;
            window.fetch = undefined;
            window.WebSocket = undefined;
            window.Worker = undefined;
            window.SharedWorker = undefined;
            window.ServiceWorker = undefined;
            
            // Lokus API based on permissions
            const lokusAPI = ${restrictedAPI};
            
            // Message handler for plugin code execution
            window.addEventListener('message', async function(event) {
              if (event.data.type === 'EXECUTE_PLUGIN') {
                try {
                  // Execute plugin code in restricted environment
                  const pluginFunction = new Function('lokus', event.data.code);
                  const result = await pluginFunction(lokusAPI);
                  
                  window.parent.postMessage({
                    type: 'PLUGIN_RESULT',
                    id: event.data.id,
                    success: true,
                    result: result
                  }, '*');
                } catch (error) {
                  window.parent.postMessage({
                    type: 'PLUGIN_RESULT',
                    id: event.data.id,
                    success: false,
                    error: error.message
                  }, '*');
                }
              } else if (event.data.type === 'PING') {
                window.parent.postMessage({ type: 'PONG' }, '*');
              }
            });
            
            // Signal ready
            window.parent.postMessage({ type: 'SANDBOX_READY' }, '*');
          })();
        </script>
      </body>
      </html>
    `;
  }

  /**
   * Create restricted API based on plugin permissions
   */
  createRestrictedAPI() {
    const api = {
      pluginId: this.plugin.id,
      version: '1.0.0'
    };

    // Add APIs based on permissions
    const permissions = this.plugin.permissions || [];

    if (permissions.includes('file-system')) {
      api.fileSystem = this.createFileSystemAPI();
    }

    if (permissions.includes('editor-extensions')) {
      api.editor = this.createEditorAPI();
    }

    if (permissions.includes('ui-extensions')) {
      api.ui = this.createUIAPI();
    }

    // Network is never allowed for security
    // If needed, use controlled proxy through main app

    return JSON.stringify(api);
  }

  /**
   * Create restricted file system API
   */
  createFileSystemAPI() {
    return {
      readFile: 'function(path) { return window.parent.postMessage({ type: "API_CALL", method: "fileSystem.readFile", args: [path] }, "*"); }',
      writeFile: 'function(path, content) { return window.parent.postMessage({ type: "API_CALL", method: "fileSystem.writeFile", args: [path, content] }, "*"); }',
      listFiles: 'function(path) { return window.parent.postMessage({ type: "API_CALL", method: "fileSystem.listFiles", args: [path] }, "*"); }'
    };
  }

  /**
   * Create restricted editor API
   */
  createEditorAPI() {
    return {
      insertText: 'function(text) { return window.parent.postMessage({ type: "API_CALL", method: "editor.insertText", args: [text] }, "*"); }',
      getSelection: 'function() { return window.parent.postMessage({ type: "API_CALL", method: "editor.getSelection", args: [] }, "*"); }',
      replaceSelection: 'function(text) { return window.parent.postMessage({ type: "API_CALL", method: "editor.replaceSelection", args: [text] }, "*"); }'
    };
  }

  /**
   * Create restricted UI API
   */
  createUIAPI() {
    return {
      showNotification: 'function(message, type) { return window.parent.postMessage({ type: "API_CALL", method: "ui.showNotification", args: [message, type] }, "*"); }',
      showDialog: 'function(options) { return window.parent.postMessage({ type: "API_CALL", method: "ui.showDialog", args: [options] }, "*"); }'
    };
  }

  /**
   * Wait for sandbox to be ready
   */
  waitForReady() {
    return new Promise((resolve) => {
      const handler = (event) => {
        if (event.data.type === 'SANDBOX_READY') {
          window.removeEventListener('message', handler);
          resolve();
        }
      };
      window.addEventListener('message', handler);

      // Timeout after 5 seconds
      setTimeout(() => {
        window.removeEventListener('message', handler);
        resolve();
      }, 5000);
    });
  }

  /**
   * Handle messages from sandbox
   */
  handleMessage(event) {
    if (event.source !== this.iframe?.contentWindow) return;

    const { type, id, method, args, result, error, success } = event.data;

    switch (type) {
      case 'PLUGIN_RESULT':
        const handler = this.messageHandlers.get(id);
        if (handler) {
          if (success) {
            handler.resolve(result);
          } else {
            handler.reject(new Error(error));
          }
          this.messageHandlers.delete(id);
        }
        break;

      case 'API_CALL':
        this.handleAPICall(method, args, id);
        break;
    }
  }

  /**
   * Handle API calls from plugin
   */
  async handleAPICall(method, args, id) {
    try {
      const [namespace, functionName] = method.split('.');
      let result;

      switch (namespace) {
        case 'fileSystem':
          result = await this.handleFileSystemCall(functionName, args);
          break;
        case 'editor':
          result = await this.handleEditorCall(functionName, args);
          break;
        case 'ui':
          result = await this.handleUICall(functionName, args);
          break;
        default:
          throw new Error(`Unknown API namespace: ${namespace}`);
      }

      this.iframe.contentWindow.postMessage({
        type: 'API_RESULT',
        id,
        success: true,
        result
      }, '*');
    } catch (error) {
      this.iframe.contentWindow.postMessage({
        type: 'API_RESULT',
        id,
        success: false,
        error: error.message
      }, '*');
    }
  }

  /**
   * Handle file system API calls with permission checks
   */
  async handleFileSystemCall(functionName, args) {
    if (!this.plugin.permissions?.includes('file-system')) {
      throw new Error('Plugin does not have file-system permission');
    }

    // Import Tauri invoke only when needed
    const { invoke } = await import('@tauri-apps/api/core');

    switch (functionName) {
      case 'readFile':
        return await invoke('read_file_content', { path: args[0] });
      case 'writeFile':
        return await invoke('write_file', { path: args[0], content: args[1] });
      case 'listFiles':
        return await invoke('list_directory', { path: args[0] });
      default:
        throw new Error(`Unknown file system function: ${functionName}`);
    }
  }

  /**
   * Handle editor API calls
   */
  async handleEditorCall(functionName, args) {
    if (!this.plugin.permissions?.includes('editor-extensions')) {
      throw new Error('Plugin does not have editor-extensions permission');
    }

    // Emit events that the editor can listen to
    const event = new CustomEvent('plugin-editor-call', {
      detail: { functionName, args, pluginId: this.plugin.id }
    });
    window.dispatchEvent(event);

    return { success: true };
  }

  /**
   * Handle UI API calls
   */
  async handleUICall(functionName, args) {
    if (!this.plugin.permissions?.includes('ui-extensions')) {
      throw new Error('Plugin does not have ui-extensions permission');
    }

    // Emit events that the UI can listen to
    const event = new CustomEvent('plugin-ui-call', {
      detail: { functionName, args, pluginId: this.plugin.id }
    });
    window.dispatchEvent(event);

    return { success: true };
  }

  /**
   * Execute plugin code in sandbox
   */
  async execute(code) {
    if (!this.initialized) {
      await this.initialize();
    }

    const id = ++this.messageId;

    return new Promise((resolve, reject) => {
      this.messageHandlers.set(id, { resolve, reject });

      this.iframe.contentWindow.postMessage({
        type: 'EXECUTE_PLUGIN',
        id,
        code
      }, '*');

      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.messageHandlers.has(id)) {
          this.messageHandlers.delete(id);
          reject(new Error('Plugin execution timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Cleanup sandbox
   */
  destroy() {
    if (this.iframe) {
      document.body.removeChild(this.iframe);
      this.iframe = null;
    }
    this.messageHandlers.clear();
    this.initialized = false;
  }
}

/**
 * Create a secure sandbox for plugin execution
 * @param {Object} plugin - Plugin object with id, code, and permissions
 * @returns {SecurePluginSandbox} - Secure sandbox instance
 */
export function createPluginSandbox(plugin) {
  return new SecurePluginSandbox(plugin);
}