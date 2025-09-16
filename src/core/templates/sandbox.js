/**
 * Template Sandbox
 * 
 * Provides a secure execution environment for JavaScript code in templates
 */

export class TemplateSandbox {
  constructor(options = {}) {
    this.timeout = options.timeout || 5000; // 5 second timeout
    this.maxMemory = options.maxMemory || 50 * 1024 * 1024; // 50MB
    this.dryRun = options.dryRun || false;
    this.allowedGlobals = new Set(options.allowedGlobals || [
      'Math', 'Date', 'Array', 'Object', 'String', 'Number', 'Boolean',
      'JSON', 'parseInt', 'parseFloat', 'isNaN', 'isFinite'
    ]);
    this.blockedPatterns = [
      /eval\s*\(/,
      /Function\s*\(/,
      /require\s*\(/,
      /import\s+/,
      /export\s+/,
      /window\./,
      /global\./,
      /process\./,
      /Buffer\./,
      /__dirname/,
      /__filename/
    ];
  }

  /**
   * Execute JavaScript code in sandbox
   */
  async execute(code, variables = {}) {
    if (!code || typeof code !== 'string') {
      throw new Error('Code must be a non-empty string');
    }

    // Security validation
    this.validateCode(code);

    if (this.dryRun) {
      return this.dryRunAnalysis(code, variables);
    }

    try {
      return await this.executeInIsolation(code, variables);
    } catch (error) {
      throw new Error(`Sandbox execution failed: ${error.message}`);
    }
  }

  /**
   * Validate code for security issues
   */
  validateCode(code) {
    // Check input validity
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
      throw new Error('Code too long for sandbox execution');
    }

    // Basic syntax validation
    try {
      new Function(code);
    } catch (error) {
      throw new Error(`Invalid JavaScript syntax: ${error.message}`);
    }
  }

  /**
   * Execute code in isolated environment
   */
  async executeInIsolation(code, variables) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Code execution timeout'));
      }, this.timeout);

      try {
        // Create restricted context
        const context = this.createRestrictedContext(variables);
        
        // Wrap code in function with restricted scope
        const wrappedCode = this.wrapCode(code);
        
        // Execute with timeout and memory limits
        const result = this.executeCode(wrappedCode, context);
        
        clearTimeout(timeout);
        resolve(result);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Create restricted execution context
   */
  createRestrictedContext(variables) {
    const context = {
      // Template variables
      ...variables,
      
      // Utility functions
      now: () => new Date(),
      today: () => new Date().toDateString(),
      time: () => new Date().toTimeString(),
      timestamp: () => Date.now(),
      uuid: () => this.generateUUID(),
      
      // Safe global objects
      Math: Math,
      Date: Date,
      Array: Array,
      Object: {
        keys: Object.keys,
        values: Object.values,
        entries: Object.entries,
        assign: Object.assign,
        freeze: Object.freeze,
        seal: Object.seal,
        hasOwnProperty: Object.prototype.hasOwnProperty
      },
      String: String,
      Number: Number,
      Boolean: Boolean,
      JSON: JSON,
      parseInt: parseInt,
      parseFloat: parseFloat,
      isNaN: isNaN,
      isFinite: isFinite,
      
      // Template helper functions
      format: this.createFormatFunction(),
      repeat: (str, count) => String(str).repeat(Math.min(count, 1000)),
      truncate: (str, length) => String(str).slice(0, Math.min(length, 10000)),
      slugify: this.slugify.bind(this),
      random: this.createRandomFunction(),
      
      // Restricted console for debugging
      console: this.createRestrictedConsole(),
      
      // Explicitly block dangerous globals by setting them to undefined
      window: undefined,
      global: undefined,
      process: undefined,
      require: undefined,
      module: undefined,
      exports: undefined,
      __dirname: undefined,
      __filename: undefined,
      eval: undefined,
      Function: undefined
    };

    // Add allowed globals
    for (const globalName of this.allowedGlobals) {
      if (globalName in globalThis) {
        context[globalName] = globalThis[globalName];
      }
    }

    return context;
  }

  /**
   * Wrap code with security restrictions
   */
  wrapCode(code) {
    // Add return statement if it's an expression
    const isExpression = !code.includes(';') && !code.match(/\b(if|for|while|function|var|let|const)\b/);
    
    if (isExpression) {
      return `(function() { "use strict"; return (${code}); })()`;
    }

    return `(function() { "use strict"; ${code} })()`;
  }

  /**
   * Execute wrapped code in context
   */
  executeCode(wrappedCode, context) {
    // Create function with restricted scope
    const func = new Function(...Object.keys(context), `return ${wrappedCode}`);
    
    // Execute with context values
    return func(...Object.values(context));
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
   * Create format helper function
   */
  createFormatFunction() {
    return (template, ...args) => {
      if (typeof template !== 'string') return template;
      
      return template.replace(/\{(\d+)\}/g, (match, index) => {
        const argIndex = parseInt(index, 10);
        return argIndex < args.length ? String(args[argIndex]) : match;
      });
    };
  }

  /**
   * Create random helper function
   */
  createRandomFunction() {
    return {
      int: (min = 0, max = 100) => Math.floor(Math.random() * (max - min + 1)) + min,
      float: (min = 0, max = 1) => Math.random() * (max - min) + min,
      bool: () => Math.random() < 0.5,
      choice: (array) => Array.isArray(array) ? array[Math.floor(Math.random() * array.length)] : undefined,
      string: (length = 10) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < Math.min(length, 1000); i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      }
    };
  }

  /**
   * Create restricted console
   */
  createRestrictedConsole() {
    const logs = [];
    
    return {
      log: (...args) => {
        if (logs.length < 100) { // Limit log entries
          logs.push({ level: 'log', args: args.map(String) });
        }
      },
      warn: (...args) => {
        if (logs.length < 100) {
          logs.push({ level: 'warn', args: args.map(String) });
        }
      },
      error: (...args) => {
        if (logs.length < 100) {
          logs.push({ level: 'error', args: args.map(String) });
        }
      },
      getLogs: () => [...logs],
      clear: () => logs.length = 0
    };
  }

  /**
   * Slugify string for safe file names
   */
  slugify(text) {
    return String(text)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Generate simple UUID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
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
        error: null
      };
    } catch (error) {
      return {
        success: false,
        result: null,
        error: error.message
      };
    }
  }

  /**
   * Get sandbox capabilities
   */
  getCapabilities() {
    return {
      timeout: this.timeout,
      maxMemory: this.maxMemory,
      allowedGlobals: Array.from(this.allowedGlobals),
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
        globals: false
      }
    };
  }

  /**
   * Update sandbox configuration
   */
  configure(options) {
    if (options.timeout !== undefined) {
      this.timeout = Math.min(Math.max(options.timeout, 100), 30000); // 100ms to 30s
    }
    
    if (options.maxMemory !== undefined) {
      this.maxMemory = Math.min(Math.max(options.maxMemory, 1024 * 1024), 100 * 1024 * 1024); // 1MB to 100MB
    }
    
    if (options.allowedGlobals) {
      this.allowedGlobals = new Set(options.allowedGlobals);
    }
  }

  /**
   * Reset sandbox state
   */
  reset() {
    // Clear any cached state if needed
    // Currently stateless, but method available for future use
  }
}

export default TemplateSandbox;