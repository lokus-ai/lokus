#!/usr/bin/env node

/**
 * Find Free Port Utility
 * Automatically finds available ports for worktrees
 */

import net from 'net';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT_REGISTRY_FILE = path.join(__dirname, '..', '.worktree-ports.json');
const START_PORT = 1430;
const PORT_INCREMENT = 10;

/**
 * Load existing port registry
 */
function loadPortRegistry() {
  try {
    if (fs.existsSync(PORT_REGISTRY_FILE)) {
      const data = fs.readFileSync(PORT_REGISTRY_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Warning: Could not load port registry:', error.message);
  }
  return { ports: {}, lastUsed: START_PORT - PORT_INCREMENT };
}

/**
 * Save port registry
 */
function savePortRegistry(registry) {
  try {
    fs.writeFileSync(PORT_REGISTRY_FILE, JSON.stringify(registry, null, 2));
  } catch (error) {
    console.error('Warning: Could not save port registry:', error.message);
  }
}

/**
 * Check if a port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve(false);
      } else {
        resolve(false);
      }
    });

    server.once('listening', () => {
      server.close();
      resolve(true);
    });

    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find the next available port starting from a base
 */
async function findNextAvailablePort(startPort = START_PORT) {
  let port = startPort;
  let hmrPort = port + 1;

  // Try ports in increments of 10
  while (port < 65535) {
    const viteAvailable = await isPortAvailable(port);
    const hmrAvailable = await isPortAvailable(hmrPort);

    if (viteAvailable && hmrAvailable) {
      return { vitePort: port, hmrPort };
    }

    port += PORT_INCREMENT;
    hmrPort = port + 1;
  }

  throw new Error('No available ports found');
}

/**
 * Get all currently in-use ports from existing worktrees
 */
function getUsedPorts() {
  const registry = loadPortRegistry();
  const usedPorts = new Set();

  Object.values(registry.ports).forEach(({ vitePort, hmrPort }) => {
    usedPorts.add(vitePort);
    usedPorts.add(hmrPort);
  });

  return usedPorts;
}

/**
 * Allocate ports for a new worktree
 */
async function allocatePort(worktreeName) {
  const registry = loadPortRegistry();

  // Check if worktree already has ports assigned
  if (registry.ports[worktreeName]) {
    return registry.ports[worktreeName];
  }

  // Find next available port
  const startPort = registry.lastUsed + PORT_INCREMENT;
  const ports = await findNextAvailablePort(startPort);

  // Save allocation
  registry.ports[worktreeName] = ports;
  registry.lastUsed = ports.vitePort;
  savePortRegistry(registry);

  return ports;
}

/**
 * Release ports for a removed worktree
 */
function releasePort(worktreeName) {
  const registry = loadPortRegistry();

  if (registry.ports[worktreeName]) {
    delete registry.ports[worktreeName];
    savePortRegistry(registry);
    return true;
  }

  return false;
}

/**
 * List all port allocations
 */
function listPorts() {
  const registry = loadPortRegistry();
  return registry.ports;
}

/**
 * Check if specific ports are available
 */
async function checkPorts(vitePort, hmrPort) {
  const viteAvailable = await isPortAvailable(vitePort);
  const hmrAvailable = await isPortAvailable(hmrPort);

  return {
    vitePort: { port: vitePort, available: viteAvailable },
    hmrPort: { port: hmrPort, available: hmrAvailable }
  };
}

// CLI Interface
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];

  try {
    switch (command) {
      case 'allocate': {
        if (!arg) {
          console.error('Usage: find-free-port.js allocate <worktree-name>');
          process.exit(1);
        }
        const ports = await allocatePort(arg);
        break;
      }

      case 'release': {
        if (!arg) {
          console.error('Usage: find-free-port.js release <worktree-name>');
          process.exit(1);
        }
        const released = releasePort(arg);
        if (released) {
        } else {
        }
        break;
      }

      case 'list': {
        const ports = listPorts();
        break;
      }

      case 'check': {
        const vitePort = parseInt(arg);
        const hmrPort = parseInt(process.argv[4]);

        if (!vitePort || !hmrPort) {
          console.error('Usage: find-free-port.js check <vite-port> <hmr-port>');
          process.exit(1);
        }

        const status = await checkPorts(vitePort, hmrPort);
        break;
      }

      case 'find': {
        const startPort = arg ? parseInt(arg) : START_PORT;
        const ports = await findNextAvailablePort(startPort);
        break;
      }

      default: {
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export {
  allocatePort,
  releasePort,
  listPorts,
  checkPorts,
  findNextAvailablePort,
  isPortAvailable
};
