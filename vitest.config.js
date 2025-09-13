import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
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
    // Watch mode configuration
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