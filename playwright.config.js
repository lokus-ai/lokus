import { defineConfig, devices } from '@playwright/test';

/**
 * E2E Test Configuration for Lokus
 *
 * Tests run in browser against Vite dev server with testMode=true.
 * This bypasses Tauri validation since browsers don't have access to Tauri APIs.
 *
 * The app detects testMode and skips Tauri backend calls, allowing
 * browser-based E2E testing of the UI.
 *
 * Prerequisites:
 * - Run `npm install` first
 *
 * The global setup creates a temp workspace with test files.
 * Tests navigate to /?testMode=true&workspacePath=<temp-workspace> to open it.
 */
export default defineConfig({
  testDir: './tests/e2e',

  fullyParallel: true,
  workers: process.env.CI ? 1 : 4,

  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,

  reporter: [
    ['html'],
    ['list']
  ],

  timeout: 30000,
  expect: {
    timeout: 5000,
  },

  use: {
    baseURL: 'http://localhost:1420',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    actionTimeout: 10000,
    navigationTimeout: 30000,
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
    // Use Vite dev server - tests run in browser with testMode bypass
    command: 'npm run dev',
    url: 'http://localhost:1420',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});