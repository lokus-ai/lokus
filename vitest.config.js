import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    globals: true,
    css: true,
    reporters: ['default'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.*',
        '**/*.spec.*',
        'src-tauri/',
        'dist/',
        'build/'
      ]
    },
    // Include remaining test files
    include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}', 'packages/**/*.{test,spec}.{js,jsx,ts,tsx}', 'tests/**/*.{test,spec}.{js,jsx,ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'packages/lokus-plugin-cli/templates/**'
    ],
    // Watch mode configuration (tests removed)
    watch: {
      include: ['src/**/*.{js,jsx,ts,tsx}']
    },
    // Test timeout
    testTimeout: 10000,
    // Show only failures in watch mode
    outputFile: {
      json: './test-results.json'
    }
  }
})