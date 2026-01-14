import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration for Lokus
 *
 * Tests run against the real Tauri app (not just Vite).
 * This ensures all Rust backend functionality works correctly.
 *
 * Prerequisites:
 * - Rust toolchain installed
 * - Run `npm install` first
 *
 * The global setup creates a real temp workspace with test files.
 * Tests navigate to /?workspacePath=<temp-workspace> to open it.
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run tests in parallel, but limit workers since Tauri app is heavier
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html'],
    ['list']
  ],

  // Longer timeouts for Tauri app (Rust compilation on first run)
  timeout: 60000,
  expect: {
    timeout: 10000,
  },

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Longer timeouts for Tauri app
    actionTimeout: 15000,
    navigationTimeout: 45000,
  },

  /* Global setup creates temp workspace, teardown cleans it up */
  globalSetup: './tests/e2e/setup/global-setup.js',
  globalTeardown: './tests/e2e/setup/global-teardown.js',

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        contextOptions: {
          permissions: ['clipboard-read', 'clipboard-write']
        }
      },
    },
  ],

  webServer: {
    // Run real Tauri app - this gives us full Rust backend functionality
    command: 'npm run tauri dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    // Longer timeout for Tauri (Rust compilation can take 5+ minutes first time)
    timeout: 600 * 1000,
    // Capture stdout/stderr for debugging
    stdout: 'pipe',
    stderr: 'pipe',
  },
});