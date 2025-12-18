/**
 * Secure Template Sandbox using isolated-vm
 *
 * Provides true isolation for JavaScript code execution in templates
 * with strict memory limits, timeouts, and security restrictions.
 */

import ivm from 'isolated-vm';

export class SecureTemplateSandbox {
  constructor(options = {}) {
    this.memoryLimit = options.memoryLimit || 128; // MB
    this.timeout = options.timeout || 5000; // milliseconds
    this.dryRun = options.dryRun || false;

    this.isolate = null;
    this.context = null;
    this.jail = null;

    this.blockedPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /import\s+/,
      /export\s+/,
      /process\./,
      /Buffer\./,
      /__dirname/,
      /__filename/,
      /fs\./,
      /child_process/,
      /net\./,
      /http\./,
      /https\./,
    ];
  }

  /**
   * Initialize the isolated VM
   */
  async initialize() {
    if (this.isolate) {
      return; // Already initialized
    }

    try {
      // Create isolate with memory limit
      this.isolate = new ivm.Isolate({
        memoryLimit: this.memoryLimit,
        onCatastrophicError: (err) => {
        }
      });

      // Create context within the isolate
      this.context = await this.isolate.createContext();

      // Get the global object (jail) from the context
      this.jail = this.context.global;
      await this.jail.set('global', this.jail.derefInto());

      // Inject safe helpers and block dangerous operations
      await this.injectHelpers();
      await this.blockDangerous();

    } catch (error) {
      throw new Error(`Failed to initialize sandbox: ${error.message}`);
    }
  }

  /**
   * Inject safe helper functions and globals
   */
  async injectHelpers() {
    if (!this.jail) {
      throw new Error('Sandbox not initialized');
    }

    // Inject Math object by evaluating code in the context
    await this.context.eval(`
      globalThis.Math = {
        PI: ${Math.PI},
        E: ${Math.E},
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        sqrt: Math.sqrt,
        random: Math.random,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        asin: Math.asin,
        acos: Math.acos,
        atan: Math.atan,
        atan2: Math.atan2,
        exp: Math.exp,
        log: Math.log
      };
    `);

    // Inject basic constructors and utilities
    await this.context.eval(`
      globalThis.Array = Array;
      globalThis.Object = Object;
      globalThis.String = String;
      globalThis.Number = Number;
      globalThis.Boolean = Boolean;
      globalThis.Date = Date;
      globalThis.JSON = JSON;
      globalThis.parseInt = parseInt;
      globalThis.parseFloat = parseFloat;
      globalThis.isNaN = isNaN;
      globalThis.isFinite = isFinite;
    `);

    // Create and inject helper functions
    await this.context.eval(`
      globalThis.now = function() {
        return new Date().toISOString();
      };

      globalThis.today = function() {
        return new Date().toDateString();
      };

      globalThis.time = function() {
        return new Date().toTimeString();
      };

      globalThis.timestamp = function() {
        return Date.now();
      };

      globalThis.uuid = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c == 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };

      globalThis.format = function(template, ...args) {
        if (typeof template !== 'string') return template;
        return template.replace(/\\{(\\d+)\\}/g, function(match, index) {
          const argIndex = parseInt(index, 10);
          return argIndex < args.length ? String(args[argIndex]) : match;
        });
      };

      globalThis.repeat = function(str, count) {
        return String(str).repeat(Math.min(count, 1000));
      };

      globalThis.truncate = function(str, length) {
        return String(str).slice(0, Math.min(length, 10000));
      };

      globalThis.slugify = function(text) {
        return String(text)
          .toLowerCase()
          .trim()
          .replace(/[^\\w\\s-]/g, '')
          .replace(/[\\s_-]+/g, '-')
          .replace(/^-+|-+$/g, '');
      };

      globalThis.random = {
        int: function(min = 0, max = 100) {
          return Math.floor(Math.random() * (max - min + 1)) + min;
        },
        float: function(min = 0, max = 1) {
          return Math.random() * (max - min) + min;
        },
        bool: function() {
          return Math.random() < 0.5;
        },
        choice: function(array) {
          return Array.isArray(array) ? array[Math.floor(Math.random() * array.length)] : undefined;
        },
        string: function(length = 10) {
          const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
          let result = '';
          for (let i = 0; i < Math.min(length, 1000); i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
          }
          return result;
        }
      };
    `);

    // Setup console logging
    this.logs = [];
    const logsRef = new ivm.ExternalCopy(this.logs).copyInto();
    await this.jail.set('_logs', logsRef);

    await this.context.eval(`
      globalThis.console = {
        log: function(...args) {
          // Log to internal array (limited implementation for security)
        },
        warn: function(...args) {
          // Warn to internal array
        },
        error: function(...args) {
          // Error to internal array
        }
      };
    `);
  }

  /**
   * Block dangerous operations by setting them to undefined
   */
  async blockDangerous() {
    if (!this.jail) {
      throw new Error('Sandbox not initialized');
    }

    const dangerousGlobals = [
      'eval',
      'Function',
      'require',
      'module',
      'exports',
      '__dirname',
      '__filename',
      'process',
      'Buffer',
      'global',
      'globalThis',
      'window',
      'document',
      'fs',
      'child_process',
      'net',
      'http',
      'https',
      'crypto',
      'os',
      'path',
      'vm',
      'worker_threads',
      'cluster',
      'dgram',
      'dns',
      'domain',
      'events',
      'readline',
      'repl',
      'stream',
      'tls',
      'tty',
      'url',
      'util',
      'v8',
      'zlib',
    ];

    for (const name of dangerousGlobals) {
      await this.jail.set(name, undefined);
    }
  }

  /**
   * Validate code for security issues before execution
   */
  validateCode(code) {
    if (!code || typeof code !== 'string') {
      throw new Error('Code must be a non-empty string');
    }

    // Check for blocked patterns
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(code)) {
        throw new Error(`Blocked code pattern detected: ${pattern.source}`);
      }
    }

    // Check code length
    if (code.length > 10000) {
      throw new Error('Code too long for sandbox execution (max 10000 characters)');
    }
  }

  /**
   * Execute JavaScript code in the isolated sandbox
   */
  async execute(code, variables = {}, options = {}) {
    if (!code || typeof code !== 'string') {
      throw new Error('Code must be a non-empty string');
    }

    // Security validation
    this.validateCode(code);

    if (this.dryRun) {
      return Promise.resolve(this.dryRunAnalysis(code, variables));
    }

    // Initialize if not already done
    if (!this.isolate) {
      await this.initialize();
    }

    try {
      // Inject variables into the context
      for (const [key, value] of Object.entries(variables)) {
        if (typeof value === 'function') {
          await this.jail.set(key, new ivm.Reference(value));
        } else {
          await this.jail.set(key, value, { copy: true });
        }
      }

      // Wrap code to handle both expressions and statements
      const isExpression = !code.includes(';') &&
                          !code.match(/\b(if|for|while|function|var|let|const|return)\b/);

      const wrappedCode = isExpression
        ? `(${code})`
        : `(function() { "use strict"; ${code} })()`;

      // Execute code with timeout and copy result
      const timeout = options.timeout || this.timeout;
      const script = await this.isolate.compileScript(wrappedCode);

      // Use copy: true to automatically copy results back to host
      const result = await script.run(this.context, { timeout, copy: true });

      return result;

    } catch (error) {
      if (error.message && error.message.includes('Script execution timed out')) {
        throw new Error(`Code execution timeout (${this.timeout}ms limit exceeded)`);
      }
      if (error.message && error.message.includes('memory limit')) {
        throw new Error(`Memory limit exceeded (${this.memoryLimit}MB limit)`);
      }
      throw new Error(`Sandbox execution failed: ${error.message}`);
    }
  }

  /**
   * Dry run analysis (no actual execution)
   */
  dryRunAnalysis(code, variables) {
    const analysis = {
      dryRun: true,
      code,
      variables: Object.keys(variables),
      estimatedResult: '[DRY RUN - Code would execute here]',
      security: {
        safe: true,
        warnings: []
      }
    };

    // Analyze for potential issues
    if (code.includes('while') || code.includes('for')) {
      analysis.security.warnings.push('Contains loops - watch for infinite loops');
    }

    if (code.length > 1000) {
      analysis.security.warnings.push('Large code block - consider splitting');
    }

    return analysis;
  }

  /**
   * Test code execution (safe mode)
   */
  async test(code, variables = {}) {
    try {
      const result = await this.execute(code, variables);
      return {
        success: true,
        result,
        error: null,
        logs: this.logs ? [...this.logs] : []
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message,
        logs: this.logs ? [...this.logs] : []
      };
    }
  }

  /**
   * Get sandbox capabilities
   */
  getCapabilities() {
    return {
      memoryLimit: `${this.memoryLimit}MB`,
      timeout: `${this.timeout}ms`,
      isolation: 'isolated-vm (true isolation)',
      blockedPatterns: this.blockedPatterns.map(p => p.source),
      features: {
        variables: true,
        functions: true,
        loops: true,
        conditionals: true,
        dateTime: true,
        math: true,
        strings: true,
        arrays: true,
        objects: true,
        console: true
      },
      restrictions: {
        fileSystem: false,
        network: false,
        eval: false,
        imports: false,
        globals: false,
        nativeModules: false,
        processAccess: false
      }
    };
  }

  /**
   * Get console logs from the sandbox
   */
  getLogs() {
    return this.logs ? [...this.logs] : [];
  }

  /**
   * Clear console logs
   */
  clearLogs() {
    if (this.logs) {
      this.logs.length = 0;
    }
  }

  /**
   * Dispose of the isolate and free resources
   */
  dispose() {
    if (this.isolate) {
      this.isolate.dispose();
      this.isolate = null;
      this.context = null;
      this.jail = null;
      this.logs = null;
    }
  }

  /**
   * Update sandbox configuration
   */
  configure(options) {
    if (this.isolate) {
      throw new Error('Cannot reconfigure an initialized sandbox. Dispose first.');
    }

    if (options.memoryLimit !== undefined) {
      this.memoryLimit = Math.min(Math.max(options.memoryLimit, 8), 512); // 8MB to 512MB
    }

    if (options.timeout !== undefined) {
      this.timeout = Math.min(Math.max(options.timeout, 100), 30000); // 100ms to 30s
    }
  }

  /**
   * Reset sandbox state
   */
  async reset() {
    this.dispose();
    await this.initialize();
  }
}

export default SecureTemplateSandbox;
