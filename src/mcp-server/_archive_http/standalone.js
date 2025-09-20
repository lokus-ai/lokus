#!/usr/bin/env node

/**
 * Standalone MCP Server Runner
 * 
 * Entry point for running the MCP server as a separate Node.js process.
 * This is spawned by the Tauri backend and handles the actual server execution.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import process from 'process';
import SecureMCPServer from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    port: 3456,
    host: 'localhost',
    environment: 'production'
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--port':
      case '-p':
        config.port = parseInt(args[++i], 10);
        break;
      case '--host':
      case '-h':
        config.host = args[++i];
        break;
      case '--env':
      case '--environment':
        config.environment = args[++i];
        break;
      case '--help':
        console.log(`
Usage: node standalone.js [options]

Options:
  --port, -p <port>       Server port (default: 3456)
  --host, -h <host>       Server host (default: localhost)
  --env <environment>     Environment (default: production)
  --help                  Show this help message
        `);
        process.exit(0);
        break;
      default:
        console.warn(`Unknown argument: ${args[i]}`);
        break;
    }
  }

  return config;
}

// Main execution
async function main() {
  const config = parseArgs();
  
  console.log(`🚀 Starting Lokus MCP Server...`);
  console.log(`   Port: ${config.port}`);
  console.log(`   Host: ${config.host}`);
  console.log(`   Environment: ${config.environment}`);
  console.log(`   PID: ${process.pid}`);

  let server;

  try {
    // Create server instance
    server = new SecureMCPServer({
      environment: config.environment,
      configPath: join(__dirname, 'config')
    });

    // Handle graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      try {
        if (server) {
          await server.stop();
          console.log('✅ MCP Server stopped successfully');
        }
      } catch (error) {
        console.error('❌ Error during shutdown:', error);
      }
      
      process.exit(0);
    };

    // Register signal handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('💥 Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });

    // Start the server
    await server.start(config.port, config.host);

    console.log(`🔌 Lokus MCP Server is running!`);
    console.log(`📍 URL: http://${config.host}:${config.port}`);
    console.log(`📋 Connect with:`);
    console.log(`   claude mcp add lokus --command "node" --args "${process.argv[1]} --port ${config.port}"`);
    console.log(`\n🔍 Server ready for connections...`);

    // Keep the process alive
    const keepAlive = () => {
      // Check server health every 30 seconds
      setTimeout(() => {
        if (server && server.isRunning) {
          keepAlive();
        } else {
          console.error('❌ Server is no longer running, exiting...');
          process.exit(1);
        }
      }, 30000);
    };

    keepAlive();

  } catch (error) {
    console.error('❌ Failed to start MCP Server:', error);
    console.error('Stack trace:', error.stack);
    
    // Try to stop the server if it was created
    if (server) {
      try {
        await server.stop();
      } catch (stopError) {
        console.error('❌ Error stopping server:', stopError);
      }
    }
    
    process.exit(1);
  }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}