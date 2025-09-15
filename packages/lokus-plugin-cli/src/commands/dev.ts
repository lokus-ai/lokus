import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs-extra';
import chokidar from 'chokidar';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import * as http from 'http';
import chalk from 'chalk';
import { logger } from '../utils/logger';
import { ErrorHandler } from '../utils/error-handler';
import { pluginValidator } from '../utils/plugin-validator';
import { buildPlugin } from './build';

export interface DevServerOptions {
  port?: number;
  host?: string;
  watch?: boolean;
  open?: boolean;
  verbose?: boolean;
}

class DevServer {
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

  constructor(pluginDir: string, options: DevServerOptions) {
    this.pluginDir = pluginDir;
    this.buildDir = path.join(pluginDir, 'dist');
    this.port = options.port || 3000;
    this.host = options.host || 'localhost';
    
    this.app = express();
    this.server = http.createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });
    
    this.setupServer();
    this.setupWebSocket();
  }

  private setupServer(): void {
    // Enable CORS
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    // Serve static files from build directory
    this.app.use('/plugin', express.static(this.buildDir));
    
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

    // Hot reload script
    this.app.get('/hot-reload.js', (req, res) => {
      res.type('text/javascript');
      res.send(`
        (function() {
          const ws = new WebSocket('ws://${this.host}:${this.port}');
          
          ws.onopen = function() {
            console.log('[Lokus Plugin Dev] Connected to dev server');
          };
          
          ws.onmessage = function(event) {
            const data = JSON.parse(event.data);
            console.log('[Lokus Plugin Dev]', data.type, data.message);
            
            if (data.type === 'reload') {
              console.log('[Lokus Plugin Dev] Reloading plugin...');
              window.postMessage({ type: 'lokus-plugin-reload' }, '*');
            } else if (data.type === 'error') {
              console.error('[Lokus Plugin Dev] Build error:', data.message);
            }
          };
          
          ws.onclose = function() {
            console.log('[Lokus Plugin Dev] Disconnected from dev server');
            // Try to reconnect after 3 seconds
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          };
          
          ws.onerror = function(error) {
            console.error('[Lokus Plugin Dev] WebSocket error:', error);
          };
        })();
      `);
    });

    // Development API endpoints
    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'running',
        building: this.isBuilding,
        plugin: path.basename(this.pluginDir),
        uptime: process.uptime()
      });
    });

    this.app.get('/api/logs', (req, res) => {
      // In a real implementation, you'd maintain a log buffer
      res.json({
        logs: [
          { level: 'info', message: 'Development server started', timestamp: new Date().toISOString() }
        ]
      });
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok' });
    });

    // Fallback for SPA routing
    this.app.get('*', (req, res) => {
      res.json({ 
        error: 'Not found',
        availableEndpoints: [
          '/plugin.json',
          '/plugin/*',
          '/hot-reload.js',
          '/api/status',
          '/api/logs',
          '/health'
        ]
      });
    });
  }

  private setupWebSocket(): void {
    this.wss.on('connection', (ws) => {
      logger.debug('Client connected to dev server');
      
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to Lokus Plugin Dev Server'
      }));

      ws.on('close', () => {
        logger.debug('Client disconnected from dev server');
      });

      ws.on('error', (error) => {
        logger.debug(`WebSocket error: ${error.message}`);
      });
    });
  }

  private broadcastToClients(data: any): void {
    const message = JSON.stringify(data);
    this.wss.clients.forEach((client) => {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    });
  }

  private async queueBuild(): Promise<void> {
    return new Promise((resolve) => {
      this.buildQueue.push(async () => {
        try {
          await this.buildPlugin();
          resolve();
        } catch (error) {
          logger.error('Build failed');
          this.broadcastToClients({
            type: 'error',
            message: error instanceof Error ? error.message : 'Unknown build error'
          });
          resolve();
        }
      });

      this.processBuildQueue();
    });
  }

  private async processBuildQueue(): Promise<void> {
    if (this.isBuilding || this.buildQueue.length === 0) {
      return;
    }

    this.isBuilding = true;
    const build = this.buildQueue.shift();
    
    if (build) {
      await build();
    }

    this.isBuilding = false;

    // Process next build if any
    if (this.buildQueue.length > 0) {
      setImmediate(() => this.processBuildQueue());
    }
  }

  private async buildPlugin(): Promise<void> {
    const spinner = logger.startSpinner('Building plugin...');
    
    try {
      await buildPlugin(this.pluginDir, {
        watch: false,
        minify: false,
        sourcemap: true,
        target: 'development'
      });
      
      spinner.succeed('Plugin built successfully');
      
      this.broadcastToClients({
        type: 'reload',
        message: 'Plugin rebuilt and ready for reload'
      });
      
    } catch (error) {
      spinner.fail('Plugin build failed');
      throw error;
    }
  }

  private setupFileWatcher(): void {
    const watchPatterns = [
      path.join(this.pluginDir, 'src/**/*'),
      path.join(this.pluginDir, 'plugin.json'),
      path.join(this.pluginDir, 'package.json')
    ];

    this.watcher = chokidar.watch(watchPatterns, {
      ignored: [
        /(^|[\/\\])\../, // Ignore dotfiles
        /node_modules/,
        /dist/,
        /build/,
        /coverage/
      ],
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      logger.info(`File changed: ${chalk.cyan(relativePath)}`);
      this.queueBuild();
    });

    this.watcher.on('add', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      logger.info(`File added: ${chalk.green(relativePath)}`);
      this.queueBuild();
    });

    this.watcher.on('unlink', (filePath) => {
      const relativePath = path.relative(this.pluginDir, filePath);
      logger.info(`File removed: ${chalk.red(relativePath)}`);
      this.queueBuild();
    });

    this.watcher.on('error', (error) => {
      logger.error(`Watcher error: ${error.message}`);
    });

    logger.success('File watcher started');
  }

  async start(): Promise<void> {
    try {
      // Initial build
      await this.buildPlugin();

      // Setup file watching
      this.setupFileWatcher();

      // Start server
      await new Promise<void>((resolve, reject) => {
        this.server.listen(this.port, this.host, () => {
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            reject(ErrorHandler.createError(
              'NetworkError',
              `Port ${this.port} is already in use. Try a different port with --port.`
            ));
          } else {
            reject(error);
          }
        });
      });

      logger.success(`Development server started`);
      logger.info(`Local: ${chalk.cyan(`http://${this.host}:${this.port}`)}`);
      logger.info(`Plugin: ${chalk.cyan(`http://${this.host}:${this.port}/plugin.json`)}`);
      logger.info(`Hot reload: ${chalk.cyan(`http://${this.host}:${this.port}/hot-reload.js`)}`);
      logger.newLine();
      logger.info(`Watching for changes in: ${chalk.cyan(this.pluginDir)}`);
      logger.info(`Press ${chalk.cyan('Ctrl+C')} to stop`);

    } catch (error) {
      await this.stop();
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Shutting down development server...');

    if (this.watcher) {
      await this.watcher.close();
    }

    if (this.wss) {
      this.wss.close();
    }

    if (this.server) {
      await new Promise<void>((resolve) => {
        this.server.close(() => resolve());
      });
    }

    logger.success('Development server stopped');
  }
}

export const devCommand = new Command('dev')
  .description('Start development server with hot reload')
  .option('-p, --port <port>', 'port to run the dev server on', '3000')
  .option('-h, --host <host>', 'host to run the dev server on', 'localhost')
  .option('--no-watch', 'disable file watching')
  .option('--no-open', 'do not open browser automatically')
  .option('-v, --verbose', 'verbose logging')
  .action(async (options: DevServerOptions) => {
    try {
      const pluginDir = process.cwd();
      
      // Validate plugin directory
      ErrorHandler.validatePluginDirectory(pluginDir);
      await pluginValidator.validatePluginStructure(pluginDir);

      logger.header('🔥 Development Server');

      // Parse port option
      const port = typeof options.port === 'string' ? parseInt(options.port, 10) : options.port;
      
      if (isNaN(port!) || port! < 1 || port! > 65535) {
        throw ErrorHandler.createError(
          'ValidationError',
          'Port must be a number between 1 and 65535'
        );
      }

      const devServer = new DevServer(pluginDir, {
        ...options,
        port
      });

      // Handle graceful shutdown
      const shutdown = async () => {
        logger.newLine();
        await devServer.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);

      await devServer.start();

    } catch (error) {
      ErrorHandler.handleError(error);
      process.exit(1);
    }
  });