#!/usr/bin/env node
/**
 * iOS Development Script
 *
 * Runs the log server and iOS dev together.
 * Usage:
 *   npm run dev:ios              # Interactive device selection
 *   npm run dev:ios 18           # Select device by number
 *   npm run dev:ios "iPhone 17 Pro"  # Select device by name
 */

const { spawn } = require('child_process');
const path = require('path');

const deviceArg = process.argv[2] || '';

// Check if arg is a device name (contains letters) or number
const isDeviceName = deviceArg && /[a-zA-Z]/.test(deviceArg);

// Start log server
const logServer = spawn('node', [path.join(__dirname, 'log-server.cjs')], {
    stdio: 'inherit',
    detached: false
});

// Give log server a moment to start
setTimeout(() => {
    // Build tauri command args
    const tauriArgs = ['tauri', 'ios', 'dev'];
    if (isDeviceName) {
        // Pass device name directly to tauri
        tauriArgs.push(deviceArg);
    }

    // Start tauri ios dev
    const tauriDev = spawn('npx', tauriArgs, {
        stdio: isDeviceName ? 'inherit' : ['pipe', 'inherit', 'inherit'],
        shell: true
    });

    // If device number provided (not name), send it to stdin
    if (deviceArg && !isDeviceName) {
        tauriDev.stdin.write(deviceArg + '\n');
    } else if (!deviceArg) {
        // Pass through stdin from terminal for interactive selection
        process.stdin.pipe(tauriDev.stdin);
    }

    tauriDev.on('close', (code) => {
        logServer.kill();
        process.exit(code);
    });
}, 1000);

// Handle cleanup
process.on('SIGINT', () => {
    logServer.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    logServer.kill();
    process.exit(0);
});
