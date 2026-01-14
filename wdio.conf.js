/**
 * WebdriverIO Configuration for Tauri E2E Testing
 *
 * This runs tests against the REAL Tauri app (not browser).
 * Uses tauri-driver to control the native app via WebDriver protocol.
 *
 * Requirements:
 * - Linux: WebKitWebDriver (apt install webkit2gtk-driver)
 * - Windows: msedgedriver in PATH
 * - macOS: NOT SUPPORTED (no WKWebView driver)
 *
 * For CI: Run on Linux with Xvfb for virtual display
 */

import { spawn, spawnSync } from 'child_process';
import { join } from 'path';

// Keep track of tauri-driver process
let tauriDriver;

// Get binary path for Tauri app
// In CI, use CARGO_TARGET_DIR (shared cache), otherwise use local target dir
const targetDir = process.env.CARGO_TARGET_DIR || join(process.cwd(), 'src-tauri', 'target');
const binaryPath = join(
  targetDir,
  // Use debug build in CI (workflow builds debug), release locally
  process.env.CI ? 'debug' : 'release',
  process.platform === 'win32' ? 'lokus.exe' : 'lokus'
);

export const config = {
  specs: ['./tests/e2e-tauri/**/*.spec.js'],
  exclude: [],

  maxInstances: 1, // Tauri app is single instance

  // Connect to tauri-driver on port 4444
  hostname: 'localhost',
  port: 4444,
  path: '/',

  capabilities: [{
    maxInstances: 1,
    'tauri:options': {
      application: binaryPath,
    },
  }],

  logLevel: 'info',
  bail: 0,

  baseUrl: '', // Not used - we're testing native app

  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,

  framework: 'mocha',
  reporters: ['spec'],

  mochaOpts: {
    ui: 'bdd',
    timeout: 60000,
  },

  // Start tauri-driver before tests
  onPrepare: function () {
    // In CI, the app is already built by the workflow
    // Locally, we build it here
    if (!process.env.CI) {
      console.log('Building Tauri app...');
      const buildResult = spawnSync('cargo', ['build', '--release'], {
        cwd: join(process.cwd(), 'src-tauri'),
        stdio: 'inherit',
      });

      if (buildResult.status !== 0) {
        throw new Error('Failed to build Tauri app');
      }
    } else {
      console.log('CI mode: skipping build (already built by workflow)');
    }

    // Start tauri-driver on port 4444
    console.log('Starting tauri-driver...');
    tauriDriver = spawn('tauri-driver', [], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    tauriDriver.stdout.on('data', (data) => {
      console.log(`[tauri-driver] ${data}`);
    });

    tauriDriver.stderr.on('data', (data) => {
      console.error(`[tauri-driver] ${data}`);
    });

    // Wait for tauri-driver to be ready
    return new Promise((resolve) => {
      setTimeout(resolve, 2000);
    });
  },

  // Stop tauri-driver after tests
  onComplete: function () {
    if (tauriDriver) {
      console.log('Stopping tauri-driver...');
      tauriDriver.kill();
    }
  },
};
