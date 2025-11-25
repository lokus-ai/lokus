import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chokidar from 'chokidar';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import chalk from 'chalk';
import boxen from 'boxen';
import { Listr } from 'listr2';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { buildPlugin } from './build';
import { DependencyManager } from '../utils/dependency-manager';

export interface EnhancedDevServerOptions {
  port?: number;
  host?: string;
  watch?: boolean;
  open?: boolean;
  verbose?: boolean;
  hot?: boolean;
  https?: boolean;
  proxy?: string;
  tunnel?: boolean;
  inspect?: boolean;
  coverage?: boolean;
  profiling?: boolean;
}

interface DevServerMetrics {
  startTime: number;
  buildCount: number;
  errorCount: number;
  lastBuildTime: number;
  totalBuildTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
}

class EnhancedDevServer {
  private app: express.Application;
  private server: http.Server;
  private wss: WebSocketServer;
  private port: number;
  private host: string;
  private pluginDir: string;
  private buildDir: string;
  private watcher?: chokidar.FSWatcher;
  private isBuilding = false;
  private buildQueue: (() => Promise<void>)[] = [];
  private options: EnhancedDevServerOptions;
  private metrics: DevServerMetrics;
  private clients: Set<any> = new Set();
  private dependencyManager: DependencyManager;

  constructor(pluginDir: string, options: EnhancedDevServerOptions) {
    this.pluginDir = pluginDir;
    this.buildDir = path.join(pluginDir, 'dist');
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';
    this.options = options;
    this.dependencyManager = new DependencyManager(pluginDir);
    
    this.metrics = {
      startTime: Date.now(),
      buildCount: 0,
      errorCount: 0,
      lastBuildTime: 0,
      totalBuildTime: 0,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage()
    };
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupServer();
    this.setupWebSocket();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupServer(): void {
    // Enhanced CORS configuration
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));

