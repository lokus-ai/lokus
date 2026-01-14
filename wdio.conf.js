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

export const config = {
  specs: ['./tests/e2e-tauri/**/*.spec.js'],
  exclude: [],

  maxInstances: 1, // Tauri app is single instance

  capabilities: [{
    maxInstances: 1,
    browserName: 'wry', // Tauri's WebView
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
    // Build the app first (release mode for faster startup)
    console.log('Building Tauri app...');
    const buildResult = spawnSync('cargo', ['build', '--release'], {
      cwd: join(process.cwd(), 'src-tauri'),
      stdio: 'inherit',
    });

    if (buildResult.status !== 0) {
      throw new Error('Failed to build Tauri app');
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

  // Configure WebDriver to use tauri-driver
  beforeSession: function (config, capabilities) {
    // Point to the built Tauri binary
    const binaryPath = join(
      process.cwd(),
      'src-tauri',
      'target',
      'release',
      process.platform === 'win32' ? 'lokus.exe' : 'lokus'
    );

    capabilities['tauri:options'] = {
      application: binaryPath,
    };
  },
};