    // Request logging middleware
    if (this.options.verbose) {
      this.app.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
          const duration = Date.now() - start;
        });
        next();
      });
    }

    // JSON body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Serve static files from build directory
    this.app.use('/plugin', express.static(this.buildDir));
    
    // Serve source maps
    this.app.use('/src', express.static(path.join(this.pluginDir, 'src')));
  }

  private setupMiddleware(): void {
    // Error handling middleware
    this.app.use((error: any, req: any, res: any, next: any) => {
      console.error(chalk.red('Server Error:'), error);
      res.status(500).json({ 
        error: 'Internal Server Error',
        message: this.options.verbose ? error.message : 'Something went wrong'
      });
    });
  }

  private setupRoutes(): void {
    // Plugin manifest endpoint
    this.app.get('/plugin.json', async (req, res) => {
      try {
        const manifestPath = path.join(this.buildDir, 'plugin.json');
        const manifest = await fs.readJson(manifestPath);
        res.json(manifest);
      } catch (error) {
        res.status(404).json({ error: 'Plugin manifest not found' });
      }
    });

    // Development API endpoints
    this.app.get('/api/dev/status', (req, res) => {
      res.json({
        status: 'running',
        uptime: Date.now() - this.metrics.startTime,
        metrics: this.metrics,
        options: this.options
      });
    });

    this.app.get('/api/dev/metrics', (req, res) => {
      const now = Date.now();
      this.metrics.memoryUsage = process.memoryUsage();
      this.metrics.cpuUsage = process.cpuUsage(this.metrics.cpuUsage);
      
      res.json({
        ...this.metrics,
        uptime: now - this.metrics.startTime,
        averageBuildTime: this.metrics.buildCount > 0 ? this.metrics.totalBuildTime / this.metrics.buildCount : 0
      });
    });

    this.app.post('/api/dev/rebuild', async (req, res) => {
      try {
        await this.buildPlugin();
        res.json({ success: true, message: 'Plugin rebuilt successfully' });
      } catch (error) {
        res.status(500).json({ 
          success: false, 
          error: error instanceof Error ? error.message : 'Build failed'
        });
      }
    });

    this.app.post('/api/dev/validate', async (req, res) => {
      try {
        await pluginValidator.validatePluginStructure(this.pluginDir);
        res.json({ valid: true, message: 'Plugin structure is valid' });
      } catch (error) {
        res.status(400).json({ 
          valid: false, 
          error: error instanceof Error ? error.message : 'Validation failed'
        });
      }
    });

    this.app.get('/api/dev/dependencies', async (req, res) => {
      try {
        const packageJsonPath = path.join(this.pluginDir, 'package.json');
        const packageJson = await fs.readJson(packageJsonPath);
        const outdated = await this.dependencyManager.checkOutdated();
        
        res.json({
          dependencies: packageJson.dependencies || {},
          devDependencies: packageJson.devDependencies || {},
          outdated: outdated
        });
      } catch (error) {
        res.status(500).json({ 
          error: error instanceof Error ? error.message : 'Failed to check dependencies'
        });
      }
    });

    // Hot reload script with enhanced features
    this.app.get('/hot-reload.js', (req, res) => {
      res.type('text/javascript');
      res.send(this.generateHotReloadScript());
    });

    // Development dashboard
    this.app.get('/dev-dashboard', (req, res) => {
      res.type('text/html');
      res.send(this.generateDashboard());
    });

    // WebSocket endpoint info
    this.app.get('/api/dev/websocket', (req, res) => {
      res.json({
        url: `ws://${this.host}:${this.port}`,
        clients: this.clients.size,
        protocols: ['plugin-dev', 'hot-reload']
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws, req) => {
      this.clients.add(ws);
      
      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleWebSocketMessage(ws, message);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Lokus Plugin Dev Server',
        timestamp: Date.now(),
        metrics: this.metrics
      }));
    });
  }

  private handleWebSocketMessage(ws: any, message: any): void {
    switch (message.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
        
      case 'get-status':
        ws.send(JSON.stringify({
          type: 'status',
          data: {
            uptime: Date.now() - this.metrics.startTime,
            metrics: this.metrics,
            isBuilding: this.isBuilding
          }
        }));
        break;
        
      case 'rebuild':
        this.buildPlugin().catch(error => {
          ws.send(JSON.stringify({
            type: 'error',
            message: `Build failed: ${error.message}`
          }));
        });
        break;
    }
  }

  private broadcast(message: any): void {
    const data = JSON.stringify(message);
    this.clients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(data);
      }
    });
  }

  async start(): Promise<void> {
    await this.validateEnvironment();
    
    // Initial build
    await this.initialBuild();
    
    // Setup file watching
    if (this.options.watch !== false) {
      this.setupFileWatcher();
    }
    
    // Start server
    return new Promise((resolve, reject) => {
      this.server.listen(this.port, this.host, () => {
        this.showStartupInfo();
        resolve();
      });
      
      this.server.on('error', (error: any) => {
        if (error.code === 'EADDRINUSE') {
          reject(new Error(`Port ${this.port} is already in use`));
        } else {
          reject(error);
        }
      });
    });
  }

  private async validateEnvironment(): Promise<void> {
    const tasks = new Listr([
      {
        title: 'Validating plugin structure',
        task: async () => {
          await pluginValidator.validatePluginStructure(this.pluginDir);
        }
      },
      {
        title: 'Checking dependencies',
        task: async (ctx, task) => {
          const needsInstall = await this.dependencyManager.needsInstall();
          if (needsInstall) {
            task.output = 'Installing missing dependencies...';
            await this.dependencyManager.install();
          }
        }
      },
      {
        title: 'Creating build directory',
        task: async () => {
          await fs.ensureDir(this.buildDir);
        }
      }
    ], {
      rendererOptions: {}
    });

    await tasks.run();
  }

  private async initialBuild(): Promise<void> {
    logger.info('Running initial build...');
    await this.buildPlugin();
  }

  private setupFileWatcher(): void {
    const watchPaths = [
      path.join(this.pluginDir, 'src/**/*'),
      path.join(this.pluginDir, 'plugin.json'),
      path.join(this.pluginDir, 'package.json'),
      path.join(this.pluginDir, 'tsconfig.json')
    ];

    this.watcher = chokidar.watch(watchPaths, {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**',
        '**/*.test.*',
        '**/*.spec.*'
      ],
      ignoreInitial: true,
      persistent: true
    });

    this.watcher.on('change', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      this.queueBuild();
    });

    this.watcher.on('add', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      this.queueBuild();
    });

    this.watcher.on('unlink', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      this.queueBuild();
    });

    this.watcher.on('error', (error) => {
      console.error(chalk.red('Watcher error:'), error);
    });
  }

  private queueBuild(): void {
    if (this.isBuilding) {
      return;
    }

    // Debounce builds
    clearTimeout((this as any).buildTimeout);
    (this as any).buildTimeout = setTimeout(() => {
      this.buildPlugin();
    }, 100);
  }

  private async buildPlugin(): Promise<void> {
    if (this.isBuilding) {
      return;
    }

    this.isBuilding = true;
    const buildStart = Date.now();
    
    try {
      this.broadcast({
        type: 'build-start',
        message: 'Building plugin...',
        timestamp: buildStart
      });

      await buildPlugin(this.pluginDir, {
        outDir: 'dist',
        target: 'development',
        sourcemap: true,
        watch: false
      });

      const buildTime = Date.now() - buildStart;
      this.metrics.buildCount++;
      this.metrics.lastBuildTime = buildTime;
      this.metrics.totalBuildTime += buildTime;

      
      this.broadcast({
        type: 'build-success',
        message: `Build completed in ${buildTime}ms`,
        timestamp: Date.now(),
        buildTime
      });

      if (this.options.hot) {
        this.broadcast({
          type: 'reload',
          message: 'Plugin updated, reloading...',
          timestamp: Date.now()
        });
      }

    } catch (error) {
      this.metrics.errorCount++;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error(chalk.red('✗ Build failed:'), errorMessage);
      
      this.broadcast({
        type: 'build-error',
        message: errorMessage,
        timestamp: Date.now(),
        error: {
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined
        }
      });
    } finally {
      this.isBuilding = false;
    }
  }

  private showStartupInfo(): void {
    const urls = {
      local: `http://${this.host}:${this.port}`,
      dashboard: `http://${this.host}:${this.port}/dev-dashboard`,
      websocket: `ws://${this.host}:${this.port}`
    };

    const info = boxen(
      `${chalk.bold.green('🚀 Lokus Plugin Dev Server')}\n\n` +
      `${chalk.bold('Local:')}     ${chalk.cyan(urls.local)}\n` +
      `${chalk.bold('Dashboard:')} ${chalk.cyan(urls.dashboard)}\n` +
      `${chalk.bold('WebSocket:')} ${chalk.cyan(urls.websocket)}\n\n` +
      `${chalk.bold('Features:')}\n` +
      `${this.options.hot ? '✅' : '❌'} Hot Reload\n` +
      `${this.options.watch !== false ? '✅' : '❌'} File Watching\n` +
      `${this.options.verbose ? '✅' : '❌'} Verbose Logging\n` +
      `${this.options.inspect ? '✅' : '❌'} Debug Inspector\n\n` +
      `${chalk.gray('Press Ctrl+C to stop')}`,
      {
        title: 'Dev Server',
        titleAlignment: 'center',
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );

  }

  private generateHotReloadScript(): string {
    return `
(function() {
  const ws = new WebSocket('ws://${this.host}:${this.port}');
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 5;
  
  function connect() {
    ws.onopen = function() {
      console.log('[Lokus Plugin Dev] Connected to dev server');
      reconnectAttempts = 0;
      
      // Send ping every 30 seconds to keep connection alive
      setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };
    
    ws.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        console.log('[Lokus Plugin Dev]', data.type, data.message);
        
        switch (data.type) {
          case 'reload':
            console.log('[Lokus Plugin Dev] Reloading plugin...');
            window.postMessage({ type: 'lokus-plugin-reload' }, '*');
            break;
            
          case 'build-start':
            console.log('[Lokus Plugin Dev] Build started...');
            document.body.classList.add('lokus-dev-building');
            break;
            
          case 'build-success':
            console.log('[Lokus Plugin Dev] Build completed');
            document.body.classList.remove('lokus-dev-building', 'lokus-dev-error');
            break;
            
          case 'build-error':
            console.error('[Lokus Plugin Dev] Build error:', data.error);
            document.body.classList.remove('lokus-dev-building');
            document.body.classList.add('lokus-dev-error');
            break;
            
          case 'pong':
            // Connection is alive
            break;
        }
      } catch (error) {
        console.error('[Lokus Plugin Dev] Failed to parse message:', error);
      }
    };
    
    ws.onclose = function() {
      console.log('[Lokus Plugin Dev] Disconnected from dev server');
      
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        console.log(\`[Lokus Plugin Dev] Reconnecting in \${delay}ms...\`);
        
        setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, delay);
      } else {
        console.error('[Lokus Plugin Dev] Max reconnection attempts reached');
      }
    };
    
    ws.onerror = function(error) {
      console.error('[Lokus Plugin Dev] WebSocket error:', error);
    };
  }
  
  connect();
  
  // Add development styles
  const style = document.createElement('style');
  style.textContent = \`
    .lokus-dev-building {
      position: relative;
    }
    
    .lokus-dev-building::before {
      content: 'Building...';
      position: fixed;
      top: 10px;
      right: 10px;
      background: #fbbf24;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
      animation: pulse 1s infinite;
    }
    
    .lokus-dev-error::before {
      content: 'Build Error';
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ef4444;
      color: white;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 10000;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  \`;
  document.head.appendChild(style);
})();
`;
  }

  private generateDashboard(): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lokus Plugin Dev Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 40px; }
    .title { font-size: 2.5rem; font-weight: 700; color: #0f172a; margin-bottom: 10px; }
    .subtitle { font-size: 1.2rem; color: #64748b; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .card { 
      background: white; 
      border-radius: 12px; 
      padding: 24px; 
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
    }
    .card-title { font-size: 1.25rem; font-weight: 600; margin-bottom: 16px; color: #1e293b; }
    .status { 
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .status.running { background: #dcfce7; color: #166534; }
    .status.error { background: #fecaca; color: #991b1b; }
    .metric { margin-bottom: 12px; }
    .metric-label { font-weight: 500; color: #475569; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #0f172a; }
    .btn { 
      background: #3b82f6;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    .btn:hover { background: #2563eb; }
    .btn.secondary { background: #6b7280; }
    .btn.secondary:hover { background: #4b5563; }
    .logs { 
      background: #1e293b; 
      color: #e2e8f0; 
      padding: 16px; 
      border-radius: 8px; 
      font-family: monospace; 
      font-size: 14px;
      height: 200px;
      overflow-y: auto;
    }
    .indicator { 
      width: 8px; 
      height: 8px; 
      border-radius: 50%; 
      background: #22c55e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="title">🚀 Lokus Plugin Dev Dashboard</h1>
      <p class="subtitle">Development server for your plugin</p>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2 class="card-title">Server Status</h2>
        <div class="status running">
          <div class="indicator"></div>
          Running
        </div>
        <div class="metric">
          <div class="metric-label">Uptime</div>
          <div class="metric-value" id="uptime">0s</div>
        </div>
        <div class="metric">
          <div class="metric-label">Connected Clients</div>
          <div class="metric-value" id="clients">${this.clients.size}</div>
        </div>
      </div>
      
      <div class="card">
        <h2 class="card-title">Build Metrics</h2>
        <div class="metric">
          <div class="metric-label">Total Builds</div>
          <div class="metric-value" id="buildCount">${this.metrics.buildCount}</div>
        </div>
        <div class="metric">
          <div class="metric-label">Last Build Time</div>
          <div class="metric-value" id="lastBuildTime">${this.metrics.lastBuildTime}ms</div>
        </div>
        <div class="metric">
          <div class="metric-label">Error Count</div>
          <div class="metric-value" id="errorCount">${this.metrics.errorCount}</div>
        </div>
      </div>
      
      <div class="card">
        <h2 class="card-title">Actions</h2>
        <button class="btn" onclick="rebuild()">🔨 Rebuild</button>
        <button class="btn" onclick="validate()">✅ Validate</button>
        <button class="btn secondary" onclick="openPlugin()">🔗 Open Plugin</button>
        <button class="btn secondary" onclick="viewLogs()">📝 View Logs</button>
      </div>
      
      <div class="card">
        <h2 class="card-title">Development Logs</h2>
        <div class="logs" id="logs">
          <div>Development server started...</div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    const ws = new WebSocket('ws://${this.host}:${this.port}');
    const logs = document.getElementById('logs');
    
    ws.onmessage = function(event) {
      const data = JSON.parse(event.data);
      addLog(\`[\${new Date().toLocaleTimeString()}] \${data.type}: \${data.message}\`);
      
      if (data.type === 'status') {
        updateMetrics(data.data);
      }
    };
    
    function addLog(message) {
      const logs = document.getElementById('logs');
      const div = document.createElement('div');
      div.textContent = message;
      logs.appendChild(div);
      logs.scrollTop = logs.scrollHeight;
    }
    
    function updateMetrics(data) {
      document.getElementById('uptime').textContent = formatDuration(data.uptime);
      document.getElementById('buildCount').textContent = data.metrics.buildCount;
      document.getElementById('lastBuildTime').textContent = data.metrics.lastBuildTime + 'ms';
      document.getElementById('errorCount').textContent = data.metrics.errorCount;
    }
    
    function formatDuration(ms) {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      
      if (hours > 0) return \`\${hours}h \${minutes % 60}m\`;
      if (minutes > 0) return \`\${minutes}m \${seconds % 60}s\`;
      return \`\${seconds}s\`;
    }
    
    async function rebuild() {
      try {
        const response = await fetch('/api/dev/rebuild', { method: 'POST' });
        const result = await response.json();
        addLog(result.success ? 'Rebuild triggered' : \`Rebuild failed: \${result.error}\`);
      } catch (error) {
        addLog(\`Rebuild failed: \${error.message}\`);
      }
    }
    
    async function validate() {
      try {
        const response = await fetch('/api/dev/validate', { method: 'POST' });
        const result = await response.json();
        addLog(result.valid ? 'Plugin validation passed' : \`Validation failed: \${result.error}\`);
      } catch (error) {
        addLog(\`Validation failed: \${error.message}\`);
      }
    }
    
    function openPlugin() {
      window.open('/plugin', '_blank');
    }
    
    function viewLogs() {
      // Could open a separate logs window or expand current logs
      addLog('Viewing full logs...');
    }
    
    // Update metrics every 5 seconds
    setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'get-status' }));
      }
    }, 5000);
  </script>
</body>
</html>
`;
  }

  async stop(): Promise<void> {
    logger.info('Stopping development server...');
    
    if (this.watcher) {
      await this.watcher.close();
    }
    
    this.clients.forEach(client => {
      client.close();
    });
    
    this.wss.close();
    
    return new Promise((resolve) => {
      this.server.close(() => {
        logger.info('Development server stopped');
        resolve();
      });
    });
  }
}

export const devEnhancedCommand = new Command('dev')
  .description('Start enhanced development server with hot reload and debugging features')
  .option('-p, --port <port>', 'server port', '3000')
  .option('-h, --host <host>', 'server host', 'localhost')
  .option('--no-watch', 'disable file watching')
  .option('--no-hot', 'disable hot reload')
  .option('-o, --open', 'open browser after server start')
  .option('-v, --verbose', 'verbose logging')
  .option('--https', 'use HTTPS')
  .option('--proxy <url>', 'proxy API requests')
  .option('--tunnel', 'create public tunnel')
  .option('--inspect', 'enable Node.js inspector')
  .option('--coverage', 'enable code coverage')
  .option('--profiling', 'enable performance profiling')
  .action(async (options: EnhancedDevServerOptions) => {
    try {
      const cwd = process.cwd();
      
      // Validate plugin directory
      const manifestPath = path.join(cwd, 'plugin.json');
      if (!await fs.pathExists(manifestPath)) {
        throw new Error('No plugin.json found. Make sure you\'re in a plugin directory.');
      }

      const devServer = new EnhancedDevServer(cwd, options);
      
      // Handle graceful shutdown
      const shutdown = async () => {
        await devServer.stop();
        process.exit(0);
      };
      
      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
      
      await devServer.start();
      
      // Open browser if requested
      if (options.open) {
        const url = `http://${options.host || 'localhost'}:${options.port || 3000}/dev-dashboard`;
        const { execa } = await import('execa');
        await execa('open', [url]).catch(() => {
        });
      }
      
    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });